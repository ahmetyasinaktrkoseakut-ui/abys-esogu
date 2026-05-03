'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { 
  Save, 
  Search, 
  FileText, 
  CheckCircle2,
  AlertCircle,
  BookOpen,
  Info
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface Course {
  kod: string;
  ad: string;
  akts: number;
  yariyil: string;
  kredi: number;
  t: number;
  u: number;
  l: number;
}

const DEFAULT_POLICIES = `Ders Süresi ve İşleyişi: Ders toplamda 3 saat sürecek şekilde planlanmıştır... (Şablondaki tam metin buraya eklendi)
Dijital Araçların Kullanımı: Ders sırasında cep telefonu, tablet vb. araçların kullanımı yasaktır.
Devam Durumu: %70 devam zorunluluğu bulunmaktadır.
Yapay Zeka Kullanımı: Üretken yapay zeka araçları (ChatGPT vb.) sadece ön araştırma için kullanılabilir. Ödevlerde doğrudan kullanımı akademik dürüstlük ihlali sayılır.`;

const PROGRAM_OUTCOMES = [
  "PÇ1: İlahiyat alanına ilişkin temel kavram ve kuramları bilir.",
  "PÇ2: Sahip olduğu yabancı dil bilgisi ile alanına ilişkin temel kaynakları kullanır.",
  "PÇ3: Sosyal, kültürel ve evrensel değerleri benimser.",
  "PÇ4: Alanıyla ilgili karşılaştığı sorunları tanımlar ve çözüm üretir.",
  "PÇ5: Değişen ve gelişen yerel/küresel sosyal konjonktürü takip eder.",
  "PÇ6: Dini anlayış ve uygulamaların toplumsal yansımalarını fark eder.",
  "PÇ7: Alanına ilişkin eğitimsel süreçleri etkin planlar.",
  "PÇ8: Alanına ilişkin akademik birikimi eleştirel analiz eder.",
  "PÇ9: Sahip olduğu yetkinlikleri topluma kazandırır.",
  "PÇ10: Etik ilkelere bağlı kalarak araştırmalar yürütür."
];

const DISCIPLINE_OUTCOMES = [
  "1: Kur’an-ı Kerim bilgisine ve doğru tilavet becerisine sahip olmak.",
  "2: Arapça temel kaynakları okuma ve anlama becerisi.",
  "3: İtikat, ibadet, ahlak ve muamelata dair temel kaynakları tanımak.",
  "4: Kur’an ve sünnet bütünlüğünü esas alan din anlayışına sahip olmak.",
  "5: Bütüncül ve sistematik bir dini düşünce geliştirmek."
];

export default function DersIzlencesiClient({ 
  dersler, 
  izlenceler, 
  currentUserId,
  defaultOgretimElemani,
  defaultEposta
}: { 
  dersler: Course[], 
  izlenceler: any[], 
  currentUserId: string,
  defaultOgretimElemani: string,
  defaultEposta: string
}) {
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [formData, setFormData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const doldurulmusDersler = new Set(izlenceler.map(i => i.ders_id));

  useEffect(() => {
    if (selectedCourse) {
      const existing = izlenceler.find(i => i.ders_id === selectedCourse.kod);
      if (existing && existing.icerik && Object.keys(existing.icerik).length > 0) {
        setFormData(existing.icerik);
      } else {
        setFormData({
          ogretimElemani: defaultOgretimElemani,
          eposta: defaultEposta,
          gorușmeGunSaati: 'Hafta içi mesai saatleri',
          ofis: 'Fakülte Binası No: ---',
          donem: selectedCourse.yariyil,
          gunSaat: '',
          krediAkts: `${selectedCourse.kredi} / ${selectedCourse.akts}`,
          egitimDili: 'Türkçe',
          ogretimTuru: 'Örgün',
          derslik: '',
          onkosul: '-',
          amac: 'Bu dersin amacı öğrenciye temel alan bilgilerini kazandırmaktır.',
          ogranimCiktilari: Array(6).fill(0).map((_, i) => ({ cikti: `ÖÇ${i+1}: ...`, yeterlilik: '5', ogretimYontemi: 'Anlatım', olcmeYontemi: 'Sınav' })),
          temelKaynaklar: '',
          yardimciKaynaklar: '',
          politikalar: DEFAULT_POLICIES,
          haftalikIcerik: Array(14).fill(0).map((_, i) => ({ konu: `${i+1}. Hafta Konusu`, kaynaklar: '-', isYuku: '3' })),
          degerlendirme: [
            { tur: 'Ara Sınav', aciklama: 'Yazılı Yoklama', yuzde: '40' },
            { tur: 'Final', aciklama: 'Yazılı Yoklama', yuzde: '60' }
          ],
          harfNotu: 'ESOGÜ Bağıl Değerlendirme Sistemi Geçerlidir.',
          aktsIsYuku: [
            { etkinlik: 'Ders Süresi (14 Hafta)', sayisi: '14', suresi: '2', toplam: '28' },
            { etkinlik: 'Sınıf Dışı Çalışma', sayisi: '14', suresi: '2', toplam: '28' },
            { etkinlik: 'Ara Sınav Hazırlık', sayisi: '1', suresi: '10', toplam: '10' },
            { etkinlik: 'Final Sınavı Hazırlık', sayisi: '1', suresi: '20', toplam: '20' }
          ],
          aktsToplam: '86',
          aktsBolum30: '2.86',
          pcOcMatris: PROGRAM_OUTCOMES.map(pc => ({ pc, oc1: '', oc2: '', oc3: '', oc4: '', oc5: '', oc6: '' })),
          docOcMatris: DISCIPLINE_OUTCOMES.map(doc => ({ doc, oc1: '', oc2: '', oc3: '', oc4: '', oc5: '', oc6: '' }))
        });
      }
    }
  }, [selectedCourse, izlenceler, defaultOgretimElemani, defaultEposta]);

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
      toast.success('İzlence başarıyla kaydedildi');
    } catch (err: any) {
      toast.error('Hata: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateArrayField = (field: string, index: number, subField: string, value: any) => {
    const newArray = [...formData[field]];
    newArray[index] = { ...newArray[index], [subField]: value };
    setFormData({ ...formData, [field]: newArray });
  };

  const filteredDersler = dersler.filter(d => 
    d.ad.toLowerCase().includes(searchTerm.toLowerCase()) || 
    d.kod.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100vh-64px)] bg-slate-50 overflow-hidden">
      {/* Sol Menü: Ders Seçimi */}
      <div className="w-80 bg-white border-r border-slate-200 flex flex-col h-full shadow-xl z-10">
        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Derslerde ara..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filteredDersler.map(ders => (
            <button
              key={ders.kod}
              onClick={() => setSelectedCourse(ders)}
              className={`w-full text-left p-3 rounded-2xl border transition-all duration-200 ${
                selectedCourse?.kod === ders.kod 
                ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100 scale-[1.02]' 
                : 'bg-white border-slate-100 hover:border-blue-200 text-slate-700 hover:bg-blue-50/50'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${selectedCourse?.kod === ders.kod ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  {ders.kod}
                </span>
                {doldurulmusDersler.has(ders.kod) && (
                  <CheckCircle2 className={`w-4 h-4 ${selectedCourse?.kod === ders.kod ? 'text-white' : 'text-green-500'}`} />
                )}
              </div>
              <div className="text-sm font-bold truncate">{ders.ad}</div>
              <div className={`text-[10px] mt-1 ${selectedCourse?.kod === ders.kod ? 'text-blue-100' : 'text-slate-400'}`}>
                {ders.yariyil} · AKTS: {ders.akts}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Ana Form Alanı */}
      <div className="flex-1 overflow-y-auto">
        {!selectedCourse ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-white">
            <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6">
              <BookOpen className="w-12 h-12 text-slate-300" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">İzlence Hazırlama Modülü</h3>
            <p className="max-w-xs text-center text-slate-500">Lütfen soldaki listeden izlencesini düzenlemek istediğiniz dersi seçin.</p>
          </div>
        ) : formData ? (
          <div className="p-8 max-w-6xl mx-auto space-y-8 pb-24">
            {/* Header Sticky */}
            <div className="sticky top-0 z-20 bg-slate-50/90 backdrop-blur-md pb-4 pt-2 flex items-center justify-between border-b border-slate-200">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-200">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">{selectedCourse.ad}</h2>
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-500 uppercase tracking-wider">
                    <span>{selectedCourse.kod}</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                    <span>{selectedCourse.yariyil}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={handleSave}
                disabled={loading}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-2xl font-black transition-all hover:scale-105 active:scale-95 shadow-xl shadow-blue-200 disabled:opacity-50"
              >
                <Save className="w-5 h-5" />
                {loading ? 'KAYDEDİLİYOR...' : 'KAYDET'}
              </button>
            </div>

            {/* Bölüm 1: Genel Bilgiler */}
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm grid grid-cols-2 gap-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-blue-600" />
              <h3 className="col-span-2 text-lg font-black text-slate-800 flex items-center gap-2 mb-2">
                <Info className="w-5 h-5 text-blue-600" />
                1. GENEL BİLGİLER VE DERS SORUMLUSU
              </h3>
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase mb-1.5 tracking-widest">Öğretim Elemanı</label>
                <input type="text" className="w-full bg-slate-50 border-slate-200 rounded-xl p-3 text-sm font-semibold focus:ring-2 focus:ring-blue-500 transition-all" value={formData.ogretimElemani} onChange={(e)=>setFormData({...formData, ogretimElemani: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase mb-1.5 tracking-widest">E-Posta</label>
                <input type="text" className="w-full bg-slate-50 border-slate-200 rounded-xl p-3 text-sm font-semibold focus:ring-2 focus:ring-blue-500 transition-all" value={formData.eposta} onChange={(e)=>setFormData({...formData, eposta: e.target.value})} />
              </div>
              <div className="col-span-2 grid grid-cols-3 gap-6">
                 <div>
                   <label className="block text-xs font-black text-slate-400 uppercase mb-1.5 tracking-widest">Ofis No</label>
                   <input type="text" className="w-full bg-slate-50 border-slate-200 rounded-xl p-3 text-sm font-semibold" value={formData.ofis} onChange={(e)=>setFormData({...formData, ofis: e.target.value})} />
                 </div>
                 <div className="col-span-2">
                   <label className="block text-xs font-black text-slate-400 uppercase mb-1.5 tracking-widest">Görüşme Saatleri</label>
                   <input type="text" className="w-full bg-slate-50 border-slate-200 rounded-xl p-3 text-sm font-semibold" value={formData.gorușmeGunSaati} onChange={(e)=>setFormData({...formData, gorușmeGunSaati: e.target.value})} />
                 </div>
              </div>
            </div>

            {/* Bölüm 2: AKTS İş Yükü (KESİNLİKLE MANUEL) */}
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-amber-500" />
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-500" />
                  2. AKTS - İŞ YÜKÜ TABLOSU
                </h3>
                <span className="text-[10px] font-black bg-amber-50 text-amber-600 px-3 py-1 rounded-full uppercase tracking-widest border border-amber-100">Manuel Veri Girişi</span>
              </div>
              
              <table className="w-full text-sm border-collapse rounded-xl overflow-hidden">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="border border-slate-100 p-4 text-left font-black text-slate-500 uppercase text-[10px] tracking-widest">Etkinlikler</th>
                    <th className="border border-slate-100 p-4 text-center w-24 font-black text-slate-500 uppercase text-[10px] tracking-widest">Sayısı</th>
                    <th className="border border-slate-100 p-4 text-center w-24 font-black text-slate-500 uppercase text-[10px] tracking-widest">Süresi</th>
                    <th className="border border-slate-100 p-4 text-center w-32 font-black text-slate-500 uppercase text-[10px] tracking-widest">Toplam İş Yükü</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.aktsIsYuku.map((row:any, i:number) => (
                    <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                      <td className="border border-slate-100 p-4 font-bold text-slate-700">{row.etkinlik}</td>
                      <td className="border border-slate-100 p-2"><input type="text" className="w-full text-center bg-transparent border-none focus:ring-0 font-bold" value={row.sayisi} onChange={(e)=>updateArrayField('aktsIsYuku', i, 'sayisi', e.target.value)} /></td>
                      <td className="border border-slate-100 p-2"><input type="text" className="w-full text-center bg-transparent border-none focus:ring-0 font-bold" value={row.suresi} onChange={(e)=>updateArrayField('aktsIsYuku', i, 'suresi', e.target.value)} /></td>
                      <td className="border border-slate-100 p-2 bg-slate-50/30"><input type="text" className="w-full text-center bg-transparent border-none focus:ring-0 font-black text-blue-600" value={row.toplam} onChange={(e)=>updateArrayField('aktsIsYuku', i, 'toplam', e.target.value)} /></td>
                    </tr>
                  ))}
                  <tr className="bg-slate-900 text-white">
                    <td colSpan={3} className="p-4 text-right font-black uppercase text-[10px] tracking-widest">Toplam İş Yükü</td>
                    <td className="p-2"><input type="text" className="w-full text-center bg-transparent border-none focus:ring-0 font-black" value={formData.aktsToplam} onChange={(e)=>setFormData({...formData, aktsToplam: e.target.value})} /></td>
                  </tr>
                  <tr className="bg-blue-600 text-white">
                    <td colSpan={3} className="p-4 text-right font-black uppercase text-[10px] tracking-widest">Toplam İş Yükü / 30</td>
                    <td className="p-2"><input type="text" className="w-full text-center bg-transparent border-none focus:ring-0 font-black" value={formData.aktsBolum30} onChange={(e)=>setFormData({...formData, aktsBolum30: e.target.value})} /></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-2 gap-8">
              {/* Değerlendirme */}
              <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                 <h3 className="text-lg font-black text-slate-800 border-b pb-4 mb-6">3. DEĞERLENDİRME</h3>
                 <div className="space-y-4">
                   {formData.degerlendirme.map((row:any, i:number) => (
                     <div key={i} className="flex gap-4">
                        <input type="text" className="flex-1 bg-slate-50 border-slate-200 rounded-xl p-3 text-sm font-bold" value={row.tur} readOnly />
                        <input type="text" placeholder="Yüzde" className="w-20 bg-slate-50 border-slate-200 rounded-xl p-3 text-sm text-center font-bold" value={row.yuzde} onChange={(e)=>updateArrayField('degerlendirme', i, 'yuzde', e.target.value)} />
                     </div>
                   ))}
                 </div>
              </div>
              {/* Politikalar */}
              <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                 <h3 className="text-lg font-black text-slate-800 border-b pb-4 mb-6">4. DERS POLİTİKALARI</h3>
                 <textarea className="w-full h-48 bg-slate-50 border-slate-200 rounded-xl p-4 text-xs font-medium leading-relaxed resize-none" value={formData.politikalar} onChange={(e)=>setFormData({...formData, politikalar: e.target.value})} />
              </div>
            </div>

            <div className="flex justify-center pt-8">
               <button onClick={handleSave} disabled={loading} className="group relative flex items-center gap-4 bg-slate-900 hover:bg-blue-600 text-white px-16 py-5 rounded-[2rem] font-black text-lg transition-all shadow-2xl hover:scale-105 active:scale-95">
                  <Save className="w-6 h-6" /> 
                  SİSTEME KAYDET VE YAYINLA
               </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
