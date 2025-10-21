export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { supabaseServer } from '../../lib/supabaseServer'; // named import

export async function POST(req) {
  try {
    const { ids = [], label } = await req.json();
    const ALLOWED = ['functional','nonfunctional','domain','general', null, ''];
    if (!ALLOWED.includes(label)) {
      return NextResponse.json({ error: 'invalid label' }, { status: 400 });
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'no ids' }, { status: 400 });
    }

    
    const sb = supabaseServer();                    // ✅ ต้องเรียกฟังก์ชันก่อน
    const toSet = label || null;

    // ถ้าคุณใช้คีย์หลักเป็นคอลัมน์อื่น เปลี่ยน 'ext_key' ตรงนี้
    const { error } = await sb
      .from('store_reviews')
      .update({ label: toSet })
      .in('ext_key', ids);

    if (error) throw error;

    return NextResponse.json({ ok: true, count: ids.length });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'unknown error' }, { status: 500 });
  }
}
