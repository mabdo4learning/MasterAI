// Study assistant: summarises a lecture session's notes and suggests exam-style practice
// questions, using Google Gemini. Deploy with `supabase functions deploy study-assistant` and set
// the key with `supabase secrets set GEMINI_API_KEY=...` (see README → Study assistant).
//
// The browser sends only { action, sessionId }. The notes are read here with the caller's own
// login, so row level security decides what can be summarised — never text from the request.

import { ApiError, GoogleGenAI, type GenerateContentResponse } from 'npm:@google/genai@2.31.0';
import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2.118.0';

// Any Gemini model your key can use; the alias follows Google's current Flash model.
const MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-flash-latest';
// Requests per Pro user per rolling 24 hours (set AI_DAILY_LIMIT to change it).
const DAILY_LIMIT = Number(Deno.env.get('AI_DAILY_LIMIT') ?? '40');
// About 75k tokens of notes. Longer sessions get a clear error instead of being cut short.
const MAX_NOTES_CHARS = 300_000;
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '*').split(',').map((s) => s.trim());

type Action = 'summary' | 'questions';

const cors = (req: Request): Record<string, string> => {
  const origin = req.headers.get('Origin') ?? '';
  const allow = ALLOWED_ORIGINS.includes('*') ? '*' : ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
};

const json = (req: Request, status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(req), 'Content-Type': 'application/json' } });

const SUMMARY_SYSTEM = `You help a university student revise. You receive their own notes from one lecture session, and you write a revision summary of them in Markdown.

- Base the summary only on the notes. Do not add facts, figures or examples that are not in them. If something in the notes looks mistaken or unclear, you may point it out briefly under "Check".
- Start with a one-sentence overview, then use these sections, leaving out any the notes give nothing for:
  ## Key ideas — bullet points.
  ## Terms to know — bullets of the form **term** — a short definition, only for terms that appear in the notes.
  ## Review next — 2 to 4 bullets on what to revisit or practise.
  ## Check — only if needed.
- Use only ## headings, bullet lists, **bold** and *italic*. No tables, code blocks or # headings.
- Write in the same language as the notes. Keep it tight: usually 150 to 350 words.`;

const QUESTIONS_SYSTEM = `You write exam-style practice questions for a university student from their own lecture notes.

- Test understanding, not only recall: mix definitions, explanations, comparisons and short application scenarios.
- Every question must be answerable from the notes. Each answer is a concise model answer (1 to 4 sentences) based on the notes.
- Do not repeat or closely paraphrase any question listed in <existing_questions>.
- Plain text only in questions and answers (no Markdown). Write in the same language as the notes.`;

const QUESTIONS_SCHEMA = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: { question: { type: 'string' }, answer: { type: 'string' } },
        required: ['question', 'answer'],
        additionalProperties: false,
      },
    },
  },
  required: ['questions'],
  additionalProperties: false,
};

const escapeXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

type Context = { prompt: string; notesChars: number };

/** The session, its notes and existing questions, read with the caller's login (RLS applies). */
async function loadContext(db: SupabaseClient, user: User, sessionId: string, action: Action): Promise<Context | null> {
  const { data: session } = await db
    .from('sessions')
    .select('id, subject_slug, number, topic, lecture_date')
    .eq('id', sessionId)
    .maybeSingle();
  if (!session) return null;

  const [notes, questions, subject] = await Promise.all([
    db.from('notes').select('body, created_at').eq('session_id', sessionId).order('created_at'),
    db.from('questions').select('question').eq('session_id', sessionId).order('created_at'),
    db.from('subjects').select('title').eq('slug', session.subject_slug).maybeSingle(),
  ]);
  const noteRows = (notes.data ?? []) as { body: string; created_at: string }[];
  const notesChars = noteRows.reduce((n, r) => n + r.body.length, 0);
  const programme = typeof user.user_metadata?.programme === 'string' ? user.user_metadata.programme : '';

  const lines: (string | null)[] = [
    '<session>',
    programme ? `Programme: ${escapeXml(programme)}` : null,
    `Subject: ${escapeXml(subject.data?.title ?? session.subject_slug)}`,
    `Session ${session.number}${session.topic ? `: ${escapeXml(session.topic)}` : ''}`,
    session.lecture_date ? `Lecture date: ${session.lecture_date}` : null,
    '</session>',
    '',
    '<notes>',
    ...noteRows.map((n) => `<note written="${n.created_at.slice(0, 10)}">\n${escapeXml(n.body)}\n</note>`),
    '</notes>',
  ];
  if (action === 'questions') {
    const existing = ((questions.data ?? []) as { question: string }[]).map((q) => `- ${escapeXml(q.question)}`);
    lines.push('', '<existing_questions>', ...(existing.length ? existing : ['(none)']), '</existing_questions>');
  }
  return { prompt: lines.filter((l): l is string => l !== null).join('\n'), notesChars };
}

/** A message for the student, without internal details. */
function friendlyError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 429) return 'The assistant is busy right now. Please try again in a minute.';
    if (e.status === 401 || e.status === 403 || /api key/i.test(e.message)) {
      return 'The assistant isn’t configured correctly (API key). Ask the site owner to check it.';
    }
    if (e.status >= 500) return 'The assistant had a problem. Please try again.';
  }
  if (e instanceof TypeError) return 'Couldn’t reach the assistant. Please try again.';
  return 'Something went wrong with the assistant.';
}

type Usage = { input_tokens: number; output_tokens: number };
const usageOf = (r: GenerateContentResponse | undefined): Usage | null =>
  r?.usageMetadata
    ? {
        input_tokens: r.usageMetadata.promptTokenCount ?? 0,
        output_tokens: (r.usageMetadata.candidatesTokenCount ?? 0) + (r.usageMetadata.thoughtsTokenCount ?? 0),
      }
    : null;
/** Gemini blocked the prompt or stopped the answer on safety grounds. */
const blocked = (r: GenerateContentResponse | undefined) =>
  !!r?.promptFeedback?.blockReason || ['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII'].includes(String(r?.candidates?.[0]?.finishReason));

const REFUSED = 'The assistant couldn’t help with these notes. Try rephrasing or shortening them.';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== 'POST') return json(req, 405, { error: 'Method not allowed' });

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  if (!apiKey) return json(req, 503, { error: 'The study assistant isn’t set up yet (missing GEMINI_API_KEY).' });

  const authorization = req.headers.get('Authorization') ?? '';
  const db = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: auth } = await db.auth.getUser();
  const user = auth.user;
  if (!user) return json(req, 401, { error: 'Please sign in again.' });

  let body: { action?: unknown; sessionId?: unknown; count?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(req, 400, { error: 'Invalid request.' });
  }
  const action = body.action;
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId : '';
  if ((action !== 'summary' && action !== 'questions') || !/^[0-9a-f-]{36}$/i.test(sessionId)) {
    return json(req, 400, { error: 'Invalid request.' });
  }
  const count = Math.min(10, Math.max(3, Number(body.count) || 6));

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  // The assistant is part of MasterAI Pro (see migrations-012-subscriptions.sql).
  const { data: pro, error: proError } = await admin.rpc('is_pro', { p_user: user.id });
  if (proError) {
    console.error('is_pro failed', proError);
    return json(req, 503, { error: 'Couldn’t check your plan. If billing isn’t set up yet, run migrations-012-subscriptions.sql.' });
  }
  if (!pro) return json(req, 402, { error: 'The study assistant is part of MasterAI Pro.', code: 'pro_required' });
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: used } = await admin
    .from('ai_usage')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', since);
  if ((used ?? 0) >= DAILY_LIMIT) {
    return json(req, 429, { error: `You’ve used today’s ${DAILY_LIMIT} assistant requests. More become available over the next 24 hours.` });
  }

  const context = await loadContext(db, user, sessionId, action);
  if (!context) return json(req, 404, { error: 'Session not found.' });
  if (context.notesChars === 0) return json(req, 400, { error: 'Add some notes to this session first.' });
  if (context.notesChars > MAX_NOTES_CHARS) {
    return json(req, 413, { error: 'This session’s notes are too long for the assistant. Try splitting them across sessions.' });
  }

  const log = (ok: boolean, usage?: Usage | null, model = MODEL) =>
    admin.from('ai_usage').insert({
      user_id: user.id,
      action,
      session_id: sessionId,
      model,
      input_tokens: usage?.input_tokens ?? 0,
      output_tokens: usage?.output_tokens ?? 0,
      ok,
    });

  const ai = new GoogleGenAI({ apiKey });

  if (action === 'questions') {
    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: `${context.prompt}\n\nWrite ${count} practice questions (fewer if the notes are short).`,
        config: {
          systemInstruction: QUESTIONS_SYSTEM,
          maxOutputTokens: 16000,
          responseMimeType: 'application/json',
          responseJsonSchema: QUESTIONS_SCHEMA,
        },
      });
      const model = response.modelVersion ?? MODEL;
      if (blocked(response)) {
        await log(false, usageOf(response), model);
        return json(req, 422, { error: REFUSED });
      }
      let questions: { question: string; answer: string }[] = [];
      try {
        const parsed = JSON.parse(response.text ?? '{}');
        questions = (Array.isArray(parsed.questions) ? parsed.questions : [])
          .filter((q: unknown): q is { question: string; answer: string } =>
            !!q && typeof (q as { question?: unknown }).question === 'string' && typeof (q as { answer?: unknown }).answer === 'string')
          .map((q: { question: string; answer: string }) => ({ question: q.question.trim(), answer: q.answer.trim() }))
          .filter((q: { question: string }) => q.question)
          .slice(0, 10);
      } catch {
        // Cut off or malformed output: treated as no questions below.
      }
      await log(questions.length > 0, usageOf(response), model);
      if (!questions.length) return json(req, 502, { error: 'The assistant didn’t return any questions. Please try again.' });
      return json(req, 200, { questions });
    } catch (e) {
      console.error('questions failed', e);
      await log(false);
      return json(req, 502, { error: friendlyError(e) });
    }
  }

  // Summary: streamed to the browser as newline-delimited JSON events.
  const encoder = new TextEncoder();
  const abort = new AbortController();
  const events = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Record<string, unknown>) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      let last: GenerateContentResponse | undefined;
      try {
        const stream = await ai.models.generateContentStream({
          model: MODEL,
          contents: `${context.prompt}\n\nWrite the revision summary.`,
          config: { systemInstruction: SUMMARY_SYSTEM, maxOutputTokens: 32000, abortSignal: abort.signal },
        });
        for await (const chunk of stream) {
          last = chunk;
          const text = chunk.text;
          if (text) send({ type: 'text', text });
        }
        const model = last?.modelVersion ?? MODEL;
        if (blocked(last)) {
          send({ type: 'error', message: REFUSED });
          await log(false, usageOf(last), model);
        } else {
          send({ type: 'done', truncated: last?.candidates?.[0]?.finishReason === 'MAX_TOKENS' });
          await log(true, usageOf(last), model);
        }
      } catch (e) {
        if (abort.signal.aborted) return;
        console.error('summary failed', e);
        send({ type: 'error', message: friendlyError(e) });
        await log(false, usageOf(last));
      }
      controller.close();
    },
    cancel() {
      abort.abort();
    },
  });
  return new Response(events, {
    headers: { ...cors(req), 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-cache' },
  });
});
