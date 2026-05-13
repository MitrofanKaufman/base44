import { Link, Outlet, useLocation } from 'react-router-dom';
// Layout
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  LayoutDashboard, Users, FolderOpen, Package, Calculator,
  TrendingUp, Menu, ChevronLeft, ChevronRight, BarChart3, Shield, Settings, LogOut,
  Bell, CheckCircle2
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { isUser1Account } from '@/lib/AdminInitializer';
import { listUserMessages, markUserMessageRead } from '@/lib/adminApi';
import { cn } from '@/lib/utils';

const nav = [
  { icon: LayoutDashboard, label: 'Дашборд', to: '/' },
  { icon: Users, label: 'Клиенты', to: '/clients' },
  { icon: FolderOpen, label: 'Проекты', to: '/projects' },
  { icon: Package, label: 'Товары', to: '/products' },
  { icon: Calculator, label: 'Расчёты', to: '/calculations' },
  { icon: TrendingUp, label: 'Калькулятор', to: '/calculator' },
  { icon: BarChart3, label: 'Анализ', to: '/analysis' },
];

const adminNav = [
  { icon: Shield, label: 'Администрирование', to: '/admin' },
];

export default function Layout() {
  const queryClient = useQueryClient();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuth();

  const isActive = (to) => to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);
  const userInitial = (user?.full_name?.[0] || user?.email?.[0] || 'U').toUpperCase();
  const userLabel = user?.full_name || user?.email || 'Пользователь';

  const isAdmin = user?.role === 'admin' || user?.role === 'administrator' || user?.role === 'owner' || isUser1Account(user);
  const allNav = isAdmin ? [...nav, ...adminNav] : nav;
  const currentPage = location.pathname.startsWith('/settings')
    ? { label: 'Настройки пользователя' }
    : allNav.find(n => isActive(n.to));
  const { data: messagesData = { items: [], unread: 0 } } = useQuery({
    queryKey: ['user-messages'],
    queryFn: () => listUserMessages(20),
    enabled: Boolean(user?.email),
    refetchInterval: 60_000,
  });
  const messages = messagesData.items || [];
  const unreadMessages = messagesData.unread || 0;
  const markReadMutation = useMutation({
    mutationFn: markUserMessageRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-messages'] });
    },
  });

  const closeProfileMenu = () => setProfileMenuOpen(false);
  const closeMessagesMenu = () => setMessagesOpen(false);

  const handleProfileMenuBlur = (event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      closeProfileMenu();
    }
  };

  const handleProfileMenuKeyDown = (event) => {
    if (event.key === 'Escape') {
      closeProfileMenu();
    }
  };

  const handleMessagesBlur = (event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      closeMessagesMenu();
    }
  };

  const handleMessagesKeyDown = (event) => {
    if (event.key === 'Escape') {
      closeMessagesMenu();
    }
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#f7f2eb' }}>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: 'rgba(32,26,21,0.45)' }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed lg:relative z-50 h-full flex flex-col transition-all duration-300 flex-shrink-0",
        collapsed ? "w-[68px]" : "w-[228px]",
        mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )} style={{ background: '#201a15', borderRight: '1px solid #2e2218' }}>

        {/* Logo */}
        <div className={cn(
          "flex items-center gap-3 border-b",
          collapsed ? "px-3 py-5 justify-center" : "px-5 py-5"
        )} style={{ borderColor: '#2e2218' }}>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: '#9a3412' }}>
            <BarChart3 className="w-4 h-4 text-white" />
          </div>
          {!collapsed && (
            <div>
              <span className="font-semibold text-white text-sm tracking-tight">unit.marketing</span>
              <p className="text-xs" style={{ color: '#8a7060' }}>Analytics Platform</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2.5 py-4 space-y-0.5 overflow-y-auto">
          {!collapsed && (
            <p className="text-xs font-semibold uppercase tracking-widest mb-3 px-2.5" style={{ color: '#5a4535' }}>
              Навигация
            </p>
          )}
          {allNav.map(({ icon: Icon, label, to }) => {
            const active = isActive(to);
            return (
              <Link
                key={to}
                to={to}
                onClick={() => setMobileOpen(false)}
                title={collapsed ? label : undefined}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
                  collapsed && "justify-center px-2",
                  active
                    ? "text-white"
                    : "hover:text-white"
                )}
                style={active
                  ? { background: '#9a3412', color: '#fff' }
                  : { color: '#a09080' }
                }
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#2e2218'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {!collapsed && <span>{label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Version badge */}
        {!collapsed && (
          <div className="px-4 pb-3">
            <div className="rounded-xl p-3" style={{ background: '#2e2218' }}>
              <p className="text-xs font-medium" style={{ color: '#c0a080' }}>WB Analytics</p>
              <p className="text-xs mt-0.5" style={{ color: '#5a4535' }}>Версия 1.0 · Demo</p>
            </div>
          </div>
        )}

        {/* Collapse toggle */}
        <div className="hidden lg:flex p-2.5 border-t" style={{ borderColor: '#2e2218' }}>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center p-2 rounded-lg transition-colors"
            style={{ color: '#5a4535' }}
            onMouseEnter={e => e.currentTarget.style.background = '#2e2218'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top header */}
        <header className="flex items-center justify-between px-5 py-3 flex-shrink-0"
          style={{
            background: '#fffdf9',
            borderBottom: '1px solid #e4d7c9',
            boxShadow: '0 1px 4px rgba(61,38,20,.05)'
          }}>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-1.5 rounded-lg"
              style={{ color: '#6f6257' }}
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: '#201a15' }}>
                {currentPage?.label || 'unit.marketing'}
              </h2>
              <p className="text-xs hidden sm:block" style={{ color: '#9a8070' }}>
                Аналитическая платформа юнит-экономики
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div
              className="relative"
              onBlur={handleMessagesBlur}
              onKeyDown={handleMessagesKeyDown}
            >
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={messagesOpen}
                aria-label="Открыть уведомления"
                onClick={() => setMessagesOpen(open => !open)}
                className="relative w-9 h-9 rounded-lg flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                style={{ color: '#6f6257', background: '#f7f2eb', border: '1px solid #e4d7c9' }}
              >
                <Bell className="w-4 h-4" />
                {unreadMessages > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full text-[10px] leading-4 text-white text-center" style={{ background: '#b45309' }}>
                    {unreadMessages > 9 ? '9+' : unreadMessages}
                  </span>
                )}
              </button>

              <div
                role="menu"
                className={cn(
                  "absolute right-0 top-full mt-2 w-[340px] max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-card shadow-warm-sm p-2 transition-all z-50",
                  messagesOpen
                    ? "opacity-100 visible translate-y-0"
                    : "opacity-0 invisible -translate-y-1 pointer-events-none"
                )}
                style={{ borderColor: '#e4d7c9', background: '#fffdf9' }}
              >
                <div className="px-2 py-2 border-b flex items-center justify-between" style={{ borderColor: '#f0e3d5' }}>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: '#201a15' }}>Уведомления</p>
                    <p className="text-xs" style={{ color: '#8a7060' }}>{unreadMessages} непрочитанных</p>
                  </div>
                </div>

                <div className="max-h-80 overflow-y-auto py-1">
                  {messages.length === 0 && (
                    <div className="px-3 py-8 text-center text-sm" style={{ color: '#8a7060' }}>
                      Сообщений нет
                    </div>
                  )}

                  {messages.map(message => {
                    const unread = !message.read_at;
                    return (
                      <div
                        key={message.id}
                        role="menuitem"
                        className="px-2 py-2 rounded-lg"
                        style={{ background: unread ? '#fff7ed' : 'transparent' }}
                      >
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate" style={{ color: '#201a15' }}>
                              {message.title}
                            </p>
                            <p className="text-xs mt-1 line-clamp-2" style={{ color: '#6f6257' }}>
                              {message.body}
                            </p>
                            <p className="text-[11px] mt-1" style={{ color: '#a09080' }}>
                              {message.created_date ? new Date(message.created_date).toLocaleString('ru-RU') : ''}
                            </p>
                          </div>
                          {unread && (
                            <button
                              type="button"
                              title="Отметить прочитанным"
                              onClick={() => markReadMutation.mutate(message.id)}
                              disabled={markReadMutation.isPending}
                              className="p-1.5 rounded-md hover:bg-white transition-colors"
                              style={{ color: '#9a3412' }}
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl"
              style={{ background: '#f7f2eb', border: '1px solid #e4d7c9' }}>
              <div className="w-2 h-2 rounded-full" style={{ background: '#22c55e' }} />
              <span className="text-xs font-medium" style={{ color: '#6f6257' }}>Wildberries · Live</span>
            </div>
            <div
              className="relative"
              onMouseEnter={() => setProfileMenuOpen(true)}
              onMouseLeave={closeProfileMenu}
              onFocus={() => setProfileMenuOpen(true)}
              onBlur={handleProfileMenuBlur}
              onKeyDown={handleProfileMenuKeyDown}
            >
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={profileMenuOpen}
                aria-label="Открыть меню пользователя"
                onClick={() => setProfileMenuOpen(open => !open)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                style={{ background: '#9a3412' }}
              >
                {userInitial}
              </button>

              <div
                role="menu"
                className={cn(
                  "absolute right-0 top-full mt-2 w-64 rounded-xl border border-border bg-card shadow-warm-sm p-2 transition-all z-50",
                  profileMenuOpen
                    ? "opacity-100 visible translate-y-0"
                    : "opacity-0 invisible -translate-y-1 pointer-events-none"
                )}
                style={{ borderColor: '#e4d7c9', background: '#fffdf9' }}
              >
                <div className="px-2 py-2 border-b" style={{ borderColor: '#f0e3d5' }}>
                  <p className="text-sm font-semibold" style={{ color: '#201a15' }}>{userLabel}</p>
                  <p className="text-xs truncate" style={{ color: '#8a7060' }}>{user?.email || 'Без email'}</p>
                </div>

                <Link
                  to="/settings"
                  role="menuitem"
                  onClick={closeProfileMenu}
                  className="mt-1 flex items-center gap-2 px-2 py-2 rounded-lg text-sm transition-colors"
                  style={{ color: '#6f6257' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#f7f2eb'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <Settings className="w-4 h-4" />
                  Настройки пользователя
                </Link>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    closeProfileMenu();
                    logout();
                  }}
                  className="w-full mt-1 flex items-center gap-2 px-2 py-2 rounded-lg text-sm transition-colors text-left"
                  style={{ color: '#b45309' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#fff1e8'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <LogOut className="w-4 h-4" />
                  Выйти
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto" style={{ background: '#f7f2eb' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
