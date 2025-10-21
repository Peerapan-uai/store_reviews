import { supabaseServer } from '../lib/supabaseServer';
import ReviewTable from '../components/ReviewTable';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const sb = supabaseServer();              // ✅
  const { data = [] } = await sb
    .from('store_reviews')
    .select('ext_key, rating, review_text, label')
    .eq('label', 'domain')
    .order('date_iso', { ascending: false })
    .limit(500);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Domain</h1>
      <ReviewTable rows={data} />
    </div>
  );
}
