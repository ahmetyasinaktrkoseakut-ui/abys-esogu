'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { 
  Save, 
  ChevronRight, 
  Search, 
  FileText, 
  Printer, 
  Plus, 
  Trash2, 
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface Course {
  kod: string;
  ad: string;
  akts: number;
  yariyil: string;
}

interface Syllabus {
  id?: string;
  ders_id: string;
  icerik: any;
}

const DEFAULT_POLICIES = `Ders Süresi ve İşleyişi: Ders toplamda 3 saat sürecek şekilde planlanmıştır...
Dijital Araçların Kullanımı: Ders sırasında cep telefonu, tablet... kaydedemezsiniz.
Devam Durumu: ... %70 devam zorunluluğu bulunmaktadır.
Öğrenci Merkezli Öğrenme: Ders, öğrenci merkezli bir yaklaşımla yürütülecektir.
Engelli Öğrenci Desteği: ... doğrudan benimle iletişime geçebilirsiniz.
Sözlü ve Yazılı İletişim Etiği: ... saygı göstererek ve nefret söylemi kullanmadan...
Grup Çalışmaları: ... iş birliği içinde çalışması beklenmektedir.
Ödev Teslimi: ... ESOGÜ UZEM üzerinden teslim edilmelidir.
Yapay Zeka Kullanımı: ... sınırlı ve sorumlu biçimde kullanılabilir. Konu hakkında ön bilgi edinme... akademik dürüstlük ihlali sayılır...`;

const PROGRAM_OUTCOMES = [
  "PÇ1: İlahiyat alanına ilişkin temel kavram ve kuramları bilir...",
  "PÇ2: Sahip olduğu yabancı dil bilgisi ile...",
  "PÇ3: Sosyal, kültürel ve evrensel değerleri benimser...",
  "PÇ4: Alanıyla ilgili karşılaştığı sorunları doğru bir şekilde tanımlar...",
  "PÇ5: Değişen ve gelişen yerel / küresel sosyal ve politik konjonktürü yakından takip eder...",
  "PÇ6: Dini anlayış ve uygulamaların bireysel, toplumsal ve evrensel boyuttaki yansımalarını fark eder...",
  "PÇ7: Alanına ilişkin eğitimsel süreçleri etkin bir şekilde planlar...",
  "PÇ8: Alanına ilişkin akademik ve kültürel birikimi eleştirel bir yaklaşımla analiz eder...",
  "PÇ9: Sahip olduğu bilgi ve yetkinlikleri alanıyla ilgili eğitim...",
  "PÇ10: Alanına ilişkin gerçekleştireceği her türlü araştırma...",
  "PÇ11: Güncel bilişim ve iletişim teknolojilerine ilişkin bilgi...",
  "PÇ12: İlahiyat alanında eğitim, araştırma ve topluma hizmet..."
];

const DISCIPLINE_OUTCOMES = [
  "1: Kur’an-ı Kerim bilgisine, doğru tilavet becerisine...",
  "2: Arapça temel kaynakları okuma ve anlama...",
  "3: İtikat, ibadet, ahlak ve muamelata dair...",
  "4: Kur’an ve sünnet bütünlüğünü esas alan...",
  "5: Bütüncül ve sistematik bir dini düşünce...",
  "6: Zaman ve mekâna göre ortaya çıkan farklı dini yaklaşımları...",
  "7: Din istismarı, şiddet, İslam karşıtlığı gibi...",
  "8: Farklı düşünce ve yorumlar karşısında saygı...",
  "9: Kişi ve kurumlar yerine ilke ve değerleri...",
  "10: Dinin temel kaynakları ve bilimsel verilere dayalı...",
  "11: Toplumun inanç, ibadet, ahlak, örf ve adetlerini...",
  "12: Dini danışmanlık ve rehberlik bilgi...",
  "13: Akıl, bilgi, istişare, emanete riayet, ehliyet...",
  "14: İslam kültür, sanat ve medeniyeti hakkında..."
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
          gorușmeGunSaati: '',
          ofis: '',
          donem: selectedCourse.yariyil,
          gunSaat: '',
          krediAkts: '',
          egitimDili: 'Türkçe',
          ogretimTuru: 'Örgün',
          derslik: '',
          onkosul: '-',
          amac: '',
          ogranimCiktilari: Array(10).fill({ cikti: '', yeterlilik: '', ogretimYontemi: '', olcmeYontemi: '' }),
          temelKaynaklar: '',
          yardimciKaynaklar: '',
          politikalar: DEFAULT_POLICIES,
          haftalikIcerik: Array(14).fill({ konu: '', kaynaklar: '', isYuku: '' }),
          degerlendirme: [
            { tur: 'Ara Sınav', aciklama: '', yuzde: '' },
            { tur: 'Ödev', aciklama: '', yuzde: '' },
            { tur: 'Final', aciklama: '', yuzde: '' }
          ],
          harfNotu: 'AA: 90 / BA: 85 / BB: 80 / CB: 75 / CC: 70 / DC: 65 / DD: 60',
          aktsIsYuku: [
            { etkinlik: 'Ders Süresi', sayisi: '', suresi: '', toplam: '' },
            { etkinlik: 'Sınıf Dışı Çalışma', sayisi: '', suresi: '', toplam: '' },
            { etkinlik: 'Ara Sınav', sayisi: '', suresi: '', toplam: '' },
            { etkinlik: 'Final Sınavı', sayisi: '', suresi: '', toplam: '' }
          ],
          aktsToplam: '',
          aktsBolum30: '',
          pcOcMatris: PROGRAM_OUTCOMES.map(pc => ({ pc, oc1: '', oc2: '', oc3: '', oc4: '', oc5: '', oc6: '', oc7: '', oc8: '', oc9: '', oc10: '' })),
          docOcMatris: DISCIPLINE_OUTCOMES.map(doc => ({ doc, oc1: '', oc2: '', oc3: '', oc4: '', oc5: '', oc6: '', oc7: '', oc8: '', oc9: '', oc10: '' }))
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
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-slate-50">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-slate-200 flex flex-col h-full">
        <div className="p-4 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Ders ara..."
              className="w-full pl-9 pr-4 py-2 bg-slate-100 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredDersler.map(ders => (
            <button
              key={ders.kod}
              onClick={() => setSelectedCourse(ders)}
              className={`w-full text-left px-3 py-2.5 rounded-xl transition-all ${
                selectedCourse?.kod === ders.kod 
                ? 'bg-blue-600 text-white shadow-md shadow-blue-200' 
                : 'hover:bg-slate-100 text-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono opacity-70">{ders.kod}</span>
                {doldurulmusDersler.has(ders.kod) && (
                  <CheckCircle2 className={`w-3.5 h-3.5 ${selectedCourse?.kod === ders.kod ? 'text-white' : 'text-green-500'}`} />
                )}
              </div>
              <div className="text-sm font-semibold truncate leading-tight mt-0.5">{ders.ad}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-8">
        {!selectedCourse ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400">
            <FileText className="w-16 h-16 mb-4 opacity-20" />
            <p>İzlence oluşturmak için soldan bir ders seçin.</p>
          </div>
        ) : formData ? (
          <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-300">
            {/* Header Sticky */}
            <div className="sticky top-0 z-10 bg-slate-50/80 backdrop-blur-sm pb-4 flex items-center justify-between border-b border-slate-200">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">{selectedCourse.ad}</h2>
                <p className="text-slate-500 text-sm">{selectedCourse.kod} — İzlence Düzenleme</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold transition-all disabled:opacity-50"
                >
                  <Save className="w-5 h-5" />
                  {loading ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </div>

            {/* Form Sections */}
            <div className="grid grid-cols-2 gap-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="col-span-2 text-lg font-bold text-slate-800 border-b pb-2">1. Temel Bilgiler</h3>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Öğretim Elemanı</label>
                <input type="text" className="w-full border-slate-200 rounded-lg p-2 text-sm" value={formData.ogretimElemani} onChange={(e)=>setFormData({...formData, ogretimElemani: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">E-Posta</label>
                <input type="text" className="w-full border-slate-200 rounded-lg p-2 text-sm" value={formData.eposta} onChange={(e)=>setFormData({...formData, eposta: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Görüşme Gün/Saati</label>
                <input type="text" className="w-full border-slate-200 rounded-lg p-2 text-sm" value={formData.gorușmeGunSaati} onChange={(e)=>setFormData({...formData, gorușmeGunSaati: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ofis</label>
                <input type="text" className="w-full border-slate-200 rounded-lg p-2 text-sm" value={formData.ofis} onChange={(e)=>setFormData({...formData, ofis: e.target.value})} />
              </div>
            </div>

            {/* AKTS İş Yükü Section */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-lg font-bold text-slate-800 border-b pb-4 mb-4">AKTS - İş Yükü Tablosu</h3>
              <p className="text-xs text-slate-500 mb-4 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> Tüm alanlar manuel doldurulmalıdır.</p>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="border border-slate-200 p-2 text-left">Etkinlikler</th>
                    <th className="border border-slate-200 p-2 text-center w-24">Sayısı</th>
                    <th className="border border-slate-200 p-2 text-center w-24">Süresi</th>
                    <th className="border border-slate-200 p-2 text-center w-32">Toplam İş Yükü</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.aktsIsYuku.map((row:any, i:number) => (
                    <tr key={i}>
                      <td className="border border-slate-200 p-2">{row.etkinlik}</td>
                      <td className="border border-slate-200 p-1"><input type="text" className="w-full text-center border-none focus:ring-0" value={row.sayisi} onChange={(e)=>updateArrayField('aktsIsYuku', i, 'sayisi', e.target.value)} /></td>
                      <td className="border border-slate-200 p-1"><input type="text" className="w-full text-center border-none focus:ring-0" value={row.suresi} onChange={(e)=>updateArrayField('aktsIsYuku', i, 'suresi', e.target.value)} /></td>
                      <td className="border border-slate-200 p-1"><input type="text" className="w-full text-center border-none focus:ring-0 bg-slate-50" value={row.toplam} onChange={(e)=>updateArrayField('aktsIsYuku', i, 'toplam', e.target.value)} /></td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-bold">
                    <td colSpan={3} className="border border-slate-200 p-2 text-right">Toplam İş Yükü</td>
                    <td className="border border-slate-200 p-1"><input type="text" className="w-full text-center border-none focus:ring-0 bg-slate-100 font-bold" value={formData.aktsToplam} onChange={(e)=>setFormData({...formData, aktsToplam: e.target.value})} /></td>
                  </tr>
                  <tr className="bg-slate-50 font-bold">
                    <td colSpan={3} className="border border-slate-200 p-2 text-right">Toplam İş Yükü / 30</td>
                    <td className="border border-slate-200 p-1"><input type="text" className="w-full text-center border-none focus:ring-0 bg-slate-100 font-bold text-blue-600" value={formData.aktsBolum30} onChange={(e)=>setFormData({...formData, aktsBolum30: e.target.value})} /></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Matrix Sections */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
              <h3 className="text-lg font-bold text-slate-800 border-b pb-4 mb-4">PÇ ve DÖÇ İlişki Matrisleri</h3>
              <p className="text-xs text-slate-500 mb-4 italic">(1-5 arası puanlama yapınız)</p>
              <table className="w-full text-[10px] border-collapse">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="border border-slate-200 p-1 text-left w-64">Program Çıktıları (PÇ)</th>
                    {Array.from({length:10}, (_,i)=><th key={i} className="border border-slate-200 p-1 text-center w-8">ÖÇ{i+1}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {formData.pcOcMatris.map((row:any, i:number) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                      <td className="border border-slate-200 p-1 truncate">{row.pc}</td>
                      {Array.from({length:10}, (_,j)=>(
                        <td key={j} className="border border-slate-200 p-0">
                          <input 
                            type="text" 
                            className="w-full h-8 text-center border-none p-0 focus:ring-0 bg-transparent"
                            value={row[`oc${j+1}`]} 
                            onChange={(e)=> {
                              const newMatris = [...formData.pcOcMatris];
                              newMatris[i] = {...newMatris[i], [`oc${j+1}`]: e.target.value};
                              setFormData({...formData, pcOcMatris: newMatris});
                            }} 
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pb-12">
               <button onClick={handleSave} disabled={loading} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-10 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-blue-200">
                  <Save className="w-5 h-5" /> Kaydet
               </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
