import { NavLink } from 'react-router-dom';
import { useI18n, type Dict } from '@/i18n';
import { Home, MailOpen, MessageSquareHeart, User, UsersRound, type LucideIcon } from 'lucide-react';

interface Tab {
  to: string;
  label: (t: Dict) => string;
  Icon: LucideIcon;
}

const tabs: Tab[] = [
  { to: '/',         label: (t) => t.nav.home,     Icon: Home },
  { to: '/team',     label: (t) => t.nav.team,     Icon: UsersRound },
  { to: '/requests', label: (t) => t.nav.requests, Icon: MailOpen },
  { to: '/reviews',  label: (t) => t.nav.reviews,  Icon: MessageSquareHeart },
  { to: '/me',       label: (t) => t.nav.me,       Icon: User },
];

export default function BottomNav() {
  const { t } = useI18n();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-100 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {tabs.map(({ to, label, Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] transition ${
                  isActive ? 'font-semibold text-sakura-600' : 'text-zinc-400'
                }`
              }
            >
              <Icon size={20} strokeWidth={1.8} />
              <span>{label(t)}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
