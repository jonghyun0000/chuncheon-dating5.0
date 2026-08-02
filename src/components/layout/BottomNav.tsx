import { NavLink } from 'react-router-dom';
import { Home, MailOpen, MessageSquareHeart, User, UsersRound, type LucideIcon } from 'lucide-react';

interface Tab {
  to: string;
  label: string;
  Icon: LucideIcon;
}

const tabs: Tab[] = [
  { to: '/',         label: '홈',       Icon: Home },
  { to: '/team',     label: '팀등록',   Icon: UsersRound },
  { to: '/requests', label: '신청내역', Icon: MailOpen },
  { to: '/reviews',  label: '후기',     Icon: MessageSquareHeart },
  { to: '/me',       label: '마이',     Icon: User },
];

export default function BottomNav() {
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
              <span>{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
