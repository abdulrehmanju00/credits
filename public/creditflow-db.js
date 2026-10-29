/**
 * CreditFlow - Hardened IndexedDB Local Storage Layer
 * Financial Integrity Engine & Backup System for Demo Business (Shah Traders)
 * 
 * Strict Financial Integrity:
 * - All monetary amounts are stored and validated as integer paisa (1 PKR = 100 paisa)
 * - Invoice totals strictly calculated from line items, quantities, unit prices, discounts, and taxes
 * - Sequential collision-free invoice (INV-YYYY-XXXX) and payment (PAY-YYYY-XXXX) numbering
 * - Explicit payment allocations: prevents overpayment and cross-customer allocations
 * - Separate payment_status (UNPAID/PARTIAL/PAID) from due_status (OVERDUE/DUE_SOON/CURRENT)
 * - Atomic transactions with guaranteed rollback and clean Promise rejection on failure
 * - Protected customer financial balances (total_invoiced, total_paid, balance_due)
 * - Comprehensive deep validation of backup archives before replacement
 * - 100% mathematically reconciled seeded dataset down to the single paisa
 */

(function(root) {
  'use strict';

  const DB_NAME = 'CreditFlowDB';
  const DB_VERSION = 1;
  const BUSINESS_ID = 'biz_shah_traders';

  // Collection Store Names
  const STORES = {
    BUSINESS: 'business_settings',
    CUSTOMERS: 'customers',
    PRODUCTS: 'products_services',
    INVOICES: 'invoices',
    INVOICE_ITEMS: 'invoice_items',
    PAYMENTS: 'payments',
    ALLOCATIONS: 'payment_allocations',
    LEDGER: 'credit_ledger_entries',
    REMINDERS: 'reminder_settings'
  };

  // --- Financial & Validation Utility Functions ---
  const utils = {
    rupeesToPaisa(rupees) {
      if (typeof rupees === 'string') {
        rupees = parseFloat(rupees.replace(/[^0-9.-]/g, '')) || 0;
      }
      return Math.round((Number(rupees) || 0) * 100);
    },

    paisaToRupees(paisa) {
      return (Number(paisa) || 0) / 100;
    },

    formatPKR(paisa, includePrefix = true) {
      const rs = (Number(paisa) || 0) / 100;
      const formatted = rs.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      });
      return includePrefix ? `PKR ${formatted}` : formatted;
    },

    generateId(prefix = 'id') {
      const timestamp = Date.now().toString(36);
      const random = Math.random().toString(36).substring(2, 8);
      return `${prefix}_${timestamp}_${random}`;
    },

    isSafePositiveInteger(val) {
      return Number.isSafeInteger(val) && val > 0;
    },

    isSafeNonNegativeInteger(val) {
      return Number.isSafeInteger(val) && val >= 0;
    },

    validatePositiveIntegerPaisa(val, fieldName) {
      if (!this.isSafePositiveInteger(val)) {
        throw new Error(`${fieldName} must be a positive safe integer paisa amount (received ${val})`);
      }
    },

    validateNonNegativeIntegerPaisa(val, fieldName) {
      if (!this.isSafeNonNegativeInteger(val)) {
        throw new Error(`${fieldName} must be a non-negative safe integer paisa amount (received ${val})`);
      }
    },

    validateDateString(val, fieldName) {
      if (typeof val !== 'string' || !val.trim() || isNaN(Date.parse(val))) {
        throw new Error(`${fieldName} must be a valid date string (received "${val}")`);
      }
    },

    computeLineItemAmount(quantity, unitPricePaisa) {
      if (typeof quantity !== 'number' || isNaN(quantity) || quantity <= 0) {
        throw new Error(`Quantity must be a positive number (received ${quantity})`);
      }
      if (!this.isSafeNonNegativeInteger(unitPricePaisa)) {
        throw new Error(`Unit price must be a non-negative integer paisa amount (received ${unitPricePaisa})`);
      }
      return Math.round(quantity * unitPricePaisa);
    },

    computePaymentStatus(totalPaisa, paidPaisa) {
      if (paidPaisa >= totalPaisa) return 'PAID';
      if (paidPaisa > 0) return 'PARTIAL';
      return 'UNPAID';
    },

    computeDueStatus(dueDateStr, currentDateStr = new Date().toISOString().split('T')[0]) {
      if (!dueDateStr) return 'CURRENT';
      if (dueDateStr < currentDateStr) return 'OVERDUE';
      const dueTime = new Date(dueDateStr).getTime();
      const currTime = new Date(currentDateStr).getTime();
      const diffDays = Math.ceil((dueTime - currTime) / (1000 * 60 * 60 * 24));
      if (diffDays <= 7) return 'DUE_SOON';
      return 'CURRENT';
    },

    computeDisplayStatus(paymentStatus, dueStatus) {
      if (paymentStatus === 'PAID') return 'Paid';
      if (paymentStatus === 'PARTIAL') return 'Partial';
      if (dueStatus === 'OVERDUE') return 'Overdue';
      if (dueStatus === 'DUE_SOON') return 'Due Soon';
      return 'Current';
    }
  };

  // --- Initial Fully Reconciled Fictional Demo Dataset for Shah Traders ---
  const initialDemoData = {
    business: {
      id: BUSINESS_ID,
      name: 'Shah Traders',
      owner_name: 'Ali Shah',
      email: 'info@shahtraders.pk',
      phone: '0321 1234567',
      address: "Shop # 8, Queen's Road, Abid Market, Lahore, Punjab 54000",
      city: 'Lahore',
      currency: 'PKR',
      tax_number: '1234567-8',
      footer_notes: 'Thank you for your business.\nFor any queries, please contact us.',
      created_at: '2026-09-01T08:00:00.000Z',
      updated_at: '2026-10-28T10:00:00.000Z'
    },
    customers: [
      {
        id: 'cust_karachi_fresh',
        business_id: BUSINESS_ID,
        name: 'Karachi Fresh Mart',
        initials: 'KF',
        city: 'Karachi',
        category: 'Retail Store',
        phone: '0321 4457788',
        email: 'orders@karachifreshmart.pk',
        status: 'Overdue',
        credit_limit_paisa: 60000000, // PKR 600,000
        total_invoiced_paisa: 48000000, // PKR 480,000
        total_paid_paisa: 14000000, // PKR 140,000
        balance_due_paisa: 34000000, // PKR 340,000
        created_at: '2026-09-05T09:00:00.000Z',
        updated_at: '2026-10-22T14:30:00.000Z'
      },
      {
        id: 'cust_zeeshan_elec',
        business_id: BUSINESS_ID,
        name: 'Zeeshan Electronics',
        initials: 'ZE',
        city: 'Lahore',
        category: 'Electronics Retailer',
        phone: '0300 1122334',
        email: 'zeeshan.elec@gmail.com',
        status: 'Overdue',
        credit_limit_paisa: 50000000, // PKR 500,000
        total_invoiced_paisa: 28000000, // PKR 280,000
        total_paid_paisa: 0,
        balance_due_paisa: 28000000, // PKR 280,000
        created_at: '2026-09-10T10:00:00.000Z',
        updated_at: '2026-10-20T11:15:00.000Z'
      },
      {
        id: 'cust_al_rehman',
        business_id: BUSINESS_ID,
        name: 'Al Rehman General Store',
        initials: 'AR',
        city: 'Faisalabad',
        category: 'General Store',
        phone: '0345 6789012',
        email: 'rehman.store.fsd@hotmail.com',
        status: 'Due Soon',
        credit_limit_paisa: 30000000, // PKR 300,000
        total_invoiced_paisa: 18000000, // PKR 180,000
        total_paid_paisa: 9000000, // PKR 90,000
        balance_due_paisa: 9000000, // PKR 90,000
        created_at: '2026-09-15T11:00:00.000Z',
        updated_at: '2026-10-15T16:00:00.000Z'
      },
      {
        id: 'cust_babar_sons',
        business_id: BUSINESS_ID,
        name: 'Babar & Sons Wholesale',
        initials: 'BS',
        city: 'Multan',
        category: 'Wholesaler',
        phone: '0306 3344556',
        email: 'babar.wholesale@gmail.com',
        status: 'Paid',
        credit_limit_paisa: 50000000, // PKR 500,000
        total_invoiced_paisa: 34000000, // PKR 340,000
        total_paid_paisa: 34000000, // PKR 340,000
        balance_due_paisa: 0,
        created_at: '2026-09-18T12:00:00.000Z',
        updated_at: '2026-10-24T10:00:00.000Z'
      },
      {
        id: 'cust_noor_med',
        business_id: BUSINESS_ID,
        name: 'Noor Medical Store',
        initials: 'NM',
        city: 'Islamabad',
        category: 'Pharmacy',
        phone: '0312 9988776',
        email: 'noormedical.isb@gmail.com',
        status: 'Due Soon',
        credit_limit_paisa: 25000000, // PKR 250,000
        total_invoiced_paisa: 15000000, // PKR 150,000
        total_paid_paisa: 7500000, // PKR 75,000
        balance_due_paisa: 7500000, // PKR 75,000
        created_at: '2026-09-20T14:00:00.000Z',
        updated_at: '2026-10-18T09:45:00.000Z'
      },
      {
        id: 'cust_al_hamza',
        business_id: BUSINESS_ID,
        name: 'Al-Hamza Traders',
        initials: 'AT',
        city: 'Karachi',
        category: 'Retail Store',
        phone: '0321 9876543',
        email: 'alhamzatraders@gmail.com',
        status: 'Overdue',
        credit_limit_paisa: 80000000, // PKR 800,000
        total_invoiced_paisa: 62000000, // PKR 620,000
        total_paid_paisa: 24000000, // PKR 240,000
        balance_due_paisa: 38000000, // PKR 380,000
        created_at: '2026-08-25T10:00:00.000Z',
        updated_at: '2026-10-12T13:00:00.000Z'
      }
    ],
    products: [
      {
        id: 'prd_gree_ac',
        business_id: BUSINESS_ID,
        name: 'Gree Pular T3 1.5 Ton AC',
        description: 'Gree Pular T3 1.5 Ton DC Inverter Air Conditioner',
        sku: 'PRD-001',
        type: 'product',
        unit: 'Unit',
        price_paisa: 17500000, // PKR 175,000
        tax_percent: 0,
        is_active: true,
        created_at: '2026-08-01T08:00:00.000Z'
      },
      {
        id: 'prd_tcl_tv',
        business_id: BUSINESS_ID,
        name: 'TCL 55P7K QLED TV 55"',
        description: 'TCL 55 Inch 4K QLED Smart LED TV',
        sku: 'PRD-002',
        type: 'product',
        unit: 'Unit',
        price_paisa: 12800000, // PKR 128,000
        tax_percent: 0,
        is_active: true,
        created_at: '2026-08-01T08:00:00.000Z'
      },
      {
        id: 'prd_dawlance_fridge',
        business_id: BUSINESS_ID,
        name: 'Dawlance 9166 Inverter Refrigerator',
        description: 'Dawlance 9166 16 Cu Ft Inverter Refrigerator',
        sku: 'PRD-003',
        type: 'product',
        unit: 'Unit',
        price_paisa: 22000000, // PKR 220,000
        tax_percent: 0,
        is_active: true,
        created_at: '2026-08-02T08:00:00.000Z'
      },
      {
        id: 'prd_haier_wm',
        business_id: BUSINESS_ID,
        name: 'Haier HWM 120-1789 Top Load',
        description: 'Haier 12 kg Fully Automatic Top Load Washing Machine',
        sku: 'PRD-004',
        type: 'product',
        unit: 'Unit',
        price_paisa: 8500000, // PKR 85,000
        tax_percent: 0,
        is_active: true,
        created_at: '2026-08-02T08:00:00.000Z'
      },
      {
        id: 'prd_lg_microwave',
        business_id: BUSINESS_ID,
        name: 'LG 42L Microwave Oven',
        description: 'LG 42 Litre Grill Microwave Oven',
        sku: 'PRD-005',
        type: 'product',
        unit: 'Unit',
        price_paisa: 5200000, // PKR 52,000
        tax_percent: 0,
        is_active: true,
        created_at: '2026-08-03T08:00:00.000Z'
      },
      {
        id: 'prd_fischer_hob',
        business_id: BUSINESS_ID,
        name: 'Fischer 5 Burner Gas Hob',
        description: 'Fischer Built-in 5 Burner Glass Hob',
        sku: 'PRD-006',
        type: 'product',
        unit: 'Unit',
        price_paisa: 9500000, // PKR 95,000
        tax_percent: 0,
        is_active: true,
        created_at: '2026-08-03T08:00:00.000Z'
      },
      {
        id: 'prd_esta_heater',
        business_id: BUSINESS_ID,
        name: 'Esta 25G Gas Water Heater',
        description: 'Esta 25 Gallon Gas Water Heater',
        sku: 'PRD-007',
        type: 'product',
        unit: 'Unit',
        price_paisa: 5200000, // PKR 52,000
        tax_percent: 0,
        is_active: true,
        created_at: '2026-08-04T08:00:00.000Z'
      },
      {
        id: 'srv_ac_install',
        business_id: BUSINESS_ID,
        name: 'AC Installation Service',
        description: 'Installation service for split AC (1–2 Ton)',
        sku: 'SRV-001',
        type: 'service',
        unit: 'Service',
        price_paisa: 800000, // PKR 8,000
        tax_percent: 0,
        is_active: true,
        created_at: '2026-08-05T08:00:00.000Z'
      },
      {
        id: 'srv_deliv_lahore',
        business_id: BUSINESS_ID,
        name: 'Delivery Charges (Lahore)',
        description: 'Standard delivery charges within Lahore',
        sku: 'SRV-002',
        type: 'service',
        unit: 'Trip',
        price_paisa: 300000, // PKR 3,000
        tax_percent: 0,
        is_active: true,
        created_at: '2026-08-05T08:00:00.000Z'
      },
      {
        id: 'prd_orient_ac',
        business_id: BUSINESS_ID,
        name: 'Orient 1.5 Ton AC',
        description: 'Orient 1.5 Ton DC Inverter Air Conditioner',
        sku: 'PRD-008',
        type: 'product',
        unit: 'Unit',
        price_paisa: 13500000, // PKR 135,000
        tax_percent: 0,
        is_active: false,
        created_at: '2026-08-05T08:00:00.000Z'
      },
      {
        id: 'prod_basmati_rice',
        business_id: BUSINESS_ID,
        name: 'Super Kernel Basmati Rice',
        description: 'Super Kernel Basmati Rice 50kg bag for commercial distribution',
        sku: 'RICE-SK-50',
        type: 'product',
        unit: '50kg Bag',
        price_paisa: 1250000, // PKR 12,500
        tax_percent: 0,
        is_active: true,
        created_at: '2026-09-01T08:00:00.000Z'
      },
      {
        id: 'prod_cooking_oil',
        business_id: BUSINESS_ID,
        name: 'Pure Cooking Oil (16L Tin)',
        description: 'Pure Cooking Oil in 16 Liter commercial tin',
        sku: 'OIL-16L',
        type: 'product',
        unit: '16L Tin',
        price_paisa: 820000, // PKR 8,200
        tax_percent: 0,
        is_active: true,
        created_at: '2026-09-01T08:00:00.000Z'
      },
      {
        id: 'prod_refined_sugar',
        business_id: BUSINESS_ID,
        name: 'Refined White Sugar (50kg)',
        description: 'Refined White Commercial Sugar 50kg bag',
        sku: 'SUGAR-50KG',
        type: 'product',
        unit: '50kg Bag',
        price_paisa: 750000, // PKR 7,500
        tax_percent: 0,
        is_active: true,
        created_at: '2026-09-01T08:00:00.000Z'
      },
      {
        id: 'prod_wheat_flour',
        business_id: BUSINESS_ID,
        name: 'Chakki Atta Flour (20kg)',
        description: 'Chakki Atta Flour 20kg packing',
        sku: 'FLOUR-20KG',
        type: 'product',
        unit: '20kg Bag',
        price_paisa: 240000, // PKR 2,400
        tax_percent: 0,
        is_active: true,
        created_at: '2026-09-01T08:00:00.000Z'
      },
      {
        id: 'prod_tea_dust',
        business_id: BUSINESS_ID,
        name: 'Premium Tea Dust (5kg)',
        description: 'Premium Tea Dust 5kg carton for wholesale',
        sku: 'TEA-5KG',
        type: 'product',
        unit: '5kg Carton',
        price_paisa: 680000, // PKR 6,800
        tax_percent: 0,
        is_active: true,
        created_at: '2026-09-01T08:00:00.000Z'
      },
      {
        id: 'prod_delivery',
        business_id: BUSINESS_ID,
        name: 'Bulk Goods Delivery & Handling',
        description: 'Bulk goods transport, delivery and handling',
        sku: 'SRV-DELIV',
        type: 'service',
        unit: 'Trip',
        price_paisa: 150000, // PKR 1,500
        tax_percent: 0,
        is_active: true,
        created_at: '2026-09-01T08:00:00.000Z'
      }
    ],
    invoices: [
      // Karachi Fresh Mart
      {
        id: 'inv_2026_1044',
        business_id: BUSINESS_ID,
        invoice_number: 'INV-2026-1044',
        customer_id: 'cust_karachi_fresh',
        customer_name: 'Karachi Fresh Mart',
        customer_city: 'Karachi',
        customer_phone: '0321 4457788',
        issue_date: '2026-09-20',
        due_date: '2026-10-04',
        subtotal_paisa: 14000000,
        tax_paisa: 0,
        discount_paisa: 0,
        total_paisa: 14000000,
        paid_paisa: 14000000,
        balance_due_paisa: 0,
        payment_status: 'PAID',
        due_status: 'OVERDUE',
        status: 'Paid',
        notes: 'Initial September stock order.',
        created_at: '2026-09-20T09:00:00.000Z',
        updated_at: '2026-10-10T11:00:00.000Z'
      },
      {
        id: 'inv_2026_1049',
        business_id: BUSINESS_ID,
        invoice_number: 'INV-2026-1049',
        customer_id: 'cust_karachi_fresh',
        customer_name: 'Karachi Fresh Mart',
        customer_city: 'Karachi',
        customer_phone: '0321 4457788',
        issue_date: '2026-10-22',
        due_date: '2026-11-05',
        subtotal_paisa: 34000000,
        tax_paisa: 0,
        discount_paisa: 0,
        total_paisa: 34000000,
        paid_paisa: 0,
        balance_due_paisa: 34000000,
        payment_status: 'UNPAID',
        due_status: 'DUE_SOON',
        status: 'Overdue',
        notes: 'Monthly staples shipment.',
        created_at: '2026-10-22T11:00:00.000Z',
        updated_at: '2026-10-22T11:00:00.000Z'
      },
      // Zeeshan Electronics
      {
        id: 'inv_2026_1048',
        business_id: BUSINESS_ID,
        invoice_number: 'INV-2026-1048',
        customer_id: 'cust_zeeshan_elec',
        customer_name: 'Zeeshan Electronics',
        customer_city: 'Lahore',
        customer_phone: '0300 1122334',
        issue_date: '2026-10-20',
        due_date: '2026-11-03',
        subtotal_paisa: 28000000,
        tax_paisa: 0,
        discount_paisa: 0,
        total_paisa: 28000000,
        paid_paisa: 0,
        balance_due_paisa: 28000000,
        payment_status: 'UNPAID',
        due_status: 'DUE_SOON',
        status: 'Overdue',
        notes: 'Staff supply & pantry bulk purchase.',
        created_at: '2026-10-20T12:00:00.000Z',
        updated_at: '2026-10-20T12:00:00.000Z'
      },
      // Al Rehman General Store
      {
        id: 'inv_2026_1043',
        business_id: BUSINESS_ID,
        invoice_number: 'INV-2026-1043',
        customer_id: 'cust_al_rehman',
        customer_name: 'Al Rehman General Store',
        customer_city: 'Faisalabad',
        customer_phone: '0345 6789012',
        issue_date: '2026-09-25',
        due_date: '2026-10-09',
        subtotal_paisa: 9000000,
        tax_paisa: 0,
        discount_paisa: 0,
        total_paisa: 9000000,
        paid_paisa: 9000000,
        balance_due_paisa: 0,
        payment_status: 'PAID',
        due_status: 'OVERDUE',
        status: 'Paid',
        notes: 'Sugar shipment for festive season.',
        created_at: '2026-09-25T11:00:00.000Z',
        updated_at: '2026-10-05T14:30:00.000Z'
      },
      {
        id: 'inv_2026_1046',
        business_id: BUSINESS_ID,
        invoice_number: 'INV-2026-1046',
        customer_id: 'cust_al_rehman',
        customer_name: 'Al Rehman General Store',
        customer_city: 'Faisalabad',
        customer_phone: '0345 6789012',
        issue_date: '2026-10-15',
        due_date: '2026-10-29',
        subtotal_paisa: 9000000,
        tax_paisa: 0,
        discount_paisa: 0,
        total_paisa: 9000000,
        paid_paisa: 0,
        balance_due_paisa: 9000000,
        payment_status: 'UNPAID',
        due_status: 'DUE_SOON',
        status: 'Due Soon',
        notes: 'Dry grains and cooking oil supply.',
        created_at: '2026-10-15T14:00:00.000Z',
        updated_at: '2026-10-15T14:00:00.000Z'
      },
      // Babar & Sons Wholesale
      {
        id: 'inv_2026_1041',
        business_id: BUSINESS_ID,
        invoice_number: 'INV-2026-1041',
        customer_id: 'cust_babar_sons',
        customer_name: 'Babar & Sons Wholesale',
        customer_city: 'Multan',
        customer_phone: '0306 3344556',
        issue_date: '2026-09-18',
        due_date: '2026-10-02',
        subtotal_paisa: 20000000,
        tax_paisa: 0,
        discount_paisa: 0,
        total_paisa: 20000000,
        paid_paisa: 20000000,
        balance_due_paisa: 0,
        payment_status: 'PAID',
        due_status: 'OVERDUE',
        status: 'Paid',
        notes: 'Wholesale Basmati shipment.',
        created_at: '2026-09-18T10:00:00.000Z',
        updated_at: '2026-10-01T11:00:00.000Z'
      },
      {
        id: 'inv_2026_1045',
        business_id: BUSINESS_ID,
        invoice_number: 'INV-2026-1045',
        customer_id: 'cust_babar_sons',
        customer_name: 'Babar & Sons Wholesale',
        customer_city: 'Multan',
        customer_phone: '0306 3344556',
        issue_date: '2026-10-10',
        due_date: '2026-10-24',
        subtotal_paisa: 14000000,
        tax_paisa: 0,
        discount_paisa: 0,
        total_paisa: 14000000,
        paid_paisa: 14000000,
        balance_due_paisa: 0,
        payment_status: 'PAID',
        due_status: 'OVERDUE',
        status: 'Paid',
        notes: 'Full payment received via bank transfer.',
        created_at: '2026-10-10T15:00:00.000Z',
        updated_at: '2026-10-24T16:00:00.000Z'
      },
      // Noor Medical Store
      {
        id: 'inv_2026_1042',
        business_id: BUSINESS_ID,
        invoice_number: 'INV-2026-1042',
        customer_id: 'cust_noor_med',
        customer_name: 'Noor Medical Store',
        customer_city: 'Islamabad',
        customer_phone: '0312 9988776',
        issue_date: '2026-09-22',
        due_date: '2026-10-06',
        subtotal_paisa: 7500000,
        tax_paisa: 0,
        discount_paisa: 0,
        total_paisa: 7500000,
        paid_paisa: 7500000,
        balance_due_paisa: 0,
        payment_status: 'PAID',
        due_status: 'OVERDUE',
        status: 'Paid',
        notes: 'Pharmacy cafeteria sugar inventory.',
        created_at: '2026-09-22T09:00:00.000Z',
        updated_at: '2026-10-04T12:00:00.000Z'
      },
      {
        id: 'inv_2026_1047',
        business_id: BUSINESS_ID,
        invoice_number: 'INV-2026-1047',
        customer_id: 'cust_noor_med',
        customer_name: 'Noor Medical Store',
        customer_city: 'Islamabad',
        customer_phone: '0312 9988776',
        issue_date: '2026-10-18',
        due_date: '2026-11-01',
        subtotal_paisa: 7500000,
        tax_paisa: 0,
        discount_paisa: 0,
        total_paisa: 7500000,
        paid_paisa: 0,
        balance_due_paisa: 7500000,
        payment_status: 'UNPAID',
        due_status: 'DUE_SOON',
        status: 'Due Soon',
        notes: 'Bi-weekly medical supply stock.',
        created_at: '2026-10-18T13:00:00.000Z',
        updated_at: '2026-10-18T13:00:00.000Z'
      },
      // Al-Hamza Traders
      {
        id: 'inv_2026_0140',
        business_id: BUSINESS_ID,
        invoice_number: 'INV-2026-0140',
        customer_id: 'cust_al_hamza',
        customer_name: 'Al-Hamza Traders',
        customer_city: 'Karachi',
        customer_phone: '0321 9876543',
        issue_date: '2026-09-10',
        due_date: '2026-09-24',
        subtotal_paisa: 24000000,
        tax_paisa: 0,
        discount_paisa: 0,
        total_paisa: 24000000,
        paid_paisa: 24000000,
        balance_due_paisa: 0,
        payment_status: 'PAID',
        due_status: 'OVERDUE',
        status: 'Paid',
        notes: 'Bulk flour consignment to Karachi hub.',
        created_at: '2026-09-10T10:00:00.000Z',
        updated_at: '2026-09-28T15:20:00.000Z'
      },
      {
        id: 'inv_2026_0142',
        business_id: BUSINESS_ID,
        invoice_number: 'INV-2026-0142',
        customer_id: 'cust_al_hamza',
        customer_name: 'Al-Hamza Traders',
        customer_city: 'Karachi',
        customer_phone: '0321 9876543',
        issue_date: '2026-10-12',
        due_date: '2026-10-26',
        subtotal_paisa: 38000000,
        tax_paisa: 0,
        discount_paisa: 0,
        total_paisa: 38000000,
        paid_paisa: 0,
        balance_due_paisa: 38000000,
        payment_status: 'UNPAID',
        due_status: 'OVERDUE',
        status: 'Overdue',
        notes: 'Delivery delivered to Karachi warehouse # 4. Payment terms: Net 14.',
        created_at: '2026-10-12T10:00:00.000Z',
        updated_at: '2026-10-26T23:59:59.000Z'
      }
    ],
    invoiceItems: [
      // inv_2026_1044 (Karachi Fresh, 14,000,000)
      {
        id: 'item_1044_1',
        invoice_id: 'inv_2026_1044',
        product_id: 'prod_basmati_rice',
        item_description: 'Super Kernel Basmati Rice (50kg)',
        quantity: 8,
        unit: '50kg Bag',
        unit_price_paisa: 1250000,
        amount_paisa: 10000000,
        created_at: '2026-09-20T09:00:00.000Z'
      },
      {
        id: 'item_1044_2',
        invoice_id: 'inv_2026_1044',
        product_id: 'prod_wheat_flour',
        item_description: 'Chakki Atta Flour (20kg)',
        quantity: 15,
        unit: '20kg Bag',
        unit_price_paisa: 240000,
        amount_paisa: 3600000,
        created_at: '2026-09-20T09:00:00.000Z'
      },
      {
        id: 'item_1044_3',
        invoice_id: 'inv_2026_1044',
        product_id: 'prod_delivery',
        item_description: 'Goods Handling & Delivery',
        quantity: 1,
        unit: 'Trip',
        unit_price_paisa: 400000,
        amount_paisa: 400000,
        created_at: '2026-09-20T09:00:00.000Z'
      },
      // inv_2026_1049 (Karachi Fresh, 34,000,000)
      {
        id: 'item_1049_1',
        invoice_id: 'inv_2026_1049',
        product_id: 'prod_basmati_rice',
        item_description: 'Super Kernel Basmati Rice (50kg)',
        quantity: 20,
        unit: '50kg Bag',
        unit_price_paisa: 1250000,
        amount_paisa: 25000000,
        created_at: '2026-10-22T11:00:00.000Z'
      },
      {
        id: 'item_1049_2',
        invoice_id: 'inv_2026_1049',
        product_id: 'prod_cooking_oil',
        item_description: 'Pure Cooking Oil (16L Tin)',
        quantity: 10,
        unit: '16L Tin',
        unit_price_paisa: 820000,
        amount_paisa: 8200000,
        created_at: '2026-10-22T11:00:00.000Z'
      },
      {
        id: 'item_1049_3',
        invoice_id: 'inv_2026_1049',
        product_id: 'prod_delivery',
        item_description: 'Intercity Transport and Cargo',
        quantity: 1,
        unit: 'Trip',
        unit_price_paisa: 800000,
        amount_paisa: 800000,
        created_at: '2026-10-22T11:00:00.000Z'
      },
      // inv_2026_1048 (Zeeshan Electronics, 28,000,000)
      {
        id: 'item_1048_1',
        invoice_id: 'inv_2026_1048',
        product_id: 'prod_tea_dust',
        item_description: 'Premium Tea Dust (5kg)',
        quantity: 35,
        unit: '5kg Carton',
        unit_price_paisa: 680000,
        amount_paisa: 23800000,
        created_at: '2026-10-20T12:00:00.000Z'
      },
      {
        id: 'item_1048_2',
        invoice_id: 'inv_2026_1048',
        product_id: 'prod_cooking_oil',
        item_description: 'Pure Cooking Oil (16L Tin)',
        quantity: 5,
        unit: '16L Tin',
        unit_price_paisa: 820000,
        amount_paisa: 4100000,
        created_at: '2026-10-20T12:00:00.000Z'
      },
      {
        id: 'item_1048_3',
        invoice_id: 'inv_2026_1048',
        product_id: 'prod_delivery',
        item_description: 'Local Delivery',
        quantity: 1,
        unit: 'Trip',
        unit_price_paisa: 100000,
        amount_paisa: 100000,
        created_at: '2026-10-20T12:00:00.000Z'
      },
      // inv_2026_1043 (Al Rehman, 9,000,000)
      {
        id: 'item_1043_1',
        invoice_id: 'inv_2026_1043',
        product_id: 'prod_refined_sugar',
        item_description: 'Refined White Sugar (50kg)',
        quantity: 12,
        unit: '50kg Bag',
        unit_price_paisa: 750000,
        amount_paisa: 9000000,
        created_at: '2026-09-25T11:00:00.000Z'
      },
      // inv_2026_1046 (Al Rehman, 9,000,000)
      {
        id: 'item_1046_1',
        invoice_id: 'inv_2026_1046',
        product_id: 'prod_wheat_flour',
        item_description: 'Chakki Atta Flour (20kg)',
        quantity: 30,
        unit: '20kg Bag',
        unit_price_paisa: 240000,
        amount_paisa: 7200000,
        created_at: '2026-10-15T14:00:00.000Z'
      },
      {
        id: 'item_1046_2',
        invoice_id: 'inv_2026_1046',
        product_id: 'prod_delivery',
        item_description: 'Bulk Goods Delivery & Handling',
        quantity: 1,
        unit: 'Trip',
        unit_price_paisa: 1800000,
        amount_paisa: 1800000,
        created_at: '2026-10-15T14:00:00.000Z'
      },
      // inv_2026_1041 (Babar & Sons, 20,000,000)
      {
        id: 'item_1041_1',
        invoice_id: 'inv_2026_1041',
        product_id: 'prod_basmati_rice',
        item_description: 'Super Kernel Basmati Rice (50kg)',
        quantity: 16,
        unit: '50kg Bag',
        unit_price_paisa: 1250000,
        amount_paisa: 20000000,
        created_at: '2026-09-18T10:00:00.000Z'
      },
      // inv_2026_1045 (Babar & Sons, 14,000,000)
      {
        id: 'item_1045_1',
        invoice_id: 'inv_2026_1045',
        product_id: 'prod_cooking_oil',
        item_description: 'Pure Cooking Oil (16L Tin)',
        quantity: 15,
        unit: '16L Tin',
        unit_price_paisa: 820000,
        amount_paisa: 12300000,
        created_at: '2026-10-10T15:00:00.000Z'
      },
      {
        id: 'item_1045_2',
        invoice_id: 'inv_2026_1045',
        product_id: 'prod_delivery',
        item_description: 'Wholesale Logistic Delivery to Multan',
        quantity: 1,
        unit: 'Trip',
        unit_price_paisa: 1700000,
        amount_paisa: 1700000,
        created_at: '2026-10-10T15:00:00.000Z'
      },
      // inv_2026_1042 (Noor Medical, 7,500,000)
      {
        id: 'item_1042_1',
        invoice_id: 'inv_2026_1042',
        product_id: 'prod_refined_sugar',
        item_description: 'Refined White Sugar (50kg)',
        quantity: 10,
        unit: '50kg Bag',
        unit_price_paisa: 750000,
        amount_paisa: 7500000,
        created_at: '2026-09-22T09:00:00.000Z'
      },
      // inv_2026_1047 (Noor Medical, 7,500,000)
      {
        id: 'item_1047_1',
        invoice_id: 'inv_2026_1047',
        product_id: 'prod_refined_sugar',
        item_description: 'Refined White Sugar (50kg)',
        quantity: 10,
        unit: '50kg Bag',
        unit_price_paisa: 750000,
        amount_paisa: 7500000,
        created_at: '2026-10-18T13:00:00.000Z'
      },
      // inv_2026_0140 (Al-Hamza, 24,000,000)
      {
        id: 'item_0140_1',
        invoice_id: 'inv_2026_0140',
        product_id: 'prod_wheat_flour',
        item_description: 'Chakki Atta Flour (20kg)',
        quantity: 100,
        unit: '20kg Bag',
        unit_price_paisa: 240000,
        amount_paisa: 24000000,
        created_at: '2026-09-10T10:00:00.000Z'
      },
      // inv_2026_0142 (Al-Hamza, 38,000,000)
      {
        id: 'item_inv_0142_1',
        invoice_id: 'inv_2026_0142',
        product_id: 'prod_basmati_rice',
        item_description: 'Super Kernel Basmati Rice (50kg)',
        quantity: 20,
        unit: '50kg Bag',
        unit_price_paisa: 1250000,
        amount_paisa: 25000000,
        created_at: '2026-10-12T10:00:00.000Z'
      },
      {
        id: 'item_inv_0142_2',
        invoice_id: 'inv_2026_0142',
        product_id: 'prod_cooking_oil',
        item_description: 'Pure Cooking Oil (16L Tin)',
        quantity: 15,
        unit: '16L Tin',
        unit_price_paisa: 820000,
        amount_paisa: 12300000,
        created_at: '2026-10-12T10:00:00.000Z'
      },
      {
        id: 'item_inv_0142_3',
        invoice_id: 'inv_2026_0142',
        product_id: 'prod_delivery',
        item_description: 'Heavy Cargo Freight Delivery to Karachi',
        quantity: 1,
        unit: 'Trip',
        unit_price_paisa: 700000,
        amount_paisa: 700000,
        created_at: '2026-10-12T10:00:00.000Z'
      }
    ],
    payments: [
      {
        id: 'pay_2026_0001',
        business_id: BUSINESS_ID,
        payment_number: 'PAY-2026-0001',
        customer_id: 'cust_babar_sons',
        customer_name: 'Babar & Sons Wholesale',
        amount_paisa: 14000000,
        payment_date: '2026-10-24',
        payment_method: 'Bank Transfer',
        reference_number: 'HBL-FT-992144',
        notes: 'Payment for invoice INV-2026-1045 cleared in HBL account.',
        created_at: '2026-10-24T16:00:00.000Z'
      },
      {
        id: 'pay_2026_0002',
        business_id: BUSINESS_ID,
        payment_number: 'PAY-2026-0002',
        customer_id: 'cust_karachi_fresh',
        customer_name: 'Karachi Fresh Mart',
        amount_paisa: 14000000,
        payment_date: '2026-10-10',
        payment_method: 'Cheque',
        reference_number: 'CHQ-882190',
        notes: 'Payment for invoice INV-2026-1044.',
        created_at: '2026-10-10T11:00:00.000Z'
      },
      {
        id: 'pay_2026_0003',
        business_id: BUSINESS_ID,
        payment_number: 'PAY-2026-0003',
        customer_id: 'cust_al_rehman',
        customer_name: 'Al Rehman General Store',
        amount_paisa: 9000000,
        payment_date: '2026-10-05',
        payment_method: 'Cash',
        reference_number: 'CASH-REC-012',
        notes: 'Cash payment on shop counter for invoice INV-2026-1043.',
        created_at: '2026-10-05T14:30:00.000Z'
      },
      {
        id: 'pay_2026_0004',
        business_id: BUSINESS_ID,
        payment_number: 'PAY-2026-0004',
        customer_id: 'cust_al_hamza',
        customer_name: 'Al-Hamza Traders',
        amount_paisa: 24000000,
        payment_date: '2026-09-28',
        payment_method: 'Bank Transfer',
        reference_number: 'MCB-998823',
        notes: 'Full payment for invoice INV-2026-0140.',
        created_at: '2026-09-28T15:20:00.000Z'
      },
      {
        id: 'pay_2026_0005',
        business_id: BUSINESS_ID,
        payment_number: 'PAY-2026-0005',
        customer_id: 'cust_babar_sons',
        customer_name: 'Babar & Sons Wholesale',
        amount_paisa: 20000000,
        payment_date: '2026-10-01',
        payment_method: 'Bank Transfer',
        reference_number: 'HBL-FT-883100',
        notes: 'Payment for invoice INV-2026-1041.',
        created_at: '2026-10-01T11:00:00.000Z'
      },
      {
        id: 'pay_2026_0006',
        business_id: BUSINESS_ID,
        payment_number: 'PAY-2026-0006',
        customer_id: 'cust_noor_med',
        customer_name: 'Noor Medical Store',
        amount_paisa: 7500000,
        payment_date: '2026-10-04',
        payment_method: 'Bank Transfer',
        reference_number: 'MEZN-665123',
        notes: 'Payment for invoice INV-2026-1042.',
        created_at: '2026-10-04T12:00:00.000Z'
      }
    ],
    paymentAllocations: [
      {
        id: 'alloc_2026_0001',
        payment_id: 'pay_2026_0001',
        invoice_id: 'inv_2026_1045',
        allocated_amount_paisa: 14000000,
        allocated_at: '2026-10-24T16:00:00.000Z'
      },
      {
        id: 'alloc_2026_0002',
        payment_id: 'pay_2026_0002',
        invoice_id: 'inv_2026_1044',
        allocated_amount_paisa: 14000000,
        allocated_at: '2026-10-10T11:00:00.000Z'
      },
      {
        id: 'alloc_2026_0003',
        payment_id: 'pay_2026_0003',
        invoice_id: 'inv_2026_1043',
        allocated_amount_paisa: 9000000,
        allocated_at: '2026-10-05T14:30:00.000Z'
      },
      {
        id: 'alloc_2026_0004',
        payment_id: 'pay_2026_0004',
        invoice_id: 'inv_2026_0140',
        allocated_amount_paisa: 24000000,
        allocated_at: '2026-09-28T15:20:00.000Z'
      },
      {
        id: 'alloc_2026_0005',
        payment_id: 'pay_2026_0005',
        invoice_id: 'inv_2026_1041',
        allocated_amount_paisa: 20000000,
        allocated_at: '2026-10-01T11:00:00.000Z'
      },
      {
        id: 'alloc_2026_0006',
        payment_id: 'pay_2026_0006',
        invoice_id: 'inv_2026_1042',
        allocated_amount_paisa: 7500000,
        allocated_at: '2026-10-04T12:00:00.000Z'
      }
    ],
    ledgerEntries: [
      // Karachi Fresh Mart
      {
        id: 'ledg_kf_01',
        business_id: BUSINESS_ID,
        customer_id: 'cust_karachi_fresh',
        entry_date: '2026-09-20',
        entry_type: 'INVOICE',
        reference_id: 'inv_2026_1044',
        reference_number: 'INV-2026-1044',
        description: 'Invoice issued: INV-2026-1044',
        debit_paisa: 14000000,
        credit_paisa: 0,
        running_balance_paisa: 14000000,
        created_at: '2026-09-20T09:00:00.000Z'
      },
      {
        id: 'ledg_kf_02',
        business_id: BUSINESS_ID,
        customer_id: 'cust_karachi_fresh',
        entry_date: '2026-10-10',
        entry_type: 'PAYMENT',
        reference_id: 'pay_2026_0002',
        reference_number: 'PAY-2026-0002',
        description: 'Payment allocated to INV-2026-1044 (CHQ-882190)',
        debit_paisa: 0,
        credit_paisa: 14000000,
        running_balance_paisa: 0,
        created_at: '2026-10-10T11:00:00.000Z'
      },
      {
        id: 'ledg_kf_03',
        business_id: BUSINESS_ID,
        customer_id: 'cust_karachi_fresh',
        entry_date: '2026-10-22',
        entry_type: 'INVOICE',
        reference_id: 'inv_2026_1049',
        reference_number: 'INV-2026-1049',
        description: 'Invoice issued: INV-2026-1049',
        debit_paisa: 34000000,
        credit_paisa: 0,
        running_balance_paisa: 34000000,
        created_at: '2026-10-22T11:00:00.000Z'
      },
      // Zeeshan Electronics
      {
        id: 'ledg_ze_01',
        business_id: BUSINESS_ID,
        customer_id: 'cust_zeeshan_elec',
        entry_date: '2026-10-20',
        entry_type: 'INVOICE',
        reference_id: 'inv_2026_1048',
        reference_number: 'INV-2026-1048',
        description: 'Invoice issued: INV-2026-1048',
        debit_paisa: 28000000,
        credit_paisa: 0,
        running_balance_paisa: 28000000,
        created_at: '2026-10-20T12:00:00.000Z'
      },
      // Al Rehman General Store
      {
        id: 'ledg_ar_01',
        business_id: BUSINESS_ID,
        customer_id: 'cust_al_rehman',
        entry_date: '2026-09-25',
        entry_type: 'INVOICE',
        reference_id: 'inv_2026_1043',
        reference_number: 'INV-2026-1043',
        description: 'Invoice issued: INV-2026-1043',
        debit_paisa: 9000000,
        credit_paisa: 0,
        running_balance_paisa: 9000000,
        created_at: '2026-09-25T11:00:00.000Z'
      },
      {
        id: 'ledg_ar_02',
        business_id: BUSINESS_ID,
        customer_id: 'cust_al_rehman',
        entry_date: '2026-10-05',
        entry_type: 'PAYMENT',
        reference_id: 'pay_2026_0003',
        reference_number: 'PAY-2026-0003',
        description: 'Cash payment received (CASH-REC-012)',
        debit_paisa: 0,
        credit_paisa: 9000000,
        running_balance_paisa: 0,
        created_at: '2026-10-05T14:30:00.000Z'
      },
      {
        id: 'ledg_ar_03',
        business_id: BUSINESS_ID,
        customer_id: 'cust_al_rehman',
        entry_date: '2026-10-15',
        entry_type: 'INVOICE',
        reference_id: 'inv_2026_1046',
        reference_number: 'INV-2026-1046',
        description: 'Invoice issued: INV-2026-1046',
        debit_paisa: 9000000,
        credit_paisa: 0,
        running_balance_paisa: 9000000,
        created_at: '2026-10-15T14:00:00.000Z'
      },
      // Babar & Sons Wholesale
      {
        id: 'ledg_bs_01',
        business_id: BUSINESS_ID,
        customer_id: 'cust_babar_sons',
        entry_date: '2026-09-18',
        entry_type: 'INVOICE',
        reference_id: 'inv_2026_1041',
        reference_number: 'INV-2026-1041',
        description: 'Invoice issued: INV-2026-1041',
        debit_paisa: 20000000,
        credit_paisa: 0,
        running_balance_paisa: 20000000,
        created_at: '2026-09-18T10:00:00.000Z'
      },
      {
        id: 'ledg_bs_02',
        business_id: BUSINESS_ID,
        customer_id: 'cust_babar_sons',
        entry_date: '2026-10-01',
        entry_type: 'PAYMENT',
        reference_id: 'pay_2026_0005',
        reference_number: 'PAY-2026-0005',
        description: 'Bank Transfer received (HBL-FT-883100)',
        debit_paisa: 0,
        credit_paisa: 20000000,
        running_balance_paisa: 0,
        created_at: '2026-10-01T11:00:00.000Z'
      },
      {
        id: 'ledg_bs_03',
        business_id: BUSINESS_ID,
        customer_id: 'cust_babar_sons',
        entry_date: '2026-10-10',
        entry_type: 'INVOICE',
        reference_id: 'inv_2026_1045',
        reference_number: 'INV-2026-1045',
        description: 'Invoice issued: INV-2026-1045',
        debit_paisa: 14000000,
        credit_paisa: 0,
        running_balance_paisa: 14000000,
        created_at: '2026-10-10T15:00:00.000Z'
      },
      {
        id: 'ledg_bs_04',
        business_id: BUSINESS_ID,
        customer_id: 'cust_babar_sons',
        entry_date: '2026-10-24',
        entry_type: 'PAYMENT',
        reference_id: 'pay_2026_0001',
        reference_number: 'PAY-2026-0001',
        description: 'Payment allocated to INV-2026-1045 (HBL-FT-992144)',
        debit_paisa: 0,
        credit_paisa: 14000000,
        running_balance_paisa: 0,
        created_at: '2026-10-24T16:00:00.000Z'
      },
      // Noor Medical Store
      {
        id: 'ledg_nm_01',
        business_id: BUSINESS_ID,
        customer_id: 'cust_noor_med',
        entry_date: '2026-09-22',
        entry_type: 'INVOICE',
        reference_id: 'inv_2026_1042',
        reference_number: 'INV-2026-1042',
        description: 'Invoice issued: INV-2026-1042',
        debit_paisa: 7500000,
        credit_paisa: 0,
        running_balance_paisa: 7500000,
        created_at: '2026-09-22T09:00:00.000Z'
      },
      {
        id: 'ledg_nm_02',
        business_id: BUSINESS_ID,
        customer_id: 'cust_noor_med',
        entry_date: '2026-10-04',
        entry_type: 'PAYMENT',
        reference_id: 'pay_2026_0006',
        reference_number: 'PAY-2026-0006',
        description: 'Payment allocated to INV-2026-1042 (MEZN-665123)',
        debit_paisa: 0,
        credit_paisa: 7500000,
        running_balance_paisa: 0,
        created_at: '2026-10-04T12:00:00.000Z'
      },
      {
        id: 'ledg_nm_03',
        business_id: BUSINESS_ID,
        customer_id: 'cust_noor_med',
        entry_date: '2026-10-18',
        entry_type: 'INVOICE',
        reference_id: 'inv_2026_1047',
        reference_number: 'INV-2026-1047',
        description: 'Invoice issued: INV-2026-1047',
        debit_paisa: 7500000,
        credit_paisa: 0,
        running_balance_paisa: 7500000,
        created_at: '2026-10-18T13:00:00.000Z'
      },
      // Al-Hamza Traders
      {
        id: 'ledg_ah_01',
        business_id: BUSINESS_ID,
        customer_id: 'cust_al_hamza',
        entry_date: '2026-09-10',
        entry_type: 'INVOICE',
        reference_id: 'inv_2026_0140',
        reference_number: 'INV-2026-0140',
        description: 'Invoice issued: INV-2026-0140',
        debit_paisa: 24000000,
        credit_paisa: 0,
        running_balance_paisa: 24000000,
        created_at: '2026-09-10T10:00:00.000Z'
      },
      {
        id: 'ledg_ah_02',
        business_id: BUSINESS_ID,
        customer_id: 'cust_al_hamza',
        entry_date: '2026-09-28',
        entry_type: 'PAYMENT',
        reference_id: 'pay_2026_0004',
        reference_number: 'PAY-2026-0004',
        description: 'Bank Transfer received (MCB-998823)',
        debit_paisa: 0,
        credit_paisa: 24000000,
        running_balance_paisa: 0,
        created_at: '2026-09-28T15:20:00.000Z'
      },
      {
        id: 'ledg_ah_03',
        business_id: BUSINESS_ID,
        customer_id: 'cust_al_hamza',
        entry_date: '2026-10-12',
        entry_type: 'INVOICE',
        reference_id: 'inv_2026_0142',
        reference_number: 'INV-2026-0142',
        description: 'Invoice issued: INV-2026-0142',
        debit_paisa: 38000000,
        credit_paisa: 0,
        running_balance_paisa: 38000000,
        created_at: '2026-10-12T10:00:00.000Z'
      }
    ],
    reminders: {
      id: 'rem_settings_default',
      business_id: BUSINESS_ID,
      auto_reminders_enabled: false, // Requirement 11: Set unconfigured automatic reminders to disabled by default
      channels: ['Email', 'WhatsApp'],
      schedule_days_before_due: 3,
      schedule_days_after_due: 7,
      frequency_days: 7,
      sender_name: 'Shah Traders Accounts',
      custom_template_due_soon: 'Dear customer, your invoice is due soon. Please clear your balance.',
      custom_template_overdue: 'Notice: Your invoice balance is overdue. Kindly settle promptly to maintain credit terms.',
      updated_at: '2026-10-20T10:00:00.000Z'
    }
  };

  // --- IndexedDB Database Engine ---
  let dbInstance = null;
  let initPromise = null;

  function openDatabase() {
    if (dbInstance) {
      return Promise.resolve(dbInstance);
    }
    if (initPromise) {
      return initPromise;
    }

    initPromise = new Promise((resolve, reject) => {
      const idb = (typeof window !== 'undefined' && window.indexedDB) || (typeof indexedDB !== 'undefined' ? indexedDB : null);
      if (!idb) {
        return reject(new Error('IndexedDB is not supported in this browser environment.'));
      }

      const request = idb.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = function(event) {
        const db = event.target.result;

        // 1. Business Settings Store
        if (!db.objectStoreNames.contains(STORES.BUSINESS)) {
          db.createObjectStore(STORES.BUSINESS, { keyPath: 'id' });
        }

        // 2. Customers Store
        if (!db.objectStoreNames.contains(STORES.CUSTOMERS)) {
          const store = db.createObjectStore(STORES.CUSTOMERS, { keyPath: 'id' });
          store.createIndex('name', 'name', { unique: false });
          store.createIndex('phone', 'phone', { unique: false });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('created_at', 'created_at', { unique: false });
        }

        // 3. Products & Services Store
        if (!db.objectStoreNames.contains(STORES.PRODUCTS)) {
          const store = db.createObjectStore(STORES.PRODUCTS, { keyPath: 'id' });
          store.createIndex('name', 'name', { unique: false });
          store.createIndex('type', 'type', { unique: false });
          store.createIndex('is_active', 'is_active', { unique: false });
        }

        // 4. Invoices Store
        if (!db.objectStoreNames.contains(STORES.INVOICES)) {
          const store = db.createObjectStore(STORES.INVOICES, { keyPath: 'id' });
          store.createIndex('invoice_number', 'invoice_number', { unique: true });
          store.createIndex('customer_id', 'customer_id', { unique: false });
          store.createIndex('payment_status', 'payment_status', { unique: false });
          store.createIndex('due_status', 'due_status', { unique: false });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('issue_date', 'issue_date', { unique: false });
          store.createIndex('due_date', 'due_date', { unique: false });
        }

        // 5. Invoice Line Items Store
        if (!db.objectStoreNames.contains(STORES.INVOICE_ITEMS)) {
          const store = db.createObjectStore(STORES.INVOICE_ITEMS, { keyPath: 'id' });
          store.createIndex('invoice_id', 'invoice_id', { unique: false });
          store.createIndex('product_id', 'product_id', { unique: false });
        }

        // 6. Payments Store
        if (!db.objectStoreNames.contains(STORES.PAYMENTS)) {
          const store = db.createObjectStore(STORES.PAYMENTS, { keyPath: 'id' });
          store.createIndex('payment_number', 'payment_number', { unique: true });
          store.createIndex('customer_id', 'customer_id', { unique: false });
          store.createIndex('payment_date', 'payment_date', { unique: false });
        }

        // 7. Payment Allocations Store
        if (!db.objectStoreNames.contains(STORES.ALLOCATIONS)) {
          const store = db.createObjectStore(STORES.ALLOCATIONS, { keyPath: 'id' });
          store.createIndex('payment_id', 'payment_id', { unique: false });
          store.createIndex('invoice_id', 'invoice_id', { unique: false });
        }

        // 8. Credit Ledger Entries Store
        if (!db.objectStoreNames.contains(STORES.LEDGER)) {
          const store = db.createObjectStore(STORES.LEDGER, { keyPath: 'id' });
          store.createIndex('customer_id', 'customer_id', { unique: false });
          store.createIndex('entry_date', 'entry_date', { unique: false });
          store.createIndex('reference_id', 'reference_id', { unique: false });
        }

        // 9. Reminder Settings Store
        if (!db.objectStoreNames.contains(STORES.REMINDERS)) {
          db.createObjectStore(STORES.REMINDERS, { keyPath: 'id' });
        }
      };

      request.onsuccess = function(event) {
        dbInstance = event.target.result;

        ensureSeeded(dbInstance)
          .then(() => resolve(dbInstance))
          .catch(err => {
            console.error('[CreditFlowDB] Seed error:', err);
            resolve(dbInstance);
          });
      };

      request.onerror = function(event) {
        initPromise = null;
        reject(new Error(`IndexedDB open failed: ${event.target.error}`));
      };
    });

    return initPromise;
  }

  // Idempotent seeding check: only seeds once when database is first initialized
  function ensureSeeded(db) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES.BUSINESS], 'readonly');
      const store = tx.objectStore(STORES.BUSINESS);
      const req = store.get(BUSINESS_ID);

      req.onsuccess = function() {
        if (req.result) {
          resolve(false);
        } else {
          seedInitialData(db)
            .then(() => resolve(true))
            .catch(reject);
        }
      };
      req.onerror = function(e) {
        reject(e.target.error);
      };
    });
  }

  function seedInitialData(db) {
    return new Promise((resolve, reject) => {
      const allStores = Object.values(STORES);
      const tx = db.transaction(allStores, 'readwrite');

      tx.onerror = (e) => reject(e.target.error);
      tx.oncomplete = () => resolve(true);

      // Business
      tx.objectStore(STORES.BUSINESS).put(initialDemoData.business);

      // Customers
      const custStore = tx.objectStore(STORES.CUSTOMERS);
      initialDemoData.customers.forEach(item => custStore.put(item));

      // Products
      const prodStore = tx.objectStore(STORES.PRODUCTS);
      initialDemoData.products.forEach(item => prodStore.put(item));

      // Invoices
      const invStore = tx.objectStore(STORES.INVOICES);
      initialDemoData.invoices.forEach(item => invStore.put(item));

      // Invoice Items
      const itemsStore = tx.objectStore(STORES.INVOICE_ITEMS);
      initialDemoData.invoiceItems.forEach(item => itemsStore.put(item));

      // Payments
      const payStore = tx.objectStore(STORES.PAYMENTS);
      initialDemoData.payments.forEach(item => payStore.put(item));

      // Allocations
      const allocStore = tx.objectStore(STORES.ALLOCATIONS);
      initialDemoData.paymentAllocations.forEach(item => allocStore.put(item));

      // Ledger
      const ledgStore = tx.objectStore(STORES.LEDGER);
      initialDemoData.ledgerEntries.forEach(item => ledgStore.put(item));

      // Reminders
      tx.objectStore(STORES.REMINDERS).put(initialDemoData.reminders);
    });
  }

  // Generic store read helpers
  function getAllFromStore(storeName) {
    return openDatabase().then(db => {
      return new Promise((resolve, reject) => {
        const tx = db.transaction([storeName], 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = (e) => reject(e.target.error);
      });
    });
  }

  function getFromStore(storeName, key) {
    return openDatabase().then(db => {
      return new Promise((resolve, reject) => {
        const tx = db.transaction([storeName], 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = (e) => reject(e.target.error);
      });
    });
  }

  function putToStore(storeName, record) {
    return openDatabase().then(db => {
      return new Promise((resolve, reject) => {
        const tx = db.transaction([storeName], 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.put(record);
        req.onsuccess = () => resolve(req.result);
        req.onerror = (e) => reject(e.target.error);
      });
    });
  }

  // --- Public Reusable Data Access Interface ---
  const CreditFlowDB = {
    name: DB_NAME,
    version: DB_VERSION,
    businessId: BUSINESS_ID,
    stores: STORES,
    utils,

    init() {
      return openDatabase();
    },

    // 1. Business Settings
    business: {
      get() {
        return getFromStore(STORES.BUSINESS, BUSINESS_ID);
      },
      update(updates) {
        return openDatabase().then(db => {
          return new Promise((resolve, reject) => {
            const tx = db.transaction([STORES.BUSINESS], 'readwrite');
            const store = tx.objectStore(STORES.BUSINESS);
            const getReq = store.get(BUSINESS_ID);

            getReq.onsuccess = function() {
              const current = getReq.result || { id: BUSINESS_ID };
              const updated = {
                ...current,
                ...updates,
                updated_at: new Date().toISOString()
              };
              const putReq = store.put(updated);
              putReq.onsuccess = () => resolve(updated);
              putReq.onerror = (e) => reject(e.target.error);
            };
            getReq.onerror = (e) => reject(e.target.error);
          });
        });
      }
    },

    // 2. Customers
    customers: {
      getAll() {
        return getAllFromStore(STORES.CUSTOMERS);
      },
      getById(id) {
        if (!id) return Promise.resolve(null);
        return getFromStore(STORES.CUSTOMERS, id);
      },
      create(customerData) {
        if (!customerData || typeof customerData !== 'object') {
          return Promise.reject(new Error('Customer data must be an object.'));
        }
        if (!customerData.name || !customerData.name.trim()) {
          return Promise.reject(new Error('Customer name is required.'));
        }

        const creditLimit = customerData.credit_limit_paisa !== undefined
          ? customerData.credit_limit_paisa
          : (customerData.credit_limit !== undefined ? utils.rupeesToPaisa(customerData.credit_limit) : 0);

        try {
          utils.validateNonNegativeIntegerPaisa(creditLimit, 'credit_limit_paisa');
        } catch (err) {
          return Promise.reject(err);
        }

        const record = {
          id: customerData.id || utils.generateId('cust'),
          business_id: BUSINESS_ID,
          name: customerData.name.trim(),
          initials: customerData.initials || customerData.name.trim().split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'CU',
          city: customerData.city || 'Lahore',
          category: customerData.category || 'Retail Store',
          phone: customerData.phone || '',
          email: customerData.email || '',
          status: customerData.status || 'Active',
          credit_limit_paisa: creditLimit,
          total_invoiced_paisa: 0,
          total_paid_paisa: 0,
          balance_due_paisa: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        return putToStore(STORES.CUSTOMERS, record).then(() => record);
      },

      // Requirement 13: Prevent arbitrary changes to protected customer financial fields through normal update methods
      update(id, updates) {
        if (!id) {
          return Promise.reject(new Error('Customer id is required for update.'));
        }
        return openDatabase().then(db => {
          return new Promise((resolve, reject) => {
            const tx = db.transaction([STORES.CUSTOMERS], 'readwrite');
            const store = tx.objectStore(STORES.CUSTOMERS);
            const getReq = store.get(id);

            getReq.onsuccess = function() {
              if (!getReq.result) {
                return reject(new Error(`Customer not found with id: ${id}`));
              }
              const current = getReq.result;

              // Strip protected customer balance fields to prevent arbitrary direct mutation
              const sanitizedUpdates = { ...updates };
              delete sanitizedUpdates.total_invoiced_paisa;
              delete sanitizedUpdates.total_paid_paisa;
              delete sanitizedUpdates.balance_due_paisa;
              delete sanitizedUpdates.id;
              delete sanitizedUpdates.business_id;

              if (sanitizedUpdates.credit_limit_paisa !== undefined) {
                try {
                  utils.validateNonNegativeIntegerPaisa(sanitizedUpdates.credit_limit_paisa, 'credit_limit_paisa');
                } catch (e) {
                  return reject(e);
                }
              }

              const updated = {
                ...current,
                ...sanitizedUpdates,
                updated_at: new Date().toISOString()
              };
              const putReq = store.put(updated);
              putReq.onsuccess = () => resolve(updated);
              putReq.onerror = (e) => reject(e.target.error);
            };
            getReq.onerror = (e) => reject(e.target.error);
          });
        });
      }
    },

    // 3. Products and Services
    products: {
      getAll() {
        return getAllFromStore(STORES.PRODUCTS);
      },
      getById(id) {
        if (!id) return Promise.resolve(null);
        return getFromStore(STORES.PRODUCTS, id);
      },
      create(productData) {
        if (!productData || typeof productData !== 'object') {
          return Promise.reject(new Error('Product data must be an object.'));
        }
        const price = productData.price_paisa !== undefined ? productData.price_paisa : 0;
        try {
          utils.validateNonNegativeIntegerPaisa(price, 'price_paisa');
        } catch (err) {
          return Promise.reject(err);
        }

        const record = {
          id: productData.id || utils.generateId('prod'),
          business_id: BUSINESS_ID,
          name: productData.name || 'Untitled Item',
          description: productData.description || '',
          sku: productData.sku || '',
          type: productData.type || 'product',
          unit: productData.unit || 'Unit',
          price_paisa: price,
          tax_percent: Number(productData.tax_percent) || 0,
          is_active: productData.is_active !== false,
          created_at: new Date().toISOString()
        };
        return putToStore(STORES.PRODUCTS, record).then(() => record);
      },
      update(id, updates) {
        if (!id) {
          return Promise.reject(new Error('Product id is required for update.'));
        }
        return openDatabase().then(db => {
          return new Promise((resolve, reject) => {
            const tx = db.transaction([STORES.PRODUCTS], 'readwrite');
            const store = tx.objectStore(STORES.PRODUCTS);
            const getReq = store.get(id);

            getReq.onsuccess = function() {
              if (!getReq.result) {
                return reject(new Error(`Product not found with id: ${id}`));
              }
              const current = getReq.result;
              const sanitizedUpdates = { ...updates };
              delete sanitizedUpdates.id;
              delete sanitizedUpdates.business_id;

              if (sanitizedUpdates.price_paisa !== undefined) {
                try {
                  utils.validateNonNegativeIntegerPaisa(sanitizedUpdates.price_paisa, 'price_paisa');
                } catch (e) {
                  return reject(e);
                }
              }

              const updated = {
                ...current,
                ...sanitizedUpdates,
                updated_at: new Date().toISOString()
              };
              const putReq = store.put(updated);
              putReq.onsuccess = () => resolve(updated);
              putReq.onerror = (e) => reject(e.target.error);
            };
            getReq.onerror = (e) => reject(e.target.error);
          });
        });
      },
      setActiveStatus(id, isActive) {
        return this.update(id, { is_active: Boolean(isActive) });
      }
    },

    // 4. Invoices and Financial Integrity Engine
    invoices: {
      getAll() {
        return getAllFromStore(STORES.INVOICES);
      },
      getById(id) {
        if (!id) return Promise.resolve(null);
        return getFromStore(STORES.INVOICES, id);
      },
      getByInvoiceNumber(invoiceNumber) {
        if (!invoiceNumber) return Promise.resolve(null);
        return openDatabase().then(db => {
          return new Promise((resolve, reject) => {
            const tx = db.transaction([STORES.INVOICES], 'readonly');
            const store = tx.objectStore(STORES.INVOICES);
            const index = store.index('invoice_number');
            const req = index.get(invoiceNumber);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = (e) => reject(e.target.error);
          });
        });
      },
      getItems(invoiceId) {
        if (!invoiceId) return Promise.resolve([]);
        return openDatabase().then(db => {
          return new Promise((resolve, reject) => {
            const tx = db.transaction([STORES.INVOICE_ITEMS], 'readonly');
            const store = tx.objectStore(STORES.INVOICE_ITEMS);
            const index = store.index('invoice_id');
            const req = index.getAll(invoiceId);
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = (e) => reject(e.target.error);
          });
        });
      },

      /**
       * Requirement 1, 2, 6, 7, 8, 9:
       * Atomic Invoice Creation:
       * - Strictly calculates subtotal and total from line items, discounts, and taxes.
       * - Validates customer exists, safe integer paisa amounts, valid dates.
       * - Reliable unique sequential invoice numbering (INV-YYYY-XXXX).
       * - Separate payment_status from due_status.
       * - Atomic write across [invoices, invoice_items, customers, credit_ledger_entries]
       *   with clean rollback on abort or failure.
       */
      create(invoiceData, lineItems = []) {
        if (!invoiceData || typeof invoiceData !== 'object') {
          return Promise.reject(new Error('Invoice data must be provided as an object.'));
        }

        // 1. Validate customer ID
        if (!invoiceData.customer_id || typeof invoiceData.customer_id !== 'string') {
          return Promise.reject(new Error('Customer ID is required to create an invoice.'));
        }

        // 2. Validate line items
        if (!Array.isArray(lineItems) || lineItems.length === 0) {
          return Promise.reject(new Error('Invoice must include at least one valid line item.'));
        }

        // 3. Calculate line items amounts strictly
        let computedSubtotal = 0;
        const validatedItems = [];

        for (let i = 0; i < lineItems.length; i++) {
          const item = lineItems[i];
          const qty = Number(item.quantity);
          if (typeof qty !== 'number' || isNaN(qty) || qty <= 0) {
            return Promise.reject(new Error(`Line item ${i + 1} quantity must be a positive number (received ${item.quantity}).`));
          }
          const unitPrice = Number(item.unit_price_paisa);
          if (!utils.isSafeNonNegativeInteger(unitPrice)) {
            return Promise.reject(new Error(`Line item ${i + 1} unit price must be a non-negative integer paisa amount (received ${item.unit_price_paisa}).`));
          }

          const computedAmount = utils.computeLineItemAmount(qty, unitPrice);

          // If caller explicitly provided an amount_paisa, verify it matches computed
          if (item.amount_paisa !== undefined && item.amount_paisa !== computedAmount) {
            return Promise.reject(new Error(`Line item ${i + 1} amount mismatch: supplied ${item.amount_paisa} paisa but calculated ${computedAmount} paisa (${qty} * ${unitPrice}).`));
          }

          computedSubtotal += computedAmount;
          validatedItems.push({
            ...item,
            quantity: qty,
            unit_price_paisa: unitPrice,
            amount_paisa: computedAmount
          });
        }

        // 4. Validate discounts and taxes
        const discountPaisa = invoiceData.discount_paisa !== undefined ? Number(invoiceData.discount_paisa) : 0;
        if (!utils.isSafeNonNegativeInteger(discountPaisa)) {
          return Promise.reject(new Error(`Invoice discount_paisa must be a non-negative safe integer (received ${invoiceData.discount_paisa}).`));
        }
        if (discountPaisa > computedSubtotal) {
          return Promise.reject(new Error(`Invoice discount (${discountPaisa} paisa) cannot exceed subtotal (${computedSubtotal} paisa).`));
        }

        const taxPaisa = invoiceData.tax_paisa !== undefined ? Number(invoiceData.tax_paisa) : 0;
        if (!utils.isSafeNonNegativeInteger(taxPaisa)) {
          return Promise.reject(new Error(`Invoice tax_paisa must be a non-negative safe integer (received ${invoiceData.tax_paisa}).`));
        }

        const computedTotal = computedSubtotal - discountPaisa + taxPaisa;
        if (computedTotal <= 0) {
          return Promise.reject(new Error(`Computed invoice total must be greater than zero (calculated ${computedTotal} paisa).`));
        }

        // Reject mismatches against supplied totals
        if (invoiceData.subtotal_paisa !== undefined && invoiceData.subtotal_paisa !== computedSubtotal) {
          return Promise.reject(new Error(`Invoice subtotal mismatch: supplied subtotal_paisa (${invoiceData.subtotal_paisa}) does not match computed line items total (${computedSubtotal}).`));
        }
        if (invoiceData.total_paisa !== undefined && invoiceData.total_paisa !== computedTotal) {
          return Promise.reject(new Error(`Invoice total mismatch: supplied total_paisa (${invoiceData.total_paisa}) does not match computed total (${computedTotal}).`));
        }

        // 5. Dates
        const issueDate = invoiceData.issue_date || new Date().toISOString().split('T')[0];
        try {
          utils.validateDateString(issueDate, 'issue_date');
        } catch (e) {
          return Promise.reject(e);
        }

        const dueDate = invoiceData.due_date || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
        try {
          utils.validateDateString(dueDate, 'due_date');
        } catch (e) {
          return Promise.reject(e);
        }

        if (dueDate < issueDate) {
          return Promise.reject(new Error(`Invoice due_date (${dueDate}) cannot be earlier than issue_date (${issueDate}).`));
        }

        // Execute in single atomic IndexedDB transaction
        return openDatabase().then(db => {
          return new Promise((resolve, reject) => {
            const tx = db.transaction([
              STORES.INVOICES,
              STORES.INVOICE_ITEMS,
              STORES.CUSTOMERS,
              STORES.LEDGER
            ], 'readwrite');

            let isAborted = false;
            function abortWithError(err) {
              if (!isAborted) {
                isAborted = true;
                try { tx.abort(); } catch (_) {}
                reject(err instanceof Error ? err : new Error(String(err)));
              }
            }

            tx.onerror = function(e) {
              if (!isAborted) {
                isAborted = true;
                reject(e.target.error || new Error('Invoice transaction failed.'));
              }
            };

            tx.onabort = function(e) {
              if (!isAborted) {
                isAborted = true;
                reject(tx.error || (e && e.target && e.target.error) || new Error('Invoice transaction aborted.'));
              }
            };

            const custStore = tx.objectStore(STORES.CUSTOMERS);
            const invStore = tx.objectStore(STORES.INVOICES);
            const itemsStore = tx.objectStore(STORES.INVOICE_ITEMS);
            const ledgStore = tx.objectStore(STORES.LEDGER);

            // Verify customer exists
            const custReq = custStore.get(invoiceData.customer_id);
            custReq.onerror = () => abortWithError(custReq.error);
            custReq.onsuccess = function() {
              const customer = custReq.result;
              if (!customer) {
                return abortWithError(new Error(`Customer not found with id: ${invoiceData.customer_id}`));
              }

              // Determine invoice number (Sequential collision-free sequence)
              const allInvoicesReq = invStore.getAll();
              allInvoicesReq.onerror = () => abortWithError(allInvoicesReq.error);
              allInvoicesReq.onsuccess = function() {
                const existingInvoices = allInvoicesReq.result || [];
                const invoiceYear = new Date(issueDate).getFullYear();

                let invoiceNumber = invoiceData.invoice_number;
                if (invoiceNumber) {
                  // Verify uniqueness
                  const duplicate = existingInvoices.find(inv => inv.invoice_number === invoiceNumber);
                  if (duplicate) {
                    return abortWithError(new Error(`Invoice number "${invoiceNumber}" already exists. Duplicate invoice numbers are rejected.`));
                  }
                } else {
                  // Generate next unique sequence number
                  let maxSeq = 1000;
                  const yearPrefix = `INV-${invoiceYear}-`;
                  existingInvoices.forEach(inv => {
                    if (inv.invoice_number && inv.invoice_number.startsWith(yearPrefix)) {
                      const numPart = parseInt(inv.invoice_number.slice(yearPrefix.length), 10);
                      if (!isNaN(numPart) && numPart > maxSeq) {
                        maxSeq = numPart;
                      }
                    }
                  });
                  invoiceNumber = `${yearPrefix}${String(maxSeq + 1).padStart(4, '0')}`;
                }

                const invoiceId = invoiceData.id || utils.generateId('inv');
                const isDraft = Boolean(invoiceData.is_draft);

                // Requirement 6: Keep payment_status separate from due_status
                const paymentStatus = isDraft ? 'DRAFT' : utils.computePaymentStatus(computedTotal, 0); // newly created has 0 paid
                const dueStatus = isDraft ? 'CURRENT' : utils.computeDueStatus(dueDate);
                const displayStatus = isDraft ? 'Draft' : utils.computeDisplayStatus(paymentStatus, dueStatus);
                const invoiceBalance = isDraft ? 0 : computedTotal;

                const invoiceRecord = {
                  id: invoiceId,
                  business_id: BUSINESS_ID,
                  invoice_number: invoiceNumber,
                  customer_id: customer.id,
                  customer_name: customer.name,
                  customer_city: customer.city || '',
                  customer_phone: customer.phone || '',
                  issue_date: issueDate,
                  due_date: dueDate,
                  subtotal_paisa: computedSubtotal,
                  tax_paisa: taxPaisa,
                  discount_paisa: discountPaisa,
                  total_paisa: computedTotal,
                  paid_paisa: 0,
                  balance_due_paisa: invoiceBalance,
                  payment_status: paymentStatus,
                  due_status: dueStatus,
                  status: displayStatus,
                  reference: invoiceData.reference || '',
                  notes: invoiceData.notes || '',
                  is_draft: isDraft,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                };

                // 1. Put Invoice
                invStore.put(invoiceRecord);

                // 2. Put Line Items
                validatedItems.forEach((item, index) => {
                  itemsStore.put({
                    id: item.id || `item_${invoiceId}_${index + 1}`,
                    invoice_id: invoiceId,
                    product_id: item.product_id || '',
                    item_description: item.item_description || item.name || 'Line Item',
                    quantity: item.quantity,
                    unit: item.unit || 'Unit',
                    unit_price_paisa: item.unit_price_paisa,
                    amount_paisa: item.amount_paisa,
                    created_at: new Date().toISOString()
                  });
                });

                // 3 & 4. Only for issued invoices: atomically update Customer balance and add Ledger debit
                if (!isDraft) {
                  // Atomically update Customer financial balance
                  customer.total_invoiced_paisa = (Number(customer.total_invoiced_paisa) || 0) + computedTotal;
                  customer.balance_due_paisa = (Number(customer.balance_due_paisa) || 0) + computedTotal;
                  customer.updated_at = new Date().toISOString();
                  custStore.put(customer);

                  // Append Ledger Entry (Debit)
                  ledgStore.put({
                    id: utils.generateId('ledg'),
                    business_id: BUSINESS_ID,
                    customer_id: customer.id,
                    entry_date: issueDate,
                    entry_type: 'INVOICE',
                    reference_id: invoiceId,
                    reference_number: invoiceNumber,
                    description: `Invoice issued: ${invoiceNumber}`,
                    debit_paisa: computedTotal,
                    credit_paisa: 0,
                    running_balance_paisa: customer.balance_due_paisa,
                    created_at: new Date().toISOString()
                  });
                }

                tx.oncomplete = () => resolve(invoiceRecord);
              };
            };
          });
        });
      },

      saveDraft(invoiceData, lineItems = []) {
        return this.create({ ...invoiceData, is_draft: true }, lineItems);
      },

      getNextInvoiceNumber(issueDate) {
        return openDatabase().then(db => {
          return new Promise((resolve, reject) => {
            const tx = db.transaction([STORES.INVOICES], 'readonly');
            const store = tx.objectStore(STORES.INVOICES);
            const req = store.getAll();
            req.onerror = () => reject(req.error);
            req.onsuccess = () => {
              const existingInvoices = req.result || [];
              const year = issueDate ? new Date(issueDate).getFullYear() : new Date().getFullYear();
              const yearPrefix = `INV-${year}-`;
              let maxSeq = 1000;
              existingInvoices.forEach(inv => {
                if (inv.invoice_number && inv.invoice_number.startsWith(yearPrefix)) {
                  const numPart = parseInt(inv.invoice_number.slice(yearPrefix.length), 10);
                  if (!isNaN(numPart) && numPart > maxSeq) {
                    maxSeq = numPart;
                  }
                }
              });
              resolve(`${yearPrefix}${String(maxSeq + 1).padStart(4, '0')}`);
            };
          });
        });
      }
    },

    // 5. Payments, Allocations & Financial Hardening
    payments: {
      getAll() {
        return getAllFromStore(STORES.PAYMENTS);
      },
      getById(id) {
        if (!id) return Promise.resolve(null);
        return getFromStore(STORES.PAYMENTS, id);
      },
      getAllocations(paymentId) {
        if (!paymentId) return Promise.resolve([]);
        return openDatabase().then(db => {
          return new Promise((resolve, reject) => {
            const tx = db.transaction([STORES.ALLOCATIONS], 'readonly');
            const store = tx.objectStore(STORES.ALLOCATIONS);
            const index = store.index('payment_id');
            const req = index.getAll(paymentId);
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = (e) => reject(e.target.error);
          });
        });
      },
      getAllocationsByInvoiceId(invoiceId) {
        if (!invoiceId) return Promise.resolve([]);
        return openDatabase().then(db => {
          return new Promise((resolve, reject) => {
            const tx = db.transaction([STORES.ALLOCATIONS], 'readonly');
            const store = tx.objectStore(STORES.ALLOCATIONS);
            const index = store.index('invoice_id');
            const req = index.getAll(invoiceId);
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = (e) => reject(e.target.error);
          });
        });
      },

      /**
       * Requirement 2, 3, 4, 5, 6, 7, 8, 9:
       * Atomic Payment Recording:
       * - Validates positive integer paisa amount (> 0).
       * - Rejects allocations exceeding payment amount or invoice balance due (prevents overpayment).
       * - Rejects allocations to invoices belonging to another customer.
       * - Rejects invalid customers, missing invoices, duplicate payment numbers.
       * - Reliable unique sequential payment numbering (PAY-YYYY-XXXX).
       * - Atomic write across [payments, payment_allocations, invoices, customers, credit_ledger_entries]
       *   with complete transaction rollback on failure.
       */
      create(paymentData, allocations = []) {
        if (!paymentData || typeof paymentData !== 'object') {
          return Promise.reject(new Error('Payment data must be provided as an object.'));
        }

        // 1. Customer validation
        if (!paymentData.customer_id || typeof paymentData.customer_id !== 'string') {
          return Promise.reject(new Error('Customer ID is required to record a payment.'));
        }

        // 2. Amount validation: must be a positive safe integer (> 0)
        const amountPaisa = Number(paymentData.amount_paisa);
        if (!utils.isSafePositiveInteger(amountPaisa)) {
          return Promise.reject(new Error(`Payment amount_paisa must be a positive safe integer (received ${paymentData.amount_paisa}). Negative or zero payments are strictly rejected.`));
        }

        // 3. Payment date validation
        const paymentDate = paymentData.payment_date || new Date().toISOString().split('T')[0];
        try {
          utils.validateDateString(paymentDate, 'payment_date');
        } catch (e) {
          return Promise.reject(e);
        }

        // 4. Pre-validate allocations structure and total
        let sumAllocated = 0;
        if (!Array.isArray(allocations)) {
          return Promise.reject(new Error('Allocations must be an array.'));
        }

        for (let i = 0; i < allocations.length; i++) {
          const alloc = allocations[i];
          if (!alloc.invoice_id) {
            return Promise.reject(new Error(`Allocation ${i + 1} is missing required invoice_id.`));
          }
          const allocAmount = Number(alloc.allocated_amount_paisa);
          if (!utils.isSafePositiveInteger(allocAmount)) {
            return Promise.reject(new Error(`Allocation ${i + 1} allocated_amount_paisa must be a positive safe integer (received ${alloc.allocated_amount_paisa}).`));
          }
          sumAllocated += allocAmount;
        }

        if (sumAllocated > amountPaisa) {
          return Promise.reject(new Error(`Payment allocation total (${sumAllocated} paisa) exceeds the payment amount (${amountPaisa} paisa).`));
        }

        return openDatabase().then(db => {
          return new Promise((resolve, reject) => {
            const tx = db.transaction([
              STORES.PAYMENTS,
              STORES.ALLOCATIONS,
              STORES.INVOICES,
              STORES.CUSTOMERS,
              STORES.LEDGER
            ], 'readwrite');

            let isAborted = false;
            function abortWithError(err) {
              if (!isAborted) {
                isAborted = true;
                try { tx.abort(); } catch (_) {}
                reject(err instanceof Error ? err : new Error(String(err)));
              }
            }

            tx.onerror = function(e) {
              if (!isAborted) {
                isAborted = true;
                reject(e.target.error || new Error('Payment transaction failed.'));
              }
            };

            tx.onabort = function(e) {
              if (!isAborted) {
                isAborted = true;
                reject(tx.error || (e && e.target && e.target.error) || new Error('Payment transaction aborted.'));
              }
            };

            const payStore = tx.objectStore(STORES.PAYMENTS);
            const allocStore = tx.objectStore(STORES.ALLOCATIONS);
            const invStore = tx.objectStore(STORES.INVOICES);
            const custStore = tx.objectStore(STORES.CUSTOMERS);
            const ledgStore = tx.objectStore(STORES.LEDGER);

            // Verify customer exists
            const custReq = custStore.get(paymentData.customer_id);
            custReq.onerror = () => abortWithError(custReq.error);
            custReq.onsuccess = function() {
              const customer = custReq.result;
              if (!customer) {
                return abortWithError(new Error(`Customer not found with id: ${paymentData.customer_id}`));
              }

              // Check payment number uniqueness & generate sequential if absent
              const allPaymentsReq = payStore.getAll();
              allPaymentsReq.onerror = () => abortWithError(allPaymentsReq.error);
              allPaymentsReq.onsuccess = function() {
                const existingPayments = allPaymentsReq.result || [];
                const payYear = new Date(paymentDate).getFullYear();

                let paymentNumber = paymentData.payment_number;
                if (paymentNumber) {
                  const duplicate = existingPayments.find(p => p.payment_number === paymentNumber);
                  if (duplicate) {
                    return abortWithError(new Error(`Payment number "${paymentNumber}" already exists. Duplicate payment numbers are rejected.`));
                  }
                } else {
                  let maxSeq = 0;
                  const yearPrefix = `PAY-${payYear}-`;
                  existingPayments.forEach(p => {
                    if (p.payment_number && p.payment_number.startsWith(yearPrefix)) {
                      const numPart = parseInt(p.payment_number.slice(yearPrefix.length), 10);
                      if (!isNaN(numPart) && numPart > maxSeq) {
                        maxSeq = numPart;
                      }
                    }
                  });
                  paymentNumber = `${yearPrefix}${String(maxSeq + 1).padStart(4, '0')}`;
                }

                // If no allocations to validate against invoices, proceed directly
                if (allocations.length === 0) {
                  finalizePayment();
                  return;
                }

                // Validate each allocation against its target invoice
                let validatedAllocations = [];
                let pendingInvoices = allocations.length;

                allocations.forEach((alloc, idx) => {
                  const invReq = invStore.get(alloc.invoice_id);
                  invReq.onerror = () => abortWithError(invReq.error);
                  invReq.onsuccess = function() {
                    const invoice = invReq.result;
                    if (!invoice) {
                      return abortWithError(new Error(`Invoice not found with id: ${alloc.invoice_id}`));
                    }

                    // Requirement 4: Reject allocations to invoices belonging to another customer
                    if (invoice.customer_id !== paymentData.customer_id) {
                      return abortWithError(new Error(`Allocation error: Invoice ${invoice.invoice_number || alloc.invoice_id} belongs to customer ${invoice.customer_id}, but payment is for customer ${paymentData.customer_id}. Cross-customer allocations are strictly rejected.`));
                    }

                    // Requirement 3: Reject allocations exceeding the outstanding invoice balance (overpayment)
                    const allocAmount = Number(alloc.allocated_amount_paisa);
                    if (allocAmount > invoice.balance_due_paisa) {
                      return abortWithError(new Error(`Overpayment rejected: Allocated amount (${allocAmount} paisa) exceeds outstanding balance (${invoice.balance_due_paisa} paisa) on invoice ${invoice.invoice_number || alloc.invoice_id}.`));
                    }

                    validatedAllocations.push({
                      alloc,
                      invoice,
                      allocAmount
                    });

                    pendingInvoices--;
                    if (pendingInvoices === 0 && !isAborted) {
                      finalizePayment(validatedAllocations);
                    }
                  };
                });

                function finalizePayment(validatedAllocs = []) {
                  const paymentId = paymentData.id || utils.generateId('pay');

                  const paymentRecord = {
                    id: paymentId,
                    business_id: BUSINESS_ID,
                    payment_number: paymentNumber,
                    customer_id: customer.id,
                    customer_name: customer.name,
                    amount_paisa: amountPaisa,
                    payment_date: paymentDate,
                    payment_method: paymentData.payment_method || 'Bank Transfer',
                    reference_number: paymentData.reference_number || '',
                    notes: paymentData.notes || '',
                    created_at: new Date().toISOString()
                  };

                  // 1. Put Payment
                  payStore.put(paymentRecord);

                  // 2. Put Allocations and Update Target Invoices
                  validatedAllocs.forEach(({ alloc, invoice, allocAmount }) => {
                    const allocRecord = {
                      id: alloc.id || utils.generateId('alloc'),
                      payment_id: paymentId,
                      invoice_id: invoice.id,
                      allocated_amount_paisa: allocAmount,
                      allocated_at: new Date().toISOString()
                    };
                    allocStore.put(allocRecord);

                    // Update invoice paid & balance due
                    invoice.paid_paisa = (Number(invoice.paid_paisa) || 0) + allocAmount;
                    invoice.balance_due_paisa = Math.max(0, invoice.total_paisa - invoice.paid_paisa);
                    invoice.payment_status = utils.computePaymentStatus(invoice.total_paisa, invoice.paid_paisa);
                    invoice.due_status = utils.computeDueStatus(invoice.due_date);
                    invoice.status = utils.computeDisplayStatus(invoice.payment_status, invoice.due_status);
                    invoice.updated_at = new Date().toISOString();
                    invStore.put(invoice);
                  });

                  // 3. Update Customer Financial Balance
                  customer.total_paid_paisa = (Number(customer.total_paid_paisa) || 0) + amountPaisa;
                  customer.balance_due_paisa = Math.max(0, (Number(customer.balance_due_paisa) || 0) - amountPaisa);
                  customer.status = customer.balance_due_paisa === 0 ? 'Paid' : (customer.balance_due_paisa > 0 ? customer.status : 'Active');
                  customer.updated_at = new Date().toISOString();
                  custStore.put(customer);

                  // 4. Append Credit Ledger Entry (Credit)
                  ledgStore.put({
                    id: utils.generateId('ledg'),
                    business_id: BUSINESS_ID,
                    customer_id: customer.id,
                    entry_date: paymentDate,
                    entry_type: 'PAYMENT',
                    reference_id: paymentId,
                    reference_number: paymentNumber,
                    description: `Payment received: ${paymentRecord.payment_method} (${paymentRecord.reference_number || 'N/A'})`,
                    debit_paisa: 0,
                    credit_paisa: amountPaisa,
                    running_balance_paisa: customer.balance_due_paisa,
                    created_at: new Date().toISOString()
                  });

                  tx.oncomplete = () => resolve(paymentRecord);
                }
              };
            };
          });
        });
      }
    },

    // 6. Credit Ledger
    ledger: {
      getAll() {
        return getAllFromStore(STORES.LEDGER);
      },
      getByCustomerId(customerId) {
        if (!customerId) return Promise.resolve([]);
        return openDatabase().then(db => {
          return new Promise((resolve, reject) => {
            const tx = db.transaction([STORES.LEDGER], 'readonly');
            const store = tx.objectStore(STORES.LEDGER);
            const index = store.index('customer_id');
            const req = index.getAll(customerId);
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = (e) => reject(e.target.error);
          });
        });
      }
    },

    // 7. Reminder Settings
    reminders: {
      get() {
        return getFromStore(STORES.REMINDERS, 'rem_settings_default');
      },
      update(updates) {
        return openDatabase().then(db => {
          return new Promise((resolve, reject) => {
            const tx = db.transaction([STORES.REMINDERS], 'readwrite');
            const store = tx.objectStore(STORES.REMINDERS);
            const getReq = store.get('rem_settings_default');

            getReq.onsuccess = function() {
              const current = getReq.result || {
                id: 'rem_settings_default',
                business_id: BUSINESS_ID,
                auto_reminders_enabled: false
              };
              const updated = {
                ...current,
                ...updates,
                updated_at: new Date().toISOString()
              };
              const putReq = store.put(updated);
              putReq.onsuccess = () => resolve(updated);
              putReq.onerror = (e) => reject(e.target.error);
            };
            getReq.onerror = (e) => reject(e.target.error);
          });
        });
      }
    },

    // 8. Hardened Backup & Restore System
    backup: {
      exportJSON() {
        return openDatabase().then(db => {
          const allStoreNames = Object.values(STORES);
          const tx = db.transaction(allStoreNames, 'readonly');
          const exportData = {
            app: 'CreditFlow',
            format_version: '1.0',
            schema_version: DB_VERSION,
            exported_at: new Date().toISOString(),
            business_id: BUSINESS_ID,
            data: {}
          };

          const promises = allStoreNames.map(storeName => {
            return new Promise((resolve, reject) => {
              const store = tx.objectStore(storeName);
              const req = store.getAll();
              req.onsuccess = () => {
                exportData.data[storeName] = req.result || [];
                resolve();
              };
              req.onerror = (e) => reject(e.target.error);
            });
          });

          return Promise.all(promises).then(() => exportData);
        });
      },

      /**
       * Requirement 12: Validate backup records and relationships before replacing current data.
       * Never silently overwrite existing records if validation fails.
       */
      importJSON(jsonInput) {
        return new Promise((resolve, reject) => {
          let payload;
          try {
            payload = typeof jsonInput === 'string' ? JSON.parse(jsonInput) : jsonInput;
          } catch (err) {
            return reject(new Error('Invalid JSON: Could not parse backup file.'));
          }

          // Top-level validation
          if (!payload || typeof payload !== 'object') {
            return reject(new Error('Invalid backup structure: Payload is not an object.'));
          }
          if (payload.app !== 'CreditFlow') {
            return reject(new Error('Incompatible backup: Not a CreditFlow backup file.'));
          }
          if (Number(payload.schema_version) !== DB_VERSION) {
            return reject(new Error(`Incompatible schema version: Expected ${DB_VERSION}, found ${payload.schema_version}.`));
          }
          if (!payload.data || typeof payload.data !== 'object') {
            return reject(new Error('Missing data collection payload in backup file.'));
          }

          const requiredStores = Object.values(STORES);
          for (const s of requiredStores) {
            if (!Array.isArray(payload.data[s])) {
              return reject(new Error(`Corrupted backup: Missing store array '${s}'.`));
            }
          }

          // Deep Relational Integrity & Safe Integer Validation BEFORE touching DB:
          const {
            customers = [],
            invoices = [],
            invoice_items = [],
            payments = [],
            payment_allocations = [],
            credit_ledger_entries = []
          } = payload.data;

          // 1. Customers map
          const customerIds = new Set();
          for (const c of customers) {
            if (!c.id || typeof c.id !== 'string') {
              return reject(new Error('Backup validation error: Customer record missing id.'));
            }
            if (!c.name || typeof c.name !== 'string') {
              return reject(new Error(`Backup validation error: Customer ${c.id} missing name.`));
            }
            if (!utils.isSafeNonNegativeInteger(c.balance_due_paisa)) {
              return reject(new Error(`Backup validation error: Customer ${c.id} has invalid balance_due_paisa.`));
            }
            customerIds.add(c.id);
          }

          // 2. Invoices map
          const invoiceIds = new Map();
          const invoiceNumbers = new Set();
          for (const inv of invoices) {
            if (!inv.id || typeof inv.id !== 'string') {
              return reject(new Error('Backup validation error: Invoice missing id.'));
            }
            if (!inv.invoice_number || typeof inv.invoice_number !== 'string') {
              return reject(new Error(`Backup validation error: Invoice ${inv.id} missing invoice_number.`));
            }
            if (invoiceNumbers.has(inv.invoice_number)) {
              return reject(new Error(`Backup validation error: Duplicate invoice number "${inv.invoice_number}".`));
            }
            invoiceNumbers.add(inv.invoice_number);

            // Foreign key to customer
            if (!customerIds.has(inv.customer_id)) {
              return reject(new Error(`Backup foreign key broken: Invoice ${inv.invoice_number} references non-existent customer ${inv.customer_id}.`));
            }

            if (!utils.isSafePositiveInteger(inv.total_paisa)) {
              return reject(new Error(`Backup validation error: Invoice ${inv.invoice_number} has non-positive total_paisa.`));
            }
            if (!utils.isSafeNonNegativeInteger(inv.paid_paisa) || !utils.isSafeNonNegativeInteger(inv.balance_due_paisa)) {
              return reject(new Error(`Backup validation error: Invoice ${inv.invoice_number} has invalid paid or balance_due amounts.`));
            }
            if (inv.total_paisa !== inv.paid_paisa + inv.balance_due_paisa) {
              return reject(new Error(`Backup financial mismatch: Invoice ${inv.invoice_number} total (${inv.total_paisa}) does not equal paid (${inv.paid_paisa}) + balance due (${inv.balance_due_paisa}).`));
            }
            invoiceIds.set(inv.id, inv);
          }

          // 3. Line items foreign key check
          for (const item of invoice_items) {
            if (!item.invoice_id || !invoiceIds.has(item.invoice_id)) {
              return reject(new Error(`Backup foreign key broken: Line item ${item.id} references non-existent invoice ${item.invoice_id}.`));
            }
            if (typeof item.quantity !== 'number' || item.quantity <= 0) {
              return reject(new Error(`Backup validation error: Line item ${item.id} has invalid quantity.`));
            }
          }

          // 4. Payments map
          const paymentIds = new Map();
          const paymentNumbers = new Set();
          for (const p of payments) {
            if (!p.id || typeof p.id !== 'string') {
              return reject(new Error('Backup validation error: Payment record missing id.'));
            }
            if (!p.payment_number || typeof p.payment_number !== 'string') {
              return reject(new Error(`Backup validation error: Payment ${p.id} missing payment_number.`));
            }
            if (paymentNumbers.has(p.payment_number)) {
              return reject(new Error(`Backup validation error: Duplicate payment number "${p.payment_number}".`));
            }
            paymentNumbers.add(p.payment_number);

            // Foreign key to customer
            if (!customerIds.has(p.customer_id)) {
              return reject(new Error(`Backup foreign key broken: Payment ${p.payment_number} references non-existent customer ${p.customer_id}.`));
            }
            if (!utils.isSafePositiveInteger(p.amount_paisa)) {
              return reject(new Error(`Backup validation error: Payment ${p.payment_number} has non-positive amount_paisa.`));
            }
            paymentIds.set(p.id, p);
          }

          // 5. Payment allocations relational check
          const allocSumsByPayment = new Map();
          const allocSumsByInvoice = new Map();

          for (const alloc of payment_allocations) {
            const pay = paymentIds.get(alloc.payment_id);
            if (!pay) {
              return reject(new Error(`Backup foreign key broken: Allocation references non-existent payment ${alloc.payment_id}.`));
            }
            const inv = invoiceIds.get(alloc.invoice_id);
            if (!inv) {
              return reject(new Error(`Backup foreign key broken: Allocation references non-existent invoice ${alloc.invoice_id}.`));
            }
            if (pay.customer_id !== inv.customer_id) {
              return reject(new Error(`Backup relational conflict: Allocation references payment for customer ${pay.customer_id} but invoice for customer ${inv.customer_id}.`));
            }
            if (!utils.isSafePositiveInteger(alloc.allocated_amount_paisa)) {
              return reject(new Error(`Backup validation error: Allocation has invalid allocated_amount_paisa.`));
            }

            allocSumsByPayment.set(pay.id, (allocSumsByPayment.get(pay.id) || 0) + alloc.allocated_amount_paisa);
            allocSumsByInvoice.set(inv.id, (allocSumsByInvoice.get(inv.id) || 0) + alloc.allocated_amount_paisa);
          }

          for (const [pId, sumAlloc] of allocSumsByPayment) {
            const pay = paymentIds.get(pId);
            if (sumAlloc > pay.amount_paisa) {
              return reject(new Error(`Backup financial mismatch: Total allocations (${sumAlloc}) exceed payment ${pay.payment_number} amount (${pay.amount_paisa}).`));
            }
          }

          for (const [invId, sumAlloc] of allocSumsByInvoice) {
            const inv = invoiceIds.get(invId);
            if (sumAlloc > inv.total_paisa) {
              return reject(new Error(`Backup financial mismatch: Total allocations (${sumAlloc}) exceed invoice ${inv.invoice_number} total (${inv.total_paisa}).`));
            }
          }

          // 6. Ledger entries check
          for (const ledg of credit_ledger_entries) {
            if (!customerIds.has(ledg.customer_id)) {
              return reject(new Error(`Backup foreign key broken: Ledger entry references non-existent customer ${ledg.customer_id}.`));
            }
          }

          // All validations passed! Proceed with atomic wipe and restore
          openDatabase().then(db => {
            const tx = db.transaction(requiredStores, 'readwrite');
            tx.onerror = (e) => reject(e.target.error);
            tx.oncomplete = () => {
              resolve({
                success: true,
                restored_at: new Date().toISOString(),
                record_counts: Object.fromEntries(
                  requiredStores.map(s => [s, payload.data[s].length])
                )
              });
            };

            requiredStores.forEach(storeName => {
              const store = tx.objectStore(storeName);
              store.clear();
              payload.data[storeName].forEach(record => {
                store.put(record);
              });
            });
          }).catch(reject);
        });
      }
    }
  };

  root.CreditFlowDB = CreditFlowDB;

  if (typeof window !== 'undefined') {
    CreditFlowDB.init().catch(err => {
      console.warn('[CreditFlowDB] Initialization warning:', err);
    });
  }

})(typeof window !== 'undefined' ? window : this);
