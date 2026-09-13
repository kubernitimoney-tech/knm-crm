import { create } from 'zustand';

interface UIState {
  sidebarOpen: boolean;
  isDarkMode: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleDarkMode: () => void;
}

const getInitialDarkMode = (): boolean => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('isDarkMode');
    if (saved !== null) {
      return saved === 'true';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return false;
};

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  isDarkMode: getInitialDarkMode(),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleDarkMode: () => set((state) => {
    const nextVal = !state.isDarkMode;
    localStorage.setItem('isDarkMode', String(nextVal));
    return { isDarkMode: nextVal };
  }),
}));
