export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../lib/supabaseServer.js';

export async function GET(request) {
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get('limit') || 20);
  const sb = supabaseServer();

  const { data, error } = await sb
    .from('store_reviews')
    .select('id, person_id, rating, date_dmy, review_text, helpful_count, source, app_id, version, created_at')
    .order('id', { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data });
}
