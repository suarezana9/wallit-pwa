// Edge Function "wallit-ia": convierte texto, voz o una foto de ticket en un movimiento.
// La API key de Groq vive solo acá, como secreto de Supabase (GROQ_API_KEY).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { imagePrompt, readContext, sanitizeMany, textPrompt, type ParsedMovement, type PromptContext } from './parse.ts';

const GROQ_URL = Deno.env.get('GROQ_BASE_URL') ?? 'https://api.groq.com/openai/v1';
const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY') ?? '';
// Los modelos se pueden cambiar desde Supabase sin redeployar código (Groq retira modelos seguido).
const TEXT_MODEL = Deno.env.get('GROQ_TEXT_MODEL') ?? 'openai/gpt-oss-120b';
const VISION_MODEL = Deno.env.get('GROQ_VISION_MODEL') ?? 'qwen/qwen3.8-27b';
const AUDIO_MODEL = Deno.env.get('GROQ_AUDIO_MODEL') ?? 'whisper-large-v3-turbo';

const MAX_TEXT = 500;
const MAX_IMAGE_CHARS = 6_000_000;
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

class HttpError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

function publishableKey(): string {
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}') as Record<string, string>;
    const first = Object.values(keys)[0];
    if (first) return first;
  } catch {
    // sigue con los otros nombres posibles
  }
  return Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '';
}

/** Además de la verificación de JWT de la plataforma, confirma que el usuario existe y está activo. */
async function requireUser(req: Request): Promise<string> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) throw new HttpError(401, 'UNAUTHORIZED');
  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', publishableKey(), {
    auth: { persistSession: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'UNAUTHORIZED');
  return data.user.id;
}

async function groqChat(model: string, content: unknown, reasoning: 'low' | 'none'): Promise<string> {
  const res = await fetch(`${GROQ_URL}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content }],
      temperature: 0.1,
      max_completion_tokens: 2048,
      response_format: { type: 'json_object' },
      reasoning_effort: reasoning,
    }),
  });
  if (!res.ok) {
    console.error('groq chat', res.status, await res.text());
    throw new HttpError(502, 'AI_UNAVAILABLE');
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

async function transcribe(file: File, lang: string): Promise<string> {
  const form = new FormData();
  form.append('file', file, file.name || 'audio.webm');
  form.append('model', AUDIO_MODEL);
  form.append('language', lang);
  form.append('response_format', 'json');
  const res = await fetch(`${GROQ_URL}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
    body: form,
  });
  if (!res.ok) {
    console.error('groq audio', res.status, await res.text());
    throw new HttpError(502, 'AI_UNAVAILABLE');
  }
  const data = await res.json();
  const text = typeof data.text === 'string' ? data.text.trim() : '';
  if (!text) throw new HttpError(422, 'EMPTY_AUDIO');
  return text;
}

async function fromText(text: string, ctx: PromptContext): Promise<ParsedMovement[]> {
  const clean = text.trim().slice(0, MAX_TEXT);
  if (!clean) throw new HttpError(400, 'EMPTY_TEXT');
  const raw = await groqChat(TEXT_MODEL, textPrompt(clean, ctx), 'low');
  return parseOrLog(raw, ctx, clean);
}

/** Si el modelo no devolvió JSON válido, deja en el log un pedazo de lo que mandó para poder diagnosticarlo. */
function parseOrLog(raw: string, ctx: PromptContext, fallback: string): ParsedMovement[] {
  try {
    return sanitizeMany(raw, ctx, fallback);
  } catch (error) {
    console.error('respuesta no válida del modelo:', raw.slice(0, 500));
    throw error;
  }
}

/** "movement" queda por compatibilidad con clientes viejos; los nuevos leen "movements". */
function result(movements: ParsedMovement[], transcript?: string): Response {
  return json({ transcript, movements, movement: movements[0] });
}

async function handle(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') throw new HttpError(405, 'METHOD_NOT_ALLOWED');
  if (!GROQ_API_KEY) throw new HttpError(500, 'MISSING_GROQ_KEY');
  await requireUser(req);

  const type = req.headers.get('Content-Type') ?? '';

  if (type.includes('multipart/form-data')) {
    const form = await req.formData();
    const audio = form.get('audio');
    if (!(audio instanceof File) || !audio.size) throw new HttpError(400, 'EMPTY_AUDIO');
    if (audio.size > MAX_AUDIO_BYTES) throw new HttpError(413, 'TOO_LARGE');
    const ctx = readContext(JSON.parse(String(form.get('context') ?? '{}')));
    const transcript = await transcribe(audio, ctx.lang);
    return result(await fromText(transcript, ctx), transcript);
  }

  const body = (await req.json()) as Record<string, unknown>;
  const ctx = readContext(body);

  if (body.mode === 'text') {
    return result(await fromText(String(body.text ?? ''), ctx));
  }

  if (body.mode === 'image') {
    const image = String(body.image ?? '');
    if (!/^data:image\/(jpeg|png|webp);base64,/.test(image)) throw new HttpError(400, 'BAD_IMAGE');
    if (image.length > MAX_IMAGE_CHARS) throw new HttpError(413, 'TOO_LARGE');
    const raw = await groqChat(
      VISION_MODEL,
      [
        { type: 'text', text: imagePrompt(ctx) },
        { type: 'image_url', image_url: { url: image } },
      ],
      'none',
    );
    return result(parseOrLog(raw, ctx, ctx.lang === 'en' ? 'Receipt' : 'Ticket').slice(0, 1));
  }

  throw new HttpError(400, 'BAD_MODE');
}

Deno.serve(async (req) => {
  try {
    return await handle(req);
  } catch (error) {
    if (error instanceof HttpError) {
      // Todo error queda en Logs con su código (antes solo se logueaban las fallas de Groq).
      console.warn('wallit-ia', error.status, error.code);
      return json({ error: error.code }, error.status);
    }
    if (error instanceof SyntaxError || (error instanceof Error && error.message === 'NO_JSON')) {
      return json({ error: 'AI_BAD_RESPONSE' }, 502);
    }
    console.error(error);
    return json({ error: 'INTERNAL' }, 500);
  }
});
