import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { CreditFlowProvider } from './context/CreditFlowContext';
import { AppLayout } from './components/layout/AppLayout';
import { OverviewPage } from './pages/OverviewPage';
import { CustomersPage } from './pages/CustomersPage';
import { CustomerProfilePage } from './pages/CustomerProfilePage';
import { ProductsPage } from './pages/ProductsPage';
import { CreateInvoicePage } from './pages/CreateInvoicePage';
import { InvoiceDetailsPage } from './pages/InvoiceDetailsPage';
import { FallbackScreenPage } from './pages/FallbackScreenPage';
import { InvoicesPage, PaymentsPage, RecordPaymentPage, LedgerPage } from './pages/DemoFinancePages';

export const App: React.FC = () => {
  return (
    <CreditFlowProvider>
      <BrowserRouter>
        <Routes>
          {/* Native React screens with single React Sidebar and TopBar */}
          <Route element={<AppLayout />}>
            <Route index element={<OverviewPage />} />
            <Route path="dashboard" element={<OverviewPage />} />
            <Route path="overview" element={<OverviewPage />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="customer-profile" element={<CustomerProfilePage />} />
            <Route path="customers/profile" element={<CustomerProfilePage />} />
            <Route path="customers/:id" element={<CustomerProfilePage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="products-services" element={<ProductsPage />} />
            <Route path="create-invoice" element={<CreateInvoicePage />} />
            <Route path="invoices/create" element={<CreateInvoicePage />} />
            <Route path="invoice-details" element={<InvoiceDetailsPage />} />
            <Route path="invoices/details" element={<InvoiceDetailsPage />} />
            <Route path="invoices/:id" element={<InvoiceDetailsPage />} />
          </Route>

          {/* Unmigrated Stitch screens: rendered standalone at 100% full-viewport with their authentic single sidebar & topbar */}
          {/* Invoices */}
          <Route path="invoices" element={<AppLayout />}><Route index element={<InvoicesPage />}/></Route>

          {/* Payments */}
          <Route path="payments" element={<AppLayout />}><Route index element={<PaymentsPage />}/></Route>
          <Route path="record-payment" element={<AppLayout />}><Route index element={<RecordPaymentPage />}/></Route>
          <Route path="payments/record" element={<AppLayout />}><Route index element={<RecordPaymentPage />}/></Route>

          {/* Credit Ledger */}
          <Route path="credit-ledger" element={<AppLayout />}><Route index element={<LedgerPage />}/></Route>

          {/* Reminders */}
          <Route path="reminders" element={<FallbackScreenPage />} />
          <Route path="payment-reminders" element={<FallbackScreenPage />} />
          <Route path="reminder-settings" element={<FallbackScreenPage />} />
          <Route path="reminders/settings" element={<FallbackScreenPage />} />

          {/* Reports */}
          <Route path="reports" element={<FallbackScreenPage />} />
          <Route path="reports-analytics" element={<FallbackScreenPage />} />

          {/* Settings & Sub-pages */}
          <Route path="settings" element={<FallbackScreenPage />} />
          <Route path="business-settings" element={<FallbackScreenPage />} />
          <Route path="team-permissions" element={<FallbackScreenPage />} />
          <Route path="settings/team" element={<FallbackScreenPage />} />
          <Route path="subscription-billing" element={<FallbackScreenPage />} />
          <Route path="settings/billing" element={<FallbackScreenPage />} />

          {/* Notifications */}
          <Route path="notifications" element={<FallbackScreenPage />} />

          {/* Auth & Onboarding */}
          <Route path="onboarding" element={<FallbackScreenPage />} />
          <Route path="signup" element={<FallbackScreenPage />} />
          <Route path="create-account" element={<FallbackScreenPage />} />
          <Route path="login" element={<FallbackScreenPage />} />
          <Route path="signin" element={<FallbackScreenPage />} />

          {/* 404 Route */}
          <Route
            path="*"
            element={
              <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 text-center">
                <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
                  <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4 font-bold text-lg">
                    404
                  </div>
                  <h1 className="text-2xl font-extrabold text-[#0F172A] mb-2">Page Not Found</h1>
                  <p className="text-xs text-[#64748B] mb-6">
                    The requested page could not be located in CreditFlow.
                  </p>
                  <Link
                    to="/dashboard"
                    className="inline-flex items-center justify-center px-4 py-2.5 bg-[#059669] hover:bg-[#047857] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
                  >
                    Return to Overview
                  </Link>
                </div>
              </div>
            }
          />
        </Routes>
      </BrowserRouter>
    </CreditFlowProvider>
  );
};

export default App;
