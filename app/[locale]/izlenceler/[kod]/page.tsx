import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Printer, CheckSquare, Square } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ kod: string; locale: string }>;
}

export default async function IzlenceDetailPage({ params }: PageProps) {
  const { kod } = await params;
  const supabase = await createClient();

  const { data: ders } = await supabase
    .from('dersler')
    .select('*')
    .eq('kod', kod)
    .single();

  if (!ders) notFound();

  const { data: izlence } = await supabase
    .from('ders_izlenceleri')
    .select('*')
    .eq('ders_id', kod)
    .order('guncelleme_tarihi', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!izlence || !izlence.icerik || Object.keys(izlence.icerik).length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-8 text-center">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">{ders.ad}</h1>
        <p className="text-slate-500 mb-6 text-sm uppercase tracking-widest font-black">Bu ders için henüz bir izlence hazırlanmamış.</p>
        <Link href="/izlenceler" className="text-blue-600 hover:underline font-bold">← Eğitim Planına Dön</Link>
      </div>
    );
  }

  const c = izlence.icerik;

  return (
    <div className="bg-slate-100 min-h-screen pb-20">
      {/* Yazdırma Kontrolü */}
      <div className="print:hidden sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <Link href="/izlenceler" className="flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-blue-600 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Eğitim Planı
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Görünüm: Öğrenci / Kamu</span>
          <button
            onClick={() => typeof window !== 'undefined' && window.print()}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black px-5 py-2.5 rounded-xl shadow-lg transition-all active:scale-95"
          >
            <Printer className="w-4 h-4" />
            YAZDIR / PDF OLARAK KAYDET
          </button>
        </div>
      </div>

      {/* Rapor İçeriği */}
      <div className="max-w-[210mm] mx-auto space-y-8 mt-8 print:mt-0 print:space-y-4">
        
        {/* SAYFA 1: GENEL BİLGİLER (Foto 5) */}
        <div className="bg-white p-12 shadow-2xl border border-slate-200 print:shadow-none print:border-none print:p-0">
          <div className="text-center mb-10 border-b-4 border-blue-900 pb-8">
            <h1 className="text-lg font-black text-blue-900 mb-1">ESKİŞEHİR OSMANGAZİ ÜNİVERSİTESİ</h1>
            <h2 className="text-base font-bold text-slate-800 mb-1">İLAHİYAT FAKÜLTESİ</h2>
            <h3 className="text-2xl font-black text-blue-900 mt-4 tracking-tight">DERS İZLENCESİ</h3>
          </div>

          <table className="w-full border-collapse border-2 border-blue-900/20 text-sm mb-10">
            <tbody>
              <tr>
                <td className="border border-slate-200 p-3 font-bold bg-blue-50/50 w-48">Ders Kodu / Adı</td>
                <td className="border border-slate-200 p-3 font-black text-blue-900" colSpan={3}>{ders.kod} - {ders.ad}</td>
              </tr>
              <tr>
                <td className="border border-slate-200 p-3 font-bold bg-blue-50/50">Öğretim Elemanı</td>
                <td className="border border-slate-200 p-3">{c.ogretimElemani}</td>
                <td className="border border-slate-200 p-3 font-bold bg-blue-50/50 w-32">E-Posta</td>
                <td className="border border-slate-200 p-3">{c.eposta}</td>
              </tr>
              <tr>
                <td className="border border-slate-200 p-3 font-bold bg-blue-50/50">Görüşme Saatleri</td>
                <td className="border border-slate-200 p-3">{c.gorusmeGunSaat}</td>
                <td className="border border-slate-200 p-3 font-bold bg-blue-50/50">Ofis</td>
                <td className="border border-slate-200 p-3">{c.ofis}</td>
              </tr>
            </tbody>
          </table>

          <h4 className="text-xs font-black text-blue-900 uppercase tracking-widest mb-4 bg-blue-50 p-2 border-l-4 border-blue-900">Ders Hakkında</h4>
          <table className="w-full border-collapse border-2 border-blue-900/20 text-[13px] mb-10">
            <tbody>
              <tr>
                <td className="border border-slate-200 p-3 font-bold bg-slate-50 w-32">Dönem</td>
                <td className="border border-slate-200 p-3">{c.donem || ders.yariyil}</td>
                <td className="border border-slate-200 p-3 font-bold bg-slate-50 w-32">Gün/Saat</td>
                <td className="border border-slate-200 p-3">{c.gunSaat}</td>
              </tr>
              <tr>
                <td className="border border-slate-200 p-3 font-bold bg-slate-50">Kredi/AKTS</td>
                <td className="border border-slate-200 p-3">{ders.kredi} / {ders.akts}</td>
                <td className="border border-slate-200 p-3 font-bold bg-slate-50">Eğitim Dili</td>
                <td className="border border-slate-200 p-3">{c.egitimDili}</td>
              </tr>
              <tr>
                <td className="border border-slate-200 p-3 font-bold bg-slate-50">Öğretim Türü</td>
                <td className="border border-slate-200 p-3">{c.ogretimTuru}</td>
                <td className="border border-slate-200 p-3 font-bold bg-slate-50">Derslik</td>
                <td className="border border-slate-200 p-3">{c.derslik}</td>
              </tr>
              <tr>
                <td className="border border-slate-200 p-3 font-bold bg-slate-50">Önkoşul</td>
                <td className="border border-slate-200 p-3" colSpan={3}>{c.onkosul}</td>
              </tr>
            </tbody>
          </table>

          <h4 className="text-xs font-black text-blue-900 uppercase tracking-widest mb-4 bg-blue-50 p-2 border-l-4 border-blue-900">Dersin Amacı</h4>
          <p className="text-sm leading-relaxed text-slate-700 mb-10 whitespace-pre-wrap">{c.amac}</p>

          <h4 className="text-xs font-black text-blue-900 uppercase tracking-widest mb-4 bg-blue-50 p-2 border-l-4 border-blue-900">Öğrenim Çıktıları</h4>
          <table className="w-full border-collapse border-2 border-blue-900/20 text-[12px]">
            <thead>
              <tr className="bg-blue-900 text-white">
                <th className="p-2 w-8">#</th>
                <th className="p-2 text-left">Dersin Öğrenim Çıktıları</th>
                <th className="p-2">Bilgi</th>
                <th className="p-2">Beceri</th>
                <th className="p-2">Yetkinlik</th>
              </tr>
            </thead>
            <tbody>
              {(c.ogrenimCiktilari || []).map((oc: any, i: number) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="p-3 text-center font-bold text-slate-400">{i + 1}</td>
                  <td className="p-3 text-slate-700 font-medium">{oc.cikti}</td>
                  <td className="p-3 text-center">{oc.bilgi ? <CheckSquare className="w-4 h-4 mx-auto text-blue-600" /> : <Square className="w-4 h-4 mx-auto text-slate-300" />}</td>
                  <td className="p-3 text-center">{oc.beceri ? <CheckSquare className="w-4 h-4 mx-auto text-blue-600" /> : <Square className="w-4 h-4 mx-auto text-slate-300" />}</td>
                  <td className="p-3 text-center">{oc.yetkinlik ? <CheckSquare className="w-4 h-4 mx-auto text-blue-600" /> : <Square className="w-4 h-4 mx-auto text-slate-300" />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* SAYFA 2: KAYNAKLAR VE POLİTİKALAR (Foto 4) */}
        <div className="bg-white p-12 shadow-2xl border border-slate-200 print:shadow-none print:border-none print:p-0">
          <h4 className="text-xs font-black text-blue-900 uppercase tracking-widest mb-4 bg-blue-50 p-2 border-l-4 border-blue-900">Ders Kaynakları</h4>
          <div className="space-y-4 mb-10 text-sm">
            <div>
              <p className="font-bold text-blue-900 mb-1 underline decoration-blue-200 decoration-2">Temel Ders Kitabı:</p>
              <p className="text-slate-700 italic leading-relaxed">{c.temelKaynaklar}</p>
            </div>
            <div>
              <p className="font-bold text-blue-900 mb-1 underline decoration-blue-200 decoration-2">Yardımcı Kaynaklar:</p>
              <p className="text-slate-700 italic leading-relaxed">{c.yardimciKaynaklar}</p>
            </div>
          </div>

          <h4 className="text-xs font-black text-blue-900 uppercase tracking-widest mb-4 bg-blue-50 p-2 border-l-4 border-blue-900">Ders Politikaları</h4>
          <div className="text-[13px] leading-[1.8] text-slate-700 whitespace-pre-wrap font-medium">
            {c.politikalar}
          </div>
        </div>

        {/* SAYFA 3: HAFTALIK İÇERİK (Foto 1) */}
        <div className="bg-white p-12 shadow-2xl border border-slate-200 print:shadow-none print:border-none print:p-0">
          <h4 className="text-xs font-black text-blue-900 uppercase tracking-widest mb-4 bg-blue-50 p-2 border-l-4 border-blue-900">Haftalık Ders İçeriği</h4>
          <table className="w-full border-collapse border-2 border-blue-900/20 text-[12px]">
            <thead>
              <tr className="bg-blue-900 text-white">
                <th className="p-2 w-16">Hafta</th>
                <th className="p-2 text-left">Konu Başlığı</th>
                <th className="p-2 text-left">İlgili Kaynaklar</th>
                <th className="p-2 w-24">İş Yükü</th>
              </tr>
            </thead>
            <tbody>
              {(c.haftalikIcerik || []).map((row: any, i: number) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="p-2.5 text-center font-black text-blue-900/40">{i + 1}</td>
                  <td className="p-2.5 font-bold text-slate-800">{row.konu}</td>
                  <td className="p-2.5 text-slate-500 italic">{row.kaynaklar}</td>
                  <td className="p-2.5 text-center font-bold">{row.isYuku}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
          .max-w-\\[210mm\\] { max-width: 100% !important; margin: 0 !important; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          h4 { page-break-after: avoid; }
        }
      `}</style>
    </div>
  );
}
