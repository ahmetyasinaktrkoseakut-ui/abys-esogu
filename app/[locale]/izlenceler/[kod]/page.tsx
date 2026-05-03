import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Printer } from 'lucide-react';

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
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-8">
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-md">
          <h1 className="text-xl font-bold text-slate-800 mb-2">{ders.ad}</h1>
          <p className="text-slate-500 mb-6">Bu ders için henüz bir izlence hazırlanmamış.</p>
          <Link href="/izlenceler" className="text-blue-600 hover:underline text-sm">← Listeye Dön</Link>
        </div>
      </div>
    );
  }

  const c = izlence.icerik as Record<string, any>;

  return (
    <div className="bg-white min-h-screen">
      {/* Yazdırma kontrolü — sadece ekranda görünür */}
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <Link href="/izlenceler" className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-800 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Listeye Dön
        </Link>
        <button
          onClick={() => typeof window !== 'undefined' && window.print()}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Printer className="w-4 h-4" />
          Yazdır / PDF
        </button>
      </div>

      {/* İzlence İçeriği */}
      <div className="max-w-4xl mx-auto px-8 py-10 print:px-6 print:py-4">
        {/* Başlık */}
        <div className="text-center mb-8 border-b-2 border-slate-800 pb-6">
          <h1 className="text-lg font-bold text-slate-900 mb-1">Eskişehir Osmangazi Üniversitesi</h1>
          <h2 className="text-base font-semibold text-slate-800 mb-1">İlahiyat Fakültesi</h2>
          <h3 className="text-xl font-bold text-slate-900 mt-3">DERS İZLENCESİ</h3>
        </div>

        {/* Temel Bilgiler */}
        <table className="w-full border-collapse border border-slate-400 mb-6 text-sm">
          <tbody>
            <tr>
              <td className="border border-slate-400 px-3 py-2 font-semibold bg-slate-50 w-40">Ders Kodu</td>
              <td className="border border-slate-400 px-3 py-2 w-60">{ders.kod}</td>
              <td className="border border-slate-400 px-3 py-2 font-semibold bg-slate-50 w-40">Ders Adı</td>
              <td className="border border-slate-400 px-3 py-2">{ders.ad}</td>
            </tr>
            <tr>
              <td className="border border-slate-400 px-3 py-2 font-semibold bg-slate-50">Öğretim Elemanı</td>
              <td className="border border-slate-400 px-3 py-2">{c.ogretimElemani || ''}</td>
              <td className="border border-slate-400 px-3 py-2 font-semibold bg-slate-50">E-Posta</td>
              <td className="border border-slate-400 px-3 py-2">{c.eposta || ''}</td>
            </tr>
            <tr>
              <td className="border border-slate-400 px-3 py-2 font-semibold bg-slate-50">Görüşme Gün/Saati</td>
              <td className="border border-slate-400 px-3 py-2">{c.gorușmeGunSaati || ''}</td>
              <td className="border border-slate-400 px-3 py-2 font-semibold bg-slate-50">Ofis</td>
              <td className="border border-slate-400 px-3 py-2">{c.ofis || ''}</td>
            </tr>
          </tbody>
        </table>

        {/* Ders Hakkında */}
        <h4 className="font-bold text-slate-800 mb-2 text-sm border-b border-slate-300 pb-1">Ders Hakkında</h4>
        <table className="w-full border-collapse border border-slate-400 mb-6 text-sm">
          <tbody>
            <tr>
              <td className="border border-slate-400 px-3 py-2 font-semibold bg-slate-50 w-40">Dönem</td>
              <td className="border border-slate-400 px-3 py-2">{c.donem || ''}</td>
              <td className="border border-slate-400 px-3 py-2 font-semibold bg-slate-50 w-40">Gün ve Saat</td>
              <td className="border border-slate-400 px-3 py-2">{c.gunSaat || ''}</td>
            </tr>
            <tr>
              <td className="border border-slate-400 px-3 py-2 font-semibold bg-slate-50">Kredi/AKTS</td>
              <td className="border border-slate-400 px-3 py-2">{c.krediAkts || `${ders.kredi}/${ders.akts}`}</td>
              <td className="border border-slate-400 px-3 py-2 font-semibold bg-slate-50">Eğitim Dili</td>
              <td className="border border-slate-400 px-3 py-2">{c.egitimDili || 'Türkçe'}</td>
            </tr>
            <tr>
              <td className="border border-slate-400 px-3 py-2 font-semibold bg-slate-50">Öğretim Türü</td>
              <td className="border border-slate-400 px-3 py-2">{c.ogretimTuru || ''}</td>
              <td className="border border-slate-400 px-3 py-2 font-semibold bg-slate-50">Derslik</td>
              <td className="border border-slate-400 px-3 py-2">{c.derslik || ''}</td>
            </tr>
            <tr>
              <td className="border border-slate-400 px-3 py-2 font-semibold bg-slate-50">Ders Türü</td>
              <td colSpan={3} className="border border-slate-400 px-3 py-2">{ders.tur}</td>
            </tr>
          </tbody>
        </table>

        {/* Önkoşul */}
        {c.onkosul && (
          <>
            <h4 className="font-bold text-slate-800 mb-2 text-sm border-b border-slate-300 pb-1">Önkoşul Dersleri</h4>
            <p className="text-sm text-slate-700 mb-6 whitespace-pre-wrap">{c.onkosul}</p>
          </>
        )}

        {/* Dersin Amacı */}
        {c.amac && (
          <>
            <h4 className="font-bold text-slate-800 mb-2 text-sm border-b border-slate-300 pb-1">Dersin Amacı</h4>
            <p className="text-sm text-slate-700 mb-6 whitespace-pre-wrap">{c.amac}</p>
          </>
        )}

        {/* Öğrenim Çıktıları */}
        {c.ogranimCiktilari && c.ogranimCiktilari.length > 0 && (
          <>
            <h4 className="font-bold text-slate-800 mb-2 text-sm border-b border-slate-300 pb-1">Dersin Öğrenim Çıktıları</h4>
            <table className="w-full border-collapse border border-slate-400 mb-6 text-sm">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-400 px-2 py-1 text-left w-8">#</th>
                  <th className="border border-slate-400 px-2 py-1 text-left">Öğrenim Çıktısı</th>
                  <th className="border border-slate-400 px-2 py-1 text-center">Yeterlilik</th>
                  <th className="border border-slate-400 px-2 py-1 text-center">Öğretim Yöntemleri</th>
                  <th className="border border-slate-400 px-2 py-1 text-center">Ölçme Yöntemleri</th>
                </tr>
              </thead>
              <tbody>
                {c.ogranimCiktilari.map((row: any, i: number) => (
                  <tr key={i}>
                    <td className="border border-slate-400 px-2 py-1 text-center">{i + 1}</td>
                    <td className="border border-slate-400 px-2 py-1">{row.cikti}</td>
                    <td className="border border-slate-400 px-2 py-1 text-center">{row.yeterlilik}</td>
                    <td className="border border-slate-400 px-2 py-1 text-center">{row.ogretimYontemi}</td>
                    <td className="border border-slate-400 px-2 py-1 text-center">{row.olcmeYontemi}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* Kaynaklar */}
        {(c.temelKaynaklar || c.yardimciKaynaklar) && (
          <>
            <h4 className="font-bold text-slate-800 mb-2 text-sm border-b border-slate-300 pb-1">Ders Kaynakları</h4>
            <table className="w-full border-collapse border border-slate-400 mb-6 text-sm">
              <tbody>
                <tr>
                  <td className="border border-slate-400 px-3 py-2 font-semibold bg-slate-50 w-48">Temel Ders Kitabı</td>
                  <td className="border border-slate-400 px-3 py-2">{c.temelKaynaklar || ''}</td>
                </tr>
                <tr>
                  <td className="border border-slate-400 px-3 py-2 font-semibold bg-slate-50">Yardımcı Kaynaklar</td>
                  <td className="border border-slate-400 px-3 py-2">{c.yardimciKaynaklar || ''}</td>
                </tr>
              </tbody>
            </table>
          </>
        )}

        {/* Haftalık İçerik */}
        {c.haftalikIcerik && c.haftalikIcerik.length > 0 && (
          <>
            <h4 className="font-bold text-slate-800 mb-2 text-sm border-b border-slate-300 pb-1">Haftalık Ders İçeriği</h4>
            <table className="w-full border-collapse border border-slate-400 mb-6 text-sm">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-400 px-2 py-1 text-center w-16">Hafta</th>
                  <th className="border border-slate-400 px-2 py-1 text-left">Konu Başlığı</th>
                  <th className="border border-slate-400 px-2 py-1 text-left">İlgili Kaynaklar</th>
                  <th className="border border-slate-400 px-2 py-1 text-center w-24">İş Yükü (Saat)</th>
                </tr>
              </thead>
              <tbody>
                {c.haftalikIcerik.map((row: any, i: number) => (
                  <tr key={i} className={row.isArasinav || row.isFinal ? 'bg-amber-50' : ''}>
                    <td className="border border-slate-400 px-2 py-1 text-center font-medium">
                      {row.isArasinav ? 'Arasınav' : row.isFinal ? 'Final' : i + 1}
                    </td>
                    <td className="border border-slate-400 px-2 py-1">{row.konu}</td>
                    <td className="border border-slate-400 px-2 py-1">{row.kaynaklar}</td>
                    <td className="border border-slate-400 px-2 py-1 text-center">{row.isYuku}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* Değerlendirme */}
        {c.degerlendirme && c.degerlendirme.length > 0 && (
          <>
            <h4 className="font-bold text-slate-800 mb-2 text-sm border-b border-slate-300 pb-1">Ders Değerlendirme</h4>
            <table className="w-full border-collapse border border-slate-400 mb-6 text-sm">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-400 px-2 py-1 text-left">Değerlendirme Türü</th>
                  <th className="border border-slate-400 px-2 py-1 text-left">Açıklama</th>
                  <th className="border border-slate-400 px-2 py-1 text-center w-16">%</th>
                </tr>
              </thead>
              <tbody>
                {c.degerlendirme.map((row: any, i: number) => (
                  <tr key={i}>
                    <td className="border border-slate-400 px-2 py-1 font-medium">{row.tur}</td>
                    <td className="border border-slate-400 px-2 py-1">{row.aciklama}</td>
                    <td className="border border-slate-400 px-2 py-1 text-center">{row.yuzde}</td>
                  </tr>
                ))}
                <tr className="bg-slate-100 font-semibold">
                  <td className="border border-slate-400 px-2 py-1" colSpan={2}>Toplam</td>
                  <td className="border border-slate-400 px-2 py-1 text-center">100</td>
                </tr>
                {c.harfNotu && (
                  <tr>
                    <td className="border border-slate-400 px-2 py-1 font-semibold">Harf Notu</td>
                    <td colSpan={2} className="border border-slate-400 px-2 py-1 text-xs">{c.harfNotu}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </>
        )}

        {/* AKTS İş Yükü */}
        {c.aktsIsYuku && c.aktsIsYuku.length > 0 && (
          <>
            <h4 className="font-bold text-slate-800 mb-2 text-sm border-b border-slate-300 pb-1">AKTS - İş Yükü Tablosu</h4>
            <table className="w-full border-collapse border border-slate-400 mb-6 text-sm">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-400 px-2 py-1 text-left">Etkinlikler</th>
                  <th className="border border-slate-400 px-2 py-1 text-center w-20">Sayısı</th>
                  <th className="border border-slate-400 px-2 py-1 text-center w-24">Süresi (Saat)</th>
                  <th className="border border-slate-400 px-2 py-1 text-center w-32">Toplam İş Yükü</th>
                </tr>
              </thead>
              <tbody>
                {c.aktsIsYuku.map((row: any, i: number) => (
                  <tr key={i}>
                    <td className="border border-slate-400 px-2 py-1">{row.etkinlik}</td>
                    <td className="border border-slate-400 px-2 py-1 text-center">{row.sayisi}</td>
                    <td className="border border-slate-400 px-2 py-1 text-center">{row.suresi}</td>
                    <td className="border border-slate-400 px-2 py-1 text-center">{row.toplam}</td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-semibold">
                  <td colSpan={3} className="border border-slate-400 px-2 py-1 text-right">Toplam İş Yükü</td>
                  <td className="border border-slate-400 px-2 py-1 text-center">{c.aktsToplam}</td>
                </tr>
                <tr className="bg-slate-50 font-semibold">
                  <td colSpan={3} className="border border-slate-400 px-2 py-1 text-right">Toplam İş Yükü / 30</td>
                  <td className="border border-slate-400 px-2 py-1 text-center">{c.aktsBolum30}</td>
                </tr>
                <tr className="bg-slate-100 font-bold">
                  <td colSpan={3} className="border border-slate-400 px-2 py-1 text-right">Dersin AKTS Kredisi</td>
                  <td className="border border-slate-400 px-2 py-1 text-center">{ders.akts}</td>
                </tr>
              </tbody>
            </table>
          </>
        )}

        {/* PÇ-ÖÇ Matrisi */}
        {c.pcOcMatris && (
          <>
            <h4 className="font-bold text-slate-800 mb-2 text-sm border-b border-slate-300 pb-1">
              Dersin Öğrenim Çıktılarının (ÖÇ) Program Çıktıları (PÇ) ile Olan İlişkisi
            </h4>
            <p className="text-xs text-slate-500 mb-2">(5: Çok yüksek, 4: Yüksek, 3: Orta, 2: Düşük, 1: Çok düşük)</p>
            <div className="overflow-x-auto mb-6">
              <table className="border-collapse border border-slate-400 text-xs">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-slate-400 px-2 py-1 text-left min-w-48">PÇ</th>
                    {Array.from({ length: 10 }, (_, i) => (
                      <th key={i} className="border border-slate-400 px-2 py-1 text-center w-10">ÖÇ{i + 1}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {c.pcOcMatris.map((row: any, i: number) => (
                    <tr key={i}>
                      <td className="border border-slate-400 px-2 py-1">{row.pc}</td>
                      {Array.from({ length: 10 }, (_, j) => (
                        <td key={j} className="border border-slate-400 px-1 py-1 text-center">{row[`oc${j + 1}`] || ''}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* DÖÇ-ÖÇ Matrisi */}
        {c.docOcMatris && (
          <>
            <h4 className="font-bold text-slate-800 mb-2 text-sm border-b border-slate-300 pb-1">
              Dersin Öğrenim Çıktılarının (ÖÇ) İAA Disipline Özgü Çıktılar (DÖÇ) ile Olan İlişkisi
            </h4>
            <p className="text-xs text-slate-500 mb-2">(5: Çok yüksek, 4: Yüksek, 3: Orta, 2: Düşük, 1: Çok düşük)</p>
            <div className="overflow-x-auto mb-6">
              <table className="border-collapse border border-slate-400 text-xs">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-slate-400 px-2 py-1 text-center w-8">#</th>
                    <th className="border border-slate-400 px-2 py-1 text-left min-w-64">DÖÇ</th>
                    {Array.from({ length: 10 }, (_, i) => (
                      <th key={i} className="border border-slate-400 px-2 py-1 text-center w-10">ÖÇ{i + 1}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {c.docOcMatris.map((row: any, i: number) => (
                    <tr key={i}>
                      <td className="border border-slate-400 px-1 py-1 text-center">{i + 1}</td>
                      <td className="border border-slate-400 px-2 py-1">{row.doc}</td>
                      {Array.from({ length: 10 }, (_, j) => (
                        <td key={j} className="border border-slate-400 px-1 py-1 text-center">{row[`oc${j + 1}`] || ''}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="mt-8 pt-4 border-t border-slate-200 text-center text-xs text-slate-400">
          Son güncelleme: {izlence.guncelleme_tarihi ? new Date(izlence.guncelleme_tarihi).toLocaleDateString('tr-TR') : '—'}
        </div>
      </div>

      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          body { font-size: 11px; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}
