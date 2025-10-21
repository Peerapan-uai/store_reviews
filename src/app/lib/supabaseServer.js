// ❌ อย่าใส่ "use server" ในไฟล์นี้

import { createClient } from '@supabase/supabase-js';

export function supabaseServer() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_ANON_KEY;

  if (!url) throw new Error('ENV SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) is missing');
  if (!key) throw new Error('ENV SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY is missing');

  return createClient(url, key, { auth: { persistSession: false } });
}
