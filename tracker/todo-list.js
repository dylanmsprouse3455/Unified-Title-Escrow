(function () {
  "use strict";

  var DYLAN_EMAIL = "dylan.sprouse@unifiedtitle.net";
  var SUPABASE_URL = "https://hdqmcjlpyjpfeltmxfax.supabase.co";
  var SUPABASE_KEY = "sb_publishable_lC2M8fZGmJQt6bWKgfiDnw_4Nx1TwHD";
  var STORAGE_KEY = "utei.dylan.voiceTodos.v1";
  var cloud = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  var tasks = [];
  var session = null;
  var storageMode = "local";
  var recognition = null;
  var listening = false;
  var finalTranscript = "";

  function el(id) { return document.getElementById(id); }
  function text(value) { return String(value == null ? "" : value); }
  function clean(value, max) { return text(value).trim().slice(0, max || 4000); }
  function uuid() { return crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (char) { var value = Math.random() * 16 | 0; return (char === "x" ? value : (value & 3 | 8)).toString(16); }); }
  function nowIso() { return new Date().toISOString(); }
  function localIsoDate() { var date = new Date(); return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-"); }
  function isDate(value) { return /^\d{4}-\d{2}-\d{2}$/.test(value || ""); }
  function isTime(value) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(value || ""); }
  function validPriority(value) { return ["low", "normal", "high"].includes(value) ? value : "normal"; }

  function normalizeTask(raw, originalRequest) {
    var stamp = nowIso();
    return {
      id: clean(raw && raw.id, 100) || uuid(),
      user_id: session && session.user ? session.user.id : null,
      title: clean(raw && raw.title, 500) || "Untitled task",
      details: clean(raw && raw.details, 4000) || null,
      due_date: isDate(raw && raw.due_date) ? raw.due_date : null,
      due_time: isTime(raw && raw.due_time) ? raw.due_time : null,
      due_text: clean(raw && raw.due_text, 200) || null,
      priority: validPriority(raw && raw.priority),
      completed: Boolean(raw && raw.completed),
      original_request: clean((raw && raw.original_request) || originalRequest, 8000) || null,
      created_at: raw && raw.created_at ? raw.created_at : stamp,
      updated_at: raw && raw.updated_at ? raw.updated_at : stamp
    };
  }

  function escapeHtml(value) {
    return text(value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  }

  function localDate(value) {
    if (!value) return "";
    var parts = value.split("-").map(Number);
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(parts[0], parts[1] - 1, parts[2]));
  }

  function localTime(value) {
    if (!value) return "";
    var parts = value.split(":").map(Number);
    return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(2000, 0, 1, parts[0], parts[1]));
  }

  function dueLabel(task) {
    var pieces = [];
    if (task.due_date) pieces.push(localDate(task.due_date));
    if (task.due_time) pieces.push(localTime(task.due_time));
    if (!pieces.length && task.due_text) pieces.push(task.due_text);
    else if (task.due_text && !pieces.join(" ").toLowerCase().includes(task.due_text.toLowerCase())) pieces.push("(" + task.due_text + ")");
    return pieces.join(" · ");
  }

  function setMicState(state, label) {
    var stateNode = el("micState");
    stateNode.dataset.state = state;
    stateNode.lastChild.nodeValue = label;
  }

  function setStatus(message, isError) {
    el("parseStatus").textContent = message || "";
    el("parseStatus").classList.toggle("error", Boolean(isError));
  }

  function setStorageStatus(message) { el("storageStatus").textContent = message || ""; }

  function saveLocal() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }

  function loadLocal() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]").map(function (item) { return normalizeTask(item); }); }
    catch (_error) { return []; }
  }

  async function loadTasks() {
    try {
      var result = await cloud.from("dylan_voice_todos").select("id,user_id,title,details,due_date,due_time,due_text,priority,completed,original_request,created_at,updated_at").order("created_at", { ascending: false });
      if (result.error) throw result.error;
      storageMode = "cloud";
      tasks = (result.data || []).map(function (item) { return normalizeTask(item); });
      setStorageStatus("Saved securely to your account");
    } catch (_error) {
      storageMode = "local";
      tasks = loadLocal();
      setStorageStatus("Saved in this browser until cloud setup is completed");
    }
    render();
  }

  async function persist(task) {
    saveLocal();
    if (storageMode !== "cloud") return;
    var result = await cloud.from("dylan_voice_todos").upsert(task, { onConflict: "id" });
    if (result.error) {
      storageMode = "local";
      setStorageStatus("Cloud save unavailable — changes are safe in this browser");
      throw result.error;
    }
  }

  async function persistMany(items) {
    saveLocal();
    if (storageMode !== "cloud" || !items.length) return;
    var result = await cloud.from("dylan_voice_todos").upsert(items, { onConflict: "id" });
    if (result.error) {
      storageMode = "local";
      setStorageStatus("Cloud save unavailable — changes are safe in this browser");
      throw result.error;
    }
  }

  async function removeTasks(ids) {
    saveLocal();
    if (storageMode !== "cloud" || !ids.length) return;
    var result = await cloud.from("dylan_voice_todos").delete().in("id", ids);
    if (result.error) {
      storageMode = "local";
      setStorageStatus("Cloud delete unavailable — this browser has the current list");
      throw result.error;
    }
  }

  function render() {
    var active = tasks.filter(function (task) { return !task.completed; }).length;
    var completed = tasks.length - active;
    el("taskSummary").textContent = tasks.length ? active + " open · " + completed + " completed" : "Nothing here yet.";
    el("clearCompletedButton").disabled = completed === 0;
    el("emptyState").hidden = tasks.length > 0;
    el("taskList").innerHTML = tasks.map(function (task) {
      var due = dueLabel(task);
      var priority = task.priority.charAt(0).toUpperCase() + task.priority.slice(1);
      return '<article class="todo-task' + (task.completed ? " is-complete" : "") + '" data-id="' + escapeHtml(task.id) + '">' +
        '<input class="todo-task-check" type="checkbox" aria-label="' + (task.completed ? "Reopen" : "Complete") + ' ' + escapeHtml(task.title) + '"' + (task.completed ? " checked" : "") + '>' +
        '<div><h3>' + escapeHtml(task.title) + '</h3>' +
        (task.details ? '<p class="todo-task-details">' + escapeHtml(task.details) + '</p>' : "") +
        '<div class="todo-task-meta">' +
        (due ? '<span class="todo-pill">Due: ' + escapeHtml(due) + '</span>' : "") +
        '<span class="todo-pill priority-' + escapeHtml(task.priority) + '">' + escapeHtml(priority) + ' priority</span></div></div>' +
        '<div class="todo-task-actions"><button class="todo-icon-button todo-edit" type="button" aria-label="Edit ' + escapeHtml(task.title) + '">Edit</button><button class="todo-icon-button todo-delete" type="button" aria-label="Delete ' + escapeHtml(task.title) + '">×</button></div></article>';
    }).join("");
  }

  function openEditor(task) {
    el("taskEditorTitle").textContent = task ? "Edit Task" : "Add Task";
    el("taskId").value = task ? task.id : "";
    el("taskTitle").value = task ? task.title : "";
    el("taskDetails").value = task && task.details ? task.details : "";
    el("taskDueDate").value = task && task.due_date ? task.due_date : "";
    el("taskDueTime").value = task && task.due_time ? task.due_time : "";
    el("taskDueText").value = task && task.due_text ? task.due_text : "";
    el("taskPriority").value = task ? task.priority : "normal";
    el("taskEditorWrap").hidden = false;
    setTimeout(function () { el("taskTitle").focus(); }, 20);
  }

  function closeEditor() { el("taskEditorWrap").hidden = true; }

  async function saveEditor(event) {
    event.preventDefault();
    var id = el("taskId").value;
    var existing = tasks.find(function (task) { return task.id === id; });
    var task = normalizeTask({
      id: id || uuid(), title: el("taskTitle").value, details: el("taskDetails").value,
      due_date: el("taskDueDate").value, due_time: el("taskDueTime").value, due_text: el("taskDueText").value,
      priority: el("taskPriority").value, completed: existing ? existing.completed : false,
      original_request: existing ? existing.original_request : null,
      created_at: existing ? existing.created_at : nowIso(), updated_at: nowIso()
    });
    if (existing) tasks = tasks.map(function (item) { return item.id === task.id ? task : item; });
    else tasks.unshift(task);
    render(); closeEditor();
    try { await persist(task); } catch (_error) { /* local fallback is already saved */ }
  }

  async function toggleTask(id, checked) {
    var task = tasks.find(function (item) { return item.id === id; });
    if (!task) return;
    task.completed = checked;
    task.updated_at = nowIso();
    render();
    try { await persist(task); } catch (_error) { /* local fallback is already saved */ }
  }

  async function deleteTask(id) {
    var task = tasks.find(function (item) { return item.id === id; });
    if (!task || !window.confirm('Delete "' + task.title + '"?')) return;
    tasks = tasks.filter(function (item) { return item.id !== id; });
    render();
    try { await removeTasks([id]); } catch (_error) { /* local fallback is already saved */ }
  }

  async function clearCompleted() {
    var ids = tasks.filter(function (task) { return task.completed; }).map(function (task) { return task.id; });
    if (!ids.length || !window.confirm("Remove " + ids.length + " completed task" + (ids.length === 1 ? "" : "s") + " from the list?")) return;
    tasks = tasks.filter(function (task) { return !task.completed; });
    render();
    try { await removeTasks(ids); } catch (_error) { /* local fallback is already saved */ }
  }

  async function parseRequest() {
    var request = clean(el("requestInput").value, 8000);
    if (!request) { setStatus("Talk or type what you need to do first.", true); el("requestInput").focus(); return; }
    el("parseButton").disabled = true;
    setMicState("processing", "Processing...");
    setStatus("Turning your request into tasks…", false);
    try {
      var result = await cloud.functions.invoke("parse-todos", { body: { request: request, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, local_date: localIsoDate() } });
      if (result.error) throw result.error;
      if (!result.data || !Array.isArray(result.data.tasks) || !result.data.tasks.length) throw new Error("No tasks were returned.");
      var generated = result.data.tasks.map(function (item) { return normalizeTask(item, request); });
      tasks = generated.concat(tasks);
      render();
      try { await persistMany(generated); } catch (_error) { /* local fallback is already saved */ }
      setStatus("Added " + generated.length + " task" + (generated.length === 1 ? "" : "s") + ". Review any dates before relying on them.", false);
    } catch (error) {
      setStatus((error && error.message ? error.message : "The AI parser is unavailable.") + " You can still add tasks manually.", true);
    } finally {
      el("parseButton").disabled = false;
      setMicState("ready", "Ready");
    }
  }

  function setupSpeech() {
    var Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      el("micButton").disabled = true;
      el("micHelp").textContent = "Speech recognition isn't available in this browser. You can type below.";
      return;
    }
    recognition = new Recognition();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onstart = function () {
      listening = true; finalTranscript = "";
      el("micButton").setAttribute("aria-pressed", "true"); el("micButtonLabel").textContent = "Stop";
      setMicState("listening", "Listening..."); el("micHelp").textContent = "Speak naturally, then press Stop when you're finished.";
    };
    recognition.onresult = function (event) {
      var interim = "";
      for (var i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript + " ";
        else interim += event.results[i][0].transcript;
      }
      el("requestInput").value = (finalTranscript + interim).trim();
    };
    recognition.onerror = function (event) {
      var denied = event.error === "not-allowed" || event.error === "service-not-allowed";
      el("micHelp").textContent = denied ? "Microphone permission was denied. You can type your tasks instead." : "The microphone couldn't capture that. You can try again or type below.";
    };
    recognition.onend = function () {
      listening = false; el("micButton").setAttribute("aria-pressed", "false"); el("micButtonLabel").textContent = "Talk";
      setMicState("ready", "Ready");
      if (el("requestInput").value.trim()) el("micHelp").textContent = "Review or correct the transcript, then make your to-do list.";
    };
  }

  function toggleSpeech() {
    if (!recognition) return;
    if (listening) recognition.stop();
    else {
      try { recognition.start(); }
      catch (_error) { el("micHelp").textContent = "The microphone is already starting. Please wait a moment."; }
    }
  }

  function bindEvents() {
    el("micButton").addEventListener("click", toggleSpeech);
    el("parseButton").addEventListener("click", parseRequest);
    el("addTaskButton").addEventListener("click", function () { openEditor(null); });
    el("clearCompletedButton").addEventListener("click", clearCompleted);
    el("closeEditorButton").addEventListener("click", closeEditor);
    el("cancelEditorButton").addEventListener("click", closeEditor);
    el("taskEditorForm").addEventListener("submit", saveEditor);
    el("taskEditorWrap").addEventListener("click", function (event) { if (event.target === el("taskEditorWrap")) closeEditor(); });
    el("taskList").addEventListener("change", function (event) {
      var card = event.target.closest(".todo-task");
      if (card && event.target.classList.contains("todo-task-check")) toggleTask(card.dataset.id, event.target.checked);
    });
    el("taskList").addEventListener("click", function (event) {
      var card = event.target.closest(".todo-task"); if (!card) return;
      if (event.target.classList.contains("todo-edit")) openEditor(tasks.find(function (task) { return task.id === card.dataset.id; }));
      if (event.target.classList.contains("todo-delete")) deleteTask(card.dataset.id);
    });
    document.addEventListener("keydown", function (event) { if (event.key === "Escape" && !el("taskEditorWrap").hidden) closeEditor(); });
  }

  function showDenied() {
    el("accessGate").innerHTML = '<section class="todo-gate-card"><div class="todo-eyebrow">Dylan-only workspace</div><h1>Sign in through the tracker first</h1><p>This tool is available only from Dylan\'s authenticated workspace.</p><a class="todo-button todo-button-primary" href="./">Return to Tracker Sign-In</a></section>';
  }

  async function initialize() {
    bindEvents(); setupSpeech();
    try {
      var sessionResult = await cloud.auth.getSession();
      session = sessionResult.data && sessionResult.data.session;
      if (!session) { showDenied(); return; }
      var userResult = await cloud.auth.getUser();
      if (userResult.error || !userResult.data.user || text(userResult.data.user.email).toLowerCase() !== DYLAN_EMAIL) { showDenied(); return; }
      session.user = userResult.data.user;
      el("accessGate").remove(); el("todoApp").hidden = false;
      await loadTasks();
    } catch (_error) { showDenied(); }
  }

  initialize();
}());
