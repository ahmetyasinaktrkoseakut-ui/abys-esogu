'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Loader2, BookOpen, Search, Info, FileText } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { getLocalizedField } from '@/lib/i18n-utils';

export default function KaliteElKitabiRaporClient() {
  const [altOlcutler, setAltOlcutler] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const locale = useLocale();
  const t = useTranslations('QualityManualReport');
  const tKalite = useTranslations('KaliteElKitabi');

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
      <head><meta charset='utf-8'><title>${t('title')}</title>
      <style>
        body { font-family: 'Calibri', 'Arial', sans-serif; padding: 20px; color: #334155; }
        h1 { text-align: center; text-transform: uppercase; border-bottom: 2px solid #2563eb; padding-bottom: 8px; margin-bottom: 20px; color: #1e40af; font-size: 22px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 25px; page-break-inside: avoid; break-inside: avoid; }
        th { background-color: #2563eb; color: white; padding: 8px 12px; text-align: left; font-size: 14px; border: 1px solid #1e40af; }
        td { vertical-align: top; line-height: 1.3; }
        td.label { background-color: #2563eb; color: white; width: 30%; padding: 6px 10px; font-weight: bold; border: 1px solid #1e40af; font-size: 11px; }
        td.data { background-color: #f8fafc; width: 70%; padding: 6px 10px; border: 1px solid #e2e8f0; font-size: 11px; color: #1e293b; }
        .footer { text-align: center; font-size: 10px; color: #64748b; margin-top: 30px; }
      </style>
      </head>
      <body>
        <h1>${t('title').toUpperCase()}</h1>
        <p style='text-align:center; color: #64748b; margin-bottom: 30px;'>Oluşturulma Tarihi: ${new Date().toLocaleDateString('tr-TR')}</p>
    `;

    altOlcutler.forEach((olcut, index) => {
      const data = olcut.kalite_el_kitabi;
      htmlContent += `
        <div style="margin-top: 30px; margin-bottom: 10px; font-weight: bold; font-size: 14px; color: #1e40af;">
          ${index + 1}. ${olcut.kod} - ${getLocalizedField(olcut, 'olcut_adi', locale)}
        </div>
        ${data.aciklama_metni ? `<div class="description-box"><strong>${tKalite('description_label')}:</strong><br/>${data.aciklama_metni}</div>` : ''}
        <table>
          <thead>
            <tr>
              <th colspan="2">${t('table_prefix')} ${olcut.kod} - ${getLocalizedField(olcut, 'olcut_adi', locale)}</th>
            </tr>
          </thead>
          <tbody>
            <tr><td class="label">${tKalite('responsible_unit')}</td><td class="data">${data.sorumlu_birim || t('empty_data')}</td></tr>
            <tr><td class="label">${tKalite('first_planning_date')}</td><td class="data">${data.ilk_planlama_tarihi || t('empty_data')}</td></tr>
            <tr><td class="label">${tKalite('internal_stakeholders')}</td><td class="data">${data.ic_paydaslar || t('empty_data')}</td></tr>
            <tr><td class="label">${tKalite('external_stakeholders')}</td><td class="data">${data.dis_paydaslar || t('empty_data')}</td></tr>
            <tr><td class="label">${tKalite('international_stakeholders')}</td><td class="data">${data.uluslararasi_paydaslar || t('empty_data')}</td></tr>
            <tr><td class="label">${tKalite('application_areas')}</td><td class="data">${data.uygulama_alanlari || t('empty_data')}</td></tr>
            <tr><td class="label">${tKalite('tracking_mechanisms')}</td><td class="data">${data.izleme_mekanizmalari || t('empty_data')}</td></tr>
            <tr><td class="label">${tKalite('performance_indicators')}</td><td class="data">${data.performans_gostergeleri || t('empty_data')}</td></tr>
            <tr><td class="label">${tKalite('eval_improvement_date')}</td><td class="data">${data.degerlendirme_iyilestirme_tarihi || t('empty_data')}</td></tr>
            <tr><td class="label">${tKalite('bgs_location')}</td><td class="data">${data.bgs_yeri || t('empty_data')}</td></tr>
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
            {t('title')}
          </h2>
          <p className="text-slate-500 mt-2">{t('description')}</p>
        </div>
        <button 
          onClick={handleExportWord}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl font-bold transition-all shadow-lg shadow-indigo-500/20 active:scale-95 flex items-center gap-2"
        >
          <BookOpen className="w-5 h-5" /> {t('download_btn')}
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
                    <span className="bg-white/20 px-2 py-0.5 rounded text-sm">{t('table_prefix')} {index + 1}</span>
                    {olcut.kod} - {getLocalizedField(olcut, 'olcut_adi', locale)}
                  </h3>
                  <Info className="w-5 h-5 text-indigo-200" />
                </div>
                
                {data.aciklama_metni && (
                  <div className="p-8 bg-slate-50 border-b border-slate-100">
                    <h4 className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4" /> {tKalite('description_label')}
                    </h4>
                    <div className="text-sm text-slate-700 leading-relaxed font-medium whitespace-pre-wrap bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                      {data.aciklama_metni}
                    </div>
                  </div>
                )}
                <table className="w-full border-collapse">
                  <tbody className="divide-y divide-slate-100">
                    {[
                      [tKalite('responsible_unit'), data.sorumlu_birim],
                      [tKalite('first_planning_date'), data.ilk_planlama_tarihi],
                      [tKalite('internal_stakeholders'), data.ic_paydaslar],
                      [tKalite('external_stakeholders'), data.dis_paydaslar],
                      [tKalite('international_stakeholders'), data.uluslararasi_paydaslar],
                      [tKalite('application_areas'), data.uygulama_alanlari],
                      [tKalite('tracking_mechanisms'), data.izleme_mekanizmalari],
                      [tKalite('performance_indicators'), data.performans_gostergeleri],
                      [tKalite('eval_improvement_date'), data.degerlendirme_iyilestirme_tarihi],
                      [tKalite('bgs_location'), data.bgs_yeri]
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
