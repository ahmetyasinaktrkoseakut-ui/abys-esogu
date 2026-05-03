'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { GraduationCap, Edit3, Eye, Lock } from 'lucide-react';
import Link from 'next/link';

export default function IzlencelerPage() {
  const [dersler, setDersler] = useState<any[]>([]);
  const [izlenceler, setIzlenceler] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      const { data: dersData } = await supabase.from('dersler').select('*').order('yariyil', { ascending: true }).order('tur', { ascending: false });
      const { data: izlenceData } = await supabase.from('ders_izlenceleri').select('ders_id, icerik');
      
      setDersler(dersData || []);
      setIzlenceler(izlenceData || []);
      setLoading(false);
    }
    fetchData();
  }, []);

  const kategoriler = [
    'I. YARIYIL', 'II. YARIYIL', 'III. YARIYIL', 'IV. YARIYIL',
    'V. YARIYIL', 'VI. YARIYIL', 'VII. YARIYIL', 'VIII. YARIYIL',
    'SEÇMELİ DERSLER' // Havuzdaki tüm seçmeliler buraya gelecek
  ];

  if (loading) return <div className="flex items-center justify-center min-h-screen">Yükleniyor...</div>;

  return (
    <div className="min-h-screen bg-white p-4 md:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-10 flex items-center justify-between border-b-2 border-blue-900 pb-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 bg-blue-900 rounded-xl flex items-center justify-center">
            <GraduationCap className="w-10 h-10 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-blue-900 tracking-tighter uppercase">Ders İzlenceleri ve Eğitim Planı</h1>
            <p className="text-slate-500 font-bold uppercase text-xs tracking-widest mt-1">Eskişehir Osmangazi Üniversitesi · İlahiyat Fakültesi</p>
          </div>
        </div>
        <div className="hidden md:block text-right">
          <p className="text-[10px] font-black text-slate-400 uppercase">Akademik Yıl</p>
          <p className="text-lg font-black text-blue-900">2024 — 2025</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto space-y-12 pb-20">
        {kategoriler.map((kat) => {
          const katDersleri = dersler.filter(d => d.yariyil === kat);
          if (katDersleri.length === 0) return null;

          return (
            <div key={kat} className="overflow-hidden shadow-sm border border-blue-200 rounded-lg">
              {/* Kategori Başlığı */}
              <div className="bg-blue-900 py-3 text-center">
                <h2 className="text-lg font-black text-white tracking-[0.2em]">{kat}</h2>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="bg-blue-50 text-blue-900 font-bold">
                      <th rowSpan={2} className="border border-blue-200 p-2 w-24">Ders Kodu</th>
                      <th rowSpan={2} className="border border-blue-200 p-2 w-16 text-center">Türü (S/Z)</th>
                      <th rowSpan={2} className="border border-blue-200 p-2 text-left">Dersin Adı</th>
                      <th colSpan={3} className="border border-blue-200 p-1 text-center bg-blue-100/50">Kredi Dağılımı</th>
                      <th rowSpan={2} className="border border-blue-200 p-2 w-24">Ders Dili</th>
                      <th rowSpan={2} className="border border-blue-200 p-2 w-16">Kredi</th>
                      <th rowSpan={2} className="border border-blue-200 p-2 w-16">AKTS</th>
                    </tr>
                    <tr className="bg-blue-50 text-blue-900 font-bold">
                      <th className="border border-blue-200 p-1 w-12 text-center">T</th>
                      <th className="border border-blue-200 p-1 w-12 text-center">U</th>
                      <th className="border border-blue-200 p-1 w-12 text-center">L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {katDersleri.map((ders) => {
                      const izlence = izlenceler.find(i => i.ders_id === ders.kod);
                      const isFilled = izlence && Object.keys(izlence.icerik).length > 0;
                      const canEdit = user !== null;

                      return (
                        <tr key={ders.kod} className="hover:bg-blue-50 transition-colors group border-b border-blue-100">
                          <td className="border-x border-blue-200 p-3 text-center font-mono font-bold text-slate-500">{ders.kod}</td>
                          <td className="border-x border-blue-200 p-3 text-center font-black text-blue-900">{ders.tur}</td>
                          <td className="border-x border-blue-200 p-3 font-bold">
                            {canEdit ? (
                              <Link href={`/ders-izlenceleri?kod=${ders.kod}`} className="text-blue-700 hover:text-blue-900 hover:underline flex items-center justify-between">
                                {ders.ad}
                                <Edit3 className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-amber-500" />
                              </Link>
                            ) : isFilled ? (
                              <Link href={`/izlenceler/${ders.kod}`} className="text-blue-700 hover:text-blue-900 hover:underline flex items-center justify-between">
                                {ders.ad}
                                <Eye className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-emerald-500" />
                              </Link>
                            ) : (
                              <div className="text-slate-400 flex items-center justify-between">
                                {ders.ad}
                                <Lock className="w-3 h-3 opacity-30" />
                              </div>
                            )}
                          </td>
                          <td className="border-x border-blue-200 p-3 text-center font-bold">{ders.t}</td>
                          <td className="border-x border-blue-200 p-3 text-center font-bold">{ders.u}</td>
                          <td className="border-x border-blue-200 p-3 text-center font-bold">{ders.l}</td>
                          <td className="border-x border-blue-200 p-3 text-center font-bold">{ders.dil}</td>
                          <td className="border-x border-blue-200 p-3 text-center font-black text-blue-900">{ders.kredi}</td>
                          <td className="border-x border-blue-200 p-3 text-center font-black text-blue-900">{ders.akts}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
