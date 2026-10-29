import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// Mapping of clean route paths to their corresponding screen HTML files
const screenRoutes = {
  '/': 'screens/creditflow_main_dashboard/code.html',
  '/dashboard': 'screens/creditflow_main_dashboard/code.html',
  '/overview': 'screens/creditflow_main_dashboard/code.html',
  '/customers': 'screens/creditflow_customers_directory/code.html',
  '/customer-profile': 'screens/creditflow_customer_profile_invoices/code.html',
  '/customers/profile': 'screens/creditflow_customer_profile_invoices/code.html',
  '/invoices': 'screens/creditflow_invoices_management/code.html',
  '/create-invoice': 'screens/creditflow_create_invoice/code.html',
  '/invoices/create': 'screens/creditflow_create_invoice/code.html',
  '/invoice-details': 'screens/creditflow_invoice_details/code.html',
  '/invoices/details': 'screens/creditflow_invoice_details/code.html',
  '/payments': 'screens/creditflow_payments/code.html',
  '/record-payment': 'screens/creditflow_record_payment/code.html',
  '/payments/record': 'screens/creditflow_record_payment/code.html',
  '/credit-ledger': 'screens/creditflow_credit_ledger/code.html',
  '/reminders': 'screens/creditflow_payment_reminders/code.html',
  '/payment-reminders': 'screens/creditflow_payment_reminders/code.html',
  '/reminder-settings': 'screens/creditflow_reminder_settings/code.html',
  '/reminders/settings': 'screens/creditflow_reminder_settings/code.html',
  '/reports': 'screens/creditflow_reports_analytics/code.html',
  '/reports-analytics': 'screens/creditflow_reports_analytics/code.html',
  '/products': 'screens/creditflow_products_services/code.html',
  '/products-services': 'screens/creditflow_products_services/code.html',
  '/settings': 'screens/creditflow_business_settings/code.html',
  '/business-settings': 'screens/creditflow_business_settings/code.html',
  '/team-permissions': 'screens/creditflow_team_permissions/code.html',
  '/settings/team': 'screens/creditflow_team_permissions/code.html',
  '/subscription-billing': 'screens/creditflow_subscription_billing/code.html',
  '/settings/billing': 'screens/creditflow_subscription_billing/code.html',
  '/notifications': 'screens/creditflow_notifications/code.html',
  '/login': 'screens/creditflow_sign_in_platform_overview/code.html',
  '/signin': 'screens/creditflow_sign_in_platform_overview/code.html',
  '/signup': 'screens/creditflow_create_your_account/code.html',
  '/create-account': 'screens/creditflow_create_your_account/code.html',
  '/onboarding': 'screens/creditflow_business_details_onboarding/code.html',
  '/library': 'index.html',
  '/screens-library': 'index.html'
};

// 404 Not Found Page Template matching CreditFlow design system
const notFoundHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>404 - Page Not Found | CreditFlow</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>body { font-family: 'Inter', sans-serif; }</style>
</head>
<body class="bg-slate-50 text-slate-800 min-h-screen flex items-center justify-center p-6 antialiased">
  <div class="max-w-md w-full bg-white rounded-2xl border border-slate-200/90 shadow-sm p-8 text-center">
    <div class="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-5 font-bold text-lg">
      <svg class="w-7 h-7" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
    <div class="text-xs font-bold tracking-wider text-emerald-600 uppercase mb-1">Error 404</div>
    <h1 class="text-2xl font-extrabold text-slate-900 tracking-tight">Page Not Found</h1>
    <p class="text-sm text-slate-500 mt-2 leading-relaxed">
      The requested route does not exist in the CreditFlow application.
    </p>
    <div class="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
      <a href="/dashboard" class="inline-flex items-center justify-center px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors">
        Back to Dashboard
      </a>
      <a href="/library" class="inline-flex items-center justify-center px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-lg transition-colors">
        Screen Library
      </a>
    </div>
  </div>
</body>
</html>`;

// Helper to serve screen HTML with navigation script injected
function serveHtmlWithNav(filePath, res) {
  const absolutePath = path.join(__dirname, filePath);
  if (!fs.existsSync(absolutePath)) {
    return res.status(404).send(notFoundHtml);
  }

  let content = fs.readFileSync(absolutePath, 'utf-8');
  const scriptsTag = '<script src="/creditflow-db.js"></script><script src="/creditflow-nav.js"></script>';

  if (content.includes('</body>')) {
    content = content.replace('</body>', `${scriptsTag}</body>`);
  } else {
    content += scriptsTag;
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.send(content);
}

// Serve storage & navigation handler scripts
app.get('/creditflow-db.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'creditflow-db.js'));
});

app.get('/creditflow-nav.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'creditflow-nav.js'));
});

// Clean application routes
Object.entries(screenRoutes).forEach(([route, relPath]) => {
  app.get(route, (req, res) => {
    serveHtmlWithNav(relPath, res);
  });
});

// Direct access to original screen paths (/screens/*/*.html)
app.get('/screens/*/*.html', (req, res, next) => {
  const filePath = req.path.slice(1);
  if (fs.existsSync(path.join(__dirname, filePath))) {
    return serveHtmlWithNav(filePath, res);
  }
  next();
});

// Static assets (images, screenshots, manifest, etc.)
app.use(express.static(__dirname, {
  index: false
}));

// Proper 404 handler for all unknown routes
app.use((req, res) => {
  res.status(404).send(notFoundHtml);
});

app.listen(PORT, HOST, () => {
  console.log(`CreditFlow running with stable navigation at http://${HOST}:${PORT}`);
});
