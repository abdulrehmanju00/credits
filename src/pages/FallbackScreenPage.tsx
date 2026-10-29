import React, { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const screenFileMap: Record<string, { path: string; name: string }> = {
  '/customers': {
    path: '/screens/creditflow_customers_directory/code.html',
    name: 'Customers Directory'
  },
  '/customer-profile': {
    path: '/screens/creditflow_customer_profile_invoices/code.html',
    name: 'Customer Profile'
  },
  '/customers/profile': {
    path: '/screens/creditflow_customer_profile_invoices/code.html',
    name: 'Customer Profile'
  },
  '/invoices': {
    path: '/screens/creditflow_invoices_management/code.html',
    name: 'Invoices Management'
  },
  '/create-invoice': {
    path: '/screens/creditflow_create_invoice/code.html',
    name: 'Create Invoice'
  },
  '/invoices/create': {
    path: '/screens/creditflow_create_invoice/code.html',
    name: 'Create Invoice'
  },
  '/invoice-details': {
    path: '/screens/creditflow_invoice_details/code.html',
    name: 'Invoice Details'
  },
  '/invoices/details': {
    path: '/screens/creditflow_invoice_details/code.html',
    name: 'Invoice Details'
  },
  '/payments': {
    path: '/screens/creditflow_payments/code.html',
    name: 'Payments History'
  },
  '/record-payment': {
    path: '/screens/creditflow_record_payment/code.html',
    name: 'Record Payment'
  },
  '/payments/record': {
    path: '/screens/creditflow_record_payment/code.html',
    name: 'Record Payment'
  },
  '/credit-ledger': {
    path: '/screens/creditflow_credit_ledger/code.html',
    name: 'Credit Ledger'
  },
  '/reminders': {
    path: '/screens/creditflow_payment_reminders/code.html',
    name: 'Payment Reminders'
  },
  '/payment-reminders': {
    path: '/screens/creditflow_payment_reminders/code.html',
    name: 'Payment Reminders'
  },
  '/reminder-settings': {
    path: '/screens/creditflow_reminder_settings/code.html',
    name: 'Reminder Settings'
  },
  '/reminders/settings': {
    path: '/screens/creditflow_reminder_settings/code.html',
    name: 'Reminder Settings'
  },
  '/reports': {
    path: '/screens/creditflow_reports_analytics/code.html',
    name: 'Reports & Analytics'
  },
  '/reports-analytics': {
    path: '/screens/creditflow_reports_analytics/code.html',
    name: 'Reports & Analytics'
  },
  '/products': {
    path: '/screens/creditflow_products_services/code.html',
    name: 'Products & Services'
  },
  '/products-services': {
    path: '/screens/creditflow_products_services/code.html',
    name: 'Products & Services'
  },
  '/settings': {
    path: '/screens/creditflow_business_settings/code.html',
    name: 'Business Settings'
  },
  '/business-settings': {
    path: '/screens/creditflow_business_settings/code.html',
    name: 'Business Settings'
  },
  '/team-permissions': {
    path: '/screens/creditflow_team_permissions/code.html',
    name: 'Team & Permissions'
  },
  '/settings/team': {
    path: '/screens/creditflow_team_permissions/code.html',
    name: 'Team & Permissions'
  },
  '/subscription-billing': {
    path: '/screens/creditflow_subscription_billing/code.html',
    name: 'Subscription & Billing'
  },
  '/settings/billing': {
    path: '/screens/creditflow_subscription_billing/code.html',
    name: 'Subscription & Billing'
  },
  '/notifications': {
    path: '/screens/creditflow_notifications/code.html',
    name: 'Notifications'
  },
  '/onboarding': {
    path: '/screens/creditflow_business_details_onboarding/code.html',
    name: 'Business Onboarding'
  },
  '/signup': {
    path: '/screens/creditflow_create_your_account/code.html',
    name: 'Create Account'
  },
  '/create-account': {
    path: '/screens/creditflow_create_your_account/code.html',
    name: 'Create Account'
  },
  '/login': {
    path: '/screens/creditflow_sign_in_platform_overview/code.html',
    name: 'Sign In'
  },
  '/signin': {
    path: '/screens/creditflow_sign_in_platform_overview/code.html',
    name: 'Sign In'
  }
};

export const FallbackScreenPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Normalize pathname by removing trailing slash if present
  const currentPath = location.pathname.length > 1 && location.pathname.endsWith('/')
    ? location.pathname.slice(0, -1)
    : location.pathname;

  const screenMeta = screenFileMap[currentPath] || {
    path: '/screens/creditflow_customers_directory/code.html',
    name: 'Screen'
  };

  const handleIframeLoad = () => {
    try {
      const iframeDoc = iframeRef.current?.contentDocument;
      if (!iframeDoc) return;

      // Intercept any direct link clicks inside the iframe to navigate top-level React Router
      const handleDocClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement | null;
        const anchor = target?.closest('a') as HTMLAnchorElement | null;
        if (anchor && anchor.href && !anchor.href.startsWith('javascript:')) {
          try {
            const url = new URL(anchor.href, window.location.origin);
            if (url.origin === window.location.origin && url.pathname && !url.hash.startsWith('#')) {
              e.preventDefault();
              navigate(url.pathname);
            }
          } catch {
            // Keep default
          }
        }
      };

      iframeDoc.addEventListener('click', handleDocClick, true);
    } catch {
      // In case of cross-origin or sandbox restrictions, fallback gracefully
    }
  };

  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden bg-[#F8FAFC] z-10 m-0 p-0 border-0">
      <iframe
        ref={iframeRef}
        key={screenMeta.path}
        src={screenMeta.path}
        title={screenMeta.name}
        onLoad={handleIframeLoad}
        className="w-full h-full border-0 block m-0 p-0"
      />
    </div>
  );
};

export default FallbackScreenPage;
