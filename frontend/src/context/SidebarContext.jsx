import React, { createContext, useContext, useState, useEffect } from 'react';

const SidebarContext = createContext({
  isSidebarCollapsed: false,
  toggleSidebarCollapse: () => {},
  setSidebarCollapsed: () => {},
});

export function SidebarProvider({ children }) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('docvyn_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('docvyn_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  const setSidebarCollapsed = (value) => {
    setIsSidebarCollapsed(value);
    try {
      localStorage.setItem('docvyn_sidebar_collapsed', String(value));
    } catch {}
  };

  return (
    <SidebarContext.Provider
      value={{
        isSidebarCollapsed,
        toggleSidebarCollapse,
        setSidebarCollapsed,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}
