import React from 'react';
import { useCreditFlow } from '../../context/CreditFlowContext';

export const SalesChartAndDonut: React.FC = () => {
  const { invoices } = useCreditFlow();

  // If live invoices are loaded, compute dynamic values; otherwise display Stitch defaults
  const totalCount = invoices.length || 42;
  const paidCount = invoices.filter(i => i.payment_status === 'PAID').length || 20;
  const pendingCount = invoices.filter(i => i.payment_status !== 'PAID' && (i.due_status === 'DUE_SOON' || i.due_status === 'CURRENT' || i.status === 'Due Soon')).length || 8;
  const overdueCount = invoices.filter(i => i.payment_status !== 'PAID' && (i.due_status === 'OVERDUE' || i.status === 'Overdue')).length || 10;
  const draftCount = Math.max(0, totalCount - paidCount - pendingCount - overdueCount) || 4;

  const paidPct = Math.round((paidCount / totalCount) * 100);
  const pendingPct = Math.round((pendingCount / totalCount) * 100);
  const overduePct = Math.round((overdueCount / totalCount) * 100);
  const draftPct = Math.max(0, 100 - paidPct - pendingPct - overduePct);

  // Circumference = 2 * PI * 38 ≈ 238.76
  const c = 238.76;
  const paidDash = (paidPct / 100) * c;
  const pendingDash = (pendingPct / 100) * c;
  const overdueDash = (overduePct / 100) * c;
  const draftDash = (draftPct / 100) * c;

  return (
    <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left: Sales and Payments Bar Chart (Spans 2 columns) */}
      <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-[#E2E8F0] shadow-sm flex flex-col justify-between">
        {/* Card Header & Legend */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4">
          <h2 className="text-base font-bold text-[#0F172A]">Sales and Payments</h2>
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#059669]"></span>
              <span className="text-xs font-medium text-[#64748B]">Sales</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB]"></span>
              <span className="text-xs font-medium text-[#64748B]">Payments</span>
            </div>
            {/* Range Selector */}
            <button className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-[#475569] hover:bg-slate-50 transition-colors" type="button">
              Last 6 months
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* Chart Area */}
        <div className="relative w-full pt-4 h-64 flex">
          {/* Y-Axis Labels */}
          <div className="flex flex-col justify-between text-right text-[11px] font-medium text-[#64748B] pr-4 select-none pb-7">
            <span>PKR 800K</span>
            <span>600K</span>
            <span>400K</span>
            <span>200K</span>
            <span>0</span>
          </div>

          {/* Chart Canvas Grid & Bars */}
          <div className="flex-1 flex flex-col justify-between relative">
            {/* Horizontal Grid Lines */}
            <div className="absolute inset-x-0 top-2 border-b border-dashed border-[#E2E8F0]"></div>
            <div className="absolute inset-x-0 top-[26%] border-b border-dashed border-[#E2E8F0]"></div>
            <div className="absolute inset-x-0 top-[51%] border-b border-dashed border-[#E2E8F0]"></div>
            <div className="absolute inset-x-0 top-[76%] border-b border-dashed border-[#E2E8F0]"></div>
            <div className="absolute inset-x-0 bottom-7 border-b border-slate-200"></div>

            {/* Bar Columns Container */}
            <div className="h-full flex items-end justify-between px-2 sm:px-4 pb-7 z-10">
              {/* May 2026: Sales ~410K, Payments ~320K */}
              <div className="flex flex-col items-center gap-2 group">
                <div className="flex items-end gap-1.5 h-44">
                  <div className="w-3.5 sm:w-5 bg-[#059669] rounded-t-sm transition-all group-hover:brightness-110" style={{ height: '51%' }}></div>
                  <div className="w-3.5 sm:w-5 bg-[#2563EB] rounded-t-sm transition-all group-hover:brightness-110" style={{ height: '40%' }}></div>
                </div>
                <span className="text-[11px] text-[#64748B] font-medium">May 2026</span>
              </div>

              {/* Jun 2026: Sales ~480K, Payments ~370K */}
              <div className="flex flex-col items-center gap-2 group">
                <div className="flex items-end gap-1.5 h-44">
                  <div className="w-3.5 sm:w-5 bg-[#059669] rounded-t-sm transition-all group-hover:brightness-110" style={{ height: '60%' }}></div>
                  <div className="w-3.5 sm:w-5 bg-[#2563EB] rounded-t-sm transition-all group-hover:brightness-110" style={{ height: '46%' }}></div>
                </div>
                <span className="text-[11px] text-[#64748B] font-medium">Jun 2026</span>
              </div>

              {/* Jul 2026: Sales ~480K, Payments ~370K */}
              <div className="flex flex-col items-center gap-2 group">
                <div className="flex items-end gap-1.5 h-44">
                  <div className="w-3.5 sm:w-5 bg-[#059669] rounded-t-sm transition-all group-hover:brightness-110" style={{ height: '60%' }}></div>
                  <div className="w-3.5 sm:w-5 bg-[#2563EB] rounded-t-sm transition-all group-hover:brightness-110" style={{ height: '46%' }}></div>
                </div>
                <span className="text-[11px] text-[#64748B] font-medium">Jul 2026</span>
              </div>

              {/* Aug 2026: Sales ~560K, Payments ~470K */}
              <div className="flex flex-col items-center gap-2 group">
                <div className="flex items-end gap-1.5 h-44">
                  <div className="w-3.5 sm:w-5 bg-[#059669] rounded-t-sm transition-all group-hover:brightness-110" style={{ height: '70%' }}></div>
                  <div className="w-3.5 sm:w-5 bg-[#2563EB] rounded-t-sm transition-all group-hover:brightness-110" style={{ height: '58%' }}></div>
                </div>
                <span className="text-[11px] text-[#64748B] font-medium">Aug 2026</span>
              </div>

              {/* Sep 2026: Sales ~600K, Payments ~430K */}
              <div className="flex flex-col items-center gap-2 group">
                <div className="flex items-end gap-1.5 h-44">
                  <div className="w-3.5 sm:w-5 bg-[#059669] rounded-t-sm transition-all group-hover:brightness-110" style={{ height: '75%' }}></div>
                  <div className="w-3.5 sm:w-5 bg-[#2563EB] rounded-t-sm transition-all group-hover:brightness-110" style={{ height: '53%' }}></div>
                </div>
                <span className="text-[11px] text-[#64748B] font-medium">Sep 2026</span>
              </div>

              {/* Oct 2026: Sales ~710K, Payments ~620K */}
              <div className="flex flex-col items-center gap-2 group">
                <div className="flex items-end gap-1.5 h-44">
                  <div className="w-3.5 sm:w-5 bg-[#059669] rounded-t-sm transition-all group-hover:brightness-110" style={{ height: '88%' }}></div>
                  <div className="w-3.5 sm:w-5 bg-[#2563EB] rounded-t-sm transition-all group-hover:brightness-110" style={{ height: '77%' }}></div>
                </div>
                <span className="text-[11px] text-[#64748B] font-medium">Oct 2026</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Invoice Status Donut Chart (Spans 1 column) */}
      <div className="bg-white p-6 rounded-2xl border border-[#E2E8F0] shadow-sm flex flex-col justify-between">
        <h2 className="text-base font-bold text-[#0F172A] mb-2">Invoice Status</h2>
        <div className="flex items-center justify-between gap-4 py-3">
          {/* Donut Graphic with Centered Text */}
          <div className="relative w-40 h-40 flex-shrink-0 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              {/* Background Base Circle */}
              <circle cx="50" cy="50" fill="none" r="38" stroke="#F1F5F9" strokeWidth="12"></circle>
              {/* Paid Segment */}
              <circle
                cx="50"
                cy="50"
                fill="none"
                r="38"
                stroke="#059669"
                strokeDasharray={`${paidDash} ${c}`}
                strokeDashoffset="0"
                strokeLinecap="butt"
                strokeWidth="12"
              ></circle>
              {/* Pending Segment */}
              <circle
                cx="50"
                cy="50"
                fill="none"
                r="38"
                stroke="#F59E0B"
                strokeDasharray={`${pendingDash} ${c}`}
                strokeDashoffset={-paidDash}
                strokeLinecap="butt"
                strokeWidth="12"
              ></circle>
              {/* Overdue Segment */}
              <circle
                cx="50"
                cy="50"
                fill="none"
                r="38"
                stroke="#EF4444"
                strokeDasharray={`${overdueDash} ${c}`}
                strokeDashoffset={-(paidDash + pendingDash)}
                strokeLinecap="butt"
                strokeWidth="12"
              ></circle>
              {/* Draft Segment */}
              <circle
                cx="50"
                cy="50"
                fill="none"
                r="38"
                stroke="#94A3B8"
                strokeDasharray={`${draftDash} ${c}`}
                strokeDashoffset={-(paidDash + pendingDash + overdueDash)}
                strokeLinecap="butt"
                strokeWidth="12"
              ></circle>
            </svg>
            {/* Donut Center Text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[11px] text-[#64748B] font-medium leading-none">Total</span>
              <span className="text-2xl font-bold text-[#0F172A] mt-1">{totalCount}</span>
            </div>
          </div>

          {/* Donut Legend & Stats */}
          <div className="flex-1 space-y-2.5 text-xs">
            {/* Paid */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#059669]"></span>
                <span className="text-[#334155] font-medium">Paid</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold text-[#0F172A]">{paidCount}</span>
                <span className="text-[#64748B] w-8 text-right">{paidPct}%</span>
              </div>
            </div>

            {/* Pending */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]"></span>
                <span className="text-[#334155] font-medium">Pending</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold text-[#0F172A]">{pendingCount}</span>
                <span className="text-[#64748B] w-8 text-right">{pendingPct}%</span>
              </div>
            </div>

            {/* Overdue */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444]"></span>
                <span className="text-[#334155] font-medium">Overdue</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold text-[#0F172A]">{overdueCount}</span>
                <span className="text-[#64748B] w-8 text-right">{overduePct}%</span>
              </div>
            </div>

            {/* Draft */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#94A3B8]"></span>
                <span className="text-[#334155] font-medium">Draft</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold text-[#0F172A]">{draftCount}</span>
                <span className="text-[#64748B] w-8 text-right">{draftPct}%</span>
              </div>
            </div>
          </div>
        </div>
        <div className="h-2"></div>
      </div>
    </section>
  );
};

export default SalesChartAndDonut;
