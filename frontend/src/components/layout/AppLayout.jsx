import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Menu } from 'lucide-react';
import { useSidebar } from '../../context/SidebarContext';

export default function AppLayout() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { isSidebarCollapsed, toggleSidebarCollapse } = useSidebar();

  return (
    <div className="h-screen w-screen flex bg-[#181817] text-[#ededed] overflow-hidden select-none">
      {/* Sidebar (Desktop retractable + Mobile slide-over drawer) */}
      <Sidebar
        isMobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      {/* Main Viewport Container Wrapper with visible top, bottom, and side frame spacing */}
      <div
        className={`flex-1 h-full min-w-0 flex flex-col p-0 transition-all duration-200 ease-in-out ${
          isSidebarCollapsed
            ? 'md:p-2.5'
            : 'md:py-2.5 md:pr-2.5 md:pl-0'
        }`}
      >
        {/* Floating Card with 4 rounded edges & distinct contrast matching Kimi */}
        <div className="w-full h-full rounded-2xl border border-[#262626] bg-[#121212] shadow-2xl overflow-hidden flex flex-col transition-all duration-200 ease-in-out">
          {/* Mobile Header Bar (hidden on desktop md:hidden) */}
          <div className="md:hidden h-11 w-full bg-[#181817] border-b border-[#262626] px-3 flex items-center justify-between shrink-0 z-20">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="p-1.5 rounded-lg text-[#8e8e8e] hover:text-white hover:bg-[#252524] transition cursor-pointer"
              title="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-md overflow-hidden bg-[#1c1c1e] flex items-center justify-center border border-[#2e2e2e]">
                <img src="/favicon2.svg" alt="docvyn" className="w-full h-full object-cover" />
              </div>
              <span className="font-heading text-xs font-semibold text-white tracking-wide">
                docvyn
              </span>
            </div>
            <div className="w-7" />
          </div>

          {/* Content Viewport */}
          <main className="flex-1 w-full h-full min-h-0 overflow-y-auto bg-[#121212] flex flex-col relative">
            <Outlet context={{ isSidebarCollapsed, toggleSidebarCollapse }} />
          </main>
        </div>
      </div>
    </div>
  );
}
