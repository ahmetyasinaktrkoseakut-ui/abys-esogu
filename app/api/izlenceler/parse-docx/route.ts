import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { parseDocxIzlence } from '@/lib/docxIzlenceParser';

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Supabase credentials are not configured' }, { status: 500 });
    }

    // Oturum Kontrolü
    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {}
      }
    });

    const {
      data: { user }
    } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Yetkisiz erişim. Lütfen giriş yapınız.' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Lütfen bir dosya yükleyiniz.' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.docx')) {
      return NextResponse.json({ error: 'Yalnızca Word (.docx) dosyaları kabul edilmektedir.' }, { status: 400 });
    }

    // Dosyayı Buffer'a çevir ve ayrıştır
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const parsedData = parseDocxIzlence(buffer);

    return NextResponse.json({
      success: true,
      data: parsedData
    });
  } catch (err: any) {
    console.error('Word parse error:', err);
    return NextResponse.json(
      { error: err.message || 'Word dosyası ayrıştırılırken bir hata oluştu.' },
      { status: 500 }
    );
  }
}
