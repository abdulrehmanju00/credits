import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useCreditFlow } from '../context/CreditFlowContext';
import { Customer, ProductService, Invoice } from '../types/models';
import { formatPKR, rupeesToPaisa, paisaToRupees } from '../lib/utils';
import { AddCustomerModal } from '../components/customers/AddCustomerModal';
import { buildInvoicePrintPayload } from '../lib/invoice-print-data';

export interface FormLineItem {
  id: string;
  productId?: string;
  description: string;
  quantity: number;
  unit: string;
  unitPricePaisa: number;
  amountPaisa: number;
  isCustom?: boolean;
}

export const CreateInvoicePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { repository, customers, products, business, refreshData } = useCreditFlow();

  // Selected customer state
  const queryCustomerId = searchParams.get('customer_id') || searchParams.get('id');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false);
  const customerDropdownRef = useRef<HTMLDivElement>(null);

  // Invoice header fields
  const [invoiceNumber, setInvoiceNumber] = useState<string>('INV-2026-1051');
  const [isRefreshingNumber, setIsRefreshingNumber] = useState(false);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const defaultDueStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().split('T')[0];
  }, []);

  const [issueDate, setIssueDate] = useState<string>(todayStr);
  const [dueDate, setDueDate] = useState<string>(defaultDueStr);
  const [reference, setReference] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Line items state
  const [lineItems, setLineItems] = useState<FormLineItem[]>([
    {
      id: 'row-1',
      description: 'Split AC 1.5 Ton',
      quantity: 2,
      unit: 'Unit',
      unitPricePaisa: 7500000, // PKR 75,000
      amountPaisa: 15000000,   // PKR 150,000
      isCustom: true
    },
    {
      id: 'row-2',
      description: 'Installation Service',
      quantity: 2,
      unit: 'Trip',
      unitPricePaisa: 500000,  // PKR 5,000
      amountPaisa: 1000000,    // PKR 10,000
      isCustom: true
    },
    {
      id: 'row-3',
      description: 'Wall Bracket',
      quantity: 2,
      unit: 'Unit',
      unitPricePaisa: 250000,  // PKR 2,500
      amountPaisa: 500000,     // PKR 5,000
      isCustom: true
    }
  ]);

  // Discount & Tax controls
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [discountValue, setDiscountValue] = useState<number>(0);

  const [taxType, setTaxType] = useState<'percent' | 'fixed'>('percent');
  const [taxValue, setTaxValue] = useState<number>(0);

  // Submission & feedback states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{
    type: 'draft' | 'issued';
    invoice: Invoice;
    message: string;
  } | null>(null);

  // Initialize selected customer
  useEffect(() => {
    if (customers.length > 0) {
      if (queryCustomerId && customers.some(c => c.id === queryCustomerId)) {
        setSelectedCustomerId(queryCustomerId);
      } else if (!selectedCustomerId) {
        // Default to Al-Hamza Traders if exists, or first active customer
        const alHamza = customers.find(c => c.id === 'cust_al_hamza');
        if (alHamza) {
          setSelectedCustomerId(alHamza.id);
        } else {
          const activeCust = customers.find(c => c.status === 'Active') || customers[0];
          if (activeCust) setSelectedCustomerId(activeCust.id);
        }
      }
    }
  }, [customers, queryCustomerId, selectedCustomerId]);

  // Load next invoice number from DB
  const refreshInvoiceNumber = async () => {
    try {
      setIsRefreshingNumber(true);
      const nextNum = await repository.getNextInvoiceNumber(issueDate);
      if (nextNum) {
        setInvoiceNumber(nextNum);
      }
    } catch (err) {
      console.error('[CreateInvoice] Error fetching invoice number:', err);
    } finally {
      setIsRefreshingNumber(false);
    }
  };

  useEffect(() => {
    refreshInvoiceNumber();
  }, [issueDate]);

  // Close customer dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target as Node)) {
        setIsCustomerDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const selectedCustomer = useMemo(() => {
    return customers.find(c => c.id === selectedCustomerId) || null;
  }, [customers, selectedCustomerId]);

  const filteredCustomers = useMemo(() => {
    const term = customerSearchTerm.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter(c =>
      c.name.toLowerCase().includes(term) ||
      (c.city && c.city.toLowerCase().includes(term)) ||
      (c.phone && c.phone.includes(term))
    );
  }, [customers, customerSearchTerm]);

  // Financial Calculations
  const subtotalPaisa = useMemo(() => {
    return lineItems.reduce((sum, item) => sum + (item.amountPaisa || 0), 0);
  }, [lineItems]);

  const discountPaisa = useMemo(() => {
    if (discountValue <= 0) return 0;
    if (discountType === 'percent') {
      const clampedPct = Math.min(Math.max(discountValue, 0), 100);
      return Math.round((subtotalPaisa * clampedPct) / 100);
    } else {
      const fixedPaisa = Math.round(discountValue * 100);
      return Math.min(fixedPaisa, subtotalPaisa);
    }
  }, [subtotalPaisa, discountType, discountValue]);

  const taxPaisa = useMemo(() => {
    if (taxValue <= 0) return 0;
    const taxableBase = Math.max(0, subtotalPaisa - discountPaisa);
    if (taxType === 'percent') {
      const clampedPct = Math.max(taxValue, 0);
      return Math.round((taxableBase * clampedPct) / 100);
    } else {
      return Math.round(taxValue * 100);
    }
  }, [subtotalPaisa, discountPaisa, taxType, taxValue]);

  const totalPaisa = useMemo(() => {
    return Math.max(0, subtotalPaisa - discountPaisa + taxPaisa);
  }, [subtotalPaisa, discountPaisa, taxPaisa]);

  // Line item handlers
  const handleItemChange = (index: number, updates: Partial<FormLineItem>) => {
    setLineItems(prev => {
      const next = [...prev];
      const current = next[index];
      const updated = { ...current, ...updates };

      // Recalculate amount
      const qty = updated.quantity > 0 ? updated.quantity : 0;
      const unitP = updated.unitPricePaisa >= 0 ? updated.unitPricePaisa : 0;
      updated.amountPaisa = Math.round(qty * unitP);

      next[index] = updated;
      return next;
    });
  };

  const handleProductSelect = (index: number, productId: string) => {
    if (productId === 'custom') {
      handleItemChange(index, {
        productId: undefined,
        description: '',
        unitPricePaisa: 0,
        isCustom: true
      });
      return;
    }

    const prod = products.find(p => p.id === productId);
    if (prod) {
      handleItemChange(index, {
        productId: prod.id,
        description: prod.name,
        unit: prod.unit || 'Unit',
        unitPricePaisa: prod.price_paisa || 0,
        isCustom: false
      });
    }
  };

  const handleAddItem = () => {
    const newId = `row-${Date.now()}-${lineItems.length + 1}`;
    setLineItems(prev => [
      ...prev,
      {
        id: newId,
        description: '',
        quantity: 1,
        unit: 'Unit',
        unitPricePaisa: 0,
        amountPaisa: 0,
        isCustom: true
      }
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setLineItems(prev => {
      if (prev.length <= 1) {
        // Keep at least one empty row
        return [{
          id: `row-${Date.now()}`,
          description: '',
          quantity: 1,
          unit: 'Unit',
          unitPricePaisa: 0,
          amountPaisa: 0,
          isCustom: true
        }];
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleClearAllItems = () => {
    setLineItems([
      {
        id: `row-${Date.now()}`,
        description: '',
        quantity: 1,
        unit: 'Unit',
        unitPricePaisa: 0,
        amountPaisa: 0,
        isCustom: true
      }
    ]);
  };

  // Validation
  const validateForm = (isDraft: boolean): string | null => {
    if (!selectedCustomerId) {
      return 'Please select a customer.';
    }
    if (!invoiceNumber.trim()) {
      return 'Invoice number cannot be empty.';
    }
    if (!issueDate) {
      return 'Please choose an issue date.';
    }
    if (!dueDate) {
      return 'Please choose a due date.';
    }
    if (dueDate < issueDate) {
      return 'Due date cannot be earlier than issue date.';
    }

    const validItems = lineItems.filter(item => item.description.trim() !== '');
    if (validItems.length === 0) {
      return 'Please add at least one line item with a description.';
    }

    for (let i = 0; i < validItems.length; i++) {
      const it = validItems[i];
      if (it.quantity <= 0 || isNaN(it.quantity)) {
        return `Item "${it.description || `#${i + 1}`}" quantity must be greater than zero.`;
      }
      if (it.unitPricePaisa < 0 || isNaN(it.unitPricePaisa)) {
        return `Item "${it.description || `#${i + 1}`}" unit price cannot be negative.`;
      }
    }

    if (!isDraft && totalPaisa <= 0) {
      return 'Invoice total must be greater than zero to issue.';
    }

    return null;
  };

  // Save Draft action
  const handleSaveDraft = async () => {
    setValidationError(null);
    setSuccessInfo(null);

    const error = validateForm(true);
    if (error) {
      setValidationError(error);
      return;
    }

    try {
      setIsSubmitting(true);

      const validItems = lineItems.filter(item => item.description.trim() !== '');
      const inputItems = validItems.map(item => ({
        product_id: item.productId,
        item_description: item.description,
        quantity: item.quantity,
        unit: item.unit || 'Unit',
        unit_price_paisa: item.unitPricePaisa,
        amount_paisa: item.amountPaisa
      }));

      const createdDraft = await repository.saveDraftInvoice(
        {
          customer_id: selectedCustomerId,
          invoice_number: invoiceNumber.trim(),
          issue_date: issueDate,
          due_date: dueDate,
          reference: reference.trim(),
          notes: notes.trim(),
          subtotal_paisa: subtotalPaisa,
          discount_paisa: discountPaisa,
          tax_paisa: taxPaisa,
          total_paisa: totalPaisa,
          is_draft: true
        },
        inputItems
      );

      await refreshData();
      setSuccessInfo({
        type: 'draft',
        invoice: createdDraft,
        message: `Draft invoice ${createdDraft.invoice_number} saved. It will not affect customer receivables until issued.`
      });
    } catch (err: any) {
      console.error('[CreateInvoice] Error saving draft:', err);
      setValidationError(err?.message || 'Failed to save draft invoice.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Issue / Create Invoice action
  const handleCreateInvoice = async () => {
    setValidationError(null);
    setSuccessInfo(null);

    const error = validateForm(false);
    if (error) {
      setValidationError(error);
      return;
    }

    try {
      setIsSubmitting(true);

      const validItems = lineItems.filter(item => item.description.trim() !== '');
      const inputItems = validItems.map(item => ({
        product_id: item.productId,
        item_description: item.description,
        quantity: item.quantity,
        unit: item.unit || 'Unit',
        unit_price_paisa: item.unitPricePaisa,
        amount_paisa: item.amountPaisa
      }));

      const createdInvoice = await repository.createInvoice(
        {
          customer_id: selectedCustomerId,
          invoice_number: invoiceNumber.trim(),
          issue_date: issueDate,
          due_date: dueDate,
          reference: reference.trim(),
          notes: notes.trim(),
          subtotal_paisa: subtotalPaisa,
          discount_paisa: discountPaisa,
          tax_paisa: taxPaisa,
          total_paisa: totalPaisa,
          is_draft: false
        },
        inputItems
      );

      await refreshData();

      // Prepare print data structure for A4 verification
      if (selectedCustomer && business) {
        buildInvoicePrintPayload(createdInvoice, inputItems as any, selectedCustomer, business);
      }

      setSuccessInfo({
        type: 'issued',
        invoice: createdInvoice,
        message: `Invoice ${createdInvoice.invoice_number} issued successfully! Receivable amount of ${formatPKR(createdInvoice.total_paisa)} recorded.`
      });
    } catch (err: any) {
      console.error('[CreateInvoice] Error creating invoice:', err);
      setValidationError(err?.message || 'Failed to create invoice.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-8 max-w-[1440px] mx-auto w-full select-none-text">
      {/* Breadcrumb and Page Header */}
      <div className="mb-7">
        <Link
          to="/invoices"
          className="inline-flex items-center text-sm font-medium text-[#00875a] hover:underline mb-3"
        >
          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path d="M10 19l-7-7m0 0l7-7m-7 7h18" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to Invoices
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-[#0f172a] tracking-tight">Create invoice</h1>
            <p className="text-slate-500 text-sm mt-1">Add customer, items and details to create a new invoice.</p>
          </div>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successInfo && (
        <div className="mb-6 p-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-900 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
              ✓
            </div>
            <div>
              <div className="text-sm font-bold">
                {successInfo.type === 'issued' ? 'Invoice Successfully Created' : 'Draft Invoice Saved'}
              </div>
              <div className="text-xs text-emerald-800">{successInfo.message}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                navigate(`/customer-profile?id=${encodeURIComponent(successInfo.invoice.customer_id)}`);
              }}
              className="px-3 py-1.5 bg-white border border-emerald-300 text-emerald-800 text-xs font-semibold rounded-lg hover:bg-emerald-100 transition-colors"
            >
              View Customer Profile
            </button>
            <button
              onClick={() => {
                navigate(`/invoice-details?id=${encodeURIComponent(successInfo.invoice.id)}`);
              }}
              className="px-3 py-1.5 bg-[#00875a] text-white text-xs font-semibold rounded-lg hover:bg-[#047857] transition-colors"
            >
              Invoice Details
            </button>
          </div>
        </div>
      )}

      {/* Error Notification Banner */}
      {validationError && (
        <div className="mb-6 p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-900 shadow-sm flex items-center gap-3 animate-in fade-in duration-200">
          <div className="w-8 h-8 rounded-full bg-rose-500 text-white flex items-center justify-center font-bold text-sm shrink-0">
            !
          </div>
          <div className="text-xs font-medium">{validationError}</div>
        </div>
      )}

      {/* Grid Layout: Left Column & Right Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* BEGIN: Left Column (Forms & Table) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Card 1: Invoice Details */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm" data-purpose="invoice-details-card">
            <h2 className="text-lg font-bold text-slate-900 mb-5">Invoice details</h2>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-4">
              {/* Customer Field */}
              <div className="md:col-span-7 relative" ref={customerDropdownRef}>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    Customer <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsAddCustomerModalOpen(true)}
                    className="text-xs font-semibold text-[#00875a] hover:underline flex items-center gap-1"
                  >
                    <span className="text-sm leading-none">+</span> Add new customer
                  </button>
                </div>

                {/* Customer Selector Button */}
                <div
                  onClick={() => setIsCustomerDropdownOpen(!isCustomerDropdownOpen)}
                  className="relative flex items-center border border-slate-200 rounded-xl px-3 py-2 bg-white hover:border-slate-300 transition-colors cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#00875a] flex items-center justify-center font-bold text-xs mr-3 shrink-0">
                    {selectedCustomer?.initials || (
                      <svg className="w-4 h-4 text-[#00875a]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">
                      {selectedCustomer?.name || 'Select a customer'}
                    </div>
                    <div className="text-xs text-slate-400">
                      {selectedCustomer ? `${selectedCustomer.city || 'Pakistan'}` : 'Click to choose customer'}
                    </div>
                  </div>
                  <svg
                    className={`w-4 h-4 text-slate-400 shrink-0 ml-2 transition-transform duration-150 ${isCustomerDropdownOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>

                {/* Customer Dropdown Popover */}
                {isCustomerDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg z-30 p-2 max-h-64 overflow-y-auto">
                    <div className="px-2 py-1 mb-1">
                      <input
                        type="text"
                        placeholder="Search customer by name, city, phone..."
                        value={customerSearchTerm}
                        onChange={(e) => setCustomerSearchTerm(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#00875a]"
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                      />
                    </div>
                    <div className="divide-y divide-slate-100">
                      {filteredCustomers.length === 0 ? (
                        <div className="p-3 text-xs text-slate-400 text-center">No customers found.</div>
                      ) : (
                        filteredCustomers.map(cust => (
                          <div
                            key={cust.id}
                            onClick={() => {
                              setSelectedCustomerId(cust.id);
                              setIsCustomerDropdownOpen(false);
                            }}
                            className={`flex items-center justify-between p-2 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors ${selectedCustomerId === cust.id ? 'bg-[#ecfdf5]' : ''}`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-6 h-6 rounded bg-slate-100 text-slate-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                                {cust.initials || cust.name.slice(0, 2).toUpperCase()}
                              </span>
                              <div className="truncate">
                                <div className="text-xs font-semibold text-slate-800">{cust.name}</div>
                                <div className="text-[10px] text-slate-400">{cust.city} • {cust.phone}</div>
                              </div>
                            </div>
                            <span className="text-[10px] font-semibold text-slate-600 shrink-0 ml-2">
                              {formatPKR(cust.balance_due_paisa)}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Invoice Number Field */}
              <div className="md:col-span-5">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Invoice number <span className="text-red-500">*</span>
                </label>
                <div className="relative flex items-center border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50/70">
                  <input
                    type="text"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="w-full bg-transparent border-0 p-0 text-sm font-medium text-slate-800 focus:ring-0 focus:outline-none"
                    placeholder="INV-2026-XXXX"
                  />
                  <button
                    type="button"
                    onClick={refreshInvoiceNumber}
                    disabled={isRefreshingNumber}
                    title="Refresh next sequence number"
                    className="text-slate-400 hover:text-slate-600 transition-colors p-0.5 shrink-0"
                  >
                    <svg
                      className={`w-4 h-4 ${isRefreshingNumber ? 'animate-spin' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Dates & Reference Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              {/* Issue Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Issue date <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center border border-slate-200 rounded-xl px-3 py-2 bg-white hover:border-slate-300 transition-colors">
                  <svg className="w-4 h-4 text-slate-400 shrink-0 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <rect height="18" rx="2" ry="2" width="18" x="3" y="4" />
                    <line x1="16" x2="16" y1="2" y2="6" />
                    <line x1="8" x2="8" y1="2" y2="6" />
                    <line x1="3" x2="21" y1="10" y2="10" />
                  </svg>
                  <input
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="w-full bg-transparent border-0 p-0 text-xs font-medium text-slate-800 focus:ring-0 focus:outline-none"
                  />
                </div>
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Due date <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center border border-slate-200 rounded-xl px-3 py-2 bg-white hover:border-slate-300 transition-colors">
                  <svg className="w-4 h-4 text-slate-400 shrink-0 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <rect height="18" rx="2" ry="2" width="18" x="3" y="4" />
                    <line x1="16" x2="16" y1="2" y2="6" />
                    <line x1="8" x2="8" y1="2" y2="6" />
                    <line x1="3" x2="21" y1="10" y2="10" />
                  </svg>
                  <input
                    type="date"
                    value={dueDate}
                    min={issueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full bg-transparent border-0 p-0 text-xs font-medium text-slate-800 focus:ring-0 focus:outline-none"
                  />
                </div>
              </div>

              {/* Reference */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Reference <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <div className="flex items-center border border-slate-200 rounded-xl px-3 py-2 bg-white hover:border-slate-300 transition-colors">
                  <svg className="w-4 h-4 text-slate-400 mr-2 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <input
                    type="text"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="e.g. PO number"
                    className="w-full bg-transparent border-0 p-0 text-xs text-slate-800 placeholder-slate-400 focus:ring-0 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Notes Field */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Notes <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <div className="relative border border-slate-200 rounded-xl p-3 bg-white focus-within:border-[#00875a]">
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add any additional notes for this invoice..."
                    className="w-full bg-transparent border-0 p-0 text-xs text-slate-800 placeholder-slate-400 focus:ring-0 focus:outline-none resize-y"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Invoice Items Table */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm" data-purpose="invoice-items-card">
            <h2 className="text-lg font-bold text-slate-900 mb-5">Invoice items</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[11px] font-semibold text-slate-600 border-b border-slate-100 pb-2">
                    <th className="py-2 px-1 w-6">#</th>
                    <th className="py-2 px-2 min-w-[190px]">
                      Item / Product <span className="text-red-500">*</span>
                    </th>
                    <th className="py-2 px-2 min-w-[150px]">
                      Description <span className="text-slate-400 font-normal">(Optional)</span>
                    </th>
                    <th className="py-2 px-2 w-20 text-center">Quantity</th>
                    <th className="py-2 px-2 min-w-[110px]">Unit price (PKR)</th>
                    <th className="py-2 px-2 min-w-[110px]">Amount (PKR)</th>
                    <th className="py-2 px-1 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lineItems.map((item, index) => (
                    <tr key={item.id}>
                      <td className="py-2.5 px-1 text-xs text-slate-400 font-medium">
                        {index + 1}
                      </td>

                      {/* Product Selector / Name */}
                      <td className="py-2.5 px-2">
                        <div className="space-y-1">
                          <select
                            value={item.productId || (item.isCustom ? 'custom' : '')}
                            onChange={(e) => handleProductSelect(index, e.target.value)}
                            className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-800 bg-white focus:border-[#00875a] focus:ring-0"
                          >
                            <option value="custom">-- Custom Line Item --</option>
                            <optgroup label="Products & Services">
                              {products.filter(p => p.is_active).map(prod => (
                                <option key={prod.id} value={prod.id}>
                                  {prod.name} ({formatPKR(prod.price_paisa)})
                                </option>
                              ))}
                            </optgroup>
                          </select>
                          {item.isCustom && (
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) => handleItemChange(index, { description: e.target.value })}
                              placeholder="Enter item name..."
                              className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:border-[#00875a] focus:ring-0"
                            />
                          )}
                        </div>
                      </td>

                      {/* Line Item Description */}
                      <td className="py-2.5 px-2">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => handleItemChange(index, { description: e.target.value })}
                          placeholder="e.g. AC installation"
                          className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-800 focus:border-[#00875a] focus:ring-0"
                        />
                      </td>

                      {/* Quantity */}
                      <td className="py-2.5 px-2">
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={item.quantity || ''}
                          onChange={(e) => handleItemChange(index, { quantity: parseFloat(e.target.value) || 0 })}
                          className="w-full border border-slate-200 rounded-lg px-2 py-2 text-xs text-slate-800 text-center focus:border-[#00875a] focus:ring-0"
                        />
                      </td>

                      {/* Unit Price (PKR) */}
                      <td className="py-2.5 px-2">
                        <input
                          type="text"
                          value={paisaToRupees(item.unitPricePaisa).toLocaleString('en-US')}
                          onChange={(e) => {
                            const pkr = parseFloat(e.target.value.replace(/,/g, '')) || 0;
                            handleItemChange(index, { unitPricePaisa: Math.round(pkr * 100) });
                          }}
                          className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-800 focus:border-[#00875a] focus:ring-0"
                        />
                      </td>

                      {/* Amount (PKR) */}
                      <td className="py-2.5 px-2">
                        <input
                          type="text"
                          readOnly
                          value={paisaToRupees(item.amountPaisa).toLocaleString('en-US')}
                          className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-700 bg-slate-50 font-medium cursor-default"
                        />
                      </td>

                      {/* Delete Row Button */}
                      <td className="py-2.5 px-1 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          title="Delete Row"
                          className="text-rose-500 hover:text-rose-700 transition-colors p-1"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Table Actions: Add & Clear */}
            <div className="mt-4 pt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={handleAddItem}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-[#00875a] text-[#00875a] hover:bg-[#ecfdf5] rounded-xl text-xs font-semibold transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Add item
              </button>
              <button
                type="button"
                onClick={handleClearAllItems}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-slate-500 hover:text-rose-600 rounded-xl text-xs font-medium transition-colors"
              >
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Clear all items
              </button>
            </div>
          </div>
        </div>
        {/* END: Left Column */}

        {/* BEGIN: Right Column (Summary & Bill To) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Card 1: Invoice Summary */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm" data-purpose="invoice-summary-card">
            <h2 className="text-lg font-bold text-slate-900 mb-5">Invoice summary</h2>
            <div className="space-y-4">
              {/* Subtotal */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600 font-medium">Subtotal</span>
                <span className="text-slate-900 font-bold tracking-tight">
                  {formatPKR(subtotalPaisa)}
                </span>
              </div>

              {/* Discount */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Discount <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as any)}
                    className="border border-slate-200 rounded-lg px-2.5 py-2 bg-white text-xs text-slate-700 w-32 focus:ring-0 focus:border-[#00875a]"
                  >
                    <option value="percent">Percentage (%)</option>
                    <option value="fixed">Fixed (PKR)</option>
                  </select>
                  <div className="flex items-center border border-slate-200 rounded-lg px-3 py-2 bg-white flex-1 min-w-[70px]">
                    <input
                      type="number"
                      min="0"
                      value={discountValue || ''}
                      onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full border-0 p-0 text-xs text-slate-800 text-left focus:ring-0 focus:outline-none"
                    />
                    <span className="text-xs text-slate-400 font-medium ml-1">
                      {discountType === 'percent' ? '%' : 'PKR'}
                    </span>
                  </div>
                  <div className="text-xs font-medium text-slate-600 whitespace-nowrap min-w-[75px] text-right">
                    - {formatPKR(discountPaisa)}
                  </div>
                </div>
              </div>

              {/* Tax */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Tax <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={taxType}
                    onChange={(e) => setTaxType(e.target.value as any)}
                    className="border border-slate-200 rounded-lg px-2.5 py-2 bg-white text-xs text-slate-700 w-32 focus:ring-0 focus:border-[#00875a]"
                  >
                    <option value="percent">Percentage (%)</option>
                    <option value="fixed">Fixed (PKR)</option>
                  </select>
                  <div className="flex items-center border border-slate-200 rounded-lg px-3 py-2 bg-white flex-1 min-w-[70px]">
                    <input
                      type="number"
                      min="0"
                      value={taxValue || ''}
                      onChange={(e) => setTaxValue(parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full border-0 p-0 text-xs text-slate-800 text-left focus:ring-0 focus:outline-none"
                    />
                    <span className="text-xs text-slate-400 font-medium ml-1">
                      {taxType === 'percent' ? '%' : 'PKR'}
                    </span>
                  </div>
                  <div className="text-xs font-medium text-slate-600 whitespace-nowrap min-w-[75px] text-right">
                    + {formatPKR(taxPaisa)}
                  </div>
                </div>
              </div>

              {/* Total Amount Highlight Box */}
              <div className="mt-6 pt-2">
                <div className="bg-[#dcf5e7] border border-[#b2ebd0] rounded-xl px-4 py-3.5 flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-900">Total Amount</span>
                  <span className="text-lg font-extrabold text-slate-900">
                    {formatPKR(totalPaisa)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Bill To Customer Details */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm" data-purpose="bill-to-card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-slate-900">Bill to</h3>
              {selectedCustomer && (
                <button
                  type="button"
                  onClick={() => setIsCustomerDropdownOpen(true)}
                  className="text-xs font-semibold text-[#00875a] hover:underline flex items-center gap-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Switch
                </button>
              )}
            </div>

            {selectedCustomer ? (
              <div className="space-y-2">
                <div className="font-bold text-slate-900 text-sm">{selectedCustomer.name}</div>
                <div className="text-xs text-slate-500 font-medium">
                  {selectedCustomer.city ? `${selectedCustomer.city}, Pakistan` : 'Pakistan'}
                </div>
                <div className="pt-2 flex flex-wrap gap-4 text-xs text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span>{selectedCustomer.phone || 'No phone'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span>{selectedCustomer.email || 'No email provided'}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-400 py-3">
                No customer selected. Choose a customer from the selector above to display billing details.
              </div>
            )}
          </div>

          {/* Card 3: Notes Info Callout Banner */}
          <div className="bg-[#f0f7ff] border border-blue-100 rounded-2xl p-5 flex gap-3.5 items-start shadow-sm" data-purpose="notes-info-callout">
            <div className="w-7 h-7 rounded-full bg-[#1e75ff] text-white flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">
              i
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 mb-1">Notes</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                This invoice will be created in PKR (Pakistani Rupee). You can edit the invoice number, dates and items before creating.
              </p>
            </div>
          </div>

          {/* Action Buttons Group */}
          <div className="grid grid-cols-12 gap-3 pt-2">
            {/* Save Draft Button */}
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={isSubmitting}
              className="col-span-5 inline-flex items-center justify-center gap-2 px-4 py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl shadow-sm transition-colors disabled:opacity-50"
            >
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {isSubmitting ? 'Saving...' : 'Save draft'}
            </button>

            {/* Create Invoice CTA Button */}
            <button
              type="button"
              onClick={handleCreateInvoice}
              disabled={isSubmitting}
              className="col-span-7 inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#00875a] hover:bg-[#047857] text-white font-semibold text-xs rounded-xl shadow-sm transition-colors disabled:opacity-50"
            >
              <span>{isSubmitting ? 'Creating...' : 'Create invoice'}</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M14 5l7 7m0 0l-7 7m7-7H3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
        {/* END: Right Column */}
      </div>

      {/* Add Customer Modal */}
      <AddCustomerModal
        isOpen={isAddCustomerModalOpen}
        onClose={() => setIsAddCustomerModalOpen(false)}
        existingCustomers={customers}
        repository={repository}
        onCustomerAdded={refreshData}
        onCustomerCreated={(newCust) => {
          setSelectedCustomerId(newCust.id);
        }}
      />
    </div>
  );
};
