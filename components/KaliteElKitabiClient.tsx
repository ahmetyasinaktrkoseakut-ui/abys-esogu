'use client';

import { useState, useEffect, use } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Loader2, Save, Info, Download, FileText } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import StepPanel from '@/components/StepPanel';
import { getLocalizedField } from '@/lib/i18n-utils';
import { usePeriod } from '@/contexts/PeriodContext';

interface KaliteData {
  sorumlu_birim: string;
  ilk_planlama_tarihi: string;
  ic_paydaslar: string;
  dis_paydaslar: string;
  uluslararasi_paydaslar: string;
  uygulama_alanlari: string;
  izleme_mekanizmalari: string;
  performans_gostergeleri: string;
  degerlendirme_iyilestirme_tarihi: string;
  bgs_yeri: string;
}

const initialData: KaliteData = {
  sorumlu_birim: '',
  ilk_planlama_tarihi: '',
  ic_paydaslar: '',
  dis_paydaslar: '',
  uluslararasi_paydaslar: '',
  uygulama_alanlari: '',
  izleme_mekanizmalari: '',
  performans_gostergeleri: '',
  degerlendirme_iyilestirme_tarihi: '',
  bgs_yeri: '',
};

export default function KaliteElKitabiClient({ params }: { params?: Promise<{ id: string }> }) {
  const resolvedParams = params ? use(params) : null;
  const [olcutDetay, setOlcutDetay] = useState<any>(null);
  const [formData, setFormData] = useState<KaliteData>(initialData);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const t = useTranslations('Phase');
  const locale = useLocale();
  const { selectedPeriod } = usePeriod();

  useEffect(() => {
    if (resolvedParams?.id) {
      fetchData();
    } else {
      setIsLoading(false);
    }
  }, [resolvedParams?.id, selectedPeriod]);

  const fetchData = async () => {
    if (!selectedPeriod) return;
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
      
      const { data: olcut } = await supabase.from('alt_olcutler').select('*').eq('id', resolvedParams?.id).single();
      if (olcut) {
        setOlcutDetay(olcut);
        if (olcut.kalite_el_kitabi) {
          setFormData({ ...initialData, ...olcut.kalite_el_kitabi });
        }
      }
    } catch (error) {
      console.error("Fetch Data Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: keyof KaliteData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('alt_olcutler')
        .update({ kalite_el_kitabi: formData })
        .eq('id', resolvedParams?.id);

      if (error) throw error;
      alert("Kalite El Kitabı başarıyla kaydedildi.");
    } catch (error: any) {
      console.error('Save Error:', error);
      alert(`Kaydetme hatası: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="h-full flex items-center justify-center p-20"><Loader2 className="w-10 h-10 animate-spin text-blue-600" /></div>;
  }

  const labelStyle = "bg-blue-600 text-white p-4 font-bold text-sm border-b border-blue-500 flex items-center";
  const inputStyle = "w-full p-4 text-sm bg-blue-50/30 border-b border-blue-100 focus:bg-white focus:outline-none transition-colors disabled:opacity-80";

  return (
    <div className="p-8 max-w-[1400px] mx-auto animate-in fade-in duration-500">
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="text-sm text-slate-500 flex items-center gap-2 font-medium">
            <span className="cursor-pointer hover:text-blue-600">Ana Sayfa</span> &gt; 
            <span className="cursor-pointer hover:text-blue-600">Ölçütler</span> &gt;
            <span className="text-slate-800">{[olcutDetay?.kod, getLocalizedField(olcutDetay, 'olcut_adi', locale)].filter(Boolean).join(' ')}</span>
          </div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-slate-800">
              Kalite El Kitabı Veri Girişi
            </h2>
            <Info className="w-4 h-4 text-slate-400" />
          </div>
        </div>
      </div>

      {resolvedParams?.id && <StepPanel activeStepId="kalite_el_kitabi" altOlcutId={resolvedParams.id} />}

      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden mb-10">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th colSpan={2} className="bg-blue-600 text-white p-5 text-xl font-black text-left tracking-tight">
                Tablo 1. {[olcutDetay?.kod, getLocalizedField(olcutDetay, 'olcut_adi', locale)].filter(Boolean).join(' ')}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={labelStyle} style={{width: '30%'}}>Sorumlu Birim</td>
              <td className="p-0">
                <input 
                  type="text" 
                  value={formData.sorumlu_birim} 
                  onChange={(e) => handleInputChange('sorumlu_birim', e.target.value)}
                  disabled={isReadOnly}
                  className={inputStyle}
                  placeholder="Birim adını giriniz..."
                />
              </td>
            </tr>
            <tr>
              <td className={labelStyle}>İlk Planlama Tarihi</td>
              <td className="p-0">
                <input 
                  type="date" 
                  value={formData.ilk_planlama_tarihi} 
                  onChange={(e) => handleInputChange('ilk_planlama_tarihi', e.target.value)}
                  disabled={isReadOnly}
                  className={inputStyle}
                />
              </td>
            </tr>
            <tr>
              <td className={labelStyle}>İç Paydaşlar</td>
              <td className="p-0">
                <textarea 
                  value={formData.ic_paydaslar} 
                  onChange={(e) => handleInputChange('ic_paydaslar', e.target.value)}
                  disabled={isReadOnly}
                  className={`${inputStyle} min-h-[100px] resize-none`}
                  placeholder="İç paydaşları listeleyiniz..."
                />
              </td>
            </tr>
            <tr>
              <td className={labelStyle}>Dış Paydaşlar</td>
              <td className="p-0">
                <textarea 
                  value={formData.dis_paydaslar} 
                  onChange={(e) => handleInputChange('dis_paydaslar', e.target.value)}
                  disabled={isReadOnly}
                  className={`${inputStyle} min-h-[100px] resize-none`}
                  placeholder="Dış paydaşları listeleyiniz..."
                />
              </td>
            </tr>
            <tr>
              <td className={labelStyle}>Uluslararası Paydaşlar</td>
              <td className="p-0">
                <textarea 
                  value={formData.uluslararasi_paydaslar} 
                  onChange={(e) => handleInputChange('uluslararasi_paydaslar', e.target.value)}
                  disabled={isReadOnly}
                  className={`${inputStyle} min-h-[100px] resize-none`}
                  placeholder="Uluslararası paydaşları listeleyiniz..."
                />
              </td>
            </tr>
            <tr>
              <td className={labelStyle}>Uygulama Alanları</td>
              <td className="p-0">
                <textarea 
                  value={formData.uygulama_alanlari} 
                  onChange={(e) => handleInputChange('uygulama_alanlari', e.target.value)}
                  disabled={isReadOnly}
                  className={`${inputStyle} min-h-[100px] resize-none`}
                  placeholder="Uygulama alanlarını belirtiniz..."
                />
              </td>
            </tr>
            <tr>
              <td className={labelStyle}>İzleme Mekanizmaları</td>
              <td className="p-0">
                <textarea 
                  value={formData.izleme_mekanizmalari} 
                  onChange={(e) => handleInputChange('izleme_mekanizmalari', e.target.value)}
                  disabled={isReadOnly}
                  className={`${inputStyle} min-h-[100px] resize-none`}
                  placeholder="İzleme süreçlerini açıklayınız..."
                />
              </td>
            </tr>
            <tr>
              <td className={labelStyle}>Performans Göstergeleri</td>
              <td className="p-0">
                <textarea 
                  value={formData.performans_gostergeleri} 
                  onChange={(e) => handleInputChange('performans_gostergeleri', e.target.value)}
                  disabled={isReadOnly}
                  className={`${inputStyle} min-h-[100px] resize-none`}
                  placeholder="Ölçülebilir göstergeleri giriniz..."
                />
              </td>
            </tr>
            <tr>
              <td className={labelStyle}>Değerlendirme ve İyileştirme Tarihi</td>
              <td className="p-0">
                <input 
                  type="date" 
                  value={formData.degerlendirme_iyilestirme_tarihi} 
                  onChange={(e) => handleInputChange('degerlendirme_iyilestirme_tarihi', e.target.value)}
                  disabled={isReadOnly}
                  className={inputStyle}
                />
              </td>
            </tr>
            <tr>
              <td className={labelStyle + " border-b-0"}>Alt Ölçütün Bilgi Yönetim Sistemindeki Yeri</td>
              <td className="p-0">
                <textarea 
                  value={formData.bgs_yeri} 
                  onChange={(e) => handleInputChange('bgs_yeri', e.target.value)}
                  disabled={isReadOnly}
                  className={`${inputStyle} border-b-0 min-h-[100px] resize-none`}
                  placeholder="BYS üzerindeki konumunu belirtiniz..."
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {!isReadOnly && (
        <div className="flex justify-end mb-10">
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-3 bg-emerald-600 hover:bg-emerald-700 text-white px-10 py-4 rounded-2xl font-black transition-all shadow-xl hover:scale-105 active:scale-95 disabled:opacity-70"
          >
            {isSaving ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
            {isSaving ? "KAYDEDİLİYOR..." : "KALİTE EL KİTABINI KAYDET"}
          </button>
        </div>
      )}
    </div>
  );
}
