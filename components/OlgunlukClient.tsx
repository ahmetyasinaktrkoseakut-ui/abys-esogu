'use client';

import { useState, useEffect, use } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Loader2, Info, Save, Settings, Star } from 'lucide-react';
import StepPanel from '@/components/StepPanel';
import RichTextEditor from '@/components/RichTextEditor';
import { useLocale } from 'next-intl';
import { getLocalizedField } from '@/lib/i18n-utils';
import { usePeriod } from '@/contexts/PeriodContext';

interface OlgunlukClientProps {
  params: Promise<{ id: string }>;
}

export default function OlgunlukClient({ params }: OlgunlukClientProps) {
  const resolvedParams = use(params);
  const [olcutDetay, setOlcutDetay] = useState<any>(null);
  const [aciklama, setAciklama] = useState('');
  const [olgunlukPuani, setOlgunlukPuani] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const locale = useLocale();
  const { selectedPeriod } = usePeriod();

  const fetchData = async () => {
    if (!selectedPeriod) return;
    try {
    async function fetchData() {
      if (!selectedPeriod) {
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase.from('profiller').select('rol').eq('id', user.id).single();
          const role = profile?.rol?.toLowerCase() || '';
          if (role.includes('yonetici') || role.includes('yönetici') || role.includes('admin') || selectedPeriod?.is_active === false) {
            setIsReadOnly(true);
          }
        }
        
        const { data: olcut } = await supabase.from('alt_olcutler').select('*').eq('id', resolvedParams.id).single();
        if (olcut) setOlcutDetay(olcut);

        const { data: pukoData } = await supabase
          .from('puko_degerlendirmeleri')
          .select('*')
          .eq('alt_olcut_id', resolvedParams.id)
          .eq('puko_asamasi', 'olgunluk')
          .eq('donem_id', selectedPeriod?.id)
          .order('id', { ascending: false })
          .limit(1)
          .single();

      if (pukoData) {
        setAciklama(pukoData.aciklama || '');
        setOlgunlukPuani(pukoData.olgunluk_puani || 0);
      }
    } catch (error) {
      console.error("Fetch Data Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [resolvedParams.id, selectedPeriod]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const upsertData: Record<string, any> = {
        alt_olcut_id: resolvedParams.id,
        puko_asamasi: 'olgunluk',
        donem_id: selectedPeriod?.id,
        aciklama: aciklama,
        olgunluk_puani: olgunlukPuani,
        durum: 'Beklemede',
        red_nedeni: null
      };
      
      const { data: existingRecord } = await supabase
        .from('puko_degerlendirmeleri')
        .select('id')
        .eq('alt_olcut_id', resolvedParams.id)
        .eq('puko_asamasi', 'olgunluk')
        .eq('donem_id', selectedPeriod?.id)
        .maybeSingle();

      if (existingRecord?.id) {
        const { error: updateErr } = await supabase
          .from('puko_degerlendirmeleri')
          .update(upsertData)
          .eq('id', existingRecord.id);
        if (updateErr) throw updateErr;
      } else {
        const { error: insertErr } = await supabase
          .from('puko_degerlendirmeleri')
          .insert(upsertData);
        if (insertErr) throw insertErr;
      }

      alert('Olgunluk puanı ve değerlendirmesi başarıyla kaydedildi!');
      fetchData(); 
    } catch (error: any) {
      console.error('Save Error:', error);
      alert(`Kaydetme Hatası: ${error.message || 'Bilinmeyen Hata'}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="h-full flex items-center justify-center p-20"><Loader2 className="w-10 h-10 animate-spin text-blue-600" /></div>;
  }

  const puanAciklamalari = [
    "Henüz süreç başlamadı veya planlama aşamasında.",
    "Süreç planlandı ancak uygulama kısıtlı.",
    "Süreç kısmen uygulanıyor ve bazı sonuçlar alınıyor.",
    "Süreç tam uygulanıyor, sonuçlar izleniyor ve analiz ediliyor.",
    "Süreç kurumsallaştı, sürekli iyileştiriliyor ve örnek teşkil ediyor."
  ];

  return (
    <div className="p-8 max-w-[1400px] mx-auto animate-in fade-in duration-500">
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="text-sm text-slate-500 flex items-center gap-2 font-medium">
            <span className="cursor-pointer hover:text-blue-600">Ana Sayfa</span> &gt; 
            <span className="cursor-pointer hover:text-blue-600">Ölçütler</span> &gt;
            <span className="text-slate-800">{[olcutDetay?.kod, getLocalizedField(olcutDetay, 'olcut_adi', locale)].filter(Boolean).join(' ') || `Ölçüt #${resolvedParams.id}`}</span>
          </div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-slate-800">
              {[olcutDetay?.kod, getLocalizedField(olcutDetay, 'olcut_adi', locale)].filter(Boolean).join(' ') || `Ölçüt #${resolvedParams.id}`}
            </h2>
            <Info className="w-4 h-4 text-slate-400 cursor-pointer" />
          </div>
          <p className="text-sm text-slate-500">Sürecin mevcut olgunluk düzeyini puanlayın ve gerekçelendirin.</p>
        </div>
      </div>

      <StepPanel activeStepId="olgunluk" altOlcutId={resolvedParams.id} />

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
        <div className="p-8 border-b border-slate-200 flex flex-col items-center justify-center bg-gradient-to-b from-orange-50 to-white">
          <h3 className="text-xl font-bold text-slate-800 mb-6">Süreç Olgunluk Puanı</h3>
          <div className="flex items-center justify-center gap-4 mb-4">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                disabled={isReadOnly}
                onClick={() => setOlgunlukPuani(star)}
                className={`transition-all duration-300 transform hover:scale-110 disabled:cursor-not-allowed disabled:hover:scale-100 ${
                  olgunlukPuani >= star ? 'text-amber-400 drop-shadow-md' : 'text-slate-200'
                }`}
              >
                <Star className={`w-14 h-14 ${olgunlukPuani >= star ? 'fill-current' : ''}`} />
              </button>
            ))}
          </div>
          <div className="h-6">
            {olgunlukPuani > 0 && (
              <p className="text-amber-600 font-semibold text-center animate-in fade-in slide-in-from-bottom-2">
                {olgunlukPuani} Puan: {puanAciklamalari[olgunlukPuani - 1]}
              </p>
            )}
            {olgunlukPuani === 0 && (
               <p className="text-slate-400 font-medium text-center italic">Lütfen bir puan seçiniz.</p>
            )}
          </div>
        </div>

        <div className="p-6">
          <h3 className="flex items-center gap-2 font-semibold text-slate-700 mb-4 text-sm">
            <Settings className="w-4 h-4 text-orange-600" />
            Olgunluk Düzeyi Gerekçesi (Açıklama)
            {isReadOnly && <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] rounded border border-amber-200">Salt Okunur</span>}
          </h3>
          <div className="w-full">
            <RichTextEditor content={aciklama} onChange={setAciklama} readOnly={isReadOnly} />
          </div>
        </div>

        {!isReadOnly && (
          <div className="flex justify-end p-6 pt-0 mt-4 border-t border-slate-100 bg-slate-50/50">
            <button 
              onClick={handleSave}
              disabled={isSaving || olgunlukPuani === 0}
              className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-8 py-3 rounded-xl text-sm font-bold transition-all shadow-md hover:shadow-lg disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              {isSaving ? 'Kaydediliyor...' : 'Puanı ve Gerekçeyi Kaydet'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
