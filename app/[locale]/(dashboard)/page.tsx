import { createClient } from '@/lib/supabase/server';
import { Presentation, Building2, Clock, CheckCircle2, TrendingUp, BarChart2 } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiller').select('rol').eq('id', user.id).single();
  const isAdmin = profile?.rol?.toLowerCase().includes('admin') || profile?.rol?.toLowerCase().includes('yönetici') || profile?.rol?.toLowerCase().includes('yonetici');

  const { count: assignmentCount } = await supabase.from('kullanici_olcut_atamalari').select('*', { count: 'exact', head: true }).eq('kullanici_id', user.id);
  const { count: activeOlcutCount } = await supabase.from('olcutler').select('*', { count: 'exact', head: true });
  const { count: activeEylemCount } = await supabase.from('puko_kayitlari').select('*', { count: 'exact', head: true }).eq('durum', 'Beklemede');
  const { count: totalBirimCount } = await supabase.from('birimler').select('*', { count: 'exact', head: true });

  if (!isAdmin && (assignmentCount || 0) === 0) {
    redirect('/ders-izlenceleri');
  }

  // Dashboard verilerini göstermek için bu redirect'i kaldırabiliriz veya 
  // kullanıcıları ölçütlere göndermeye devam edebiliriz.
  // Şimdilik build hatasını çözmek için verileri yukarıda tanımladım.
  redirect('/olcutler');

  return (
    <div className="p-8 max-w-7xl mx-auto animate-in fade-in duration-500">
      
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Presentation className="w-6 h-6 text-blue-600" />
            Akreditasyon Panosu (Dashboard)
          </h2>
          <p className="text-slate-500 mt-1">Sistemin genel yürütme durumu ve birim istatistikleri.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex items-center justify-between transition-transform hover:-translate-y-1">
          <div>
            <p className="text-sm font-medium text-slate-500 mb-1">Tanımlı Ölçüt</p>
            <h3 className="text-3xl font-bold text-slate-800">{activeOlcutCount}</h3>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center border border-blue-100">
            <BarChart2 className="w-6 h-6 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex items-center justify-between transition-transform hover:-translate-y-1">
          <div>
            <p className="text-sm font-medium text-slate-500 mb-1">Onay Bekleyenler</p>
            <h3 className="text-3xl font-bold text-slate-800">{activeEylemCount}</h3>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center border border-amber-100">
            <Clock className="w-6 h-6 text-amber-500" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex items-center justify-between transition-transform hover:-translate-y-1">
          <div>
            <p className="text-sm font-medium text-slate-500 mb-1">Tamamlanan Ölçütler</p>
            <h3 className="text-3xl font-bold text-slate-800">{totalBirimCount}</h3>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center border border-green-100">
            <CheckCircle2 className="w-6 h-6 text-green-500" />
          </div>
        </div>
      </div>

      {/* Placeholder for future charts */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col items-center justify-center h-64 text-center">
        <TrendingUp className="w-10 h-10 text-slate-300 mb-3" />
        <h3 className="text-slate-800 font-semibold mb-1">Grafiksel Akreditasyon Özeti</h3>
        <p className="text-sm text-slate-500 max-w-sm">Daha fazla veri girişi yapıldıktan sonra sistemdeki genel olgunluk seviyesi trendleri burada görüntülenecektir.</p>
        <Link href="/olcutler" className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors border border-slate-200">
          Ölçütleri Görüntüle
        </Link>
      </div>

    </div>
  );
}
