(function () {
  "use strict";

  var SUPABASE_URL = "https://hdqmcjlpyjpfeltmxfax.supabase.co";
  var SUPABASE_KEY = "sb_publishable_lC2M8fZGmJQt6bWKgfiDnw_4Nx1TwHD";
  var CALL_STORAGE_KEY = "utei.dylan.callTracker.v1";
  var originalCreateClient = window.supabase && window.supabase.createClient;
  if (!originalCreateClient) {
    loadAssistant();
    return;
  }

  var baseClient = originalCreateClient(SUPABASE_URL, SUPABASE_KEY);
  var centralTitleCases = null;
  var centralCalls = null;
  var titleLoadedAt = "";
  var titleLoadedBy = "";

  function loadAssistant() {
    var script = document.createElement("script");
    script.src = "dylan-assistant.js?v=central-data-20260831-1";
    script.defer = false;
    document.body.appendChild(script);
  }

  function installCallReadBridge() {
    if (!Array.isArray(centralCalls) || typeof Storage === "undefined") return;
    var originalGetItem = Storage.prototype.getItem;
    if (Storage.prototype.__dylanAssistantCentralWrapped) return;
    Object.defineProperty(Storage.prototype, "__dylanAssistantCentralWrapped", { value: true });
    Storage.prototype.getItem = function (key) {
      if (key === CALL_STORAGE_KEY) return JSON.stringify(centralCalls);
      return originalGetItem.call(this, key);
    };
  }

  function installTitleReadBridge() {
    if (!Array.isArray(centralTitleCases)) return;
    window.supabase.createClient = function () {
      var client = originalCreateClient.apply(window.supabase, arguments);
      var originalFrom = client.from.bind(client);
      client.from = function (table) {
        if (table === "tracker_state") {
          return {
            select: function () {
              return {
                eq: function () {
                  return {
                    maybeSingle: async function () {
                      return {
                        data: {
                          cases: centralTitleCases,
                          updated_at: titleLoadedAt || new Date().toISOString(),
                          updated_by: titleLoadedBy || "Central Title Search storage"
                        },
                        error: null
                      };
                    }
                  };
                }
              };
            }
          };
        }
        return originalFrom(table);
      };
      return client;
    };
  }

  async function loadCentralData() {
    try {
      var sessionResult = await baseClient.auth.getSession();
      var session = sessionResult.data && sessionResult.data.session;
      if (!session) return;

      var results = await Promise.all([
        baseClient.from("title_search_cases").select("payload,updated_at,updated_by,deleted_at").is("deleted_at", null).order("updated_at", { ascending: false }),
        baseClient.from("dylan_call_records").select("payload,updated_at,deleted_at").is("deleted_at", null).order("updated_at", { ascending: false })
      ]);

      var titleResult = results[0];
      var callResult = results[1];

      if (!titleResult.error && Array.isArray(titleResult.data)) {
        centralTitleCases = titleResult.data.map(function (row) { return row.payload; }).filter(Boolean);
        if (titleResult.data[0]) {
          titleLoadedAt = titleResult.data[0].updated_at || "";
          titleLoadedBy = titleResult.data[0].updated_by || "";
        }
      }

      if (!callResult.error && Array.isArray(callResult.data)) {
        centralCalls = callResult.data.map(function (row) { return row.payload; }).filter(Boolean);
      }
    } catch (_error) {
      centralTitleCases = null;
      centralCalls = null;
    }
  }

  loadCentralData().finally(function () {
    installCallReadBridge();
    installTitleReadBridge();
    window.__dylanAssistantCentralData = {
      titleCount: Array.isArray(centralTitleCases) ? centralTitleCases.length : null,
      callCount: Array.isArray(centralCalls) ? centralCalls.length : null,
      usingCentralTitle: Array.isArray(centralTitleCases),
      usingCentralCalls: Array.isArray(centralCalls)
    };
    loadAssistant();
  });
}());
