// src/app/page.js
async function getApps() {
  const res = await fetch('http://localhost:3000/api/app-meta?limit=50', { cache: 'no-store' });
  return res.json();
}

export default async function AppsPage() {
  const { items } = await getApps();
  return (
    <main>
      <h1>Apps</h1>
      <ul>
        {items?.map((x) => (
          <li key={`${x.source}:${x.app_id}`}>
            {x.source} • {x.app_id} — {x.title ?? '-'} ({x.released_year ?? '-'})
          </li>
        ))}
      </ul>
    </main>
  );
}
