import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import createIntlMiddleware from 'next-intl/middleware';
import { routing } from '@/i18n/routing';

const handleI18nRouting = createIntlMiddleware(routing);

export async function updateSession(request: NextRequest) {
  let supabaseResponse = handleI18nRouting(request);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = handleI18nRouting(request)
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Extract path without locale for checking
  const pathname = request.nextUrl.pathname;
  const pathWithoutLocale = pathname.replace(/^\/(tr|en|ar)/, '') || '/';
  
  const isLoginPage = pathWithoutLocale.startsWith('/login')

  if (
    !user &&
    !isLoginPage &&
    !pathname.startsWith('/_next') &&
    !pathname.startsWith('/favicon.ico') &&
    !pathname.startsWith('/public')
  ) {
    // no user, redirect to login (next-intl will localize it on next pass)
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // If user is authenticated, handle role-based routing
  if (user) {
    // Check role from profiller
    const { data: profile } = await supabase
      .from('profiller')
      .select('rol')
      .eq('id', user.id)
      .single()

    const role = profile?.rol

    if (isLoginPage) {
      const url = request.nextUrl.clone()
      url.pathname = '/olcutler'
      return NextResponse.redirect(url)
    }

    // Catch deleted or unauthorized old paths
    const oldPaths = ['/', '/puko', '/birimler'];
    
    if (oldPaths.some(p => pathWithoutLocale === p || pathWithoutLocale.startsWith('/birimler'))) {
      const url = request.nextUrl.clone()
      url.pathname = '/olcutler'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
