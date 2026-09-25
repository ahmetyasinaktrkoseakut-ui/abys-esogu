import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { sendBatchEmails, createAnnouncementEmailHtml } from '@/lib/email';

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Supabase yapılandırması eksik.' }, { status: 500 });
    }

    // 1. Oturum Doğrulaması
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

    // 2. Rol ve Yetki Kontrolü
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

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

    const { data: coordRecords } = await supabaseAdmin
      .from('baslik_koordinatorleri')
      .select('baslik')
      .eq('kullanici_id', user.id);

    const isCoordinator = (coordRecords && coordRecords.length > 0) || false;

    if (!isAdmin && !isCoordinator) {
      return NextResponse.json(
        { error: 'Yetersiz yetki. Yalnızca Yönetici veya Koordinatörler e-posta gönderebilir.' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { action, baslik, icerik } = body;

    if (action !== 'announcement') {
      return NextResponse.json({ error: 'Geçersiz action.' }, { status: 400 });
    }

    const trimmedBaslik = (baslik || '').trim();
    const trimmedIcerik = (icerik || '').trim();

    if (trimmedBaslik.length < 3 || trimmedIcerik.length < 5) {
      return NextResponse.json(
        { error: 'Başlık en az 3, içerik en az 5 karakter olmalıdır.' },
        { status: 400 }
      );
    }

    // 3. Aktif Dönemi Tespit Etme
    const { data: activePeriod } = await supabaseAdmin
      .from('donemler')
      .select('id')
      .eq('is_active', true)
      .maybeSingle();

    let targetEmails: { email: string; ad_soyad: string }[] = [];

    // 4. Kapsam Kısıtlaması (Scope Restriction):
    if (isAdmin) {
      // Yönetici tüm aktif hocalara gönderebilir
      const { data: allProf } = await supabaseAdmin
        .from('profiller')
        .select('email, ad_soyad')
        .neq('rol', 'Beklemede')
        .not('email', 'is', null);

      targetEmails = (allProf || []).filter(p => p.email && p.email.includes('@'));
    } else if (isCoordinator) {
      // Başlık Koordinatörü: YALNIZCA kendi başlığı altındaki hocalara gönderebilir!
      const coordinatedLetters = (coordRecords || []).map((c: any) => (c.baslik || '').trim().toUpperCase()).filter(Boolean);

      // Bu harflerle başlayan alt ölçütleri bul
      const { data: allOlcutler } = await supabaseAdmin
        .from('alt_olcutler')
        .select('id, kod');

      const matchingOlcutIds = (allOlcutler || [])
        .filter(o => {
          const letter = (o.kod || '').split('.')[0].trim().toUpperCase();
          return coordinatedLetters.some(cl => cl === letter || cl.startsWith(letter));
        })
        .map(o => o.id);

      if (matchingOlcutIds.length > 0 && activePeriod?.id) {
        // Bu ölçütlere atanmış kullanıcıları bul
        const { data: atamalar } = await supabaseAdmin
          .from('kullanici_olcut_atamalari')
          .select('user_id')
          .in('alt_olcut_id', matchingOlcutIds)
          .eq('donem_id', activePeriod.id);

        const userIds = Array.from(new Set((atamalar || []).map(a => a.user_id).filter(Boolean)));

        if (userIds.length > 0) {
          const { data: profs } = await supabaseAdmin
            .from('profiller')
            .select('email, ad_soyad')
            .in('id', userIds)
            .not('email', 'is', null);

          targetEmails = (profs || []).filter(p => p.email && p.email.includes('@'));
        }
      }
    }

    if (targetEmails.length === 0) {
      return NextResponse.json({
        success: true,
        count: 0,
        message: 'Yetki kapsamınızda gönderilecek kayıtlı e-posta bulunamadı.',
      });
    }

    const appUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://esogu-akreditasyon.vercel.app').replace(/\/+$/, '');
    const html = createAnnouncementEmailHtml({
      baslik: trimmedBaslik,
      icerik: trimmedIcerik,
      appUrl,
    });

    const subject = `[ESOGÜ ABYS Duyuru] ${trimmedBaslik}`;
    const batchItems = targetEmails.map(t => ({
      to: t.email.trim(),
      subject,
      html,
    }));

    const result = await sendBatchEmails(batchItems);

    return NextResponse.json({
      success: result.success,
      count: result.count,
      totalTarget: batchItems.length,
      error: result.error,
    });
  } catch (error: any) {
    console.error('[EMAIL ROUTE] Hata:', error);
    return NextResponse.json({ error: error?.message || 'E-posta gönderiminde beklenmeyen hata.' }, { status: 500 });
  }
}
