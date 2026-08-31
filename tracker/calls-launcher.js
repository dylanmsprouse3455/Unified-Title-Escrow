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

