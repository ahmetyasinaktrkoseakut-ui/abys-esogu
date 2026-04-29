'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Building2, Plus, X, Loader2, Calendar } from 'lucide-react';

export default function BirimlerPage() {
  const [birimler, setBirimler] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [yeniBirimAdi, setYeniBirimAdi] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalMessage, setModalMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  const fetchBirimler = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('birimler')
        .select('*')
        .order('id', { ascending: false });
      
      if (error) throw error;
      if (data) setBirimler(data);
    } catch (err: any) {
      console.error('Birimler yüklenirken hata:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBirimler();
  }, []);

  const handleAddBirim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!yeniBirimAdi.trim()) return;

    setIsSubmitting(true);
    setModalMessage(null);

    try {
      // Assuming 'birimler' table has a 'birim_adi' column, or 'ad', etc.
      // We will try 'birim_adi' and fallback to 'ad' or 'isim' if user has a different schema.
      const { error } = await supabase
        .from('birimler')
        .insert({ birim_adi: yeniBirimAdi });

      if (error) throw error;
      
      setModalMessage({ type: 'success', text: 'Birim başarıyla eklendi!' });
      setYeniBirimAdi('');
      
      // Refresh list
      await fetchBirimler();
      
      // Close modal after a short delay
      setTimeout(() => {
        setIsModalOpen(false);
        setModalMessage(null);
      }, 1500);

    } catch (err: any) {
      // If column name mismatch happens, we could try '{ ad: yeniBirimAdi }'
      // but standardizing 'birim_adi' based on previous context.
      setModalMessage({ type: 'error', text: err.message || 'Kayıt sırasında hata oluştu.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('tr-TR', {
      day: '2-digit', month: 'long', year: 'numeric'
    });
  };

  return (
    <div className="p-8 max-w-[1200px] mx-auto animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Building2 className="w-6 h-6 text-blue-600" />
            Sistem Birimleri
          </h2>
          <p className="text-slate-500 mt-1 max-w-2xl">
            Sisteme kayıtlı tüm fakülte, yüksekokul veya koordinatörlük birimlerini buradan görüntüleyebilir ve yeni birim ekleyebilirsiniz.
          </p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium shadow-sm shadow-blue-500/30 transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Yeni Birim Ekle</span>
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-20 flex justify-center items-center text-blue-600">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider w-24">ID</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4" /> Birim Adı
                    </div>
                  </th>

                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {birimler.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="py-20 text-center text-slate-500">
                      Hiçbir birim kaydı bulunamadı. Lütfen "Yeni Birim Ekle" ile ekleme yapın.
                    </td>
                  </tr>
                ) : (
                  birimler.map((birim) => (
                    <tr key={birim.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-mono text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded">
                          #{birim.id}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-semibold text-slate-700">
                          {birim.birim_adi || birim.ad || birim.name || '-'}
                        </span>
                      </td>

                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modern Modal overlay */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                Sisteme Birim Ekle
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors focus:outline-none"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleAddBirim} className="p-6">
              
              {modalMessage && (
                <div className={`mb-4 p-3 rounded-xl text-sm font-medium border ${
                  modalMessage.type === 'success' 
                    ? 'bg-green-50 text-green-700 border-green-200' 
                    : 'bg-red-50 text-red-700 border-red-200'
                }`}>
                  {modalMessage.text}
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="birimAdi" className="block text-sm font-semibold text-slate-700">
                  Birim Adı (Örn: Mühendislik Fakültesi)
                </label>
                <input
                  id="birimAdi"
                  type="text"
                  required
                  autoFocus
                  value={yeniBirimAdi}
                  onChange={(e) => setYeniBirimAdi(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all sm:text-sm"
                  placeholder="Birim adını giriniz..."
                />
              </div>

              <div className="mt-8 flex items-center gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:text-slate-900 transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !yeniBirimAdi.trim()}
                  className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-sm shadow-blue-500/30 transition-all active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
