'use client';
import { useMemo, useState } from 'react';

export default function ReviewTable({ rows }) {
  const [selected, setSelected] = useState(new Set());
  const [target, setTarget] = useState('functional');

  const allIds = useMemo(() => rows.map(r => r.ext_key), [rows]);

  const toggle = (id) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };

  const toggleAll = () => {
    if (selected.size === rows.length) setSelected(new Set());
    else setSelected(new Set(allIds));
  };

  const move = async () => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    const res = await fetch('/api/classify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, label: target }),
    });
    const json = await res.json();
    if (json.ok) {
      // รีเฟรชง่าย ๆ
      location.reload();
    } else {
      alert(json.error || 'Failed');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <select className="border border-zinc-700 bg-zinc-900 rounded-lg px-3 py-2" value={target} onChange={e => setTarget(e.target.value)}>
          <option value="functional">Functional</option>
          <option value="nonfunctional">Non-Functional</option>
          <option value="domain">Domain</option>
          <option value="">Clear label</option>
        </select>
        <button onClick={move} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700">Move selected</button>
        <span className="text-sm text-zinc-400">Selected: {selected.size}</span>
      </div>

      <div className="border border-zinc-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-800/60">
            <tr>
              <th className="p-2 w-10 text-center">
                <input type="checkbox" checked={selected.size === rows.length && rows.length > 0} onChange={toggleAll} />
              </th>
              <th className="p-2 w-16">★</th>
              <th className="p-2">Review</th>
              <th className="p-2 w-36">Label</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.ext_key} className="border-t border-zinc-800">
                <td className="p-2 text-center">
                  <input type="checkbox" checked={selected.has(r.ext_key)} onChange={() => toggle(r.ext_key)} />
                </td>
                <td className="p-2">{r.rating ?? '-'}</td>
                <td className="p-2">{r.review_text?.slice(0, 220) || ''}</td>
                <td className="p-2">{r.label || <span className="text-zinc-500">–</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
