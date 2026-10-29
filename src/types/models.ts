export type PaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID' | 'DRAFT';
export type DueStatus = 'OVERDUE' | 'DUE_SOON' | 'CURRENT';
export type DisplayStatus = 'Paid' | 'Partial' | 'Overdue' | 'Due Soon' | 'Current' | 'Active' | 'Draft';

export interface BusinessSettings {
  id: string;
  name: string;
  owner_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  currency: string;
  tax_number: string;
  footer_notes: string;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  business_id: string;
  name: string;
  initials: string;
  city: string;
  category: string;
  phone: string;
  email: string;
  status: string;
  credit_limit_paisa: number;
  total_invoiced_paisa: number;
  total_paid_paisa: number;
  balance_due_paisa: number;
  created_at: string;
  updated_at: string;
}

export interface ProductService {
  id: string;
  business_id: string;
  name: string;
  description?: string;
  sku: string;
  type: 'product' | 'service';
  unit: string;
  price_paisa: number;
  tax_percent: number;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  product_id?: string;
  item_description: string;
  quantity: number;
  unit: string;
  unit_price_paisa: number;
  amount_paisa: number;
  created_at: string;
}

export interface Invoice {
  id: string;
  business_id: string;
  invoice_number: string;
  customer_id: string;
  customer_name: string;
  customer_city: string;
  customer_phone: string;
  issue_date: string;
  due_date: string;
  subtotal_paisa: number;
  tax_paisa: number;
  discount_paisa: number;
  total_paisa: number;
  paid_paisa: number;
  balance_due_paisa: number;
  payment_status: PaymentStatus;
  due_status: DueStatus;
  status: DisplayStatus;
  reference?: string;
  notes?: string;
  is_draft?: boolean;
  created_at: string;
  updated_at: string;
}

export interface PaymentAllocation {
  id: string;
  payment_id: string;
  invoice_id: string;
  allocated_amount_paisa: number;
  allocated_at: string;
}

export interface Payment {
  id: string;
  business_id: string;
  payment_number: string;
  customer_id: string;
  customer_name: string;
  amount_paisa: number;
  payment_date: string;
  payment_method: string;
  reference_number?: string;
  notes?: string;
  created_at: string;
}

export interface CreditLedgerEntry {
  id: string;
  business_id: string;
  customer_id: string;
  entry_date: string;
  entry_type: 'INVOICE' | 'PAYMENT' | 'ADJUSTMENT';
  reference_id: string;
  reference_number: string;
  description: string;
  debit_paisa: number;
  credit_paisa: number;
  running_balance_paisa: number;
  created_at: string;
}

export interface ReminderSettings {
  id: string;
  business_id: string;
  auto_reminders_enabled: boolean;
  channels: string[];
  schedule_days_before_due: number;
  schedule_days_after_due: number;
  frequency_days: number;
  sender_name: string;
  custom_template_due_soon: string;
  custom_template_overdue: string;
  updated_at: string;
}

export interface OverviewMetrics {
  totalReceivablesPaisa: number;
  collectedThisMonthPaisa: number;
  overdueInvoicesCount: number;
  overdueAmountPaisa: number;
  activeCustomersCount: number;
  aging: {
    currentPaisa: number;
    days1To15Paisa: number;
    days16To30Paisa: number;
    daysOver30Paisa: number;
  };
}
