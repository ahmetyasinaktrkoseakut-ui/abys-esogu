'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { 
  FileCheck, 
  AlertCircle, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Eye,
  Search,
  MessageSquare,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { usePeriod } from '@/contexts/PeriodContext';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function VeriOnayiPage() {
  const { selectedPeriod } = usePeriod();
  const params = useParams();
  const locale = params?.locale || 'tr';
  
  const [coordinatorTopic, setCoordinatorTopic] = useState<string | null>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Reject Modal State
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [expandedReport, setExpandedReport] = useState<string | null>(null);

  useEffect(() => {
    fetchInitialData();
  }, [selectedPeriod]);

  const fetchInitialData = async () => {
    if (!selectedPeriod) {
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Kullanıcı oturumu bulunamadı.");

      // 1. Koordinatörün başlığını bul
      const { data: coordData, error: coordError } = await supabase
        .from('baslik_koordinatorleri')
        .select('baslik')
        .eq('kullanici_id', user.id)
        .single();

      if (coordError || !coordData) {
        throw new Error("Bu sayfaya erişim yetkiniz yok veya atanmış bir başlığınız bulunmuyor.");
      }
      
      setCoordinatorTopic(coordData.baslik);

      // 2. Ana başlığın ID'sini bul (Sabit eşleştirme)
      const { data: allBasliklar } = await supabase.from('ana_basliklar').select('id, baslik_adi, kod');
      
      const baslikMap: Record<string, string> = {
        'Kalite Güvencesi': 'KALİTE GÜVENCESİ SİSTEMİ',
        'Eğitim-Öğretim': 'EĞİTİM VE ÖĞRETİM',
        'Araştırma ve Geliştirme': 'ARAŞTIRMA VE GELİŞTİRME',
        'Toplumsal Katkı': 'TOPLUMSAL KATKI',
        'Yönetim Sistemi': 'YÖNETİM SİSTEMİ'
      };

      const expectedDbBaslik = baslikMap[coordData.baslik];
      const anaBaslikData = allBasliklar?.find(b => b.baslik_adi === expectedDbBaslik);

      if (!anaBaslikData) {
        console.log("Eşleşme sağlanamadı. Aranan:", coordData.baslik);
        console.log("Mevcut Başlıklar:", allBasliklar?.map(b => b.baslik_adi));
        throw new Error(`Sorumlu olduğunuz '${coordData.baslik}' başlığı sistemdeki başlıklarla (örn: ${allBasliklar?.[0]?.baslik_adi}) eşleşmedi.`);
      }

      // 3. O başlığa ait alt ölçütleri bul (JS ile filtrele)
      const { data: allAltOlcutlerData } = await supabase
        .from('alt_olcutler')
        .select('*');

      // JSON simülasyonunu tam da kullanıcının istediği gibi oluşturuyoruz
      const { data: allOlcutlerData } = await supabase.from('olcutler').select('*');
      
      const tumOlcutler = (allBasliklar || []).map(ana => {
        const anaOlcutler = (allOlcutlerData || []).filter(o => o.ana_baslik_id === ana.id || (o.kod && ana.kod && o.kod.startsWith(ana.kod)));
        const anaAltOlcutler = (allAltOlcutlerData || []).filter(ao => {
          return anaOlcutler.some(o => o.id === ao.olcut_id) || (ao.kod && ana.kod && ao.kod.startsWith(ana.kod));
        });
        return {
          baslik: ana.baslik_adi,
          kod: ana.kod,
          id: ana.id,
          olcutler: anaOlcutler,
          altOlcutler: anaAltOlcutler
        };
      });

      const seciliAnaBaslik = tumOlcutler.find(olcut => olcut.baslik === expectedDbBaslik);
      const filteredAltOlcutler = seciliAnaBaslik ? seciliAnaBaslik.altOlcutler : (allAltOlcutlerData || []);
      const altOlcutIds = filteredAltOlcutler.map(ao => ao.id);

      // 4. Bekleyen raporları getir
      // Not: 'onay_durumu' null ise de bekliyor kabul edebiliriz
      const { data: raporlarData, error: raporlarError } = await supabase
        .from('ozdegerlendirme_raporlari')
        .select('*')
        .eq('donem_id', selectedPeriod.id)
        .in('alt_olcut_id', altOlcutIds.length > 0 ? altOlcutIds : [0])
        .or('onay_durumu.eq.bekliyor,onay_durumu.is.null')
        .order('olusturulma_tarihi', { ascending: false });

      if (raporlarError) throw raporlarError;

      // JS ile birleştir (Şema önbelleği hatasını aşmak için)
      const raporlarWithOlcut = (raporlarData || []).map(rapor => {
        // Tam da istenen mantık:
        const bulunanOlcut = tumOlcutler.flatMap((ana: any) => ana.altOlcutler || ana.alt_olcutler || []).find(alt => String(alt.id) === String(rapor.alt_olcut_id) || String(alt.kod) === String(rapor.alt_olcut_id));
        const olcutAdi = bulunanOlcut ? (bulunanOlcut.ad || bulunanOlcut.baslik || bulunanOlcut.isim || bulunanOlcut.title) : null;
        
        return {
          ...rapor,
          alt_olcutler: bulunanOlcut ? { kod: bulunanOlcut.kod, ad: olcutAdi || 'İsim Bulunamadı' } : null
        };
      });

      setReports(raporlarWithOlcut);
      
    } catch (error: any) {
      console.error("Veri çekme hatası:", error);
      setMessage({ type: 'error', text: error.message || 'Veriler yüklenirken hata oluştu.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    if (!window.confirm('Bu raporu onaylamak istediğinize emin misiniz?')) return;
    
    try {
      setIsSubmitting(true);
      const { error } = await supabase
        .from('ozdegerlendirme_raporlari')
        .update({ onay_durumu: 'onaylandi', red_nedeni: null })
        .eq('id', id);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Rapor başarıyla onaylandı.' });
      setReports(prev => prev.filter(r => r.id !== id));
    } catch (error: any) {
      setMessage({ type: 'error', text: 'Onaylanırken hata oluştu.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!selectedReportId || !rejectReason.trim()) return;
    
    try {
      setIsSubmitting(true);
      const { error } = await supabase
        .from('ozdegerlendirme_raporlari')
        .update({ 
          onay_durumu: 'reddedildi', 
          red_nedeni: rejectReason.trim() 
        })
        .eq('id', selectedReportId);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Rapor reddedildi.' });
      setReports(prev => prev.filter(r => r.id !== selectedReportId));
      setIsRejectModalOpen(false);
      setSelectedReportId(null);
      setRejectReason('');
    } catch (error: any) {
      setMessage({ type: 'error', text: 'Reddedilirken hata oluştu.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredReports = reports.filter(r => 
    (r.alt_olcutler?.ad || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.alt_olcutler?.kod || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8 mx-auto max-w-6xl animate-in fade-in duration-500">
      <div className="mb-8 border-b border-slate-200 pb-6">
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
          <FileCheck className="w-7 h-7 text-blue-600" />
          Veri Onayı {coordinatorTopic ? `(${coordinatorTopic})` : ''}
        </h2>
        <p className="text-slate-500 mt-2 text-sm max-w-2xl">
          Birimlerden gelen veri girişlerini inceleyin. Uygun olanları onaylayın, eksik veya hatalı olanları red nedeni belirterek reddedin.
        </p>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-xl flex items-start gap-3 border ${
          message.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-5 h-5 mt-0.5" /> : <AlertCircle className="w-5 h-5 mt-0.5" />}
          <div>
            <h3 className="text-sm font-semibold">{message.type === 'success' ? 'Başarılı' : 'Hata'}</h3>
            <p className="text-sm opacity-90">{message.text}</p>
          </div>
        </div>
      )}

      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Ölçüt ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <div className="text-sm text-slate-500 font-medium">
          Toplam {filteredReports.length} bekleyen veri
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="bg-slate-50 border-2 border-dashed border-slate-200 p-12 rounded-2xl text-center">
          <CheckCircle2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 font-medium">Onay bekleyen veri girişi bulunmuyor.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredReports.map(report => (
            <div key={report.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden transition-all hover:border-blue-200">
              <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                      {report.alt_olcutler?.kod}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">
                      {new Date(report.olusturulma_tarihi).toLocaleDateString('tr-TR')}
                    </span>
                  </div>
                  <Link href={`/${locale}/olcutler/${report.alt_olcut_id}/ozdegerlendirme`} className="font-semibold text-lg text-blue-600 hover:text-blue-800 hover:underline transition-colors mt-1 block">
                    {report.alt_olcutler?.ad || report.alt_olcutler?.baslik || report.alt_olcutler?.isim || report.alt_olcutler?.title || 'İsim Bulunamadı'}
                  </Link>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setExpandedReport(expandedReport === report.id ? null : report.id)}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg transition-colors border"
                  >
                    <Eye className="w-4 h-4" />
                    {expandedReport === report.id ? 'Gizle' : 'İncele'}
                    {expandedReport === report.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  
                  <button
                    onClick={() => handleApprove(report.id)}
                    disabled={isSubmitting}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors shadow-sm"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Onayla
                  </button>
                  
                  <button
                    onClick={() => {
                      setSelectedReportId(report.id);
                      setIsRejectModalOpen(true);
                    }}
                    disabled={isSubmitting}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors shadow-sm"
                  >
                    <XCircle className="w-4 h-4" />
                    Reddet
                  </button>
                </div>
              </div>
              
              {expandedReport === report.id && (
                <div className="px-5 pb-5 pt-2 border-t border-slate-100 animate-in slide-in-from-top-2 duration-300">
                  <div className="bg-slate-50 p-4 rounded-xl prose prose-sm max-w-none text-slate-700" 
                       dangerouslySetInnerHTML={{ __html: report.icerik || '<p class="text-slate-400 italic">İçerik boş.</p>' }} 
                  />
                  {report.kanitlar && report.kanitlar.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Kanıtlar</h4>
                      <div className="flex flex-wrap gap-2">
                        {report.kanitlar.map((k: any, i: number) => (
                          <a key={i} href={k.url} target="_blank" rel="noopener noreferrer" 
                             className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm">
                            <MessageSquare className="w-3.5 h-3.5" />
                            {k.ad || 'Kanıt'}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Reject Modal */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
                <XCircle className="w-6 h-6 text-red-600" />
                Veriyi Reddet
              </h3>
              <p className="text-slate-500 text-sm mb-4">
                Lütfen bu veriyi neden reddettiğinizi açıklayın. Bu açıklama ilgili birim kullanıcısına iletilecektir.
              </p>
              
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Örn: Kanıtlar yetersiz, açıklama metni güncellenmeli..."
                className="w-full h-32 p-3 border rounded-xl text-sm focus:ring-2 focus:ring-red-500 outline-none resize-none"
              />
            </div>
            
            <div className="p-4 bg-slate-50 flex items-center justify-end gap-3 border-t">
              <button
                onClick={() => {
                  setIsRejectModalOpen(false);
                  setRejectReason('');
                }}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
              >
                İptal
              </button>
              <button
                onClick={handleReject}
                disabled={isSubmitting || !rejectReason.trim()}
                className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors shadow-md disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Reddet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
