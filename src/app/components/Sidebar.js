import Link from 'next/link';
import { supabaseServer } from '../lib/supabaseServer'; // ต้องเป็น named export แบบนี้

async function getCounts() {
  const sb = supabaseServer(); // <-- เรียกฟังก์ชันเพื่อให้ได้ client

  const all   = await sb.from('store_reviews').select('id', { count: 'exact', head: true });
  const inbox = await sb.from('store_reviews').select('id', { count: 'exact', head: true }).is('label', null);
  const fn    = await sb.from('store_reviews').select('id', { count: 'exact', head: true }).eq('label', 'functional');
  const nfn   = await sb.from('store_reviews').select('id', { count: 'exact', head: true }).eq('label', 'nonfunctional');
  const dom   = await sb.from('store_reviews').select('id', { count: 'exact', head: true }).eq('label', 'domain');

  return {
    total: all.count ?? 0,
    inbox: inbox.count ?? 0,
    functional: fn.count ?? 0,
    nonfunctional: nfn.count ?? 0,
    domain: dom.count ?? 0,
  };
}

export default async function Sidebar() {
  const c = await getCounts();

  const Item = ({ href, label, count }) => (
    <Link href={href} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-zinc-800">
      <span>{label}</span>
      {typeof count === 'number' && <span className="text-xs bg-zinc-700 px-2 py-0.5 rounded-full">{count}</span>}
    </Link>
  );

  return (
    <aside className="w-64 shrink-0 h-screen sticky top-0 border-r border-zinc-800 p-3 space-y-2">
      <div className="text-lg font-semibold px-2 py-2">Reviewdash</div>
      <div className="space-y-1">
        <Item href="/dashboard" label="Dashboard" />
        <Item href="/inbox" label="Inbox" count={c.inbox} />
        <Item href="/functional" label="Functional" count={c.functional} />
        <Item href="/nonfunctional" label="Non-Functional" count={c.nonfunctional} />
        <Item href="/domain" label="Domain" count={c.domain} />
      </div>
      <div className="pt-4 text-xs text-zinc-400 px-2">Total: {c.total}</div>
    </aside>
  );
}
