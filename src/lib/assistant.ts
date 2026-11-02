import { supabase } from './supabase';

/**
 * Talks to the study-assistant Edge Function (supabase/functions/study-assistant). Only the
 * session id is sent: the function reads the notes itself with the signed-in user's login.
 */
const ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL as string}/functions/v1/study-assistant`;

export type SuggestedQuestion = { question: string; answer: string };

async function call(body: Record<string, unknown>, signal?: AbortSignal): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Please sign in again.');
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_KEY as string,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new Error('Couldn’t reach the study assistant. Check your connection and try again.');
  }
  if (!res.ok) {
    const detail = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
    if (res.status === 404 && !detail?.error) {
      throw new Error('The study assistant isn’t deployed yet: deploy supabase/functions/study-assistant (see README).');
    }
    throw new Error(detail?.error ?? detail?.message ?? `The study assistant failed (${res.status}).`);
  }
  return res;
}

/** Streams a revision summary of the session's notes. Calls onText with each new piece of text. */
export async function streamSummary(
  sessionId: string,
  onText: (text: string) => void,
  signal?: AbortSignal,
): Promise<{ truncated: boolean }> {
  const res = await call({ action: 'summary', sessionId }, signal);
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  let result: { truncated: boolean } | null = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let nl: number;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      const event = JSON.parse(line) as { type: string; text?: string; message?: string; truncated?: boolean };
      if (event.type === 'text' && event.text) onText(event.text);
      else if (event.type === 'error') throw new Error(event.message ?? 'The study assistant failed.');
      else if (event.type === 'done') result = { truncated: !!event.truncated };
    }
  }
  if (!result) throw new Error('The summary was cut off. Please try again.');
  return result;
}

/** Exam-style questions with model answers, drawn from the session's notes. */
export async function suggestQuestions(sessionId: string, count = 6): Promise<SuggestedQuestion[]> {
  const res = await call({ action: 'questions', sessionId, count });
  const data = (await res.json()) as { questions?: SuggestedQuestion[] };
  return data.questions ?? [];
}
