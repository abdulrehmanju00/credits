/**
 * CreditFlow - Robust Navigation and Interaction Controller
 * Stabilizes navigation, enforces honest record handling, and prevents misleading action simulations.
 */
(function() {
  'use strict';

  // Notification Toast Helper
  function showDemoNotice(message, isWarning = false) {
    const existing = document.getElementById('cf-demo-notice');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'cf-demo-notice';
    toast.setAttribute('role', 'alert');
    toast.style.cssText = [
      'position: fixed',
      'bottom: 24px',
      'left: 50%',
      'transform: translateX(-50%)',
      'background: #0f172a',
      'color: #ffffff',
      'padding: 10px 18px',
      'border-radius: 10px',
      'font-size: 13px',
      'font-family: Inter, system-ui, sans-serif',
      'box-shadow: 0 10px 25px rgba(0, 0, 0, 0.25)',
      'z-index: 9999999',
      'display: flex',
      'align-items: center',
      'gap: 10px',
      'border: 1px solid rgba(255, 255, 255, 0.15)',
      'max-width: 90vw',
      'line-height: 1.4'
    ].join(';');

    const iconColor = isWarning ? '#fbbf24' : '#34d399';
    toast.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2" style="flex-shrink:0;">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <span>${message}</span>
    `;

    document.body.appendChild(toast);
    setTimeout(() => {
      if (toast && toast.parentNode) toast.remove();
    }, 4000);
  }

  // Safe top-level navigation helper to prevent iframe recursion
  function navigateApp(url) {
    if (window.top && window.top !== window) {
      window.top.location.href = url;
    } else {
      window.location.href = url;
    }
  }

  function getNormalizedPath() {
    const p = window.location.pathname.toLowerCase();
    if (p.endsWith('/') && p.length > 1) {
      return p.slice(0, -1);
    }
    return p;
  }

  function setupSidebarNavigation(currentPath) {
    const sidebarNavMap = [
      { key: 'overview', route: '/dashboard', labelMatcher: /overview/i },
      { key: 'customers', route: '/customers', labelMatcher: /customers/i },
      { key: 'invoices', route: '/invoices', labelMatcher: /invoices/i },
      { key: 'payments', route: '/payments', labelMatcher: /payments/i },
      { key: 'credit ledger', route: '/credit-ledger', labelMatcher: /credit\s*ledger/i },
      { key: 'reminders', route: '/reminders', labelMatcher: /reminders/i },
      { key: 'reports', route: '/reports', labelMatcher: /reports/i },
      { key: 'products & services', route: '/products', labelMatcher: /products/i },
      { key: 'settings', route: '/settings', labelMatcher: /settings/i }
    ];

    // Determine current section
    let activeKey = '';
    if (currentPath === '/' || currentPath === '/dashboard' || currentPath === '/overview' || currentPath.includes('main_dashboard')) {
      activeKey = 'overview';
    } else if (currentPath.includes('customer')) {
      activeKey = 'customers';
    } else if (currentPath.includes('invoice')) {
      activeKey = 'invoices';
    } else if (currentPath.includes('payment') && !currentPath.includes('reminder')) {
      activeKey = 'payments';
    } else if (currentPath.includes('credit_ledger') || currentPath.includes('credit-ledger')) {
      activeKey = 'credit ledger';
    } else if (currentPath.includes('reminder')) {
      activeKey = 'reminders';
    } else if (currentPath.includes('report')) {
      activeKey = 'reports';
    } else if (currentPath.includes('product')) {
      activeKey = 'products & services';
    } else if (currentPath.includes('setting') || currentPath.includes('permission') || currentPath.includes('subscription')) {
      activeKey = 'settings';
    }

    // Target explicit sidebar links
    const sidebarNavLinks = document.querySelectorAll('aside nav a');
    sidebarNavLinks.forEach(link => {
      const text = (link.textContent || '').trim();
      const matched = sidebarNavMap.find(item => item.labelMatcher.test(text));

      if (matched) {
        link.dataset.cfNav = matched.key;
        link.href = matched.route;
        link.onclick = (e) => {
          e.preventDefault();
          navigateApp(matched.route);
        };

        // Synchronize active states cleanly
        if (activeKey && matched.key === activeKey) {
          link.classList.remove('text-slate-600', 'text-[#64748b]', 'text-[#475569]');
          link.classList.add('bg-[#E8F8F2]', 'text-[#00875A]', 'font-semibold');
          const svg = link.querySelector('svg');
          if (svg) {
            svg.classList.remove('text-slate-400', 'text-slate-500', 'text-[#64748b]');
            svg.classList.add('text-[#00875A]');
          }
        } else if (activeKey) {
          link.classList.remove(
            'bg-[#E8F8F2]', 'bg-[#E6F7F0]', 'bg-[#eaf7f0]', 'bg-emerald-50',
            'bg-[#e8f7f0]', 'bg-[#e8f8f0]', 'bg-emerald-50/80',
            'text-[#00875A]', 'text-[#047857]', 'text-[#059669]',
            'text-emerald-700', 'text-emerald-800', 'text-[#00a86b]', 'text-[#0f766e]',
            'font-semibold'
          );
          if (!link.classList.contains('text-slate-600')) {
            link.classList.add('text-slate-600', 'hover:bg-slate-50', 'hover:text-slate-900', 'font-medium');
          }
          const svg = link.querySelector('svg');
          if (svg) {
            svg.classList.remove('text-[#00875A]', 'text-[#047857]', 'text-[#059669]', 'text-emerald-600');
            if (!svg.classList.contains('text-slate-400') && !svg.classList.contains('text-slate-500')) {
              svg.classList.add('text-slate-400');
            }
          }
        }
      }
    });

    // Sidebar Help & Support link
    const helpLinks = document.querySelectorAll('aside a');
    helpLinks.forEach(link => {
      const text = (link.textContent || '').trim().toLowerCase();
      if (text.includes('help')) {
        link.dataset.cfAction = 'help';
        link.href = '#';
        link.onclick = (e) => {
          e.preventDefault();
          showDemoNotice('Help & Support documentation is a non-functional placeholder in this demo.');
        };
      }
    });

    // CreditFlow Logo Click -> /dashboard
    document.querySelectorAll('aside .h-16, aside .h-20').forEach(header => {
      if ((header.textContent || '').includes('CreditFlow')) {
        header.style.cursor = 'pointer';
        header.title = 'Back to Overview';
        header.onclick = () => {
          navigateApp('/dashboard');
        };
      }
    });
  }

  function setupHeaderControls() {
    // Notification Bell
    document.querySelectorAll('button[aria-label="Notifications"], header button').forEach(btn => {
      const isBell = btn.getAttribute('aria-label') === 'Notifications' ||
                     btn.querySelector('svg path[d*="17h5"], svg path[d*="17.082"]') ||
                     btn.querySelector('.bg-red-500, .bg-rose-500');
      if (isBell) {
        btn.dataset.cfNav = 'notifications';
        btn.style.cursor = 'pointer';
        btn.onclick = (e) => {
          e.preventDefault();
          navigateApp('/notifications');
        };
      }
    });

    // User Profile Pill -> /settings
    document.querySelectorAll('header .cursor-pointer').forEach(pill => {
      if ((pill.textContent || '').includes('Ali Shah') || (pill.textContent || '').includes('Shah Traders')) {
        pill.dataset.cfNav = 'settings';
        pill.title = 'Open Business Settings';
        pill.onclick = () => {
          navigateApp('/settings');
        };
      }
    });
  }

  // Intercept and prevent misleading data actions
  function preventMisleadingActions() {
    const unavailMsg = 'This feature is not available in the current demo.';

    // Form submissions (Create Invoice, Record Payment, Reminder Settings, Business Settings)
    document.querySelectorAll('form').forEach(form => {
      // Exclude login/signup/onboarding demo flows handled separately
      const isAuthForm = window.location.pathname.includes('login') ||
                         window.location.pathname.includes('signup') ||
                         window.location.pathname.includes('onboarding') ||
                         window.location.pathname.includes('sign_in') ||
                         window.location.pathname.includes('create_your_account') ||
                         window.location.pathname.includes('business_details_onboarding');
      if (!isAuthForm) {
        form.onsubmit = (e) => {
          e.preventDefault();
          showDemoNotice(unavailMsg, true);
        };
      }
    });

    // Specific Action Buttons across screens
    document.querySelectorAll('button, a').forEach(el => {
      const text = (el.textContent || '').trim().toLowerCase();

      // Data saving actions
      const isSaveAction =
        text === 'save invoice' ||
        text === 'save & send' ||
        text === 'save as draft' ||
        text === 'save changes' ||
        text === 'save payment' ||
        text === 'record payment' && el.closest('form') ||
        text === 'add customer' ||
        text === 'invite member' ||
        text === 'add user' ||
        text === 'send invoice' ||
        text === 'download pdf' ||
        text === 'new item' ||
        text === 'add product' ||
        text === 'send reminder';

      if (isSaveAction && el.tagName === 'BUTTON') {
        el.dataset.cfAction = 'prevent-simulation';
        el.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          showDemoNotice(unavailMsg, true);
        };
      }
    });
  }

  // Screen-specific Honest Navigation
  function setupScreenSpecificNavigation(currentPath) {
    // --- CUSTOMERS DIRECTORY (/customers) ---
    if (currentPath === '/customers' || currentPath.includes('customers_directory')) {
      const table = document.querySelector('table');
      if (table && !document.getElementById('cf-customer-demo-banner')) {
        const banner = document.createElement('div');
        banner.id = 'cf-customer-demo-banner';
        banner.style.cssText = 'margin-bottom:16px;background:#f0fdf4;border:1px solid #bbf7d0;padding:12px 16px;border-radius:12px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;font-size:13px;color:#166534;';
        banner.innerHTML = `
          <div><strong>Demo Mode:</strong> Individual customer rows are static examples. The representative customer profile design is available for <strong>Al-Hamza Traders</strong>.</div>
          <a href="/customer-profile" style="background:#059669;color:#ffffff;padding:6px 14px;border-radius:8px;text-decoration:none;font-weight:600;font-size:12px;display:inline-flex;align-items:center;gap:6px;">
            View Sample Profile (Al-Hamza Traders) &rarr;
          </a>
        `;
        table.parentElement.parentElement.insertBefore(banner, table.parentElement);
      }

      // Handle table rows honestly
      document.querySelectorAll('table tbody tr').forEach(row => {
        row.style.cursor = 'pointer';
        row.onclick = (e) => {
          if (e.target.tagName === 'INPUT' && e.target.type === 'checkbox') return;
          const nameEl = row.querySelector('.font-bold');
          const name = nameEl ? nameEl.textContent.trim() : 'this customer';
          showDemoNotice(`Record details for '${name}' are not implemented in this demo. Use 'View Sample Profile (Al-Hamza Traders)' to view the sample design.`, true);
        };
      });
    }

    // --- CUSTOMER PROFILE (/customer-profile) ---
    if (currentPath === '/customer-profile' || currentPath.includes('customer_profile')) {
      // Breadcrumb / Back to Customers
      document.querySelectorAll('a, button').forEach(el => {
        const text = (el.textContent || '').trim().toLowerCase();
        if (text.includes('back to customers') || (el.tagName === 'A' && text === 'customers')) {
          el.href = '/customers';
          el.onclick = (e) => {
            e.preventDefault();
            navigateApp('/customers');
          };
        } else if (text.includes('new invoice') || text.includes('create invoice')) {
          el.onclick = (e) => {
            e.preventDefault();
            navigateApp('/create-invoice');
          };
        } else if (text.includes('record payment')) {
          el.onclick = (e) => {
            e.preventDefault();
            navigateApp('/record-payment');
          };
        }
      });

      // Sample invoice rows in Customer Profile -> /invoice-details
      document.querySelectorAll('table tbody tr').forEach(row => {
        row.style.cursor = 'pointer';
        row.title = 'View sample invoice details (INV-2026-0142)';
        row.onclick = () => {
          navigateApp('/invoice-details');
        };
      });
    }

    // --- INVOICES MANAGEMENT (/invoices) ---
    if (currentPath === '/invoices' || currentPath.includes('invoices_management')) {
      // "Create invoice" button
      document.querySelectorAll('button, a').forEach(el => {
        const text = (el.textContent || '').trim().toLowerCase();
        if (text.includes('create invoice')) {
          el.style.cursor = 'pointer';
          el.onclick = (e) => {
            e.preventDefault();
            navigateApp('/create-invoice');
          };
        }
      });

      // Honest Demo Banner above Invoices Table
      const table = document.querySelector('table');
      if (table && !document.getElementById('cf-invoice-demo-banner')) {
        const banner = document.createElement('div');
        banner.id = 'cf-invoice-demo-banner';
        banner.style.cssText = 'margin-bottom:16px;background:#f0fdf4;border:1px solid #bbf7d0;padding:12px 16px;border-radius:12px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;font-size:13px;color:#166534;';
        banner.innerHTML = `
          <div><strong>Demo Mode:</strong> Individual invoice rows are static examples. The representative invoice detail design is available for <strong>INV-2026-0142</strong>.</div>
          <a href="/invoice-details" style="background:#059669;color:#ffffff;padding:6px 14px;border-radius:8px;text-decoration:none;font-weight:600;font-size:12px;display:inline-flex;align-items:center;gap:6px;">
            View Sample Invoice (INV-2026-0142) &rarr;
          </a>
        `;
        table.parentElement.parentElement.insertBefore(banner, table.parentElement);
      }

      // Handle table rows honestly
      document.querySelectorAll('table tbody tr').forEach(row => {
        row.style.cursor = 'pointer';
        row.onclick = (e) => {
          if (e.target.tagName === 'INPUT' && e.target.type === 'checkbox') return;
          const invIdEl = row.querySelector('.font-medium.text-slate-500, td:nth-child(2)');
          const invId = invIdEl ? invIdEl.textContent.trim() : 'this invoice';
          showDemoNotice(`Record details for '${invId}' are not implemented in this demo. Use 'View Sample Invoice (INV-2026-0142)' to inspect the invoice design.`, true);
        };
      });
    }

    // --- CREATE INVOICE (/create-invoice) ---
    if (currentPath === '/create-invoice' || currentPath.includes('create_invoice')) {
      // Cancel / Back / Breadcrumb -> /invoices
      document.querySelectorAll('a, button').forEach(el => {
        const text = (el.textContent || '').trim().toLowerCase();
        if (text === 'cancel' || text.includes('back') || (el.tagName === 'A' && text === 'invoices')) {
          el.onclick = (e) => {
            e.preventDefault();
            navigateApp('/invoices');
          };
        }
      });
    }

    // --- INVOICE DETAILS (/invoice-details) ---
    if (currentPath === '/invoice-details' || currentPath.includes('invoice_details')) {
      // Breadcrumb Invoices -> /invoices
      document.querySelectorAll('a').forEach(link => {
        const text = (link.textContent || '').trim().toLowerCase();
        if (text === 'invoices' || text.includes('invoices')) {
          link.href = '/invoices';
          link.onclick = (e) => {
            e.preventDefault();
            navigateApp('/invoices');
          };
        }
      });

      // Record payment button -> /record-payment
      document.querySelectorAll('button').forEach(btn => {
        const text = (btn.textContent || '').trim().toLowerCase();
        if (text === 'record payment' || text.includes('record payment')) {
          btn.style.cursor = 'pointer';
          btn.onclick = (e) => {
            e.preventDefault();
            navigateApp('/record-payment');
          };
        }
      });

      // Customer link to profile
      document.querySelectorAll('h2').forEach(h => {
        if (h.textContent.includes('Al-Hamza Traders')) {
          h.style.cursor = 'pointer';
          h.title = 'View customer profile';
          h.onclick = () => navigateApp('/customer-profile');
        }
      });
    }

    // --- PAYMENTS LIST (/payments) ---
    if (currentPath === '/payments' || currentPath.includes('payments')) {
      // "+ Record payment" button -> /record-payment
      document.querySelectorAll('button').forEach(btn => {
        const text = (btn.textContent || '').trim().toLowerCase();
        if (text.includes('record payment')) {
          btn.style.cursor = 'pointer';
          btn.onclick = (e) => {
            e.preventDefault();
            navigateApp('/record-payment');
          };
        }
      });

      // Handle sample payment rows
      document.querySelectorAll('table tbody tr').forEach(row => {
        row.style.cursor = 'pointer';
        row.onclick = () => {
          showDemoNotice('Payment records in this table are static examples.', true);
        };
      });
    }

    // --- RECORD PAYMENT (/record-payment) ---
    if (currentPath === '/record-payment' || currentPath.includes('record_payment')) {
      // Cancel / Back / Breadcrumb -> /payments
      document.querySelectorAll('a, button').forEach(el => {
        const text = (el.textContent || '').trim().toLowerCase();
        if (text === 'cancel' || text.includes('back') || (el.tagName === 'A' && text === 'payments')) {
          el.onclick = (e) => {
            e.preventDefault();
            navigateApp('/payments');
          };
        }
      });
    }

    // --- REMINDERS (/reminders) ---
    if (currentPath === '/reminders' || currentPath.includes('payment_reminders')) {
      // "Reminder settings" button -> /reminder-settings
      document.querySelectorAll('button, a').forEach(btn => {
        const text = (btn.textContent || '').trim().toLowerCase();
        if (text.includes('reminder settings')) {
          btn.style.cursor = 'pointer';
          btn.onclick = (e) => {
            e.preventDefault();
            navigateApp('/reminder-settings');
          };
        }
      });
    }

    // --- REMINDER SETTINGS (/reminder-settings) ---
    if (currentPath === '/reminder-settings' || currentPath.includes('reminder_settings')) {
      // Back / Cancel / Breadcrumbs -> /reminders
      document.querySelectorAll('a, button').forEach(el => {
        const text = (el.textContent || '').trim().toLowerCase();
        if (text === 'cancel' || text.includes('back') || (el.tagName === 'A' && text === 'reminders')) {
          el.onclick = (e) => {
            e.preventDefault();
            navigateApp('/reminders');
          };
        }
      });
    }

    // --- SETTINGS (Business Settings, Team & Permissions, Subscription & Billing) ---
    if (currentPath.includes('setting') || currentPath.includes('permission') || currentPath.includes('subscription')) {
      document.querySelectorAll('div, a, button').forEach(el => {
        const text = (el.textContent || '').trim().toLowerCase();
        const isClickable = el.classList.contains('cursor-pointer') || el.tagName === 'A';
        if (isClickable) {
          if (text.includes('business profile') || text.includes('business settings')) {
            el.onclick = (e) => {
              e.preventDefault();
              navigateApp('/settings');
            };
          } else if (text.includes('team & permissions') || text.includes('team') || text.includes('security')) {
            el.onclick = (e) => {
              e.preventDefault();
              navigateApp('/team-permissions');
            };
          } else if (text.includes('subscription & billing') || text.includes('subscription') || text.includes('billing') || text.includes('payment methods')) {
            el.onclick = (e) => {
              e.preventDefault();
              navigateApp('/subscription-billing');
            };
          }
        }
      });

      // Mount Local Data Storage & Backup Card in Business Settings Column 3
      if (currentPath === '/settings' || currentPath.includes('business_settings')) {
        const col3 = document.querySelector('[data-purpose="preview-and-tips-column"]') ||
                     document.querySelector('.col-span-12.lg\\:col-span-3.space-y-4');
        if (col3 && !document.getElementById('cf-backup-card')) {
          const card = document.createElement('div');
          card.id = 'cf-backup-card';
          card.className = 'bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3.5';
          card.innerHTML = `
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0">
                <svg class="w-4 h-4 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 5.625c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
              <div>
                <h3 class="text-sm font-bold text-slate-900 leading-snug">Data Storage &amp; Backup</h3>
                <p class="text-[11px] text-emerald-600 font-medium">● IndexedDB Active (Shah Traders)</p>
              </div>
            </div>
            <p class="text-xs text-slate-500 leading-relaxed">
              Business data is stored locally in browser IndexedDB with integer paisa integrity. Export a JSON backup to download your records or restore an earlier backup.
            </p>
            <div class="pt-1 flex flex-col gap-2">
              <button id="cf-btn-export-backup" type="button" class="w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-[#00875A] hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 16.5V16.5M7.5 10.5L12 15m0 0l4.5-4.5M12 15V3" stroke-linecap="round" stroke-linejoin="round"/></svg>
                Export Backup JSON
              </button>
              <button id="cf-btn-import-backup" type="button" class="w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors">
                <svg class="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 16.5V16.5M16.5 7.5L12 3m0 0L7.5 7.5M12 3v12" stroke-linecap="round" stroke-linejoin="round"/></svg>
                Import Backup JSON
              </button>
              <input id="cf-file-import-backup" type="file" accept=".json,application/json" style="display:none;" />
            </div>
            <div id="cf-backup-status" class="text-[11px] text-slate-400 leading-normal border-t border-slate-100 pt-2.5">
              Schema v1.0 • 9 structured stores managed locally
            </div>
          `;
          col3.appendChild(card);

          // Wire Export
          const btnExport = document.getElementById('cf-btn-export-backup');
          if (btnExport) {
            btnExport.onclick = () => {
              if (!window.CreditFlowDB) {
                showDemoNotice('Storage layer not ready.', true);
                return;
              }
              window.CreditFlowDB.backup.exportJSON().then(data => {
                const jsonStr = JSON.stringify(data, null, 2);
                const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                const dateStr = new Date().toISOString().split('T')[0];
                a.href = url;
                a.download = `creditflow-backup-shah-traders-${dateStr}.json`;
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                  a.remove();
                  URL.revokeObjectURL(url);
                }, 1000);
                showDemoNotice('✓ Backup exported successfully! Download started.');
                const statusEl = document.getElementById('cf-backup-status');
                if (statusEl) {
                  statusEl.innerHTML = `<span style="color:#059669;font-weight:600;">✓ Last backup exported at ${new Date().toLocaleTimeString()}</span>`;
                }
              }).catch(err => {
                showDemoNotice(`Export failed: ${err.message}`, true);
              });
            };
          }

          // Wire Import
          const btnImport = document.getElementById('cf-btn-import-backup');
          const fileInput = document.getElementById('cf-file-import-backup');
          if (btnImport && fileInput) {
            btnImport.onclick = () => fileInput.click();

            fileInput.onchange = (e) => {
              const file = e.target.files && e.target.files[0];
              if (!file) return;

              const reader = new FileReader();
              reader.onload = (evt) => {
                const content = evt.target.result;
                let parsed;
                try {
                  parsed = JSON.parse(content);
                } catch (parseErr) {
                  showDemoNotice('Invalid backup file: Malformed JSON syntax.', true);
                  const statusEl = document.getElementById('cf-backup-status');
                  if (statusEl) statusEl.innerHTML = '<span style="color:#dc2626;font-weight:600;">✗ Import failed: Malformed JSON</span>';
                  fileInput.value = '';
                  return;
                }

                // Pre-validation checks
                if (!parsed || parsed.app !== 'CreditFlow' || Number(parsed.schema_version) !== 1) {
                  showDemoNotice('Invalid backup file: Incompatible schema or not a CreditFlow backup.', true);
                  const statusEl = document.getElementById('cf-backup-status');
                  if (statusEl) statusEl.innerHTML = '<span style="color:#dc2626;font-weight:600;">✗ Incompatible backup schema</span>';
                  fileInput.value = '';
                  return;
                }

                const confirmed = window.confirm(
                  'Are you sure you want to replace current local business data with this backup? Current records will be replaced.'
                );
                if (!confirmed) {
                  fileInput.value = '';
                  return;
                }

                window.CreditFlowDB.backup.importJSON(parsed).then(res => {
                  showDemoNotice('✓ Backup restored successfully! Local data updated.');
                  const totalRecords = Object.values(res.record_counts).reduce((a, b) => a + b, 0);
                  const statusEl = document.getElementById('cf-backup-status');
                  if (statusEl) {
                    statusEl.innerHTML = `<span style="color:#059669;font-weight:600;">✓ Restored ${totalRecords} records at ${new Date().toLocaleTimeString()}</span>`;
                  }
                  fileInput.value = '';
                }).catch(err => {
                  showDemoNotice(`Restore failed: ${err.message}`, true);
                  const statusEl = document.getElementById('cf-backup-status');
                  if (statusEl) statusEl.innerHTML = `<span style="color:#dc2626;font-weight:600;">✗ Error: ${err.message}</span>`;
                  fileInput.value = '';
                });
              };
              reader.readAsText(file);
            };
          }
        }
      }
    }

    // --- DEMO AUTHENTICATION & ONBOARDING FLOWS ---
    // Login -> Dashboard or Signup
    if (currentPath === '/login' || currentPath === '/signin' || currentPath.includes('sign_in_platform_overview')) {
      const form = document.querySelector('form');
      if (form) {
        form.onsubmit = (e) => {
          e.preventDefault();
          navigateApp('/dashboard');
        };
      }
      document.querySelectorAll('button, a').forEach(el => {
        const text = (el.textContent || '').trim().toLowerCase();
        if (text.includes('sign in') && (el.tagName === 'BUTTON' || el.getAttribute('type') === 'submit')) {
          el.onclick = (e) => {
            e.preventDefault();
            navigateApp('/dashboard');
          };
        } else if (text.includes('create account') || text.includes('sign up')) {
          el.onclick = (e) => {
            e.preventDefault();
            navigateApp('/signup');
          };
        }
      });
    }

    // Signup -> Onboarding or Login
    if (currentPath === '/signup' || currentPath === '/create-account' || currentPath.includes('create_your_account')) {
      const form = document.querySelector('form');
      if (form) {
        form.onsubmit = (e) => {
          e.preventDefault();
          navigateApp('/onboarding');
        };
      }
      document.querySelectorAll('button, a').forEach(el => {
        const text = (el.textContent || '').trim().toLowerCase();
        if (text.includes('create account') && (el.tagName === 'BUTTON' || el.getAttribute('type') === 'submit')) {
          el.onclick = (e) => {
            e.preventDefault();
            navigateApp('/onboarding');
          };
        } else if (text.includes('sign in') || text.includes('log in')) {
          el.onclick = (e) => {
            e.preventDefault();
            navigateApp('/login');
          };
        }
      });
    }

    // Onboarding -> Dashboard or Signup
    if (currentPath === '/onboarding' || currentPath.includes('business_details_onboarding')) {
      const form = document.querySelector('form');
      if (form) {
        form.onsubmit = (e) => {
          e.preventDefault();
          navigateApp('/dashboard');
        };
      }
      document.querySelectorAll('button, a').forEach(el => {
        const text = (el.textContent || '').trim().toLowerCase();
        if (text.includes('continue')) {
          el.onclick = (e) => {
            e.preventDefault();
            navigateApp('/dashboard');
          };
        } else if (text.includes('back')) {
          el.onclick = (e) => {
            e.preventDefault();
            navigateApp('/signup');
          };
        }
      });
    }
  }

  function init() {
    const currentPath = getNormalizedPath();
    setupSidebarNavigation(currentPath);
    setupHeaderControls();
    preventMisleadingActions();
    setupScreenSpecificNavigation(currentPath);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
