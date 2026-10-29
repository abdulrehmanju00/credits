CREDITFLOW DEMO PATCH — 2026-10-29
Original 20 Stitch references retained.
Added native React Invoices list, Payments list, Record Payment form, and Ledger summary.
This is a local IndexedDB demo only. No production authentication, cloud DB, email/WhatsApp or live bank transfers.
Requirements: install packages (npm install), run npm run dev, then check routes.
Important: Full dependency build and browser end-to-end tests were unavailable in this environment. These new pages have been syntax-transpilation checked only; please test actual payment save and print before presenting.
Routes: /dashboard /customers /products /invoices /invoices/create /invoices/:id /payments /payments/record /credit-ledger.
Do not enter real customer financial details. Use fictional data.
Save a separate backup of the original ZIP. Do not replace it without validation.
