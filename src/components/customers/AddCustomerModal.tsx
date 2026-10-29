import React, { useState } from 'react';
import { Customer } from '../../types/models';
import { ICreditFlowRepository } from '../../types/repository';
import { rupeesToPaisa } from '../../lib/utils';

interface AddCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingCustomers: Customer[];
  repository: ICreditFlowRepository;
  onCustomerAdded: () => Promise<void>;
  onCustomerCreated?: (customer: Customer) => void;
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
  'Hyderabad'
];

const CATEGORIES = [
  'Retail Store',
  'Wholesaler',
  'General Store',
  'Pharmacy',
  'Electronics Retailer',
  'Distributor',
  'Supermarket',
  'Agro Supplies',
  'Other'
];

export const AddCustomerModal: React.FC<AddCustomerModalProps> = ({
  isOpen,
  onClose,
  existingCustomers,
  repository,
  onCustomerAdded,
  onCustomerCreated
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('Karachi');
  const [customCity, setCustomCity] = useState('');
  const [category, setCategory] = useState('Retail Store');
  const [creditLimitRupees, setCreditLimitRupees] = useState('500,000');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleClose = () => {
    setError(null);
    setName('');
    setPhone('');
    setCity('Karachi');
    setCustomCity('');
    setCategory('Retail Store');
    setCreditLimitRupees('500,000');
    setEmail('');
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    const finalCity = (city === 'Other' ? customCity.trim() : city.trim()) || 'Karachi';

    // 1. Validation: Required fields
    if (!trimmedName) {
      setError('Customer or business name is required.');
      return;
    }

    if (!trimmedPhone) {
      setError('Phone number is required.');
      return;
    }

    if (!finalCity) {
      setError('City is required.');
      return;
    }

    // 2. Duplicate prevention
    const normalizedName = trimmedName.toLowerCase();
    const cleanPhone = trimmedPhone.replace(/[^0-9]/g, '');

    const nameExists = existingCustomers.some(
      (c) => c.name.trim().toLowerCase() === normalizedName
    );
    if (nameExists) {
      setError(`A customer named "${trimmedName}" already exists.`);
      return;
    }

    if (cleanPhone.length >= 7) {
      const phoneExists = existingCustomers.some((c) => {
        const existingCleanPhone = (c.phone || '').replace(/[^0-9]/g, '');
        return existingCleanPhone.length >= 7 && existingCleanPhone === cleanPhone;
      });
      if (phoneExists) {
        setError(`A customer with phone number "${trimmedPhone}" already exists.`);
        return;
      }
    }

    // 3. Credit limit validation
    const creditPaisa = rupeesToPaisa(creditLimitRupees);
    if (creditPaisa < 0 || isNaN(creditPaisa)) {
      setError('Please enter a valid credit limit.');
      return;
    }

    // 4. Generate initials
    const words = trimmedName.split(/\s+/).filter(Boolean);
    let initials = 'CU';
    if (words.length >= 2) {
      initials = (words[0][0] + words[1][0]).toUpperCase();
    } else if (words.length === 1 && words[0].length >= 2) {
      initials = words[0].substring(0, 2).toUpperCase();
    } else if (words.length === 1) {
      initials = words[0][0].toUpperCase();
    }

    try {
      setIsSubmitting(true);
      const created = await repository.createCustomer({
        name: trimmedName,
        initials,
        city: finalCity,
        category: category.trim(),
        phone: trimmedPhone,
        email: email.trim(),
        credit_limit_paisa: creditPaisa,
        status: 'Active'
      });

      await onCustomerAdded();
      if (onCustomerCreated) {
        onCustomerCreated(created);
      }
      handleClose();
    } catch (err: any) {
      console.error('[AddCustomerModal] Error adding customer:', err);
      setError(err?.message || 'Failed to save customer. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xl max-w-lg w-full overflow-hidden transition-all transform scale-100 animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Add New Customer</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Enter customer details to establish credit limits and track balances.
            </p>
          </div>
          <button
            onClick={handleClose}
            type="button"
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg text-xs font-medium text-red-700 flex items-start gap-2.5">
              <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" strokeWidth="2" />
                <line x1="12" y1="8" x2="12" y2="12" strokeWidth="2" strokeLinecap="round" />
                <line x1="12" y1="16" x2="12.01" y2="16" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Customer / Business Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Al-Madina Super Store"
              className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Phone */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Phone Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 0321 1234567"
                className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
              />
            </div>

            {/* City */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                City <span className="text-red-500">*</span>
              </label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
              >
                {CITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option value="Other">Other...</option>
              </select>
            </div>
          </div>

          {city === 'Other' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Specify City Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={customCity}
                onChange={(e) => setCustomCity(e.target.value)}
                placeholder="Enter city"
                className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Category */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Business Type / Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Credit Limit */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Credit Limit (PKR)
              </label>
              <input
                type="text"
                value={creditLimitRupees}
                onChange={(e) => setCreditLimitRupees(e.target.value)}
                placeholder="500,000"
                className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          {/* Email (Optional) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Email Address <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. contact@business.com"
              className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
            />
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center px-4 py-2 bg-[#059669] hover:bg-[#047857] text-white text-sm font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50 space-x-2"
            >
              {isSubmitting ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
                  </svg>
                  <span>Save Customer</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
