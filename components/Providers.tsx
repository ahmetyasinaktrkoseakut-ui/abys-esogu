'use client';

import { ReactNode } from 'react';
import { PeriodProvider } from '@/contexts/PeriodContext';
import GlobalFileViewer from './GlobalFileViewer';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <PeriodProvider>
      {children}
      <GlobalFileViewer />
    </PeriodProvider>
  );
}
