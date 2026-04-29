'use client';

import { useState, useEffect, use } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Loader2, CheckCircle2, ClipboardList, Send } from 'lucide-react';

interface PublicAnketClientProps {
  params: Promise<{ id: string }>;
}

export default function PublicAnketClient({ params }: PublicAnketClientProps) {
  const resolvedParams = use(params);
  const [anket, setAnket] = useState<any>(null);
  const [cevaplar, setCevaplar] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAnket() {
      try {
        setIsLoading(true);
        // Supabase id might be a number or UUID depending on the user's schema
        // We will try to fetch it as is.
        const { data, error } = await supabase
          .from('anketler')
          .select('*')
          .eq('id', resolvedParams.id)
          .single();

        if (error) throw error;
        setAnket(data);
        
        // Initialize cevaplar
        if (data && data.sorular) {
          const initCevaplar: Record<string, any> = {};
          data.sorular.forEach((s: any) => {
            initCevaplar[s.id] = s.tip === 'kisa_yanit' ? '' : null;
          });
          setCevaplar(initCevaplar);
        }
      } catch (e: any) {
        console.error(e);
        setError('Anket bulunamadı veya bir hata oluştu.');
      } finally {
        setIsLoading(false);
      }
    }
    fetchAnket();
  }, [resolvedParams.id]);

  const handleCevapChange = (soruId: string, value: any) => {
    setCevaplar(prev => ({ ...prev, [soruId]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basit Validasyon (Boş zorunlu alan kontrolü vb eklenebilir, şimdilik geçiyoruz)
    
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('anket_cevaplari').insert({
        anket_id: anket.id,
        cevaplar: cevaplar
      });

      if (error) throw error;
      
      setIsSuccess(true);
    } catch (err: any) {
      console.error(err);
      alert(`Yanıt gönderilirken hata oluştu: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="min-h-screen bg-[#F0F2F5] flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-purple-600" /></div>;
  }

  if (error || !anket) {
    return (
      <div className="min-h-screen bg-[#F0F2F5] flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-md text-center max-w-md w-full border-t-8 border-t-red-500">
          <h2 className="text-xl font-bold text-slate-800 mb-2">Hata</h2>
          <p className="text-slate-600">{error || 'Anket bulunamadı.'}</p>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-[#F0F2F5] flex items-center justify-center p-4">
        <div className="bg-white p-10 rounded-2xl shadow-md text-center max-w-md w-full border-t-8 border-t-emerald-500 animate-in zoom-in-95 duration-500">
          <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Yanıtınız Kaydedildi</h2>
          <p className="text-slate-600 mb-6">Ankete katıldığınız için teşekkür ederiz. Yanıtınız başarıyla sisteme iletildi.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F0F2F5] py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-3xl mx-auto">
        
        {/* Form Başlığı */}
        <div className="bg-white rounded-2xl shadow-md overflow-hidden mb-6 border-t-8 border-t-purple-600">
          <div className="p-8">
            <h1 className="text-3xl font-bold text-slate-900 mb-3">{anket.baslik}</h1>
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-4 border-b border-slate-100 pb-4">
              <ClipboardList className="w-4 h-4" />
              <span>Kalite ve Özdeğerlendirme Anketi</span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Bu anket, kurumumuzun ilgili ölçüt kapsamındaki uygulamalarını değerlendirmek amacıyla hazırlanmıştır. Katkılarınız için teşekkür ederiz.
            </p>
          </div>
        </div>

        {/* Form İçeriği */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {anket.sorular?.map((soru: any, index: number) => (
            <div key={soru.id} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 focus-within:shadow-md focus-within:border-purple-300 transition-all">
              <h3 className="text-lg font-medium text-slate-800 mb-4">
                <span className="text-purple-600 mr-2 font-bold">{index + 1}.</span> 
                {soru.soru} <span className="text-red-500">*</span>
              </h3>
              
              <div className="pl-6">
                {soru.tip === 'kisa_yanit' && (
                  <input 
                    type="text"
                    required
                    value={cevaplar[soru.id] || ''}
                    onChange={(e) => handleCevapChange(soru.id, e.target.value)}
                    placeholder="Yanıtınız"
                    className="w-full text-base bg-transparent border-b border-slate-300 focus:border-purple-600 focus:outline-none py-2 transition-colors placeholder:text-slate-400"
                  />
                )}

                {soru.tip === 'coktan_secmeli' && (
                  <div className="space-y-3">
                    {soru.secenekler?.map((secenek: any) => (
                      <label key={secenek.id} className="flex items-center gap-3 cursor-pointer group">
                        <input 
                          type="radio" 
                          name={`soru_${soru.id}`}
                          required
                          value={secenek.id}
                          checked={cevaplar[soru.id] === secenek.id}
                          onChange={() => handleCevapChange(soru.id, secenek.id)}
                          className="w-5 h-5 text-purple-600 bg-slate-100 border-slate-300 focus:ring-purple-500 focus:ring-2"
                        />
                        <span className="text-slate-700 group-hover:text-slate-900 transition-colors">{secenek.metin}</span>
                      </label>
                    ))}
                  </div>
                )}

                {soru.tip === 'puanlama' && (
                  <div className="flex flex-wrap gap-4 items-center mt-2">
                    {[1, 2, 3, 4, 5].map(p => (
                      <label key={p} className="flex flex-col items-center gap-2 cursor-pointer group">
                        <input 
                          type="radio"
                          name={`soru_${soru.id}`}
                          required
                          value={p}
                          checked={cevaplar[soru.id] === p.toString()}
                          onChange={() => handleCevapChange(soru.id, p.toString())}
                          className="w-5 h-5 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="w-10 h-10 rounded-full border-2 border-slate-200 flex items-center justify-center text-slate-500 font-bold group-hover:border-purple-400 transition-colors">
                          {p}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          <div className="pt-4 flex items-center justify-between">
            <button 
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-lg font-bold transition-all shadow-md hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              {isSubmitting ? 'Gönderiliyor...' : 'Gönder'}
            </button>
            <div className="text-xs text-slate-400 text-right">
              Bu içerik BKY Sistemi kullanılarak oluşturulmuştur.<br/>
              Asla şifrelerinizi göndermeyin.
            </div>
          </div>
        </form>

      </div>
    </div>
  );
}
