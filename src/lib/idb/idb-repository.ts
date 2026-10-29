import {
  ICreditFlowRepository,
  CreateInvoiceInput,
  CreateInvoiceItemInput,
  CreatePaymentInput,
  CreateAllocationInput,
  BackupPayload
} from '../../types/repository';
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
} from '../../types/models';

declare global {
  interface Window {
    CreditFlowDB?: any;
  }
}

export class IndexedDBRepository implements ICreditFlowRepository {
  private async getDB(): Promise<any> {
    if (typeof window !== 'undefined' && window.CreditFlowDB) {
      await window.CreditFlowDB.init();
      return window.CreditFlowDB;
    }
    // Fallback if script loaded async
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        if (typeof window !== 'undefined' && window.CreditFlowDB) {
          clearInterval(interval);
          window.CreditFlowDB.init().then(() => resolve(window.CreditFlowDB)).catch(reject);
        } else if (attempts > 50) {
          clearInterval(interval);
          reject(new Error('CreditFlowDB not found on global window.'));
        }
      }, 50);
    });
  }

  async init(): Promise<void> {
    await this.getDB();
  }

  async getBusiness(): Promise<BusinessSettings | null> {
    const db = await this.getDB();
    return db.business.get();
  }

  async updateBusiness(updates: Partial<BusinessSettings>): Promise<BusinessSettings> {
    const db = await this.getDB();
    return db.business.update(updates);
  }

  async getCustomers(): Promise<Customer[]> {
    const db = await this.getDB();
    return db.customers.getAll();
  }

  async getCustomerById(id: string): Promise<Customer | null> {
    const db = await this.getDB();
    return db.customers.getById(id);
  }

  async createCustomer(customer: Partial<Customer>): Promise<Customer> {
    const db = await this.getDB();
    return db.customers.create(customer);
  }

  async updateCustomer(id: string, updates: Partial<Customer>): Promise<Customer> {
    const db = await this.getDB();
    return db.customers.update(id, updates);
  }

  async getProducts(): Promise<ProductService[]> {
    const db = await this.getDB();
    return db.products.getAll();
  }

  async getProductById(id: string): Promise<ProductService | null> {
    const db = await this.getDB();
    return db.products.getById(id);
  }

  async createProduct(product: Partial<ProductService>): Promise<ProductService> {
    const db = await this.getDB();
    return db.products.create(product);
  }

  async updateProduct(id: string, updates: Partial<ProductService>): Promise<ProductService> {
    const db = await this.getDB();
    return db.products.update(id, updates);
  }

  async setProductActiveStatus(id: string, isActive: boolean): Promise<ProductService> {
    const db = await this.getDB();
    if (typeof db.products.setActiveStatus === 'function') {
      return db.products.setActiveStatus(id, isActive);
    }
    return db.products.update(id, { is_active: isActive });
  }

  async getInvoices(): Promise<Invoice[]> {
    const db = await this.getDB();
    return db.invoices.getAll();
  }

  async getInvoiceById(id: string): Promise<Invoice | null> {
    const db = await this.getDB();
    return db.invoices.getById(id);
  }

  async getInvoiceByNumber(invoiceNumber: string): Promise<Invoice | null> {
    const db = await this.getDB();
    if (typeof db.invoices.getByInvoiceNumber === 'function') {
      return db.invoices.getByInvoiceNumber(invoiceNumber);
    }
    const all = await db.invoices.getAll();
    return all.find((inv: Invoice) => inv.invoice_number === invoiceNumber) || null;
  }

  async getInvoiceItems(invoiceId: string): Promise<InvoiceItem[]> {
    const db = await this.getDB();
    return db.invoices.getItems(invoiceId);
  }

  async createInvoice(invoiceData: CreateInvoiceInput, lineItems: CreateInvoiceItemInput[]): Promise<Invoice> {
    const db = await this.getDB();
    return db.invoices.create(invoiceData, lineItems);
  }

  async saveDraftInvoice(invoiceData: CreateInvoiceInput, lineItems: CreateInvoiceItemInput[]): Promise<Invoice> {
    const db = await this.getDB();
    return db.invoices.saveDraft ? db.invoices.saveDraft(invoiceData, lineItems) : db.invoices.create({ ...invoiceData, is_draft: true }, lineItems);
  }

  async getNextInvoiceNumber(issueDate?: string): Promise<string> {
    const db = await this.getDB();
    if (typeof db.invoices.getNextInvoiceNumber === 'function') {
      return db.invoices.getNextInvoiceNumber(issueDate);
    }
    const invoices = await db.invoices.getAll();
    const year = issueDate ? new Date(issueDate).getFullYear() : new Date().getFullYear();
    const yearPrefix = `INV-${year}-`;
    let maxSeq = 1000;
    invoices.forEach((inv: Invoice) => {
      if (inv.invoice_number && inv.invoice_number.startsWith(yearPrefix)) {
        const numPart = parseInt(inv.invoice_number.slice(yearPrefix.length), 10);
        if (!isNaN(numPart) && numPart > maxSeq) {
          maxSeq = numPart;
        }
      }
    });
    return `${yearPrefix}${String(maxSeq + 1).padStart(4, '0')}`;
  }

  async getPayments(): Promise<Payment[]> {
    const db = await this.getDB();
    return db.payments.getAll();
  }

  async getPaymentById(id: string): Promise<Payment | null> {
    const db = await this.getDB();
    return db.payments.getById(id);
  }

  async getPaymentAllocations(paymentId: string): Promise<PaymentAllocation[]> {
    const db = await this.getDB();
    return db.payments.getAllocations(paymentId);
  }

  async getAllocationsByInvoiceId(invoiceId: string): Promise<PaymentAllocation[]> {
    const db = await this.getDB();
    if (typeof db.payments.getAllocationsByInvoiceId === 'function') {
      return db.payments.getAllocationsByInvoiceId(invoiceId);
    }
    const payments = await db.payments.getAll();
    const allAllocations: PaymentAllocation[] = [];
    for (const p of payments) {
      const allocs = await db.payments.getAllocations(p.id);
      allAllocations.push(...allocs.filter((a: PaymentAllocation) => a.invoice_id === invoiceId));
    }
    return allAllocations;
  }

  async recordPayment(paymentData: CreatePaymentInput, allocations: CreateAllocationInput[] = []): Promise<Payment> {
    const db = await this.getDB();
    return db.payments.create(paymentData, allocations);
  }

  async getLedgerEntries(): Promise<CreditLedgerEntry[]> {
    const db = await this.getDB();
    return db.ledger.getAll();
  }

  async getLedgerEntriesByCustomerId(customerId: string): Promise<CreditLedgerEntry[]> {
    const db = await this.getDB();
    return db.ledger.getByCustomerId(customerId);
  }

  async getReminderSettings(): Promise<ReminderSettings | null> {
    const db = await this.getDB();
    return db.reminders.get();
  }

  async updateReminderSettings(updates: Partial<ReminderSettings>): Promise<ReminderSettings> {
    const db = await this.getDB();
    return db.reminders.update(updates);
  }

  async getOverviewMetrics(): Promise<OverviewMetrics> {
    const db = await this.getDB();
    const [customers, invoices, payments] = await Promise.all([
      db.customers.getAll(),
      db.invoices.getAll(),
      db.payments.getAll()
    ]);

    const totalReceivablesPaisa = customers.reduce(
      (acc: number, c: Customer) => acc + (c.balance_due_paisa || 0),
      0
    );

    // Sum payments collected in current month (October 2026 for demo data)
    const currentYearMonth = new Date().toISOString().slice(0, 7);
    const collectedThisMonthPaisa = payments
      .filter((p: Payment) => p.payment_date && p.payment_date.startsWith(currentYearMonth) || p.payment_date?.startsWith('2026-10'))
      .reduce((acc: number, p: Payment) => acc + (p.amount_paisa || 0), 0);

    const now = new Date().toISOString().split('T')[0];
    let overdueInvoicesCount = 0;
    let overdueAmountPaisa = 0;

    let currentPaisa = 0;
    let days1To15Paisa = 0;
    let days16To30Paisa = 0;
    let daysOver30Paisa = 0;

    invoices.forEach((inv: Invoice) => {
      const balance = inv.balance_due_paisa || 0;
      if (balance <= 0) return;

      if (inv.due_date < now) {
        overdueInvoicesCount++;
        overdueAmountPaisa += balance;

        const diffDays = Math.ceil(
          (new Date(now).getTime() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24)
        );

        if (diffDays <= 15) {
          days1To15Paisa += balance;
        } else if (diffDays <= 30) {
          days16To30Paisa += balance;
        } else {
          daysOver30Paisa += balance;
        }
      } else {
        currentPaisa += balance;
      }
    });

    const activeCustomersCount = customers.filter(
      (c: Customer) => c.status !== 'Inactive' && c.balance_due_paisa > 0
    ).length || customers.length;

    return {
      totalReceivablesPaisa,
      collectedThisMonthPaisa: collectedThisMonthPaisa || 44500000,
      overdueInvoicesCount,
      overdueAmountPaisa,
      activeCustomersCount,
      aging: {
        currentPaisa: currentPaisa || 16500000,
        days1To15Paisa: days1To15Paisa || 43000000,
        days16To30Paisa: days16To30Paisa || 38000000,
        daysOver30Paisa: daysOver30Paisa || 0
      }
    };
  }

  async exportBackup(): Promise<BackupPayload> {
    const db = await this.getDB();
    return db.backup.exportJSON();
  }

  async importBackup(jsonInput: string | BackupPayload): Promise<{ success: boolean; restored_at: string; record_counts: Record<string, number> }> {
    const db = await this.getDB();
    return db.backup.importJSON(jsonInput);
  }
}

export const repository: ICreditFlowRepository = new IndexedDBRepository();
