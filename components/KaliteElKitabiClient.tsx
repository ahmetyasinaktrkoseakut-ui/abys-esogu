'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Loader2, BookOpen, Download } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { getLocalizedField } from '@/lib/i18n-utils';
import { usePeriod } from '@/contexts/PeriodContext';

export default function KaliteElKitabiClient() {
  const { selectedPeriod } = usePeriod();
  const locale = useLocale();
  const tNav = useTranslations('Navigation');
  const [isGeneratingKitap, setIsGeneratingKitap] = useState(false);

  const exportKaliteElKitabi = async () => {
    setIsGeneratingKitap(true);
    try {
      const { data: pukoRes, error: pukoErr } = await supabase
        .from('puko_degerlendirmeleri')
        .select('alt_olcut_id, aciklama')
        .eq('donem_id', selectedPeriod?.id)
        .eq('puko_asamasi', 'kalite_el_kitabi');
        
      if (pukoErr) throw pukoErr;
      
      const filledPuko = (pukoRes || []).filter(p => p.aciklama && p.aciklama !== '<p></p>' && p.aciklama !== '');
      if (filledPuko.length === 0) {
        alert("Sistemde henüz 'Kalite El Kitabı' aşamasına ait doldurulmuş bir veri bulunamadı.");
        setIsGeneratingKitap(false);
        return;
      }
      
      const altOlcutIds = [...new Set(filledPuko.map(p => p.alt_olcut_id))];
      
      const { data: altOlcutlerRes, error: altErr } = await supabase
        .from('alt_olcutler')
        .select('*')
        .in('id', altOlcutIds)
        .order('kod', { ascending: true });
        
      if (altErr) throw altErr;

      let htmlContent = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head><meta charset='utf-8'><title>Kalite El Kitabı</title>
        <style>
          body { font-family: 'Calibri', 'Arial', sans-serif; line-height: 1.6; padding: 20px; font-size: 12pt; color: #000; }
          h1 { text-align: center; text-transform: uppercase; border-bottom: 2px solid black; padding-bottom: 10px; margin-bottom: 40px; font-size: 24pt; color: #1a202c; }
          h2 { margin-top: 40px; margin-bottom: 15px; font-size: 16pt; font-weight: bold; color: #2d3748; page-break-after: avoid; }
          p, div { text-align: justify; margin-bottom: 15px; }
        </style>
        </head>
        <body>
          <h1>Kalite El Kitabı</h1>
          <p style='text-align:center; font-style: italic; margin-bottom: 50px; color: #718096;'>Tarih: ${new Date().toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US')}</p>
      `;

      if (altOlcutlerRes) {
        altOlcutlerRes.forEach(olcut => {
          const puko = filledPuko.find(p => p.alt_olcut_id === olcut.id);
          if (puko) {
             const title = `${olcut.kod} - ${getLocalizedField(olcut, 'olcut_adi', locale)}`;
             htmlContent += `<h2>${title}</h2>`;
             htmlContent += `<div>${puko.aciklama}</div>`;
          }
        });
      }

      htmlContent += `
        </body>
        </html>
      `;

      const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'Kalite_El_Kitabi_Raporu.doc';
      link.click();
      URL.revokeObjectURL(url);
      
    } catch (e: any) {
      alert(`Hata: ${e.message}`);
    } finally {
      setIsGeneratingKitap(false);
    }
  };

  return (
    <div className="p-8 max-w-[1400px] mx-auto animate-in fade-in duration-500">
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-emerald-600" />
            {tNav('quality_manual')}
          </h1>
          <p className="text-slate-500 mt-2">Bu alandan sistemdeki tüm Kalite El Kitabı verilerinizi Word formatında indirebilirsiniz.</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden relative min-h-[400px]">
        <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center bg-gradient-to-br from-emerald-50/50 to-white">
          <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6 shadow-inner">
            <BookOpen className="w-12 h-12" />
          </div>
          <h3 className="text-2xl font-black text-slate-800 mb-3">{tNav('quality_manual')}</h3>
          <p className="text-slate-500 max-w-lg mb-8 leading-relaxed">
            Sistemde girilmiş olan tüm Kalite El Kitabı metinlerini, hiyerarşik bir düzende (Ölçüt kodlarına göre sıralanmış olarak) tek bir Word dokümanı halinde bilgisayarınıza indirin.
          </p>
          <button 
            onClick={exportKaliteElKitabi}
            disabled={isGeneratingKitap || !selectedPeriod}
            className="group relative inline-flex items-center justify-center gap-3 px-10 py-5 font-bold text-white transition-all duration-300 bg-emerald-600 rounded-full hover:bg-emerald-700 hover:scale-105 hover:shadow-xl focus:outline-none overflow-hidden disabled:opacity-50 disabled:hover:scale-100"
          >
            {isGeneratingKitap ? <Loader2 className="w-6 h-6 animate-spin relative z-10" /> : <Download className="w-6 h-6 relative z-10" />}
            <span className="text-lg relative z-10">Rapor Oluştur (Word)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
