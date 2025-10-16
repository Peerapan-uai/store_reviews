export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../lib/supabaseServer.js';

export async function GET() {
  const sb = supabaseServer();

  // จำนวนทั้งหมด
  const { count: totalCount, error: e1 } =
    await sb.from('store_reviews').select('id', { count: 'exact', head: true });
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });

  // นับตามดาว (5->1)
  const ratingCounts = {};
  for (let r = 1; r <= 5; r++) {
    const { count, error } = await sb
      .from('store_reviews')
      .select('id', { count: 'exact', head: true })
      .eq('rating', r);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    ratingCounts[r] = count || 0;
  }

  // ค่าเฉลี่ย (คำนวณฝั่งเซิร์ฟเวอร์แบบง่าย)
  const { data: ratings, error: e2 } = await sb
    .from('store_reviews')
    .select('rating')
    .limit(2000); // พอสำหรับสรุปเบื้องต้น
  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });
  const avg =
    ratings.length ? (ratings.reduce((s, x) => s + (x.rating || 0), 0) / ratings.length) : 0;

  return NextResponse.json({ totalCount, ratingCounts, avg: Number(avg.toFixed(2)) });
}
