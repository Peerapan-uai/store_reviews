// src/app/dashboard/page.js
export const dynamic = 'force-dynamic';

import { supabaseServer } from '../lib/supabaseServer.js';

/** Summary: total, count by stars, avg */
async function getSummaryDirect() {
  const sb = supabaseServer();

  const { count: totalCount, error: e1 } =
    await sb.from('store_reviews').select('id', { count: 'exact', head: true });
  if (e1) throw new Error(e1.message);

  const ratingCounts = {};
  for (let r = 1; r <= 5; r++) {
    const { count, error } = await sb
      .from('store_reviews')
      .select('id', { count: 'exact', head: true })
      .eq('rating', r);
    if (error) throw new Error(error.message);
    ratingCounts[r] = count || 0;
  }

  const { data: ratings = [], error: e2 } = await sb
    .from('store_reviews')
    .select('rating')
    .limit(2000);
  if (e2) throw new Error(e2.message);

  const avg = ratings.length
    ? ratings.reduce((s, x) => s + (x?.rating || 0), 0) / ratings.length
    : 0;

  return { totalCount: totalCount ?? 0, ratingCounts, avg: Number(avg.toFixed(2)) };
}

/** Label counts for cards */
async function getLabelCounts() {
  const sb = supabaseServer();

  const [{ count: inbox }, { count: functional }, { count: nonfunctional }, { count: domain }] =
    await Promise.all([
      sb.from('store_reviews').select('id', { count: 'exact', head: true }).is('label', null),
      sb.from('store_reviews').select('id', { count: 'exact', head: true }).eq('label', 'functional'),
      sb.from('store_reviews').select('id', { count: 'exact', head: true }).eq('label', 'nonfunctional'),
      sb.from('store_reviews').select('id', { count: 'exact', head: true }).eq('label', 'domain'),
    ]);

  return {
    inbox: inbox ?? 0,
    functional: functional ?? 0,
    nonfunctional: nonfunctional ?? 0,
    domain: domain ?? 0,
  };
}

/** Fetch rows with pagination + filters */
async function getLatestDirect({
  page = 1,
  pageSize = 100,
  year = '',
  source = 'PLAY,APP',
  ratings = '1,2,3,4,5',
  sort = 'date_desc',
}) {
  const sb = supabaseServer();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = sb
    .from('store_reviews')
    .select(
      'id, rating, date_iso, review_text, helpful_count, source, version',
      { count: 'exact' }
    );

  // filters
  const src = source.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (src.length) q = q.in('source', src);   // 'play' | 'app'

  const rs = ratings.split(',').map(n => parseInt(n, 10)).filter(n => [1,2,3,4,5].includes(n));
  if (rs.length) q = q.in('rating', rs);

  if (year) q = q.eq('year', parseInt(year, 10));

  // sort
  if (sort === 'helpful_desc') {
    q = q.order('helpful_count', { ascending: false }).order('date_iso', { ascending: false });
  } else {
    q = q.order('date_iso', { ascending: false });
  }

  // paging
  q = q.range(from, to);

  const { data, count, error } = await q;
  if (error) throw new Error(error.message);

  return { rows: data || [], total: count || 0 };
}

export default async function DashboardPage({ searchParams }) {
  // searchParams เป็น object อยู่แล้ว ไม่ต้อง await
  const sp = searchParams ?? {};
  const page   = Number(sp.page ?? 1);
  const year   = sp.year ?? '';
  const source = sp.source ?? 'PLAY,APP';   // PLAY | APP | PLAY,APP
  const stars  = sp.stars ?? 'all';         // 'all' | '1'..'5'
  const sort   = sp.sort ?? 'date_desc';    // 'date_desc' | 'helpful_desc'

  const ratings = stars === 'all' ? '1,2,3,4,5' : String(stars);

  const [{ totalCount, ratingCounts, avg }, { rows, total }, labels] = await Promise.all([
    getSummaryDirect(),
    getLatestDirect({ page, pageSize: 100, year, source, ratings, sort }),
    getLabelCounts(),
  ]);

  // years list (ล่าสุดย้อนไป 10 ปี)
  const nowY = new Date().getFullYear();
  const YEARS = Array.from({ length: 10 }, (_, i) => String(nowY - i));

  const pageCount = Math.max(1, Math.ceil(total / 100));
  const mkUrl = (p) => {
    const params = new URLSearchParams({
      page: String(p),
      year,
      source,
      stars,
      sort,
    });
    return `?${params.toString()}`;
  };

  const selectCls =
    "px-3 py-2 rounded border border-zinc-500 bg-zinc-900 text-white font-medium " +
    "focus:outline-none focus:ring-2 focus:ring-sky-500";

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Review Dashboard</h1>

      {/* Summary cards (ของเดิม) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-zinc-800 p-4">
          <div className="text-sm text-gray-400">Total Reviews</div>
          <div className="text-3xl font-semibold">{totalCount}</div>
        </div>

        <div className="rounded-xl border border-zinc-800 p-4">
          <div className="text-sm text-gray-400">Average Rating</div>
          <div className="text-3xl font-semibold">{avg}</div>
        </div>

        <div className="rounded-xl border border-zinc-800 p-4">
          <div className="text-sm text-gray-400">By Stars</div>
          <div className="mt-2 grid grid-cols-5 gap-2 text-center">
            {[1, 2, 3, 4, 5].map((s) => (
              <div key={s} className="rounded-lg bg-zinc-900 border border-zinc-700 p-2">
                <div className="text-xs text-gray-300">{s}★</div>
                <div className="font-semibold text-red-100">{ratingCounts?.[s] ?? 0}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* By Label (ใหม่ ให้เข้ากับ Sidebar) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { title: 'Inbox (Unlabeled)', value: labels.inbox, href: '/inbox' },
          { title: 'Functional', value: labels.functional, href: '/functional' },
          { title: 'Non-Functional', value: labels.nonfunctional, href: '/nonfunctional' },
          { title: 'Domain', value: labels.domain, href: '/domain' },
        ].map(card => (
          <a key={card.title} href={card.href} className="rounded-xl border border-zinc-800 p-4 hover:bg-zinc-800/40">
            <div className="text-sm text-zinc-400">{card.title}</div>
            <div className="text-3xl font-semibold mt-1">{card.value}</div>
          </a>
        ))}
      </div>

      {/* Filters (ของเดิม) */}
      <form method="GET" className="flex flex-wrap items-center gap-2">
        <select name="year" defaultValue={year} className={selectCls}>
          <option value="">ทุกปี</option>
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>

        <select name="source" defaultValue={source} className={selectCls}>
          <option value="PLAY,APP">All Stores</option>
          <option value="PLAY">Play Store</option>
          <option value="APP">App Store</option>
        </select>

        <select name="stars" defaultValue={stars} className={selectCls}>
          <option value="all">All Stars</option>
          {[1,2,3,4,5].map(s => <option key={s} value={s}>{s}★</option>)}
        </select>

        <select name="sort" defaultValue={sort} className={selectCls}>
          <option value="date_desc">ล่าสุดก่อน</option>
          <option value="helpful_desc">Helpful มากสุด</option>
        </select>

        {/* reset to page 1 on submit */}
        <input type="hidden" name="page" value="1" />
        <button className="px-3 py-2 rounded border border-zinc-600 bg-zinc-900 text-white">
          Apply
        </button>
      </form>

      {/* Latest reviews table (ของเดิม) */}
      <div className="rounded-xl border border-zinc-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800 font-semibold ">
          Latest Reviews
          <span className="ml-2 text-sm text-gray-400">(รวม {total})</span>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-zinc-900 text-gray-300">
            <tr>
              <th className="text-left p-3">Date</th>
              <th className="text-left p-3">Stars</th>
              <th className="text-left p-3">Text</th>
              <th className="text-left p-3">Helpful</th>
              <th className="text-left p-3">Source</th>
              <th className="text-left p-3">Version</th>
            </tr>
          </thead>
          <tbody>
            {rows?.map((r) => (
              <tr key={r.id} className="border-t border-zinc-800 align-top">
                <td className="p-3 whitespace-nowrap">
                  {r?.date_iso ? new Date(r.date_iso).toLocaleDateString('th-TH') : '-'}
                </td>
                <td className="p-3">{r?.rating ?? '-'}★</td>
                <td className="p-3 max-w-[600px]" style={{ whiteSpace: 'pre-wrap' }}>
                  {r?.review_text || '-'}
                </td>
                <td className="p-3">{r?.helpful_count ?? 0}</td>
                <td className="p-3 uppercase">{r?.source || '-'}</td>
                <td className="p-3">{r?.version || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination (ของเดิม) */}
      <div className="flex items-center gap-2">
        <a
          className={`px-3 py-2 border border-zinc-700 rounded ${page <= 1 ? 'pointer-events-none opacity-50' : ''}`}
          href={mkUrl(page - 1)}
        >
          Prev
        </a>
        <span>Page {page} / {pageCount}</span>
        <a
          className={`px-3 py-2 border border-zinc-700 rounded ${page >= pageCount ? 'pointer-events-none opacity-50' : ''}`}
          href={mkUrl(page + 1)}
        >
          Next
        </a>
      </div>

      <p className="text-xs text-gray-500">
        Tips: ใช้ PowerShell ยิง <code>/api/fetch-reviews</code> เพื่อดึงรีวิวเพิ่มเมื่อไรก็ได้
      </p>
    </div>
  );
}
