import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreditFlow } from '../context/CreditFlowContext';
import { StatCards } from '../components/overview/StatCards';
import { SalesChartAndDonut } from '../components/overview/SalesChartAndDonut';
import { RecentInvoicesTable } from '../components/overview/RecentInvoicesTable';

export const OverviewPage: React.FC = () => {
  const navigate = useNavigate();
  const { business } = useCreditFlow();

  const firstName = business?.owner_name ? business.owner_name.split(' ')[0] : 'Ali';

  return (
    <>
      {/* BEGIN: DashboardGreeting */}
      <section className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-[#0F172A] tracking-tight">
            Good morning, {firstName}
          </h1>
          <p className="text-sm text-[#64748B] mt-1 font-normal">
            Here's what's happening with your business today.
          </p>
        </div>

        {/* Split Create Invoice Button */}
        <div className="inline-flex rounded-lg shadow-sm">
          <button
            onClick={() => navigate('/create-invoice')}
            className="inline-flex items-center gap-2 bg-[#059669] hover:bg-[#047857] text-white px-4 py-2.5 rounded-l-lg text-sm font-semibold transition-colors cursor-pointer"
            type="button"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Create Invoice</span>
          </button>
          <button
            onClick={() => navigate('/create-invoice')}
            className="bg-[#047857] hover:bg-[#065F46] text-white px-2.5 py-2.5 rounded-r-lg border-l border-emerald-600 transition-colors flex items-center justify-center cursor-pointer"
            type="button"
            title="More invoice options"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </section>
      {/* END: DashboardGreeting */}

      {/* 4 Metric Cards */}
      <StatCards />

      {/* Sales Trend Bar Chart & Status Donut */}
      <SalesChartAndDonut />

      {/* Recent Invoices Table */}
      <RecentInvoicesTable />
    </>
  );
};

export default OverviewPage;
