import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import createIntlMiddleware from 'next-intl/middleware';
import { routing } from '@/i18n/routing';

const handleI18nRouting = createIntlMiddleware(routing);

export async function updateSession(request: NextRequest) {
  let supabaseResponse = handleI18nRouting(request);

  // Strip internal port from next-intl redirects
  if (supabaseResponse.status >= 300 && supabaseResponse.status < 400) {
    const location = supabaseResponse.headers.get('location');
    if (location && location.includes(':8080')) {
      supabaseResponse.headers.set('location', location.replace(':8080', ''));
    }
  }

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
          // Strip internal port again if setAll triggers another routing pass
          if (supabaseResponse.status >= 300 && supabaseResponse.status < 400) {
            const location = supabaseResponse.headers.get('location');
            if (location && location.includes(':8080')) {
              supabaseResponse.headers.set('location', location.replace(':8080', ''));
            }
          }
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
    !pathWithoutLocale.startsWith('/izlenceler') &&
    !pathname.startsWith('/_next') &&
    !pathname.startsWith('/favicon.ico') &&
    !pathname.startsWith('/public')
  ) {
    const url = request.nextUrl.clone()
    url.port = '' // Force empty port for public redirect
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user) {
    const { data: profile } = await supabase
      .from('profiller')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (isLoginPage) {
      const url = request.nextUrl.clone()
      url.port = '' // Force empty port
      url.pathname = '/olcutler'
      return NextResponse.redirect(url)
    }

    const oldPaths = ['/', '/puko', '/birimler'];
    
    if (oldPaths.some(p => pathWithoutLocale === p || pathWithoutLocale.startsWith('/birimler'))) {
      const url = request.nextUrl.clone()
      url.port = '' // Force empty port
      url.pathname = '/olcutler'
      return NextResponse.redirect(url)
    }
  }

  // Final check for the response being returned
  if (supabaseResponse.status >= 300 && supabaseResponse.status < 400) {
    const location = supabaseResponse.headers.get('location');
    if (location && location.includes(':8080')) {
      supabaseResponse.headers.set('location', location.replace(':8080', ''));
    }
  }

  return supabaseResponse
}
