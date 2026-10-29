import React, { useState, useEffect, useMemo } from 'react';
import { Link, useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useCreditFlow } from '../context/CreditFlowContext';
import { Invoice, InvoiceItem, Customer, PaymentAllocation, Payment } from '../types/models';
import { formatPKR, formatDate } from '../lib/utils';
import { buildInvoicePrintPayload } from '../lib/invoice-print-data';
import { generateInvoicePDF } from '../lib/pdf-generator';

export const InvoiceDetailsPage: React.FC = () => {
  const { repository, invoices, customers, business } = useCreditFlow();
  const { id: routeId } = useParams<{ id?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const queryId = searchParams.get('id');
  const queryNumber = searchParams.get('number');
  const targetIdOrNumber = routeId || queryId || queryNumber;

  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [lineItems, setLineItems] = useState<InvoiceItem[]>([]);
  const [allocations, setAllocations] = useState<PaymentAllocation[]>([]);
  const [paymentsMap, setPaymentsMap] = useState<Record<string, Payment>>({});
  const [sendNoticeOpen, setSendNoticeOpen] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  // Load target invoice or default to reference invoice / first invoice
  useEffect(() => {
    let isMounted = true;

    async function loadInvoiceData() {
      setLoading(true);
      try {
        let matchedInvoice: Invoice | null = null;

        if (targetIdOrNumber) {
          // Check by ID first
          matchedInvoice = await repository.getInvoiceById(targetIdOrNumber);
          // If not found, check by invoice_number
          if (!matchedInvoice) {
            matchedInvoice = await repository.getInvoiceByNumber(targetIdOrNumber);
          }
          // If still not found, check in current context cache
          if (!matchedInvoice) {
            matchedInvoice =
              invoices.find(
                (inv) =>
                  inv.id === targetIdOrNumber ||
                  inv.invoice_number.toLowerCase() === targetIdOrNumber.toLowerCase()
              ) || null;
          }
        } else {
          // Default: prefer reference screen invoice 'inv_2026_0142' or first invoice
          matchedInvoice = await repository.getInvoiceById('inv_2026_0142');
          if (!matchedInvoice && invoices.length > 0) {
            // Find first invoice
            matchedInvoice = invoices[0];
          }
        }

        if (!isMounted) return;

        if (matchedInvoice) {
          setInvoice(matchedInvoice);

          // Load related customer
          const cust =
            customers.find((c) => c.id === matchedInvoice!.customer_id) ||
            (await repository.getCustomerById(matchedInvoice.customer_id));
          setCustomer(cust || null);

          // Load line items
          const items = await repository.getInvoiceItems(matchedInvoice.id);
          setLineItems(items || []);

          // Load allocations and payments
          const allocs = await repository.getAllocationsByInvoiceId(matchedInvoice.id);
          setAllocations(allocs || []);

          if (allocs && allocs.length > 0) {
            const allPayments = await repository.getPayments();
            const pMap: Record<string, Payment> = {};
            allPayments.forEach((p) => {
              pMap[p.id] = p;
            });
            setPaymentsMap(pMap);
          } else {
            setPaymentsMap({});
          }
        } else {
          setInvoice(null);
          setCustomer(null);
          setLineItems([]);
          setAllocations([]);
        }
      } catch (err) {
        console.error('Failed to load invoice details:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadInvoiceData();

    return () => {
      isMounted = false;
    };
  }, [targetIdOrNumber, invoices, customers, repository]);

  const showToast = (msg: string) => {
    setFeedbackToast(msg);
    setTimeout(() => {
      setFeedbackToast(null);
    }, 4000);
  };

  // Build print / PDF payload
  const printPayload = useMemo(() => {
    if (!invoice || !customer || !business) return null;
    return buildInvoicePrintPayload(invoice, lineItems, customer, business);
  }, [invoice, lineItems, customer, business]);

  // Handler for PDF download
  const handleDownloadPDF = () => {
    if (!printPayload) {
      showToast('Cannot generate PDF: Invoice data is still loading.');
      return;
    }
    try {
      generateInvoicePDF(printPayload);
      showToast(`Downloaded ${printPayload.invoice.number}.pdf successfully!`);
    } catch (err) {
      console.error('PDF generation error:', err);
      showToast('Failed to generate PDF. You can also use the browser Print button.');
    }
  };

  // Handler for Print action
  const handlePrint = () => {
    window.print();
  };

  // Status badge styling helper
  const renderStatusBadge = (inv: Invoice) => {
    const isPaid = inv.payment_status === 'PAID';
    const isPartiallyPaid = inv.payment_status === 'PARTIALLY_PAID';
    const isOverdue = inv.due_status === 'OVERDUE' && !isPaid;
    const isDraft = Boolean(inv.is_draft);

    if (isDraft) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f1f5f9] text-[#64748b] text-xs font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-[#94a3b8]" />
          Draft
        </span>
      );
    }

    if (isPaid) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#dcfce7] text-[#059669] text-xs font-semibold">
          <svg className="w-3.5 h-3.5 text-[#059669]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path d="M4.5 12.75l6 6 9-13.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Paid
        </span>
      );
    }

    if (isPartiallyPaid) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#fef3c7] text-[#b45309] text-xs font-semibold">
          <svg className="w-3.5 h-3.5 text-[#f59e0b]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Partially paid
        </span>
      );
    }

    if (isOverdue) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#fee2e2] text-[#dc2626] text-xs font-semibold">
          <svg className="w-3.5 h-3.5 text-[#ef4444]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Overdue
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#e0f2fe] text-[#0369a1] text-xs font-semibold">
        <svg className="w-3.5 h-3.5 text-[#0284c7]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {inv.status || 'Pending'}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="p-8 max-w-[1360px] w-full animate-pulse">
        <div className="h-4 bg-slate-200 rounded w-48 mb-3" />
        <div className="h-8 bg-slate-200 rounded w-64 mb-6" />
        <div className="h-36 bg-white rounded-xl border border-slate-200 p-6 mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-72 bg-white rounded-xl border border-slate-200" />
          <div className="h-72 bg-white rounded-xl border border-slate-200" />
        </div>
      </div>
    );
  }

  // Not Found State
  if (!invoice) {
    return (
      <div className="p-8 max-w-[1360px] w-full">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-[#059669] font-medium mb-3">
          <Link to="/invoices" className="inline-flex items-center gap-1 hover:underline">
            <svg className="w-3.5 h-3.5 stroke-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Invoices
          </Link>
          <span className="text-[#94a3b8]">/</span>
          <span className="text-[#64748b]">Not Found</span>
        </div>

        <div className="bg-white rounded-xl border border-[#e2e8f0] p-10 shadow-sm text-center max-w-xl mx-auto my-8">
          <div className="w-14 h-14 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-[#0f172a] mb-2">Invoice Not Found</h2>
          <p className="text-xs text-[#64748b] mb-6">
            The requested invoice <span className="font-semibold text-[#0f172a]">{targetIdOrNumber || 'unknown'}</span> was not found in the database.
          </p>

          <div className="text-left mb-6">
            <p className="text-xs font-semibold text-[#334155] mb-2">Available Invoices:</p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto border border-slate-100 rounded-lg p-2">
              {invoices.map((inv) => (
                <button
                  key={inv.id}
                  onClick={() => setSearchParams({ id: inv.id })}
                  className="w-full text-left px-3 py-2 rounded text-xs hover:bg-slate-50 flex items-center justify-between transition-colors border-b border-slate-50 last:border-0"
                >
                  <span className="font-semibold text-[#059669]">{inv.invoice_number}</span>
                  <span className="text-[#475569]">{inv.customer_name}</span>
                  <span className="text-[#0f172a] font-medium">{formatPKR(inv.total_paisa)}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-center gap-3">
            <Link
              to="/invoices"
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-[#1e293b] rounded-lg text-xs font-semibold transition"
            >
              Back to Invoices
            </Link>
            <Link
              to="/create-invoice"
              className="px-4 py-2 bg-[#059669] hover:bg-[#047857] text-white rounded-lg text-xs font-semibold transition"
            >
              Create New Invoice
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Calculate totals and allocations
  const subtotalPaisa = invoice.subtotal_paisa;
  const discountPaisa = invoice.discount_paisa || 0;
  const taxPaisa = invoice.tax_paisa || 0;
  const totalPaisa = invoice.total_paisa;
  const paidPaisa = invoice.paid_paisa || 0;
  const balanceDuePaisa = invoice.balance_due_paisa || 0;

  return (
    <>
      {/* Toast Notification */}
      {feedbackToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#0f172a] text-white px-4 py-3 rounded-xl shadow-xl text-xs flex items-center gap-2.5 animate-fade-in border border-slate-700 print:hidden">
          <svg className="w-4 h-4 text-[#10b981]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path d="m4.5 12.75 6 6 9-13.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>{feedbackToast}</span>
        </div>
      )}

      {/* Send Invoice Modal / Dialog */}
      {sendNoticeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 print:hidden">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-left">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-[#0f172a] mb-1.5">Sending is not configured</h3>
            <p className="text-xs text-[#64748b] leading-relaxed mb-5">
              Automated email and WhatsApp invoice dispatch is not configured in Phase 8 (scheduled for Phase 9 notifications & payment reminders).
              <br /><br />
              In the meantime, you can <strong>Download PDF</strong> or <strong>Print</strong> the invoice to send it directly to your customer.
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => setSendNoticeOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-[#1e293b] rounded-lg text-xs font-semibold transition"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setSendNoticeOpen(false);
                  handleDownloadPDF();
                }}
                className="px-4 py-2 bg-[#059669] hover:bg-[#047857] text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 16.5V16.5M7.5 10.5 12 15m0 0 4.5-4.5M12 15V3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Download PDF Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main View Container */}
      <main className="p-8 space-y-6 max-w-[1360px] w-full print:p-0 print:m-0 print:max-w-none" data-purpose="invoice-view">
        {/* Printable Only Business Header */}
        <div className="hidden print:block mb-6 border-b border-slate-300 pb-4">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-[#059669]">CreditFlow</h1>
              <p className="text-sm font-semibold text-[#0f172a]">{business?.name || 'Shah Traders'}</p>
              <p className="text-xs text-slate-500">{business?.address}, {business?.city}</p>
              <p className="text-xs text-slate-500">Phone: {business?.phone} | Email: {business?.email}</p>
              {business?.tax_number && <p className="text-xs text-slate-500">NTN: {business.tax_number}</p>}
            </div>
            <div className="text-right">
              <h2 className="text-xl font-bold text-[#0f172a]">INVOICE</h2>
              <p className="text-sm font-bold text-[#059669]">{invoice.invoice_number}</p>
              <p className="text-xs text-slate-500">Issue Date: {formatDate(invoice.issue_date)}</p>
              <p className="text-xs text-slate-500">Due Date: {formatDate(invoice.due_date)}</p>
              <p className="text-xs font-semibold text-slate-700">Status: {invoice.status}</p>
            </div>
          </div>
        </div>

        {/* Breadcrumbs and Action Buttons Bar (Hidden in Print) */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
          <div>
            {/* Breadcrumb Link */}
            <div className="flex items-center gap-1.5 text-xs text-[#059669] font-medium mb-1">
              <Link to="/invoices" className="inline-flex items-center gap-1 hover:underline">
                <svg className="w-3.5 h-3.5 stroke-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Invoices
              </Link>
              <span className="text-[#94a3b8]">/</span>
              <span className="text-[#64748b] font-medium">{invoice.invoice_number}</span>
            </div>
            {/* Page Title & Subtitle */}
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-[#0f172a]">Invoice Details</h1>
              {/* Optional Quick Switcher */}
              {invoices.length > 1 && (
                <div className="relative inline-block text-left">
                  <select
                    value={invoice.id}
                    onChange={(e) => setSearchParams({ id: e.target.value })}
                    className="text-xs font-medium text-[#475569] bg-white border border-[#e2e8f0] rounded-md px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-[#059669] cursor-pointer shadow-2xs"
                    title="Switch to another invoice"
                  >
                    {invoices.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.invoice_number} — {inv.customer_name} ({formatPKR(inv.total_paisa)})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <p className="text-xs text-[#64748b] mt-0.5">View and manage this invoice.</p>
          </div>

          {/* Top Right Action Buttons */}
          <div className="flex items-center gap-2.5">
            {/* Download PDF */}
            <button
              onClick={handleDownloadPDF}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-[#e2e8f0] rounded-lg text-xs font-semibold text-[#1e293b] hover:bg-slate-50 transition shadow-xs cursor-pointer active:scale-98"
              title="Download official A4 PDF document"
            >
              <svg className="w-4 h-4 text-[#475569]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 16.5V16.5M7.5 10.5 12 15m0 0 4.5-4.5M12 15V3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Download PDF
            </button>

            {/* Print */}
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-[#e2e8f0] rounded-lg text-xs font-semibold text-[#1e293b] hover:bg-slate-50 transition shadow-xs cursor-pointer active:scale-98"
              title="Print A4 invoice via browser"
            >
              <svg className="w-4 h-4 text-[#475569]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M6.72 13.829c-.24-1.03-1.077-1.83-2.096-2.062a7.502 7.502 0 0 1 14.752 0c-1.02.232-1.856 1.031-2.096 2.062M6 16.5h12M9 19.5h6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Print
            </button>

            {/* Send invoice */}
            <button
              onClick={() => setSendNoticeOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-[#e2e8f0] rounded-lg text-xs font-semibold text-[#1e293b] hover:bg-slate-50 transition shadow-xs cursor-pointer active:scale-98"
              title="Send via Email or WhatsApp"
            >
              <svg className="w-4 h-4 text-[#475569]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Send invoice
            </button>

            {/* Record payment */}
            <button
              onClick={() => navigate(`/record-payment?invoice_id=${invoice.id}&customer_id=${invoice.customer_id}`)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#059669] hover:bg-[#047857] text-white rounded-lg text-xs font-semibold transition shadow-xs cursor-pointer active:scale-98"
              title="Record customer payment against this invoice"
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-6.75 4.5h16.5a2.25 2.25 0 0 0 2.25-2.25V6.75a2.25 2.25 0 0 0-2.25-2.25H3.75A2.25 2.25 0 0 0 1.5 6.75v10.5a2.25 2.25 0 0 0 2.25 2.25Z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Record payment
            </button>
          </div>
        </div>

        {/* BEGIN: InvoiceSummaryCard */}
        <section className="bg-white rounded-xl border border-[#e2e8f0] p-6 shadow-xs print:shadow-none print:border-slate-300" data-purpose="invoice-overview-card">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Column 1: Client Overview */}
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#dcfce7] text-[#059669] flex items-center justify-center shrink-0">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24">
                  <path d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a48.667 48.667 0 0 0-7.5 0M12 12.75h.008v.008H12v-.008Z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="min-w-0">
                <Link
                  to={`/customers/${customer?.id || invoice.customer_id}`}
                  className="font-bold text-base text-[#0f172a] leading-snug hover:text-[#059669] transition-colors block truncate"
                >
                  {customer?.name || invoice.customer_name}
                </Link>
                <p className="text-xs text-[#64748b]">
                  {customer?.city || invoice.customer_city || 'Pakistan'}
                </p>
                <div className="mt-2.5 space-y-1 text-xs text-[#64748b]">
                  {(customer?.phone || invoice.customer_phone) && (
                    <div className="flex items-center gap-2">
                      <svg className="w-3.5 h-3.5 text-[#94a3b8] shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="truncate">{customer?.phone || invoice.customer_phone}</span>
                    </div>
                  )}
                  {customer?.email && (
                    <div className="flex items-center gap-2">
                      <svg className="w-3.5 h-3.5 text-[#94a3b8] shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="truncate">{customer.email}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Column 2: Invoice Details */}
            <div className="border-t md:border-t-0 md:border-l border-[#f1f5f9] pt-4 md:pt-0 md:pl-6 flex flex-col justify-start">
              <div>
                <span className="text-[11px] font-medium text-[#64748b] uppercase tracking-wider block">Invoice No.</span>
                <span className="text-sm font-bold text-[#0f172a] block mt-0.5">{invoice.invoice_number}</span>
              </div>
              <div className="mt-4">
                <span className="text-[11px] font-medium text-[#64748b] uppercase tracking-wider block">Issue Date</span>
                <span className="text-sm font-semibold text-[#0f172a] block mt-0.5">{formatDate(invoice.issue_date)}</span>
              </div>
              {invoice.reference && (
                <div className="mt-4">
                  <span className="text-[11px] font-medium text-[#64748b] uppercase tracking-wider block">Reference</span>
                  <span className="text-xs font-medium text-[#334155] block mt-0.5">{invoice.reference}</span>
                </div>
              )}
            </div>

            {/* Column 3: Due Date */}
            <div className="border-t md:border-t-0 md:border-l border-[#f1f5f9] pt-4 md:pt-0 md:pl-6 flex flex-col justify-start">
              <span className="text-[11px] font-medium text-[#64748b] uppercase tracking-wider block">Due Date</span>
              <span className="text-sm font-bold text-[#0f172a] block mt-0.5">{formatDate(invoice.due_date)}</span>
              {invoice.is_draft && (
                <div className="mt-3">
                  <span className="inline-block text-[11px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded font-medium">
                    Draft • Not posted to receivables
                  </span>
                </div>
              )}
            </div>

            {/* Column 4: Balance Due and Status */}
            <div className="border-t md:border-t-0 md:border-l border-[#f1f5f9] pt-4 md:pt-0 md:pl-6 flex flex-col items-start md:items-end justify-between">
              <div>{renderStatusBadge(invoice)}</div>
              <div className="text-left md:text-right mt-4">
                <span className="text-[11px] font-medium text-[#64748b] uppercase tracking-wider block">Balance Due</span>
                <span className="text-2xl font-extrabold text-[#0f172a] tracking-tight block mt-0.5">
                  {formatPKR(balanceDuePaisa)}
                </span>
              </div>
            </div>
          </div>
        </section>
        {/* END: InvoiceSummaryCard */}

        {/* BEGIN: InvoiceItemsAndSummarySection */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6" data-purpose="items-and-financials">
          {/* Invoice Items Table Card (Left 2 cols) */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-[#e2e8f0] p-6 shadow-xs flex flex-col justify-between print:border-slate-300">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-base text-[#0f172a]">Invoice Items</h3>
                <span className="text-xs text-[#64748b] font-medium">{lineItems.length} {lineItems.length === 1 ? 'item' : 'items'}</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#f8fafc] text-[#64748b] font-medium border-b border-[#e2e8f0]">
                      <th className="py-2.5 px-3 rounded-l-md font-semibold">Description</th>
                      <th className="py-2.5 px-3 text-center font-semibold">Quantity</th>
                      <th className="py-2.5 px-3 text-right font-semibold">Unit Price (PKR)</th>
                      <th className="py-2.5 px-3 rounded-r-md text-right font-semibold">Amount (PKR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f1f5f9] text-[#1e293b]">
                    {lineItems.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-slate-400">
                          No line items found for this invoice.
                        </td>
                      </tr>
                    ) : (
                      lineItems.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3.5 px-3 font-medium">
                            <div className="font-medium text-[#0f172a]">{item.item_description}</div>
                            {item.unit && item.unit !== 'Unit' && (
                              <span className="text-[11px] text-[#64748b]">Unit: {item.unit}</span>
                            )}
                          </td>
                          <td className="py-3.5 px-3 text-center font-medium">{item.quantity}</td>
                          <td className="py-3.5 px-3 text-right font-medium">
                            {formatPKR(item.unit_price_paisa).replace('PKR ', '')}
                          </td>
                          <td className="py-3.5 px-3 text-right font-semibold text-[#0f172a]">
                            {formatPKR(item.amount_paisa).replace('PKR ', '')}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Notes box if present */}
              {invoice.notes && (
                <div className="mt-6 p-3.5 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[11px] font-semibold text-[#64748b] uppercase tracking-wider block mb-1">
                    Invoice Notes & Terms:
                  </span>
                  <p className="text-xs text-[#334155] leading-relaxed whitespace-pre-wrap">{invoice.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Financial Summary Card (Right 1 col) */}
          <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 shadow-xs flex flex-col justify-between print:border-slate-300">
            <div className="space-y-3.5 text-xs">
              <h3 className="font-bold text-base text-[#0f172a] pb-1">Payment Summary</h3>

              <div className="flex justify-between items-center text-[#64748b]">
                <span>Subtotal</span>
                <span className="font-medium text-[#1e293b]">{formatPKR(subtotalPaisa)}</span>
              </div>

              {discountPaisa > 0 && (
                <div className="flex justify-between items-center text-[#64748b]">
                  <span>Discount</span>
                  <span className="font-medium text-amber-600">- {formatPKR(discountPaisa)}</span>
                </div>
              )}

              {taxPaisa > 0 && (
                <div className="flex justify-between items-center text-[#64748b]">
                  <span>Tax</span>
                  <span className="font-medium text-[#1e293b]">{formatPKR(taxPaisa)}</span>
                </div>
              )}

              <div className="pt-3 border-t border-[#f1f5f9] flex justify-between items-center">
                <span className="font-bold text-sm text-[#0f172a]">Total Amount</span>
                <span className="font-bold text-sm text-[#0f172a]">{formatPKR(totalPaisa)}</span>
              </div>

              <div className="flex justify-between items-center text-[#64748b]">
                <span>Amount Paid</span>
                <span className="font-medium text-[#1e293b]">{formatPKR(paidPaisa)}</span>
              </div>
            </div>

            {/* Remaining Balance Highlight Banner */}
            <div className="mt-6 p-3.5 rounded-lg bg-[#e8f7f0] flex items-center justify-between border border-emerald-100">
              <span className="text-xs font-bold text-[#065f46]">Remaining Balance</span>
              <span className="text-base font-extrabold text-[#065f46]">
                {formatPKR(balanceDuePaisa)}
              </span>
            </div>
          </div>
        </section>
        {/* END: InvoiceItemsAndSummarySection */}

        {/* BEGIN: PaymentHistorySection */}
        <section className="bg-white rounded-xl border border-[#e2e8f0] p-6 shadow-xs print:border-slate-300" data-purpose="payment-history-timeline">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-base text-[#0f172a]">Payment History</h3>
            {allocations.length > 0 && (
              <span className="text-xs text-[#059669] font-semibold">
                {allocations.length} {allocations.length === 1 ? 'payment allocation' : 'payment allocations'}
              </span>
            )}
          </div>

          {/* Stepper / Timeline Container */}
          <div className="relative pl-2">
            {/* Timeline Vertical Connecting Line */}
            <div className="absolute left-6 top-6 bottom-6 w-0.5 bg-[#e2e8f0] -z-0" />

            {/* Render Payment Allocations (if any) */}
            {allocations.map((alloc) => {
              const payment = paymentsMap[alloc.payment_id];
              const dateStr = payment?.payment_date ? formatDate(payment.payment_date) : formatDate(alloc.allocated_at);
              const methodStr = payment?.payment_method || 'Payment Received';
              const refStr = payment?.reference_number ? ` • ${payment.reference_number}` : '';

              return (
                <div key={alloc.id} className="relative z-10 flex items-center justify-between pb-6">
                  <div className="flex items-center gap-3.5">
                    <div className="w-8 h-8 rounded-lg bg-[#dcfce7] flex items-center justify-center text-[#059669] shrink-0">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-6.75 4.5h16.5a2.25 2.25 0 0 0 2.25-2.25V6.75a2.25 2.25 0 0 0-2.25-2.25H3.75A2.25 2.25 0 0 0 1.5 6.75v10.5a2.25 2.25 0 0 0 2.25 2.25Z" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[#0f172a]">Payment Received</h4>
                      <p className="text-[11px] text-[#64748b]">
                        {dateStr} • {methodStr}{refStr}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-[#059669]">
                      {formatPKR(alloc.allocated_amount_paisa)}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Step: Invoice Created */}
            <div className="relative z-10 flex items-center justify-between pt-1">
              <div className="flex items-center gap-3.5">
                <div className="w-8 h-8 rounded-lg bg-[#f1f5f9] flex items-center justify-center text-[#64748b] shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#0f172a]">Invoice Created</h4>
                  <p className="text-[11px] text-[#64748b]">{formatDate(invoice.issue_date)}</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-semibold text-[#64748b]">-</span>
              </div>
            </div>
          </div>
        </section>
        {/* END: PaymentHistorySection */}
      </main>
    </>
  );
};
