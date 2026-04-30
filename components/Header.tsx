import { HelpCircle } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import LanguageSwitcher from './LanguageSwitcher';
import NotificationBellClient from './NotificationBellClient';

export default async function Header() {
  const supabase = await createClient();
  let userRole = '';
  let userName = 'Kullanıcı';
  
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from('profiller')
      .select('rol, ad_soyad')
      .eq('id', user.id)
      .single();
      
    if (profile) {
      userRole = profile.rol || 'Personel (Birim Sorumlusu)';
      userName = profile.ad_soyad || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Kullanıcı';
    } else {
      userRole = 'Personel';
      userName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Kullanıcı';
    }
  }

  const initials = userName
    .split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const isAdmin = userRole.toLowerCase().includes('yonetici') || userRole.toLowerCase().includes('yönetici') || userRole.toLowerCase().includes('admin');

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-end px-8 z-10 sticky top-0">
      <div className="flex items-center gap-5">
        <LanguageSwitcher />
        <div className="h-4 w-px bg-slate-200"></div>
        {user && <NotificationBellClient userId={user.id} isAdmin={isAdmin} />}
        <button className="text-slate-500 hover:text-blue-600 transition-colors">
          <HelpCircle className="w-5 h-5" />
        </button>
        
        <div className="h-6 w-px bg-slate-200"></div>
        
        <div className="flex items-center gap-3 cursor-pointer group">
          <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-sm tracking-tight border border-slate-200">
            {initials}
          </div>
          <div className="text-left flex flex-col justify-center">
            <p className="text-sm font-bold text-slate-800 leading-tight">{userName}</p>
            <p className="text-[11px] text-slate-500 font-medium leading-tight">{userRole}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
