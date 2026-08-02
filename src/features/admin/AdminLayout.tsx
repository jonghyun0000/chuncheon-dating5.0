import { Outlet, Link } from 'react-router-dom';
import AdminSidebar, { AdminMobileNav } from '@/components/admin/AdminSidebar';
import { useAuth } from '@/hooks/useAuth';

export default function AdminLayout() {
  const { profile, signOut } = useAuth();
  return (
    <div className="min-h-screen bg-cream md:flex">
      <AdminSidebar />
      <div className="flex-1">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-zinc-100 bg-white/80 px-5 py-3 backdrop-blur">
          <div>
            <p className="text-xs text-zinc-400">관리자</p>
            <p className="text-sm font-semibold text-zinc-800">{profile?.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/" className="rounded-full bg-zinc-100 px-3 py-1.5 text-xs text-zinc-600">사용자 화면</Link>
            <button onClick={signOut} className="rounded-full bg-zinc-100 px-3 py-1.5 text-xs text-zinc-600">로그아웃</button>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-5 py-6 pb-24 md:pb-6">
          <Outlet />
        </main>
        <AdminMobileNav />
      </div>
    </div>
  );
}
