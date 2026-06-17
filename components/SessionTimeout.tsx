'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from '@/i18n/routing';
import { toast, Toaster } from 'react-hot-toast';

export default function SessionTimeout() {
  const router = useRouter();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 30 minutes in milliseconds
  const TIMEOUT_DURATION = 30 * 60 * 1000;

  const resetTimer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase.auth.signOut();
        toast.error('Oturumunuz inaktiflik nedeniyle sonlandırılmıştır.', {
          duration: 5000,
          position: 'top-center'
        });
        
        setTimeout(() => {
          router.refresh();
          router.push('/login');
        }, 1500);
      }
    }, TIMEOUT_DURATION);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        resetTimer();
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || session) {
        resetTimer();
      } else if (event === 'SIGNED_OUT') {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      }
    });

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    const handleActivity = () => {
      resetTimer();
    };

    events.forEach(event => {
      window.addEventListener(event, handleActivity);
    });

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      subscription.unsubscribe();
    };
  }, [router]);

  return <Toaster />;
}
