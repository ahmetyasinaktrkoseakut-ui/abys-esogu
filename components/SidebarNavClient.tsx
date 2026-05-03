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
  Megaphone,
  GraduationCap
} from 'lucide-react';
import { LogoutButton } from './LogoutButton';

export default function SidebarNavClient({ isAdmin, userId, hasAssignment }: { isAdmin: boolean, userId: string, hasAssignment: boolean }) {
  const pathname = usePathname();
  const t = useTranslations('Navigation');
  const tAnn = useTranslations('Announcements');
  const tQM = useTranslations('QualityManual');
  const [unreadCount, setUnreadCount] = useState(0);

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

    return () => {
      supabase.removeChannel(duyurularChannel);
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

  const showFullMenu = isAdmin || hasAssignment;

  return (
    <>
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {showFullMenu && (
          <>
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
          </>
        )}

        <Link href="/izlenceler" className={getLinkClass('/izlenceler')}>
          <GraduationCap className="w-5 h-5 flex-shrink-0" />
          {t('syllabi')}
        </Link>
        {isAdmin && (
          <div className="pl-6">
            <Link href="/izlence-takip" className={getLinkClass('/izlence-takip')}>
              <BarChart2 className="w-4 h-4 flex-shrink-0" />
              İzlence Verileri
            </Link>
          </div>
        )}

        {/* Generic Links */}
        <div className="pt-2">
          {showFullMenu && (
            <>
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
            </>
          )}
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
    </>
  );
}
