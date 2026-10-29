import React from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';

interface NavItem {
  name: string;
  path: string;
  iconSvg: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    name: 'Overview',
    path: '/dashboard',
    iconSvg: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  },
  {
    name: 'Customers',
    path: '/customers',
    iconSvg: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  },
  {
    name: 'Invoices',
    path: '/invoices',
    iconSvg: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  },
  {
    name: 'Payments',
    path: '/payments',
    iconSvg: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  },
  {
    name: 'Credit Ledger',
    path: '/credit-ledger',
    iconSvg: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  },
  {
    name: 'Reminders',
    path: '/reminders',
    iconSvg: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  },
  {
    name: 'Reports',
    path: '/reports',
    iconSvg: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  },
  {
    name: 'Products & Services',
    path: '/products',
    iconSvg: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  },
  {
    name: 'Settings',
    path: '/settings',
    iconSvg: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
];

export const Sidebar: React.FC = () => {
  const location = useLocation();

  return (
    <aside className="w-64 bg-white border-r border-[#E2E8F0] flex flex-col justify-between flex-shrink-0 min-h-screen sticky top-0 h-screen select-none z-20">
      <div>
        {/* Brand Logo Header */}
        <Link to="/dashboard" className="h-20 flex items-center px-6 gap-3">
          <div className="w-8 h-8 rounded-full bg-[#059669] flex items-center justify-center text-white shadow-sm flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="text-xl font-bold tracking-tight text-[#0F172A]">
            Credit<span className="text-[#059669]">Flow</span>
          </span>
        </Link>

        {/* Navigation Links */}
        <nav className="px-3.5 space-y-1">
          {navItems.map((item) => {
            const isMatch =
              (item.path === '/invoices' && (location.pathname.startsWith('/invoices') || location.pathname.startsWith('/create-invoice') || location.pathname.startsWith('/invoice-details'))) ||
              (item.path === '/customers' && (location.pathname.startsWith('/customers') || location.pathname.startsWith('/customer-profile'))) ||
              (item.path === '/products' && location.pathname.startsWith('/products')) ||
              (item.path === '/dashboard' && (location.pathname === '/' || location.pathname === '/dashboard' || location.pathname === '/overview')) ||
              location.pathname === item.path;

            return (
              <NavLink
                key={item.name}
                to={item.path}
                className={() =>
                  `flex items-center gap-3.5 px-3.5 py-2.5 rounded-lg text-sm transition-colors ${
                    isMatch
                      ? 'font-semibold bg-[#E6F7F0] text-[#065F46]'
                      : 'font-medium text-[#475569] hover:bg-slate-50 hover:text-[#0F172A]'
                  }`
                }
              >
                <span className={isMatch ? 'text-[#059669]' : 'text-[#64748B]'}>
                  {item.iconSvg}
                </span>
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Bottom Help & Support Section */}
      <div className="p-4 border-t border-[#E2E8F0] mb-2">
        <a
          className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-[#475569] hover:text-[#0F172A] rounded-lg transition-colors cursor-pointer"
          href="#help"
          onClick={(e) => {
            e.preventDefault();
            // Honest notification matching stitch demo pattern
            const existing = document.getElementById('cf-demo-notice');
            if (existing) existing.remove();
            const toast = document.createElement('div');
            toast.id = 'cf-demo-notice';
            toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#0f172a;color:#fff;padding:10px 18px;border-radius:10px;font-size:13px;z-index:9999999;box-shadow:0 10px 25px rgba(0,0,0,0.25);';
            toast.textContent = 'Help & Support documentation is a non-functional placeholder in this demo.';
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 3500);
          }}
        >
          <svg className="w-5 h-5 text-[#64748B]" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <path d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Help &amp; Support
        </a>
      </div>
    </aside>
  );
};

export default Sidebar;
