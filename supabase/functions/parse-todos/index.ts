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
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          details: { type: ["string", "null"] },
          due_date: { type: ["string", "null"] },
          due_time: { type: ["string", "null"] },
          due_text: { type: ["string", "null"] },
          priority: { type: "string", enum: ["low", "normal", "high"] },
        },
        required: ["title", "details", "due_date", "due_time", "due_text", "priority"],
      },
    },
  },
  required: ["tasks"],
};

function extractOutputText(body: any) {
  if (typeof body?.output_text === "string" && body.output_text.trim()) return body.output_text.trim();
  const pieces: string[] = [];
  for (const item of Array.isArray(body?.output) ? body.output : []) {
    for (const content of Array.isArray(item?.content) ? item.content : []) {
      if (typeof content?.text === "string" && content.text.trim()) pieces.push(content.text);
    }
  }
  return pieces.join("\n").trim();
}

function cleanNullable(value: unknown, max: number) {
  if (value == null) return null;
  const result = String(value).trim().slice(0, max);
  return result || null;
}

function normalizeParsed(parsed: any) {
  if (!parsed || !Array.isArray(parsed.tasks) || !parsed.tasks.length) throw new Error("No tasks returned");
  const tasks = parsed.tasks.slice(0, 50).map((task: any) => {
    const title = String(task?.title || "").trim().slice(0, 500);
    if (!title) throw new Error("Task title missing");
    const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(String(task?.due_date || "")) ? String(task.due_date) : null;
    const dueTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(String(task?.due_time || "")) ? String(task.due_time) : null;
    const priority = ["low", "normal", "high"].includes(String(task?.priority)) ? String(task.priority) : "normal";
    return {
      title,
      details: cleanNullable(task?.details, 4000),
      due_date: dueDate,
      due_time: dueTime,
      due_text: cleanNullable(task?.due_text, 200),
      priority,
    };
  });
  return { tasks };
}

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
        "Use YYYY-MM-DD for due_date only when the date is clear. Otherwise set due_date to null.",
        "Use HH:MM 24-hour time for due_time only when the time is clear. Otherwise set due_time to null.",
        "For ambiguous wording such as before lunch, end of day, or sometime this week, preserve that wording in due_text and do not invent a precise time.",
        "Use high or low priority only when the user clearly signals urgency or low importance; otherwise use normal.",
        "Keep task titles concise, put supporting context in details, and include every action the user requested.",
      ].join(" "),
      input: `Local date: ${localDate}\nTimezone: ${timezone}\nUser request: ${request}`,
      text: { format: { type: "json_schema", name: "voice_todo_tasks", strict: true, schema: taskSchema } },
    }),
  });

  let responseBody: any;
  try { responseBody = await openAIResponse.json(); }
  catch {
    console.error("OpenAI returned a non-JSON response", openAIResponse.status);
    return json({ error: "The AI parser returned an unreadable response. Please try again." }, 502);
  }

  if (!openAIResponse.ok) {
    console.error(
      "OpenAI request failed",
      openAIResponse.status,
      responseBody?.error?.code || "unknown",
      responseBody?.error?.param || "no-param",
      responseBody?.error?.message || "no-message",
    );
    return json({ error: "The AI parser is temporarily unavailable. Please try again in a moment." }, 502);
  }

  try {
    const outputText = extractOutputText(responseBody);
    if (!outputText) throw new Error("No output text");
    return json(normalizeParsed(JSON.parse(outputText)));
  } catch (error) {
    console.error("OpenAI returned an unusable structured response", error instanceof Error ? error.message : "unknown");
    return json({ error: "The AI response could not be read. Please try again or add tasks manually." }, 502);
  }
});
