'use client';

import { useState, useEffect, use } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Loader2, Plus, Info, Save, Link as LinkIcon, Settings, CalendarDays, ExternalLink, Trash2 } from 'lucide-react';
import StepPanel from '@/components/StepPanel';
import RichTextEditor from '@/components/RichTextEditor';

interface Eylem {
  id?: number;
  iyilestirme_alani: string;
  bulgular: string;
  eylem_faaliyet: string;
  sorumlu: string;
  takvim: string;
  basari_gostergesi: string;
  izleme_durumu: string;
}

interface PhaseClientProps {
  params: Promise<{ id: string }>;
  phaseId: string;
  phaseTitle: string;
  showEylemPlanTablosu?: boolean;
}

export default function PhaseClient({ params, phaseId, phaseTitle, showEylemPlanTablosu = false }: PhaseClientProps) {
  const resolvedParams = use(params);
  const [olcutDetay, setOlcutDetay] = useState<any>(null);
  const [aciklama, setAciklama] = useState('');
  const [eylemler, setEylemler] = useState<Eylem[]>([]);
  const [dokumanlar, setDokumanlar] = useState<any[]>([]); // Array of { name: string, url: string, size?: number }
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [ustBirimOnerileri, setUstBirimOnerileri] = useState<string[]>([]);
  
  // Onay / Ret Sistematiği
  const [pukoId, setPukoId] = useState<string | null>(null);
  const [onayDurumu, setOnayDurumu] = useState<string>('');
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [isActionSubmitting, setIsActionSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from('profiller').select('rol').eq('id', user.id).single();
        const role = profile?.rol?.toLowerCase() || '';
        if (role.includes('yonetici') || role.includes('yönetici') || role.includes('admin')) {
          setIsReadOnly(true);
        }
      }
      
      const { data: olcut } = await supabase.from('alt_olcutler').select('*').eq('id', resolvedParams.id).single();
      if (olcut) setOlcutDetay(olcut);

      const { data: pukoData } = await supabase
        .from('puko_degerlendirmeleri')
        .select('*')
        .eq('alt_olcut_id', resolvedParams.id)
        .eq('puko_asamasi', phaseId)
        .order('id', { ascending: false })
        .limit(1)
        .single();

      if (pukoData) {
        setPukoId(pukoData.id);
        setOnayDurumu(pukoData.durum || 'Beklemede');
        setAciklama(pukoData.aciklama || '');
        // handle JSONB or Text array for kanit_dosyalari
        setDokumanlar(Array.isArray(pukoData.kanit_dosyalari) ? pukoData.kanit_dosyalari : []);
        setUstBirimOnerileri(Array.isArray(pukoData.ust_birim_onerileri) ? pukoData.ust_birim_onerileri : []);
      } else {
        setPukoId(null);
        setOnayDurumu('');
        setUstBirimOnerileri([]);
      }

      if (showEylemPlanTablosu) {
        const { data: eylemlerData } = await supabase
          .from('eylem_planlari')
          .select('*')
          .eq('alt_olcut_id', resolvedParams.id)
          .order('id', { ascending: true });

        if (eylemlerData && eylemlerData.length > 0) {
          setEylemler(eylemlerData);
        } else {
          setEylemler([{ iyilestirme_alani: '', bulgular: '', eylem_faaliyet: '', sorumlu: '', takvim: '', basari_gostergesi: '', izleme_durumu: '' }]);
        }
      }
      
    } catch (error) {
      console.error("Fetch Data Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [resolvedParams.id, phaseId]);

  const handleAddEylem = () => {
    setEylemler([...eylemler, { iyilestirme_alani: '', bulgular: '', eylem_faaliyet: '', sorumlu: '', takvim: '', basari_gostergesi: '', izleme_durumu: '' }]);
  };

  const handleEylemChange = (index: number, field: keyof Eylem, value: string) => {
    const newEylemler = [...eylemler];
    newEylemler[index] = { ...newEylemler[index], [field]: value };
    setEylemler(newEylemler);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const upsertData: Record<string, any> = {
        alt_olcut_id: resolvedParams.id,
        puko_asamasi: phaseId,
        aciklama: aciklama,
        kanit_dosyalari: dokumanlar,
        durum: 'Beklemede',
        red_nedeni: null
      };

      if (phaseId === 'onlem') {
        upsertData.ust_birim_onerileri = ustBirimOnerileri;
      }
      
      const { data: existingRecord } = await supabase
        .from('puko_degerlendirmeleri')
        .select('id')
        .eq('alt_olcut_id', resolvedParams.id)
        .eq('puko_asamasi', phaseId)
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

      if (showEylemPlanTablosu) {
        const toInsert = eylemler
          .filter(e => !e.id)
          .map(e => {
            const { id, ...rest } = e;
            return { ...rest, alt_olcut_id: resolvedParams.id };
          });
          
        const toUpdate = eylemler.filter(e => e.id);

        if (toInsert.length > 0) {
          const { error: eInsertErr } = await supabase.from('eylem_planlari').insert(toInsert);
          if (eInsertErr) throw eInsertErr;
        }
        for (const e of toUpdate) {
          const { id, ...updatePayload } = e;
          const { error: eUpdErr } = await supabase.from('eylem_planlari').update(updatePayload).eq('id', id);
          if (eUpdErr) throw eUpdErr;
        }
      }

      alert('Değişiklikler başarıyla kaydedildi!');
      fetchData(); 

    } catch (error: any) {
      let errMsg = 'Bilinmeyen Hata Oluştu.';
      if (error) {
        if (typeof error === 'string') errMsg = error;
        else if (error.message) errMsg = error.message;
        else if (error.details) errMsg = error.details;
        else if (error.hint) errMsg = error.hint;
        else errMsg = JSON.stringify(error, Object.getOwnPropertyNames(error));
      }
      console.error('Save Error:', error);
      alert(`Kaydetme Hatası: ${errMsg}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;
    const file = event.target.files[0];
    
    setUploadingDoc(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${resolvedParams.id}_${phaseId}_${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { data, error } = await supabase.storage.from('dokumanlar').upload(filePath, file);

      if (error) throw error;

      const { data: publicUrlData } = supabase.storage.from('dokumanlar').getPublicUrl(filePath);

      const newDoc = {
        name: file.name,
        url: publicUrlData.publicUrl,
        size: Math.round(file.size / 1024)
      };

      setDokumanlar(prev => [...prev, newDoc]);

    } catch (error: any) {
      console.error('File upload error:', error);
      alert(`Dosya yüklenemedi: ${error.message}`);
    } finally {
      setUploadingDoc(false);
      // Reset input
      event.target.value = '';
    }
  };

  const handleRemoveDoc = (index: number) => {
    if (confirm("Bu dokümanı silmek istediğinize emin misiniz? (Kaydet butonuna bastığınızda veritabanında güncellenecektir)")) {
        setDokumanlar(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleApprove = async () => {
    if (!pukoId) return;
    setIsActionSubmitting(true);
    try {
      const { error } = await supabase.from('puko_degerlendirmeleri').update({ durum: 'Onaylandı', red_nedeni: null }).eq('id', pukoId);
      if (error) throw error;
      setOnayDurumu('Onaylandı');
      alert('Süreç başarıyla onaylandı.');
    } catch (err: any) {
      alert(`Onay sırasında hata: ${err.message}`);
    } finally {
      setIsActionSubmitting(false);
    }
  };

  const handleRejectSubmit = async () => {
    if (!pukoId || !rejectReason.trim()) {
      alert("Lütfen red nedeni giriniz.");
      return;
    }
    setIsActionSubmitting(true);
    try {
      const { error } = await supabase.from('puko_degerlendirmeleri').update({ durum: 'Reddedildi', red_nedeni: rejectReason }).eq('id', pukoId);
      if (error) throw error;
      setOnayDurumu('Reddedildi');
      setIsRejectModalOpen(false);
      setRejectReason('');
      alert('Süreç reddedildi.');
    } catch (err: any) {
      alert(`Red işlemi sırasında hata: ${err.message}`);
    } finally {
      setIsActionSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="h-full flex items-center justify-center p-20"><Loader2 className="w-10 h-10 animate-spin text-blue-600" /></div>;
  }

  return (
    <>
      <div className="p-8 max-w-[1400px] mx-auto animate-in fade-in duration-500">
        <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col gap-2">
            <div className="text-sm text-slate-500 flex items-center gap-2 font-medium">
              <span className="cursor-pointer hover:text-blue-600">Ana Sayfa</span> &gt; 
              <span className="cursor-pointer hover:text-blue-600">Ölçütler</span> &gt;
              <span className="text-slate-800">{[olcutDetay?.kod, olcutDetay?.olcut_adi].filter(Boolean).join(' ') || `Ölçüt #${resolvedParams.id}`}</span>
            </div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold text-slate-800">
                {[olcutDetay?.kod, olcutDetay?.olcut_adi].filter(Boolean).join(' ') || `Ölçüt #${resolvedParams.id}`}
              </h2>
              <Info className="w-4 h-4 text-slate-400 cursor-pointer" />
            </div>
            <p className="text-sm text-slate-500">Alt ölçüt ile ilgili {phaseTitle} süreci yönetimi.</p>
          </div>
          
          {isReadOnly && pukoId && (
            <div className="flex items-center gap-3">
              <div className={`px-4 py-1.5 rounded-lg text-sm font-bold border ${
                onayDurumu === 'Onaylandı' ? 'bg-green-50 text-green-700 border-green-200' : 
                onayDurumu === 'Reddedildi' ? 'bg-red-50 text-red-700 border-red-200' :
                'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {onayDurumu}
              </div>
              <button 
                onClick={handleApprove}
                disabled={isActionSubmitting || onayDurumu === 'Onaylandı'}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm"
              >
                Onayla
              </button>
              <button 
                onClick={() => setIsRejectModalOpen(true)}
                disabled={isActionSubmitting || onayDurumu === 'Reddedildi'}
                className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm"
              >
                Reddet
              </button>
            </div>
          )}
        </div>

      <StepPanel activeStepId={phaseId} altOlcutId={resolvedParams.id} />

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 border-b border-slate-200">
          
          <div className="col-span-2 p-6 lg:border-r border-slate-200">
            <h3 className="flex items-center gap-2 font-semibold text-slate-700 mb-4 text-sm">
              <Settings className="w-4 h-4 text-blue-600" />
              {phaseTitle} Süreci Açıklaması
              {isReadOnly && <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] rounded border border-amber-200">Salt Okunur</span>}
            </h3>
            <div className="w-full">
              <RichTextEditor content={aciklama} onChange={setAciklama} readOnly={isReadOnly} />
            </div>
            <div className="flex justify-end mt-2 text-xs text-slate-400">
              Sözcük sayısı: {aciklama.replace(/<[^>]*>?/gm, '').split(/\s+/).filter(w => w.length > 0).length}
            </div>
          </div>

          <div className="col-span-1 p-6 bg-[#F8FAFC]">
            <h3 className="flex items-center justify-between font-semibold text-slate-700 mb-4 text-sm">
              <span className="flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-slate-500" />
                İlgili Dokümanlar
              </span>
            </h3>
            
            <div className="space-y-3 mb-4">
              {dokumanlar.length === 0 ? (
                <div className="text-sm text-slate-400 italic text-center py-4 bg-white border border-slate-200 border-dashed rounded-lg">
                  Henüz doküman eklenmemiş.
                </div>
              ) : (
                dokumanlar.map((doc, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 bg-white border border-slate-200 rounded-lg shadow-sm group">
                    <div className="flex-1 overflow-hidden">
                      <p className="text-sm font-medium text-slate-700 truncate" title={doc.name}>{doc.name}</p>
                      <p className="text-[11px] text-slate-500">{doc.size ? `${doc.size} KB` : 'Belgisiz Boyut'}</p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <a href={doc.url} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-blue-50 text-blue-600 rounded flex-shrink-0 hover:bg-blue-100" title="İndir/Gör">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      {!isReadOnly && (
                        <button onClick={(e) => { e.preventDefault(); handleRemoveDoc(idx); }} className="p-1.5 bg-red-50 text-red-600 rounded flex-shrink-0 hover:bg-red-100" title="Sil">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {!isReadOnly && (
            <div className="relative">
              <input 
                type="file" 
                id={`doc-upload-${phaseId}`} 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed" 
                onChange={handleFileUpload}
                disabled={uploadingDoc || isReadOnly}
              />
              <button disabled={uploadingDoc || isReadOnly} className="w-full py-2 border border-dashed border-blue-300 text-blue-600 text-sm font-medium rounded-lg bg-blue-50/50 hover:bg-blue-100/50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                {uploadingDoc ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {uploadingDoc ? 'Yükleniyor...' : 'Doküman Ekle'}
              </button>
            </div>
            )}
          </div>
        </div>

        {phaseId === 'onlem' && (
          <div className="p-6 border-b border-slate-200 bg-amber-50/30">
            <div className="flex items-center justify-between mb-4">
              <h3 className="flex items-center gap-2 font-semibold text-slate-800 text-sm">
                <Plus className="w-4 h-4 text-amber-600 font-normal" />
                Üst Birimler İçin Öneri
              </h3>
              {!isReadOnly && (
                <button 
                  onClick={() => setUstBirimOnerileri([...ustBirimOnerileri, ''])}
                  className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Yeni Öneri Ekle
                </button>
              )}
            </div>
            
            {ustBirimOnerileri.length === 0 ? (
              <div className="text-center py-6 bg-white border border-dashed border-slate-300 rounded-lg">
                <p className="text-sm text-slate-500">Üst yönetime veya diğer birimlere sunulacak bir öneriniz varsa "Yeni Öneri Ekle" butonuna basınız.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {ustBirimOnerileri.map((oneri, index) => (
                  <div key={index} className="flex items-start gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative group">
                    <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-2">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <textarea
                        disabled={isReadOnly}
                        value={oneri}
                        onChange={(e) => {
                          const newOneriler = [...ustBirimOnerileri];
                          newOneriler[index] = e.target.value;
                          setUstBirimOnerileri(newOneriler);
                        }}
                        placeholder="Önerinizi buraya detaylıca yazın..."
                        className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm text-slate-700 resize-none outline-none disabled:bg-transparent"
                        rows={3}
                      />
                    </div>
                    {!isReadOnly && (
                      <button 
                        onClick={() => {
                          const newOneriler = ustBirimOnerileri.filter((_, i) => i !== index);
                          setUstBirimOnerileri(newOneriler);
                        }}
                        className="absolute top-2 right-2 p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-500 rounded transition-colors opacity-0 group-hover:opacity-100"
                        title="Öneriyi Sil"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {showEylemPlanTablosu && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="flex items-center gap-2 font-semibold text-slate-700 text-sm">
                <CalendarDays className="w-4 h-4 text-blue-600 font-normal" />
                Takvimli Eylem Planı (2023-2024)
              </h3>
              {!isReadOnly && (
              <button 
                onClick={handleAddEylem}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Yeni Eylem Ekle
              </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border border-slate-200 rounded-lg overflow-hidden">
                <thead className="bg-[#F8FAFC] text-slate-600 text-xs font-semibold whitespace-nowrap">
                  <tr>
                    <th className="px-4 py-3 border-b border-r border-slate-200" style={{width: '15%'}}>İyileştirme Alanı</th>
                    <th className="px-4 py-3 border-b border-r border-slate-200" style={{width: '20%'}}>Bulgular</th>
                    <th className="px-4 py-3 border-b border-r border-slate-200" style={{width: '18%'}}>Eylem / Faaliyet</th>
                    <th className="px-4 py-3 border-b border-r border-slate-200" style={{width: '12%'}}>Sorumlu Birim</th>
                    <th className="px-4 py-3 border-b border-r border-slate-200" style={{width: '10%'}}>Takvim</th>
                    <th className="px-4 py-3 border-b border-r border-slate-200" style={{width: '13%'}}>Başarı Göstergesi</th>
                    <th className="px-4 py-3 border-b border-slate-200" style={{width: '12%'}}>İzleme</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {eylemler.map((eylem, index) => (
                    <tr key={index} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="p-2 border-r border-slate-100"><textarea disabled={isReadOnly} className="w-full h-full min-h-[60px] p-2 text-xs border-transparent rounded resize-none focus:ring-1 focus:ring-blue-500 disabled:bg-transparent disabled:opacity-80" value={eylem.iyilestirme_alani} onChange={(e) => handleEylemChange(index, 'iyilestirme_alani', e.target.value)} /></td>
                      <td className="p-2 border-r border-slate-100"><textarea disabled={isReadOnly} className="w-full h-full min-h-[60px] p-2 text-xs border-transparent rounded resize-none focus:ring-1 focus:ring-blue-500 disabled:bg-transparent disabled:opacity-80" value={eylem.bulgular} onChange={(e) => handleEylemChange(index, 'bulgular', e.target.value)} /></td>
                      <td className="p-2 border-r border-slate-100"><textarea disabled={isReadOnly} className="w-full h-full min-h-[60px] p-2 text-xs border-transparent rounded resize-none focus:ring-1 focus:ring-blue-500 disabled:bg-transparent disabled:opacity-80" value={eylem.eylem_faaliyet} onChange={(e) => handleEylemChange(index, 'eylem_faaliyet', e.target.value)} /></td>
                      <td className="p-2 border-r border-slate-100"><textarea disabled={isReadOnly} className="w-full h-full min-h-[60px] p-2 text-xs border-transparent rounded resize-none focus:ring-1 focus:ring-blue-500 disabled:bg-transparent disabled:opacity-80" value={eylem.sorumlu} onChange={(e) => handleEylemChange(index, 'sorumlu', e.target.value)} /></td>
                      <td className="p-2 border-r border-slate-100"><textarea disabled={isReadOnly} className="w-full h-full min-h-[60px] p-2 text-xs border-transparent rounded resize-none focus:ring-1 focus:ring-blue-500 disabled:bg-transparent disabled:opacity-80" value={eylem.takvim} onChange={(e) => handleEylemChange(index, 'takvim', e.target.value)} /></td>
                      <td className="p-2 border-r border-slate-100"><textarea disabled={isReadOnly} className="w-full h-full min-h-[60px] p-2 text-xs border-transparent rounded resize-none focus:ring-1 focus:ring-blue-500 disabled:bg-transparent disabled:opacity-80" value={eylem.basari_gostergesi} onChange={(e) => handleEylemChange(index, 'basari_gostergesi', e.target.value)} /></td>
                      <td className="p-2"><textarea disabled={isReadOnly} className="w-full h-full min-h-[60px] p-2 text-xs border-transparent rounded resize-none focus:ring-1 focus:ring-blue-500 disabled:bg-transparent disabled:opacity-80" value={eylem.izleme_durumu} onChange={(e) => handleEylemChange(index, 'izleme_durumu', e.target.value)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Ortak Kaydet Butonu */}
        {!isReadOnly && (
        <div className="flex justify-end p-6 pt-0 mt-4">
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-sm disabled:opacity-70"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isSaving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
        )}

      </div>
    </div>
      
      {/* Reject Modal */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                Kaydı Reddet
              </h3>
              <button 
                onClick={() => setIsRejectModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
                disabled={isActionSubmitting}
              >
                Kapat
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-500 leading-relaxed">
                Bu PUKÖ değerlendirmesini reddetmek üzeresiniz. Lütfen eksiklik için red nedeni giriniz.
              </p>
              
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">Red Nedeni (<span className="text-red-500">*</span>)</label>
                <textarea 
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Örn: Yüklenen kanıt dosyası eksik..."
                  rows={4}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all text-sm resize-none"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button 
                onClick={() => setIsRejectModalOpen(false)}
                disabled={isActionSubmitting}
                className="px-5 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors"
              >
                İptal
              </button>
              <button 
                onClick={handleRejectSubmit}
                disabled={isActionSubmitting || !rejectReason.trim()}
                className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-red-600 border border-red-600 rounded-xl hover:bg-red-700 transition-colors shadow-sm disabled:opacity-50"
              >
                {isActionSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Onayla & Reddet
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
