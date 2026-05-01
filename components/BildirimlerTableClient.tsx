'use client';

import { useState, useEffect } from 'react';
import { Presentation, Activity, Calendar, Info, Hash, Upload, X, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from '@/i18n/routing';
import { useLocale } from 'next-intl';
import { getLocalizedField } from '@/lib/i18n-utils';

const getAsamaSlug = (asama: string) => {
  if (!asama) return 'kontrol-etme';
  const lower = asama.toLowerCase();
  const map: Record<string, string> = {
    'kalite_el_kitabi': 'kalite-el-kitabi',
    'planlama': 'planlama',
    'uygulama': 'uygulama',
    'kontrol': 'kontrol-etme',
    'onlem': 'iyilestirme',
    'önlem': 'iyilestirme',
    'olgunluk': 'olgunluk',
    'rapor': 'ozdegerlendirme'
  };
  return map[lower] || lower;
};

export default function BildirimlerTableClient({ initialData }: { initialData: any[] }) {
  const [data, setData] = useState(initialData);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<any>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const router = useRouter();
  const locale = useLocale();

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  useEffect(() => {
    const channel = supabase
      .channel('public:puko_degerlendirmeleri_table')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'puko_degerlendirmeleri' }, () => {
        router.refresh();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  const getPukoBadgeColor = (asama: string) => {
    const lower = (asama || '').toLowerCase();
    if (lower.includes('planla')) return 'bg-amber-100 text-amber-700 border-amber-200';
    if (lower.includes('uygula')) return 'bg-blue-100 text-blue-700 border-blue-200';
    if (lower.includes('kontrol')) return 'bg-purple-100 text-purple-700 border-purple-200';
    if (lower.includes('önlem') || lower.includes('onlem')) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const getStatusBadge = (durum: string) => {
    const lower = (durum || '').toLowerCase();
    if (lower === 'onaylandı' || lower === 'onaylandi') {
      return <span className="bg-green-100 text-green-700 border border-green-200 px-3 py-1 rounded-full text-xs font-bold w-24 text-center inline-block shadow-sm">Onaylandı</span>;
    }
    if (lower === 'reddedildi') {
      return <span className="bg-red-100 text-red-700 border border-red-200 px-3 py-1 rounded-full text-xs font-bold w-24 text-center inline-block shadow-sm">Reddedildi</span>;
    }
    return <span className="bg-amber-100 text-amber-700 border border-amber-200 px-3 py-1 rounded-full text-xs font-bold w-24 text-center inline-block shadow-sm">Beklemede</span>;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR');
  };

  const currentData = data || [];

  const handleOpenRevize = (row: any) => {
    setSelectedRow(row);
    setFile(null);
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleRevizeSubmit = async () => {
    if (!file || !selectedRow) return;
    
    setIsSubmitting(true);
    setModalError(null);

    try {
      // 1. Upload new file
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('kanit_dosyalari')
        .upload(fileName, file);

      if (uploadError) throw new Error('Dosya yükleme hatası: ' + uploadError.message);

      const { data: urlData } = supabase.storage
        .from('kanit_dosyalari')
        .getPublicUrl(fileName);
        
      const fileUrl = urlData.publicUrl;

      // 2. Update database record
      const { error: dbError } = await supabase
        .from('puko_degerlendirmeleri')
        .update({
          kanit_dosya_url: fileUrl,
          durum: 'Beklemede',
          red_nedeni: null
        })
        .eq('id', selectedRow.id);

      if (dbError) throw new Error('Güncelleme hatası: ' + dbError.message);

      // 3. Update local state
      setData(prev => prev.map(item => {
        if (item.id === selectedRow.id) {
          return {
            ...item,
            kanit_dosya_url: fileUrl,
            durum: 'Beklemede',
            red_nedeni: null
          };
        }
        return item;
      }));

      // Close modal
      setIsModalOpen(false);

    } catch (err: any) {
      setModalError(err.message || 'Revize işlemi tamamlanamadı.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <Hash className="w-4 h-4" /> Kriter
                  </div>
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4" /> Aşama
                  </div>
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" /> Tarih
                  </div>
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">
                  Durum
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Açıklama / İşlemler
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {currentData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-20 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <Presentation className="w-12 h-12 text-slate-200 mb-3" />
                      <p className="text-sm font-medium text-slate-500">Henüz bir veri girişi yapmadınız</p>
                      <p className="text-xs mt-1 text-slate-400">PUKÖ Yönetimi sekmesinden form gönderebilirsiniz.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                currentData.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div 
                        className="flex items-center gap-2 cursor-pointer group"
                        onClick={() => router.push(`/olcutler/${row.alt_olcut_id}/${getAsamaSlug(row.puko_asamasi)}`)}
                      >
                        <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded group-hover:bg-blue-100 group-hover:text-blue-700 transition-colors">
                          {row.alt_olcutler?.kod || '-'}
                        </span>
                        <div className="text-sm font-medium text-slate-700 max-w-[200px] truncate group-hover:text-blue-600 transition-colors" title={getLocalizedField(row.alt_olcutler, 'olcut_adi', locale)}>
                          {getLocalizedField(row.alt_olcutler, 'olcut_adi', locale) || 'Bilinmeyen Kriter'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold border capitalize ${getPukoBadgeColor(row.puko_asamasi)}`}>
                        {row.puko_asamasi || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-slate-500">
                        {formatDate(row.olusturulma_tarihi || row.created_at)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {getStatusBadge(row.durum)}
                    </td>
                    <td className="px-6 py-4">
                      {(row.durum || '').toLowerCase() === 'reddedildi' ? (
                        <div className="flex flex-col gap-3">
                          {row.red_nedeni && (
                            <div className="flex items-start gap-2 bg-red-50 p-3 rounded-xl border border-red-100">
                              <Info className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                              <p className="text-xs text-red-700 leading-relaxed font-medium">
                                {row.red_nedeni}
                              </p>
                            </div>
                          )}
                          <div>
                            <button
                              onClick={() => handleOpenRevize(row)}
                              className="text-xs font-semibold px-3 py-2 bg-white text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors shadow-sm flex items-center gap-1.5"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              Revize Et / Yeni Kanıt
                            </button>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Müdahale gerekmiyor</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Revize Modal */ }
      {isModalOpen && selectedRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Upload className="w-5 h-5 text-blue-600" />
                Revize İşlemi
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors focus:outline-none"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="mb-4 bg-orange-50 border border-orange-200 p-3 rounded-xl text-sm text-orange-800">
                <p className="font-semibold mb-1">Reddedilen Kriter: {selectedRow.alt_olcutler?.kod}</p>
                <p className="text-xs opacity-90">{selectedRow.red_nedeni}</p>
              </div>

              {modalError && (
                <div className="mb-4 p-3 rounded-xl text-sm font-medium border bg-red-50 text-red-700 border-red-200">
                  {modalError}
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">
                  Yeni Kanıt Dosyası Yükle
                </label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-xl hover:border-blue-400 transition-colors bg-slate-50">
                  <div className="space-y-1 text-center">
                    <Upload className="mx-auto h-12 w-12 text-slate-400 mb-3" />
                    <div className="flex text-sm text-slate-600 justify-center">
                      <label htmlFor="file-upload-revize" className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500 px-2 py-1 shadow-sm border border-slate-200">
                        <span>Dosya Seç</span>
                        <input id="file-upload-revize" name="file-upload-revize" type="file" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                      </label>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      {file ? <span className="font-semibold text-blue-600">{file.name}</span> : 'PDF, DOCX, ZIP veya resim'}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-2 italic">Yeni kanıt dosyası yüklemeniz ile birlikte form durumu "Beklemede" olarak güncellenecek ve yöneticinin tekrar incelemesine sunulacaktır.</p>
              </div>

              <div className="mt-8 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={handleRevizeSubmit}
                  disabled={isSubmitting || !file}
                  className="flex justify-center items-center gap-2 px-6 py-3 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-sm shadow-blue-500/30 transition-all active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100 w-full"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isSubmitting ? 'Revize Ediliyor...' : 'Yükle ve Onaya Gönder'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
