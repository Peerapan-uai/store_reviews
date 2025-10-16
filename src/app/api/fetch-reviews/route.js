// src/app/api/fetch-reviews/route.js
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import gplay from 'google-play-scraper';
import appstorePkg from 'app-store-scraper';
const appstore = appstorePkg?.default ?? appstorePkg;
import { supabaseServer } from '../../lib/supabaseServer.js';
import crypto from 'node:crypto';

const CHUNK_SIZE = 500; // ดึง/insert ทีละ 500

// ---------- helpers ----------
const toISO = (d) => {
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? null : t.toISOString().slice(0, 10); // YYYY-MM-DD
};
const toTH = (d) => {
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? null : t.toLocaleDateString('th-TH');
};
const toYear = (iso) => (iso ? Number(iso.slice(0, 4)) : null);
const hash = (s) => crypto.createHash('sha1').update(s || '').digest('hex');

async function insertChunk(sb, rows) {
  if (!rows.length) return { inserted: 0 };
  const { error, count } = await sb
    .from('store_reviews')
    .upsert(rows, { onConflict: 'ext_key', ignoreDuplicates: true, count: 'exact' });
  if (error) throw error;
  return { inserted: count ?? rows.length };
}

/** ---------- Google Play (ภาษาไทยเท่านั้น) ---------- */
async function fetchAllPlay(appId, country = 'th', lang = 'th') {
  const sb = supabaseServer();
  let token;
  let total = 0;
  let batch = [];

  while (true) {
    const page = await gplay.reviews({
      appId,
      country,
      lang,
      sort: gplay.sort.NEWEST,
      num: 200,
      paginate: true,
      nextPaginationToken: token,
    });

    const { data, nextPaginationToken } = page;

    for (const r of data) {
      // ----- กรอง: ต้องมีข้อความ และไม่ใช่ 'EMPTY'
      const text = String(r?.text || '').trim();
      if (!text || text.toUpperCase() === 'EMPTY') continue;

      // ----- กรอง: ต้องมีวันที่ที่ parse ได้
      const at = r?.at ?? r?.date ?? null;
      const iso = toISO(at);
      if (!iso) continue;

      // คีย์กันซ้ำ
      const extId = r?.id || r?.reviewId || '';
      const key = extId
        ? `play:${appId}:${extId}`
        : `play:${appId}:${hash(text + '|' + iso)}`;

      batch.push({
        ext_key: key,
        person_id: total + batch.length + 1,
        rating: r?.score ?? r?.rating ?? null,
        date_dmy: toTH(at),
        date_iso: iso,
        year: toYear(iso),
        review_text: text,
        helpful_count: r?.thumbsUp || 0,
        source: 'play',
        app_id: String(appId),
        version: r?.version ?? '',        // กัน NOT NULL
        country,
        created_at: new Date().toISOString(),
      });

      if (batch.length >= CHUNK_SIZE) {
        const { inserted } = await insertChunk(sb, batch);
        total += inserted;
        batch = [];
      }
    }

    token = nextPaginationToken;
    if (!token) break; // หมดหน้าแล้ว
  }

  if (batch.length) {
    const { inserted } = await insertChunk(supabaseServer(), batch);
    total += inserted;
  }

  return total;
}

/** ---------- App Store (ภาษาไทยเท่านั้น) ---------- */
async function fetchAllAppStore(appId, country = 'th') {
  const sb = supabaseServer();
  const idNum = Number(appId);
  if (!Number.isFinite(idNum)) throw new Error('appId for App Store must be numeric');

  let total = 0;
  let page = 1;
  let batch = [];

  while (true) {
    const res = await appstore.reviews({
      id: idNum,
      country,
      sort: appstore.sort.RECENT,
      page,
    });
    if (!Array.isArray(res) || res.length === 0) break;

    for (const r of res) {
      // ----- กรอง: ต้องมีข้อความ และไม่ใช่ 'EMPTY'
      const text = String(r?.review || '').trim();
      if (!text || text.toUpperCase() === 'EMPTY') continue;

      // ----- กรอง: ต้องมีวันที่ที่ parse ได้
      const at = r?.date ?? null;
      const iso = toISO(at);
      if (!iso) continue;

      const key = `app:${appId}:${hash((r?.id || '') + '|' + text + '|' + iso)}`;

      batch.push({
        ext_key: key,
        person_id: total + batch.length + 1,
        rating: r?.rating ?? null,
        date_dmy: toTH(at),
        date_iso: iso,
        year: toYear(iso),
        review_text: text,
        helpful_count: r?.voteCount || 0,
        source: 'app ',
        app_id: String(appId),
        version: r?.version ?? '',        // กัน NOT NULL
        country,
        created_at: new Date().toISOString(),
      });

      if (batch.length >= CHUNK_SIZE) {
        const { inserted } = await insertChunk(sb, batch);
        total += inserted;
        batch = [];
      }
    }

    page += 1;
  }

  if (batch.length) {
    const { inserted } = await insertChunk(supabaseServer(), batch);
    total += inserted;
  }

  return total;
}

export async function POST(req) {
  try {
    const { store, appId } = await req.json();

    const country = 'th';
    const lang = 'th';

    if (!store || !appId) {
      return NextResponse.json({ error: 'store, appId required' }, { status: 400 });
    }

    const s = String(store).toLowerCase();
    if (s !== 'play' && s !== 'app') {
      return NextResponse.json({ error: 'store must be "play" or "app"' }, { status: 400 });
    }

    const normalizedAppId = s === 'play' ? String(appId).toLowerCase() : String(appId);

    const totalInserted =
      s === 'play'
        ? await fetchAllPlay(normalizedAppId, country, lang)
        : await fetchAllAppStore(normalizedAppId, country);

    return NextResponse.json({
      ok: true,
      inserted: totalInserted,
      country,
      lang: s === 'play' ? lang : undefined,
    });
  } catch (e) {
    console.error('fetch-reviews error:', e);
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
