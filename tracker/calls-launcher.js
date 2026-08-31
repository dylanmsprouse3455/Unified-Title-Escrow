(function () {
  "use strict";

  if (typeof cloud === "undefined" || typeof normalizeCase !== "function") return;

  var rowSnapshots = new Map();
  var rowUpdatedAt = new Map();
  var rowChannel = null;
  var legacyLoadSharedState = loadSharedState;
  var bridgeInstalled = false;

  function serializeCase(record) {
    return JSON.stringify(record || {});
  }

  function rowToCase(row) {
    var payload = Object.assign({}, row && row.payload || {});
    payload.id = row.id || payload.id;
    if (!payload.number && row.case_number) payload.number = row.case_number;
    return normalizeCase(payload);
  }

  function rememberRow(record, updatedAt) {
    if (!record || !record.id) return;
    rowSnapshots.set(record.id, serializeCase(record));
    if (updatedAt) rowUpdatedAt.set(record.id, updatedAt);
  }

  function cacheCases(stamp) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 3, exportedAt: stamp || nowISO(), cases: cases }));
    } catch (_error) {}
  }

  function updateLastSave(stamp) {
    var node = document.getElementById("lastSave");
    if (node && stamp) node.textContent = displayDateTime(stamp);
  }

  async function loadRows() {
    var result = await cloud.from("title_search_cases")
      .select("id,case_number,payload,updated_at,updated_by,deleted_at")
      .order("updated_at", { ascending: true });

    if (result.error) {
      console.error(result.error);
      await legacyLoadSharedState();
      toast("Could not load case rows - showing the legacy shared board");
      return false;
    }

    if (!result.data || !result.data.length) {
      await legacyLoadSharedState();
      toast("Case-row storage is empty - showing the legacy shared board");
      return false;
    }

    cloudApplying = true;
    cases = result.data.map(rowToCase);
    rowSnapshots.clear();
    rowUpdatedAt.clear();
    result.data.forEach(function (row, index) {
      rememberRow(cases[index], row.updated_at);
    });
    cloudApplying = false;

    var latest = result.data.reduce(function (value, row) {
      return !value || String(row.updated_at) > String(value) ? row.updated_at : value;
    }, "");
    cacheCases(latest);
    refreshFilters();
    render();
    updateLastSave(latest);
    return true;
  }

  async function saveChangedRows() {
    if (!cloudSession || cloudApplying) return;

    var changed = cases.filter(function (record) {
      return !rowSnapshots.has(record.id) || rowSnapshots.get(record.id) !== serializeCase(record);
    });
    if (!changed.length) return;

    var conflicts = [];
    var latestStamp = "";

    for (var i = 0; i < changed.length; i++) {
      var record = changed[i];
      var expected = rowUpdatedAt.has(record.id) ? rowUpdatedAt.get(record.id) : null;
      var response = await cloud.rpc("save_title_search_case", {
        p_id: record.id,
        p_case_number: record.number || "",
        p_payload: record,
        p_expected_updated_at: expected
      });

      if (response.error) {
        console.error(response.error);
        toast("Shared case save failed - browser backup retained");
        continue;
      }

      var saved = Array.isArray(response.data) ? response.data[0] : response.data;
      if (!saved || !saved.success) {
        conflicts.push(record.id);
        continue;
      }

      rememberRow(record, saved.saved_updated_at);
      latestStamp = saved.saved_updated_at || latestStamp;
    }

    cacheCases(latestStamp || nowISO());
    updateLastSave(latestStamp);

    if (conflicts.length) {
      var latest = await cloud.from("title_search_cases")
        .select("id,case_number,payload,updated_at,updated_by,deleted_at")
        .in("id", conflicts);
      if (!latest.error && latest.data) {
        cloudApplying = true;
        latest.data.forEach(function (row) {
          var incoming = rowToCase(row);
          var index = cases.findIndex(function (item) { return item.id === incoming.id; });
          if (index >= 0) cases[index] = incoming;
          else cases.push(incoming);
          rememberRow(incoming, row.updated_at);
        });
        cloudApplying = false;
        cacheCases(nowISO());
        refreshFilters();
        render();
      }
      alert("A case you edited was changed by someone else first. I did not overwrite their newer work. The latest shared version has been reloaded; please review that case and apply your change again if it is still needed.");
    }
  }

  function applyRealtimeRow(row) {
    if (!row || !row.id) return;
    var known = rowUpdatedAt.get(row.id);
    if (known && String(row.updated_at || "") <= String(known)) return;

    var incoming = rowToCase(row);
    cloudApplying = true;
    var index = cases.findIndex(function (item) { return item.id === incoming.id; });
    if (index >= 0) cases[index] = incoming;
    else cases.push(incoming);
    rememberRow(incoming, row.updated_at);
    cloudApplying = false;

    cacheCases(row.updated_at);
    refreshFilters();
    render();
    updateLastSave(row.updated_at);

    var editorEmail = String(row.updated_by || "").trim();
    if (editorEmail && (!cloudSession || editorEmail.toLowerCase() !== String(cloudSession.user.email || "").toLowerCase())) {
      toast("Updated by " + editorEmail);
    }
  }

  async function wireRowStorage(session) {
    cloudSession = session;
    var auth = document.getElementById("cloudAuth");
    var email = document.getElementById("cloudUserEmail");
    var user = document.getElementById("cloudUser");
    if (auth) auth.classList.remove("show");
    if (email) email.textContent = session.user.email;
    if (user) user.classList.add("show");

    await loadRows();
    if (typeof initializeUndoRedo === "function") initializeUndoRedo();

    try {
      if (typeof cloud.removeAllChannels === "function") await cloud.removeAllChannels();
    } catch (_error) {}

    rowChannel = cloud.channel("title-search-case-rows")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "title_search_cases" }, function (payload) { applyRealtimeRow(payload.new); })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "title_search_cases" }, function (payload) { applyRealtimeRow(payload.new); })
      .subscribe();

    if (typeof maybeShowTutorial === "function") setTimeout(maybeShowTutorial, 350);
    bridgeInstalled = true;
    return true;
  }

  loadSharedState = loadRows;
  pushSharedState = saveChangedRows;
  activateCloudSession = wireRowStorage;

  if (cloudSession && cloudSession.user && !bridgeInstalled) {
    setTimeout(function () { wireRowStorage(cloudSession); }, 0);
  }
}());

(function () {
  "use strict";
  var DYLAN_EMAIL = "dylan.sprouse@unifiedtitle.net";
  var observer;

  function currentUserIsDylan() {
    var email = document.getElementById("cloudUserEmail");
    return !!email && String(email.textContent || "").trim().toLowerCase() === DYLAN_EMAIL;
  }

  function installLauncher() {
    var grid = document.getElementById("dylanHomeGrid");
    var panel = document.getElementById("dylanToolboxPanel");
    if (!grid || !panel || !currentUserIsDylan()) return false;

    if (!document.getElementById("callsLauncherStyles")) {
      var style = document.createElement("style");
      style.id = "callsLauncherStyles";
      style.textContent = ".dylan-toolbox-header{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:18px}.dylan-toolbox-header h2{margin:0}.dylan-toolbox-header p{margin:5px 0 0}.dylan-toolbox-header button{flex:0 0 auto}.calls-tool-card{width:100%;text-align:left;border:1px solid #c8d8eb;border-radius:16px;background:#fff;padding:20px;cursor:pointer;box-shadow:0 8px 22px rgba(15,49,92,.08)}.calls-tool-card:hover{border-color:#347fc4;transform:translateY(-1px)}.calls-tool-card strong{display:block;color:#123b6b;font-size:18px;margin-bottom:6px}.calls-tool-card span{color:#5c7089;line-height:1.45}.calls-tool-card em{display:inline-block;margin-top:14px;color:#1667aa;font-style:normal;font-weight:800}.voice-todo-card{margin-top:12px}";
      document.head.appendChild(style);
    }

    var toolboxButton = Array.from(grid.querySelectorAll("button")).find(function (button) {
      return /tool\s*box/i.test(button.textContent || "");
    });
    if (!toolboxButton) return false;

    toolboxButton.onclick = function () {
      grid.style.display = "none";
      panel.innerHTML = '<div class="dylan-toolbox-header"><div><h2>Calls &amp; Follow-Ups</h2><p>One place for call history, open work, assigned items, and completed follow-ups.</p></div><button type="button" id="callsToolboxBack">Back</button></div><button type="button" class="calls-tool-card" id="openCallsTool"><strong>Open Calls &amp; Follow-Ups</strong><span>Record calls, manage the checklist that drives Next Action, finish or reopen work, search history, and print handoff sheets.</span><em>Open workspace &rarr;</em></button><button type="button" class="calls-tool-card voice-todo-card" id="openVoiceTodoTool"><strong>Voice To-Do List</strong><span>Talk through your tasks and turn them into an organized to-do list.</span><em>Open To-Do List &rarr;</em></button>';
      panel.classList.add("show");
      document.getElementById("callsToolboxBack").onclick = function () {
        panel.classList.remove("show");
        grid.style.display = "grid";
      };
      document.getElementById("openCallsTool").onclick = function () {
        window.location.href = "calls.html";
      };
      document.getElementById("openVoiceTodoTool").onclick = function () {
        window.location.href = "todo-list.html";
      };
    };

    if (observer) observer.disconnect();
    return true;
  }

  if (!installLauncher()) {
    observer = new MutationObserver(installLauncher);
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  }
}());
