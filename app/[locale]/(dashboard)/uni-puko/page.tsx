import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import UniPukoClient, { UniPukoCriterionItem } from '@/components/UniPukoClient';
import { getYokakMappingForIaa } from '@/lib/uni-puko/iaa-yokak-mapping';
import { normalizeStorageKey } from '@/lib/uni-puko/drive-service';

export const dynamic = 'force-dynamic';

export default async function UniPukoPage() {
  const supabase = await createClient();

  // 1. Sunucu Tarafı Oturum ve Yönetici Rol Kontrolü
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    return <div className="p-8 text-center font-bold text-slate-600">Giriş yapmalısınız.</div>;
  }

  const { data: profile, error: profileErr } = await supabase
    .from('profiller')
    .select('rol')
    .eq('id', user.id)
    .maybeSingle();

  if (profileErr) {
    return (
      <div className="p-8 text-center font-bold text-red-600">
        Kullanıcı rolü doğrulanırken hata oluştu: {profileErr.message}
      </div>
    );
  }

  const role = profile?.rol?.toLowerCase() || '';
  const isAdmin = role.includes('yonetici') || role.includes('yönetici') || role.includes('admin');

  if (!isAdmin) {
    return (
      <div className="p-8 text-center flex flex-col items-center justify-center h-[calc(100vh-100px)]">
        <h1 className="text-3xl font-black text-red-600 tracking-tighter">YETKİSİZ ERİŞİM</h1>
        <p className="text-slate-500 font-bold mt-2">
          Bu modülü yalnızca sistem yöneticileri görüntüleyebilir ve kullanabilir.
        </p>
      </div>
    );
  }

  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // 2. Aktif Dönemi Bul
  const { data: activePeriod, error: periodErr } = await supabaseAdmin
    .from('donemler')
    .select('id, donem_adi, is_active')
    .eq('is_active', true)
    .maybeSingle();

  if (periodErr) {
    return (
      <div className="p-8 text-center font-bold text-red-600">
        Aktif dönem sorgulanırken hata oluştu: {periodErr.message}
      </div>
    );
  }

  if (!activePeriod) {
    return (
      <div className="p-8 text-center font-bold text-slate-600">
        Sistemde aktif dönem bulunamadı. Lütfen Dönem Yönetimi ekranından aktif dönemi belirleyin.
      </div>
    );
  }

  // 3. Alt Ölçütler, Onaylı ÖDR'ler, Onaylı PUKÖ'ler ve Sorumlular
  const [
    { data: altOlcutler, error: altOlcutErr },
    { data: approvedOdrs, error: odrErr },
    { data: approvedPukos, error: pukoErr },
    { data: atamalar, error: atamaErr },
    { data: profiller, error: profillerErr },
  ] = await Promise.all([
    supabaseAdmin.from('alt_olcutler').select('id, kod, olcut_adi').order('id', { ascending: true }),
    supabaseAdmin
      .from('ozdegerlendirme_raporlari')
      .select('id, alt_olcut_id, icerik, kanitlar, olusturulma_tarihi, onay_durumu')
      .eq('donem_id', activePeriod.id)
      .eq('onay_durumu', 'onaylandi'),
    supabaseAdmin
      .from('puko_degerlendirmeleri')
      .select('alt_olcut_id, puko_asamasi, durum, olgunluk_puani, kanit_dosyalari')
      .eq('donem_id', activePeriod.id)
      .eq('durum', 'Onaylandı')
      .in('puko_asamasi', [
        'planlama',
        'uygulama',
        'kontrol',
        'onlem',
        'olgunluk',
        'Planlama',
        'Uygulama',
        'Kontrol',
        'Onlem',
        'Olgunluk',
      ]),
    supabaseAdmin
      .from('kullanici_olcut_atamalari')
      .select('alt_olcut_id, user_id')
      .eq('donem_id', activePeriod.id),
    supabaseAdmin.from('profiller').select('id, ad_soyad'),
  ]);

  const queryError = altOlcutErr || odrErr || pukoErr || atamaErr || profillerErr;
  if (queryError) {
    return (
      <div className="p-8 text-center font-bold text-red-600">
        Veritabanı verileri çekilirken hata oluştu: {queryError.message}
      </div>
    );
  }

  const profilMap = new Map<string, string>();
  (profiller || []).forEach(p => {
    if (p.id && p.ad_soyad) profilMap.set(p.id, p.ad_soyad.trim());
  });

  const altOlcutMap = new Map<number, { kod: string; olcut_adi: string }>();
  (altOlcutler || []).forEach(a => {
    altOlcutMap.set(Number(a.id), { kod: a.kod || '', olcut_adi: a.olcut_adi || '' });
  });

  const items: UniPukoCriterionItem[] = (approvedOdrs || [])
    .map(odr => {
      const altId = Number(odr.alt_olcut_id);
      const alt = altOlcutMap.get(altId);
      const iaaKodu = (alt?.kod || '').trim();
      const iaaAdi = (alt?.olcut_adi || '').trim();
      const mapping = getYokakMappingForIaa(iaaKodu);

      const atama = (atamalar || []).find(a => Number(a.alt_olcut_id) === altId);
      const sorumluAdSoyad =
        (atama?.user_id && profilMap.get(atama.user_id)) || 'Birim Kalite Komisyonu';

      const pukos = (approvedPukos || []).filter(p => Number(p.alt_olcut_id) === altId);
      const olgunlukRow = pukos.find(p => (p.puko_asamasi || '').toLowerCase() === 'olgunluk');
      const olgunlukPuani = Number(olgunlukRow?.olgunluk_puani || 0);

      const uniqueKeys = new Set<string>();
      (Array.isArray(odr.kanitlar) ? odr.kanitlar : []).forEach((k: any) => {
        const sKey = normalizeStorageKey(k?.url || '') || (k?.url || '').trim();
        if (sKey) uniqueKeys.add(sKey);
      });
      pukos.forEach(p => {
        (Array.isArray(p.kanit_dosyalari) ? p.kanit_dosyalari : []).forEach((k: any) => {
          const sKey = normalizeStorageKey(k?.url || '') || (k?.url || '').trim();
          if (sKey) uniqueKeys.add(sKey);
        });
      });

      return {
        altOlcutId: altId,
        iaaKodu,
        iaaAdi,
        yokakKodu: mapping?.yokakKodu || '-',
        yokakAdi: mapping?.yokakAdi || '-',
        sorumluAdSoyad,
        olgunlukPuani,
        kanitSayisi: uniqueKeys.size,
        guncellemeTarihi: odr.olusturulma_tarihi
          ? new Date(odr.olusturulma_tarihi).toLocaleDateString('tr-TR')
          : '-',
      };
    })
    .sort((a, b) => a.iaaKodu.localeCompare(b.iaaKodu, 'tr', { numeric: true }));

  const driveFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || '1UTm_ONdVoityeQ20pKM4-s7I1OrCZVro';

  return (
    <UniPukoClient
      donemAdi={activePeriod.donem_adi}
      totalCriteriaCount={altOlcutler?.length || 59}
      approvedItems={items}
      driveFolderId={driveFolderId}
    />
  );
}
