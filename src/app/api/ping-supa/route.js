import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  try {
    // 1) เช็ค ENV มาก่อน
    const url = process.env.SUPABASE_URL
    const anon = process.env.SUPABASE_ANON_KEY
    if (!url || !anon) {
      return NextResponse.json(
        { ok: false, where: 'env', url, hasAnon: !!anon },
        { status: 500 }
      )
    }

    // 2) ลอง query
    const sb = createClient(url, anon)
    const { data, error } = await sb.from('store_reviews').select('id').limit(1)

    if (error) {
      return NextResponse.json(
        { ok: false, where: 'db', error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, sample: data })
  } catch (e) {
    return NextResponse.json(
      { ok: false, where: 'unknown', error: String(e) },
      { status: 500 }
    )
  }
}
