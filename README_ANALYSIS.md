# CREDITFLOW — ZIP INSPECTION & MERGE REPORT

## Summary
- Input ZIP 1: 15 standalone screen folders (15 HTML, 15 PNG).
- Input ZIP 2: 5 standalone screen folders (5 HTML, 5 PNG).
- Combined: 20 screens (20 HTML and 20 PNG) with no conflicting paths.
- Integrity: archives passed ZIP CRC test; combined output re-verified.
- Original exported HTML and PNG files are preserved byte-for-byte.
- INDEX.html is a separate browseable catalogue of the 20 screens.

## What is inside
Each `screens/<screen-folder>/` holds `code.html` and `screen.png`.
`code.html` is a standalone, static Stitch UI design; `screen.png` is a visual reference.

## Findings (verified from the source code)
1. All 20 HTML files load Tailwind through `https://cdn.tailwindcss.com`, which is for prototypes, not production builds.
2. Screen HTML has no attached event handlers or application data layer. Most navigation anchors are `href="#"` placeholders. Some screens have forms, but form UI is not authentication or validated persistence.
3. There is no shared frontend app/router, `package.json`, SQL migration, authentication wiring, Supabase connection, server-side invoice calculation, or background reminder worker in either ZIP.
4. There is no implemented Print Invoice / Download PDF generation or printer interface in these exports.
5. The screenshots and hard-coded business figures are illustrative; do not interpret them as real payments, sent reminders, or billing events.
6. Fonts/styles use external URLs, so opening static files without internet may not reproduce the exact design.
7. The source HTML pages do not contain runtime wiring between screen folders. Use INDEX.html for manual navigation through previews.

## Priority improvements before production implementation
- Reconcile example invoice totals, payments, balance due, and dates across screens.
- Treat due-date state separately from payment state (partial payment may also be overdue).
- Build one consistent app shell and shared components rather than shipping 20 disconnected HTML pages.
- Add working account creation/auth, organization membership, role permissions, tenant isolation and RLS.
- Implement customers, invoices, payment allocations, journal/ledger and audit trails with server-side decimal money calculations.
- Implement invoice print: printable A4 HTML / browser print dialog, and accurate PDF generation and reprint from Invoice Details. A printer is selected by the user's browser/OS; no direct automatic printer connection is demonstrated in the ZIP.
- Set up reminders only after email or WhatsApp providers are configured, consent is handled, and eligible invoices are rechecked before sending.
- Add accessible keyboard behaviors, form validation, responsive layouts, error/empty/loading states and tests.

## Development guidance
Use these files as visual input for the approved Google Stitch → GitHub → Google AI Studio → Supabase workflow. Do not assume exported Tailwind HTML is a complete product or upload private credentials into static files.

## Screen inventory
01. Login — ZIP 1, 3 buttons, 4 inputs, 2 placeholder links
02. Create account — ZIP 1, 3 buttons, 6 inputs, 3 placeholder links
03. Business onboarding — ZIP 1, 2 buttons, 3 inputs, 0 placeholder links
04. Dashboard / Overview — ZIP 1, 10 buttons, 1 inputs, 11 placeholder links
05. Customers list — ZIP 1, 14 buttons, 2 inputs, 10 placeholder links
06. Customer profile — ZIP 1, 17 buttons, 2 inputs, 12 placeholder links
07. Invoices list — ZIP 1, 23 buttons, 13 inputs, 10 placeholder links
08. Create invoice — ZIP 1, 12 buttons, 17 inputs, 11 placeholder links
09. Invoice details — ZIP 1, 5 buttons, 1 inputs, 11 placeholder links
10. Payments list — ZIP 1, 21 buttons, 13 inputs, 10 placeholder links
11. Record payment — ZIP 1, 5 buttons, 3 inputs, 13 placeholder links
12. Credit ledger — ZIP 1, 6 buttons, 2 inputs, 20 placeholder links
13. Payment reminders — ZIP 1, 26 buttons, 2 inputs, 19 placeholder links
14. Reminder settings — ZIP 1, 8 buttons, 10 inputs, 10 placeholder links
15. Reports & analytics — ZIP 1, 7 buttons, 1 inputs, 11 placeholder links
16. Products & services — ZIP 2, 19 buttons, 2 inputs, 10 placeholder links
17. Team & permissions — ZIP 2, 8 buttons, 2 inputs, 10 placeholder links
18. Business settings — ZIP 2, 3 buttons, 4 inputs, 10 placeholder links
19. Subscription & billing — ZIP 2, 10 buttons, 1 inputs, 13 placeholder links
20. Notifications — ZIP 2, 19 buttons, 1 inputs, 21 placeholder links
