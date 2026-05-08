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
      
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-200/60">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            <Presentation className="w-8 h-8 text-indigo-600" />
            Akreditasyon Panosu
          </h2>
          <p className="text-slate-600 font-bold mt-1 text-sm leading-relaxed">Sistemin genel yürütme durumu ve birim istatistikleri.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60 flex items-center justify-between transition-all duration-300 hover:shadow-md hover:border-indigo-200 hover:-translate-y-1 group">
          <div>
            <p className="text-sm font-semibold text-slate-500 mb-1">Tanımlı Ölçüt</p>
            <h3 className="text-3xl font-black text-slate-900">{activeOlcutCount}</h3>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center border border-indigo-100 group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300">
            <BarChart2 className="w-6 h-6 text-indigo-600 group-hover:text-white transition-colors" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60 flex items-center justify-between transition-all duration-300 hover:shadow-md hover:border-amber-200 hover:-translate-y-1 group">
          <div>
            <p className="text-sm font-semibold text-slate-500 mb-1">Onay Bekleyenler</p>
            <h3 className="text-3xl font-black text-slate-900">{activeEylemCount}</h3>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center border border-amber-100 group-hover:bg-amber-500 group-hover:text-white transition-colors duration-300">
            <Clock className="w-6 h-6 text-amber-500 group-hover:text-white transition-colors" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60 flex items-center justify-between transition-all duration-300 hover:shadow-md hover:border-emerald-200 hover:-translate-y-1 group">
          <div>
            <p className="text-sm font-semibold text-slate-500 mb-1">Tamamlanan Ölçütler</p>
            <h3 className="text-3xl font-black text-slate-900">{totalBirimCount}</h3>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center border border-emerald-100 group-hover:bg-emerald-600 group-hover:text-white transition-colors duration-300">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 group-hover:text-white transition-colors" />
          </div>
        </div>
      </div>

      {/* Placeholder for future charts */}
      <div className="bg-white rounded-3xl border border-slate-200/60 p-12 shadow-sm flex flex-col items-center justify-center h-80 text-center transition-all hover:shadow-md">
        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
          <TrendingUp className="w-10 h-10 text-slate-300" />
        </div>
        <h3 className="text-xl font-extrabold text-slate-900 mb-2">Grafiksel Akreditasyon Özeti</h3>
        <p className="text-sm text-slate-500 font-medium max-w-sm">Daha fazla veri girişi yapıldıktan sonra sistemdeki genel olgunluk seviyesi trendleri burada görüntülenecektir.</p>
        <Link href="/olcutler" className="mt-8 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/20 active:scale-95">
          Ölçütleri Görüntüle
        </Link>
      </div>

    </div>
  );
}
