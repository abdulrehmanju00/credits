import { Invoice, InvoiceItem, Customer, BusinessSettings } from '../types/models';
import { formatPKR, paisaToRupees } from './utils';

export interface InvoicePrintLineItem {
  index: number;
  description: string;
  sku?: string;
  quantity: number;
  unit: string;
  unitPricePaisa: number;
  unitPricePKR: string;
  amountPaisa: number;
  amountPKR: string;
}

export interface InvoicePrintSummary {
  subtotalPaisa: number;
  subtotalPKR: string;
  discountPaisa: number;
  discountPKR: string;
  taxPaisa: number;
  taxPKR: string;
  totalPaisa: number;
  totalPKR: string;
  paidPaisa: number;
  paidPKR: string;
  balanceDuePaisa: number;
  balanceDuePKR: string;
}

export interface InvoicePrintPayload {
  version: string;
  paperSize: 'A4';
  orientation: 'portrait';
  generatedAt: string;
  invoice: {
    id: string;
    number: string;
    issueDate: string;
    dueDate: string;
    status: string;
    paymentStatus: string;
    dueStatus: string;
    reference?: string;
    notes?: string;
    isDraft: boolean;
  };
  business: {
    name: string;
    ownerName: string;
    taxNumber: string;
    phone: string;
    email: string;
    address: string;
    city: string;
    currency: string;
    footerNotes?: string;
  };
  customer: {
    id: string;
    name: string;
    city: string;
    phone: string;
    email: string;
    category?: string;
  };
  lineItems: InvoicePrintLineItem[];
  summary: InvoicePrintSummary;
}

export function buildInvoicePrintPayload(
  invoice: Invoice,
  lineItems: InvoiceItem[],
  customer: Customer,
  business: BusinessSettings
): InvoicePrintPayload {
  const items: InvoicePrintLineItem[] = lineItems.map((item, idx) => ({
    index: idx + 1,
    description: item.item_description,
    quantity: item.quantity,
    unit: item.unit || 'Unit',
    unitPricePaisa: item.unit_price_paisa,
    unitPricePKR: formatPKR(item.unit_price_paisa),
    amountPaisa: item.amount_paisa,
    amountPKR: formatPKR(item.amount_paisa)
  }));

  const summary: InvoicePrintSummary = {
    subtotalPaisa: invoice.subtotal_paisa,
    subtotalPKR: formatPKR(invoice.subtotal_paisa),
    discountPaisa: invoice.discount_paisa || 0,
    discountPKR: formatPKR(invoice.discount_paisa || 0),
    taxPaisa: invoice.tax_paisa || 0,
    taxPKR: formatPKR(invoice.tax_paisa || 0),
    totalPaisa: invoice.total_paisa,
    totalPKR: formatPKR(invoice.total_paisa),
    paidPaisa: invoice.paid_paisa || 0,
    paidPKR: formatPKR(invoice.paid_paisa || 0),
    balanceDuePaisa: invoice.balance_due_paisa || 0,
    balanceDuePKR: formatPKR(invoice.balance_due_paisa || 0)
  };

  return {
    version: '1.0',
    paperSize: 'A4',
    orientation: 'portrait',
    generatedAt: new Date().toISOString(),
    invoice: {
      id: invoice.id,
      number: invoice.invoice_number,
      issueDate: invoice.issue_date,
      dueDate: invoice.due_date,
      status: invoice.status,
      paymentStatus: invoice.payment_status,
      dueStatus: invoice.due_status,
      reference: invoice.reference,
      notes: invoice.notes,
      isDraft: Boolean(invoice.is_draft)
    },
    business: {
      name: business.name,
      ownerName: business.owner_name,
      taxNumber: business.tax_number,
      phone: business.phone,
      email: business.email,
      address: business.address,
      city: business.city,
      currency: business.currency || 'PKR',
      footerNotes: business.footer_notes
    },
    customer: {
      id: customer.id,
      name: customer.name,
      city: customer.city,
      phone: customer.phone,
      email: customer.email,
      category: customer.category
    },
    lineItems: items,
    summary
  };
}
