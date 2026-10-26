import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_KEY as string | undefined;

if (!url || !key) {
  throw new Error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_KEY. Copy .env.example to .env and fill them in.');
}

export const supabase = createClient(url, key);
export const BUCKET = 'lecture-images';
