'use client';

import { Link, usePathname } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
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
  Lightbulb
} from 'lucide-react';
import { LogoutButton } from './LogoutButton';

export default function SidebarNavClient({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const t = useTranslations('Navigation');

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
        <Link href="/" className={getLinkClass('/', true)}>
          <Home className="w-5 h-5 flex-shrink-0" />
          {t('dashboard')}
        </Link>
        <Link href="/olcutler" className={getLinkClass('/olcutler')}>
          <FileText className="w-5 h-5 flex-shrink-0" />
          {t('criteria')}
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
            <MessageSquare className="w-5 h-5 flex-shrink-0" />
            {t('communication')}
          </Link>
        </div>
      </nav>
      
      <div className="p-4 border-t border-[#1e293b] mt-auto space-y-1">
        {isAdmin && (
          <Link href="/atamalar" className={getLinkClass('/atamalar')}>
            <Settings className="w-5 h-5 flex-shrink-0" />
            {t('assignments')}
          </Link>
        )}
        <LogoutButton />
      </div>
    </>
  );
}
