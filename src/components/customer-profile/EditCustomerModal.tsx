import React, { useState, useEffect } from 'react';
import { Customer } from '../../types/models';
import { ICreditFlowRepository } from '../../types/repository';
import { rupeesToPaisa, paisaToRupees } from '../../lib/utils';

interface EditCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer;
  repository: ICreditFlowRepository;
  onCustomerUpdated: (updated: Customer) => void;
}

const CITIES = [
  'Karachi',
  'Lahore',
  'Faisalabad',
  'Rawalpindi',
  'Islamabad',
  'Multan',
  'Peshawar',
  'Quetta',
  'Sialkot',
  'Gujranwala',
  'Hyderabad',
  'Other'
];

const CATEGORIES = [
  'Retail Store',
  'Wholesaler',
  'Retailer',
  'General Store',
  'Pharmacy',
  'Electronics Retailer',
  'Distributor',
  'Supermarket',
  'Agro Supplies',
  'Corporate',
  'Other'
];

export const EditCustomerModal: React.FC<EditCustomerModalProps> = ({
  isOpen,
  onClose,
  customer,
  repository,
  onCustomerUpdated
}) => {
  const [name, setName] = useState(customer.name || '');
  const [phone, setPhone] = useState(customer.phone || '');
  const [city, setCity] = useState(customer.city || 'Karachi');
  const [customCity, setCustomCity] = useState('');
  const [category, setCategory] = useState(customer.category || 'Retail Store');
  const [creditLimitRupees, setCreditLimitRupees] = useState(
    paisaToRupees(customer.credit_limit_paisa || 0).toLocaleString('en-US')
  );
  const [email, setEmail] = useState(customer.email || '');
  const [status, setStatus] = useState(customer.status || 'Active');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (customer) {
      setName(customer.name || '');
      setPhone(customer.phone || '');
      if (CITIES.includes(customer.city)) {
        setCity(customer.city);
        setCustomCity('');
      } else {
        setCity('Other');
        setCustomCity(customer.city || '');
      }
      setCategory(customer.category || 'Retail Store');
      setCreditLimitRupees(paisaToRupees(customer.credit_limit_paisa || 0).toLocaleString('en-US'));
      setEmail(customer.email || '');
      setStatus(customer.status || 'Active');
      setError(null);
    }
  }, [customer]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    const finalCity = (city === 'Other' ? customCity.trim() : city.trim()) || 'Karachi';

    if (!trimmedName) {
      setError('Customer or business name is required.');
      return;
    }

    if (!trimmedPhone) {
      setError('Phone number is required.');
      return;
    }

    // Parse credit limit
    const cleanCreditStr = creditLimitRupees.replace(/[^0-9.]/g, '');
    const creditPaisa = rupeesToPaisa(parseFloat(cleanCreditStr) || 0);

    // Compute initials if name changed
    const words = trimmedName.split(' ').filter(Boolean);
    const initials =
      words.length >= 2
        ? (words[0][0] + words[1][0]).toUpperCase()
        : trimmedName.slice(0, 2).toUpperCase();

    try {
      setIsSubmitting(true);
      const updates: Partial<Customer> = {
        name: trimmedName,
        phone: trimmedPhone,
        city: finalCity,
        category,
        email: email.trim(),
        credit_limit_paisa: creditPaisa,
        initials,
        status,
        updated_at: new Date().toISOString()
      };

      const updated = await repository.updateCustomer(customer.id, updates);
      onCustomerUpdated(updated);
      onClose();
    } catch (err: any) {
      console.error('Failed to update customer:', err);
      setError(err?.message || 'Failed to save customer changes.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
      data-purpose="edit-customer-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative bg-white rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Edit Customer Profile</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Update contact information and credit parameters for {customer.name}.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            type="button"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2.5">
            <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4 text-sm">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Business / Customer Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Phone Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="customer@example.pk"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                {CITIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Trade Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          {city === 'Other' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Specify City</label>
              <input
                type="text"
                value={customCity}
                onChange={(e) => setCustomCity(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="Enter city name..."
                required
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Credit Limit (PKR)
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs font-medium text-slate-400">
                  PKR
                </span>
                <input
                  type="text"
                  value={creditLimitRupees}
                  onChange={(e) => setCreditLimitRupees(e.target.value)}
                  className="w-full pl-12 pr-3.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Account Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value="Active">Active</option>
                <option value="Overdue">Overdue</option>
                <option value="Due Soon">Due Soon</option>
                <option value="Paid">Paid</option>
                <option value="Archived">Archived</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-[#047857] hover:bg-[#065F46] text-white rounded-lg text-xs font-semibold transition-colors shadow-sm disabled:opacity-60 cursor-pointer"
            >
              {isSubmitting ? 'Saving changes...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
