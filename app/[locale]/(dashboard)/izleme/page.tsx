'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Loader2, Activity, CheckCircle, Clock, XCircle, FileText, BarChart3, TrendingUp } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

import { useRouter } from 'next/navigation';

export default function IzlemePage() {
  const router = useRouter();
  const [stats, setStats] = useState({
    toplamOlcut: 0,
    bekleyen: 0,
    onaylanan: 0,
    reddedilen: 0,
    toplamDokuman: 0,
  });
  
  const [pukoDistribution, setPukoDistribution] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        setIsLoading(true);

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase.from('profiller').select('rol').eq('id', user.id).single();
          const role = profile?.rol?.toLowerCase() || '';
          if (!role.includes('yonetici') && !role.includes('yönetici') && !role.includes('admin')) {
            router.replace('/olcutler');
            return;
          }
        } else {
          router.replace('/login');
          return;
        }

        const { count: countOlcut } = await supabase.from('alt_olcutler').select('*', { count: 'exact', head: true });
        
        const { data: pukoData } = await supabase.from('puko_degerlendirmeleri').select('durum, puko_asamasi, kanit_dosyalari');

        let bekleyen = 0;
        let onaylanan = 0;
        let reddedilen = 0;
        let toplamDokuman = 0;
        const pukoCounts: Record<string, number> = {};

        if (pukoData) {
          pukoData.forEach(row => {
            if (row.durum === 'Onaylandı') onaylanan++;
            else if (row.durum === 'Reddedildi') reddedilen++;
            else bekleyen++;

            if (row.kanit_dosyalari && Array.isArray(row.kanit_dosyalari)) {
              toplamDokuman += row.kanit_dosyalari.length;
            }

            const asama = row.puko_asamasi || 'Bilinmiyor';
            pukoCounts[asama] = (pukoCounts[asama] || 0) + 1;
          });
        }

        setStats({
          toplamOlcut: countOlcut || 0,
          bekleyen,
          onaylanan,
          reddedilen,
          toplamDokuman
        });

        const distArray = Object.keys(pukoCounts).map(k => ({
          name: k.replace('_', ' ').toUpperCase(),
          value: pukoCounts[k]
        }));
        setPukoDistribution(distArray);

      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (isLoading) {
    return <div className="h-full flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-blue-600" /></div>;
  }

  const durumData = [
    { name: 'Onaylandı', value: stats.onaylanan, color: '#10b981' }, // emerald-500
    { name: 'Beklemede', value: stats.bekleyen, color: '#fbbf24' },  // amber-400
    { name: 'Reddedildi', value: stats.reddedilen, color: '#ef4444' }, // red-500
  ].filter(d => d.value > 0);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6', '#f43f5e'];

  return (
    <div className="p-8 max-w-[1400px] mx-auto animate-in fade-in duration-500">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Süreç İzleme ve Analitik</h2>
        <p className="text-slate-500 mt-1 text-sm">Üniversite geneli kalite ve akreditasyon süreçlerinin anlık analizi.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Toplam Alt Ölçüt</p>
            <p className="text-2xl font-bold text-slate-800">{stats.toplamOlcut}</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-50 text-amber-500 rounded-xl flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Bekleyen Onay</p>
            <p className="text-2xl font-bold text-slate-800">{stats.bekleyen}</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-xl flex items-center justify-center shrink-0">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Onaylanan Süreç</p>
            <p className="text-2xl font-bold text-slate-800">{stats.onaylanan}</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-500 rounded-xl flex items-center justify-center shrink-0">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Yüklenen Doküman</p>
            <p className="text-2xl font-bold text-slate-800">{stats.toplamDokuman}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h3 className="flex items-center gap-2 font-semibold text-slate-700 mb-6">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            Aşamalara Göre Veri Girişi
          </h3>
          <div className="h-72 w-full">
            {pukoDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pukoDistribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} style={{ fontSize: '10px', fill: '#64748b' }} />
                  <YAxis axisLine={false} tickLine={false} style={{ fontSize: '12px', fill: '#64748b' }} />
                  <Tooltip 
                    cursor={{ fill: '#f1f5f9' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
               <div className="h-full flex items-center justify-center text-slate-400">Henüz veri girişi yapılmamış.</div>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h3 className="flex items-center gap-2 font-semibold text-slate-700 mb-6">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            Süreç Onay Durumları
          </h3>
          <div className="h-72 w-full flex items-center justify-center">
             {durumData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={durumData}
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {durumData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  </PieChart>
                </ResponsiveContainer>
             ) : (
                <div className="flex flex-col items-center justify-center text-slate-400">
                  <PieChart className="w-16 h-16 opacity-30 mb-2" />
                  Henüz veri yok.
                </div>
             )}
          </div>
          {durumData.length > 0 && (
            <div className="flex justify-center gap-6 mt-2">
              {durumData.map((d, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-slate-600">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }}></div>
                  {d.name}: <span className="font-bold">{d.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
