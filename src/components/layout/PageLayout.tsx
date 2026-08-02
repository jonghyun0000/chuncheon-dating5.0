import type { ReactNode } from 'react';
import Header from './Header';
import BottomNav from './BottomNav';

interface Props {
  children: ReactNode;
  hideNav?: boolean;
  hideHeader?: boolean;
  subtitle?: string;
}

export default function PageLayout({ children, hideNav, hideHeader, subtitle }: Props) {
  return (
    <div className="min-h-full bg-cream">
      {!hideHeader && <Header subtitle={subtitle} />}
      <main className={`mx-auto max-w-md px-5 ${hideNav ? 'pb-8' : 'pb-28'} pt-4`}>
        {children}
      </main>
      {!hideNav && <BottomNav />}
    </div>
  );
}
