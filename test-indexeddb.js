import { indexedDB } from 'fake-indexeddb';
import fs from 'fs';
import path from 'path';

// Setup global browser simulation
global.window = { indexedDB };
global.indexedDB = indexedDB;

// Load creditflow-db.js
const dbScript = fs.readFileSync(path.resolve('./creditflow-db.js'), 'utf-8');
const runDb = new Function('window', 'root', dbScript);
runDb(global.window, global.window);

const DB = global.window.CreditFlowDB;

async function runTests() {
  console.log('=== STARTING CREDITFLOW FINANCIAL ENGINE HARDENING & INTEGRITY TESTS ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`PASS: ${testName}`);
      passed++;
    } else {
      console.error(`FAIL: ${testName}`);
      failed++;
    }
  }

  try {
    // ----------------------------------------------------
    // Section 1: Schema & Basic Store Verification
    // ----------------------------------------------------
    await DB.init();
    assert(DB.version === 1, 'Database schema version is 1');
    assert(DB.name === 'CreditFlowDB', 'Database name is CreditFlowDB');

    const expectedStores = [
      'business_settings',
      'customers',
      'products_services',
      'invoices',
      'invoice_items',
      'payments',
      'payment_allocations',
      'credit_ledger_entries',
      'reminder_settings'
    ];
    const storeKeys = Object.values(DB.stores);
    assert(
      expectedStores.every(s => storeKeys.includes(s)),
      'All 9 required object stores are defined in the schema'
    );

    // Business Settings
    const biz = await DB.business.get();
    assert(biz && biz.name === 'Shah Traders', 'Business initialized as "Shah Traders"');
    assert(biz.currency === 'PKR', 'Currency is PKR');
    assert(biz.id === 'biz_shah_traders', 'Business ID is biz_shah_traders');

    // ----------------------------------------------------
    // Section 2: Mathematical Reconciliation of Seeded Dataset (Requirement 10 & 11)
    // ----------------------------------------------------
    const customers = await DB.customers.getAll();
    assert(customers.length === 6, `Initial seeded customers count is 6 (found ${customers.length})`);

    const invoices = await DB.invoices.getAll();
    assert(invoices.length === 11, `Initial seeded invoices count is 11 across all customers (found ${invoices.length})`);

    const payments = await DB.payments.getAll();
    assert(payments.length === 6, `Initial seeded payments count is 6 (found ${payments.length})`);

    const allocations = await DB.getAllocations ? await DB.getAllocations() : await (async () => {
      let allAlloc = [];
      for (const p of payments) {
        const allocs = await DB.payments.getAllocations(p.id);
        allAlloc = allAlloc.concat(allocs);
      }
      return allAlloc;
    })();
    assert(allocations.length === 6, `Initial seeded allocations count is 6 (found ${allocations.length})`);

    const ledger = await DB.ledger.getAll();
    assert(ledger.length === 17, `Initial ledger entries count is 17 (found ${ledger.length})`);

    // Verify mathematical reconciliation for EVERY customer:
    // sum(invoices.total_paisa) === customer.total_invoiced_paisa
    // sum(payments.amount_paisa) === customer.total_paid_paisa
    // sum(invoices.balance_due_paisa) === customer.balance_due_paisa
    // customer.total_invoiced_paisa - customer.total_paid_paisa === customer.balance_due_paisa
    // sum(ledger.debit) - sum(ledger.credit) === customer.balance_due_paisa
    for (const cust of customers) {
      const custInvoices = invoices.filter(inv => inv.customer_id === cust.id);
      const custPayments = payments.filter(p => p.customer_id === cust.id);
      const custLedger = ledger.filter(l => l.customer_id === cust.id);

      const sumInvTotal = custInvoices.reduce((acc, inv) => acc + inv.total_paisa, 0);
      const sumInvBalance = custInvoices.reduce((acc, inv) => acc + inv.balance_due_paisa, 0);
      const sumPayTotal = custPayments.reduce((acc, p) => acc + p.amount_paisa, 0);
      const sumDebits = custLedger.reduce((acc, l) => acc + l.debit_paisa, 0);
      const sumCredits = custLedger.reduce((acc, l) => acc + l.credit_paisa, 0);

      assert(
        cust.total_invoiced_paisa === sumInvTotal,
        `Customer [${cust.name}] total_invoiced_paisa (${cust.total_invoiced_paisa}) matches sum of invoices (${sumInvTotal})`
      );
      assert(
        cust.total_paid_paisa === sumPayTotal,
        `Customer [${cust.name}] total_paid_paisa (${cust.total_paid_paisa}) matches sum of payments (${sumPayTotal})`
      );
      assert(
        cust.balance_due_paisa === sumInvBalance,
        `Customer [${cust.name}] balance_due_paisa (${cust.balance_due_paisa}) matches sum of invoice balances (${sumInvBalance})`
      );
      assert(
        cust.total_invoiced_paisa - cust.total_paid_paisa === cust.balance_due_paisa,
        `Customer [${cust.name}] balance equation holds (invoiced - paid === balance_due)`
      );
      assert(
        sumDebits - sumCredits === cust.balance_due_paisa,
        `Customer [${cust.name}] ledger debits minus credits (${sumDebits - sumCredits}) matches balance due (${cust.balance_due_paisa})`
      );
    }

    // Verify every seeded invoice's line items and status fields
    for (const inv of invoices) {
      const items = await DB.invoices.getItems(inv.id);
      const sumItems = items.reduce((acc, it) => acc + it.amount_paisa, 0);
      assert(
        sumItems === inv.subtotal_paisa,
        `Invoice ${inv.invoice_number} line items sum (${sumItems}) matches subtotal (${inv.subtotal_paisa})`
      );
      assert(
        inv.total_paisa === inv.subtotal_paisa - inv.discount_paisa + inv.tax_paisa,
        `Invoice ${inv.invoice_number} total calculation holds (subtotal - discount + tax)`
      );
      assert(
        inv.total_paisa === inv.paid_paisa + inv.balance_due_paisa,
        `Invoice ${inv.invoice_number} balance calculation holds (total === paid + balance_due)`
      );
      assert(
        ['PAID', 'PARTIAL', 'UNPAID'].includes(inv.payment_status),
        `Invoice ${inv.invoice_number} has valid payment_status: ${inv.payment_status}`
      );
      assert(
        ['OVERDUE', 'DUE_SOON', 'CURRENT'].includes(inv.due_status),
        `Invoice ${inv.invoice_number} has valid due_status: ${inv.due_status}`
      );
    }

    // Requirement 11: Unconfigured automatic reminders disabled by default
    const reminders = await DB.reminders.get();
    assert(
      reminders && reminders.auto_reminders_enabled === false,
      'Requirement 11: Unconfigured automatic reminders disabled by default (auto_reminders_enabled: false)'
    );

    // ----------------------------------------------------
    // Section 3: Regression Test 1 — Incorrect Invoice Totals
    // ----------------------------------------------------
    let invoiceTotalMismatchRejected = false;
    try {
      await DB.invoices.create({
        customer_id: 'cust_zeeshan_elec',
        total_paisa: 9999999 // Intentionally mismatching supplied total
      }, [
        {
          item_description: 'Chakki Atta Flour (20kg)',
          quantity: 2,
          unit: '20kg Bag',
          unit_price_paisa: 240000 // 2 * 240,000 = 480,000
        }
      ]);
    } catch (e) {
      invoiceTotalMismatchRejected = true;
      assert(
        e.message.includes('Invoice total mismatch') || e.message.includes('total'),
        `Regression 1: Incorrect invoice total properly rejected with message: "${e.message}"`
      );
    }
    assert(invoiceTotalMismatchRejected, 'Regression 1: Creating invoice with mismatched total was rejected');

    // Also test Line Item quantity and price validations
    let badLineItemRejected = false;
    try {
      await DB.invoices.create({
        customer_id: 'cust_zeeshan_elec'
      }, [
        {
          item_description: 'Bad item',
          quantity: -3,
          unit_price_paisa: 100000
        }
      ]);
    } catch (e) {
      badLineItemRejected = true;
    }
    assert(badLineItemRejected, 'Regression 1b: Line item with negative quantity rejected');

    // ----------------------------------------------------
    // Section 4: Regression Test 2 — Negative or Zero Payment Amounts
    // ----------------------------------------------------
    let negativePaymentRejected = false;
    try {
      await DB.payments.create({
        customer_id: 'cust_zeeshan_elec',
        amount_paisa: -500000
      });
    } catch (e) {
      negativePaymentRejected = true;
      assert(
        e.message.includes('positive safe integer'),
        `Regression 2: Negative payment rejected with message: "${e.message}"`
      );
    }
    assert(negativePaymentRejected, 'Regression 2: Negative payment was rejected');

    let zeroPaymentRejected = false;
    try {
      await DB.payments.create({
        customer_id: 'cust_zeeshan_elec',
        amount_paisa: 0
      });
    } catch (e) {
      zeroPaymentRejected = true;
    }
    assert(zeroPaymentRejected, 'Regression 2b: Zero payment was rejected');

    // ----------------------------------------------------
    // Section 5: Regression Test 3 — Overpayment on Invoice (allocation > balance_due)
    // ----------------------------------------------------
    const targetInvoice = await DB.invoices.getById('inv_2026_1048'); // Zeeshan, balance 28,000,000
    let overpaymentRejected = false;
    try {
      await DB.payments.create({
        customer_id: 'cust_zeeshan_elec',
        amount_paisa: 50000000 // Payment is 50,000,000 paisa
      }, [
        {
          invoice_id: targetInvoice.id,
          allocated_amount_paisa: 35000000 // Exceeds 28,000,000 balance!
        }
      ]);
    } catch (e) {
      overpaymentRejected = true;
      assert(
        e.message.includes('exceeds outstanding balance') || e.message.includes('Overpayment rejected'),
        `Regression 3: Overpayment rejected with message: "${e.message}"`
      );
    }
    assert(overpaymentRejected, 'Regression 3: Overpayment exceeding invoice balance was rejected');

    // ----------------------------------------------------
    // Section 6: Regression Test 4 — Allocation Totals Exceeding Payment Amount
    // ----------------------------------------------------
    let allocationExceedingPaymentRejected = false;
    try {
      await DB.payments.create({
        customer_id: 'cust_zeeshan_elec',
        amount_paisa: 10000000 // 10,000,000 paisa
      }, [
        {
          invoice_id: targetInvoice.id,
          allocated_amount_paisa: 15000000 // Allocates 15,000,000 paisa
        }
      ]);
    } catch (e) {
      allocationExceedingPaymentRejected = true;
      assert(
        e.message.includes('exceeds the payment amount') || e.message.includes('exceeds payment'),
        `Regression 4: Allocations exceeding payment amount rejected with message: "${e.message}"`
      );
    }
    assert(allocationExceedingPaymentRejected, 'Regression 4: Allocation exceeding payment amount was rejected');

    // ----------------------------------------------------
    // Section 7: Regression Test 5 — Payments Applied to Another Customer's Invoice
    // ----------------------------------------------------
    // Invoice 'inv_2026_0142' belongs to 'cust_al_hamza'
    let crossCustomerAllocationRejected = false;
    try {
      await DB.payments.create({
        customer_id: 'cust_zeeshan_elec', // Zeeshan is paying
        amount_paisa: 10000000
      }, [
        {
          invoice_id: 'inv_2026_0142', // But invoice belongs to Al-Hamza!
          allocated_amount_paisa: 10000000
        }
      ]);
    } catch (e) {
      crossCustomerAllocationRejected = true;
      assert(
        e.message.includes('Cross-customer allocations are strictly rejected') || e.message.includes('belongs to customer'),
        `Regression 5: Cross-customer allocation rejected with message: "${e.message}"`
      );
    }
    assert(crossCustomerAllocationRejected, 'Regression 5: Cross-customer payment allocation was rejected');

    // ----------------------------------------------------
    // Section 8: Regression Test 6 — Missing Customer ID and Missing Invoice ID
    // ----------------------------------------------------
    let missingCustomerRejected = false;
    try {
      await DB.invoices.create({
        customer_id: '',
        total_paisa: 100000
      }, [
        { item_description: 'Test', quantity: 1, unit_price_paisa: 100000 }
      ]);
    } catch (e) {
      missingCustomerRejected = true;
    }
    assert(missingCustomerRejected, 'Regression 6a: Missing customer_id on invoice creation was rejected');

    let nonExistentCustomerRejected = false;
    try {
      await DB.invoices.create({
        customer_id: 'cust_does_not_exist',
        total_paisa: 100000
      }, [
        { item_description: 'Test', quantity: 1, unit_price_paisa: 100000 }
      ]);
    } catch (e) {
      nonExistentCustomerRejected = true;
    }
    assert(nonExistentCustomerRejected, 'Regression 6b: Non-existent customer_id was rejected in invoice transaction');

    let missingInvoiceIdInAllocRejected = false;
    try {
      await DB.payments.create({
        customer_id: 'cust_zeeshan_elec',
        amount_paisa: 1000000
      }, [
        {
          invoice_id: '',
          allocated_amount_paisa: 1000000
        }
      ]);
    } catch (e) {
      missingInvoiceIdInAllocRejected = true;
    }
    assert(missingInvoiceIdInAllocRejected, 'Regression 6c: Missing invoice_id in payment allocation was rejected');

    let nonExistentInvoiceInAllocRejected = false;
    try {
      await DB.payments.create({
        customer_id: 'cust_zeeshan_elec',
        amount_paisa: 1000000
      }, [
        {
          invoice_id: 'inv_non_existent',
          allocated_amount_paisa: 1000000
        }
      ]);
    } catch (e) {
      nonExistentInvoiceInAllocRejected = true;
    }
    assert(nonExistentInvoiceInAllocRejected, 'Regression 6d: Non-existent invoice in payment allocation was rejected');

    // ----------------------------------------------------
    // Section 9: Regression Test 7 — Duplicate Invoice and Payment Numbers
    // ----------------------------------------------------
    let duplicateInvoiceNumberRejected = false;
    try {
      await DB.invoices.create({
        customer_id: 'cust_zeeshan_elec',
        invoice_number: 'INV-2026-1048' // Existing invoice number!
      }, [
        { item_description: 'Test', quantity: 1, unit_price_paisa: 500000 }
      ]);
    } catch (e) {
      duplicateInvoiceNumberRejected = true;
      assert(
        e.message.includes('already exists') || e.message.includes('Duplicate'),
        `Regression 7: Duplicate invoice number rejected with message: "${e.message}"`
      );
    }
    assert(duplicateInvoiceNumberRejected, 'Regression 7: Duplicate invoice number was rejected');

    let duplicatePaymentNumberRejected = false;
    try {
      await DB.payments.create({
        customer_id: 'cust_zeeshan_elec',
        payment_number: 'PAY-2026-0001', // Existing payment number!
        amount_paisa: 1000000
      });
    } catch (e) {
      duplicatePaymentNumberRejected = true;
    }
    assert(duplicatePaymentNumberRejected, 'Regression 7b: Duplicate payment number was rejected');

    // Verify sequential invoice numbering works automatically when not specified
    const createdAutoSeqInv = await DB.invoices.create({
      customer_id: 'cust_zeeshan_elec',
      issue_date: '2026-10-29',
      due_date: '2026-11-12'
    }, [
      {
        item_description: 'Cooking Oil',
        quantity: 5,
        unit: '16L Tin',
        unit_price_paisa: 820000 // 4,100,000 paisa
      }
    ]);
    assert(
      createdAutoSeqInv.invoice_number === 'INV-2026-1050',
      `Auto sequential invoice numbering generated collision-free number: ${createdAutoSeqInv.invoice_number}`
    );

    // ----------------------------------------------------
    // Section 10: Regression Test 8 — Invalid JSON Backup Rejection
    // ----------------------------------------------------
    let invalidBackupsRejected = 0;
    try {
      await DB.backup.importJSON('<<<not-valid-json>>>');
    } catch (e) { invalidBackupsRejected++; }

    try {
      await DB.backup.importJSON({ app: 'WrongApp', schema_version: 1, data: {} });
    } catch (e) { invalidBackupsRejected++; }

    try {
      await DB.backup.importJSON({ app: 'CreditFlow', schema_version: 99, data: {} });
    } catch (e) { invalidBackupsRejected++; }

    try {
      await DB.backup.importJSON({ app: 'CreditFlow', schema_version: 1, data: { customers: 'not-an-array' } });
    } catch (e) { invalidBackupsRejected++; }

    assert(invalidBackupsRejected === 4, `Regression 8: All 4 invalid backup structures rejected (${invalidBackupsRejected}/4)`);

    // ----------------------------------------------------
    // Section 11: Regression Test 9 — Broken Backup Foreign Key Relationships
    // ----------------------------------------------------
    const validBackup = await DB.backup.exportJSON();

    // 9a: Backup with invoice referencing non-existent customer
    const corruptedBackup1 = JSON.parse(JSON.stringify(validBackup));
    corruptedBackup1.data.invoices.push({
      id: 'inv_corrupt_1',
      invoice_number: 'INV-2026-9999',
      customer_id: 'cust_non_existent',
      total_paisa: 100000,
      paid_paisa: 0,
      balance_due_paisa: 100000
    });
    let brokenCustomerFkRejected = false;
    try {
      await DB.backup.importJSON(corruptedBackup1);
    } catch (e) {
      brokenCustomerFkRejected = true;
      assert(
        e.message.includes('non-existent customer') || e.message.includes('foreign key'),
        `Regression 9a: Broken customer foreign key rejected: "${e.message}"`
      );
    }
    assert(brokenCustomerFkRejected, 'Regression 9a: Broken invoice->customer FK in backup rejected');

    // 9b: Backup with allocation referencing invoice for a different customer
    const corruptedBackup2 = JSON.parse(JSON.stringify(validBackup));
    corruptedBackup2.data.payments.push({
      id: 'pay_corrupt_2',
      payment_number: 'PAY-2026-9999',
      customer_id: 'cust_zeeshan_elec',
      amount_paisa: 1000000
    });
    corruptedBackup2.data.payment_allocations.push({
      id: 'alloc_corrupt_2',
      payment_id: 'pay_corrupt_2',
      invoice_id: 'inv_2026_0142', // belongs to cust_al_hamza
      allocated_amount_paisa: 1000000
    });
    let crossCustomerBackupRejected = false;
    try {
      await DB.backup.importJSON(corruptedBackup2);
    } catch (e) {
      crossCustomerBackupRejected = true;
      assert(
        e.message.includes('relational conflict') || e.message.includes('customer'),
        `Regression 9b: Cross-customer backup allocation rejected: "${e.message}"`
      );
    }
    assert(crossCustomerBackupRejected, 'Regression 9b: Cross-customer allocation in backup rejected');

    // ----------------------------------------------------
    // Section 12: Regression Test 10 — Atomic Transaction Rollback Verification
    // ----------------------------------------------------
    // Ensure that when an operation fails inside a multi-store transaction,
    // NO partial records remain written to the database.
    const preZeeshan = await DB.customers.getById('cust_zeeshan_elec');
    const preInvoicesCount = (await DB.invoices.getAll()).length;
    const prePaymentsCount = (await DB.payments.getAll()).length;
    const preLedgerCount = (await DB.ledger.getAll()).length;

    let failedPaymentThrew = false;
    try {
      await DB.payments.create({
        customer_id: 'cust_zeeshan_elec',
        amount_paisa: 1000000
      }, [
        {
          invoice_id: 'inv_2026_1048',
          allocated_amount_paisa: 999999999 // Deliberately huge overpayment error
        }
      ]);
    } catch (e) {
      failedPaymentThrew = true;
    }
    assert(failedPaymentThrew, 'Transaction failure properly raised exception');

    const postZeeshan = await DB.customers.getById('cust_zeeshan_elec');
    const postInvoicesCount = (await DB.invoices.getAll()).length;
    const postPaymentsCount = (await DB.payments.getAll()).length;
    const postLedgerCount = (await DB.ledger.getAll()).length;

    assert(
      postZeeshan.balance_due_paisa === preZeeshan.balance_due_paisa,
      `Regression 10: Customer balance untouched after aborted transaction (${postZeeshan.balance_due_paisa} === ${preZeeshan.balance_due_paisa})`
    );
    assert(
      postPaymentsCount === prePaymentsCount,
      `Regression 10: No orphan payment written to payments store (${postPaymentsCount} === ${prePaymentsCount})`
    );
    assert(
      postLedgerCount === preLedgerCount,
      `Regression 10: No orphan credit ledger entry written (${postLedgerCount} === ${preLedgerCount})`
    );

    // ----------------------------------------------------
    // Section 13: Protected Customer Financial Fields (Requirement 13)
    // ----------------------------------------------------
    const zeeshanBeforeDirectUpdate = await DB.customers.getById('cust_zeeshan_elec');
    await DB.customers.update('cust_zeeshan_elec', {
      city: 'Rawalpindi', // Legitimate field
      balance_due_paisa: 0, // Protected field: MUST BE STRIPPED
      total_invoiced_paisa: 9999999, // Protected field: MUST BE STRIPPED
      total_paid_paisa: 8888888 // Protected field: MUST BE STRIPPED
    });
    const zeeshanAfterDirectUpdate = await DB.customers.getById('cust_zeeshan_elec');
    assert(
      zeeshanAfterDirectUpdate.city === 'Rawalpindi',
      'Non-protected field (city) was updated successfully'
    );
    assert(
      zeeshanAfterDirectUpdate.balance_due_paisa === zeeshanBeforeDirectUpdate.balance_due_paisa,
      'Requirement 13: balance_due_paisa was protected from direct arbitrary modification'
    );
    assert(
      zeeshanAfterDirectUpdate.total_invoiced_paisa === zeeshanBeforeDirectUpdate.total_invoiced_paisa,
      'Requirement 13: total_invoiced_paisa was protected from direct arbitrary modification'
    );
    assert(
      zeeshanAfterDirectUpdate.total_paid_paisa === zeeshanBeforeDirectUpdate.total_paid_paisa,
      'Requirement 13: total_paid_paisa was protected from direct arbitrary modification'
    );

    // ----------------------------------------------------
    // Section 14: Valid Payment Recording & Full Allocation Workflow
    // ----------------------------------------------------
    const recordedPayment = await DB.payments.create({
      customer_id: 'cust_zeeshan_elec',
      amount_paisa: 4100000,
      payment_method: 'Raast',
      reference_number: 'RAAST-8839210'
    }, [
      {
        invoice_id: createdAutoSeqInv.id,
        allocated_amount_paisa: 4100000
      }
    ]);
    assert(recordedPayment && recordedPayment.payment_number, `Payment recorded with sequential number: ${recordedPayment.payment_number}`);

    const verifiedInvoice = await DB.invoices.getById(createdAutoSeqInv.id);
    assert(verifiedInvoice.payment_status === 'PAID', `Invoice payment_status transitioned to 'PAID' (value: ${verifiedInvoice.payment_status})`);
    assert(verifiedInvoice.status === 'Paid', `Invoice display status is 'Paid' (value: ${verifiedInvoice.status})`);
    assert(verifiedInvoice.balance_due_paisa === 0, 'Invoice balance due is 0 paisa');

    // ----------------------------------------------------
    // Section 15: Valid Backup Export & Clean Restore
    // ----------------------------------------------------
    const exportedBackup = await DB.backup.exportJSON();
    assert(exportedBackup.app === 'CreditFlow', 'Exported backup contains app "CreditFlow"');
    const restoreResult = await DB.backup.importJSON(exportedBackup);
    assert(restoreResult.success === true, 'Backup successfully validated and restored');

    // ----------------------------------------------------
    // Section 16: Phase 7 — Create Invoice & Draft Integrity Tests
    // ----------------------------------------------------
    console.log('\n--- Running Phase 7 Create Invoice & Draft Integrity Tests ---');

    // 16.1: getNextInvoiceNumber returns sequential number
    const nextSeqNum = await DB.invoices.getNextInvoiceNumber('2026-10-29');
    assert(typeof nextSeqNum === 'string' && nextSeqNum.startsWith('INV-2026-'), `Generated next sequence number: ${nextSeqNum}`);

    // 16.2: Save Draft Invoice does NOT increase receivables
    const customerPreDraft = await DB.customers.getById('cust_al_hamza');
    const preDraftInvoiced = customerPreDraft.total_invoiced_paisa;
    const preDraftBalance = customerPreDraft.balance_due_paisa;
    const preDraftLedger = await DB.ledger.getByCustomerId('cust_al_hamza');

    const draftInvoice = await DB.invoices.saveDraft({
      customer_id: 'cust_al_hamza',
      issue_date: '2026-10-29',
      due_date: '2026-11-14',
      subtotal_paisa: 15000000, // PKR 150,000
      discount_paisa: 1000000,  // PKR 10,000
      tax_paisa: 0,
      total_paisa: 14000000,    // PKR 140,000
      reference: 'DRAFT-PO-01',
      notes: 'Draft order for review.'
    }, [
      {
        item_description: 'Split AC 1.5 Ton',
        quantity: 2,
        unit: 'Unit',
        unit_price_paisa: 7500000,
        amount_paisa: 15000000
      }
    ]);

    assert(draftInvoice.is_draft === true, 'Draft invoice has is_draft === true');
    assert(draftInvoice.status === 'Draft', 'Draft invoice status is "Draft"');
    assert(draftInvoice.payment_status === 'DRAFT', 'Draft invoice payment_status is "DRAFT"');
    assert(draftInvoice.balance_due_paisa === 0, 'Draft invoice has 0 balance due in receivables');

    // Verify customer balance was NOT altered by draft
    const customerPostDraft = await DB.customers.getById('cust_al_hamza');
    assert(customerPostDraft.total_invoiced_paisa === preDraftInvoiced, 'Customer total_invoiced_paisa unchanged by draft');
    assert(customerPostDraft.balance_due_paisa === preDraftBalance, 'Customer balance_due_paisa unchanged by draft');

    // Verify ledger has no entries added for draft
    const postDraftLedger = await DB.ledger.getByCustomerId('cust_al_hamza');
    assert(postDraftLedger.length === preDraftLedger.length, 'No credit ledger entry created for draft invoice');

    // Verify draft line items exist
    const draftItems = await DB.invoices.getItems(draftInvoice.id);
    assert(draftItems.length === 1, `Draft line items persisted in store (found ${draftItems.length})`);
    assert(draftItems[0].amount_paisa === 15000000, 'Draft line item amount correctly matches');

    // 16.3: Issue Real Invoice atomically increases receivables
    const issuedInvoice = await DB.invoices.create({
      customer_id: 'cust_al_hamza',
      issue_date: '2026-10-29',
      due_date: '2026-11-12',
      subtotal_paisa: 16500000, // PKR 165,000
      discount_paisa: 0,
      tax_paisa: 0,
      total_paisa: 16500000,
      reference: 'PO-2026-99',
      notes: 'Official issued shipment.'
    }, [
      {
        item_description: 'Split AC 1.5 Ton',
        quantity: 2,
        unit: 'Unit',
        unit_price_paisa: 7500000,
        amount_paisa: 15000000
      },
      {
        item_description: 'Installation Service',
        quantity: 2,
        unit: 'Trip',
        unit_price_paisa: 500000,
        amount_paisa: 1000000
      },
      {
        item_description: 'Wall Bracket',
        quantity: 2,
        unit: 'Unit',
        unit_price_paisa: 250000,
        amount_paisa: 500000
      }
    ]);

    assert(issuedInvoice.is_draft === false, 'Issued invoice is_draft is false');
    assert(issuedInvoice.payment_status === 'UNPAID', 'Issued invoice payment_status is "UNPAID"');
    assert(issuedInvoice.paid_paisa === 0, 'Issued invoice paid_paisa is 0');
    assert(issuedInvoice.balance_due_paisa === 16500000, 'Issued invoice balance_due_paisa matches total');

    // Verify customer balance was increased by issued invoice
    const customerPostIssue = await DB.customers.getById('cust_al_hamza');
    assert(
      customerPostIssue.total_invoiced_paisa === preDraftInvoiced + 16500000,
      `Customer total_invoiced_paisa increased by issued total (${customerPostIssue.total_invoiced_paisa})`
    );
    assert(
      customerPostIssue.balance_due_paisa === preDraftBalance + 16500000,
      `Customer balance_due_paisa increased by issued total (${customerPostIssue.balance_due_paisa})`
    );

    // Verify ledger has debit entry
    const postIssueLedger = await DB.ledger.getByCustomerId('cust_al_hamza');
    assert(postIssueLedger.length === preDraftLedger.length + 1, 'Credit ledger has exactly 1 new entry');
    const latestLedgerEntry = postIssueLedger[postIssueLedger.length - 1];
    assert(latestLedgerEntry.debit_paisa === 16500000, `Ledger entry debit matches invoice total (16,500,000)`);
    assert(latestLedgerEntry.reference_number === issuedInvoice.invoice_number, 'Ledger entry references issued invoice number');

    // 16.4: Product price catalog mutation does NOT alter previously issued invoices
    const targetProduct = (await DB.products.getAll())[0];
    const originalPrice = targetProduct.price_paisa;
    await DB.products.update(targetProduct.id, { price_paisa: originalPrice * 2 });

    const verifiedIssuedInvoice = await DB.invoices.getById(issuedInvoice.id);
    assert(verifiedIssuedInvoice.total_paisa === 16500000, 'Issued invoice total unaffected by catalog price change');
    const verifiedIssuedItems = await DB.invoices.getItems(issuedInvoice.id);
    assert(verifiedIssuedItems[0].unit_price_paisa === 7500000, 'Issued line item unit price snapshot unaffected by catalog price change');

    // Revert product price
    await DB.products.update(targetProduct.id, { price_paisa: originalPrice });

    // 16.5: Validation Edge Cases
    // Reject due date before issue date
    try {
      await DB.invoices.create({
        customer_id: 'cust_al_hamza',
        issue_date: '2026-10-29',
        due_date: '2026-10-10', // earlier!
        subtotal_paisa: 500000,
        total_paisa: 500000
      }, [{ item_description: 'Test', quantity: 1, unit_price_paisa: 500000, amount_paisa: 500000 }]);
      assert(false, 'Should have rejected due date earlier than issue date');
    } catch (e) {
      assert(true, 'Due date earlier than issue date properly rejected');
    }

    // Reject duplicate invoice number
    try {
      await DB.invoices.create({
        customer_id: 'cust_al_hamza',
        invoice_number: issuedInvoice.invoice_number, // duplicate!
        issue_date: '2026-10-29',
        due_date: '2026-11-12',
        subtotal_paisa: 500000,
        total_paisa: 500000
      }, [{ item_description: 'Test', quantity: 1, unit_price_paisa: 500000, amount_paisa: 500000 }]);
      assert(false, 'Should have rejected duplicate invoice number');
    } catch (e) {
      assert(true, 'Duplicate invoice number properly rejected');
    }

  } catch (err) {
    console.error('UNEXPECTED TEST ERROR:', err);
    failed++;
  }

  console.log(`\n=== FINAL TEST RESULTS: ${passed} PASSED, ${failed} FAILED ===\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
