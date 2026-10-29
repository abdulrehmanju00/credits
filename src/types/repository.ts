import {
  BusinessSettings,
  Customer,
  ProductService,
  Invoice,
  InvoiceItem,
  Payment,
  PaymentAllocation,
  CreditLedgerEntry,
  ReminderSettings,
  OverviewMetrics
} from './models';

export interface CreateInvoiceInput {
  id?: string;
  customer_id: string;
  invoice_number?: string;
  issue_date?: string;
  due_date?: string;
  subtotal_paisa?: number;
  tax_paisa?: number;
  discount_paisa?: number;
  total_paisa?: number;
  reference?: string;
  notes?: string;
  is_draft?: boolean;
}

export interface CreateInvoiceItemInput {
  id?: string;
  product_id?: string;
  item_description: string;
  quantity: number;
  unit?: string;
  unit_price_paisa: number;
  amount_paisa?: number;
}

export interface CreatePaymentInput {
  id?: string;
  customer_id: string;
  payment_number?: string;
  amount_paisa: number;
  payment_date?: string;
  payment_method?: string;
  reference_number?: string;
  notes?: string;
}

export interface CreateAllocationInput {
  id?: string;
  invoice_id: string;
  allocated_amount_paisa: number;
}

export interface BackupPayload {
  app: string;
  format_version: string;
  schema_version: number;
  exported_at: string;
  business_id: string;
  data: Record<string, any[]>;
}

export interface ICreditFlowRepository {
  init(): Promise<void>;
  
  // Business
  getBusiness(): Promise<BusinessSettings | null>;
  updateBusiness(updates: Partial<BusinessSettings>): Promise<BusinessSettings>;

  // Customers
  getCustomers(): Promise<Customer[]>;
  getCustomerById(id: string): Promise<Customer | null>;
  createCustomer(customer: Partial<Customer>): Promise<Customer>;
  updateCustomer(id: string, updates: Partial<Customer>): Promise<Customer>;

  // Products
  getProducts(): Promise<ProductService[]>;
  getProductById(id: string): Promise<ProductService | null>;
  createProduct(product: Partial<ProductService>): Promise<ProductService>;
  updateProduct(id: string, updates: Partial<ProductService>): Promise<ProductService>;
  setProductActiveStatus(id: string, isActive: boolean): Promise<ProductService>;

  // Invoices
  getInvoices(): Promise<Invoice[]>;
  getInvoiceById(id: string): Promise<Invoice | null>;
  getInvoiceItems(invoiceId: string): Promise<InvoiceItem[]>;
  createInvoice(invoiceData: CreateInvoiceInput, lineItems: CreateInvoiceItemInput[]): Promise<Invoice>;
  saveDraftInvoice(invoiceData: CreateInvoiceInput, lineItems: CreateInvoiceItemInput[]): Promise<Invoice>;
  getNextInvoiceNumber(issueDate?: string): Promise<string>;

  // Payments & Allocations
  getPayments(): Promise<Payment[]>;
  getPaymentById(id: string): Promise<Payment | null>;
  getPaymentAllocations(paymentId: string): Promise<PaymentAllocation[]>;
  recordPayment(paymentData: CreatePaymentInput, allocations?: CreateAllocationInput[]): Promise<Payment>;

  // Ledger
  getLedgerEntries(): Promise<CreditLedgerEntry[]>;
  getLedgerEntriesByCustomerId(customerId: string): Promise<CreditLedgerEntry[]>;

  // Reminders
  getReminderSettings(): Promise<ReminderSettings | null>;
  updateReminderSettings(updates: Partial<ReminderSettings>): Promise<ReminderSettings>;

  // Metrics
  getOverviewMetrics(): Promise<OverviewMetrics>;

  // Backup
  exportBackup(): Promise<BackupPayload>;
  importBackup(jsonInput: string | BackupPayload): Promise<{ success: boolean; restored_at: string; record_counts: Record<string, number> }>;
}
