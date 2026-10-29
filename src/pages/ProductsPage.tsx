import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useCreditFlow } from '../context/CreditFlowContext';
import { ProductService } from '../types/models';
import { formatPKR } from '../lib/utils';
import { AddProductModal } from '../components/products/AddProductModal';

export const ProductsPage: React.FC = () => {
  const { products, repository, refreshData, isLoading } = useCreditFlow();

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'product' | 'service'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [sortField, setSortField] = useState<'name' | 'type' | 'price' | 'status'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Modals & Popovers
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProductForEdit, setSelectedProductForEdit] = useState<ProductService | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close actions dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Filtering and Sorting
  const filteredProducts = useMemo(() => {
    let result = [...products];

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.sku && p.sku.toLowerCase().includes(q)) ||
          (p.description && p.description.toLowerCase().includes(q))
      );
    }

    // Type filter
    if (typeFilter !== 'ALL') {
      result = result.filter((p) => p.type === typeFilter);
    }

    // Status filter
    if (statusFilter !== 'ALL') {
      result = result.filter((p) => (statusFilter === 'ACTIVE' ? p.is_active : !p.is_active));
    }

    // Sorting
    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') {
        cmp = a.name.localeCompare(b.name);
      } else if (sortField === 'type') {
        cmp = a.type.localeCompare(b.type);
      } else if (sortField === 'price') {
        cmp = (a.price_paisa || 0) - (b.price_paisa || 0);
      } else if (sortField === 'status') {
        cmp = Number(b.is_active) - Number(a.is_active);
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [products, searchQuery, typeFilter, statusFilter, sortField, sortDirection]);

  // Pagination
  const totalItems = filteredProducts.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

  // Sorting Handler
  const handleSort = (field: 'name' | 'type' | 'price' | 'status') => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Actions
  const handleToggleStatus = async (product: ProductService) => {
    setActiveMenuId(null);
    try {
      const newStatus = !product.is_active;
      await repository.setProductActiveStatus(product.id, newStatus);
      await refreshData();
      showToast(`${product.name} is now ${newStatus ? 'active' : 'inactive'}.`);
    } catch (err: any) {
      console.error('Failed to change product status:', err);
      showToast(err?.message || 'Failed to update status.');
    }
  };

  const handleEditClick = (product: ProductService) => {
    setActiveMenuId(null);
    setSelectedProductForEdit(product);
    setIsModalOpen(true);
  };

  const handleAddClick = () => {
    setSelectedProductForEdit(null);
    setIsModalOpen(true);
  };

  // Render product thumbnail icon
  const renderThumbnail = (product: ProductService) => {
    if (product.type === 'service') {
      return (
        <div className="w-12 h-10 rounded-md border border-blue-100 bg-[#f0f7ff] flex items-center justify-center p-1 shrink-0">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path
              d="M21.75 6.75a4.5 4.5 0 01-4.884 4.484c-1.076-.091-2.264.398-3.085 1.22l-6.19 6.19a2.25 2.25 0 01-3.182-3.182l6.19-6.19c.822-.821 1.311-2.01 1.22-3.085A4.5 4.5 0 0116.25 1.25l-.885 3.541a1.5 1.5 0 001.094 1.808l3.541.885v-.734z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      );
    }

    // For products, render neat device / box SVG matching reference
    const nameLower = product.name.toLowerCase();
    if (nameLower.includes('tv') || nameLower.includes('qled') || nameLower.includes('screen')) {
      return (
        <div className="w-12 h-10 rounded-md border border-slate-200 bg-slate-900 flex items-center justify-center p-0.5 overflow-hidden shrink-0">
          <div className="w-full h-full bg-gradient-to-tr from-purple-700 via-pink-600 to-indigo-600 rounded-xs flex items-center justify-center">
            <span className="text-[8px] text-white font-bold tracking-widest opacity-80">QLED</span>
          </div>
        </div>
      );
    }

    if (nameLower.includes('ac') || nameLower.includes('air conditioner')) {
      return (
        <div className="w-12 h-10 rounded-md border border-slate-200 bg-slate-50 flex items-center justify-center p-1 overflow-hidden shrink-0">
          <svg className="w-10 h-7" fill="none" viewBox="0 0 48 30">
            <rect fill="#ffffff" height="20" rx="3" stroke="#cbd5e1" strokeWidth="2" width="44" x="2" y="5" />
            <line stroke="#94a3b8" strokeWidth="1.5" x1="6" x2="42" y1="20" y2="20" />
            <circle cx="40" cy="10" fill={product.is_active ? '#10b981' : '#94a3b8'} r="1.5" />
          </svg>
        </div>
      );
    }

    if (nameLower.includes('fridge') || nameLower.includes('refrigerator')) {
      return (
        <div className="w-12 h-10 rounded-md border border-slate-200 bg-slate-100 flex items-center justify-center p-1 shrink-0">
          <svg className="w-6 h-8 text-slate-600" fill="currentColor" viewBox="0 0 24 32">
            <rect fill="#475569" height="30" rx="2" width="18" x="3" y="1" />
            <line stroke="#1e293b" strokeWidth="1.5" x1="3" x2="21" y1="12" y2="12" />
            <line stroke="#cbd5e1" strokeWidth="1.5" x1="5" x2="5" y1="7" y2="10" />
            <line stroke="#cbd5e1" strokeWidth="1.5" x1="5" x2="5" y1="14" y2="18" />
          </svg>
        </div>
      );
    }

    // Default item box
    return (
      <div className="w-12 h-10 rounded-md border border-slate-200 bg-slate-50 flex items-center justify-center p-1 shrink-0 text-slate-400">
        <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    );
  };

  return (
    <>
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#0F172A] text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-sm border border-slate-700 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <svg className="w-5 h-5 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
          </svg>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Title & Action Bar */}
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4" data-purpose="page-header">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#0f172a]">Products &amp; services</h1>
          <p className="text-sm text-slate-500 mt-1">Manage the products and services you sell.</p>
        </div>
        <div>
          <button
            onClick={handleAddClick}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#0d9488] hover:bg-[#0f766e] active:bg-[#115e59] rounded-lg shadow-sm transition-all cursor-pointer"
            type="button"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="M12 4.5v15m7.5-7.5h-15" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Add item</span>
          </button>
        </div>
      </section>

      {/* Filter and Search Bar */}
      <section className="flex flex-col sm:flex-row items-center gap-3" data-purpose="table-filter-bar">
        {/* Search Filter Input */}
        <div className="relative flex-1 w-full">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search by item name, SKU or description..."
            className="w-full pl-10 pr-4 py-2 text-sm text-slate-800 bg-white border border-slate-200 rounded-lg placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              type="button"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
            </button>
          )}
        </div>

        {/* Filter Dropdown: Types */}
        <div className="w-full sm:w-48">
          <div className="relative">
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="w-full appearance-none bg-white border border-slate-200 text-slate-700 py-2 pl-3.5 pr-8 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-xs cursor-pointer"
            >
              <option value="ALL">All types</option>
              <option value="product">Products</option>
              <option value="service">Services</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="m19.5 8.25-7.5 7.5-7.5-7.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>

        {/* Filter Dropdown: Statuses */}
        <div className="w-full sm:w-48">
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="w-full appearance-none bg-white border border-slate-200 text-slate-700 py-2 pl-3.5 pr-8 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-xs cursor-pointer"
            >
              <option value="ALL">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="m19.5 8.25-7.5 7.5-7.5-7.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* Table Card */}
      <section className="bg-white border border-slate-200/90 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden" data-purpose="items-table-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50/50 text-[12px] font-semibold text-slate-500 uppercase tracking-wider">
                <th
                  onClick={() => handleSort('name')}
                  className="py-3.5 pl-6 pr-4 cursor-pointer select-none"
                  scope="col"
                >
                  <div className="inline-flex items-center gap-1.5 hover:text-slate-800">
                    <span>Item name</span>
                    <svg className={`w-3.5 h-3.5 transition-transform ${sortField === 'name' && sortDirection === 'desc' ? 'rotate-180 text-emerald-600' : 'text-slate-400'}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="m19.5 8.25-7.5 7.5-7.5-7.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </th>
                <th className="py-3.5 px-4" scope="col">Description</th>
                <th
                  onClick={() => handleSort('type')}
                  className="py-3.5 px-4 cursor-pointer select-none"
                  scope="col"
                >
                  <div className="inline-flex items-center gap-1.5 hover:text-slate-800">
                    <span>Type</span>
                    <svg className={`w-3.5 h-3.5 transition-transform ${sortField === 'type' && sortDirection === 'desc' ? 'rotate-180 text-emerald-600' : 'text-slate-400'}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="m19.5 8.25-7.5 7.5-7.5-7.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </th>
                <th
                  onClick={() => handleSort('price')}
                  className="py-3.5 px-4 cursor-pointer select-none"
                  scope="col"
                >
                  <div className="inline-flex items-center gap-1.5 hover:text-slate-800">
                    <span>Unit price (PKR)</span>
                    <svg className={`w-3.5 h-3.5 transition-transform ${sortField === 'price' && sortDirection === 'desc' ? 'rotate-180 text-emerald-600' : 'text-slate-400'}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="m19.5 8.25-7.5 7.5-7.5-7.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </th>
                <th
                  onClick={() => handleSort('status')}
                  className="py-3.5 px-4 cursor-pointer select-none"
                  scope="col"
                >
                  <div className="inline-flex items-center gap-1.5 hover:text-slate-800">
                    <span>Status</span>
                    <svg className={`w-3.5 h-3.5 transition-transform ${sortField === 'status' && sortDirection === 'desc' ? 'rotate-180 text-emerald-600' : 'text-slate-400'}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="m19.5 8.25-7.5 7.5-7.5-7.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </th>
                <th className="py-3.5 pl-4 pr-6 text-right" scope="col">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {isLoading && paginatedProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" />
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce delay-100" />
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce delay-200" />
                    </div>
                    <span className="text-xs text-slate-400 mt-2 block">Loading products &amp; services...</span>
                  </td>
                </tr>
              ) : paginatedProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <div className="max-w-sm mx-auto text-center">
                      <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                        </svg>
                      </div>
                      <h3 className="text-sm font-semibold text-slate-800">No items found</h3>
                      <p className="text-xs text-slate-500 mt-1">
                        {searchQuery || typeFilter !== 'ALL' || statusFilter !== 'ALL'
                          ? 'Try clearing or modifying your filter criteria.'
                          : 'Get started by creating your first product or service item.'}
                      </p>
                      {searchQuery || typeFilter !== 'ALL' || statusFilter !== 'ALL' ? (
                        <button
                          onClick={() => {
                            setSearchQuery('');
                            setTypeFilter('ALL');
                            setStatusFilter('ALL');
                          }}
                          className="mt-3 inline-flex items-center text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                          type="button"
                        >
                          Clear all filters
                        </button>
                      ) : (
                        <button
                          onClick={handleAddClick}
                          className="mt-3 inline-flex items-center text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                          type="button"
                        >
                          Add item now
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((p) => {
                  const isMenuOpen = activeMenuId === p.id;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Item Name + SKU */}
                      <td className="py-3.5 pl-6 pr-4">
                        <div className="flex items-center gap-3.5">
                          {renderThumbnail(p)}
                          <div>
                            <div className="font-semibold text-slate-800">{p.name}</div>
                            <div className="text-xs text-slate-400 mt-0.5">{p.sku || '—'}</div>
                          </div>
                        </div>
                      </td>

                      {/* Description */}
                      <td className="py-3.5 px-4 text-slate-500 max-w-xs truncate" title={p.description || p.name}>
                        {p.description || `${p.name} (${p.unit || 'Unit'})`}
                      </td>

                      {/* Type Badge */}
                      <td className="py-3.5 px-4">
                        {p.type === 'service' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#eff6ff] text-[#2563eb]">
                            Service
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#e6f7f0] text-[#0d9488]">
                            Product
                          </span>
                        )}
                      </td>

                      {/* Unit Price */}
                      <td className="py-3.5 px-4 text-slate-700 font-medium whitespace-nowrap">
                        {formatPKR(p.price_paisa)}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {p.is_active ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#ecfdf5] text-[#059669]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
                            <span>Active</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#f1f5f9] text-[#64748b]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#94a3b8]" />
                            <span>Inactive</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 pl-4 pr-6 text-right relative">
                        <button
                          onClick={() => setActiveMenuId(isMenuOpen ? null : p.id)}
                          aria-label="Row options"
                          className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                          type="button"
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM18 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                        </button>

                        {/* Dropdown Menu */}
                        {isMenuOpen && (
                          <div
                            ref={menuRef}
                            className="absolute right-6 top-10 z-30 w-44 bg-white rounded-xl shadow-xl border border-slate-200/90 py-1.5 text-left text-xs animate-in fade-in zoom-in-95 duration-100"
                          >
                            <button
                              onClick={() => handleEditClick(p)}
                              className="w-full px-3.5 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium cursor-pointer"
                            >
                              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                />
                              </svg>
                              <span>Edit Item</span>
                            </button>

                            <button
                              onClick={() => handleToggleStatus(p)}
                              className="w-full px-3.5 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium cursor-pointer border-t border-slate-100"
                            >
                              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  d="M8.25 9.75h4.875a3.375 3.375 0 013.375 3.375v0a3.375 3.375 0 01-3.375 3.375H8.25m0-6.75l2.25-2.25m-2.25 2.25l2.25 2.25"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                />
                              </svg>
                              <span>{p.is_active ? 'Deactivate Item' : 'Activate Item'}</span>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Pagination Footer */}
      <footer className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-1" data-purpose="table-pagination">
        <p className="text-sm text-slate-500">
          Showing <span className="font-medium text-slate-700">{totalItems > 0 ? startIndex + 1 : 0}</span> to{' '}
          <span className="font-medium text-slate-700">{endIndex}</span> of{' '}
          <span className="font-medium text-slate-700">{totalItems}</span> items
        </p>

        {/* Stepper Controls */}
        <nav aria-label="Pagination" className="inline-flex items-center gap-1.5">
          {/* Prev Button */}
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={safePage <= 1}
            aria-label="Previous page"
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            type="button"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M15.75 19.5 8.25 12l7.5-7.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* Page numbers */}
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => {
            const isActive = pg === safePage;
            return (
              <button
                key={pg}
                onClick={() => setCurrentPage(pg)}
                className={`w-8 h-8 flex items-center justify-center rounded-lg font-medium text-sm transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#0d9488] text-white shadow-xs'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
                type="button"
              >
                {pg}
              </button>
            );
          })}

          {/* Next Button */}
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            aria-label="Next page"
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            type="button"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="m8.25 4.5 7.5 7.5-7.5 7.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </nav>
      </footer>

      {/* Add / Edit Product Modal */}
      <AddProductModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        productToEdit={selectedProductForEdit}
        existingProducts={products}
        repository={repository}
        onProductAdded={async () => {
          await refreshData();
          showToast(
            selectedProductForEdit
              ? 'Item updated successfully.'
              : 'New product / service created successfully.'
          );
        }}
      />
    </>
  );
};

export default ProductsPage;
