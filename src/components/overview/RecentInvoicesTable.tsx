import React from 'react';
import { Link } from 'react-router-dom';
import { useCreditFlow } from '../../context/CreditFlowContext';
import { formatPKR, formatDate } from '../../lib/utils';
import { Invoice } from '../../types/models';

export const RecentInvoicesTable: React.FC = () => {
  const { invoices } = useCreditFlow();

  // Reference Stitch static sample records fallback if no dynamic invoices yet
  const sampleInvoices = [
    {
      id: 'inv-1042',
      invoice_number: 'INV-2026-1042',
      customer_name: 'Karachi Fresh Mart',
      issue_date: '2026-10-12',
      due_date: '2026-10-26',
      total_paisa: 12500000,
      balance_due_paisa: 12500000,
      status: 'Pending'
    },
    {
      id: 'inv-1041',
      invoice_number: 'INV-2026-1041',
      customer_name: 'Zeeshan Electronics',
      issue_date: '2026-10-10',
      due_date: '2026-10-20',
      total_paisa: 28000000,
      balance_due_paisa: 28000000,
      status: 'Overdue'
    },
    {
      id: 'inv-1040',
      invoice_number: 'INV-2026-1040',
      customer_name: 'Al Rehman General Store',
      issue_date: '2026-10-08',
      due_date: '2026-10-18',
      total_paisa: 9000000,
      balance_due_paisa: 0,
      status: 'Paid'
    },
    {
      id: 'inv-1039',
      invoice_number: 'INV-2026-1039',
      customer_name: 'Babar & Sons Wholesale',
      issue_date: '2026-10-05',
      due_date: '2026-10-15',
      total_paisa: 34000000,
      balance_due_paisa: 34000000,
      status: 'Overdue'
    },
    {
      id: 'inv-1038',
      invoice_number: 'INV-2026-1038',
      customer_name: 'Faisalabad Agro Supplies',
      issue_date: '2026-10-01',
      due_date: '2026-10-15',
      total_paisa: 51000000,
      balance_due_paisa: 0,
      status: 'Paid'
    }
  ];

  const displayList = invoices.length >= 3 ? invoices.slice(0, 5) : sampleInvoices;

  function renderStatusBadge(statusStr: string, inv?: Invoice) {
    const s = inv ? (inv.payment_status === 'PAID' ? 'Paid' : (inv.due_status === 'OVERDUE' ? 'Overdue' : 'Pending')) : statusStr;
    if (s === 'Paid') {
      return (
        <span className="inline-flex items-center px-3.5 py-0.5 rounded-full text-xs font-semibold bg-[#DCFCE7] text-[#059669]">
          Paid
        </span>
      );
    }
    if (s === 'Overdue') {
      return (
        <span className="inline-flex items-center px-3 py-0.5 rounded-full text-xs font-semibold bg-[#FEE2E2] text-[#DC2626]">
          Overdue
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-3 py-0.5 rounded-full text-xs font-semibold bg-[#FEF3C7] text-[#D97706]">
        Pending
      </span>
    );
  }

  return (
    <section className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
      {/* Table Card Header */}
      <div className="p-6 flex items-center justify-between border-b border-slate-100">
        <h2 className="text-base font-bold text-[#0F172A]">Recent Invoices</h2>
        <Link
          to="/invoices"
          className="text-xs font-semibold text-[#2563EB] hover:text-blue-700 flex items-center gap-1 transition-colors"
        >
          <span>View all</span>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>

      {/* Invoices Data Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#F8FAFC] text-[#64748B] uppercase font-semibold border-b border-slate-100">
            <tr>
              <th className="py-3 px-6" scope="col">Invoice No.</th>
              <th className="py-3 px-6" scope="col">Customer</th>
              <th className="py-3 px-6" scope="col">Date</th>
              <th className="py-3 px-6" scope="col">Due Date</th>
              <th className="py-3 px-6" scope="col">Amount</th>
              <th className="py-3 px-6" scope="col">Status</th>
              <th className="py-3 px-6" scope="col">Outstanding</th>
              <th className="py-3 px-4 text-center" scope="col"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium text-[#334155]">
            {displayList.map((inv: any) => (
              <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                <td className="py-3.5 px-6 font-semibold text-[#0F172A]">
                  <Link to="/invoice-details" className="hover:text-[#059669] transition-colors">
                    {inv.invoice_number}
                  </Link>
                </td>
                <td className="py-3.5 px-6">
                  {inv.customer_name}
                </td>
                <td className="py-3.5 px-6 text-[#64748B]">
                  {formatDate(inv.issue_date)}
                </td>
                <td className="py-3.5 px-6 text-[#64748B]">
                  {formatDate(inv.due_date)}
                </td>
                <td className="py-3.5 px-6 font-semibold text-[#0F172A]">
                  {formatPKR(inv.total_paisa)}
                </td>
                <td className="py-3.5 px-6">
                  {renderStatusBadge(inv.status, inv.due_status ? inv : undefined)}
                </td>
                <td className="py-3.5 px-6 text-[#334155]">
                  {formatPKR(inv.balance_due_paisa)}
                </td>
                <td className="py-3.5 px-4 text-center">
                  <button className="text-slate-400 hover:text-slate-600 p-1" type="button" title="More options">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <circle cx="5" cy="12" r="2"></circle>
                      <circle cx="12" cy="12" r="2"></circle>
                      <circle cx="19" cy="12" r="2"></circle>
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default RecentInvoicesTable;
