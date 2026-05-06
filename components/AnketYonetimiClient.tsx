'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Loader2, Search, Send, FileText, Activity } from 'lucide-react';
import RichTextEditor from '@/components/RichTextEditor';
import { usePeriod } from '@/contexts/PeriodContext';
import { useLocale } from 'next-intl';

export default function AnketYonetimiClient() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCoordinator, setIsCoordinator] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { selectedPeriod } = usePeriod();
  const locale = useLocale();

  const [olcutler, setOlcutler] = useState<any[]>([]);
  const [altOlcutler, setAltOlcutler] = useState<any[]>([]);
  const [selectedAnaBaslik, setSelectedAnaBaslik] = useState<string>('');
  const [selectedAltOlcut, setSelectedAltOlcut] = useState<string>('');
  
  const [analizMetni, setAnalizMetni] = useState('');
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  useEffect(() => {
    async function init() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Rol kontrolü
        const { data: profile } = await supabase.from('profiller').select('rol').eq('id', user.id).single();
        const role = profile?.rol?.toLowerCase() || '';
        const userIsAdmin = role.includes('yonetici') || role.includes('yönetici') || role.includes('admin');
        setIsAdmin(userIsAdmin);

        let expectedDbBaslik: string | null = null;
        if (!userIsAdmin) {
          // Koordinatör kontrolü
          const { data: coordData } = await supabase.from('baslik_koordinatorleri').select('baslik').eq('kullanici_id', user.id).single();
          if (coordData) {
            setIsCoordinator(true);
            const baslikMap: Record<string, string> = {
              'Kalite Güvencesi': 'KALİTE GÜVENCESİ SİSTEMİ',
              'Eğitim-Öğretim': 'EĞİTİM VE ÖĞRETİM',
              'Araştırma ve Geliştirme': 'ARAŞTIRMA VE GELİŞTİRME',
              'Toplumsal Katkı': 'TOPLUMSAL KATKI',
              'Yönetim Sistemi': 'YÖNETİM SİSTEMİ'
            };
            expectedDbBaslik = baslikMap[coordData.baslik];
          } else {
            // Ne admin ne koordinatör
            setIsLoading(false);
            return;
          }
        }

        // Ana başlıkları ve ölçütleri çek
        const { data: allBasliklar } = await supabase.from('ana_basliklar').select('*');
        const { data: allOlcutlerData } = await supabase.from('olcutler').select('*');
        const { data: allAltOlcutlerData } = await supabase.from('alt_olcutler').select('*').order('kod', { ascending: true });

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

        if (userIsAdmin) {
          setOlcutler(tumOlcutler);
          if (tumOlcutler.length > 0) setSelectedAnaBaslik(tumOlcutler[0].baslik);
        } else if (expectedDbBaslik) {
          const secili = tumOlcutler.filter(o => o.baslik === expectedDbBaslik);
          setOlcutler(secili);
          if (secili.length > 0) setSelectedAnaBaslik(secili[0].baslik);
        }

      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  // Ana başlık değiştiğinde alt ölçütleri güncelle
  useEffect(() => {
    if (selectedAnaBaslik && olcutler.length > 0) {
      const secili = olcutler.find(o => o.baslik === selectedAnaBaslik);
      if (secili) {
        setAltOlcutler(secili.altOlcutler);
        setSelectedAltOlcut('');
        setAnalizMetni('');
      }
    }
  }, [selectedAnaBaslik, olcutler]);

  // Seçili ölçüte ait mevcut analizi getir
  useEffect(() => {
    async function fetchAnaliz() {
      if (!selectedAltOlcut || !selectedPeriod) {
        setAnalizMetni('');
        return;
      }
      try {
        const { data } = await supabase
          .from('ozdegerlendirme_raporlari')
          .select('yonetici_anket_analizi')
          .eq('alt_olcut_id', selectedAltOlcut)
          .eq('donem_id', selectedPeriod.id)
          .single();
        
        if (data && data.yonetici_anket_analizi) {
          setAnalizMetni(data.yonetici_anket_analizi);
        } else {
          setAnalizMetni('');
        }
      } catch (error) {
        setAnalizMetni('');
      }
    }
    fetchAnaliz();
  }, [selectedAltOlcut, selectedPeriod]);

  const handleSendAnaliz = async () => {
    if (!selectedAltOlcut || !selectedPeriod) return;
    setIsSaving(true);
    setMessage(null);
    try {
      // Önce ozdegerlendirme_raporlari tablosunda bu döneme/ölçüte ait kayıt var mı kontrol et
      const { data: existing } = await supabase
        .from('ozdegerlendirme_raporlari')
        .select('id')
        .eq('alt_olcut_id', selectedAltOlcut)
        .eq('donem_id', selectedPeriod.id)
        .single();

      if (existing) {
        // Varsa güncelle
        const { error } = await supabase
          .from('ozdegerlendirme_raporlari')
          .update({ yonetici_anket_analizi: analizMetni })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        // Yoksa yeni oluştur
        const { error } = await supabase
          .from('ozdegerlendirme_raporlari')
          .insert({
            alt_olcut_id: selectedAltOlcut,
            donem_id: selectedPeriod.id,
            yonetici_anket_analizi: analizMetni,
            icerik: '',
            kanitlar: [],
            onay_durumu: 'bekliyor'
          });
        if (error) throw error;
      }

      setMessage({ type: 'success', text: 'Analiz sonuçları birim kullanıcısına başarıyla gönderildi.' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      console.error(error);
      setMessage({ type: 'error', text: 'Kaydedilirken bir hata oluştu: ' + error.message });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="h-full flex items-center justify-center min-h-[400px]"><Loader2 className="w-10 h-10 animate-spin text-blue-600" /></div>;
  }

  if (!isAdmin && !isCoordinator) {
    return <div className="p-8 text-center text-red-500 font-bold">Bu sayfaya erişim yetkiniz yok.</div>;
  }

  return (
    <div className="p-8 max-w-5xl mx-auto animate-in fade-in duration-500">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Activity className="w-6 h-6 text-purple-600" />
          Anket Yönetimi ve Analiz Gönderimi
        </h2>
        <p className="text-slate-500 mt-2">İlgili ölçütler için anket analizlerini oluşturup birim kullanıcılarının izleme ekranlarına aktarın.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Ana Başlık (Filtre)</label>
            <select
              value={selectedAnaBaslik}
              onChange={(e) => setSelectedAnaBaslik(e.target.value)}
              className="w-full border-slate-200 rounded-xl focus:ring-purple-500 focus:border-purple-500 text-sm py-2.5 bg-slate-50"
            >
              <option value="">Seçiniz...</option>
              {olcutler.map(o => (
                <option key={o.baslik} value={o.baslik}>{o.baslik}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Alt Ölçüt</label>
            <select
              value={selectedAltOlcut}
              onChange={(e) => setSelectedAltOlcut(e.target.value)}
              disabled={!selectedAnaBaslik}
              className="w-full border-slate-200 rounded-xl focus:ring-purple-500 focus:border-purple-500 text-sm py-2.5 bg-slate-50 disabled:opacity-50"
            >
              <option value="">Alt ölçüt seçin...</option>
              {altOlcutler.map(ao => (
                <option key={ao.id} value={ao.id}>{ao.kod} - {ao.olcut_adi || ao.ad || ao.baslik}</option>
              ))}
            </select>
          </div>
        </div>

        {selectedAltOlcut && (
          <div className="animate-in fade-in duration-300">
            <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" />
              Yönetici Anket Analizi (Birim Kullanıcısına İletilecek)
            </label>
            <div className="border border-slate-200 rounded-xl overflow-hidden mb-4">
              <RichTextEditor
                content={analizMetni}
                onChange={setAnalizMetni}
                minHeight="200px"
              />
            </div>
            
            {message && (
              <div className={`p-4 rounded-xl mb-4 text-sm font-medium ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {message.text}
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={handleSendAnaliz}
                disabled={isSaving || !analizMetni.trim()}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-md transition-all disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Sonuçları Birim Kullanıcısına Gönder / İzlemeye Aktar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
