// src/app/api/app-meta/route.js
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';

// ---- Interop: รองรับทั้ง default / namespace ----
import gplayPkg from 'google-play-scraper';
const gplay = gplayPkg?.default ?? gplayPkg;

import appstorePkg from 'app-store-scraper';
const appstore = appstorePkg?.default ?? appstorePkg;

import { supabaseServer } from '../../lib/supabaseServer.js';

// ---------- Helpers ----------
function safeYear(input) {
  const y = Number(new Date(input).getFullYear());
  return Number.isFinite(y) && y > 1900 ? y : null;
}

// ---------------- Google Play ----------------
async function getMetaPlay(appId, debug = false) {
  const detail = await gplay.app({ appId, lang: 'th', country: 'th' });
  const year = detail?.released ? safeYear(detail.released) : null;

  if (debug) {
    return { ok: true, debug: true, meta: { title: detail?.title ?? null, released_year: year }, raw: detail };
  }
  return { title: detail?.title ?? null, released_year: year };
}

// ---------------- App Store ----------------
async function getMetaAppStore(appId, debug = false) {
  const idNum = Number(appId); // App Store ใช้ตัวเลข
  if (!Number.isFinite(idNum)) throw new Error('appId ต้องเป็นตัวเลขสำหรับ App Store');

  const detail = await appstore.app({ id: idNum, country: 'th', lang: 'th' });
  const dateStr = detail?.releaseDate || detail?.currentVersionReleaseDate || null;
  const year = dateStr ? safeYear(dateStr) : null;

  if (debug) {
    return { ok: true, debug: true, meta: { title: detail?.title ?? null, released_year: year }, raw: detail };
  }
  return { title: detail?.title ?? null, released_year: year };
}

// ---------- POST: fetch meta แล้ว upsert ลง DB ----------
export async function POST(req) {
  try {
    const { store, appId, debug = false } = await req.json();
    if (!store || !appId) {
      return NextResponse.json({ ok: false, error: 'store, appId required' }, { status: 400 });
    }

    const s = String(store).toLowerCase(); // 'play' | 'app'

    // โหมดดีบัก: แค่ดึง ไม่เขียน DB
    if (debug) {
      if (s === 'play') return NextResponse.json(await getMetaPlay(String(appId).toLowerCase(), true));
      if (s === 'app')  return NextResponse.json(await getMetaAppStore(String(appId), true));
      return NextResponse.json({ ok: false, error: 'store must be "play" or "app"' }, { status: 400 });
    }

    // โหมดปกติ
    let meta;
    if (s === 'play') meta = await getMetaPlay(String(appId).toLowerCase());
    else if (s === 'app') meta = await getMetaAppStore(String(appId));
    else return NextResponse.json({ ok: false, error: 'store must be "play" or "app"' }, { status: 400 });

    const sb = supabaseServer(); // ใช้ service role ภายในฟังก์ชันนี้
    const { data, error } = await sb
      .from('apps')
      .upsert(
        {
          source: s,                 // ต้องมี unique (source, app_id)
          store: s,                  // ให้ตรงคอลัมน์ใน DB
          app_id: String(appId),
          title: meta.title,
          released_year: meta.released_year,    // อาจเป็น null
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'source,app_id' }
      )
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, app: data });
  } catch (e) {
    console.error('app-meta POST error:', e);
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}

// ---------- GET: ดึงข้อมูล (แถวเดียวหรือรายการ) ----------
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const store = searchParams.get('store');         // 'play' | 'app' (optional)
    const appId = searchParams.get('appId');         // optional
    const limit = Number(searchParams.get('limit') ?? 50);
    const offset = Number(searchParams.get('offset') ?? 0);

    const sb = supabaseServer();

    // ถ้าระบุทั้ง store + appId -> คืนแถวล่าสุดเสมอ (กันเคสซ้ำ/ว่าง)
    if (store && appId) {
      const { data, error } = await sb
        .from('apps')
        .select('*')
        .eq('source', String(store).toLowerCase())
        .eq('app_id', String(appId))
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle(); // ถ้าไม่พบ -> data = null (ไม่โยน error)

      if (error) throw error;
      return NextResponse.json({ ok: true, app: data });
    }

    // ไม่ระบุ -> คืนรายการ (แบ่งหน้า)
    let q = sb.from('apps').select('*').order('updated_at', { ascending: false });
    if (store) q = q.eq('source', String(store).toLowerCase());

    const { data, error } = await q.range(offset, offset + limit - 1);
    if (error) throw error;

    return NextResponse.json({ ok: true, items: data });
  } catch (e) {
    console.error('app-meta GET error:', e);
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
