'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { LifeBuoy, Send, CheckCircle2, AlertCircle, Loader2, Mail, User, ShieldCheck } from 'lucide-react';

interface UserInfo {
  adSoyad: string;
  email: string;
  rol: string;
}

export default function OneriDestekClient() {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  const [talepTuru, setTalepTuru] = useState('Öneri / İyileştirme');
  const [olcutKodu, setOlcutKodu] = useState('');
  const [konu, setKonu] = useState('');
  const [mesaj, setMesaj] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadUser() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiller')
            .select('rol, ad_soyad')
            .eq('id', user.id)
            .maybeSingle();

          setUserInfo({
            adSoyad: profile?.ad_soyad || user.user_metadata?.full_name || 'Öğretim Elemanı',
            email: user.email || '',
            rol: profile?.rol || 'Öğretim Elemanı',
          });
        }
      } catch (err) {
        console.error('Kullanıcı bilgisi alınamadı:', err);
      } finally {
        setIsLoadingUser(false);
      }
    }
    loadUser();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);

    const trimmedKonu = konu.trim();
    const trimmedMesaj = mesaj.trim();

    if (trimmedKonu.length < 3) {
      setErrorMessage('Konu başlığı en az 3 karakter olmalıdır.');
      return;
    }
    if (trimmedMesaj.length < 10) {
      setErrorMessage('Mesajınız en az 10 karakter olmalıdır.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/oneri-destek', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          talepTuru,
          olcutKodu: olcutKodu.trim(),
          konu: trimmedKonu,
          mesaj: trimmedMesaj,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || 'Talebiniz iletilirken bir hata oluştu.');
      }

      setSuccessMessage('Talebiniz başarıyla koordinatörlüğe iletildi. En kısa sürede inceleme yapılıp e-posta adresinize dönüş sağlanacaktır.');
      setKonu('');
      setMesaj('');
      setOlcutKodu('');
      setTalepTuru('Öneri / İyileştirme');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Beklenmeyen bir hata oluştu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Başlık Alanı */}
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center">
              <LifeBuoy className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Öneri ve Destek Modülü</h1>
              <p className="text-sm text-slate-600">
                Sistemle ilgili görüş, öneri, soru veya teknik destek taleplerinizi doğrudan Akreditasyon Koordinatörlüğü'ne iletebilirsiniz.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Gönderen Kullanıcı Bilgilendirme Kartı */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm">
            <User className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900">
              {isLoadingUser ? 'Yükleniyor...' : userInfo?.adSoyad}
            </div>
            <div className="text-xs text-slate-500 flex items-center gap-2">
              <span>{userInfo?.rol}</span>
              <span>•</span>
              <span className="text-blue-600 font-medium">{userInfo?.email}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 font-medium">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          Doğrulanmış Kurumsal Hesap
        </div>
      </div>

      {/* Başarı Bildirimi */}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3 text-emerald-800">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm font-medium">
            {successMessage}
          </div>
        </div>
      )}

      {/* Hata Bildirimi */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 text-red-800">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm font-medium">
            {errorMessage}
          </div>
        </div>
      )}

      {/* Talep Formu */}
      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Talep Türü */}
          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-2">
              Talep Türü <span className="text-red-500">*</span>
            </label>
            <select
              value={talepTuru}
              onChange={(e) => setTalepTuru(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            >
              <option value="Öneri / İyileştirme">Öneri / İyileştirme Fikri</option>
              <option value="Teknik Destek / Hata Bildirimi">Teknik Destek / Hata Bildirimi</option>
              <option value="Soru / Bilgi Talebi">Soru / Süreç Bilgisi Talebi</option>
              <option value="Kanıt / Ölçüt Revizyonu">Kanıt / Ölçüt İle İlgili Danışma</option>
              <option value="Diğer">Diğer</option>
            </select>
          </div>

          {/* İlgili Ölçüt Kodu (Opsiyonel) */}
          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-2">
              İlgili Ölçüt / Konu Alanı <span className="text-xs font-normal text-slate-500">(Opsiyonel)</span>
            </label>
            <input
              type="text"
              value={olcutKodu}
              onChange={(e) => setOlcutKodu(e.target.value)}
              placeholder="Örn: A.1.1, C.2.3 veya Genel"
              maxLength={50}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
        </div>

        {/* Konu Başlığı */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-semibold text-slate-800">
              Konu Başlığı <span className="text-red-500">*</span>
            </label>
            <span className="text-xs text-slate-400">{konu.length} / 200</span>
          </div>
          <input
            type="text"
            required
            value={konu}
            onChange={(e) => setKonu(e.target.value)}
            placeholder="Talebinizi özetleyen kısa bir başlık giriniz"
            maxLength={200}
            className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>

        {/* Mesaj Detayı */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-semibold text-slate-800">
              Mesajınız / Açıklama <span className="text-red-500">*</span>
            </label>
            <span className="text-xs text-slate-400">{mesaj.length} / 5000</span>
          </div>
          <textarea
            required
            rows={6}
            value={mesaj}
            onChange={(e) => setMesaj(e.target.value)}
            placeholder="Lütfen iletmek istediğiniz görüşü, karşılaştığınız durumu veya önerinizi detaylı bir şekilde açıklayınız..."
            maxLength={5000}
            className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all leading-relaxed"
          />
        </div>

        {/* Alt Bilgi ve Gönder Butonu */}
        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Mail className="w-4 h-4 text-slate-400" />
            <span>
              Mesajınız doğrudan <strong>akreditasyonesoguilahiyat@gmail.com</strong> adresine iletilecektir.
            </span>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || isLoadingUser}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg shadow-sm hover:shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                İletiliyor...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Talebi Gönder
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
