// src/app/api/app-reviews/route.js
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { supabaseServer } from '../../lib/supabaseServer.js';

/**
 * GET /api/app-reviews?appId=<APPLE_APP_ID>&country=th,us&maxPages=10
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const appId     = searchParams.get('appId');
    const countries = (searchParams.get('country') ?? 'th')
      .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    const maxPages  = Math.min(parseInt(searchParams.get('maxPages') ?? '10', 10), 20);

    if (!appId) {
      return NextResponse.json({ ok: false, error: 'appId required' }, { status: 400 });
    }

    const sb = supabaseServer();

    const toISO = (s) => {
      const d = new Date(s);
      return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10); // YYYY-MM-DD
    };
    const toDMY = (iso) => {
      if (!iso) return null;
      const [y,m,d] = iso.split('-').map(x=>parseInt(x,10));
      const pad = (n)=> String(n).padStart(2,'0');
      // ใช้ พ.ศ. ตามที่คอลัมน์เดิมของคุณเก็บ (จากรูปเป็น พ.ศ.)
      const buddhistYear = y + 543;
      return `${pad(d)}/${pad(m)}/${buddhistYear}`;
    };

    let seen = 0;
    let inserted = 0;

    for (const country of countries) {
      for (let page = 1; page <= maxPages; page++) {
        const url = `https://itunes.apple.com/${country}/rss/customerreviews/page=${page}/id=${appId}/sortby=mostrecent/json`;
        const res = await fetch(url, { headers: { accept: 'application/json' } });
        if (!res.ok) break;

        const json = await res.json();
        const entries = Array.isArray(json?.feed?.entry)
          ? json.feed.entry.filter(e => e['im:rating'])
          : [];
        if (entries.length === 0) break;

        const rows = entries.map(e => {
          const rating  = parseInt(e['im:rating']?.label ?? '0', 10) || 0;
          const text    = e?.content?.label ?? '';
          const version = e['im:version']?.label ?? null;
          const updated = e?.updated?.label ?? null;

          const date_iso = toISO(updated);
          const date_dmy = toDMY(date_iso);
          const year     = date_iso ? new Date(date_iso).getFullYear() : null;

          const ext_key  = String(e?.id?.label ?? '');

          return {
            rating,
            review_text: text || '',
            version,
            date_iso,
            date_dmy,            // 👈 เติมให้ไม่ null
            year,
            helpful_count: 0,
            source: 'app',       // พิมพ์เล็ก
            app_id: String(appId),
            country,
            ext_key: ext_key || null,
          };
        });

        seen += rows.length;

        const { data, error } = await sb
          .from('store_reviews')
          .upsert(rows, { onConflict: 'ext_key', ignoreDuplicates: true })
          .select('id');
        if (error) throw error;

        inserted += data?.length ?? 0;

        if (entries.length < 50) break;
      }
    }

    return NextResponse.json({ ok: true, appId, countries, seen, inserted });
  } catch (e) {
    console.error('app-reviews GET error:', e);
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
