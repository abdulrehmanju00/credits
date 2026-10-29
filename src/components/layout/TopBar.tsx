import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreditFlow } from '../../context/CreditFlowContext';

export const TopBar: React.FC = () => {
  const navigate = useNavigate();
  const { business } = useCreditFlow();

  return (
    <header className="h-20 bg-white border-b border-[#E2E8F0] px-8 flex items-center justify-between gap-6 sticky top-0 z-20 select-none">
      {/* Search Input */}
      <div className="relative w-full max-w-xl">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <input
          className="w-full bg-[#F8FAFC] text-sm text-[#0F172A] placeholder-[#94A3B8] rounded-xl border border-slate-200 pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
          placeholder="Search customers, invoices or anything..."
          type="text"
        />
      </div>

      {/* Top Right Controls */}
      <div className="flex items-center gap-4 flex-shrink-0">
        {/* Currency Pill */}
        <button
          className="flex items-center gap-2 px-3.5 py-1.5 border border-slate-200 rounded-lg bg-white text-xs font-semibold text-[#334155] hover:bg-slate-50 transition-colors"
          type="button"
        >
          <span>PKR</span>
          <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Notification Bell */}
        <button
          onClick={() => navigate('/notifications')}
          className="relative p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
          type="button"
          title="Notifications"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
        </button>

        {/* User Profile Pill */}
        <div
          onClick={() => navigate('/settings')}
          className="flex items-center gap-3 pl-2 cursor-pointer"
          title="Business Settings"
        >
          <div className="w-10 h-10 rounded-full bg-[#0D6E6E] text-white flex items-center justify-center font-bold text-sm tracking-wide shadow-sm">
            AS
          </div>
          <div className="flex flex-col text-left">
            <span className="text-xs font-bold text-[#0F172A] leading-tight">
              {business?.owner_name || 'Ali Shah'}
            </span>
            <span className="text-[11px] text-[#64748B] leading-tight mt-0.5">
              {business?.name || 'Shah Traders'}
            </span>
          </div>
          <svg className="w-3.5 h-3.5 text-slate-400 ml-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </header>
  );
};

export default TopBar;
