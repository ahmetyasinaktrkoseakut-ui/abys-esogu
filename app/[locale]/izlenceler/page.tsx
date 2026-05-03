import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { BookOpen, GraduationCap, ChevronRight, FileText } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function IzlencelerPage() {
  const supabase = await createClient();

  const { data: dersler } = await supabase
    .from('dersler')
    .select('*')
    .order('yariyil')
    .order('kod');

  const { data: izlenceler } = await supabase
    .from('ders_izlenceleri')
    .select('ders_id, id, hoca_id')
    .not('icerik', 'eq', '{}');

  const doldurulmusKodlar = new Set(
    (izlenceler || [])
      .filter(i => i.icerik !== null)
      .map(i => i.ders_id)
  );

  // Yarıyıllara göre grupla
  const yariyillar: Record<string, typeof dersler> = {};
  for (const ders of dersler || []) {
    if (!yariyillar[ders.yariyil]) yariyillar[ders.yariyil] = [];
    yariyillar[ders.yariyil]!.push(ders);
  }

  const yariyilSirasi = [
    'I. Yarıyıl', 'II. Yarıyıl', 'III. Yarıyıl', 'IV. Yarıyıl',
    'V. Yarıyıl', 'VI. Yarıyıl', 'VII. Yarıyıl', 'VIII. Yarıyıl'
  ];

  // Sıralı yarıyıl listesi
  const siraliYariyillar = [
    ...yariyilSirasi.filter(y => yariyillar[y]),
    ...Object.keys(yariyillar).filter(y => !yariyilSirasi.includes(y))
  ];

  const toplamDers = dersler?.length ?? 0;
  const doldurulmusDers = doldurulmusKodlar.size;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
              <GraduationCap className="w-8 h-8 text-white" />
            </div>
            <div>
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-widest mb-1">
                Eskişehir Osmangazi Üniversitesi
              </p>
              <h1 className="text-2xl font-bold text-slate-900">
                İlahiyat Fakültesi — Ders İzlenceleri
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                I. Öğretim Programı · 2024–2025 Akademik Yılı
              </p>
            </div>
          </div>

          {/* İstatistikler */}
          <div className="flex gap-6 mt-5 pt-5 border-t border-slate-100">
            <div>
              <span className="text-2xl font-bold text-slate-800">{toplamDers}</span>
              <span className="text-sm text-slate-500 ml-2">Toplam Ders</span>
            </div>
            <div>
              <span className="text-2xl font-bold text-blue-600">{doldurulmusDers}</span>
              <span className="text-sm text-slate-500 ml-2">İzlence Hazır</span>
            </div>
            <div>
              <span className="text-2xl font-bold text-slate-400">{toplamDers - doldurulmusDers}</span>
              <span className="text-sm text-slate-500 ml-2">Bekliyor</span>
            </div>
          </div>
        </div>
      </header>

      {/* İçerik */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="space-y-8">
          {siraliYariyillar.map((yariyil) => {
            const dersListesi = yariyillar[yariyil] || [];
            const zorunlu = dersListesi.filter(d => d.tur !== 'Seçmeli');
            const secmeli = dersListesi.filter(d => d.tur === 'Seçmeli');

            return (
              <section key={yariyil}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                    <BookOpen className="w-4 h-4 text-white" />
                  </div>
                  <h2 className="text-lg font-bold text-slate-800">{yariyil}</h2>
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-xs text-slate-400">{dersListesi.length} ders</span>
                </div>

                {/* Zorunlu Dersler */}
                {zorunlu.length > 0 && (
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm mb-3">
                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
                      <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Zorunlu Dersler</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {zorunlu.map((ders) => {
                        const hasSyllabus = doldurulmusKodlar.has(ders.kod);
                        return (
                          <div key={ders.kod} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors group">
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{ders.kod}</span>
                              <span className={`text-sm font-medium ${hasSyllabus ? 'text-slate-800' : 'text-slate-500'}`}>
                                {ders.ad || 'Ders adı girilmemiş'}
                              </span>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="text-xs text-slate-400 hidden sm:block">
                                AKTS: <span className="font-semibold text-slate-600">{ders.akts}</span>
                              </span>
                              {hasSyllabus ? (
                                <Link
                                  href={`/izlenceler/${ders.kod}`}
                                  className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  İzlenceyi Gör
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </Link>
                              ) : (
                                <span className="text-xs text-slate-300 px-3 py-1.5">Henüz hazırlanmadı</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Seçmeli Dersler */}
                {secmeli.length > 0 && (
                  <div className="bg-white rounded-xl border border-amber-200 overflow-hidden shadow-sm">
                    <div className="px-4 py-2 bg-amber-50 border-b border-amber-200">
                      <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Seçmeli Dersler</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {secmeli.map((ders) => {
                        const hasSyllabus = doldurulmusKodlar.has(ders.kod);
                        return (
                          <div key={ders.kod} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{ders.kod}</span>
                              <span className={`text-sm font-medium ${hasSyllabus ? 'text-slate-800' : 'text-slate-500'}`}>
                                {ders.ad || 'Ders adı girilmemiş'}
                              </span>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="text-xs text-slate-400 hidden sm:block">AKTS: <span className="font-semibold text-slate-600">{ders.akts}</span></span>
                              {hasSyllabus ? (
                                <Link
                                  href={`/izlenceler/${ders.kod}`}
                                  className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  İzlenceyi Gör
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </Link>
                              ) : (
                                <span className="text-xs text-slate-300 px-3 py-1.5">Henüz hazırlanmadı</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>

        <footer className="mt-12 pt-6 border-t border-slate-200 text-center">
          <p className="text-xs text-slate-400">
            Eskişehir Osmangazi Üniversitesi İlahiyat Fakültesi · Akreditasyon Bilgi Yönetim Sistemi
          </p>
        </footer>
      </main>
    </div>
  );
}
