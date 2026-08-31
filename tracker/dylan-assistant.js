(function () {
  "use strict";

  var DYLAN_EMAIL = "dylan.sprouse@unifiedtitle.net";
  var SUPABASE_URL = "https://hdqmcjlpyjpfeltmxfax.supabase.co";
  var SUPABASE_KEY = "sb_publishable_lC2M8fZGmJQt6bWKgfiDnw_4Nx1TwHD";
  var TITLE_STORAGE_KEY = "uteTitleCaseTracker.v2";
  var CALL_STORAGE_KEY = "utei.dylan.callTracker.v1";
  var cloud = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  var titleCases = [];
  var callRecords = [];
  var currentContext = null;
  var titleSource = "Title Search";
  var titleWarning = "";
  var recognition = null;
  var listening = false;
  var finalTranscript = "";

  function el(id) { return document.getElementById(id); }
  function text(value) { return String(value == null ? "" : value); }
  function clean(value) { return text(value).trim(); }
  function escapeHtml(value) { return text(value).replace(/[&<>"']/g, function (char) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]; }); }
  function asArray(value) { return Array.isArray(value) ? value : []; }
  function timeValue(value) { var parsed = Date.parse(value || ""); return Number.isFinite(parsed) ? parsed : 0; }
  function dateLabel(value) { if (!value) return "Not available"; var parsed = new Date(value.length === 10 ? value + "T12:00:00" : value); return isNaN(parsed) ? value : parsed.toLocaleString(undefined, value.length === 10 ? { month: "short", day: "numeric", year: "numeric" } : { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }); }
  function normalizeCaseNumber(value) {
    var compact = clean(value).toUpperCase().replace(/[–—]/g, "-").replace(/\s+/g, "");
    var match = compact.match(/^([A-Z])(\d{2})-?(\d{4})$/);
    return match ? match[1] + match[2] + "-" + match[3] : "";
  }
  function extractCaseNumber(value) {
    var match = clean(value).match(/\b([A-Za-z])\s*(\d)\s*(\d)\s*[- ]?\s*(\d)\s*(\d)\s*(\d)\s*(\d)\b/);
    return match ? normalizeCaseNumber(match.slice(1).join("")) : "";
  }
  function normalizeAddress(value) {
    var suffixes = { road: "rd", street: "st", avenue: "ave", drive: "dr", lane: "ln", court: "ct", boulevard: "blvd", highway: "hwy", circle: "cir", terrace: "ter", trail: "trl", place: "pl" };
    return clean(value).toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim().split(" ").map(function (part) { return suffixes[part] || part; }).join(" ");
  }
  function normalizePerson(value) { return clean(value).toLowerCase().replace(/[^a-z0-9\s'-]/g, "").replace(/\s+/g, " "); }
  function firstOpenTodo(items) { return asArray(items).find(function (item) { return !item.completed; }); }
  function isCompletedCall(record) { return clean(record.status).toLowerCase() === "completed"; }

  function normalizeTitleCase(raw) {
    raw = raw || {};
    var todos = asArray(raw.todos).map(function (todo) {
      return { id: clean(todo.id), text: clean(todo.text), completed: Boolean(todo.done), created_at: todo.createdAt || "", updated_at: todo.updatedAt || "", completed_at: todo.completedAt || "" };
    }).filter(function (todo) { return todo.text; });
    var history = asArray(raw.history).map(function (item) { return { id: clean(item.id), at: item.at || "", by: clean(item.by), text: clean(item.text), source: "Title Search" }; }).filter(function (item) { return item.text; });
    return {
      id: clean(raw.id), case_number: clean(raw.number || raw.caseNumber), address: clean(raw.address), is_deleted: Boolean(raw.isDeleted),
      title_search: {
        status: clean(raw.status), searcher: clean(raw.assigned || raw.assignedPerson), next_step: clean(raw.nextAction), priority: clean(raw.priority), due_date: clean(raw.targetDate).slice(0, 10),
        notes: clean(raw.notes), todos: todos, recent_history: history.sort(function (a, b) { return timeValue(b.at) - timeValue(a.at); }),
        last_updated: raw.lastUpdated || "", last_touched_at: raw.lastTouchedAt || raw.lastUpdated || "", last_touched_by: clean(raw.lastTouchedBy)
      },
      source: "Title Search"
    };
  }

  function normalizeCall(raw) {
    raw = raw || {};
    var completed = clean(raw.status || raw.followStatus).toLowerCase() === "completed";
    var followUp = typeof raw.followUp === "boolean" ? raw.followUp : Boolean(raw.callbackRequired || raw.nextAction || raw.task || (raw.followUpType && raw.followUpType !== "No Follow-Up"));
    var todos = asArray(raw.todos).map(function (todo) { return { id: clean(todo.id), text: clean(todo.text), completed: typeof todo.completed === "boolean" ? todo.completed : Boolean(todo.done), created_at: todo.createdAt || "", completed_at: todo.completedAt || "" }; }).filter(function (todo) { return todo.text; });
    var next = firstOpenTodo(todos);
    return {
      id: clean(raw.id), case_number: clean(raw.fileNumber), address: clean(raw.address), contact_name: clean(raw.caller), phone: clean(raw.phone), company_role: clean(raw.companyRole),
      direction: clean(raw.direction), date: raw.createdAt || raw.updatedAt || "", updated_at: raw.updatedAt || raw.createdAt || "", subject: clean(raw.subject || raw.reason || raw.issueType),
      outcome: clean(raw.outcome), summary: clean(raw.results || raw.outcomeNotes || raw.notes), advised: clean(raw.advised || raw.promise), follow_up: followUp,
      follow_up_type: clean(raw.followType || raw.category || raw.followUpType || (raw.callbackRequired ? "Callback" : "")), status: clean(raw.status || raw.followStatus || (completed ? "Completed" : "Open")),
      assigned_to: clean(raw.owner || raw.assignedTo), next_action: next ? next.text : clean(raw.nextAction || raw.task), due_date: clean(raw.dueDate || raw.followUpDate), completed_at: raw.completedAt || "",
      todos: todos, history: asArray(raw.history).map(function (item) { return { at: item.at || "", text: clean(item.text), source: "Calls" }; }).filter(function (item) { return item.text; }), source: "Calls"
    };
  }

  function readLocalTitleCases() {
    try { var saved = JSON.parse(localStorage.getItem(TITLE_STORAGE_KEY) || "null"); return asArray(saved && saved.cases).map(normalizeTitleCase).filter(function (item) { return !item.is_deleted; }); }
    catch (_error) { return []; }
  }

  function readLocalCalls() {
    try { var saved = JSON.parse(localStorage.getItem(CALL_STORAGE_KEY) || "[]"); return asArray(saved).map(normalizeCall); }
    catch (_error) { return []; }
  }

  async function loadReadOnlyData() {
    titleWarning = "";
    var result = await cloud.from("tracker_state").select("cases,updated_at,updated_by").eq("id", "office").maybeSingle();
    if (result.error || !result.data || !Array.isArray(result.data.cases)) {
      titleCases = readLocalTitleCases();
      titleSource = "Title Search · Browser backup";
      titleWarning = "The shared Title Search record could not be read. Results below come from this browser's last local backup and may be older.";
    } else {
      titleCases = result.data.cases.map(normalizeTitleCase).filter(function (item) { return !item.is_deleted; });
      titleSource = "Title Search · Shared tracker";
    }
    callRecords = readLocalCalls();
    return { title_cases: titleCases, calls: callRecords, title_source: titleSource, title_warning: titleWarning };
  }

  function find_case_by_number(value) {
    var wanted = normalizeCaseNumber(value);
    if (!wanted) return [];
    return titleCases.filter(function (item) { return normalizeCaseNumber(item.case_number) === wanted; });
  }

  function find_case_by_address(value) {
    var wanted = normalizeAddress(value);
    if (!wanted) return [];
    var exact = titleCases.filter(function (item) { return normalizeAddress(item.address) === wanted; });
    if (exact.length) return exact;
    if (wanted.length < 5) return [];
    return titleCases.filter(function (item) { var address = normalizeAddress(item.address); return address.indexOf(wanted) !== -1 || wanted.indexOf(address) !== -1; });
  }

  function find_contact_calls(value) {
    var wanted = normalizePerson(value);
    if (!wanted) return [];
    return callRecords.filter(function (record) { return normalizePerson(record.contact_name).indexOf(wanted) !== -1; }).sort(function (a, b) { return timeValue(b.date) - timeValue(a.date); });
  }

  function get_case_details(id) { return titleCases.find(function (item) { return item.id === id; }) || null; }
  function callBelongsToCase(call, caseRecord) {
    var callNumber = normalizeCaseNumber(call.case_number), caseNumber = normalizeCaseNumber(caseRecord.case_number);
    if (callNumber && caseNumber) return callNumber === caseNumber;
    var callAddress = normalizeAddress(call.address), caseAddress = normalizeAddress(caseRecord.address);
    return Boolean(callAddress && caseAddress && callAddress === caseAddress);
  }
  function get_case_calls(id) { var record = get_case_details(id); return record ? callRecords.filter(function (call) { return callBelongsToCase(call, record); }).sort(function (a, b) { return timeValue(b.date) - timeValue(a.date); }) : []; }
  function get_case_history(id) { var record = get_case_details(id); return record ? record.title_search.recent_history.slice() : []; }
  function get_open_callbacks(id) {
    var list = id ? get_case_calls(id) : callRecords.slice();
    return list.filter(function (call) { return call.follow_up && !isCompletedCall(call); }).sort(function (a, b) { return timeValue(b.updated_at) - timeValue(a.updated_at); });
  }

  function normalizedCaseModel(caseRecord) {
    var calls = get_case_calls(caseRecord.id), callbacks = calls.filter(function (call) { return call.follow_up; });
    return { case_number: caseRecord.case_number, address: caseRecord.address, title_search: caseRecord.title_search, calls: calls, callbacks: callbacks };
  }

  function activityFor(context) {
    var items = [];
    if (context.case_record) {
      context.case_record.title_search.recent_history.forEach(function (item) { items.push({ at: item.at, source: "Title Search", text: item.text }); });
    }
    context.calls.forEach(function (call) {
      items.push({ at: call.date, source: "Calls", text: [call.direction, call.contact_name, call.subject || call.summary].filter(Boolean).join(" · ") });
      call.history.forEach(function (item) { items.push({ at: item.at, source: "Callback Request", text: item.text }); });
    });
    return items.filter(function (item) { return item.text; }).sort(function (a, b) { return timeValue(b.at) - timeValue(a.at); }).slice(0, 16);
  }

  function makeCaseContext(caseRecord) {
    var model = normalizedCaseModel(caseRecord);
    return { case_record: caseRecord, calls: model.calls, callbacks: model.callbacks, label: "Current file", heading: model.case_number, subheading: model.address };
  }

  function makeContactContext(name, calls) {
    var exactCaseNumbers = Array.from(new Set(calls.map(function (call) { return normalizeCaseNumber(call.case_number); }).filter(Boolean)));
    var caseRecord = exactCaseNumbers.length === 1 ? find_case_by_number(exactCaseNumbers[0])[0] || null : null;
    return { case_record: caseRecord, calls: calls, callbacks: calls.filter(function (call) { return call.follow_up; }), label: "Contact activity", heading: name, subheading: caseRecord ? caseRecord.case_number + (caseRecord.address ? " · " + caseRecord.address : "") : "Calls stored in this browser" };
  }

  function setQueryStatus(message, isError) { el("queryStatus").textContent = message || ""; el("queryStatus").classList.toggle("error", Boolean(isError)); }
  function emptyList(message) { return '<div class="empty-list">' + escapeHtml(message) + "</div>"; }

  function renderCalls(list) {
    if (!list.length) return emptyList("No matching call history is stored in this browser.");
    return list.slice(0, 8).map(function (call) {
      return '<article class="list-item"><strong>' + escapeHtml(call.contact_name || "Contact not entered") + '</strong><span>' + escapeHtml(call.summary || call.subject || "No call summary entered.") + '</span><small>' + escapeHtml([call.direction, dateLabel(call.date), call.case_number].filter(Boolean).join(" · ")) + " · Source: Calls</small></article>";
    }).join("");
  }

  function renderCallbacks(list) {
    var open = list.filter(function (call) { return call.follow_up && !isCompletedCall(call); });
    if (!open.length) return emptyList("No open callback or follow-up is associated with this view.");
    return open.map(function (call) {
      return '<article class="list-item open"><strong>' + escapeHtml((call.follow_up_type || "Follow-Up") + " · " + (call.status || "Open")) + '</strong><span>' + escapeHtml(call.next_action || "No next action entered.") + '</span><small>' + escapeHtml([call.contact_name, call.assigned_to ? "Assigned to " + call.assigned_to : "", call.due_date ? "Due " + dateLabel(call.due_date) : "No due date"].filter(Boolean).join(" · ")) + " · Source: Callback Request</small></article>";
    }).join("");
  }

  function renderTitle(record) {
    var unavailable = !record;
    el("titleUnavailable").hidden = !unavailable;
    el("titleDetails").hidden = unavailable;
    if (unavailable) { el("titleUnavailable").textContent = "No Title Search record is selected for this contact view."; return; }
    var data = record.title_search;
    el("caseStatus").textContent = data.status || "Not available";
    el("caseNextStep").textContent = data.next_step || "Not available";
    el("caseSearcher").textContent = data.searcher || "Not available";
    el("casePriority").textContent = data.priority || "Not available";
    el("caseDue").textContent = dateLabel(data.due_date);
    el("caseTouched").textContent = [data.last_touched_by, dateLabel(data.last_touched_at)].filter(Boolean).join(" · ") || "Not available";
    var openTodos = data.todos.filter(function (todo) { return !todo.completed; });
    el("caseTodos").innerHTML = openTodos.length ? openTodos.map(function (todo) { return '<article class="list-item open"><strong>' + escapeHtml(todo.text) + '</strong><small>Source: Title Search checklist</small></article>'; }).join("") : emptyList("No open checklist items are recorded.");
    el("notesSection").hidden = !data.notes;
    el("caseNotes").textContent = data.notes || "";
  }

  function renderContext(context) {
    currentContext = context;
    el("contextPanel").hidden = false;
    el("contextLabel").textContent = context.label;
    el("caseNumber").textContent = context.heading || "Selected activity";
    el("caseAddress").textContent = context.subheading || "";
    el("titleSource").textContent = context.case_record ? titleSource : "Title Search · Not selected";
    renderTitle(context.case_record);
    el("recentCalls").innerHTML = renderCalls(context.calls);
    el("openCallbacks").innerHTML = renderCallbacks(context.callbacks);
    el("callsNotice").textContent = callRecords.length ? "Call and callback information comes from this browser's local Calls & Follow-Ups storage." : "No Calls & Follow-Ups data is stored in this browser. Call history is not centrally available yet.";
    var activity = activityFor(context);
    el("activityTimeline").innerHTML = activity.length ? activity.map(function (item) { return '<div class="timeline-item"><time>' + escapeHtml(dateLabel(item.at)) + '</time><span class="timeline-source">' + escapeHtml(item.source) + '</span><p>' + escapeHtml(item.text) + "</p></div>"; }).join("") : emptyList("No activity is available from the current sources.");
    el("answerQuestion").textContent = "";
    el("answerText").textContent = context.case_record ? "The file is loaded. Ask what is going on, the next step, the latest call, or whether callbacks are open." : "The contact activity is loaded. Ask about the latest call or open follow-up.";
  }

  function clearCurrentContext() {
    currentContext = null;
    el("contextPanel").hidden = true;
    el("answerQuestion").textContent = "";
    el("answerText").textContent = "";
  }

  function showCaseChoices(items, message) {
    var panel = el("choicePanel");
    panel.hidden = false;
    panel.innerHTML = "<h3>" + escapeHtml(message) + "</h3>" + items.map(function (item) { return '<button type="button" class="choice-button" data-case-choice="' + escapeHtml(item.id) + '"><span><strong>' + escapeHtml(item.case_number || "No case number") + '</strong><span>' + escapeHtml(item.address || "No address") + '</span></span><b>›</b></button>'; }).join("");
  }

  function contactGroups(calls) {
    var groups = new Map();
    calls.forEach(function (call) { var key = normalizePerson(call.contact_name) || "unknown"; if (!groups.has(key)) groups.set(key, { name: call.contact_name || "Contact not entered", calls: [] }); groups.get(key).calls.push(call); });
    return Array.from(groups.values());
  }

  function showContactChoices(groups) {
    var panel = el("choicePanel");
    panel.hidden = false;
    panel.innerHTML = "<h3>I found more than one matching contact. Choose one.</h3>" + groups.map(function (group, index) { return '<button type="button" class="choice-button" data-contact-choice="' + index + '"><span><strong>' + escapeHtml(group.name) + '</strong><span>' + group.calls.length + " matching call" + (group.calls.length === 1 ? "" : "s") + '</span></span><b>›</b></button>'; }).join("");
    panel.__contactGroups = groups;
  }

  function latestCall(context) { return context.calls.slice().sort(function (a, b) { return timeValue(b.date) - timeValue(a.date); })[0] || null; }
  function answerFromContext(question) {
    if (!currentContext) return "Select a file or contact first.";
    var q = clean(question).toLowerCase(), record = currentContext.case_record, latest = latestCall(currentContext), open = currentContext.callbacks.filter(function (call) { return call.follow_up && !isCompletedCall(call); });
    if (/next step|still needs|needs to happen|what.*next/.test(q)) return record ? (record.title_search.next_step ? "The recorded next step is: " + record.title_search.next_step : "I don't see a next step recorded for this file.") : "A Title Search file is not selected, so I can't determine its next step.";
    if (/most recent call|last call|latest call|who did i talk|who.*talk/.test(q)) return latest ? "The most recent stored call was " + dateLabel(latest.date) + " with " + (latest.contact_name || "an unnamed contact") + ". " + (latest.summary || latest.subject || "No summary was recorded.") : "I don't see a matching call stored in this browser.";
    if (/callback|follow.?up/.test(q)) return open.length ? "There " + (open.length === 1 ? "is 1 open callback or follow-up" : "are " + open.length + " open callbacks or follow-ups") + ". The next recorded action is: " + (open[0].next_action || "not entered") + "." : "I don't see an open callback or follow-up associated with this view.";
    if (/title.*status|search.*status|what.*status/.test(q)) return record ? (record.title_search.status ? "The Title Search status is " + record.title_search.status + "." : "I don't see a Title Search status recorded.") : "A Title Search file is not selected.";
    if (/latest update|last update/.test(q)) {
      var activity = activityFor(currentContext)[0];
      return activity ? "The latest available activity is from " + activity.source + " on " + dateLabel(activity.at) + ": " + activity.text : "I don't see any recorded activity for this view.";
    }
    if (/what.*going on|summar|overview|this file/.test(q)) {
      if (!record) return latest ? "I found contact activity but no single Title Search file. The latest stored call says: " + (latest.summary || latest.subject || "No summary was recorded.") : "I don't have enough retrieved information to summarize this view.";
      var pieces = ["Title Search status: " + (record.title_search.status || "not recorded") + ".", "Next step: " + (record.title_search.next_step || "not recorded") + "."];
      pieces.push(open.length ? open.length + " open callback or follow-up" + (open.length === 1 ? " is" : "s are") + " recorded." : "No open callback or follow-up is visible.");
      if (latest) pieces.push("The latest stored call was with " + (latest.contact_name || "an unnamed contact") + " on " + dateLabel(latest.date) + ".");
      return pieces.join(" ");
    }
    return "I can answer from the loaded information about the Title Search status, next step, recent activity, calls, and open callbacks. I won't guess about information that is not recorded.";
  }

  function maybeAnswerLoadedQuery(query) {
    if (!/\b(what|who|status|next step|most recent|latest|last call|are there|going on|still needs)\b/i.test(query)) return;
    el("answerQuestion").textContent = "Question: " + query;
    el("answerText").textContent = answerFromContext(query);
  }

  function extractAddressQuestion(question) {
    var value = clean(question).replace(/[?.!]+$/g, "");
    var patterns = [
      /^(?:show me|pull up|find|open)\s+(?:the\s+)?(?:address|property)\s+(?:at\s+)?(.+)$/i,
      /^(?:show me|pull up|find|open)\s+(?:the\s+)?file\s+(?:at|for)\s+(.+)$/i,
      /^(?:show me|pull up|find|open)\s+(\d+\s+.+)$/i
    ];
    for (var i = 0; i < patterns.length; i++) {
      var match = value.match(patterns[i]), candidate = match && clean(match[1]);
      if (candidate && /^\d{1,8}\s+[A-Za-z0-9]/.test(candidate) && /[A-Za-z]/.test(candidate)) return candidate;
    }
    return "";
  }

  function handleQuery(question) {
    var query = clean(question);
    if (!query) { setQueryStatus("Talk or type what you want to find.", true); el("questionInput").focus(); return; }
    el("choicePanel").hidden = true;
    var caseNumber = extractCaseNumber(query);
    if (caseNumber) {
      clearCurrentContext();
      var casesByNumber = find_case_by_number(caseNumber);
      if (!casesByNumber.length) { setQueryStatus("I couldn't find " + caseNumber + ". No file is currently active.", true); return; }
      if (casesByNumber.length > 1) { setQueryStatus("I found more than one possible file.", false); showCaseChoices(casesByNumber, "Choose the correct file."); return; }
      renderContext(makeCaseContext(casesByNumber[0])); maybeAnswerLoadedQuery(query); setQueryStatus(titleWarning || "Loaded " + casesByNumber[0].case_number + ".", Boolean(titleWarning)); return;
    }
    var contactMatch = query.match(/(?:find|show me|pull up)?\s*([A-Za-z][A-Za-z .'-]*?)(?:'s)?\s+(?:callback|calls?|follow.?up)/i) || query.match(/calls?\s+from\s+([A-Za-z][A-Za-z .'-]*)/i);
    if (contactMatch) {
      clearCurrentContext();
      var contactCalls = find_contact_calls(contactMatch[1]);
      if (!contactCalls.length) { setQueryStatus("I couldn't find a matching contact in this browser's Calls & Follow-Ups data. No file is currently active.", true); return; }
      var groups = contactGroups(contactCalls);
      if (groups.length > 1) { setQueryStatus("I found multiple matching contacts.", false); showContactChoices(groups); return; }
      renderContext(makeContactContext(groups[0].name, groups[0].calls)); setQueryStatus("Loaded " + groups[0].calls.length + " stored call" + (groups[0].calls.length === 1 ? "" : "s") + " for " + groups[0].name + ".", false); return;
    }
    var address = extractAddressQuestion(query);
    if (address) {
      clearCurrentContext();
      var casesByAddress = find_case_by_address(address);
      if (!casesByAddress.length) { setQueryStatus("I couldn't find a Title Search file matching that address. No file is currently active.", true); return; }
      if (casesByAddress.length > 1) { setQueryStatus("I found " + casesByAddress.length + " possible address matches.", false); showCaseChoices(casesByAddress, "Choose the correct property."); return; }
      renderContext(makeCaseContext(casesByAddress[0])); maybeAnswerLoadedQuery(query); setQueryStatus(titleWarning || "Loaded " + casesByAddress[0].case_number + ".", Boolean(titleWarning)); return;
    }
    if (currentContext) {
      var answer = answerFromContext(query);
      el("answerQuestion").textContent = "Question: " + query;
      el("answerText").textContent = answer;
      setQueryStatus("Answered only from the information currently loaded below.", false);
      el("answerText").scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setQueryStatus("I couldn't identify a file number, property address, or contact. Try a complete case number or street address.", true);
  }

  function setupSpeech() {
    var Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) { el("micButton").disabled = true; el("micHelp").textContent = "Speech recognition isn't available in this browser. You can always type your question."; return; }
    recognition = new Recognition(); recognition.lang = "en-US"; recognition.continuous = false; recognition.interimResults = true; recognition.maxAlternatives = 1;
    recognition.onstart = function () { listening = true; finalTranscript = ""; el("micButton").setAttribute("aria-pressed", "true"); el("micButtonLabel").textContent = "Stop"; el("micState").dataset.state = "listening"; el("micState").lastChild.nodeValue = "Listening…"; };
    recognition.onresult = function (event) { var interim = ""; for (var i = event.resultIndex; i < event.results.length; i++) { if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript + " "; else interim += event.results[i][0].transcript; } el("questionInput").value = (finalTranscript + interim).trim(); };
    recognition.onerror = function (event) { el("micHelp").textContent = event.error === "not-allowed" ? "Microphone permission was denied. Type your question instead." : "The microphone couldn't capture that. Try again or type your question."; };
    recognition.onend = function () { listening = false; el("micButton").setAttribute("aria-pressed", "false"); el("micButtonLabel").textContent = "Talk"; el("micState").dataset.state = "ready"; el("micState").lastChild.nodeValue = "Ready"; if (clean(el("questionInput").value)) el("micHelp").textContent = "Review or correct the transcript, then search."; };
  }

  function bindEvents() {
    el("searchButton").addEventListener("click", function () { handleQuery(el("questionInput").value); });
    el("questionInput").addEventListener("keydown", function (event) { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); handleQuery(el("questionInput").value); } });
    el("micButton").addEventListener("click", function () { if (!recognition) return; if (listening) recognition.stop(); else { try { recognition.start(); } catch (_error) { el("micHelp").textContent = "The microphone is already starting. Please wait."; } } });
    document.querySelectorAll("[data-example]").forEach(function (button) { button.addEventListener("click", function () { el("questionInput").value = button.dataset.example; handleQuery(button.dataset.example); }); });
    el("choicePanel").addEventListener("click", function (event) {
      var caseButton = event.target.closest("[data-case-choice]");
      if (caseButton) { var record = get_case_details(caseButton.dataset.caseChoice); if (record) { renderContext(makeCaseContext(record)); el("choicePanel").hidden = true; setQueryStatus(titleWarning || "Loaded " + record.case_number + ".", Boolean(titleWarning)); } return; }
      var contactButton = event.target.closest("[data-contact-choice]");
      if (contactButton) { var group = el("choicePanel").__contactGroups[Number(contactButton.dataset.contactChoice)]; if (group) { renderContext(makeContactContext(group.name, group.calls)); el("choicePanel").hidden = true; setQueryStatus("Loaded stored activity for " + group.name + ".", false); } }
    });
  }

  function showDenied() { el("accessGate").innerHTML = '<section class="gate-card"><div class="eyebrow">Dylan-only workspace</div><h1>Access unavailable</h1><p>Sign in to Dylan\'s authenticated tracker account first.</p><a href="./">Return to Tracker Sign-In</a></section>'; }

  async function initialize() {
    setupSpeech(); bindEvents();
    try {
      var sessionResult = await cloud.auth.getSession(), session = sessionResult.data && sessionResult.data.session;
      if (!session) { showDenied(); return false; }
      var userResult = await cloud.auth.getUser();
      if (userResult.error || !userResult.data || !userResult.data.user || clean(userResult.data.user.email).toLowerCase() !== DYLAN_EMAIL) { showDenied(); return false; }
      await loadReadOnlyData();
      el("accessGate").remove(); el("assistantApp").hidden = false;
      setQueryStatus(titleWarning || (callRecords.length ? "Ready. Shared Title Search and this browser's Calls data are available." : "Ready. Shared Title Search is available; no Calls data is stored in this browser."), Boolean(titleWarning));
      return true;
    } catch (_error) { showDenied(); return false; }
  }

  initialize();
}());
