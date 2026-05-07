'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Loader2, BookOpen, Search, Info } from 'lucide-react';
import { useLocale } from 'next-intl';
import { getLocalizedField } from '@/lib/i18n-utils';

export default function KaliteElKitabiRaporClient() {
  const [altOlcutler, setAltOlcutler] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const locale = useLocale();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const { data } = await supabase
        .from('alt_olcutler')
        .select('*')
        .not('kalite_el_kitabi', 'is', null)
        .order('kod', { ascending: true });
      
      setAltOlcutler(data || []);
    } catch (error) {
      console.error("Fetch Data Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportWord = () => {
    if (altOlcutler.length === 0) return;
    
    let htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>Kurumsal Kalite El Kitabı</title>
      <style>
        body { font-family: 'Calibri', 'Arial', sans-serif; padding: 20px; }
        h1 { text-align: center; text-transform: uppercase; border-bottom: 2px solid #2563eb; padding-bottom: 10px; color: #1e40af; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 40px; page-break-inside: avoid; }
        th { background-color: #2563eb; color: white; padding: 12px; text-align: left; font-size: 16px; border: 1px solid #1e40af; }
        td.label { background-color: #2563eb; color: white; width: 30%; padding: 10px; font-weight: bold; border: 1px solid #1e40af; font-size: 12px; }
        td.data { background-color: #f8fafc; padding: 10px; border: 1px solid #e2e8f0; font-size: 12px; }
        .footer { text-align: center; font-size: 11px; color: #64748b; margin-top: 50px; }
      </style>
      </head>
      <body>
        <h1>KURUMSAL KALİTE EL KİTABI</h1>
        <p style='text-align:center; color: #64748b; margin-bottom: 30px;'>Oluşturulma Tarihi: ${new Date().toLocaleDateString('tr-TR')}</p>
    `;

    altOlcutler.forEach((olcut, index) => {
      const data = olcut.kalite_el_kitabi;
      htmlContent += `
        <table>
          <thead>
            <tr>
              <th colspan="2">Tablo ${index + 1}. ${olcut.kod} - ${getLocalizedField(olcut, 'olcut_adi', locale)}</th>
            </tr>
          </thead>
          <tbody>
            <tr><td class="label">Sorumlu Birim</td><td class="data">${data.sorumlu_birim || '-'}</td></tr>
            <tr><td class="label">İlk Planlama Tarihi</td><td class="data">${data.ilk_planlama_tarihi || '-'}</td></tr>
            <tr><td class="label">İç Paydaşlar</td><td class="data">${data.ic_paydaslar || '-'}</td></tr>
            <tr><td class="label">Dış Paydaşlar</td><td class="data">${data.dis_paydaslar || '-'}</td></tr>
            <tr><td class="label">Uluslararası Paydaşlar</td><td class="data">${data.uluslararasi_paydaslar || '-'}</td></tr>
            <tr><td class="label">Uygulama Alanları</td><td class="data">${data.uygulama_alanlari || '-'}</td></tr>
            <tr><td class="label">İzleme Mekanizmaları</td><td class="data">${data.izleme_mekanizmalari || '-'}</td></tr>
            <tr><td class="label">Performans Göstergeleri</td><td class="data">${data.performans_gostergeleri || '-'}</td></tr>
            <tr><td class="label">Değerlendirme ve İyileştirme Tarihi</td><td class="data">${data.degerlendirme_iyilestirme_tarihi || '-'}</td></tr>
            <tr><td class="label">Alt Ölçütün Bilgi Yönetim Sistemindeki Yeri</td><td class="data">${data.bgs_yeri || '-'}</td></tr>
          </tbody>
        </table>
      `;
    });

    htmlContent += `</body></html>`;
    const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Kurumsal_Kalite_El_Kitabi.doc';
    link.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return <div className="h-full flex items-center justify-center p-20"><Loader2 className="w-10 h-10 animate-spin text-indigo-600" /></div>;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto animate-in fade-in duration-500">
      <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-indigo-600" />
            Kurumsal Kalite El Kitabı
          </h2>
          <p className="text-slate-500 mt-2">Sistemdeki tüm kalite el kitabı verilerinin toplu görünümü ve raporlanması.</p>
        </div>
        <button 
          onClick={handleExportWord}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl font-bold transition-all shadow-lg shadow-indigo-500/20 active:scale-95 flex items-center gap-2"
        >
          <BookOpen className="w-5 h-5" /> Raporu İndir (.doc)
        </button>
      </div>

      {altOlcutler.length === 0 ? (
        <div className="bg-white p-20 rounded-3xl border border-slate-100 text-center shadow-sm">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Search className="w-10 h-10 text-slate-300" />
          </div>
          <h3 className="text-xl font-bold text-slate-800">Henüz Veri Yok</h3>
          <p className="text-slate-500 mt-2">Henüz kalite el kitabı verisi girilmiş bir ölçüt bulunmuyor.</p>
        </div>
      ) : (
        <div className="space-y-12 pb-20">
          {altOlcutler.map((olcut, index) => {
            const data = olcut.kalite_el_kitabi;
            return (
              <div key={olcut.id} className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden animate-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${index * 50}ms` }}>
                <div className="bg-indigo-600 p-5 text-white flex items-center justify-between">
                  <h3 className="text-lg font-black tracking-tight flex items-center gap-2">
                    <span className="bg-white/20 px-2 py-0.5 rounded text-sm">Tablo {index + 1}</span>
                    {olcut.kod} - {getLocalizedField(olcut, 'olcut_adi', locale)}
                  </h3>
                  <Info className="w-5 h-5 text-indigo-200" />
                </div>
                <table className="w-full border-collapse">
                  <tbody className="divide-y divide-slate-100">
                    {[
                      ['Sorumlu Birim', data.sorumlu_birim],
                      ['İlk Planlama Tarihi', data.ilk_planlama_tarihi],
                      ['İç Paydaşlar', data.ic_paydaslar],
                      ['Dış Paydaşlar', data.dis_paydaslar],
                      ['Uluslararası Paydaşlar', data.uluslararasi_paydaslar],
                      ['Uygulama Alanları', data.uygulama_alanlari],
                      ['İzleme Mekanizmaları', data.izleme_mekanizmalari],
                      ['Performans Göstergeleri', data.performans_gostergeleri],
                      ['Değerlendirme ve İyileştirme Tarihi', data.degerlendirme_iyilestirme_tarihi],
                      ['Bilgi Yönetim Sistemindeki Yeri', data.bgs_yeri]
                    ].map(([label, value], i) => (
                      <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                        <td className="w-1/3 p-4 bg-indigo-50/30 text-indigo-900 font-bold text-sm border-r border-indigo-50/50">{label}</td>
                        <td className="p-4 text-slate-700 text-sm whitespace-pre-wrap">{value || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
