import React from 'react';
import {
  Search,
  Bell,
  Menu,
  Sun,
  Moon,
  LogOut,
  User,
  Key
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUIStore } from '../../store/useUIStore';
import { useAuthStore } from '../../store/useAuthStore';
import { usePermissions } from '../../hooks/usePermissions';
import { useLogout } from '../../hooks/useLogout';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator
} from '../ui/dropdown-menu';
import { ChangePasswordDialog } from '../auth/ChangePasswordDialog';
import { NotificationDialog } from './NotificationDialog';
import { searchPlaceholder } from '@/lib/placeholders';
import { Z_NAV } from '@/lib/uiTokens';
import { fetchNotificationUnreadCount } from '@/lib/pipelineApi';

export const Navbar = () => {
  const navigate = useNavigate();
  const logout = useLogout();
  const { user } = useAuthStore();
  const { primaryRoleName } = usePermissions();
  const { toggleSidebar, isDarkMode, toggleDarkMode } = useUIStore();
  const initials = user?.full_name
    ? user.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U';
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = React.useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = React.useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = React.useState(0);

  const refreshUnreadNotificationCount = React.useCallback(async () => {
    try {
      const count = await fetchNotificationUnreadCount();
      setUnreadNotificationCount(count);
    } catch {
      setUnreadNotificationCount(0);
    }
  }, []);

  React.useEffect(() => {
    void refreshUnreadNotificationCount();
  }, [refreshUnreadNotificationCount]);

  const handleLogout = () => {
    void logout('manual');
  };

  return (
    <header className={`h-[64px] bg-white/70 dark:bg-[#2a2d4f]/90 backdrop-blur-md border-b border-slate-200/60 dark:border-white/10 sticky top-0 ${Z_NAV} px-6 flex items-center justify-between transition-colors duration-300`}>
      <div className="flex items-center gap-4 flex-1">
        <button
          onClick={toggleSidebar}
          className="p-2 hover:bg-white dark:hover:bg-slate-900 rounded-xl text-slate-500 dark:text-slate-400 shadow-sm border border-transparent hover:border-slate-200 dark:hover:border-slate-800 transition-all"
        >
          <Menu size={20} />
        </button>

        <div className="relative max-w-sm w-full hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={16} />
          <input
            type="text"
            placeholder={searchPlaceholder('Leads', 'Customers')}
            className="w-full bg-white dark:bg-[#2a2d4f] border border-slate-200 dark:border-white/12 rounded-xl py-2 pl-10 pr-4 shadow-sm text-[12px] text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-primary-deep/5 focus:border-primary-deep/20 dark:focus:border-white/20 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={toggleDarkMode}
          className="p-2 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-lg text-slate-500 dark:text-slate-400 transition-colors"
          title="Toggle Theme"
        >
          {isDarkMode ? <Sun size={20} className="text-amber-500" /> : <Moon size={20} />}
        </button>

        <div className="relative">
          <button
            onClick={() => setIsNotificationsOpen(true)}
            className="p-2 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-lg text-slate-500 dark:text-slate-400 transition-colors relative"
          >
            <Bell size={20} />
            {unreadNotificationCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 border-2 border-white dark:border-slate-950 rounded-full" />
            )}
          </button>
        </div>

        <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-800 mx-2" />

        <div className="relative">
          <DropdownMenu>
            <DropdownMenuTrigger
              nativeButton={false}
              render={
                <div
                  className="flex items-center gap-3 cursor-pointer group p-1.5 pr-3 rounded-xl hover:bg-white/50 dark:hover:bg-slate-900/50 border border-transparent hover:border-slate-200 dark:hover:border-slate-800 transition-all font-sans"
                >
                  <div className="text-right hidden sm:block">
                    <p className="text-[12px] font-black text-primary-deep dark:text-slate-200 leading-none uppercase">{user?.full_name ?? 'User'}</p>
                    <p className="text-[10px] text-mid-shade dark:text-slate-400 font-bold mt-1 uppercase tracking-wider">{primaryRoleName}</p>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-primary-deep shadow-lg shadow-primary-deep/20 flex items-center justify-center text-white font-black text-xs ring-4 ring-white dark:ring-slate-950 transition-all group-hover:scale-105">
                    {initials}
                  </div>
                </div>
              }
            />
            <DropdownMenuContent align="end" className="w-56 p-1 rounded-xl shadow-2xl border-slate-200 dark:border-white/10 bg-white dark:bg-[#252849]">
              <DropdownMenuGroup>
                <div className="px-4 py-3 border-b border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.04] rounded-t-lg">
                  <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Authenticated Account</p>
                  <p className="text-sm font-black text-primary-deep dark:text-slate-200 truncate">{user?.full_name ?? 'User'}</p>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 truncate">{user?.email ?? ''}</p>
                </div>
              </DropdownMenuGroup>

              <DropdownMenuGroup>
                <div className="p-1">
                  <DropdownMenuItem onClick={() => navigate('/profile')} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-black text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-primary-deep dark:hover:text-white cursor-pointer">
                    <User size={16} className="text-slate-400 dark:text-slate-500" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsPasswordDialogOpen(true)} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-black text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-primary-deep dark:hover:text-white cursor-pointer">
                    <Key size={16} className="text-slate-400 dark:text-slate-500" />
                    Change Password
                  </DropdownMenuItem>
                </div>
              </DropdownMenuGroup>

              <DropdownMenuSeparator className="bg-slate-100 dark:bg-slate-800 my-1" />

              <DropdownMenuGroup>
                <div className="p-1">
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-black text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 cursor-pointer"
                  >
                    <LogOut size={16} />
                    Sign out
                  </DropdownMenuItem>
                </div>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <ChangePasswordDialog
        isOpen={isPasswordDialogOpen}
        onOpenChange={setIsPasswordDialogOpen}
      />
      <NotificationDialog
        isOpen={isNotificationsOpen}
        onOpenChange={setIsNotificationsOpen}
        onUnreadCountChange={setUnreadNotificationCount}
      />
    </header>
  );
};
