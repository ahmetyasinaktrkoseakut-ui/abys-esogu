'use client';

import { useState, useEffect, use } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Loader2, Info, FileSignature, FileText, CheckCircle2, FileSearch, Download } from 'lucide-react';
import StepPanel from '@/components/StepPanel';
import { useTranslations, useLocale } from 'next-intl';
import { getLocalizedField } from '@/lib/i18n-utils';
import { usePeriod } from '@/contexts/PeriodContext';

interface OzdegerlendirmeRaporuClientProps {
  params: Promise<{ id: string }>;
}

export default function OzdegerlendirmeRaporuClient({ params }: OzdegerlendirmeRaporuClientProps) {
  const resolvedParams = use(params);
  const [olcutDetay, setOlcutDetay] = useState<any>(null);
  const [raporOlusturuldu, setRaporOlusturuldu] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [raporMetni, setRaporMetni] = useState('');
  const [kanitlar, setKanitlar] = useState<any[]>([]);
  const [olgunlukPuani, setOlgunlukPuani] = useState<number | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const t = useTranslations('SelfEvaluation');
  const locale = useLocale();
  const { selectedPeriod } = usePeriod();

  const fetchData = async () => {
    if (!selectedPeriod) {
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const { data: olcut } = await supabase.from('alt_olcutler').select('*').eq('id', resolvedParams.id).single();
      if (olcut) setOlcutDetay(olcut);
      
      // Check if a report was already generated and saved in 'rapor' stage
      const { data: pukoData } = await supabase
        .from('puko_degerlendirmeleri')
        .select('*')
        .eq('alt_olcut_id', resolvedParams.id)
        .eq('puko_asamasi', 'rapor')
        .eq('donem_id', selectedPeriod?.id)
        .order('id', { ascending: false })
        .limit(1)
        .single();
        
      if (pukoData && pukoData.aciklama) {
        setRaporMetni(pukoData.aciklama);
        setKanitlar(Array.isArray(pukoData.kanit_dosyalari) ? pukoData.kanit_dosyalari : []);
        setRaporOlusturuldu(true);
      }
    } catch (error) {
      console.error("Fetch Data Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [resolvedParams.id, selectedPeriod]);

  const exportToWord = () => {
    if (!raporMetni) return;

    let htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>${t('title')}</title>
      <style>
        body { font-family: 'Calibri', 'Arial', sans-serif; line-height: 1.5; padding: 20px; }
        h1 { text-align: center; text-transform: uppercase; border-bottom: 2px solid black; padding-bottom: 10px; color: #1a202c; }
        h2 { color: #2d3748; margin-top: 20px; }
        h3 { background-color: #edf2f7; padding: 8px; border: 1px solid #cbd5e0; margin-top: 25px; color: #2b6cb0; text-transform: uppercase; font-size: 14px; }
        .kanit-section { margin-top: 40px; border-top: 2px solid #2b6cb0; padding-top: 10px; }
        .kanit-link { color: #3182ce; text-decoration: underline; }
        .footer { text-align: center; font-size: 11px; color: #718096; margin-top: 50px; border-top: 1px solid #e2e8f0; padding-top: 10px; }
      </style>
      </head>
      <body>
        <h1>${t('title')}</h1>
        <p style='text-align:center; font-weight: bold;'>${olcutDetay?.kod || ''} - ${getLocalizedField(olcutDetay, 'olcut_adi', locale) || ''}</p>
        <p style='text-align:center; color: #718096; font-size: 12px;'>${t('generating_title').replace('...', '')}: ${new Date().toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US')} ${new Date().toLocaleTimeString(locale === 'tr' ? 'tr-TR' : 'en-US')}</p>
        
        <div class='content'>
          ${raporMetni}
        </div>

        <div class='kanit-section'>
          <h2>${t('evidences')}</h2>
          ${kanitlar.length === 0 ? `<p><i>${t('no_evidence')}</i></p>` : '<ul>'}
          ${kanitlar.map(doc => `<li><a class='kanit-link' href='${doc.url}'>${doc.name}</a></li>`).join('')}
          ${kanitlar.length === 0 ? '' : '</ul>'}
        </div>

        <div class='footer'>${t('title')} - Quality Management System</div>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${t('title').replace(/ /g, '_')}_${olcutDetay?.kod || 'Rapor'}.doc`;
    link.click();
    URL.revokeObjectURL(url);
  };


  const handleRaporOlustur = async () => {
    setIsGenerating(true);
    try {
      // Fetch data from stages 2 to 6
      const adimlar = ['planlama', 'uygulama', 'kontrol', 'onlem', 'olgunluk'];
      const { data } = await supabase
        .from('puko_degerlendirmeleri')
        .select('*')
        .eq('alt_olcut_id', resolvedParams.id)
        .eq('donem_id', selectedPeriod?.id)
        .in('puko_asamasi', adimlar);

      if (!data || data.length === 0) {
        alert(t('no_data_alert'));
        setIsGenerating(false);
        return;
      }

      let birlesikMetin = '';
      let birlesikKanitlar: any[] = [];
      let puan = null;

      // Order logically
      const orderMap: Record<string, number> = { planlama: 1, uygulama: 2, kontrol: 3, onlem: 4, olgunluk: 5 };
      const siraliData = [...data].sort((a, b) => (orderMap[a.puko_asamasi] || 99) - (orderMap[b.puko_asamasi] || 99));

      for (const row of siraliData) {
        if (row.aciklama && row.aciklama.trim() !== '' && row.aciklama !== '<p></p>') {
          const baslik = t('stage_header', { stage: row.puko_asamasi.toUpperCase() });
          birlesikMetin += `<h3>${baslik}</h3>${row.aciklama}<br/><br/>`;
        }
        if (row.kanit_dosyalari && Array.isArray(row.kanit_dosyalari)) {
          birlesikKanitlar = [...birlesikKanitlar, ...row.kanit_dosyalari];
        }
        if (row.puko_asamasi === 'olgunluk' && row.olgunluk_puani) {
          puan = row.olgunluk_puani;
        }
      }

      if (puan) {
        birlesikMetin += `<hr/><h3>${t('maturity_score_header')} <span style="color: #ea580c;">${puan} / 5</span></h3>`;
        
        let rubricText = '';
        const duzeylerObj = olcutDetay?.[`olgunluk_duzeyleri_${locale}`] || olcutDetay?.['olgunluk_duzeyleri'];
        if (duzeylerObj && typeof duzeylerObj === 'object') {
           rubricText = duzeylerObj[puan.toString()] || '';
        }
        
        if (rubricText) {
          birlesikMetin += `<p style="color: #718096; font-style: italic; margin-top: 5px; font-size: 13px;">${rubricText}</p>`;
        }
        setOlgunlukPuani(puan);
      }

      // Deduplicate files by URL
      const uniqueKanitlar = Array.from(new Map(birlesikKanitlar.map(item => [item.url, item])).values());

      setRaporMetni(birlesikMetin);
      setKanitlar(uniqueKanitlar);
      
      // Save it automatically to 'rapor' stage
      const upsertData: Record<string, any> = {
        alt_olcut_id: resolvedParams.id,
        puko_asamasi: 'rapor',
        donem_id: selectedPeriod?.id,
        aciklama: birlesikMetin,
        kanit_dosyalari: uniqueKanitlar,
        durum: 'Beklemede',
        red_nedeni: null
      };

      const { data: existingRecord } = await supabase
        .from('puko_degerlendirmeleri')
        .select('id')
        .eq('alt_olcut_id', resolvedParams.id)
        .eq('puko_asamasi', 'rapor')
        .eq('donem_id', selectedPeriod?.id)
        .maybeSingle();

      if (existingRecord?.id) {
        await supabase.from('puko_degerlendirmeleri').update(upsertData).eq('id', existingRecord.id);
      } else {
        await supabase.from('puko_degerlendirmeleri').insert(upsertData);
      }

      setRaporOlusturuldu(true);
    } catch (err: any) {
      console.error(err);
      alert(`Error: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading) {
    return <div className="h-full flex items-center justify-center p-20"><Loader2 className="w-10 h-10 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="p-8 max-w-[1400px] mx-auto animate-in fade-in duration-500">
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="text-sm text-slate-500 flex items-center gap-2 font-medium">
            <span className="cursor-pointer hover:text-blue-600">{t('home')}</span> &gt; 
            <span className="cursor-pointer hover:text-blue-600">{t('criteria')}</span> &gt;
            <span className="text-slate-800">{[olcutDetay?.kod, getLocalizedField(olcutDetay, 'olcut_adi', locale)].filter(Boolean).join(' ') || `Ölçüt #${resolvedParams.id}`}</span>
          </div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-slate-800">
              {[olcutDetay?.kod, getLocalizedField(olcutDetay, 'olcut_adi', locale)].filter(Boolean).join(' ') || `Ölçüt #${resolvedParams.id}`}
            </h2>
            <Info className="w-4 h-4 text-slate-400 cursor-pointer" />
          </div>
          <p className="text-sm text-slate-500">{t('synthesis_desc')}</p>
        </div>
      </div>

      <StepPanel activeStepId="rapor" altOlcutId={resolvedParams.id} />

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden mb-6 relative min-h-[400px]">
        {!raporOlusturuldu && !isGenerating ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center bg-gradient-to-br from-blue-50/50 to-white">
            <div className="w-24 h-24 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-6 shadow-inner">
              <FileSignature className="w-12 h-12" />
            </div>
            <h3 className="text-2xl font-black text-slate-800 mb-3">{t('title')}</h3>
            <p className="text-slate-500 max-w-lg mb-8 leading-relaxed">
              {t('description')}
            </p>
            <button 
              onClick={handleRaporOlustur}
              className="group relative inline-flex items-center justify-center gap-3 px-10 py-5 font-bold text-white transition-all duration-300 bg-blue-600 rounded-full hover:bg-blue-700 hover:scale-105 hover:shadow-[0_0_40px_rgba(37,99,235,0.4)] focus:outline-none overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
              <FileSearch className="w-6 h-6 relative z-10" />
              <span className="text-lg relative z-10">{t('create_button')}</span>
            </button>
          </div>
        ) : isGenerating ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center bg-white">
             <Loader2 className="w-16 h-16 animate-spin text-blue-600 mb-6" />
             <h3 className="text-xl font-bold text-slate-700 mb-2">{t('generating_title')}</h3>
             <p className="text-slate-500">{t('generating_desc')}</p>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <div className="bg-blue-600 p-6 flex items-center justify-between text-white">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-8 h-8 text-blue-200" />
                <div>
                  <h3 className="text-xl font-bold">{t('ready_title')}</h3>
                  <p className="text-blue-100 text-sm">{t('ready_subtitle')}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={exportToWord}
                  className="bg-white text-blue-600 hover:bg-blue-50 px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 shadow-lg"
                >
                  <Download className="w-4 h-4" /> {t('download_word')}
                </button>
                <button 
                  onClick={handleRaporOlustur}
                  className="bg-white/20 hover:bg-white/30 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2"
                >
                  <FileSearch className="w-4 h-4" /> {t('recompile')}
                </button>
              </div>
            </div>

            <div className="p-8 lg:p-12 prose prose-slate max-w-none bg-[#FAFAFA] border-b border-slate-200">
               <div dangerouslySetInnerHTML={{ __html: raporMetni }} className="space-y-6" />
            </div>

            <div className="p-8 lg:p-12 bg-white">
              <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2 border-b pb-4">
                <FileText className="w-6 h-6 text-blue-600" />
                {t('evidences')}
              </h3>
              
              {kanitlar.length === 0 ? (
                <div className="text-slate-500 italic p-6 bg-slate-50 rounded-xl border border-slate-200 border-dashed text-center">
                  {t('no_evidence')}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {kanitlar.map((doc, idx) => (
                    <a 
                      key={idx} 
                      href={doc.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all bg-white group"
                    >
                      <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-700 truncate text-sm">{doc.name}</p>
                        {doc.size && <p className="text-xs text-slate-500 mt-0.5">{doc.size} KB</p>}
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
