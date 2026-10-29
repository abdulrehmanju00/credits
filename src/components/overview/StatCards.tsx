import React from 'react';
import { useCreditFlow } from '../../context/CreditFlowContext';
import { formatPKR } from '../../lib/utils';

export const StatCards: React.FC = () => {
  const { metrics, customers } = useCreditFlow();

  // Prefer live values if initialized, fallback to Stitch reference values
  const totalSales = metrics?.totalReceivablesPaisa
    ? formatPKR(metrics.totalReceivablesPaisa + (metrics.collectedThisMonthPaisa || 0))
    : 'PKR 1,850,000';

  const outstandingBalance = metrics?.totalReceivablesPaisa
    ? formatPKR(metrics.totalReceivablesPaisa)
    : 'PKR 640,000';

  const overdueAmount = metrics?.overdueAmountPaisa
    ? formatPKR(metrics.overdueAmountPaisa)
    : 'PKR 315,000';

  const totalCustomers = customers.length ? String(customers.length) : '28';

  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      {/* Total Sales Card */}
      <div className="bg-gradient-to-br from-[#F0FDF4] to-[#F7FEFA] p-5 rounded-2xl border border-[#DCFCE7] shadow-sm flex flex-col justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#DCFCE7] flex items-center justify-center text-[#059669]">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="text-xs font-semibold text-[#475569]">Total Sales</span>
        </div>
        <div className="mt-4">
          <div className="text-2xl font-bold text-[#0F172A] tracking-tight">{totalSales}</div>
          <div className="flex items-center gap-1.5 mt-2 text-xs">
            <span className="font-semibold text-[#059669] flex items-center gap-0.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M5 10l7-7m0 0l7 7m-7-7v18" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              12%
            </span>
            <span className="text-[#64748B]">vs last month</span>
          </div>
        </div>
      </div>

      {/* Outstanding Balance Card */}
      <div className="bg-gradient-to-br from-[#FFF7ED] to-[#FFFBF5] p-5 rounded-2xl border border-[#FFEDD5] shadow-sm flex flex-col justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#FEE2E2] flex items-center justify-center text-[#DC2626]">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="text-xs font-semibold text-[#475569]">Outstanding Balance</span>
        </div>
        <div className="mt-4">
          <div className="text-2xl font-bold text-[#0F172A] tracking-tight">{outstandingBalance}</div>
          <div className="flex items-center gap-1.5 mt-2 text-xs">
            <span className="font-semibold text-[#DC2626] flex items-center gap-0.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M5 10l7-7m0 0l7 7m-7-7v18" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              8%
            </span>
            <span className="text-[#64748B]">vs last month</span>
          </div>
        </div>
      </div>

      {/* Overdue Amount Card */}
      <div className="bg-gradient-to-br from-[#FEF2F2] to-[#FFF8F8] p-5 rounded-2xl border border-[#FEE2E2] shadow-sm flex flex-col justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#FEE2E2] flex items-center justify-center text-[#EF4444]">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="text-xs font-semibold text-[#475569]">Overdue Amount</span>
        </div>
        <div className="mt-4">
          <div className="text-2xl font-bold text-[#0F172A] tracking-tight">{overdueAmount}</div>
          <div className="flex items-center gap-1.5 mt-2 text-xs">
            <span className="font-semibold text-[#DC2626] flex items-center gap-0.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M5 10l7-7m0 0l7 7m-7-7v18" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              24%
            </span>
            <span className="text-[#64748B]">vs last month</span>
          </div>
        </div>
      </div>

      {/* Total Customers Card */}
      <div className="bg-gradient-to-br from-[#F0F9FF] to-[#F8FCFF] p-5 rounded-2xl border border-[#E0F2FE] shadow-sm flex flex-col justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#E0F2FE] flex items-center justify-center text-[#0284C7]">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="text-xs font-semibold text-[#475569]">Total Customers</span>
        </div>
        <div className="mt-4">
          <div className="text-2xl font-bold text-[#0F172A] tracking-tight">{totalCustomers}</div>
          <div className="flex items-center gap-1.5 mt-2 text-xs">
            <span className="font-semibold text-[#059669] flex items-center gap-0.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M5 10l7-7m0 0l7 7m-7-7v18" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              4%
            </span>
            <span className="text-[#64748B]">vs last month</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default StatCards;
