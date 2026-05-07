import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import createIntlMiddleware from 'next-intl/middleware';
import { routing } from '@/i18n/routing';

const handleI18nRouting = createIntlMiddleware(routing);

export async function updateSession(request: NextRequest) {
  const host = request.headers.get('x-forwarded-host') || request.nextUrl.host;
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  const publicBaseUrl = `${proto}://${host}`;

  let supabaseResponse = handleI18nRouting(request);

  // Fix next-intl redirects to point to public domain without port
  if (supabaseResponse.status >= 300 && supabaseResponse.status < 400) {
    const location = supabaseResponse.headers.get('location');
    if (location && (location.includes('localhost') || location.includes(':8080'))) {
      const url = new URL(location, publicBaseUrl);
      url.port = '';
      supabaseResponse.headers.set('location', url.toString());
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
          if (supabaseResponse.status >= 300 && supabaseResponse.status < 400) {
            const location = supabaseResponse.headers.get('location');
            if (location && (location.includes('localhost') || location.includes(':8080'))) {
              const url = new URL(location, publicBaseUrl);
              url.port = '';
              supabaseResponse.headers.set('location', url.toString());
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

  const pathname = request.nextUrl.pathname;
  const pathWithoutLocale = pathname.replace(/^\/(tr|en|ar)/, '') || '/';
  const isLoginPage = pathWithoutLocale.startsWith('/login')

  const redirectWithHost = (targetPath: string) => {
    const url = new URL(targetPath, publicBaseUrl);
    url.port = '';
    return NextResponse.redirect(url);
  };

  if (
    !user &&
    !isLoginPage &&
    !pathWithoutLocale.startsWith('/izlenceler') &&
    !pathname.startsWith('/_next') &&
    !pathname.startsWith('/favicon.ico') &&
    !pathname.startsWith('/public')
  ) {
    return redirectWithHost('/login');
  }

  if (user) {
    const { data: profile } = await supabase
      .from('profiller')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (isLoginPage) {
      return redirectWithHost('/olcutler');
    }

    const oldPaths = ['/', '/puko', '/birimler'];
    if (oldPaths.some(p => pathWithoutLocale === p || pathWithoutLocale.startsWith('/birimler'))) {
      return redirectWithHost('/olcutler');
    }
  }

  // Final check for the response being returned
  if (supabaseResponse.status >= 300 && supabaseResponse.status < 400) {
    const location = supabaseResponse.headers.get('location');
    if (location && (location.includes('localhost') || location.includes(':8080'))) {
      const url = new URL(location, publicBaseUrl);
      url.port = '';
      supabaseResponse.headers.set('location', url.toString());
    }
  }

  return supabaseResponse
}
