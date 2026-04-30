'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Loader2, Lightbulb, FileText, Printer, Download } from 'lucide-react';

interface AnaBaslik {
  id: string;
  kod: string;
  baslik_adi: string;
}

interface AltOlcut {
  id: string;
  kod: string;
  olcut_adi: string;
  ana_baslik_id: string;
  sorumlu_birim_id: string;
}

interface PukoVerisi {
  alt_olcut_id: string;
  ust_birim_onerileri: string[];
}

export default function OnerilenlerClient() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [raporData, setRaporData] = useState<{
    anaBasliklar: AnaBaslik[],
    altOlcutler: AltOlcut[],
    pukoVerileri: PukoVerisi[],
    birimler: Record<string, string>
  } | null>(null);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase.from('profiller').select('rol').eq('id', user.id).single();
          const role = profile?.rol?.toLowerCase() || '';
          if (role.includes('yonetici') || role.includes('yönetici') || role.includes('admin')) {
            setIsAdmin(true);

            // Verileri Çek
            const [anaBasliklarRes, altOlcutlerRes, pukoRes, birimlerRes] = await Promise.all([
              supabase.from('ana_basliklar').select('*').order('kod', { ascending: true }),
              supabase.from('alt_olcutler').select('*').order('kod', { ascending: true }),
              supabase.from('puko_degerlendirmeleri').select('alt_olcut_id, ust_birim_onerileri').eq('puko_asamasi', 'onlem'),
              supabase.from('birimler').select('id, ad')
            ]);

            // Sadece önerisi olan PUKO verilerini filtrele
            const pukoList = (pukoRes.data || []).filter((p: any) =>
              Array.isArray(p.ust_birim_onerileri) && p.ust_birim_onerileri.length > 0 && p.ust_birim_onerileri.some((o: any) => {
                if (typeof o === 'string') return o.trim() !== '';
                return o && o.oneri && o.oneri.trim() !== '';
              })
            );

            const birimMap: Record<string, string> = {};
            if (birimlerRes.data) {
              birimlerRes.data.forEach((b: any) => {
                birimMap[b.id] = b.ad;
              });
            }

            setRaporData({
              anaBasliklar: anaBasliklarRes.data || [],
              altOlcutler: altOlcutlerRes.data || [],
              pukoVerileri: pukoList,
              birimler: birimMap
            });
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  if (isLoading) {
    return <div className="h-[calc(100vh-100px)] flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-amber-600" /></div>;
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-100px)] p-8">
        <div className="bg-red-50 p-10 rounded-3xl border border-red-200 text-center max-w-md">
          <h2 className="text-2xl font-bold text-red-700 mb-2">Yetkisiz Erişim</h2>
          <p className="text-red-500">Bu sayfayı görüntüleme yetkiniz bulunmamaktadır. Sadece Yöneticiler erişebilir.</p>
        </div>
      </div>
    );
  }

  const exportToWord = () => {
    if (!raporData) return;

    let htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>Üst Birim Önerileri Raporu</title>
      <style>
        body { font-family: 'Calibri', 'Arial', sans-serif; line-height: 1.5; padding: 20px; }
        h1 { text-align: center; text-transform: uppercase; border-bottom: 2px solid black; padding-bottom: 10px; color: #1a202c; }
        h2 { background-color: #f7fafc; padding: 10px; border: 1px solid #e2e8f0; margin-top: 30px; color: #2d3748; }
        h3 { color: #975a16; border-bottom: 1px solid #f6e05e; margin-top: 20px; padding-bottom: 5px; }
        .oneri-box { background-color: #fffaf0; padding: 15px; border: 1px solid #feebc8; border-radius: 8px; margin-top: 10px; }
        .footer { text-align: center; font-size: 11px; color: #718096; margin-top: 50px; border-top: 1px solid #e2e8f0; padding-top: 10px; }
        li { margin-bottom: 8px; color: #4a5568; }
      </style>
      </head>
      <body>
        <h1>Üst Birim Önerileri Raporu</h1>
        <p style='text-align:center; color: #718096;'>Oluşturulma Tarihi: ${new Date().toLocaleDateString('tr-TR')} ${new Date().toLocaleTimeString('tr-TR')}</p>
    `;

    raporData.anaBasliklar.forEach(anaBaslik => {
      const ilgiliOlcutler = raporData.altOlcutler.filter(o =>
        o.ana_baslik_id === anaBaslik.id && raporData.pukoVerileri.find(p => p.alt_olcut_id === o.id)
      );

      if (ilgiliOlcutler.length > 0) {
        htmlContent += `<h2>${anaBaslik.kod} - ${anaBaslik.baslik_adi}</h2>`;
        ilgiliOlcutler.forEach(olcut => {
          const puko = raporData.pukoVerileri.find(p => p.alt_olcut_id === olcut.id);
          const sorumluBirimAd = raporData.birimler[olcut.sorumlu_birim_id] || 'Bilinmeyen Birim';

          if (puko && puko.ust_birim_onerileri.length > 0) {
            htmlContent += `<h3>${olcut.kod} - ${olcut.olcut_adi}</h3>`;
            htmlContent += `<p style='font-size:12px; color: #4a5568;'><b>Gönderen Birim:</b> ${sorumluBirimAd}</p>`;
            htmlContent += `<div class='oneri-box'><ul>`;
            puko.ust_birim_onerileri.forEach((o: any) => {
              const oneriText = typeof o === 'string' ? o : o.oneri;
              const gonderilenBirim = typeof o === 'string' ? '' : o.birim;
              if (oneriText && oneriText.trim() !== '') {
                htmlContent += `<li>${gonderilenBirim ? `<b style="color: #c05621;">[Hedef: ${gonderilenBirim}]</b> ` : ''}${oneriText}</li>`;
              }
            });
            htmlContent += `</ul></div>`;
          }
        });
      }
    });

    htmlContent += `
        <div class='footer'>Bu belge kalite yönetim sistemi tarafından otomatik olarak oluşturulmuştur.</div>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Onerilenler_Raporu.doc';
    link.click();
    URL.revokeObjectURL(url);
  };

  const getPukoForOlcut = (olcutId: string) => {
    return raporData?.pukoVerileri.find(p => p.alt_olcut_id === olcutId);
  };

  return (
    <div className="p-8 max-w-[1400px] mx-auto animate-in fade-in duration-500">

      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <Lightbulb className="w-8 h-8 text-amber-500" />
            Üst Birim Önerileri Raporu
          </h1>
          <p className="text-slate-500 mt-2">Birimlerin "İyileştirme" aşamasında sunduğu tüm öneriler hiyerarşik olarak listelenir.</p>
        </div>
        {raporData && (
          <button
            onClick={exportToWord}
            className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-md flex-shrink-0"
          >
            <Download className="w-5 h-5" /> Word Olarak İndir (.doc)
          </button>
        )}
      </div>

      {raporData && raporData.pukoVerileri.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-16 text-center">
          <Lightbulb className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-700 mb-2">Henüz Öneri Bulunmuyor</h3>
          <p className="text-slate-500">Birimler "İyileştirme" aşamasında henüz bir üst birim önerisi girmemiş.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-10">

          <div className="text-center mb-12 border-b-2 border-slate-800 pb-8">
            <h1 className="text-4xl font-black text-slate-900 mb-4 uppercase">Üst Birim Önerileri Raporu</h1>
            <p className="text-lg text-slate-600">Oluşturulma Tarihi: {new Date().toLocaleDateString('tr-TR')} {new Date().toLocaleTimeString('tr-TR')}</p>
          </div>

          <div className="space-y-12">
            {raporData?.anaBasliklar.map((anaBaslik) => {
              const ilgiliOlcutler = raporData.altOlcutler.filter(o =>
                o.ana_baslik_id === anaBaslik.id && getPukoForOlcut(o.id)
              );

              if (ilgiliOlcutler.length === 0) return null;

              return (
                <div key={anaBaslik.id}>
                  <div className="bg-slate-800 text-white p-4 rounded-lg mb-6">
                    <h2 className="text-2xl font-bold">{anaBaslik.kod} - {anaBaslik.baslik_adi}</h2>
                  </div>

                  <div className="space-y-8 pl-4 border-l-4 border-slate-200 ml-4">
                    {ilgiliOlcutler.map((olcut) => {
                      const puko = getPukoForOlcut(olcut.id);
                      if (!puko) return null;

                      const gecerliOneriler = puko.ust_birim_onerileri.filter((o: any) => {
                        if (typeof o === 'string') return o.trim() !== '';
                        return o && o.oneri && o.oneri.trim() !== '';
                      });
                      if (gecerliOneriler.length === 0) return null;

                      const sorumluBirimAd = raporData.birimler[olcut.sorumlu_birim_id] || 'Bilinmeyen Birim';

                      return (
                        <div key={olcut.id} className="mb-6">
                          <h3 className="text-lg font-bold text-amber-800 mb-2 flex items-center gap-2">
                            <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded">{olcut.kod}</span>
                            {olcut.olcut_adi}
                          </h3>
                          <p className="text-sm text-slate-500 mb-4 font-semibold italic">
                            Gönderen Birim: {sorumluBirimAd}
                          </p>

                          <div className="bg-amber-50/50 p-5 rounded-lg border border-amber-100">
                            <ul className="space-y-4">
                              {gecerliOneriler.map((o: any, idx: number) => {
                                const oneriText = typeof o === 'string' ? o : o.oneri;
                                const gonderilenBirim = typeof o === 'string' ? '' : o.birim;
                                return (
                                  <li key={idx} className="flex items-start gap-3">
                                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-200 text-amber-800 flex items-center justify-center text-xs font-bold mt-1">
                                      {idx + 1}
                                    </span>
                                    <div className="flex-1">
                                      {gonderilenBirim && (
                                        <p className="text-[11px] uppercase tracking-wider font-bold text-amber-700 mb-1 flex items-center gap-1">
                                          Hedef Birim: <span className="text-slate-700">{gonderilenBirim}</span>
                                        </p>
                                      )}
                                      <p className="text-slate-800 leading-relaxed">{oneriText}</p>
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-20 pt-8 border-t border-slate-200 text-center text-slate-500 text-sm">
            <p>Bu belge kalite yönetim sistemi tarafından otomatik olarak oluşturulmuştur.</p>
          </div>
        </div>
      )}
    </div>
  );
}
