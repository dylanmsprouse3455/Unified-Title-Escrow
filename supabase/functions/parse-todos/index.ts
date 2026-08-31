import { corsHeaders } from "npm:@supabase/supabase-js@2.112.3/cors";

const DYLAN_EMAIL = "dylan.sprouse@unifiedtitle.net";
const OPENAI_MODEL = "gpt-4.1-mini";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getPublishableKey() {
  const direct = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY");
  if (direct) return direct;
  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}");
    return Object.values(keys)[0] as string | undefined;
  } catch {
    return undefined;
  }
}

async function authenticatedUser(req: Request) {
  const authorization = req.headers.get("Authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = getPublishableKey();
  if (!authorization || !supabaseUrl || !publishableKey) return null;
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: authorization, apikey: publishableKey },
  });
  if (!response.ok) return null;
  return await response.json();
}

const taskSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    tasks: {
      type: "array",
      minItems: 1,
      maxItems: 50,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string", minLength: 1, maxLength: 500 },
          details: { type: ["string", "null"], maxLength: 4000 },
          due_date: { type: ["string", "null"], pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
          due_time: { type: ["string", "null"], pattern: "^([01]\\d|2[0-3]):[0-5]\\d$" },
          due_text: { type: ["string", "null"], maxLength: 200 },
          priority: { type: "string", enum: ["low", "normal", "high"] },
        },
        required: ["title", "details", "due_date", "due_time", "due_text", "priority"],
      },
    },
  },
  required: ["tasks"],
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const user = await authenticatedUser(req);
  if (!user || String(user.email || "").toLowerCase() !== DYLAN_EMAIL) {
    return json({ error: "This function is available only to Dylan's authenticated workspace." }, 403);
  }

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return json({ error: "OPENAI_API_KEY is not configured for this Edge Function." }, 503);

  let payload: { request?: unknown; timezone?: unknown; local_date?: unknown };
  try { payload = await req.json(); }
  catch { return json({ error: "A JSON request body is required." }, 400); }

  const request = String(payload.request || "").trim();
  if (!request) return json({ error: "Tell me what you need to get done first." }, 400);
  if (request.length > 8000) return json({ error: "The request is too long. Keep it under 8,000 characters." }, 400);

  const timezone = String(payload.timezone || "America/New_York").slice(0, 100);
  const localDate = /^\d{4}-\d{2}-\d{2}$/.test(String(payload.local_date || ""))
    ? String(payload.local_date)
    : new Date().toISOString().slice(0, 10);

  const openAIResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      store: false,
      instructions: [
        "Turn the user's natural-language request into a complete list of distinct actionable tasks.",
        "Preserve every name, file or case number, phone number, and material detail exactly. Never invent any of them.",
        "Never invent a deadline. Resolve clear relative dates using the supplied local date and timezone.",
        "For ambiguous time wording such as before lunch, end of day, or sometime this week, keep due_date or due_time null when a precise value is not certain and preserve the wording in due_text.",
        "Use high or low priority only when the user clearly signals urgency or low importance; otherwise use normal.",
        "Keep task titles concise, put supporting context in details, and include every action the user requested.",
      ].join(" "),
      input: `Local date: ${localDate}\nTimezone: ${timezone}\nUser request: ${request}`,
      text: { format: { type: "json_schema", name: "voice_todo_tasks", strict: true, schema: taskSchema } },
    }),
  });

  const responseBody = await openAIResponse.json();
  if (!openAIResponse.ok) {
    console.error("OpenAI request failed", openAIResponse.status, responseBody?.error?.code || "unknown");
    return json({ error: "The AI parser is temporarily unavailable. You can still add tasks manually." }, 502);
  }

  try {
    const parsed = JSON.parse(responseBody.output_text);
    return json(parsed);
  } catch {
    console.error("OpenAI returned an unusable structured response");
    return json({ error: "The AI response could not be read. Please try again or add tasks manually." }, 502);
  }
});
