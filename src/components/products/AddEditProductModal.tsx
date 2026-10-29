import React, { useState, useEffect } from 'react';
import { ProductService } from '../../types/models';
import { ICreditFlowRepository } from '../../types/repository';
import { rupeesToPaisa, paisaToRupees } from '../../lib/utils';

interface AddEditProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  productToEdit?: ProductService | null;
  existingProducts: ProductService[];
  repository: ICreditFlowRepository;
  onProductSaved: () => Promise<void>;
}

const COMMON_UNITS = [
  'Unit',
  'Piece',
  'Hour',
  'Day',
  'Month',
  'Trip',
  'Kg',
  '50kg Bag',
  '20kg Bag',
  '16L Tin',
  '5kg Carton',
  'Box',
  'Set',
  'Other'
];

export const AddEditProductModal: React.FC<AddEditProductModalProps> = ({
  isOpen,
  onClose,
  productToEdit,
  existingProducts,
  repository,
  onProductSaved
}) => {
  const isEdit = Boolean(productToEdit);

  const [name, setName] = useState('');
  const [type, setType] = useState<'product' | 'service'>('product');
  const [description, setDescription] = useState('');
  const [sku, setSku] = useState('');
  const [unitPriceRupees, setUnitPriceRupees] = useState('');
  const [unit, setUnit] = useState('Unit');
  const [customUnit, setCustomUnit] = useState('');
  const [taxPercent, setTaxPercent] = useState('0');
  const [isActive, setIsActive] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (productToEdit) {
        setName(productToEdit.name || '');
        setType(productToEdit.type || 'product');
        setDescription(productToEdit.description || '');
        setSku(productToEdit.sku || '');
        setUnitPriceRupees(
          paisaToRupees(productToEdit.price_paisa || 0).toLocaleString('en-US')
        );
        if (COMMON_UNITS.includes(productToEdit.unit || '')) {
          setUnit(productToEdit.unit || 'Unit');
          setCustomUnit('');
        } else {
          setUnit('Other');
          setCustomUnit(productToEdit.unit || '');
        }
        setTaxPercent(String(productToEdit.tax_percent ?? 0));
        setIsActive(productToEdit.is_active !== false);
      } else {
        // Create mode defaults
        setName('');
        setType('product');
        setDescription('');
        setSku('');
        setUnitPriceRupees('');
        setUnit('Unit');
        setCustomUnit('');
        setTaxPercent('0');
        setIsActive(true);
      }
      setError(null);
    }
  }, [isOpen, productToEdit]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Item name is required.');
      return;
    }

    // Validate Unit Price
    const cleanPriceStr = unitPriceRupees.replace(/[^0-9.]/g, '');
    if (!cleanPriceStr || isNaN(Number(cleanPriceStr))) {
      setError('Please provide a valid unit price.');
      return;
    }
    const numRupees = parseFloat(cleanPriceStr);
    if (numRupees < 0) {
      setError('Unit price cannot be negative.');
      return;
    }
    const pricePaisa = rupeesToPaisa(numRupees);

    // Validate Tax Percent
    const taxNum = Number(taxPercent);
    if (isNaN(taxNum) || taxNum < 0 || taxNum > 100) {
      setError('Tax percentage must be between 0% and 100%.');
      return;
    }

    // Validate SKU uniqueness if SKU is provided
    const trimmedSku = sku.trim();
    if (trimmedSku) {
      const duplicateSku = existingProducts.some(
        (p) =>
          p.sku &&
          p.sku.toLowerCase() === trimmedSku.toLowerCase() &&
          (!isEdit || p.id !== productToEdit?.id)
      );
      if (duplicateSku) {
        setError(`SKU "${trimmedSku}" is already in use by another product or service.`);
        return;
      }
    }

    const finalUnit = (unit === 'Other' ? customUnit.trim() : unit.trim()) || 'Unit';

    try {
      setIsSubmitting(true);
      if (isEdit && productToEdit) {
        await repository.updateProduct(productToEdit.id, {
          name: trimmedName,
          type,
          description: description.trim(),
          sku: trimmedSku,
          price_paisa: pricePaisa,
          unit: finalUnit,
          tax_percent: taxNum,
          is_active: isActive
        });
      } else {
        await repository.createProduct({
          name: trimmedName,
          type,
          description: description.trim(),
          sku: trimmedSku,
          price_paisa: pricePaisa,
          unit: finalUnit,
          tax_percent: taxNum,
          is_active: isActive
        });
      }

      await onProductSaved();
      onClose();
    } catch (err: any) {
      console.error('Failed to save product/service:', err);
      setError(err?.message || 'Failed to save product/service to database.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
      data-purpose="add-edit-product-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative bg-white rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-xl font-bold text-slate-900">
              {isEdit ? 'Edit Product / Service' : 'Add Product or Service'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {isEdit
                ? 'Update pricing and catalog details for this item.'
                : 'Create a new line item in your trade catalogue.'}
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

        {/* Error Alert */}
        {error && (
          <div className="mt-4 p-3.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2.5">
            <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4 text-sm">
          {/* Type Selector Pills */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Item Type <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setType('product')}
                className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                  type === 'product'
                    ? 'bg-[#e6f7f0] border-emerald-300 text-[#0d9488] shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>Product (Goods)</span>
              </button>

              <button
                type="button"
                onClick={() => setType('service')}
                className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                  type === 'service'
                    ? 'bg-[#eff6ff] border-blue-300 text-[#2563eb] shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M21.75 6.75a4.5 4.5 0 01-4.884 4.484c-1.076-.091-2.264.398-3.085 1.22l-6.19 6.19a2.25 2.25 0 01-3.182-3.182l6.19-6.19c.822-.821 1.311-2.01 1.22-3.085A4.5 4.5 0 0116.25 1.25l-.885 3.541a1.5 1.5 0 001.094 1.808l3.541.885v-.734z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>Service / Labor</span>
              </button>
            </div>
          </div>

          {/* Item Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Item Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              placeholder={type === 'product' ? 'e.g. Gree Pular T3 1.5 Ton AC' : 'e.g. AC Installation Service'}
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
              placeholder="Detailed description, model specifications or service scope..."
            />
          </div>

          {/* SKU and Unit Price */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Item SKU / Code <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-mono"
                placeholder={type === 'product' ? 'PRD-009' : 'SRV-003'}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Unit Price (PKR) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs font-semibold text-slate-400 pointer-events-none">
                  PKR
                </span>
                <input
                  type="text"
                  value={unitPriceRupees}
                  onChange={(e) => setUnitPriceRupees(e.target.value)}
                  className="w-full pl-12 pr-3.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-medium"
                  placeholder="0"
                  required
                />
              </div>
            </div>
          </div>

          {/* Unit & Tax Percent */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Unit of Measure
              </label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                {COMMON_UNITS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Sales Tax Rate (%)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={taxPercent}
                  onChange={(e) => setTaxPercent(e.target.value)}
                  className="w-full px-3.5 py-2 pr-8 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="0"
                />
                <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-slate-400 pointer-events-none">
                  %
                </span>
              </div>
            </div>
          </div>

          {unit === 'Other' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Specify Custom Unit</label>
              <input
                type="text"
                value={customUnit}
                onChange={(e) => setCustomUnit(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="e.g. Bundle, Barrel, Pallet..."
                required
              />
            </div>
          )}

          {/* Status Checkbox */}
          <div className="pt-2">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
              />
              <span className="text-xs font-medium text-slate-700">
                Item is Active and available on invoices
              </span>
            </label>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-5 border-t border-slate-100">
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
              className="px-4 py-2 bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-lg text-xs font-semibold transition-colors shadow-sm disabled:opacity-60 cursor-pointer"
            >
              {isSubmitting ? 'Saving...' : isEdit ? 'Update Item' : 'Add Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
