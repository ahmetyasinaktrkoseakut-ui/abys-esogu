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

  // Ölçüt ataması var mı kontrol et
  let hasAssignment = false;
  let isCoordinator = false;
  if (user) {
    const { count } = await supabase
      .from('kullanici_olcut_atamalari')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);
    hasAssignment = (count || 0) > 0;

    const { count: coordCount } = await supabase
      .from('baslik_koordinatorleri')
      .select('*', { count: 'exact', head: true })
      .eq('kullanici_id', user.id);
    isCoordinator = (coordCount || 0) > 0;
  }

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col h-full border-r border-slate-800/50">
      <div className="p-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-indigo-500 text-white shadow-lg shadow-indigo-500/20">
          <BookOpen className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-white leading-tight tracking-tight">Akreditasyon Bilgi</h1>
          <h2 className="text-sm font-bold text-slate-400 leading-tight">Yönetim Sistemi</h2>
        </div>
      </div>

      <SidebarNavClient isAdmin={isAdmin} userId={user?.id || ''} hasAssignment={hasAssignment} isCoordinator={isCoordinator} />
    </aside>
  );
}
