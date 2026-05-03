'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import Link from 'next/link';
import { 
  Save, ArrowLeft, Plus, Trash2, 
  BookOpen, Clock, Target, ListChecks, 
  FileText, BarChart3, Settings, ShieldCheck,
  ChevronRight, ChevronLeft, GraduationCap, Check
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

const DEFAULT_POLICIES = `â€¢ Ders SÃ¼resi ve Ä°ÅŸleyiÅŸi: Ders toplamda 3 saat sÃ¼recek ÅŸekilde planlanmÄ±ÅŸtÄ±r ve 1 saatlik iki blok halinde iÅŸlenecektir. Bloklar arasÄ±nda 15 dakikalÄ±k bir ara verilecektir.
â€¢ Dijital AraÃ§larÄ±n KullanÄ±mÄ±: Ders sÄ±rasÄ±nda cep telefonu, tablet, dizÃ¼stÃ¼ bilgisayar vb. kiÅŸisel elektronik/dijital cihazlarla dersin herhangi bir bÃ¶lÃ¼mÃ¼nÃ¼ kaydedemezsiniz.
â€¢ Devam Durumu: EskiÅŸehir Osmangazi Ãœniversitesi Ã–n Lisans ve Lisans EÄŸitim-Ã–ÄŸretim ve SÄ±nav YÃ¶netmeliÄŸi 16. Madde gereÄŸi "Ã–ÄŸrenci, teorik ders Ã§alÄ±ÅŸmalarÄ±nÄ±n %70'ine, laboratuvar ve uygulama Ã§alÄ±ÅŸmalarÄ±nÄ±n %80'ine devam etmek zorundadÄ±r."
â€¢ Ã–ÄŸrenci Merkezli Ã–ÄŸrenme: Ders, Ã¶ÄŸrenci merkezli bir yaklaÅŸÄ±mla yÃ¼rÃ¼tÃ¼lecektir. Bu kapsamda Ã¶ÄŸrencilerin katÄ±lÄ±mÄ± desteklenecek, Ã¶ÄŸrenme sÃ¼recine dair sorumluluk almalarÄ± beklenecek ve ders sÃ¼recine dair geri bildirimleri alÄ±nacaktÄ±r.
â€¢ Engelli Ã–ÄŸrenci DesteÄŸi: Sizin iÃ§in engel oluÅŸturabilecek durumlarla (gÃ¶rme, iÅŸitme vb.) ilgili olarak doÄŸrudan benimle iletiÅŸime geÃ§ebilirsiniz.
â€¢ SÃ¶zlÃ¼ ve YazÄ±lÄ± Ä°letiÅŸim EtiÄŸi: SÄ±nÄ±f tartÄ±ÅŸmalarÄ± sÄ±rasÄ±nda birbirinize saygÄ± gÃ¶stererek ve nefret sÃ¶ylemi kullanmadan yorumlar yapabilirsiniz. SunumlarÄ±nÄ±zda veya yazÄ±lÄ± Ã¶devlerinizde herhangi bir kaynaÄŸÄ± kullanÄ±rken yazarlarÄ± ve web materyallerini referans gÃ¶stermeyi unutmayÄ±n.
â€¢ Grup Ã‡alÄ±ÅŸmalarÄ± ve Ekip Ã‡alÄ±ÅŸmasÄ± EtiÄŸi: Grup Ã§alÄ±ÅŸmalarÄ± sÄ±rasÄ±nda tÃ¼m Ã¶ÄŸrencilerin eÅŸit katÄ±lÄ±m gÃ¶stermesi ve iÅŸ birliÄŸi iÃ§inde Ã§alÄ±ÅŸmasÄ± beklenmektedir.
â€¢ Ã–dev Teslimi: Ã–zellikle vize sonrasÄ± ek puan talebinde bulunan Ã¶ÄŸrenciler iÃ§in ekstra Ã¶dev seÃ§enekleri sunulabilir. Bu Ã¶devler, Ã¶ÄŸretim elemanÄ± tarafÄ±ndan belirlenecek bir konu Ã§erÃ§evesinde hazÄ±rlanmalÄ± ve teslim edilmelidir.
â€¢ Yapay Zeka KullanÄ±mÄ±: Bu derste yapay zeka araÃ§larÄ± sÄ±nÄ±rlÄ± ve sorumlu biÃ§imde kullanÄ±labilir. Yapay zeka, Ã¶ÄŸrencinin kendi Ã¶ÄŸrenme sÃ¼recini destekleyen bir yardÄ±mcÄ± olarak gÃ¶rÃ¼lÃ¼r; Ã¶ÄŸrencinin yerine dÃ¼ÅŸÃ¼nme, analiz etme veya akademik Ã¼retim yapma aracÄ± deÄŸildir.`;

const AKTS_ROWS = [
  "Ders SÃ¼resi (SÄ±nav HaftasÄ± Dahil HaftalÄ±k Toplam Ders Saati)",
  "SÄ±nÄ±f DÄ±ÅŸÄ± Ders Ã‡alÄ±ÅŸma SÃ¼resi (Tekrar, PekiÅŸtirme, Ã–n Ã‡alÄ±ÅŸma vb.)",
  "Ã–dev", "KÄ±sa SÄ±nav", "KÄ±sa SÄ±nav HazÄ±rlÄ±k", "SÃ¶zlÃ¼ SÄ±nav", "SÃ¶zlÃ¼ SÄ±nav HazÄ±rlÄ±k",
  "Rapor (HazÄ±rlÄ±k ve Sunum SÃ¼resi Dahil)", "Proje (HazÄ±rlÄ±k ve Sunum SÃ¼resi Dahil)",
  "Sunum (HazÄ±rlÄ±k SÃ¼resi Dahil)", "Ara SÄ±nav", "Ara SÄ±nav HazÄ±rlÄ±k",
  "YarÄ±yÄ±l Sonu SÄ±navÄ±", "YarÄ±yÄ±l Sonu SÄ±navÄ± HazÄ±rlÄ±k"
];

const PROGRAM_OUTCOMES = [
  "Ä°lahiyat alanÄ±na iliÅŸkin temel kavram ve kuramlarÄ± bilir, bunlarÄ± kullanarak gÃ¼ncel olay ve olgularÄ± aÃ§Ä±klar.",
  "Sahip olduÄŸu yabancÄ± dil bilgisi ile alanÄ±ndaki yeni Ã§alÄ±ÅŸmalarÄ± ve bilimsel geliÅŸmeleri takip eder, elde ettiÄŸi yabancÄ± literatÃ¼rdeki bilgileri ilgililerle paylaÅŸÄ±r.",
  "Sosyal, kÃ¼ltÃ¼rel ve evrensel deÄŸerleri benimser, araÅŸtÄ±rma, iletiÅŸim ve eylemlerinde erdemli davranÄ±ÅŸlar sergiler, tarihi ve kÃ¼ltÃ¼rel mirasÄ±n aktarÄ±mÄ±na katkÄ± saÄŸlar.",
  "AlanÄ±yla ilgili karÅŸÄ±laÅŸtÄ±ÄŸÄ± sorunlarÄ± doÄŸru bir ÅŸekilde tanÄ±mlar, bunlara disipliner ve disiplinlerarasÄ± Ã§alÄ±ÅŸmalarla uygun Ã§Ã¶zÃ¼m ve alternatifler geliÅŸtirir ve bunlarÄ± ilgili kurumlarla paylaÅŸÄ±r.",
  "DeÄŸiÅŸen ve geliÅŸen yerel / kÃ¼resel sosyal ve politik konjonktÃ¼rÃ¼ yakÄ±ndan takip eder ve yeni ÅŸartlara uygun anlayÄ±ÅŸ ve yaklaÅŸÄ±mlar geliÅŸtirir.",
  "Dini anlayÄ±ÅŸ ve uygulamalarÄ±n bireysel, toplumsal ve evrensel boyuttaki yansÄ±malarÄ±nÄ± fark eder. Toplumsal hayatta ortaya Ã§Ä±kan ihtiyaÃ§ ve sorunlara dini alandan bilimsel Ã§Ã¶zÃ¼mler sunar ve bunlarÄ± ilgili kurumlarla paylaÅŸÄ±r.",
  "AlanÄ±na iliÅŸkin eÄŸitimsel sÃ¼reÃ§leri etkin bir ÅŸekilde planlar, bu planlarÄ± uygular ve mesleki ve akademik geliÅŸimine yÃ¶nelik sosyal, kÃ¼ltÃ¼rel ve sanatsal etkinliklere katÄ±lÄ±r.",
  "AlanÄ±na iliÅŸkin akademik ve kÃ¼ltÃ¼rel birikimi eleÅŸtirel bir yaklaÅŸÄ±mla analiz eder, hayatÄ± boyunca alanÄ±na iliÅŸkin yeni Ã¶ÄŸrenme ortamlarÄ±na katÄ±lmaya istekli olur.",
  "Sahip olduÄŸu bilgi ve yetkinlikleri alanÄ±yla ilgili eÄŸitim, araÅŸtÄ±rma ve topluma hizmet faaliyetlerinde yetkin ÅŸekilde kullanÄ±r.",
  "AlanÄ±na iliÅŸkin gerÃ§ekleÅŸtireceÄŸi her tÃ¼rlÃ¼ araÅŸtÄ±rma, eÄŸitim ve topluma hizmet faaliyetlerinde birey hak ve Ã¶zgÃ¼rlÃ¼klerine saygÄ± duyar, toplumsal, ahlaki ve hukuki ilkelere uygun davranÄ±ÅŸlar sergiler.",
  "GÃ¼ncel biliÅŸim ve iletiÅŸim teknolojilerine iliÅŸkin bilgi ve becerilerini geliÅŸtirir, bunlardaki yetkinliklerini alanÄ±yla ilgili faaliyetlerde aktif ÅŸekilde kullanÄ±r.",
  "Ä°lahiyat alanÄ±nda eÄŸitim, araÅŸtÄ±rma ve topluma hizmet boyutlarÄ±nda sorun Ã§Ã¶zme ve iyileÅŸtirmeye yÃ¶nelik bireysel ve kurumsal dÃ¼zeyde faaliyetler planlar ve bunlarÄ±n uygulanmasÄ±nda sorumluluk Ã¼stlenir."
];

const DISCIPLINE_OUTCOMES = [
  "Kur'an-Ä± Kerim bilgisine, doÄŸru tilavet becerisine ve yeterli ezbere sahip olma",
  "ArapÃ§a temel kaynaklarÄ± okuma ve anlama yetkinliÄŸine sahip olma",
  "Ä°tikat, ibadet, ahlak ve muamelata dair usul ve esaslarÄ± kavrama ve bu esaslarÄ±n dayandÄ±ÄŸÄ± temelleri bilme",
  "Kur'an ve sÃ¼nnet bÃ¼tÃ¼nlÃ¼ÄŸÃ¼nÃ¼ esas alan bir yaklaÅŸÄ±ma sahip olma",
  "BÃ¼tÃ¼ncÃ¼l ve sistematik bir dini dÃ¼ÅŸÃ¼nce ve kavrayÄ±ÅŸa sahip olma",
  "Zaman ve mekÃ¢na gÃ¶re ortaya Ã§Ä±kan farklÄ± dini yaklaÅŸÄ±mlarÄ± doÄŸru anlama ve tutarlÄ± deÄŸerlendirme yetkinliÄŸine sahip olma",
  "Din istismarÄ±, ÅŸiddet, Ä°slam karÅŸÄ±tlÄ±ÄŸÄ± gibi dine ve topluma zararlÄ± eÄŸilimlere karÅŸÄ± sÃ¶ylem ve tutum geliÅŸtirebilme yetkinliÄŸine sahip olma",
  "FarklÄ± dÃ¼ÅŸÃ¼nce ve yorumlar karÅŸÄ±sÄ±nda saygÄ± ve adaleti esas alma yetkinliÄŸine sahip olma",
  "KiÅŸi ve kurumlar yerine ilke ve deÄŸerleri Ã¼stÃ¼n tutan bir anlayÄ±ÅŸa sahip olma",
  "Dinin temel kaynaklarÄ± ve bilimsel verilere dayalÄ± din eÄŸitimi ve din hizmetleri verme yetkinliÄŸine sahip olma",
  "Toplumun inanÃ§, ibadet, ahlak, Ã¶rf ve adetlerini Ä°slam'Ä±n temel kaynaklarÄ± Ä±ÅŸÄ±ÄŸÄ±nda yorumlama ve toplumu aydÄ±nlatma yetkinliÄŸine sahip olma",
  "Dini danÄ±ÅŸmanlÄ±k ve rehberlik bilgi ve becerisine sahip olma",
  "AkÄ±l, bilgi, istiÅŸare, emanete riayet, ehliyet ve adalet gibi temel deÄŸerler/ilkeler Ä±ÅŸÄ±ÄŸÄ±nda Ã§alÄ±ÅŸma ve sorumluluk Ã¼stlenebilme yetkinliÄŸine sahip olma",
  "Ä°slam kÃ¼ltÃ¼r, sanat ve medeniyeti hakkÄ±nda temel ve bÃ¼tÃ¼ncÃ¼l bilgilere sahip olma"
];

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
        egitimDili: course.dil || 'TÃ¼rkÃ§e',
        ogretimTuru: 'Ã–rgÃ¼n Ã–ÄŸretim',
        derslik: '',
        onkosul: '-',
        amac: '',
        ogrenimCiktilari: Array(10).fill(0).map(() => ({ 
          cikti: '', bilgi: false, beceri: false, yetkinlik: false, ogretim: '', olcme: '' 
        })),
        temelKaynaklar: '',
        yardimciKaynaklar: '',
        politikalar: DEFAULT_POLICIES,
        haftalikIcerik: Array(14).fill(0).map((_, i) => ({ 
          hafta: i + 1, konu: '', kaynaklar: '', isYuku: '' 
        })).concat([
          { hafta: 'ArasÄ±nav', konu: 'ArasÄ±nav HaftasÄ±', kaynaklar: '', isYuku: '' },
          { hafta: 'Final', konu: 'Final HaftasÄ±', kaynaklar: '', isYuku: '' }
        ]),
        degerlendirme: [
          { tur: 'Ara SÄ±nav', aciklama: '', yuzde: 40 },
          { tur: 'Ã–dev', aciklama: '', yuzde: 0 },
          { tur: 'Sunum', aciklama: '', yuzde: 0 },
          { tur: 'Uygulama', aciklama: '', yuzde: 0 },
          { tur: 'Final', aciklama: '', yuzde: 60 },
          { tur: 'BÃ¼tÃ¼nleme', aciklama: '', yuzde: 0 }
        ],
        harfNotu: 'AA: / BA: / BB: / CB: / CC: / DC: / DD:',
        aktsIsYuku: AKTS_ROWS.map(row => ({ 
          etkinlik: row, sayisi: '', suresi: '', toplam: '' 
        })),
        pcMatris: PROGRAM_OUTCOMES.map((pc, i) => ({ 
          id: `PÃ‡${i+1}`, metin: pc, ocValues: Array(10).fill('') 
        })),
        docMatris: DISCIPLINE_OUTCOMES.map((doc, i) => ({ 
          id: `DÃ–Ã‡${i+1}`, metin: doc, ocValues: Array(10).fill('') 
        }))
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
      toast.success('Ä°zlence baÅŸarÄ±yla kaydedildi!');
    } catch (err) {
      console.error(err);
      toast.error('Kaydedilirken bir hata oluÅŸtu.');
    } finally {
      setLoading(false);
    }
  };

  if (!selectedCourse || !formData) {
    return (
      <div className="p-8 text-center bg-slate-50 min-h-screen flex flex-col items-center justify-center">
        <div className="bg-white p-10 rounded-3xl shadow-xl max-w-lg border border-slate-200">
          <GraduationCap className="w-20 h-20 text-blue-600 mx-auto mb-6" />
          <h2 className="text-2xl font-black text-slate-800 mb-4 tracking-tight">Ders Ä°zlencesi EditÃ¶rÃ¼</h2>
          <p className="text-slate-500 mb-8 leading-relaxed">LÃ¼tfen dÃ¼zenlemek istediÄŸiniz dersi seÃ§in.</p>
          <Link href="/izlenceler" className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 py-4 rounded-2xl transition-all shadow-lg">
            <ArrowLeft className="w-5 h-5" /> EÄŸitim PlanÄ±na Git
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header Sticky */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <Link href="/izlenceler" className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </Link>
          <div>
            <h1 className="text-xs font-black text-slate-400 uppercase tracking-widest">{selectedCourse.kod}</h1>
            <h2 className="text-lg font-bold text-slate-800">{selectedCourse.ad}</h2>
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
          {[1, 2, 3, 4, 5].map((step) => (
            <button
              key={step}
              onClick={() => setActiveStep(step)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${
                activeStep === step ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-white'
              }`}
            >
              SAYFA {step}
            </button>
          ))}
        </div>

        <button onClick={handleSave} disabled={loading} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-6 py-3 rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50">
          <Save className="w-4 h-4" /> {loading ? 'KAYDEDÄ°LÄ°YOR...' : 'KAYDET'}
        </button>
      </div>

      <div className="flex-1 max-w-6xl mx-auto w-full px-4 py-10">
        
        {/* Sayfa 1: Header, Bilgiler ve Ã–ÄŸrenim Ã‡Ä±ktÄ±larÄ± */}
        {activeStep === 1 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <section className="bg-white p-10 rounded-3xl shadow-sm border border-slate-200">
              <h3 className="text-sm font-black text-blue-900 border-l-4 border-blue-900 pl-3 mb-8 uppercase tracking-widest">Genel Bilgiler</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {['ogretimElemani', 'eposta', 'gorusmeGunSaat', 'ofis', 'gunSaat', 'derslik', 'onkosul'].map((field) => (
                  <div key={field} className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      {field === 'ogretimElemani' ? 'Ã–ÄŸretim ElemanÄ±' : field === 'eposta' ? 'E-Posta' : field === 'gorusmeGunSaat' ? 'GÃ¶rÃ¼ÅŸme GÃ¼n ve Saatleri' : field === 'onkosul' ? 'Ã–nkoÅŸul Dersleri' : field}
                    </label>
                    <input
                      className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-xl px-5 py-3 font-bold text-slate-700 transition-all outline-none"
                      value={formData[field]}
                      onChange={e => setFormData({...formData, [field]: e.target.value})}
                    />
                  </div>
                ))}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Dersin AmacÄ±</label>
                  <textarea
                    rows={4}
                    className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-xl px-5 py-3 font-bold text-slate-700 transition-all outline-none"
                    value={formData.amac}
                    onChange={e => setFormData({...formData, amac: e.target.value})}
                  />
                </div>
              </div>
            </section>

            <section className="bg-white p-10 rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
              <h3 className="text-sm font-black text-blue-900 border-l-4 border-blue-900 pl-3 mb-8 uppercase tracking-widest">Dersin Ã–ÄŸrenim Ã‡Ä±ktÄ±larÄ±</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-slate-200 text-[11px]">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="border p-2 w-8">#</th>
                      <th className="border p-2 text-left">Dersin Ã–ÄŸrenim Ã‡Ä±ktÄ±larÄ±</th>
                      <th className="border p-2 w-12 text-center">Bilgi</th>
                      <th className="border p-2 w-12 text-center">Beceri</th>
                      <th className="border p-2 w-12 text-center">Yetkinlik</th>
                      <th className="border p-2 text-left">Ã–ÄŸretim YÃ¶ntemleri*</th>
                      <th className="border p-2 text-left">Ã–lÃ§me YÃ¶ntemleri**</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.ogrenimCiktilari.map((oc: any, i: number) => (
                      <tr key={i}>
                        <td className="border p-2 text-center font-bold">{i + 1}</td>
                        <td className="border p-1"><input className="w-full p-2 outline-none focus:bg-blue-50" value={oc.cikti} onChange={e => {
                          const newOc = [...formData.ogrenimCiktilari]; newOc[i].cikti = e.target.value; setFormData({...formData, ogrenimCiktilari: newOc});
                        }} /></td>
                        <td className="border p-2 text-center"><input type="checkbox" checked={oc.bilgi} onChange={e => {
                          const newOc = [...formData.ogrenimCiktilari]; newOc[i].bilgi = e.target.checked; setFormData({...formData, ogrenimCiktilari: newOc});
                        }} className="w-4 h-4 cursor-pointer" /></td>
                        <td className="border p-2 text-center"><input type="checkbox" checked={oc.beceri} onChange={e => {
                          const newOc = [...formData.ogrenimCiktilari]; newOc[i].beceri = e.target.checked; setFormData({...formData, ogrenimCiktilari: newOc});
                        }} className="w-4 h-4 cursor-pointer" /></td>
                        <td className="border p-2 text-center"><input type="checkbox" checked={oc.yetkinlik} onChange={e => {
                          const newOc = [...formData.ogrenimCiktilari]; newOc[i].yetkinlik = e.target.checked; setFormData({...formData, ogrenimCiktilari: newOc});
                        }} className="w-4 h-4 cursor-pointer" /></td>
                        <td className="border p-1"><input className="w-full p-2 outline-none" value={oc.ogretim} onChange={e => {
                          const newOc = [...formData.ogrenimCiktilari]; newOc[i].ogretim = e.target.value; setFormData({...formData, ogrenimCiktilari: newOc});
                        }} /></td>
                        <td className="border p-1"><input className="w-full p-2 outline-none" value={oc.olcme} onChange={e => {
                          const newOc = [...formData.ogrenimCiktilari]; newOc[i].olcme = e.target.value; setFormData({...formData, ogrenimCiktilari: newOc});
                        }} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* Sayfa 2: Kaynaklar ve Politikalar */}
        {activeStep === 2 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <section className="bg-white p-10 rounded-3xl shadow-sm border border-slate-200">
              <h3 className="text-sm font-black text-blue-900 border-l-4 border-blue-900 pl-3 mb-8 uppercase tracking-widest">Ders KaynaklarÄ±</h3>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Temel Ders KitabÄ±</label>
                  <textarea rows={3} className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-xl px-5 py-3 font-bold text-slate-700 outline-none" value={formData.temelKaynaklar} onChange={e => setFormData({...formData, temelKaynaklar: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">YardÄ±mcÄ± Kaynaklar</label>
                  <textarea rows={3} className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-xl px-5 py-3 font-bold text-slate-700 outline-none" value={formData.yardimciKaynaklar} onChange={e => setFormData({...formData, yardimciKaynaklar: e.target.value})} />
                </div>
              </div>
            </section>
            <section className="bg-white p-10 rounded-3xl shadow-sm border border-slate-200">
              <h3 className="text-sm font-black text-blue-900 border-l-4 border-blue-900 pl-3 mb-8 uppercase tracking-widest">Ders PolitikalarÄ±</h3>
              <textarea rows={15} className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-xl px-5 py-4 font-medium text-slate-700 outline-none text-sm leading-relaxed" value={formData.politikalar} onChange={e => setFormData({...formData, politikalar: e.target.value})} />
            </section>
          </div>
        )}

        {/* Sayfa 3: HaftalÄ±k Ä°Ã§erik ve DeÄŸerlendirme */}
        {activeStep === 3 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <section className="bg-white p-10 rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
              <h3 className="text-sm font-black text-blue-900 border-l-4 border-blue-900 pl-3 mb-8 uppercase tracking-widest">HaftalÄ±k Ders Ä°Ã§eriÄŸi</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-slate-200 text-[11px]">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="border p-2 w-16">Hafta</th>
                      <th className="border p-2 text-left">Konu BaÅŸlÄ±ÄŸÄ±</th>
                      <th className="border p-2 text-left">Ä°lgili Kaynaklar</th>
                      <th className="border p-2 w-32 text-center">Ã–ÄŸrenci Ä°ÅŸ YÃ¼kÃ¼</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.haftalikIcerik.map((row: any, i: number) => (
                      <tr key={i} className={row.hafta === 'ArasÄ±nav' || row.hafta === 'Final' ? 'bg-blue-50' : ''}>
                        <td className="border p-2 text-center font-bold">{row.hafta}</td>
                        <td className="border p-1"><input className="w-full p-2 outline-none bg-transparent" value={row.konu} onChange={e => {
                          const newH = [...formData.haftalikIcerik]; newH[i].konu = e.target.value; setFormData({...formData, haftalikIcerik: newH});
                        }} /></td>
                        <td className="border p-1"><input className="w-full p-2 outline-none bg-transparent" value={row.kaynaklar} onChange={e => {
                          const newH = [...formData.haftalikIcerik]; newH[i].kaynaklar = e.target.value; setFormData({...formData, haftalikIcerik: newH});
                        }} /></td>
                        <td className="border p-1"><input className="w-full p-2 text-center outline-none bg-transparent" value={row.isYuku} onChange={e => {
                          const newH = [...formData.haftalikIcerik]; newH[i].isYuku = e.target.value; setFormData({...formData, haftalikIcerik: newH});
                        }} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            
            <section className="bg-white p-10 rounded-3xl shadow-sm border border-slate-200">
              <h3 className="text-sm font-black text-blue-900 border-l-4 border-blue-900 pl-3 mb-8 uppercase tracking-widest">Ders DeÄŸerlendirme</h3>
              <table className="w-full border-collapse border border-slate-200 text-[11px] mb-6">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="border p-2 text-left">DeÄŸerlendirme TÃ¼rÃ¼</th>
                    <th className="border p-2 text-left">AÃ§Ä±klama</th>
                    <th className="border p-2 w-20 text-center">%</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.degerlendirme.map((d: any, i: number) => (
                    <tr key={i}>
                      <td className="border p-2 font-bold">{d.tur}</td>
                      <td className="border p-1"><input className="w-full p-2 outline-none" value={d.aciklama} onChange={e => {
                        const newD = [...formData.degerlendirme]; newD[i].aciklama = e.target.value; setFormData({...formData, degerlendirme: newD});
                      }} /></td>
                      <td className="border p-1"><input type="number" className="w-full p-2 text-center outline-none" value={d.yuzde} onChange={e => {
                        const newD = [...formData.degerlendirme]; newD[i].yuzde = parseInt(e.target.value) || 0; setFormData({...formData, degerlendirme: newD});
                      }} /></td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-black">
                    <td colSpan={2} className="border p-2 text-right">TOPLAM</td>
                    <td className="border p-2 text-center">{formData.degerlendirme.reduce((acc: number, d: any) => acc + d.yuzde, 0)}</td>
                  </tr>
                </tbody>
              </table>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Harf Notu Baremi</label>
                <input className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-xl px-5 py-3 font-bold text-slate-700 outline-none" value={formData.harfNotu} onChange={e => setFormData({...formData, harfNotu: e.target.value})} />
              </div>
            </section>
          </div>
        )}

        {/* Sayfa 4: AKTS Ä°ÅŸ YÃ¼kÃ¼ ve PÃ‡ Matrisi (PÃ‡1-8) */}
        {activeStep === 4 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <section className="bg-white p-10 rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
              <h3 className="text-sm font-black text-blue-900 border-l-4 border-blue-900 pl-3 mb-8 uppercase tracking-widest">AKTS - Ä°ÅŸ YÃ¼kÃ¼ Tablosu</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-slate-200 text-[11px]">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="border p-2 text-left">Etkinlikler</th>
                      <th className="border p-2 w-24 text-center">SayÄ±sÄ±</th>
                      <th className="border p-2 w-24 text-center">SÃ¼resi (Saat)</th>
                      <th className="border p-2 w-24 text-center">Toplam Ä°ÅŸ YÃ¼kÃ¼ (Saat)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.aktsIsYuku.map((row: any, i: number) => (
                      <tr key={i}>
                        <td className="border p-2 font-medium">{row.etkinlik}</td>
                        <td className="border p-1"><input className="w-full p-2 text-center outline-none" value={row.sayisi} onChange={e => {
                          const newA = [...formData.aktsIsYuku]; newA[i].sayisi = e.target.value; setFormData({...formData, aktsIsYuku: newA});
                        }} /></td>
                        <td className="border p-1"><input className="w-full p-2 text-center outline-none" value={row.suresi} onChange={e => {
                          const newA = [...formData.aktsIsYuku]; newA[i].suresi = e.target.value; setFormData({...formData, aktsIsYuku: newA});
                        }} /></td>
                        <td className="border p-1"><input className="w-full p-2 text-center outline-none" value={row.toplam} onChange={e => {
                          const newA = [...formData.aktsIsYuku]; newA[i].toplam = e.target.value; setFormData({...formData, aktsIsYuku: newA});
                        }} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="bg-white p-10 rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
              <h3 className="text-sm font-black text-blue-900 border-l-4 border-blue-900 pl-3 mb-4 uppercase tracking-widest">Dersin Ã–ÄŸrenim Ã‡Ä±ktÄ±larÄ±nÄ±n (Ã–Ã‡) Program Ã‡Ä±ktÄ±larÄ± (PÃ‡) ile Olan Ä°liÅŸkisi</h3>
              <p className="text-[10px] text-slate-400 mb-6 font-bold">(5: Ã‡ok yÃ¼ksek, 4: YÃ¼ksek, 3: Orta, 2: DÃ¼ÅŸÃ¼k, 1: Ã‡ok dÃ¼ÅŸÃ¼k)</p>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-slate-200 text-[10px]">
                  <thead>
                    <tr className="bg-slate-50">
                      <th rowSpan={2} className="border p-2 text-left">PÃ‡ No / Metin</th>
                      <th colSpan={10} className="border p-2 text-center bg-blue-50 text-blue-900">Ã–ÄŸrenme Ã‡Ä±ktÄ±larÄ±</th>
                    </tr>
                    <tr className="bg-slate-50">
                      {Array(10).fill(0).map((_, i) => <th key={i} className="border p-1 w-8 text-center">Ã–Ã‡{i+1}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {formData.pcMatris.map((pc: any, i: number) => (
                      <tr key={i}>
                        <td className="border p-2 w-64"><span className="font-black text-blue-900">{pc.id}:</span> {pc.metin}</td>
                        {Array(10).fill(0).map((_, j) => (
                          <td key={j} className="border p-1">
                            <input className="w-full text-center outline-none bg-transparent font-black" value={pc.ocValues[j]} maxLength={1} onChange={e => {
                              const newM = [...formData.pcMatris]; newM[i].ocValues[j] = e.target.value; setFormData({...formData, pcMatris: newM});
                            }} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* Sayfa 5: DÃ–Ã‡ Matrisi (DÃ–Ã‡1-14) */}
        {activeStep === 5 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <section className="bg-white p-10 rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
              <h3 className="text-sm font-black text-blue-900 border-l-4 border-blue-900 pl-3 mb-4 uppercase tracking-widest">Ders Ã–ÄŸrenim Ã‡Ä±ktÄ±larÄ±nÄ±n (Ã–Ã‡) Ä°AA Disipline Ã–zgÃ¼ Ã‡Ä±ktÄ±lar (DÃ–Ã‡) ile Olan Ä°liÅŸkisi</h3>
              <p className="text-[10px] text-slate-400 mb-6 font-bold">(5: Ã‡ok yÃ¼ksek, 4: YÃ¼ksek, 3: Orta, 2: DÃ¼ÅŸÃ¼k, 1: Ã‡ok dÃ¼ÅŸÃ¼k)</p>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-slate-200 text-[10px]">
                  <thead>
                    <tr className="bg-slate-50">
                      <th rowSpan={2} className="border p-2 text-left">DÃ–Ã‡ No / Metin</th>
                      <th colSpan={10} className="border p-2 text-center bg-blue-50 text-blue-900">Ã–ÄŸrenme Ã‡Ä±ktÄ±larÄ±</th>
                    </tr>
                    <tr className="bg-slate-50">
                      {Array(10).fill(0).map((_, i) => <th key={i} className="border p-1 w-8 text-center">Ã–Ã‡{i+1}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {formData.docMatris.map((doc: any, i: number) => (
                      <tr key={i}>
                        <td className="border p-2 w-64"><span className="font-black text-blue-900">{doc.id}:</span> {doc.metin}</td>
                        {Array(10).fill(0).map((_, j) => (
                          <td key={j} className="border p-1">
                            <input className="w-full text-center outline-none bg-transparent font-black" value={doc.ocValues[j]} maxLength={1} onChange={e => {
                              const newM = [...formData.docMatris]; newM[i].ocValues[j] = e.target.value; setFormData({...formData, docMatris: newM});
                            }} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* Navigation Dots */}
        <div className="mt-12 flex items-center justify-between">
          <button onClick={() => setActiveStep(prev => Math.max(1, prev - 1))} disabled={activeStep === 1} className="flex items-center gap-2 text-slate-500 hover:text-blue-600 font-black text-[10px] px-4 py-2 disabled:opacity-30 transition-colors uppercase tracking-widest">
            <ChevronLeft className="w-4 h-4" /> Ã–nceki Sayfa
          </button>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map(s => (
              <div key={s} className={`w-1.5 h-1.5 rounded-full transition-all ${activeStep === s ? 'bg-blue-600 w-6' : 'bg-slate-300'}`} />
            ))}
          </div>
          <button onClick={() => setActiveStep(prev => Math.min(5, prev + 1))} disabled={activeStep === 5} className="flex items-center gap-2 text-slate-500 hover:text-blue-600 font-black text-[10px] px-4 py-2 disabled:opacity-30 transition-colors uppercase tracking-widest">
            Sonraki Sayfa <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}


