import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import { NavItem } from '../../constants/navigation';
import { useUIStore } from '../../store/useUIStore';
import { useAuthStore } from '../../store/useAuthStore';
import { usePermissions } from '../../hooks/usePermissions';
import { useLogout } from '../../hooks/useLogout';
import { cn } from '../../lib/utils';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator
} from '../ui/dropdown-menu';
import { User, Key, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ChangePasswordDialog } from '../auth/ChangePasswordDialog';
import { Logo } from '../Logo';

const SidebarItem = ({ item, depth = 0 }: { item: NavItem; depth?: number; key?: React.Key }) => {
  const { sidebarOpen } = useUIStore();
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const Icon = item.icon;
  const hasSubmenu = item.submenu && item.submenu.length > 0;
  const isActive = item.path === location.pathname ||
    (hasSubmenu && item.submenu?.some(sub => sub.path === location.pathname));

  if (!sidebarOpen && depth === 0) {
    return (
      <div className="flex justify-center py-3 relative group">
        <div className={cn(
          "p-2 rounded-lg transition-colors",
          isActive ? "bg-primary-deep text-white" : "text-lighter-gray hover:bg-secondary-dark hover:text-white"
        )}>
          {Icon && <Icon size={20} />}
        </div>
        <div className="absolute left-full ml-2 px-2 py-1 bg-secondary-dark text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
          {item.title}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div
        className={cn(
          "flex items-center justify-between px-4 py-2.5 mx-2 rounded-lg cursor-pointer transition-all duration-200 group",
          isActive && !hasSubmenu ? "bg-white/10 text-white" : "text-lighter-gray hover:bg-white/5 hover:text-white",
          depth > 0 && "py-2 text-sm"
        )}
        onClick={() => hasSubmenu && setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
          {Icon && <Icon size={depth === 0 ? 20 : 16} className={cn(isActive ? "text-white" : "text-mid-shade group-hover:text-lighter-gray")} />}
          {item.path ? (
            <NavLink to={item.path} className="flex-1">
              {item.title}
            </NavLink>
          ) : (
            <span className="flex-1">{item.title}</span>
          )}
        </div>
        {hasSubmenu && (
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown size={14} />
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {isOpen && hasSubmenu && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden ml-6 mt-1 border-l border-white/10"
          >
            {item.submenu?.map((sub, idx) => (
              <NavLink
                key={idx}
                to={sub.path}
                end
                className={({ isActive }) => cn(
                  "block px-6 py-2 text-xs transition-colors rounded-r-lg mx-2 my-0.5",
                  isActive ? "text-white bg-white/5 font-medium" : "text-lighter-gray hover:text-white hover:bg-white/5"
                )}
              >
                {sub.title}
              </NavLink>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const Sidebar = () => {
  const navigate = useNavigate();
  const logout = useLogout();
  const { sidebarOpen } = useUIStore();
  const { user } = useAuthStore();
  const { filteredNavItems, primaryRoleName } = usePermissions();
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);

  const handleLogout = () => {
    void logout('manual');
  };

  const initials = user?.full_name
    ? user.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarOpen ? 240 : 80 }}
      className="fixed left-0 top-0 h-screen bg-primary-deep z-40 flex flex-col shadow-xl overflow-hidden"
    >
      <div
        className={cn(
          'flex h-16 shrink-0 items-center border-b border-white/5',
          sidebarOpen ? 'px-3' : 'justify-center px-2',
        )}
      >
        <Logo
          to="/"
          src="/logo/logo.png"
          className={cn('min-w-0', sidebarOpen ? 'w-full' : 'justify-center')}
          imageClassName={cn(
            sidebarOpen
              ? 'h-12 max-h-12 w-full max-w-[210px]'
              : 'h-10 w-10 max-h-10 rounded-md object-cover object-left',
          )}
        />
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide py-4">
        <nav className="space-y-0.5">
          {filteredNavItems.map((item, idx) => (
            <SidebarItem key={idx} item={item} />
          ))}
        </nav>
      </div>

      <div className="p-4 mt-auto border-t border-white/5 relative">
        <DropdownMenu>
          <DropdownMenuTrigger
            nativeButton={false}
            render={
              <div
                className={cn(
                  "flex items-center gap-3 cursor-pointer p-2 rounded-xl transition-all hover:bg-white/5",
                  !sidebarOpen && "justify-center"
                )}
              >
                <div className="w-8 h-8 rounded-full bg-primary-deep flex items-center justify-center text-xs text-white">
                  {initials}
                </div>
                {sidebarOpen && (
                  <div className="overflow-hidden">
                    <p className="text-sm text-white font-medium truncate uppercase">{user?.full_name ?? 'User'}</p>
                    <p className="text-[10px] text-lighter-gray truncate">{primaryRoleName}</p>
                  </div>
                )}
              </div>
            }
          />
          <DropdownMenuContent align="start" side="right" className="ml-2 w-56 p-1 rounded-xl shadow-2xl border-slate-200">
            <DropdownMenuGroup>
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 rounded-t-lg">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">User Account</p>
                <p className="text-sm font-black text-primary-deep truncate">{user?.full_name ?? 'User'}</p>
                {user?.email ? (
                  <p className="mt-0.5 truncate text-[10px] font-bold text-slate-400">{user.email}</p>
                ) : null}
              </div>
            </DropdownMenuGroup>

            <DropdownMenuGroup>
              <div className="p-1">
                <DropdownMenuItem onClick={() => navigate('/profile')} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-black text-slate-600 hover:bg-slate-50 hover:text-primary-deep cursor-pointer">
                  <User size={16} className="text-slate-400" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsPasswordDialogOpen(true)} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-black text-slate-600 hover:bg-slate-50 hover:text-primary-deep cursor-pointer">
                  <Key size={16} className="text-slate-400" />
                  Change Password
                </DropdownMenuItem>
              </div>
            </DropdownMenuGroup>

            <DropdownMenuSeparator className="bg-slate-100 my-1" />

            <DropdownMenuGroup>
              <div className="p-1">
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-black text-rose-600 hover:bg-rose-50 cursor-pointer"
                >
                  <LogOut size={16} />
                  Sign out
                </DropdownMenuItem>
              </div>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <ChangePasswordDialog
          isOpen={isPasswordDialogOpen}
          onOpenChange={setIsPasswordDialogOpen}
        />
      </div>
    </motion.aside>
  );
};
