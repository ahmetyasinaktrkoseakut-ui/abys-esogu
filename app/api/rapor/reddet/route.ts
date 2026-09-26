import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { sendSingleEmail, createRejectionEmailHtml } from '@/lib/email';

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Sunucu Supabase yapılandırması eksik.' }, { status: 500 });
    }

    // 1. Oturum Kontrolü (Caller Authentication)
    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    });

    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Yetkisiz erişim. Oturum bulunamadı.' }, { status: 401 });
    }

    // 2. Girdi Doğrulaması
    const body = await request.json().catch(() => ({}));
    const { raporId, redNedeni } = body;

    if (!raporId || typeof raporId !== 'string') {
      return NextResponse.json({ error: 'Geçerli bir raporId zorunludur.' }, { status: 400 });
    }

    const trimmedReason = (redNedeni || '').trim();
    if (trimmedReason.length < 5 || trimmedReason.length > 1000) {
      return NextResponse.json(
        { error: 'Ret gerekçesi en az 5, en fazla 1000 karakter olmalıdır.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 3. Raporun Varlığını ve Bilgilerini Çekme
    const { data: report, error: reportFetchError } = await supabaseAdmin
      .from('ozdegerlendirme_raporlari')
      .select('id, alt_olcut_id, donem_id, onay_durumu, red_nedeni, olusturan_id, kullanici_id, user_id')
      .eq('id', raporId)
      .maybeSingle();

    if (reportFetchError || !report) {
      return NextResponse.json({ error: 'Belirtilen rapor bulunamadı.' }, { status: 404 });
    }

    // 4. Aktif Dönem Doğrulaması (Yalnızca aktif dönem raporları reddedilebilir)
    const { data: period, error: periodError } = await supabaseAdmin
      .from('donemler')
      .select('id, is_active')
      .eq('id', report.donem_id)
      .maybeSingle();

    if (periodError || !period || !period.is_active) {
      return NextResponse.json({ error: 'Yalnızca aktif döneme ait raporlar üzerinde işlem yapılabilir.' }, { status: 400 });
    }

    // 5. Yetki ve Kapsam Kontrolü (Admin mi / O Başlığın Koordinatörü mü?)
    const { data: profile } = await supabaseAdmin
      .from('profiller')
      .select('rol')
      .eq('id', user.id)
      .maybeSingle();

    const userRole = (profile?.rol ?? '').toLowerCase();
    const isAdmin =
      userRole.includes('yönetici') ||
      userRole.includes('yonetici') ||
      userRole.includes('admin');

    // Ölçüt kodunu çek
    const { data: altOlcut } = await supabaseAdmin
      .from('alt_olcutler')
      .select('id, kod, olcut_adi')
      .eq('id', report.alt_olcut_id)
      .maybeSingle();

    let isAuthorized = isAdmin;

    if (!isAuthorized && altOlcut?.kod) {
      // Ölçüt başlık harfi (Örn: "A.1.1" -> "A")
      const headingLetter = altOlcut.kod.split('.')[0].trim().toUpperCase();

      const { data: coordAssignments } = await supabaseAdmin
        .from('baslik_koordinatorleri')
        .select('baslik')
        .eq('kullanici_id', user.id);

      if (coordAssignments && coordAssignments.length > 0) {
        isAuthorized = coordAssignments.some((ca: any) => {
          const b = (ca.baslik || '').trim().toUpperCase();
          return b === headingLetter || b.startsWith(headingLetter);
        });
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Bu ölçüt üzerinde ret yetkiniz bulunmamaktadır.' },
        { status: 403 }
      );
    }

    // 6. İdempotency (Zaten aynı gerekçeyle reddedilmişse mükerrer işlem yapma)
    if (report.onay_durumu === 'reddedildi' && report.red_nedeni === trimmedReason) {
      return NextResponse.json({
        success: true,
        duplicate: true,
        message: 'Rapor zaten bu gerekçeyle reddedilmiş durumda.',
      });
    }

    const previousStatus = report.onay_durumu;
    const previousReason = report.red_nedeni;

    // 7. Adım 1: Rapor Durumunu Güncelleme (Koşullu Tekil Güncelleme)
    const { data: updatedReport, error: updateError } = await supabaseAdmin
      .from('ozdegerlendirme_raporlari')
      .update({
        onay_durumu: 'reddedildi',
        red_nedeni: trimmedReason,
      })
      .eq('id', raporId)
      .select('id')
      .maybeSingle();

    if (updateError || !updatedReport) {
      return NextResponse.json({ error: 'Rapor durumu güncellenemedi.' }, { status: 500 });
    }

    // 8. Adım 2: PUKÖ Tablosunu Güncelleme
    const { error: pukoError } = await supabaseAdmin
      .from('puko_degerlendirmeleri')
      .update({
        durum: 'Reddedildi',
        red_nedeni: trimmedReason,
      })
      .eq('alt_olcut_id', report.alt_olcut_id)
      .eq('donem_id', report.donem_id);

    // TELAFİ (Rollback): Eğer PUKÖ güncellemesi başarısız olursa raporu eski durumuna döndür
    if (pukoError) {
      console.warn('[REJECT] PUKÖ güncellemesi başarısız, rapor durumu geri alınıyor:', pukoError);
      await supabaseAdmin
        .from('ozdegerlendirme_raporlari')
        .update({
          onay_durumu: previousStatus,
          red_nedeni: previousReason,
        })
        .eq('id', raporId);

      return NextResponse.json(
        { error: 'PUKÖ değerlendirmeleri güncellenemedi, işlem geri alındı.' },
        { status: 500 }
      );
    }

    // 9. Adım 3: Dahili Bildirimler Tablosuna Kayıt
    // Atanan hocayı sunucu tarafında bul
    const { data: atama } = await supabaseAdmin
      .from('kullanici_olcut_atamalari')
      .select('user_id')
      .eq('alt_olcut_id', report.alt_olcut_id)
      .eq('donem_id', report.donem_id)
      .maybeSingle();

    const targetUserId = atama?.user_id || report.olusturan_id || report.kullanici_id || report.user_id;

    try {
      await supabaseAdmin.from('bildirimler').insert({
        gonderen_id: user.id,
        alici_id: targetUserId || null,
        mesaj: `${altOlcut?.kod || 'Alt Ölçüt'} Değerlendirmesi REDDEDİLDİ. Neden: ${trimmedReason}`,
        tip: 'red',
        ilgili_kayit_id: String(report.alt_olcut_id),
      });
    } catch (notifErr) {
      console.warn('[REJECT] Dahili bildirim kaydı uyarısı:', notifErr);
    }

    // 10. Adım 4: E-Posta Gönderimi (YALNIZCA TÜM VERİTABANI İŞLEMLERİ BİTTİKTEN SONRA)
    if (targetUserId) {
      const { data: targetProfile } = await supabaseAdmin
        .from('profiller')
        .select('email, ad_soyad')
        .eq('id', targetUserId)
        .maybeSingle();

      if (targetProfile?.email && targetProfile.email.includes('@')) {
        const appUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://abys-ivory.vercel.app').replace(/\/+$/, '');
        const emailHtml = createRejectionEmailHtml({
          hocaAdi: targetProfile.ad_soyad || 'Öğretim Elemanımız',
          olcutKodu: altOlcut?.kod || 'Alt Ölçüt',
          olcutAdi: altOlcut?.olcut_adi || '',
          redNedeni: trimmedReason,
          appUrl,
        });

        // Fail-safe e-posta çağrısı
        await sendSingleEmail({
          to: targetProfile.email,
          subject: `[ESOGÜ ABYS] ${altOlcut?.kod || 'Ölçüt'} Özdeğerlendirme Raporu Revizyon Talebi`,
          html: emailHtml,
        }).catch(err => {
          console.warn('[REJECT EMAIL] E-posta gönderiminde hata (DB işlemi korundu):', err);
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[REJECT ROUTE] Beklenmeyen hata:', error);
    return NextResponse.json({ error: error?.message || 'İşlem sırasında beklenmeyen bir hata oluştu.' }, { status: 500 });
  }
}
