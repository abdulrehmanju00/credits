import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

export const AppLayout: React.FC = () => {
  return (
    <div className="bg-[#F8FAFC] text-[#0F172A] min-h-screen flex antialiased">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 pb-12 overflow-x-hidden">
        <TopBar />
        <div className="px-8 pt-8 space-y-7 max-w-7xl mx-auto w-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AppLayout;
