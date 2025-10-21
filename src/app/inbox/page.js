import { supabaseServer } from '../lib/supabaseServer';
import ReviewTable from '../components/ReviewTable';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const sb = supabaseServer();              // ✅ สร้าง client ก่อน
  const { data = [] } = await sb
    .from('store_reviews')
    .select('ext_key, rating, review_text, label')
    .is('label', null)
    .order('date_iso', { ascending: false })
    .limit(500);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Inbox (Unlabeled)</h1>
      <ReviewTable rows={data} />
    </div>
  );
}
