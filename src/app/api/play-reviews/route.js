// src/app/api/app-reviews/route.js
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import appstorePkg from 'app-store-scraper';
const appstore = appstorePkg?.default ?? appstorePkg;
import crypto from 'node:crypto';
import { supabaseServer } from '../../lib/supabaseServer.js';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const appId = searchParams.get('appId');              // ex: 1336845635
    const gls = (searchParams.get('gl') ?? 'th')
      .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);  // country
    const hls = (searchParams.get('hl') ?? 'th')
      .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);  // language
    const maxPages = Math.min(parseInt(searchParams.get('maxPages') ?? '10', 10), 50);
    if (!appId) return NextResponse.json({ ok:false, error:'appId required' }, { status:400 });

    const sb = supabaseServer();
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    const toISO = (d) => {
      const dt = d instanceof Date ? d : new Date(d);
      return Number.isNaN(dt.getTime()) ? null : dt.toISOString().slice(0,10);
    };
    const toDMY = (iso) => {
      if (!iso) return null;
      const [y,m,d] = iso.split('-').map(n=>parseInt(n,10));
      const pad = (n)=>String(n).padStart(2,'0');
      return `${pad(d)}/${pad(m)}/${y+543}`;
    };

    let seen = 0, upserted = 0, combosTried = 0;
    const combosFailed = [];

    for (const country of gls) {
      for (const lang of hls) {
        combosTried++;
        for (let page = 1; page <= maxPages; page++) {
          let resp, ok = false;
          for (let attempt=1; attempt<=3; attempt++) {
            try {
              resp = await appstore.reviews({
                id: appId,
                country,               // 'th','us',...
                lang,                  // 'th','en',...
                sort: appstore.sort.RECENT, // ล่าสุดก่อน
                page,                  // 1..N
              });
              ok = true; break;
            } catch (e) {
              await sleep(attempt * 1200);
            }
          }
          if (!ok) { combosFailed.push(`${country}/${lang}#page${page}`); break; }

          const items = Array.isArray(resp) ? resp : [];
          if (items.length === 0) break;

          const rows = items.map(r => {
            const date_iso = toISO(r.date);
            const rawId = r.id ?? null; // id ของรีวิวใน App Store
            const fallback = 'app:' + crypto
              .createHash('md5')
              .update(`${appId}|${(r.review || r.text || '').trim()}|${date_iso || ''}`)
              .digest('hex');
            const ext_key = rawId ? `app:${rawId}` : fallback;

            const review_text = [(r.title || ''), (r.review || r.text || '')]
              .filter(Boolean).join(' — ').trim();

            return {
              rating: r.rating ?? 0,
              review_text,
              version: r.version || null,
              helpful_count: r.voteCount ?? 0,  // ไม่มีก็เป็น 0
              date_iso,
              date_dmy: toDMY(date_iso),
              year: date_iso ? new Date(date_iso).getFullYear() : null,
              source: 'app',
              app_id: appId,
              country,
              ext_key,
              // ถ้าจะเก็บภาษาไว้จริง ให้เพิ่มคอลัมน์ hl ใน DB แล้วเติมฟิลด์นี้:
              // hl: lang,
            };
          });

          seen += rows.length;

          const { data, error } = await sb
            .from('store_reviews')
            .upsert(rows, { onConflict: 'ext_key' }) // กันซ้ำด้วยคีย์เดียว
            .select('id');

          if (error) throw error;
          upserted += data?.length ?? 0;

          await sleep(800); // กัน rate limit
        }
      }
    }

    return NextResponse.json({ ok:true, appId, gls, hls, maxPages, seen, upserted, combosTried, combosFailed });
  } catch (e) {
    console.error('app-reviews GET error:', e);
    return NextResponse.json({ ok:false, error: e?.message || String(e) }, { status:500 });
  }
}
