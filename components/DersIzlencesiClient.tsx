'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { 
  Save, ArrowLeft, Plus, Trash2, 
  BookOpen, Clock, Target, ListChecks, 
  FileText, BarChart3, Settings, ShieldCheck,
  ChevronRight, ChevronLeft
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface Course {
  kod: string;
  ad: string;
  t: number;
  u: number;
  l: number;
  kredi: number;
  akts: number;
  dil: string;
  yariyil: string;
  tur: string;
}

const DEFAULT_POLICIES = `• Ders Süresi ve İşleyişi: Ders toplamda 3 saat sürecek şekilde planlanmıştır ve 1 saatlik iki blok halinde işlenecektir. Bloklar arasında 15 dakikalık bir ara verilecektir.
• Dijital Araçların Kullanımı: Ders sırasında cep telefonu, tablet, dizüstü bilgisayar vb. kişisel elektronik/dijital cihazlarla dersin herhangi bir bölümünü kaydedemezsiniz.
• Devam Durumu: Eskişehir Osmangazi Üniversitesi Ön Lisans ve Lisans Eğitim-Öğretim ve Sınav Yönetmeliği 16. Madde gereği "Öğrenci, teorik ders çalışmalarının %70'ine, laboratuvar ve uygulama çalışmalarının %80'ine devam etmek zorundadır."
• Öğrenci Merkezli Öğrenme: Ders, öğrenci merkezli bir yaklaşımla yürütülecektir. Bu kapsamda öğrencilerin katılımı desteklenecek, öğrenme sürecine dair sorumluluk almaları beklenecek ve ders sürecine dair geri bildirimleri alınacaktır.
• Engelli Öğrenci Desteği: Sizin için engel oluşturabilecek durumlarla (görme, işitme vb.) ilgili olarak doğrudan benimle iletişime geçebilirsiniz.
• Sözlü ve Yazılı İletişim Etiği: Sınıf tartışmaları sırasında birbirinize saygı göstererek ve nefret söylemi kullanmadan yorumlar yapabilirsiniz.
• Yapay Zeka Kullanımı: Bu derste yapay zeka araçları sınırlı ve sorumlu biçimde kullanılabilir.`;

export default function DersIzlencesiClient({ 
  dersler, 
  izlenceler, 
  currentUserId,
  defaultOgretimElemani,
  defaultEposta
}: { 
  dersler: Course[]; 
  izlenceler: any[];
  currentUserId: string;
  defaultOgretimElemani: string;
  defaultEposta: string;
}) {
  const [activeStep, setActiveStep] = useState(1);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [formData, setFormData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // URL'den ders kodu kontrolü
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const kod = urlParams.get('kod');
    if (kod && dersler.length > 0) {
      const ders = dersler.find(d => d.kod === kod);
      if (ders) handleCourseSelect(ders);
    }
  }, [dersler]);

  const handleCourseSelect = (course: Course) => {
    setSelectedCourse(course);
    const existing = izlenceler.find(i => i.ders_id === course.kod);
    
    if (existing && Object.keys(existing.icerik).length > 0) {
      setFormData(existing.icerik);
    } else {
      setFormData({
        ogretimElemani: defaultOgretimElemani,
        eposta: defaultEposta,
        gorusmeGunSaat: '',
        ofis: '',
        donem: course.yariyil,
        gunSaat: '',
        egitimDili: course.dil || 'Türkçe',
        ogretimTuru: 'Örgün Öğretim',
        derslik: '',
        onkosul: '-',
        amac: '',
        ogrenimCiktilari: Array(5).fill({ cikti: '', bilgi: false, beceri: false, yetkinlik: false, ogretim: '', olcme: '' }),
        temelKaynaklar: '',
        yardimciKaynaklar: '',
        politikalar: DEFAULT_POLICIES,
        haftalikIcerik: Array(14).fill({ hafta: '', konu: '', kaynaklar: '', isYuku: '' }),
        degerlendirme: [
          { tur: 'Ara Sınav', aciklama: '', yuzde: 40 },
          { tur: 'Final', aciklama: '', yuzde: 60 }
        ],
        harfNotu: 'AA: 90-100 / BA: 85-89 / BB: 80-84 / CB: 75-79 / CC: 70-74 / DC: 65-69 / DD: 60-64',
        aktsIsYuku: [
          { etkinlik: 'Ders Süresi', sayisi: 14, suresi: 3, toplam: 42 },
          { etkinlik: 'Sınıf Dışı Çalışma', sayisi: 14, suresi: 2, toplam: 28 }
        ],
        pcOcMatris: Array(12).fill(0).map((_, i) => ({ pc: `PÇ${i+1}`, oc1: '', oc2: '', oc3: '', oc4: '', oc5: '' })),
        docOcMatris: Array(14).fill(0).map((_, i) => ({ doc: `DÖÇ${i+1}`, oc1: '', oc2: '', oc3: '', oc4: '', oc5: '' }))
      });
    }
  };

  const handleSave = async () => {
    if (!selectedCourse) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('ders_izlenceleri')
        .upsert({
          ders_id: selectedCourse.kod,
          hoca_id: currentUserId,
          icerik: formData,
          guncelleme_tarihi: new Date().toISOString()
        }, { onConflict: 'ders_id, hoca_id' });

      if (error) throw error;
      toast.success('İzlence başarıyla kaydedildi!');
    } catch (err) {
      console.error(err);
      toast.error('Kaydedilirken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  if (!selectedCourse) {
    return (
      <div className="p-8 text-center bg-slate-50 min-h-screen flex flex-col items-center justify-center">
        <div className="bg-white p-10 rounded-3xl shadow-xl max-w-lg border border-slate-200">
          <GraduationCap className="w-20 h-20 text-blue-600 mx-auto mb-6" />
          <h2 className="text-2xl font-black text-slate-800 mb-4 tracking-tight">Ders İzlencesi Editörü</h2>
          <p className="text-slate-500 mb-8 leading-relaxed">
            Lütfen düzenlemek istediğiniz dersi eğitim planından seçin.
          </p>
          <Link href="/izlenceler" className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 py-4 rounded-2xl transition-all hover:scale-105 active:scale-95 shadow-lg">
            <ArrowLeft className="w-5 h-5" />
            Eğitim Planına Git
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Step Navigation - Premium Sticky Header */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => window.history.back()} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <h1 className="text-sm font-black text-slate-400 uppercase tracking-widest">{selectedCourse.kod}</h1>
            <h2 className="text-lg font-bold text-slate-800">{selectedCourse.ad}</h2>
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
          {[1, 2, 3, 4, 5].map((step) => (
            <button
              key={step}
              onClick={() => setActiveStep(step)}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                activeStep === step 
                ? 'bg-blue-600 text-white shadow-md scale-105' 
                : 'text-slate-500 hover:bg-white'
              }`}
            >
              SAYFA {step}
            </button>
          ))}
        </div>

        <button
          onClick={handleSave}
          disabled={loading}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-50"
        >
          <Save className="w-5 h-5" />
          {loading ? 'Kaydediliyor...' : 'KAYDET'}
        </button>
      </div>

      <div className="flex-1 max-w-5xl mx-auto w-full px-4 py-10">
        {/* Sayfa 1: Temel Bilgiler (Foto 5) */}
        {activeStep === 1 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-3 mb-8 border-b border-slate-100 pb-4">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="text-xl font-black text-slate-800 tracking-tight">GENEL BİLGİLER</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Öğretim Elemanı</label>
                  <input
                    className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl px-5 py-4 font-bold text-slate-700 transition-all outline-none"
                    value={formData.ogretimElemani}
                    onChange={e => setFormData({...formData, ogretimElemani: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">E-Posta</label>
                  <input
                    className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl px-5 py-4 font-bold text-slate-700 transition-all outline-none"
                    value={formData.eposta}
                    onChange={e => setFormData({...formData, eposta: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Görüşme Gün ve Saatleri</label>
                  <input
                    className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl px-5 py-4 font-bold text-slate-700 transition-all outline-none"
                    value={formData.gorusmeGunSaat}
                    onChange={e => setFormData({...formData, gorusmeGunSaat: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Ofis</label>
                  <input
                    className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl px-5 py-4 font-bold text-slate-700 transition-all outline-none"
                    value={formData.ofis}
                    onChange={e => setFormData({...formData, ofis: e.target.value})}
                  />
                </div>
              </div>
            </section>

            <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-3 mb-8 border-b border-slate-100 pb-4">
                <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                  <Target className="w-5 h-5 text-amber-600" />
                </div>
                <h3 className="text-xl font-black text-slate-800 tracking-tight">DERS HAKKINDA</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Öğretim Türü</label>
                  <select
                    className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl px-5 py-4 font-bold text-slate-700 transition-all outline-none"
                    value={formData.ogretimTuru}
                    onChange={e => setFormData({...formData, ogretimTuru: e.target.value})}
                  >
                    <option>Örgün Öğretim</option>
                    <option>İkinci Öğretim</option>
                    <option>Uzaktan Eğitim</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Eğitim Dili</label>
                  <input
                    className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl px-5 py-4 font-bold text-slate-700 transition-all outline-none"
                    value={formData.egitimDili}
                    onChange={e => setFormData({...formData, egitimDili: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Derslik</label>
                  <input
                    className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl px-5 py-4 font-bold text-slate-700 transition-all outline-none"
                    value={formData.derslik}
                    onChange={e => setFormData({...formData, derslik: e.target.value})}
                  />
                </div>
              </div>

              <div className="mt-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Dersin Amacı</label>
                  <textarea
                    rows={4}
                    className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl px-5 py-4 font-bold text-slate-700 transition-all outline-none"
                    value={formData.amac}
                    onChange={e => setFormData({...formData, amac: e.target.value})}
                  />
                </div>
              </div>
            </section>
          </div>
        )}

        {/* Sayfa 2: Kaynaklar ve Politikalar (Foto 4) */}
        {activeStep === 2 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-3 mb-8 border-b border-slate-100 pb-4">
                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-indigo-600" />
                </div>
                <h3 className="text-xl font-black text-slate-800 tracking-tight">KAYNAKLAR</h3>
              </div>
              
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Temel Ders Kitabı</label>
                  <textarea
                    rows={3}
                    className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl px-5 py-4 font-bold text-slate-700 transition-all outline-none"
                    value={formData.temelKaynaklar}
                    onChange={e => setFormData({...formData, temelKaynaklar: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Yardımcı Kaynaklar</label>
                  <textarea
                    rows={3}
                    className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl px-5 py-4 font-bold text-slate-700 transition-all outline-none"
                    value={formData.yardimciKaynaklar}
                    onChange={e => setFormData({...formData, yardimciKaynaklar: e.target.value})}
                  />
                </div>
              </div>
            </section>

            <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-3 mb-8 border-b border-slate-100 pb-4">
                <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-rose-600" />
                </div>
                <h3 className="text-xl font-black text-slate-800 tracking-tight">DERS POLİTİKALARI</h3>
              </div>
              <textarea
                rows={15}
                className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl px-5 py-4 font-medium text-slate-700 transition-all outline-none text-sm leading-relaxed"
                value={formData.politikalar}
                onChange={e => setFormData({...formData, politikalar: e.target.value})}
              />
            </section>
          </div>
        )}

        {/* Sayfa 3: Haftalık İçerik ve Değerlendirme (Foto 1) */}
        {activeStep === 3 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="flex items-center gap-3 mb-8 border-b border-slate-100 pb-4">
                <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <Clock className="w-5 h-5 text-emerald-600" />
                </div>
                <h3 className="text-xl font-black text-slate-800 tracking-tight">HAFTALIK DERS İÇERİĞİ</h3>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-left">
                      <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-20">Hafta</th>
                      <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Konu Başlığı</th>
                      <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">İlgili Kaynaklar</th>
                      <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-32">İş Yükü</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {formData.haftalikIcerik.map((row: any, i: number) => (
                      <tr key={i}>
                        <td className="p-2">
                          <input 
                            className="w-full bg-transparent p-2 font-bold text-center border-b border-transparent focus:border-blue-500 outline-none"
                            value={row.hafta || i + 1}
                            onChange={e => {
                              const newIcerik = [...formData.haftalikIcerik];
                              newIcerik[i].hafta = e.target.value;
                              setFormData({...formData, haftalikIcerik: newIcerik});
                            }}
                          />
                        </td>
                        <td className="p-2">
                          <input 
                            className="w-full bg-transparent p-2 font-medium border-b border-transparent focus:border-blue-500 outline-none"
                            value={row.konu}
                            onChange={e => {
                              const newIcerik = [...formData.haftalikIcerik];
                              newIcerik[i].konu = e.target.value;
                              setFormData({...formData, haftalikIcerik: newIcerik});
                            }}
                          />
                        </td>
                        <td className="p-2">
                          <input 
                            className="w-full bg-transparent p-2 font-medium border-b border-transparent focus:border-blue-500 outline-none"
                            value={row.kaynaklar}
                            onChange={e => {
                              const newIcerik = [...formData.haftalikIcerik];
                              newIcerik[i].kaynaklar = e.target.value;
                              setFormData({...formData, haftalikIcerik: newIcerik});
                            }}
                          />
                        </td>
                        <td className="p-2 text-center">
                          <input 
                            className="w-full bg-transparent p-2 font-bold text-center border-b border-transparent focus:border-blue-500 outline-none"
                            value={row.isYuku}
                            onChange={e => {
                              const newIcerik = [...formData.haftalikIcerik];
                              newIcerik[i].isYuku = e.target.value;
                              setFormData({...formData, haftalikIcerik: newIcerik});
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* Diğer adımlar (4 ve 5) benzer yapıda devam edecek */}
        
        {/* Navigation Buttons */}
        <div className="mt-12 flex items-center justify-between">
          <button
            onClick={() => setActiveStep(prev => Math.max(1, prev - 1))}
            disabled={activeStep === 1}
            className="flex items-center gap-2 text-slate-500 hover:text-blue-600 font-bold px-4 py-2 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" /> Önceki Sayfa
          </button>
          
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map(s => (
              <div key={s} className={`w-2 h-2 rounded-full transition-all ${activeStep === s ? 'bg-blue-600 w-8' : 'bg-slate-300'}`} />
            ))}
          </div>

          <button
            onClick={() => setActiveStep(prev => Math.min(5, prev + 1))}
            disabled={activeStep === 5}
            className="flex items-center gap-2 text-slate-500 hover:text-blue-600 font-bold px-4 py-2 disabled:opacity-30 transition-colors"
          >
            Sonraki Sayfa <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
