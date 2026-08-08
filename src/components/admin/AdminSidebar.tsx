import { NavLink } from 'react-router-dom';
import {
  BellRing,
  IdCard,
  LayoutDashboard,
  MessageSquareWarning,
  Sparkles,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUnhandledNotifications } from '@/hooks/useUnhandledNotifications';
import { useI18n, type Dict } from '@/i18n';

interface Item {
  to: string;
  label: (t: Dict) => string;
  Icon: LucideIcon;
  end?: boolean;
  /** 미처리 알림 배지를 붙일 항목 */
  badge?: boolean;
}

const items: Item[] = [
  { to: '/admin',              label: (t) => t.admin.navDashboard,     Icon: LayoutDashboard, end: true },
  { to: '/admin/notifications', label: (t) => t.admin.navNotifications, Icon: BellRing,        badge: true },
  { to: '/admin/users',        label: (t) => t.admin.navUsers,         Icon: Users },
  { to: '/admin/verification', label: (t) => t.admin.navVerification,  Icon: IdCard },
  { to: '/admin/teams',        label: (t) => t.admin.navTeams,         Icon: UsersRound },
  { to: '/admin/reports',      label: (t) => t.admin.navReports,       Icon: MessageSquareWarning },
  { to: '/admin/reviews',      label: (t) => t.admin.navReviews,       Icon: Sparkles },
];

function CountBadge({ count, compact }: { count: number; compact?: boolean }) {
  if (count <= 0) return null;
  const text = count > 99 ? '99+' : String(count);
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full bg-rose-500 font-bold text-white ${
        compact
          ? 'absolute -right-2 -top-1 h-4 min-w-4 px-1 text-[9px]'
          : 'ml-auto h-5 min-w-5 px-1.5 text-[11px]'
      }`}
    >
      {text}
    </span>
  );
}

export default function AdminSidebar() {
  const { profile } = useAuth();
  const { t } = useI18n();
  const { count } = useUnhandledNotifications(profile?.role === 'admin');

  return (
    <aside className="hidden w-60 shrink-0 border-r border-zinc-100 bg-white md:block">
      <div className="p-5">
        <p className="font-display text-xl font-bold text-sakura-600">{t.common.appName}</p>
        <p className="text-[11px] tracking-widest text-zinc-400">ADMIN</p>
      </div>
      <nav className="space-y-1 px-3">
        {items.map(({ to, label, Icon, end, badge }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                isActive ? 'bg-sakura-50 font-semibold text-sakura-700' : 'text-zinc-600 hover:bg-zinc-50'
              }`
            }
          >
            <Icon size={18} strokeWidth={1.8} />
            <span>{label(t)}</span>
            {badge && <CountBadge count={count} />}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

export function AdminMobileNav() {
  const { profile } = useAuth();
  const { t } = useI18n();
  const { count } = useUnhandledNotifications(profile?.role === 'admin');

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-100 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
      <ul className="grid grid-cols-7">
        {items.map(({ to, label, Icon, end, badge }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] ${
                  isActive ? 'font-semibold text-sakura-600' : 'text-zinc-400'
                }`
              }
            >
              <span className="relative">
                <Icon size={18} strokeWidth={1.8} />
                {badge && <CountBadge count={count} compact />}
              </span>
              <span>{label(t)}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
