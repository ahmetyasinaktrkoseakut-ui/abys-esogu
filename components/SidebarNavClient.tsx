'use client';

import { Link, usePathname } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { 
  Home, 
  FileText, 
  BarChart2, 
  ClipboardList, 
  Calendar, 
  LineChart, 
  FolderOpen, 
  MessageSquare, 
  Search, 
  Settings,
  Bell,
  Lightbulb,
  BookOpen,
  Megaphone
} from 'lucide-react';
import { LogoutButton } from './LogoutButton';

export default function SidebarNavClient({ isAdmin, userId }: { isAdmin: boolean, userId: string }) {
  const pathname = usePathname();
  const t = useTranslations('Navigation');
  const tAnn = useTranslations('Announcements');
  const tQM = useTranslations('QualityManual');
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);
  const [notification, setNotification] = useState<{ sender: string; text: string } | null>(null);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    if (!userId) return;

    async function fetchUnreadCount() {
      const { data: allAnns } = await supabase.from('duyurular').select('id');
      const { data: readAnns } = await supabase.from('duyuru_okumalar').select('duyuru_id').eq('kullanici_id', userId);
      
      const allIds = allAnns?.map(a => a.id) || [];
      const readIds = new Set(readAnns?.map(r => r.duyuru_id) || []);
      const unread = allIds.filter(id => !readIds.has(id)).length;
      
      setUnreadCount(unread);
    }

    fetchUnreadCount();

    const duyurularChannel = supabase
      .channel('sidebar_duyurular')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'duyurular' }, () => {
        fetchUnreadCount();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'duyuru_okumalar', filter: `kullanici_id=eq.${userId}` }, () => {
        fetchUnreadCount();
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'duyurular' }, () => {
        fetchUnreadCount();
      })
      .subscribe();

    async function fetchUnreadMessages() {
      const { count } = await supabase
        .from('mesajlar')
        .select('*', { count: 'exact', head: true })
        .eq('alici_id', userId)
        .eq('okundu', false);
      
      setUnreadMsgCount(count || 0);
    }

    fetchUnreadMessages();

    const mesajlarChannel = supabase
      .channel('public:mesajlar')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mesajlar', filter: `alici_id=eq.${userId}` }, async (payload) => {
        fetchUnreadMessages();
        
        // Fetch sender name
        const { data: users } = await supabase.rpc('get_kullanicilar');
        const sender = users?.find((u: any) => u.id === payload.new.gonderen_id);
        const name = sender?.meta_data?.name || sender?.meta_data?.full_name || sender?.email?.split('@')[0] || 'Biri';
        
        setNotification({
          sender: name.charAt(0).toUpperCase() + name.slice(1),
          text: payload.new.mesaj.substring(0, 70) + (payload.new.mesaj.length > 70 ? '...' : '')
        });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'mesajlar', filter: `alici_id=eq.${userId}` }, () => {
        fetchUnreadMessages();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(duyurularChannel);
      supabase.removeChannel(mesajlarChannel);
    };
  }, [userId]);

  const getLinkClass = (path: string, exact: boolean = false) => {
    const isActive = exact ? pathname === path : pathname.startsWith(path);
    return `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm ${
      isActive 
        ? 'bg-blue-600/20 text-blue-400 font-medium border border-blue-500/20' 
        : 'hover:bg-white/5 hover:text-white'
    }`;
  };

  return (
    <>
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        <Link href="/olcutler" className={getLinkClass('/olcutler')}>
          <Home className="w-5 h-5 flex-shrink-0" />
          {t('dashboard')}
        </Link>
        {isAdmin && (
          <Link href="/izleme" className={getLinkClass('/izleme')}>
            <BarChart2 className="w-5 h-5 flex-shrink-0" />
            {t('tracking')}
          </Link>
        )}

        {/* Generic Links */}
        <div className="pt-2">
          <Link href="/bildirimler" className={getLinkClass('/bildirimler')}>
            <Bell className="w-5 h-5 flex-shrink-0" />
            {t('notifications')}
          </Link>
          <Link href="/takvim" className={getLinkClass('/takvim')}>
            <Calendar className="w-5 h-5 flex-shrink-0" />
            {t('calendar')}
          </Link>
          <Link href="/kalite-el-kitabi" className={getLinkClass('/kalite-el-kitabi')}>
            <BookOpen className="w-5 h-5 flex-shrink-0" />
            {tQM('title')}
          </Link>
          <Link href="/raporlar" className={getLinkClass('/raporlar')}>
            <LineChart className="w-5 h-5 flex-shrink-0" />
            {t('reports')}
          </Link>
          {isAdmin && (
            <>
              <Link href="/onerilenler" className={getLinkClass('/onerilenler')}>
                <Lightbulb className="w-5 h-5 flex-shrink-0" />
                {t('suggestions')}
              </Link>
              <Link href="/dokumanlar" className={getLinkClass('/dokumanlar')}>
                <FolderOpen className="w-5 h-5 flex-shrink-0" />
                {t('documents')}
              </Link>
            </>
          )}
          <Link href="/iletisim" className={getLinkClass('/iletisim')}>
            <div className="relative">
              <MessageSquare className="w-5 h-5 flex-shrink-0" />
              {unreadMsgCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white shadow-sm ring-1 ring-white animate-pulse">
                  {unreadMsgCount}
                </span>
              )}
            </div>
            {t('communication')}
          </Link>
          <Link href="/duyurular" className={getLinkClass('/duyurular')}>
            <div className="relative">
              <Megaphone className="w-5 h-5 flex-shrink-0" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white shadow-sm ring-1 ring-white">
                  {unreadCount}
                </span>
              )}
            </div>
            {tAnn('title')}
          </Link>
        </div>
      </nav>
      
      <div className="p-4 border-t border-[#1e293b] mt-auto space-y-1">
        {isAdmin && (
          <>
            <Link href="/donem-yonetimi" className={getLinkClass('/donem-yonetimi')}>
              <Calendar className="w-5 h-5 flex-shrink-0" />
              {t('periods')}
            </Link>
            <Link href="/atamalar" className={getLinkClass('/atamalar')}>
              <Settings className="w-5 h-5 flex-shrink-0" />
              {t('assignments')}
            </Link>
          </>
        )}
        <LogoutButton />
      </div>
      {notification && (
        <div 
          className="fixed top-0 left-0 right-0 z-[9999] animate-in slide-in-from-top duration-500"
          key={Date.now()} // Force re-mount on new notification
        >
          <div className="bg-red-700 text-white p-6 shadow-2xl border-b-4 border-yellow-400">
            <div className="max-w-4xl mx-auto w-full flex flex-col items-center text-center gap-2">
              <div className="flex items-center gap-3 animate-bounce">
                <MessageSquare className="w-8 h-8 text-white fill-white/20" />
                <span className="text-xs font-black bg-white text-red-700 px-2 py-0.5 rounded-full uppercase tracking-widest">
                  YENİ MESAJ GELDİ
                </span>
              </div>
              <h3 className="text-3xl font-black uppercase tracking-tighter drop-shadow-lg">
                {notification.sender}
              </h3>
              <p className="text-lg font-medium opacity-90 italic line-clamp-1 max-w-2xl">
                "{notification.text}"
              </p>
              <button 
                onClick={() => setNotification(null)} 
                className="mt-4 bg-white text-red-700 hover:bg-slate-100 px-8 py-2 rounded-full font-black text-sm uppercase transition-all transform hover:scale-105 shadow-lg"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
