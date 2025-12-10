import React, { createContext, useContext, useMemo, useState, ReactNode } from 'react';

interface SidebarState {
  isSidebarOpen: boolean;
  isSidebarCollapsed: boolean;
  setSidebarOpen: (isOpen: boolean) => void;
  setSidebarCollapsed: (isCollapsed: boolean) => void;
  toggleSidebarCollapsed: () => void;
}

const SidebarStateContext = createContext<SidebarState | undefined>(undefined);

export const SidebarStateProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);

  const value = useMemo(
    () => ({
      isSidebarOpen,
      isSidebarCollapsed,
      setSidebarOpen,
      setSidebarCollapsed,
      toggleSidebarCollapsed: () => setSidebarCollapsed(prev => !prev),
    }),
    [isSidebarOpen, isSidebarCollapsed]
  );

  return <SidebarStateContext.Provider value={value}>{children}</SidebarStateContext.Provider>;
};

export const useSidebarState = () => {
  const context = useContext(SidebarStateContext);
  if (!context) throw new Error('useSidebarState must be used within a SidebarStateProvider');
  return context;
};
