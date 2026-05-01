'use client';

import { ReactNode } from 'react';
import { PeriodProvider } from '@/contexts/PeriodContext';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <PeriodProvider>
      {children}
    </PeriodProvider>
  );
}
