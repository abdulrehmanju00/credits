import React, { useEffect, useState } from 'react';
import { Invoice, InvoiceItem } from '../../types/models';
import { ICreditFlowRepository } from '../../types/repository';
import { formatPKR, formatDate } from '../../lib/utils';

interface InvoiceDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  repository: ICreditFlowRepository;
}

export const InvoiceDetailsModal: React.FC<InvoiceDetailsModalProps> = ({
  isOpen,
  onClose,
  invoice,
  repository
}) => {
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && invoice) {
      setIsLoading(true);
      repository
        .getInvoiceItems(invoice.id)
        .then((res) => setItems(res || []))
        .catch((err) => console.error('Failed to load items:', err))
        .finally(() => setIsLoading(false));
    } else {
      setItems([]);
    }
  }, [isOpen, invoice, repository]);

  if (!isOpen || !invoice) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative bg-white rounded-2xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start justify-between pb-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-3">
              <h3 className="text-xl font-bold text-slate-900">{invoice.invoice_number}</h3>
              {invoice.payment_status === 'PAID' ? (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600">
                  Paid
                </span>
              ) : invoice.due_status === 'OVERDUE' ? (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-600">
                  Overdue
                </span>
              ) : invoice.due_status === 'DUE_SOON' ? (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700">
                  Due Soon
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-600">
                  Current
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Customer: <span className="font-semibold text-slate-700">{invoice.customer_name}</span> ({invoice.customer_city})
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            type="button"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
          </button>
        </div>

        {/* Invoice Info Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 border-b border-slate-100 text-xs">
          <div>
            <span className="text-slate-400 block font-medium">Issue Date</span>
            <span className="font-semibold text-slate-800 mt-0.5 block">{formatDate(invoice.issue_date)}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Due Date</span>
            <span className="font-semibold text-slate-800 mt-0.5 block">{formatDate(invoice.due_date)}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Total Amount</span>
            <span className="font-semibold text-slate-900 mt-0.5 block">{formatPKR(invoice.total_paisa)}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Balance Due</span>
            <span
              className={`font-semibold mt-0.5 block ${
                invoice.balance_due_paisa > 0 ? 'text-rose-600' : 'text-emerald-600'
              }`}
            >
              {formatPKR(invoice.balance_due_paisa)}
            </span>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="mt-5">
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">Line Items</h4>
          {isLoading ? (
            <div className="py-8 text-center text-xs text-slate-400">Loading line items...</div>
          ) : items.length === 0 ? (
            <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-500">
              Standard commercial invoice transaction without itemized breakdown.
            </div>
          ) : (
            <div className="border border-slate-100 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                  <tr>
                    <th className="py-2.5 px-4">Item</th>
                    <th className="py-2.5 px-4 text-center">Qty</th>
                    <th className="py-2.5 px-4 text-right">Unit Price</th>
                    <th className="py-2.5 px-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item) => (
                    <tr key={item.id} className="text-slate-700">
                      <td className="py-2.5 px-4 font-medium">{item.item_description}</td>
                      <td className="py-2.5 px-4 text-center">
                        {item.quantity} {item.unit || ''}
                      </td>
                      <td className="py-2.5 px-4 text-right text-slate-500">
                        {formatPKR(item.unit_price_paisa)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-semibold text-slate-900">
                        {formatPKR(item.amount_paisa)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Financial Summary */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col items-end text-xs space-y-1.5">
          <div className="flex justify-between w-48 text-slate-500">
            <span>Subtotal:</span>
            <span>{formatPKR(invoice.subtotal_paisa || invoice.total_paisa)}</span>
          </div>
          {(invoice.discount_paisa || 0) > 0 && (
            <div className="flex justify-between w-48 text-emerald-600">
              <span>Discount:</span>
              <span>-{formatPKR(invoice.discount_paisa)}</span>
            </div>
          )}
          {(invoice.tax_paisa || 0) > 0 && (
            <div className="flex justify-between w-48 text-slate-500">
              <span>Tax / Sales Tax:</span>
              <span>+{formatPKR(invoice.tax_paisa)}</span>
            </div>
          )}
          <div className="flex justify-between w-48 text-slate-900 font-bold pt-1 border-t border-slate-200">
            <span>Total:</span>
            <span>{formatPKR(invoice.total_paisa)}</span>
          </div>
          <div className="flex justify-between w-48 text-slate-600">
            <span>Paid to Date:</span>
            <span>{formatPKR(invoice.paid_paisa || 0)}</span>
          </div>
          <div className="flex justify-between w-48 font-bold text-rose-600 pt-1 border-t border-slate-200">
            <span>Remaining Due:</span>
            <span>{formatPKR(invoice.balance_due_paisa)}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
