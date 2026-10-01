import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CheckSquare, Square } from 'lucide-react';
import PrintButtonClient from '@/components/PrintButtonClient';
import { PROGRAM_OUTCOMES, DISCIPLINE_OUTCOMES } from '@/lib/izlenceConstants';

export const dynamic = 'force-dynamic';

export default async function IzlenceDetailPage({ params }: { params: Promise<{ kod: string }> }) {
  const { kod } = await params;
  const supabase = await createClient();

  const { data: ders } = await supabase.from('dersler').select('*').eq('kod', kod).maybeSingle();
  if (!ders) notFound();

  const { data: izlence } = await supabase
    .from('ders_izlenceleri')
    .select('*')
    .eq('ders_id', kod)
    .order('guncelleme_tarihi', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!izlence || !izlence.icerik) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-8 text-center">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">{ders.ad}</h1>
        <p className="text-slate-500 mb-6 text-sm uppercase tracking-widest font-black">Bu ders için henüz bir izlence hazırlanmamış.</p>
        <Link href="/izlenceler" className="text-blue-600 hover:underline font-bold">← Eğitim Planına Dön</Link>
      </div>
    );
  }

  const c = izlence.icerik;

  const aktsList = c.aktsIsYuku || [];
  const toplamIsYuku = aktsList.reduce((acc: number, row: any) => acc + (parseFloat(row.toplam) || 0), 0);
  const isYukuBolu30 = (toplamIsYuku / 30).toFixed(2);
  const aktsKredisi = Math.round(toplamIsYuku / 30);

  return (
    <div className="bg-slate-100 min-h-screen pb-20 print:bg-white print:pb-0">
      {/* Top Navbar (Print Hidden) */}
      <div className="print:hidden sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <Link href="/izlenceler" className="flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-blue-600 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Eğitim Planı
        </Link>
        <PrintButtonClient />
      </div>

      <div className="max-w-[210mm] mx-auto mt-8 print:mt-0 shadow-2xl bg-white border border-slate-200 print:shadow-none print:border-none print:max-w-none">
        
        {/* SAYFA 1: GENEL BİLGİLER & ÖÇ */}
        <div className="p-8 sm:p-12 print:p-0 border-b border-dashed border-slate-200 print:border-none print-break-after">
          <div className="text-center mb-8 border-b-4 border-blue-900 pb-6">
            <h1 className="text-xl font-black text-blue-900 mb-1">ESKİŞEHİR OSMANGAZİ ÜNİVERSİTESİ</h1>
            <h2 className="text-lg font-bold text-slate-800 mb-1">İLAHİYAT FAKÜLTESİ</h2>
            <h3 className="text-2xl font-black text-blue-900 mt-4 tracking-tight">DERS İZLENCESİ</h3>
          </div>

          <div className="grid grid-cols-1 gap-1 text-[13px] mb-8">
            {[
              ['Ders Kodu', ders.kod], ['Ders Adı', ders.ad],
              ['Öğretim Elemanı', c.ogretimElemani], ['E-Posta', c.eposta],
              ['Görüşme Gün/Saat', c.gorusmeGunSaat], ['Ofis', c.ofis],
              ['Dönem', c.donem || ders.yariyil], ['Gün ve Saat', c.gunSaat],
              ['Kredi/AKTS', `${ders.kredi} / ${ders.akts}`], ['Eğitim Dili', c.egitimDili],
              ['Öğretim Türü', c.ogretimTuru], ['Derslik', c.derslik], ['Ders Türü', ders.tur],
              ['Önkoşul Dersleri', c.onkosul], ['Dersin Amacı', c.amac]
            ].map(([label, val]) => (
              <div key={label} className="flex border-b border-slate-100 py-1.5">
                <span className="w-48 font-black text-blue-900 uppercase text-[10px] tracking-widest">{label}</span>
                <span className="flex-1 font-medium text-slate-700">: {val}</span>
              </div>
            ))}
          </div>

          <h4 className="text-xs font-black text-blue-900 uppercase tracking-widest mb-4 bg-blue-50 p-2.5 border-l-4 border-blue-900">Dersin Öğrenim Çıktıları</h4>
          <table className="w-full border-collapse border border-slate-200 text-[10px]">
            <thead>
              <tr className="bg-blue-900 text-white">
                <th className="border border-blue-900 p-2 w-8 text-center">#</th>
                <th className="border border-blue-900 p-2 text-left">Öğrenim Çıktıları</th>
                <th className="border border-blue-900 p-2 w-12 text-center">Bilgi</th>
                <th className="border border-blue-900 p-2 w-12 text-center">Beceri</th>
                <th className="border border-blue-900 p-2 w-12 text-center">Yetkinlik</th>
              </tr>
            </thead>
            <tbody>
              {(c.ogrenimCiktilari || []).map((oc: any, i: number) => oc.cikti && (
                <tr key={i} className="border-b border-slate-100">
                  <td className="border p-2 text-center font-bold text-slate-400">{i + 1}</td>
                  <td className="border p-2 font-medium text-slate-800">{oc.cikti}</td>
                  <td className="border p-2 text-center">{oc.bilgi ? <CheckSquare className="w-4 h-4 mx-auto text-blue-600" /> : <Square className="w-4 h-4 mx-auto text-slate-200" />}</td>
                  <td className="border p-2 text-center">{oc.beceri ? <CheckSquare className="w-4 h-4 mx-auto text-blue-600" /> : <Square className="w-4 h-4 mx-auto text-slate-200" />}</td>
                  <td className="border p-2 text-center">{oc.yetkinlik ? <CheckSquare className="w-4 h-4 mx-auto text-blue-600" /> : <Square className="w-4 h-4 mx-auto text-slate-200" />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* SAYFA 2: KAYNAKLAR & POLİTİKALAR */}
        <div className="p-8 sm:p-12 print:p-0 border-b border-dashed border-slate-200 print:border-none print-break-after">
          <h4 className="text-xs font-black text-blue-900 uppercase tracking-widest mb-4 bg-blue-50 p-2.5 border-l-4 border-blue-900">Ders Kaynakları</h4>
          <div className="space-y-4 mb-8 text-sm">
            <div><p className="font-black text-blue-900 mb-1">Temel Ders Kitabı:</p><p className="text-slate-700 italic leading-relaxed">{c.temelKaynaklar || '-'}</p></div>
            <div><p className="font-black text-blue-900 mb-1">Yardımcı Kaynaklar:</p><p className="text-slate-700 italic leading-relaxed">{c.yardimciKaynaklar || '-'}</p></div>
          </div>
          <h4 className="text-xs font-black text-blue-900 uppercase tracking-widest mb-4 bg-blue-50 p-2.5 border-l-4 border-blue-900">Ders Politikaları</h4>
          <div className="text-[12px] leading-[1.8] text-slate-700 whitespace-pre-wrap font-medium">{c.politikalar}</div>
        </div>

        {/* SAYFA 3: HAFTALIK İÇERİK & DEĞERLENDİRME */}
        <div className="p-8 sm:p-12 print:p-0 border-b border-dashed border-slate-200 print:border-none print-break-after">
          <h4 className="text-xs font-black text-blue-900 uppercase tracking-widest mb-4 bg-blue-50 p-2.5 border-l-4 border-blue-900">Haftalık Ders İçeriği</h4>
          <table className="w-full border-collapse border border-slate-200 text-[11px] mb-8">
            <thead>
              <tr className="bg-blue-900 text-white">
                <th className="p-2 w-16 border border-blue-900 text-center">Hafta</th>
                <th className="p-2 border border-blue-900 text-left">Konu Başlığı</th>
                <th className="p-2 border border-blue-900 text-left">İlgili Kaynaklar</th>
                <th className="p-2 w-28 border border-blue-900 text-center">İş Yükü</th>
              </tr>
            </thead>
            <tbody>
              {(c.haftalikIcerik || []).map((h: any, i: number) => (
                <tr key={i} className={`border-b ${h.hafta === 'Arasınav' || h.hafta === 'Final' ? 'bg-blue-50 font-black' : ''}`}>
                  <td className="p-2 border text-center font-bold text-blue-900">{h.hafta}</td>
                  <td className="p-2 border font-medium text-slate-800">{h.konu}</td>
                  <td className="p-2 border text-slate-600 italic text-[10px]">{h.kaynaklar}</td>
                  <td className="p-2 border text-center text-[10px] text-slate-700">{h.isYuku}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h4 className="text-xs font-black text-blue-900 uppercase tracking-widest mb-4 bg-blue-50 p-2.5 border-l-4 border-blue-900">Ders Değerlendirme</h4>
          <table className="w-full border-collapse border border-slate-200 text-[11px] mb-6">
            <thead>
              <tr className="bg-slate-50">
                <th className="border p-2 text-left">Değerlendirme Türü</th>
                <th className="border p-2 text-left">Açıklama</th>
                <th className="border p-2 w-16 text-center">%</th>
              </tr>
            </thead>
            <tbody>
              {(c.degerlendirme || []).map((d: any, i: number) => d.yuzde > 0 && (
                <tr key={i} className="border-b">
                  <td className="border p-2 font-bold">{d.tur}</td>
                  <td className="border p-2 text-slate-600">{d.aciklama}</td>
                  <td className="border p-2 text-center font-black">{d.yuzde}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs font-black text-blue-900">HARF NOTU BAREMİ: <span className="text-slate-500 font-bold ml-2">{c.harfNotu}</span></p>
        </div>

        {/* SAYFA 4: AKTS & PÇ MATRİS */}
        <div className="p-8 sm:p-12 print:p-0 border-b border-dashed border-slate-200 print:border-none print-break-after">
          <h4 className="text-xs font-black text-blue-900 uppercase tracking-widest mb-4 bg-blue-50 p-2.5 border-l-4 border-blue-900">AKTS - İş Yükü Tablosu</h4>
          <table className="w-full border-collapse border border-slate-200 text-[11px] mb-8">
            <thead>
              <tr className="bg-blue-900 text-white">
                <th className="border border-blue-900 p-2 text-left">Etkinlikler</th>
                <th className="border border-blue-900 p-2 w-20 text-center">Sayısı</th>
                <th className="border border-blue-900 p-2 w-20 text-center">Süresi</th>
                <th className="border border-blue-900 p-2 w-20 text-center">Toplam</th>
              </tr>
            </thead>
            <tbody>
              {aktsList.map((row: any, i: number) => {
                const hasValue = (parseFloat(row.toplam) || 0) > 0 || (row.sayisi && row.sayisi !== '0') || (row.suresi && row.suresi !== '0');
                if (!hasValue && !row.toplam) return null;
                return (
                  <tr key={i} className="border-b">
                    <td className="border p-2 font-medium text-slate-800">{row.etkinlik}</td>
                    <td className="border p-2 text-center text-slate-700">{row.sayisi || '-'}</td>
                    <td className="border p-2 text-center text-slate-700">{row.suresi || '-'}</td>
                    <td className="border p-2 text-center font-bold text-slate-900">{row.toplam || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-black text-slate-700">
                <td colSpan={3} className="border p-2 text-right uppercase text-[10px] tracking-widest">Toplam İş Yükü</td>
                <td className="border p-2 text-center text-blue-900 font-black">{toplamIsYuku}</td>
              </tr>
              <tr className="bg-slate-50 font-black text-slate-700">
                <td colSpan={3} className="border p-2 text-right uppercase text-[10px] tracking-widest">Toplam İş Yükü / 30</td>
                <td className="border p-2 text-center text-blue-900 font-black">{isYukuBolu30}</td>
              </tr>
              <tr className="bg-blue-900 text-white font-black">
                <td colSpan={3} className="border border-blue-900 p-2.5 text-right uppercase text-[11px] tracking-widest">Dersin AKTS Kredisi</td>
                <td className="border border-blue-900 p-2.5 text-center text-white text-base font-black">{aktsKredisi}</td>
              </tr>
            </tfoot>
          </table>

          <h4 className="text-xs font-black text-blue-900 uppercase tracking-widest mb-1 bg-blue-50 p-2.5 border-l-4 border-blue-900">
            Dersin Öğrenim Çıktılarının (ÖÇ) Program Çıktıları (PÇ) ile Olan İlişkisi
          </h4>
          <p className="text-[10px] text-slate-400 mb-3 font-bold">(5: Çok yüksek, 4: Yüksek, 3: Orta, 2: Düşük, 1: Çok düşük)</p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-slate-200 text-[10px]">
              <thead>
                <tr className="bg-slate-50">
                  <th rowSpan={2} className="border p-2 text-left">PÇ No / Metin</th>
                  <th colSpan={10} className="border p-2 text-center bg-blue-50 text-blue-900 font-bold">Öğrenme Çıktıları</th>
                </tr>
                <tr className="bg-slate-50">
                  {Array(10).fill(0).map((_, i) => <th key={i} className="border p-1 w-7 text-center font-bold">ÖÇ{i+1}</th>)}
                </tr>
              </thead>
              <tbody>
                {(c.pcMatris || []).map((pc: any, i: number) => (
                  <tr key={i} className="border-b">
                    <td className="border p-2 text-left leading-snug">
                      <span className="font-black text-blue-900">{pc.id}:</span>{' '}
                      <span className="text-slate-700">{pc.metin || PROGRAM_OUTCOMES[i] || ''}</span>
                    </td>
                    {Array(10).fill(0).map((_, j) => {
                      const val = pc.ocValues?.[j];
                      return (
                        <td key={j} className="border p-1 text-center font-bold bg-blue-50/20 text-slate-800">
                          {val || '-'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* SAYFA 5: DÖÇ MATRİS & TELİF */}
        <div className="p-8 sm:p-12 print:p-0">
          <h4 className="text-xs font-black text-blue-900 uppercase tracking-widest mb-1 bg-blue-50 p-2.5 border-l-4 border-blue-900">
            Ders Öğrenim Çıktılarının (ÖÇ) İAA Disipline Özgü Çıktılar (DÖÇ) ile Olan İlişkisi
          </h4>
          <p className="text-[10px] text-slate-400 mb-3 font-bold">(5: Çok yüksek, 4: Yüksek, 3: Orta, 2: Düşük, 1: Çok düşük)</p>
          <div className="overflow-x-auto mb-8">
            <table className="w-full border-collapse border border-slate-200 text-[10px]">
              <thead>
                <tr className="bg-slate-50">
                  <th rowSpan={2} className="border p-2 text-left">DÖÇ No / Metin</th>
                  <th colSpan={10} className="border p-2 text-center bg-blue-50 text-blue-900 font-bold">Öğrenme Çıktıları</th>
                </tr>
                <tr className="bg-slate-50">
                  {Array(10).fill(0).map((_, i) => <th key={i} className="border p-1 w-7 text-center font-bold">ÖÇ{i+1}</th>)}
                </tr>
              </thead>
              <tbody>
                {(c.docMatris || []).map((doc: any, i: number) => (
                  <tr key={i} className="border-b">
                    <td className="border p-2 text-left leading-snug">
                      <span className="font-black text-blue-900">{doc.id}:</span>{' '}
                      <span className="text-slate-700">{doc.metin || DISCIPLINE_OUTCOMES[i] || ''}</span>
                    </td>
                    {Array(10).fill(0).map((_, j) => {
                      const val = doc.ocValues?.[j];
                      return (
                        <td key={j} className="border p-1 text-center font-bold bg-blue-50/20 text-slate-800">
                          {val || '-'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="text-center pt-6 border-t border-slate-100 text-[10px] text-slate-400 font-medium">
            <p>Akreditasyon Yönetim Bilgi Sistemi Ahmet Yasin Aktürk Tarafından İlahiyat Fakültelerinin Hizmetine Sunulmak Amacıyla Yapılmıştır.</p>
            <p className="mt-0.5">Tüm Hakları Kültür Bakanlığı Tarafından Tescilli ve Saklıdır. -2026-</p>
          </div>
        </div>

      </div>

      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 12mm 15mm;
          }
          body {
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print-break-inside-avoid {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          .print-break-after {
            break-after: page !important;
            page-break-after: always !important;
          }
          h1, h2, h3, h4 {
            break-after: avoid !important;
            page-break-after: avoid !important;
          }
          tr {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>
    </div>
  );
}
