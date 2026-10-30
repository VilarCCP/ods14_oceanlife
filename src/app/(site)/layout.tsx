import type { ReactNode } from 'react';

import { PublicChrome } from '@/components/layout/PublicChrome';

export default function PublicLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <PublicChrome>{children}</PublicChrome>;
}
