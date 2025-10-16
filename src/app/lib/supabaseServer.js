import { createClient } from '@supabase/supabase-js'

export function supabaseServer() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,   // ใช้เฉพาะฝั่ง server
    { auth: { persistSession: false } }
  )
}
