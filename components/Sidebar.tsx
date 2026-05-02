import { BookOpen } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import SidebarNavClient from './SidebarNavClient';

export default async function Sidebar() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let role = '';
  
  if (user) {
    const { data: profile } = await supabase
      .from('profiller')
      .select('rol')
      .eq('id', user.id)
      .single();
      
    if (profile) {
      role = profile.rol;
    }
  }

  const isAdmin = role.toLowerCase().includes('yonetici') || role.toLowerCase().includes('yönetici') || role.toLowerCase().includes('admin');

  return (
    <aside className="w-64 bg-[#0f172a] text-slate-300 flex flex-col h-full border-r border-[#1e293b]">
      <div className="p-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white/10 text-white">
          <BookOpen className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-white leading-tight">Akreditasyon Bilgi</h1>
          <h2 className="text-sm font-bold text-white leading-tight">Yönetim Sistemi</h2>
        </div>
      </div>

      <SidebarNavClient isAdmin={isAdmin} userId={user?.id || ''} />
    </aside>
  );
}
