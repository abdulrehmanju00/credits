import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreditFlow } from '../context/CreditFlowContext';
import { Customer } from '../types/models';
import { formatPKR } from '../lib/utils';
import { AddCustomerModal } from '../components/customers/AddCustomerModal';

// Authentic avatar palette matching Stitch reference
const AVATAR_PALETTES: { [key: string]: { bg: string; text: string } } = {
  KF: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  ZE: { bg: 'bg-sky-100', text: 'text-sky-700' },
  AR: { bg: 'bg-amber-100', text: 'text-amber-700' },
  BS: { bg: 'bg-purple-100', text: 'text-purple-700' },
  NM: { bg: 'bg-blue-100', text: 'text-blue-700' },
  ST: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  AT: { bg: 'bg-teal-100', text: 'text-teal-700' }
};

const DEFAULT_PALETTES = [
  { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  { bg: 'bg-sky-100', text: 'text-sky-700' },
  { bg: 'bg-amber-100', text: 'text-amber-700' },
  { bg: 'bg-purple-100', text: 'text-purple-700' },
  { bg: 'bg-blue-100', text: 'text-blue-700' },
  { bg: 'bg-rose-100', text: 'text-rose-700' },
  { bg: 'bg-indigo-100', text: 'text-indigo-700' }
];

function getAvatarColors(initials: string, index: number) {
  if (AVATAR_PALETTES[initials]) {
    return AVATAR_PALETTES[initials];
  }
  return DEFAULT_PALETTES[index % DEFAULT_PALETTES.length];
}

interface ComputedCustomerStats {
  customer: Customer;
  totalInvoicedPaisa: number;
  totalPaidPaisa: number;
  balanceDuePaisa: number;
  displayStatus: 'Overdue' | 'Due Soon' | 'Paid' | 'Active';
}

export const CustomersPage: React.FC = () => {
  const navigate = useNavigate();
  const { customers, invoices, repository, refreshData, isLoading } = useCreditFlow();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<string>('name_asc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6; // Matching Stitch reference page capacity

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close actions dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute live financial totals and overdue status strictly from invoices
  const computedList: ComputedCustomerStats[] = useMemo(() => {
    return customers.map((c) => {
      const custInvoices = invoices.filter((inv) => inv.customer_id === c.id);

      if (custInvoices.length > 0) {
        const totalInvoiced = custInvoices.reduce((sum, inv) => sum + (inv.total_paisa || 0), 0);
        const totalPaid = custInvoices.reduce((sum, inv) => sum + (inv.paid_paisa || 0), 0);
        const balanceDue = custInvoices.reduce((sum, inv) => sum + (inv.balance_due_paisa || 0), 0);

        const unpaidInvoices = custInvoices.filter((inv) => inv.payment_status !== 'PAID');
        let status: 'Overdue' | 'Due Soon' | 'Paid' | 'Active' = 'Active';

        if (unpaidInvoices.some((inv) => inv.due_status === 'OVERDUE')) {
          status = 'Overdue';
        } else if (unpaidInvoices.some((inv) => inv.due_status === 'DUE_SOON')) {
          status = 'Due Soon';
        } else if (balanceDue === 0 && totalInvoiced > 0) {
          status = 'Paid';
        } else {
          status = 'Active';
        }

        return {
          customer: c,
          totalInvoicedPaisa: totalInvoiced,
          totalPaidPaisa: totalPaid,
          balanceDuePaisa: balanceDue,
          displayStatus: status
        };
      }

      // Default to recorded customer fields if no linked invoices yet
      let status: 'Overdue' | 'Due Soon' | 'Paid' | 'Active' = 'Active';
      if (c.status === 'Overdue') status = 'Overdue';
      else if (c.status === 'Due Soon') status = 'Due Soon';
      else if (c.status === 'Paid' || (c.balance_due_paisa === 0 && c.total_invoiced_paisa > 0)) status = 'Paid';

      return {
        customer: c,
        totalInvoicedPaisa: c.total_invoiced_paisa || 0,
        totalPaidPaisa: c.total_paid_paisa || 0,
        balanceDuePaisa: c.balance_due_paisa || 0,
        displayStatus: status
      };
    });
  }, [customers, invoices]);

  // Filter by search query and status
  const filteredList = useMemo(() => {
    let result = computedList;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      result = result.filter(
        (item) =>
          item.customer.name.toLowerCase().includes(query) ||
          (item.customer.phone && item.customer.phone.toLowerCase().includes(query)) ||
          (item.customer.city && item.customer.city.toLowerCase().includes(query)) ||
          (item.customer.category && item.customer.category.toLowerCase().includes(query))
      );
    }

    // Status filter
    if (statusFilter !== 'ALL') {
      result = result.filter((item) => {
        if (statusFilter === 'OVERDUE') return item.displayStatus === 'Overdue';
        if (statusFilter === 'DUE_SOON') return item.displayStatus === 'Due Soon';
        if (statusFilter === 'PAID') return item.displayStatus === 'Paid';
        if (statusFilter === 'ACTIVE') return item.displayStatus === 'Active';
        return true;
      });
    }

    // Sort order
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'name_asc':
          return a.customer.name.localeCompare(b.customer.name);
        case 'name_desc':
          return b.customer.name.localeCompare(a.customer.name);
        case 'balance_desc':
          return b.balanceDuePaisa - a.balanceDuePaisa;
        case 'balance_asc':
          return a.balanceDuePaisa - b.balanceDuePaisa;
        case 'total_invoiced_desc':
          return b.totalInvoicedPaisa - a.totalInvoicedPaisa;
        case 'recent':
          return (b.customer.created_at || '').localeCompare(a.customer.created_at || '');
        default:
          return 0;
      }
    });

    return result;
  }, [computedList, searchQuery, statusFilter, sortBy]);

  // Pagination calculation
  const totalItems = filteredList.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const paginatedList = filteredList.slice(startIndex, endIndex);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleCustomerAdded = async () => {
    await refreshData();
    showToast('Customer added successfully.');
  };

  const handleCustomerClick = (customerId: string) => {
    // Navigate to customer profile preserving stable customer ID
    navigate(`/customer-profile?id=${encodeURIComponent(customerId)}`);
  };

  return (
    <>
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#0F172A] text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-sm border border-slate-700 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <svg className="w-5 h-5 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
          </svg>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* BEGIN: PageTitleAndActions */}
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4" data-purpose="title-and-primary-action">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Customers</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage your customers, view their credit status and track balances.
          </p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center px-4 py-2.5 bg-[#059669] hover:bg-[#047857] text-white text-sm font-semibold rounded-lg shadow-sm transition-colors self-start sm:self-auto space-x-2 cursor-pointer"
          type="button"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
          </svg>
          <span>Add customer</span>
        </button>
      </section>
      {/* END: PageTitleAndActions */}

      {/* BEGIN: FilterAndSearchToolbar */}
      <section className="bg-white rounded-xl border border-slate-200/80 p-4 mb-6 shadow-sm" data-purpose="table-filter-bar">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Filter Search Box */}
          <div className="w-full md:w-96 relative">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by customer name, phone or city..."
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                type="button"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
              </button>
            )}
          </div>

          {/* Secondary Filters & Sort Controls */}
          <div className="flex items-center space-x-4 w-full md:w-auto justify-end">
            {/* Status Filter Dropdown */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="appearance-none flex items-center justify-between pl-3.5 pr-8 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer min-w-[130px]"
              >
                <option value="ALL">All Statuses</option>
                <option value="OVERDUE">Overdue</option>
                <option value="DUE_SOON">Due Soon</option>
                <option value="PAID">Paid</option>
                <option value="ACTIVE">Active</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
              </div>
            </div>

            {/* Sort By Control */}
            <div className="flex items-center space-x-2">
              <span className="text-sm text-slate-500 whitespace-nowrap hidden sm:inline">Sort by</span>
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="appearance-none flex items-center justify-between pl-3.5 pr-8 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer min-w-[130px]"
                >
                  <option value="name_asc">Name (A–Z)</option>
                  <option value="name_desc">Name (Z–A)</option>
                  <option value="balance_desc">Highest Balance</option>
                  <option value="balance_asc">Lowest Balance</option>
                  <option value="total_invoiced_desc">Total Invoiced</option>
                  <option value="recent">Recently Added</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* END: FilterAndSearchToolbar */}

      {/* BEGIN: CustomersTable */}
      <section className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden" data-purpose="customers-data-table">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            {/* Table Header */}
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 bg-slate-50/50">
                <th className="py-3.5 px-6 font-semibold">Customer</th>
                <th className="py-3.5 px-6 font-semibold">Phone</th>
                <th className="py-3.5 px-6 font-semibold">Total Invoiced</th>
                <th className="py-3.5 px-6 font-semibold">Paid</th>
                <th className="py-3.5 px-6 font-semibold">Balance Due</th>
                <th className="py-3.5 px-6 font-semibold text-center">Status</th>
                <th className="py-3.5 px-6 font-semibold text-right">Actions</th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-slate-100">
              {isLoading && paginatedList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" />
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce delay-100" />
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce delay-200" />
                    </div>
                    <span className="text-xs text-slate-400 mt-2 block">Loading customers...</span>
                  </td>
                </tr>
              ) : paginatedList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <div className="max-w-sm mx-auto text-center">
                      <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                        </svg>
                      </div>
                      <h3 className="text-sm font-semibold text-slate-800">No customers found</h3>
                      <p className="text-xs text-slate-500 mt-1">
                        {searchQuery || statusFilter !== 'ALL'
                          ? 'Try clearing or modifying your filter criteria.'
                          : 'Get started by adding your first trade customer.'}
                      </p>
                      {(searchQuery || statusFilter !== 'ALL') && (
                        <button
                          onClick={() => {
                            setSearchQuery('');
                            setStatusFilter('ALL');
                          }}
                          className="mt-3 inline-flex items-center text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                          type="button"
                        >
                          Clear all filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedList.map((item, idx) => {
                  const { customer: c, totalInvoicedPaisa, totalPaidPaisa, balanceDuePaisa, displayStatus } = item;
                  const palette = getAvatarColors(c.initials || 'CU', idx);
                  const isMenuOpen = activeMenuId === c.id;

                  // Balance styling matching Stitch:
                  // Red if Overdue, Amber if Due Soon, Emerald if Paid / 0
                  let balanceClass = 'font-bold text-slate-700';
                  if (displayStatus === 'Overdue') {
                    balanceClass = 'font-bold text-red-500';
                  } else if (displayStatus === 'Due Soon') {
                    balanceClass = 'font-bold text-amber-600';
                  } else if (displayStatus === 'Paid' || balanceDuePaisa === 0) {
                    balanceClass = 'font-bold text-emerald-600';
                  }

                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-slate-50/70 transition-colors group cursor-pointer"
                      onClick={() => handleCustomerClick(c.id)}
                    >
                      {/* Customer Info */}
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-3.5">
                          <div
                            className={`w-10 h-10 rounded-full ${palette.bg} ${palette.text} font-semibold text-xs flex items-center justify-center flex-shrink-0 select-none`}
                          >
                            {c.initials || 'CU'}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                              {c.name}
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5">
                              {c.city || 'Karachi'} • {c.category || 'Retail Store'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="py-4 px-6 text-slate-600 font-normal whitespace-nowrap">
                        {c.phone || '—'}
                      </td>

                      {/* Total Invoiced */}
                      <td className="py-4 px-6 text-slate-700 font-normal whitespace-nowrap">
                        {formatPKR(totalInvoicedPaisa)}
                      </td>

                      {/* Paid */}
                      <td className="py-4 px-6 text-slate-700 font-normal whitespace-nowrap">
                        {formatPKR(totalPaidPaisa)}
                      </td>

                      {/* Balance Due */}
                      <td className={`py-4 px-6 whitespace-nowrap ${balanceClass}`}>
                        {formatPKR(balanceDuePaisa)}
                      </td>

                      {/* Status Badge */}
                      <td className="py-4 px-6 text-center whitespace-nowrap">
                        {displayStatus === 'Overdue' && (
                          <span className="inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-red-100/70 text-red-600">
                            Overdue
                          </span>
                        )}
                        {displayStatus === 'Due Soon' && (
                          <span className="inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-amber-100/70 text-amber-700">
                            Due Soon
                          </span>
                        )}
                        {displayStatus === 'Paid' && (
                          <span className="inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100/70 text-emerald-600">
                            Paid
                          </span>
                        )}
                        {displayStatus === 'Active' && (
                          <span className="inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100/70 text-emerald-700">
                            Active
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td
                        className="py-4 px-6 text-right relative"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => setActiveMenuId(isMenuOpen ? null : c.id)}
                          className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-md hover:bg-slate-100 cursor-pointer"
                          type="button"
                          title="Actions"
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM18 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                        </button>

                        {/* Action Popover Menu */}
                        {isMenuOpen && (
                          <div
                            ref={menuRef}
                            className="absolute right-6 top-12 z-30 w-44 bg-white rounded-xl shadow-xl border border-slate-200/90 py-1.5 text-left text-xs animate-in fade-in zoom-in-95 duration-100"
                          >
                            <button
                              onClick={() => {
                                setActiveMenuId(null);
                                navigate(`/customer-profile?id=${encodeURIComponent(c.id)}`);
                              }}
                              className="w-full px-3.5 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium transition-colors cursor-pointer"
                            >
                              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                              </svg>
                              <span>View Profile</span>
                            </button>
                            <button
                              onClick={() => {
                                setActiveMenuId(null);
                                navigate(`/create-invoice?customer_id=${encodeURIComponent(c.id)}`);
                              }}
                              className="w-full px-3.5 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium transition-colors cursor-pointer"
                            >
                              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                              </svg>
                              <span>Create Invoice</span>
                            </button>
                            <button
                              onClick={() => {
                                setActiveMenuId(null);
                                navigate(`/record-payment?customer_id=${encodeURIComponent(c.id)}`);
                              }}
                              className="w-full px-3.5 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium transition-colors cursor-pointer border-t border-slate-100"
                            >
                              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                              </svg>
                              <span>Record Payment</span>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* BEGIN: PaginationFooter */}
        <footer className="py-4 px-6 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium" data-purpose="table-pagination">
          <div>
            Showing {totalItems > 0 ? startIndex + 1 : 0} to {endIndex} of {totalItems} customers
          </div>

          <div className="flex items-center space-x-1.5">
            {/* Previous Button */}
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safeCurrentPage <= 1}
              className="w-8 h-8 rounded border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              type="button"
              title="Previous page"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
            </button>

            {/* Page Numbers */}
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
              const isActive = page === safeCurrentPage;
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-8 h-8 rounded border font-semibold flex items-center justify-center transition-colors cursor-pointer ${
                    isActive
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                  type="button"
                >
                  {page}
                </button>
              );
            })}

            {/* Next Button */}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safeCurrentPage >= totalPages}
              className="w-8 h-8 rounded border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              type="button"
              title="Next page"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
            </button>
          </div>
        </footer>
        {/* END: PaginationFooter */}
      </section>
      {/* END: CustomersTable */}

      {/* Add Customer Modal */}
      <AddCustomerModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        existingCustomers={customers}
        repository={repository}
        onCustomerAdded={handleCustomerAdded}
      />
    </>
  );
};
export default CustomersPage;
