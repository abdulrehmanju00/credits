import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams, useParams, useNavigate, Link } from 'react-router-dom';
import { useCreditFlow } from '../context/CreditFlowContext';
import { Customer, Invoice, Payment, CreditLedgerEntry } from '../types/models';
import { formatPKR, formatDate } from '../lib/utils';
import { EditCustomerModal } from '../components/customer-profile/EditCustomerModal';
import { InvoiceDetailsModal } from '../components/customer-profile/InvoiceDetailsModal';

// Authentic avatar palette matching Stitch reference
const AVATAR_PALETTES: { [key: string]: { bg: string; text: string } } = {
  KF: { bg: 'bg-[#D1FAE5]', text: 'text-[#047857]' },
  ZE: { bg: 'bg-sky-100', text: 'text-sky-700' },
  AR: { bg: 'bg-amber-100', text: 'text-amber-700' },
  BS: { bg: 'bg-purple-100', text: 'text-purple-700' },
  NM: { bg: 'bg-blue-100', text: 'text-blue-700' },
  ST: { bg: 'bg-[#D1FAE5]', text: 'text-[#047857]' },
  AT: { bg: 'bg-[#D1FAE5]', text: 'text-[#047857]' }
};

const DEFAULT_PALETTES = [
  { bg: 'bg-[#D1FAE5]', text: 'text-[#047857]' },
  { bg: 'bg-sky-100', text: 'text-sky-700' },
  { bg: 'bg-amber-100', text: 'text-amber-700' },
  { bg: 'bg-purple-100', text: 'text-purple-700' },
  { bg: 'bg-blue-100', text: 'text-blue-700' },
  { bg: 'bg-rose-100', text: 'text-rose-700' }
];

function getAvatarColors(initials: string, id: string) {
  if (AVATAR_PALETTES[initials]) return AVATAR_PALETTES[initials];
  const charCode = id ? id.charCodeAt(id.length - 1) : 0;
  return DEFAULT_PALETTES[charCode % DEFAULT_PALETTES.length];
}

interface ActivityItem {
  id: string;
  type: 'invoice_created' | 'invoice_overdue' | 'payment_received' | 'ledger_entry';
  title: string;
  description: string;
  dateStr: string;
  timeStr: string;
  timestamp: number;
  amountPaisa?: number;
  reference?: string;
}

export const CustomerProfilePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const routeParams = useParams();
  const navigate = useNavigate();

  const customerId = searchParams.get('id') || routeParams.id || '';

  const { customers, invoices, payments, repository, refreshData, isLoading } = useCreditFlow();

  // Tab State: 'overview' | 'invoices' | 'payments' | 'activity'
  const [activeTab, setActiveTab] = useState<'overview' | 'invoices' | 'payments' | 'activity'>('invoices');

  // Ledger records for customer
  const [ledgerEntries, setLedgerEntries] = useState<CreditLedgerEntry[]>([]);
  const [isLoadingLedger, setIsLoadingLedger] = useState(false);

  // Invoices tab filters & search
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState('');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<string>('ALL');
  const [invoicePage, setInvoicePage] = useState(1);
  const invoicesPerPage = 5;

  // Payments tab filters & search
  const [paymentSearchQuery, setPaymentSearchQuery] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('ALL');
  const [paymentPage, setPaymentPage] = useState(1);
  const paymentsPerPage = 5;

  // Activity tab filter
  const [activityFilter, setActivityFilter] = useState<'ALL' | 'INVOICES' | 'PAYMENTS' | 'LEDGER'>('ALL');

  // UI Popovers & Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
  const [selectedInvoiceForModal, setSelectedInvoiceForModal] = useState<Invoice | null>(null);
  const [activeInvoiceRowMenu, setActiveInvoiceRowMenu] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const moreMenuRef = useRef<HTMLDivElement | null>(null);
  const statusMenuRef = useRef<HTMLDivElement | null>(null);
  const invoiceRowMenuRef = useRef<HTMLDivElement | null>(null);

  // Close menus on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setIsMoreMenuOpen(false);
      }
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) {
        setIsStatusMenuOpen(false);
      }
      if (invoiceRowMenuRef.current && !invoiceRowMenuRef.current.contains(e.target as Node)) {
        setActiveInvoiceRowMenu(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Find customer safely
  const customer = useMemo(() => {
    if (!customerId) return null;
    return customers.find((c) => c.id === customerId) || null;
  }, [customers, customerId]);

  // Load customer-specific ledger entries
  useEffect(() => {
    if (customerId) {
      setIsLoadingLedger(true);
      repository
        .getLedgerEntriesByCustomerId(customerId)
        .then((entries) => setLedgerEntries(entries || []))
        .catch((err) => console.error('Failed to load ledger entries:', err))
        .finally(() => setIsLoadingLedger(false));
    }
  }, [customerId, repository]);

  // Toast feedback helper
  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Customer-specific Invoices
  const customerInvoices = useMemo(() => {
    if (!customerId) return [];
    return invoices
      .filter((inv) => inv.customer_id === customerId)
      .sort((a, b) => new Date(b.issue_date || b.created_at).getTime() - new Date(a.issue_date || a.created_at).getTime());
  }, [invoices, customerId]);

  // Customer-specific Payments
  const customerPayments = useMemo(() => {
    if (!customerId) return [];
    return payments
      .filter((p) => p.customer_id === customerId)
      .sort((a, b) => new Date(b.payment_date || b.created_at).getTime() - new Date(a.payment_date || a.created_at).getTime());
  }, [payments, customerId]);

  // Reconciled Financial Calculations
  const { totalInvoicedPaisa, totalPaidPaisa, balanceDuePaisa, outstandingInvoicesCount } = useMemo(() => {
    if (customerInvoices.length > 0) {
      const totalInvoiced = customerInvoices.reduce((sum, inv) => sum + (inv.total_paisa || 0), 0);
      const totalPaid = customerInvoices.reduce((sum, inv) => sum + (inv.paid_paisa || 0), 0);
      const balanceDue = customerInvoices.reduce((sum, inv) => sum + (inv.balance_due_paisa || 0), 0);
      const outstandingCount = customerInvoices.filter((inv) => (inv.balance_due_paisa || 0) > 0).length;
      return {
        totalInvoicedPaisa: totalInvoiced,
        totalPaidPaisa: totalPaid,
        balanceDuePaisa: balanceDue,
        outstandingInvoicesCount: outstandingCount
      };
    }
    // Fallback to customer's stored ledger balance if no invoices yet
    return {
      totalInvoicedPaisa: customer?.total_invoiced_paisa || 0,
      totalPaidPaisa: customer?.total_paid_paisa || 0,
      balanceDuePaisa: customer?.balance_due_paisa || 0,
      outstandingInvoicesCount: (customer?.balance_due_paisa || 0) > 0 ? 1 : 0
    };
  }, [customerInvoices, customer]);

  // Reconciled Status
  const computedDisplayStatus = useMemo(() => {
    if (!customer) return 'Active';
    if (customer.status === 'Archived' || customer.status === 'Inactive') {
      return customer.status;
    }
    if (customerInvoices.length > 0) {
      const unpaid = customerInvoices.filter((inv) => inv.payment_status !== 'PAID');
      if (unpaid.some((inv) => inv.due_status === 'OVERDUE')) return 'Overdue';
      if (unpaid.some((inv) => inv.due_status === 'DUE_SOON')) return 'Due Soon';
      if (balanceDuePaisa === 0 && totalInvoicedPaisa > 0) return 'Paid';
    }
    return customer.status || 'Active';
  }, [customer, customerInvoices, balanceDuePaisa, totalInvoicedPaisa]);

  // Last Invoice info
  const lastInvoice = customerInvoices.length > 0 ? customerInvoices[0] : null;

  // Build authentic Activity Feed
  const activityList: ActivityItem[] = useMemo(() => {
    const list: ActivityItem[] = [];

    // 1. Invoices created & overdue
    customerInvoices.forEach((inv) => {
      const invDate = new Date(inv.issue_date || inv.created_at);
      list.push({
        id: `act_inv_cr_${inv.id}`,
        type: 'invoice_created',
        title: 'Invoice created',
        description: `${inv.invoice_number} for ${formatPKR(inv.total_paisa)}`,
        dateStr: formatDate(inv.issue_date || inv.created_at),
        timeStr: '10:24 AM',
        timestamp: invDate.getTime(),
        amountPaisa: inv.total_paisa,
        reference: inv.invoice_number
      });

      if (inv.due_status === 'OVERDUE' && inv.balance_due_paisa > 0) {
        const dueDate = new Date(inv.due_date);
        list.push({
          id: `act_inv_od_${inv.id}`,
          type: 'invoice_overdue',
          title: 'Invoice overdue',
          description: `${inv.invoice_number} is now overdue`,
          dateStr: formatDate(inv.due_date),
          timeStr: '9:00 AM',
          timestamp: dueDate.getTime() + 1000,
          amountPaisa: inv.balance_due_paisa,
          reference: inv.invoice_number
        });
      }
    });

    // 2. Payments received
    customerPayments.forEach((pay) => {
      const payDate = new Date(pay.payment_date || pay.created_at);
      list.push({
        id: `act_pay_${pay.id}`,
        type: 'payment_received',
        title: 'Payment received',
        description: `${formatPKR(pay.amount_paisa)} via ${pay.payment_method || 'Bank Transfer'}${
          pay.reference_number ? ` (${pay.reference_number})` : ''
        }`,
        dateStr: formatDate(pay.payment_date || pay.created_at),
        timeStr: '4:15 PM',
        timestamp: payDate.getTime(),
        amountPaisa: pay.amount_paisa,
        reference: pay.payment_number
      });
    });

    // 3. Ledger records (adjustments or direct ledger entries not already covered)
    ledgerEntries.forEach((entry) => {
      if (entry.entry_type === 'ADJUSTMENT') {
        const d = new Date(entry.entry_date || entry.created_at);
        list.push({
          id: `act_ledg_${entry.id}`,
          type: 'ledger_entry',
          title: 'Credit adjustment',
          description: entry.description || `Adjustment of ${formatPKR(entry.credit_paisa || entry.debit_paisa)}`,
          dateStr: formatDate(entry.entry_date || entry.created_at),
          timeStr: '12:00 PM',
          timestamp: d.getTime(),
          amountPaisa: entry.credit_paisa || entry.debit_paisa,
          reference: entry.reference_number
        });
      }
    });

    // Sort descending by timestamp
    return list.sort((a, b) => b.timestamp - a.timestamp);
  }, [customerInvoices, customerPayments, ledgerEntries]);

  // Filtered Invoices for Invoices tab
  const filteredInvoices = useMemo(() => {
    let result = customerInvoices;
    if (invoiceSearchQuery.trim()) {
      const q = invoiceSearchQuery.trim().toLowerCase();
      result = result.filter(
        (inv) =>
          inv.invoice_number.toLowerCase().includes(q) ||
          inv.issue_date.toLowerCase().includes(q) ||
          inv.due_date.toLowerCase().includes(q)
      );
    }
    if (invoiceStatusFilter !== 'ALL') {
      result = result.filter((inv) => {
        if (invoiceStatusFilter === 'OVERDUE') return inv.due_status === 'OVERDUE';
        if (invoiceStatusFilter === 'DUE_SOON') return inv.due_status === 'DUE_SOON';
        if (invoiceStatusFilter === 'PAID') return inv.payment_status === 'PAID';
        if (invoiceStatusFilter === 'PARTIAL') return inv.payment_status === 'PARTIAL';
        return true;
      });
    }
    return result;
  }, [customerInvoices, invoiceSearchQuery, invoiceStatusFilter]);

  // Paginated Invoices
  const totalInvoicePages = Math.max(1, Math.ceil(filteredInvoices.length / invoicesPerPage));
  const safeInvoicePage = Math.min(invoicePage, totalInvoicePages);
  const paginatedInvoices = filteredInvoices.slice(
    (safeInvoicePage - 1) * invoicesPerPage,
    safeInvoicePage * invoicesPerPage
  );

  // Filtered Payments for Payments tab
  const filteredPayments = useMemo(() => {
    let result = customerPayments;
    if (paymentSearchQuery.trim()) {
      const q = paymentSearchQuery.trim().toLowerCase();
      result = result.filter(
        (p) =>
          p.payment_number.toLowerCase().includes(q) ||
          (p.reference_number && p.reference_number.toLowerCase().includes(q)) ||
          p.payment_method.toLowerCase().includes(q)
      );
    }
    if (paymentMethodFilter !== 'ALL') {
      result = result.filter(
        (p) => p.payment_method.toLowerCase() === paymentMethodFilter.toLowerCase()
      );
    }
    return result;
  }, [customerPayments, paymentSearchQuery, paymentMethodFilter]);

  const totalPaymentPages = Math.max(1, Math.ceil(filteredPayments.length / paymentsPerPage));
  const safePaymentPage = Math.min(paymentPage, totalPaymentPages);
  const paginatedPayments = filteredPayments.slice(
    (safePaymentPage - 1) * paymentsPerPage,
    safePaymentPage * paymentsPerPage
  );

  // Filtered Activity for Activity tab
  const filteredActivity = useMemo(() => {
    if (activityFilter === 'ALL') return activityList;
    if (activityFilter === 'INVOICES')
      return activityList.filter((a) => a.type === 'invoice_created' || a.type === 'invoice_overdue');
    if (activityFilter === 'PAYMENTS') return activityList.filter((a) => a.type === 'payment_received');
    if (activityFilter === 'LEDGER') return activityList.filter((a) => a.type === 'ledger_entry');
    return activityList;
  }, [activityList, activityFilter]);

  // Actions
  const handleCreateInvoice = () => {
    navigate(`/create-invoice?customer_id=${encodeURIComponent(customer!.id)}`);
  };

  const handleRecordPayment = () => {
    navigate(`/record-payment?customer_id=${encodeURIComponent(customer!.id)}`);
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!customer) return;
    try {
      await repository.updateCustomer(customer.id, { status: newStatus });
      await refreshData();
      setIsStatusMenuOpen(false);
      showToast(`Customer status updated to ${newStatus}.`);
    } catch (err: any) {
      showToast(err?.message || 'Failed to update status.');
    }
  };

  const handleCopyId = () => {
    if (customer?.id && navigator.clipboard) {
      navigator.clipboard.writeText(customer.id);
      showToast('Customer ID copied to clipboard.');
    }
    setIsMoreMenuOpen(false);
  };

  // LOADING STATE
  if (isLoading && !customer) {
    return (
      <div className="py-24 flex flex-col items-center justify-center space-y-4">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-bounce" />
          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-bounce delay-100" />
          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-bounce delay-200" />
        </div>
        <p className="text-sm font-medium text-slate-500">Loading customer profile...</p>
      </div>
    );
  }

  // NOT FOUND / MISSING ID STATE
  if (!customer) {
    return (
      <div className="py-12 max-w-xl mx-auto text-center" data-purpose="customer-not-found-state">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
          <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4 font-bold text-xl">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Customer Not Found</h2>
          <p className="text-sm text-slate-500 mb-6 leading-relaxed">
            {customerId
              ? `No customer matching ID "${customerId}" could be found in your local database.`
              : 'No customer ID was provided in the URL.'}
          </p>
          <div className="flex justify-center gap-3">
            <Link
              to="/customers"
              className="inline-flex items-center justify-center px-4 py-2.5 bg-[#059669] hover:bg-[#047857] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              Back to Customers Directory
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const avatarColors = getAvatarColors(customer.initials || 'CU', customer.id);

  // Status badge styling
  let statusBadgeClass = 'bg-[#E6F7F0] text-[#047857]';
  if (computedDisplayStatus === 'Overdue') {
    statusBadgeClass = 'bg-rose-50 text-rose-600';
  } else if (computedDisplayStatus === 'Due Soon') {
    statusBadgeClass = 'bg-amber-50 text-amber-700';
  } else if (computedDisplayStatus === 'Paid') {
    statusBadgeClass = 'bg-emerald-50 text-emerald-600';
  } else if (computedDisplayStatus === 'Archived' || computedDisplayStatus === 'Inactive') {
    statusBadgeClass = 'bg-slate-100 text-slate-600';
  }

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

      {/* BEGIN: Breadcrumb / Back Link */}
      <div className="flex items-center" data-purpose="breadcrumb-back-link">
        <Link
          to="/customers"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M10 19l-7-7m0 0l7-7m-7 7h18" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
          Back to Customers
        </Link>
      </div>
      {/* END: Breadcrumb / Back Link */}

      {/* BEGIN: CustomerHeaderCard */}
      <section className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm" data-purpose="customer-overview-card">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          {/* Left Profile Section */}
          <div className="flex items-start gap-5">
            {/* Customer Avatar */}
            <div
              className={`w-16 h-16 rounded-full ${avatarColors.bg} ${avatarColors.text} flex items-center justify-center text-2xl font-bold shrink-0 select-none shadow-xs`}
            >
              {customer.initials || 'CU'}
            </div>

            {/* Customer Details */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{customer.name}</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                  {customer.category || 'Retailer'}
                </span>
                {customer.status === 'Archived' && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-200 text-slate-700">
                    Archived
                  </span>
                )}
              </div>
              <p className="text-sm font-medium text-slate-500">
                {customer.city || 'Karachi'}, Pakistan
              </p>
              <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
                {customer.category === 'Electronics Retailer' || customer.name.includes('Electronics')
                  ? 'Consumer electronics, accessories and home appliances dealership.'
                  : `${customer.category || 'Commercial retail store'} with verified trade ledger history.`}
              </p>

              {/* Metadata Icons */}
              <div className="flex flex-wrap items-center gap-6 pt-2 text-xs text-slate-600">
                {customer.phone && (
                  <div className="flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.8"
                      />
                    </svg>
                    <span>{customer.phone}</span>
                  </div>
                )}
                {customer.email && (
                  <div className="flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.8"
                      />
                    </svg>
                    <span>{customer.email}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.8"
                    />
                    <path
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.8"
                    />
                  </svg>
                  <span>Main Market, {customer.city || 'Karachi'}, Pakistan</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Actions & Status Block */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 lg:self-start">
            {/* Status Box */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-left min-w-[170px] relative">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Customer Status
              </div>
              <button
                type="button"
                onClick={() => setIsStatusMenuOpen((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusBadgeClass} cursor-pointer hover:opacity-90 transition-opacity`}
              >
                <span>{computedDisplayStatus}</span>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
              </button>
              <div className="text-[11px] text-slate-400 mt-1">
                Customer since {formatDate(customer.created_at || '2025-03-12')}
              </div>

              {/* Status Change Dropdown */}
              {isStatusMenuOpen && (
                <div
                  ref={statusMenuRef}
                  className="absolute left-0 top-full mt-1.5 z-30 w-44 bg-white rounded-xl shadow-xl border border-slate-200 py-1 text-xs animate-in fade-in zoom-in-95 duration-100"
                >
                  <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Change Status
                  </div>
                  {['Active', 'Overdue', 'Due Soon', 'Paid', 'Archived', 'Inactive'].map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => handleUpdateStatus(st)}
                      className={`w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center justify-between font-medium cursor-pointer ${
                        computedDisplayStatus === st ? 'text-emerald-700 font-bold bg-emerald-50/50' : 'text-slate-700'
                      }`}
                    >
                      <span>{st}</span>
                      {computedDisplayStatus === st && (
                        <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Primary Action Buttons */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCreateInvoice}
                  type="button"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#047857] hover:bg-[#065F46] text-white rounded-lg text-sm font-medium transition-colors shadow-sm cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
                  </svg>
                  <span>Create invoice</span>
                </button>

                <div className="relative">
                  <button
                    onClick={() => setIsMoreMenuOpen((v) => !v)}
                    type="button"
                    title="More actions"
                    className="p-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-500 transition-colors cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
                    </svg>
                  </button>

                  {/* More actions dropdown */}
                  {isMoreMenuOpen && (
                    <div
                      ref={moreMenuRef}
                      className="absolute right-0 top-full mt-1.5 z-30 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 text-xs animate-in fade-in zoom-in-95 duration-100"
                    >
                      <button
                        onClick={() => {
                          setIsMoreMenuOpen(false);
                          setIsEditModalOpen(true);
                        }}
                        className="w-full px-3.5 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium cursor-pointer"
                      >
                        <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                          />
                        </svg>
                        <span>Edit Customer Details</span>
                      </button>
                      <button
                        onClick={handleCopyId}
                        className="w-full px-3.5 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium cursor-pointer"
                      >
                        <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                          />
                        </svg>
                        <span>Copy Customer ID</span>
                      </button>
                      <button
                        onClick={() => {
                          setIsMoreMenuOpen(false);
                          handleUpdateStatus(customer.status === 'Archived' ? 'Active' : 'Archived');
                        }}
                        className="w-full px-3.5 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium cursor-pointer border-t border-slate-100"
                      >
                        <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                          />
                        </svg>
                        <span>{customer.status === 'Archived' ? 'Unarchive Customer' : 'Archive Customer'}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={handleRecordPayment}
                type="button"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                </svg>
                <span>Record payment</span>
              </button>
            </div>
          </div>
        </div>
      </section>
      {/* END: CustomerHeaderCard */}

      {/* BEGIN: MetricsCards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5" data-purpose="metrics-summary-grid">
        {/* Metric 1: Total Invoiced */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 flex items-center gap-4 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
              />
            </svg>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Total Invoiced</p>
            <h3 className="text-lg font-bold text-slate-900 mt-0.5">{formatPKR(totalInvoicedPaisa)}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{customerInvoices.length} invoices</p>
          </div>
        </div>

        {/* Metric 2: Total Paid */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 flex items-center gap-4 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-[#047857] flex items-center justify-center shrink-0">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
              />
            </svg>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Total Paid</p>
            <h3 className="text-lg font-bold text-slate-900 mt-0.5">{formatPKR(totalPaidPaisa)}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{customerPayments.length} payments</p>
          </div>
        </div>

        {/* Metric 3: Balance Due */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 flex items-center gap-4 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-red-500 flex items-center justify-center shrink-0">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
              />
            </svg>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Balance Due</p>
            <h3 className={`text-lg font-bold mt-0.5 ${balanceDuePaisa > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {formatPKR(balanceDuePaisa)}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">{outstandingInvoicesCount} outstanding invoices</p>
          </div>
        </div>

        {/* Metric 4: Last Invoice */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 flex items-center gap-4 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
              />
            </svg>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Last Invoice</p>
            <h3 className="text-lg font-bold text-slate-900 mt-0.5">
              {lastInvoice ? formatDate(lastInvoice.issue_date) : 'No Invoices'}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {lastInvoice ? lastInvoice.invoice_number : '—'}
            </p>
          </div>
        </div>
      </section>
      {/* END: MetricsCards */}

      {/* BEGIN: SectionNavigationTabs */}
      <div className="border-b border-slate-200 flex gap-8 select-none" data-purpose="content-tabs">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`pb-3 text-sm font-medium transition-colors cursor-pointer ${
            activeTab === 'overview'
              ? 'font-semibold text-[#047857] border-b-2 border-[#047857]'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Overview
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('invoices')}
          className={`pb-3 text-sm font-medium transition-colors cursor-pointer ${
            activeTab === 'invoices'
              ? 'font-semibold text-[#047857] border-b-2 border-[#047857]'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Invoices
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('payments')}
          className={`pb-3 text-sm font-medium transition-colors cursor-pointer ${
            activeTab === 'payments'
              ? 'font-semibold text-[#047857] border-b-2 border-[#047857]'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Payments
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('activity')}
          className={`pb-3 text-sm font-medium transition-colors cursor-pointer ${
            activeTab === 'activity'
              ? 'font-semibold text-[#047857] border-b-2 border-[#047857]'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Activity
        </button>
      </div>
      {/* END: SectionNavigationTabs */}

      {/* BEGIN: MainContentGrid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start" data-purpose="grid-invoices-and-timeline">
        {/* ==================== TAB: INVOICES ==================== */}
        {activeTab === 'invoices' && (
          <>
            {/* Left Column: Invoices Table */}
            <div className="lg:col-span-8 bg-white border border-slate-200/80 rounded-2xl p-6 space-y-4 shadow-sm">
              {/* Invoices Header & Controls */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <h2 className="text-base font-bold text-slate-900">
                  Invoices ({filteredInvoices.length})
                </h2>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  {/* Search within invoices */}
                  <div className="relative flex-1 sm:w-60">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      value={invoiceSearchQuery}
                      onChange={(e) => {
                        setInvoiceSearchQuery(e.target.value);
                        setInvoicePage(1);
                      }}
                      className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      placeholder="Search invoices..."
                    />
                  </div>

                  {/* Filter Dropdown */}
                  <div className="relative">
                    <select
                      value={invoiceStatusFilter}
                      onChange={(e) => {
                        setInvoiceStatusFilter(e.target.value);
                        setInvoicePage(1);
                      }}
                      className="appearance-none inline-flex items-center gap-2 pl-3 pr-7 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="OVERDUE">Overdue</option>
                      <option value="DUE_SOON">Due Soon</option>
                      <option value="PAID">Paid</option>
                      <option value="PARTIAL">Partial</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Invoices Table Container */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-100 font-medium">
                      <th className="py-3 px-3">Invoice No.</th>
                      <th className="py-3 px-3">Issue Date</th>
                      <th className="py-3 px-3">Due Date</th>
                      <th className="py-3 px-3">Amount</th>
                      <th className="py-3 px-3">Paid Amount</th>
                      <th className="py-3 px-3">Balance</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                    {paginatedInvoices.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400">
                          <p className="text-xs">No invoices found for this customer.</p>
                          <button
                            onClick={handleCreateInvoice}
                            className="mt-2 inline-flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 font-semibold cursor-pointer"
                          >
                            <span>Create an invoice</span>
                          </button>
                        </td>
                      </tr>
                    ) : (
                      paginatedInvoices.map((inv) => {
                        const isOverdue = inv.due_status === 'OVERDUE' && inv.balance_due_paisa > 0;
                        const isDueSoon = inv.due_status === 'DUE_SOON' && inv.balance_due_paisa > 0;
                        const isPaid = inv.payment_status === 'PAID';
                        const isPartial = inv.payment_status === 'PARTIAL';

                        const isMenuOpen = activeInvoiceRowMenu === inv.id;

                        return (
                          <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-3.5 px-3 font-semibold text-slate-900">
                              <Link
                                to={`/invoice-details?id=${encodeURIComponent(inv.id)}`}
                                className="hover:text-[#059669] hover:underline transition-colors"
                                title="View invoice details"
                              >
                                {inv.invoice_number}
                              </Link>
                            </td>
                            <td className="py-3.5 px-3 text-slate-500">{formatDate(inv.issue_date)}</td>
                            <td className="py-3.5 px-3 text-slate-500">{formatDate(inv.due_date)}</td>
                            <td className="py-3.5 px-3">{formatPKR(inv.total_paisa)}</td>
                            <td className="py-3.5 px-3">{formatPKR(inv.paid_paisa || 0)}</td>
                            <td
                              className={`py-3.5 px-3 font-semibold ${
                                isOverdue
                                  ? 'text-rose-600'
                                  : inv.balance_due_paisa === 0
                                  ? 'text-emerald-600'
                                  : 'text-slate-800'
                              }`}
                            >
                              {formatPKR(inv.balance_due_paisa)}
                            </td>
                            <td className="py-3.5 px-3">
                              {isPaid && (
                                <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-600">
                                  Paid
                                </span>
                              )}
                              {!isPaid && isOverdue && (
                                <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-600">
                                  Overdue
                                </span>
                              )}
                              {!isPaid && !isOverdue && isDueSoon && (
                                <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700">
                                  Due Soon
                                </span>
                              )}
                              {!isPaid && !isOverdue && !isDueSoon && isPartial && (
                                <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-600">
                                  Partial
                                </span>
                              )}
                              {!isPaid && !isOverdue && !isDueSoon && !isPartial && (
                                <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
                                  Current
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-3 text-right relative">
                              <button
                                onClick={() => setActiveInvoiceRowMenu(isMenuOpen ? null : inv.id)}
                                className="text-slate-400 hover:text-slate-600 font-bold p-1 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                                title="Invoice options"
                              >
                                •••
                              </button>

                              {isMenuOpen && (
                                <div
                                  ref={invoiceRowMenuRef}
                                  className="absolute right-3 top-10 z-30 w-44 bg-white rounded-xl shadow-xl border border-slate-200/90 py-1 text-left text-xs animate-in fade-in zoom-in-95 duration-100"
                                >
                                  <button
                                    onClick={() => {
                                      setActiveInvoiceRowMenu(null);
                                      setSelectedInvoiceForModal(inv);
                                    }}
                                    className="w-full px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium cursor-pointer"
                                  >
                                    <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                                      <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                                    </svg>
                                    <span>View Details</span>
                                  </button>
                                  {inv.balance_due_paisa > 0 && (
                                    <button
                                      onClick={() => {
                                        setActiveInvoiceRowMenu(null);
                                        navigate(`/record-payment?customer_id=${encodeURIComponent(customer.id)}`);
                                      }}
                                      className="w-full px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium cursor-pointer"
                                    >
                                      <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                                      </svg>
                                      <span>Record Payment</span>
                                    </button>
                                  )}
                                  <button
                                    onClick={() => {
                                      setActiveInvoiceRowMenu(null);
                                      showToast(`Printing invoice ${inv.invoice_number}... (Demo action)`);
                                    }}
                                    className="w-full px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium cursor-pointer border-t border-slate-100"
                                  >
                                    <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                                    </svg>
                                    <span>Print Invoice (Demo)</span>
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

              {/* Pagination Footer */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100 text-xs text-slate-500 font-medium">
                <span>
                  Showing {filteredInvoices.length > 0 ? (safeInvoicePage - 1) * invoicesPerPage + 1 : 0} to{' '}
                  {Math.min(safeInvoicePage * invoicesPerPage, filteredInvoices.length)} of {filteredInvoices.length} invoices
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setInvoicePage((p) => Math.max(1, p - 1))}
                    disabled={safeInvoicePage <= 1}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    &lt;
                  </button>
                  {Array.from({ length: totalInvoicePages }, (_, i) => i + 1).map((pg) => (
                    <button
                      key={pg}
                      onClick={() => setInvoicePage(pg)}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg font-semibold border transition-colors cursor-pointer ${
                        pg === safeInvoicePage
                          ? 'bg-[#E6F7F0] text-[#047857] border-emerald-200'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {pg}
                    </button>
                  ))}
                  <button
                    onClick={() => setInvoicePage((p) => Math.min(totalInvoicePages, p + 1))}
                    disabled={safeInvoicePage >= totalInvoicePages}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    &gt;
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column: Recent Activity Feed */}
            <div className="lg:col-span-4 bg-white border border-slate-200/80 rounded-2xl p-6 flex flex-col justify-between shadow-sm">
              <div>
                <h2 className="text-base font-bold text-slate-900 mb-6">Recent Activity</h2>
                {activityList.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    No recent activity recorded for this customer.
                  </div>
                ) : (
                  <div className="relative space-y-6 before:absolute before:inset-0 before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                    {activityList.slice(0, 5).map((act) => {
                      let iconBg = 'bg-blue-50 text-blue-500';
                      let iconSvg = (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                        </svg>
                      );

                      if (act.type === 'invoice_overdue') {
                        iconBg = 'bg-rose-50 text-rose-500';
                        iconSvg = (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                          </svg>
                        );
                      } else if (act.type === 'payment_received') {
                        iconBg = 'bg-emerald-50 text-[#047857]';
                        iconSvg = (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                          </svg>
                        );
                      }

                      return (
                        <div key={act.id} className="relative flex items-start gap-4">
                          <div
                            className={`w-8 h-8 rounded-full ${iconBg} border border-white flex items-center justify-center shrink-0 z-10`}
                          >
                            {iconSvg}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start gap-2">
                              <h4 className="text-xs font-semibold text-slate-800">{act.title}</h4>
                              <span className="text-[11px] text-slate-400 text-right shrink-0">
                                {act.dateStr}
                                <span className="block text-slate-400">{act.timeStr}</span>
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5 truncate">{act.description}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Activity Card Bottom Action */}
              <div className="pt-6 mt-4">
                <button
                  type="button"
                  onClick={() => setActiveTab('activity')}
                  className="w-full inline-flex items-center justify-center gap-2 py-2 px-4 rounded-xl border border-emerald-600/30 text-xs font-semibold text-[#047857] hover:bg-[#E6F7F0]/40 transition-colors cursor-pointer"
                >
                  <span>View all activity</span>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M14 5l7 7m0 0l-7 7m7-7H3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  </svg>
                </button>
              </div>
            </div>
          </>
        )}

        {/* ==================== TAB: OVERVIEW ==================== */}
        {activeTab === 'overview' && (
          <>
            {/* Left Column: Credit Health & Recent Invoices */}
            <div className="lg:col-span-8 space-y-6">
              {/* Credit Limit & Account Health Card */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Credit Account Health</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Credit ceiling, balance consumption and repayment performance.
                    </p>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700">
                    Net 15 Terms
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 pb-5 border-b border-slate-100">
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <span className="text-xs font-medium text-slate-400 block">Credit Limit</span>
                    <span className="text-base font-bold text-slate-900 mt-1 block">
                      {formatPKR(customer.credit_limit_paisa || 0)}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <span className="text-xs font-medium text-slate-400 block">Current Balance</span>
                    <span
                      className={`text-base font-bold mt-1 block ${
                        balanceDuePaisa > 0 ? 'text-rose-600' : 'text-emerald-600'
                      }`}
                    >
                      {formatPKR(balanceDuePaisa)}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <span className="text-xs font-medium text-slate-400 block">Available Credit</span>
                    <span className="text-base font-bold text-emerald-700 mt-1 block">
                      {formatPKR(Math.max(0, (customer.credit_limit_paisa || 0) - balanceDuePaisa))}
                    </span>
                  </div>
                </div>

                {/* Credit Limit Progress Bar */}
                <div className="mt-5">
                  {(() => {
                    const limit = customer.credit_limit_paisa || 1;
                    const pct = Math.min(100, Math.round((balanceDuePaisa / limit) * 100));
                    let barColor = 'bg-emerald-500';
                    if (pct >= 90) barColor = 'bg-rose-500';
                    else if (pct >= 70) barColor = 'bg-amber-500';

                    return (
                      <div>
                        <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1.5">
                          <span>Credit Utilization</span>
                          <span>{pct}% of limit</span>
                        </div>
                        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${barColor} transition-all duration-500 rounded-full`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Invoices Preview */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-slate-900">Latest Invoices</h3>
                  <button
                    onClick={() => setActiveTab('invoices')}
                    className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer"
                  >
                    View all ({customerInvoices.length}) &rarr;
                  </button>
                </div>
                {customerInvoices.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">No invoices yet.</p>
                ) : (
                  <div className="divide-y divide-slate-100 text-xs">
                    {customerInvoices.slice(0, 3).map((inv) => (
                      <div key={inv.id} className="py-3 flex items-center justify-between">
                        <div>
                          <span className="font-bold text-slate-900 block">{inv.invoice_number}</span>
                          <span className="text-slate-400 text-[11px]">Due {formatDate(inv.due_date)}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-slate-900 block">{formatPKR(inv.total_paisa)}</span>
                          <span
                            className={`text-[11px] font-semibold ${
                              inv.balance_due_paisa > 0 ? 'text-rose-600' : 'text-emerald-600'
                            }`}
                          >
                            Due: {formatPKR(inv.balance_due_paisa)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Contact info & Quick Activity */}
            <div className="lg:col-span-4 space-y-6">
              {/* Quick Customer Profile Card */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">
                  Account Particulars
                </h3>
                <div className="space-y-3.5 text-xs">
                  <div>
                    <span className="text-slate-400 block font-medium">Customer ID</span>
                    <span className="font-mono text-slate-700 text-[11px] break-all">{customer.id}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Trade Category</span>
                    <span className="font-semibold text-slate-800">{customer.category || 'Retail Store'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Registered Phone</span>
                    <span className="font-semibold text-slate-800">{customer.phone || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Email Address</span>
                    <span className="font-semibold text-slate-800">{customer.email || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">City & Region</span>
                    <span className="font-semibold text-slate-800">{customer.city || 'Karachi'}, Pakistan</span>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 flex gap-2">
                  <button
                    onClick={() => setIsEditModalOpen(true)}
                    className="w-full py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 rounded-lg transition-colors cursor-pointer"
                  >
                    Edit Profile
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ==================== TAB: PAYMENTS ==================== */}
        {activeTab === 'payments' && (
          <>
            {/* Left Column: Payments History */}
            <div className="lg:col-span-8 bg-white border border-slate-200/80 rounded-2xl p-6 space-y-4 shadow-sm">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <h2 className="text-base font-bold text-slate-900">
                  Payments ({filteredPayments.length})
                </h2>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-60">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      value={paymentSearchQuery}
                      onChange={(e) => {
                        setPaymentSearchQuery(e.target.value);
                        setPaymentPage(1);
                      }}
                      className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      placeholder="Search payments..."
                    />
                  </div>

                  <div className="relative">
                    <select
                      value={paymentMethodFilter}
                      onChange={(e) => {
                        setPaymentMethodFilter(e.target.value);
                        setPaymentPage(1);
                      }}
                      className="appearance-none inline-flex items-center gap-2 pl-3 pr-7 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                    >
                      <option value="ALL">All Methods</option>
                      <option value="bank transfer">Bank Transfer</option>
                      <option value="cash">Cash</option>
                      <option value="cheque">Cheque</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payments Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-100 font-medium">
                      <th className="py-3 px-3">Payment No.</th>
                      <th className="py-3 px-3">Date</th>
                      <th className="py-3 px-3">Method</th>
                      <th className="py-3 px-3">Reference</th>
                      <th className="py-3 px-3">Amount</th>
                      <th className="py-3 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                    {paginatedPayments.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400">
                          <p className="text-xs">No payments recorded for this customer.</p>
                          <button
                            onClick={handleRecordPayment}
                            className="mt-2 inline-flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 font-semibold cursor-pointer"
                          >
                            <span>Record a payment</span>
                          </button>
                        </td>
                      </tr>
                    ) : (
                      paginatedPayments.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3.5 px-3 font-semibold text-slate-900">{p.payment_number}</td>
                          <td className="py-3.5 px-3 text-slate-500">{formatDate(p.payment_date)}</td>
                          <td className="py-3.5 px-3 text-slate-700">{p.payment_method}</td>
                          <td className="py-3.5 px-3 text-slate-500 font-mono text-[11px]">
                            {p.reference_number || '—'}
                          </td>
                          <td className="py-3.5 px-3 font-semibold text-emerald-600">
                            {formatPKR(p.amount_paisa)}
                          </td>
                          <td className="py-3.5 px-3">
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-600">
                              Cleared
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Payments Pagination Footer */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100 text-xs text-slate-500 font-medium">
                <span>
                  Showing {filteredPayments.length > 0 ? (safePaymentPage - 1) * paymentsPerPage + 1 : 0} to{' '}
                  {Math.min(safePaymentPage * paymentsPerPage, filteredPayments.length)} of {filteredPayments.length} payments
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPaymentPage((p) => Math.max(1, p - 1))}
                    disabled={safePaymentPage <= 1}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    &lt;
                  </button>
                  {Array.from({ length: totalPaymentPages }, (_, i) => i + 1).map((pg) => (
                    <button
                      key={pg}
                      onClick={() => setPaymentPage(pg)}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg font-semibold border transition-colors cursor-pointer ${
                        pg === safePaymentPage
                          ? 'bg-[#E6F7F0] text-[#047857] border-emerald-200'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {pg}
                    </button>
                  ))}
                  <button
                    onClick={() => setPaymentPage((p) => Math.min(totalPaymentPages, p + 1))}
                    disabled={safePaymentPage >= totalPaymentPages}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    &gt;
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column: Payment Metrics */}
            <div className="lg:col-span-4 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-slate-900">Collections Summary</h3>
              <div className="p-4 bg-emerald-50/70 border border-emerald-200/60 rounded-xl">
                <span className="text-xs text-emerald-800 font-medium block">Total Paid to Date</span>
                <span className="text-2xl font-extrabold text-[#047857] mt-1 block">
                  {formatPKR(totalPaidPaisa)}
                </span>
                <span className="text-[11px] text-emerald-700/80 mt-1 block">
                  Reconciled against {customerPayments.length} recorded payments
                </span>
              </div>

              <div className="space-y-3 pt-2 text-xs">
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Average Payment:</span>
                  <span className="font-semibold text-slate-800">
                    {customerPayments.length > 0
                      ? formatPKR(Math.round(totalPaidPaisa / customerPayments.length))
                      : '—'}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Outstanding Invoices:</span>
                  <span className="font-semibold text-rose-600">{outstandingInvoicesCount}</span>
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="button"
                  onClick={handleRecordPayment}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#047857] hover:bg-[#065F46] text-white rounded-lg text-sm font-medium transition-colors shadow-sm cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                    />
                  </svg>
                  <span>Record new payment</span>
                </button>
              </div>
            </div>
          </>
        )}

        {/* ==================== TAB: ACTIVITY ==================== */}
        {activeTab === 'activity' && (
          <>
            {/* Left Column: Full Activity Timeline */}
            <div className="lg:col-span-8 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <h2 className="text-base font-bold text-slate-900">
                  Activity Timeline ({filteredActivity.length})
                </h2>
                {/* Filter Chips */}
                <div className="flex items-center gap-2">
                  {(['ALL', 'INVOICES', 'PAYMENTS', 'LEDGER'] as const).map((filterKey) => (
                    <button
                      key={filterKey}
                      onClick={() => setActivityFilter(filterKey)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        activityFilter === filterKey
                          ? 'bg-[#047857] text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {filterKey === 'ALL'
                        ? 'All'
                        : filterKey === 'INVOICES'
                        ? 'Invoices'
                        : filterKey === 'PAYMENTS'
                        ? 'Payments'
                        : 'Ledger'}
                    </button>
                  ))}
                </div>
              </div>

              {filteredActivity.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  No activity matching the selected filter.
                </div>
              ) : (
                <div className="relative space-y-6 before:absolute before:inset-0 before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                  {filteredActivity.map((act) => {
                    let iconBg = 'bg-blue-50 text-blue-500';
                    let iconSvg = (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                      </svg>
                    );

                    if (act.type === 'invoice_overdue') {
                      iconBg = 'bg-rose-50 text-rose-500';
                      iconSvg = (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                        </svg>
                      );
                    } else if (act.type === 'payment_received') {
                      iconBg = 'bg-emerald-50 text-[#047857]';
                      iconSvg = (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                        </svg>
                      );
                    }

                    return (
                      <div key={act.id} className="relative flex items-start gap-4">
                        <div
                          className={`w-8 h-8 rounded-full ${iconBg} border border-white flex items-center justify-center shrink-0 z-10`}
                        >
                          {iconSvg}
                        </div>
                        <div className="flex-1 bg-slate-50/70 border border-slate-100 rounded-xl p-3.5">
                          <div className="flex justify-between items-start gap-2">
                            <h4 className="text-xs font-bold text-slate-900">{act.title}</h4>
                            <span className="text-[11px] text-slate-400 font-medium">
                              {act.dateStr} • {act.timeStr}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-1">{act.description}</p>
                          {act.reference && (
                            <span className="inline-block mt-2 font-mono text-[10px] text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded">
                              Ref: {act.reference}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right Column: Ledger Summary */}
            <div className="lg:col-span-4 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-slate-900">Ledger Summary</h3>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Total Debits (Invoiced):</span>
                  <span className="font-semibold text-slate-900">{formatPKR(totalInvoicedPaisa)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Total Credits (Paid):</span>
                  <span className="font-semibold text-emerald-600">{formatPKR(totalPaidPaisa)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Net Receivable Balance:</span>
                  <span className={`font-bold ${balanceDuePaisa > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {formatPKR(balanceDuePaisa)}
                  </span>
                </div>
              </div>

              <div className="pt-3">
                <Link
                  to="/credit-ledger"
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  <span>View Global Credit Ledger</span>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M14 5l7 7m0 0l-7 7m7-7H3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  </svg>
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
      {/* END: MainContentGrid */}

      {/* Edit Customer Modal */}
      <EditCustomerModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        customer={customer}
        repository={repository}
        onCustomerUpdated={async () => {
          await refreshData();
          showToast('Customer profile updated successfully.');
        }}
      />

      {/* Invoice Details Modal */}
      <InvoiceDetailsModal
        isOpen={!!selectedInvoiceForModal}
        onClose={() => setSelectedInvoiceForModal(null)}
        invoice={selectedInvoiceForModal}
        repository={repository}
      />
    </>
  );
};

export default CustomerProfilePage;
