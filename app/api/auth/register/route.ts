import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export async function POST(request: Request) {
  try {
    const { id, email, ad_soyad } = await request.json();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration error');
    }

    // Admin client to bypass RLS for inserting the profile
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Güvenlik Yaması: Tarayıcı çerezinden aktif oturumu doğrula
    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {}
      }
    });

    const { data: { session } } = await supabaseAuth.auth.getSession();
    
    // Oturum yoksa veya oturumdaki kullanıcı ID'si ve emaili request ile eşleşmiyorsa reddet
    if (!session || session.user.id !== id || session.user.email !== email) {
      return NextResponse.json({ error: 'Unauthorized profile sync attempt' }, { status: 403 });
    }

    const { error } = await supabaseAdmin
      .from('profiller')
      .upsert({
        id,
        email,
        ad_soyad,
        rol: 'BirimSorumlusu' // Güvenlik yaması: Dışarıdan rol ataması iptal edildi
      });

    if (error) {
      console.error('Database Sync Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('API Route Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
