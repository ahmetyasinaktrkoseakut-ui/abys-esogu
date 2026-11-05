import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { sendSingleEmail, escapeHtml } from '@/lib/email';

const ADMIN_EMAIL = 'akreditasyonesoguilahiyat@gmail.com';

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Supabase yapılandırması eksik.' }, { status: 500 });
    }

    // 1. Doğrulanmış Oturum Kontrolü
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

    if (!user || !user.email) {
      return NextResponse.json({ error: 'Yetkisiz erişim. Oturum bulunamadı.' }, { status: 401 });
    }

    // 2. Doğrulanmış Kullanıcı ve Profil Bilgileri
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: profile } = await supabaseAdmin
      .from('profiller')
      .select('rol, ad_soyad')
      .eq('id', user.id)
      .maybeSingle();

    const adSoyad = profile?.ad_soyad || user.user_metadata?.full_name || user.email.split('@')[0] || 'Kullanıcı';
    const rol = profile?.rol || 'Öğretim Elemanı / Kullanıcı';
    const verifiedEmail = user.email.trim();

    // 3. İstek Gövdesi ve Uzunluk Doğrulaması
    const body = await request.json().catch(() => ({}));
    const rawTalepTuru = typeof body.talepTuru === 'string' ? body.talepTuru.trim() : 'Öneri / İyileştirme';
    const rawOlcutKodu = typeof body.olcutKodu === 'string' ? body.olcutKodu.trim() : '';
    const rawKonu = typeof body.konu === 'string' ? body.konu.trim() : '';
    const rawMesaj = typeof body.mesaj === 'string' ? body.mesaj.trim() : '';

    if (!rawKonu || rawKonu.length < 3) {
      return NextResponse.json({ error: 'Konu başlığı en az 3 karakter olmalıdır.' }, { status: 400 });
    }
    if (rawKonu.length > 200) {
      return NextResponse.json({ error: 'Konu başlığı en fazla 200 karakter olabilir.' }, { status: 400 });
    }

    if (!rawMesaj || rawMesaj.length < 10) {
      return NextResponse.json({ error: 'Mesajınız en az 10 karakter olmalıdır.' }, { status: 400 });
    }
    if (rawMesaj.length > 5000) {
      return NextResponse.json({ error: 'Mesajınız en fazla 5000 karakter olabilir.' }, { status: 400 });
    }

    const talepTuru = rawTalepTuru.slice(0, 100);
    const olcutKodu = rawOlcutKodu.slice(0, 50);

    // 4. HTML Güvenlik Kaçırma (escapeHtml)
    const safeAdSoyad = escapeHtml(adSoyad);
    const safeVerifiedEmail = escapeHtml(verifiedEmail);
    const safeRol = escapeHtml(rol);
    const safeTalepTuru = escapeHtml(talepTuru);
    const safeOlcutKodu = escapeHtml(olcutKodu);
    const safeKonu = escapeHtml(rawKonu);
    const safeMesaj = escapeHtml(rawMesaj).replace(/\n/g, '<br />');

    const gonderimTarihi = new Date().toLocaleString('tr-TR', {
      timeZone: 'Europe/Istanbul',
      dateStyle: 'long',
      timeStyle: 'short',
    });

    const emailHtml = `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <title>Yeni Öneri / Destek Talebi</title>
</head>
<body style="margin: 0; padding: 24px; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 640px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    <!-- Başlık Bandı -->
    <tr>
      <td style="background-color: #0f172a; padding: 24px 32px; border-bottom: 3px solid #3b82f6;">
        <h1 style="margin: 0; font-size: 18px; font-weight: 700; color: #ffffff; letter-spacing: -0.01em;">
          ESOGÜ İlahiyat Akreditasyon Sistemi
        </h1>
        <p style="margin: 4px 0 0; font-size: 13px; color: #94a3b8;">
          Yeni Kullanıcı Öneri / Destek Bildirimi
        </p>
      </td>
    </tr>

    <!-- İçerik Alanı -->
    <tr>
      <td style="padding: 32px;">
        <!-- Gönderen Bilgileri Kartı -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; border-radius: 8px; padding: 16px; margin-bottom: 24px; font-size: 13px;">
          <tr>
            <td style="padding: 6px 12px; font-weight: 600; color: #475569; width: 130px;">Gönderen:</td>
            <td style="padding: 6px 12px; color: #0f172a; font-weight: 600;">${safeAdSoyad}</td>
          </tr>
          <tr>
            <td style="padding: 6px 12px; font-weight: 600; color: #475569;">E-posta:</td>
            <td style="padding: 6px 12px; color: #2563eb;">
              <a href="mailto:${safeVerifiedEmail}" style="color: #2563eb; text-decoration: none;">${safeVerifiedEmail}</a>
            </td>
          </tr>
          <tr>
            <td style="padding: 6px 12px; font-weight: 600; color: #475569;">Sistem Rolü:</td>
            <td style="padding: 6px 12px; color: #334155;">${safeRol}</td>
          </tr>
          <tr>
            <td style="padding: 6px 12px; font-weight: 600; color: #475569;">Talep Türü:</td>
            <td style="padding: 6px 12px;">
              <span style="display: inline-block; background-color: #dbeafe; color: #1e40af; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">
                ${safeTalepTuru}
              </span>
            </td>
          </tr>
          ${safeOlcutKodu ? `
          <tr>
            <td style="padding: 6px 12px; font-weight: 600; color: #475569;">İlgili Ölçüt:</td>
            <td style="padding: 6px 12px; color: #0f172a; font-weight: 600;">${safeOlcutKodu}</td>
          </tr>
          ` : ''}
          <tr>
            <td style="padding: 6px 12px; font-weight: 600; color: #475569;">Tarih:</td>
            <td style="padding: 6px 12px; color: #64748b;">${gonderimTarihi}</td>
          </tr>
        </table>

        <!-- Konu Başlığı -->
        <div style="margin-bottom: 20px;">
          <h2 style="margin: 0 0 8px; font-size: 16px; font-weight: 700; color: #0f172a;">
            Konu: ${safeKonu}
          </h2>
        </div>

        <!-- Mesaj Detayı -->
        <div style="background-color: #ffffff; border: 1px solid #cbd5e1; border-left: 4px solid #2563eb; border-radius: 6px; padding: 16px 20px; font-size: 14px; line-height: 1.6; color: #1e293b; white-space: pre-wrap;">${safeMesaj}</div>

        <!-- Bilgilendirme Notu -->
        <div style="margin-top: 24px; padding: 12px 16px; background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px; font-size: 12px; color: #065f46;">
          <strong>Hızlı Yanıt Kolaylığı:</strong> Bu e-postayı Gmail üzerinden doğrudan <em>"Yanıtla"</em> (Reply) butonuna basarak cevaplayabilirsiniz. Yanıtınız doğrudan hocamızın e-posta adresine (<strong>${safeVerifiedEmail}</strong>) iletilecektir.
        </div>
      </td>
    </tr>
  </table>
</body>
</html>
`;

    // 5. E-Posta Gönderimi (replyTo = doğrulanmış oturum e-postası)
    const emailResult = await sendSingleEmail({
      to: ADMIN_EMAIL,
      subject: `[ABYS Öneri/Destek] [${talepTuru}] ${rawKonu}`,
      html: emailHtml,
      replyTo: verifiedEmail,
    });

    if (!emailResult.success) {
      console.error('[ONERI-DESTEK] E-posta gönderim başarısız:', emailResult.error);
      return NextResponse.json({ 
        error: 'Talebiniz kaydedilemedi veya e-posta gönderilirken bir hata oluştu. Lütfen tekrar deneyiniz.' 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Öneri ve destek talebiniz başarıyla koordinatörlüğe iletildi.',
    });
  } catch (error: any) {
    console.error('[ONERI-DESTEK] Beklenmeyen hata:', error);
    return NextResponse.json({
      error: error?.message || 'İşlem sırasında bir hata oluştu.',
    }, { status: 500 });
  }
}
