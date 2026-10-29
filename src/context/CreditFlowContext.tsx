import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { repository } from '../lib/idb/idb-repository';
import { ICreditFlowRepository } from '../types/repository';
import { BusinessSettings, Customer, Invoice, Payment, OverviewMetrics, ProductService } from '../types/models';

interface CreditFlowContextValue {
  repository: ICreditFlowRepository;
  business: BusinessSettings | null;
  customers: Customer[];
  products: ProductService[];
  invoices: Invoice[];
  payments: Payment[];
  metrics: OverviewMetrics | null;
  isLoading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
}

const CreditFlowContext = createContext<CreditFlowContextValue | undefined>(undefined);

export const CreditFlowProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [business, setBusiness] = useState<BusinessSettings | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<ProductService[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refreshData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      await repository.init();
      const [biz, custs, prods, invs, pays, mets] = await Promise.all([
        repository.getBusiness(),
        repository.getCustomers(),
        repository.getProducts(),
        repository.getInvoices(),
        repository.getPayments(),
        repository.getOverviewMetrics()
      ]);
      setBusiness(biz);
      setCustomers(custs);
      setProducts(prods);
      setInvoices(invs);
      setPayments(pays);
      setMetrics(mets);
    } catch (err: any) {
      console.error('[CreditFlowProvider] Failed to load data:', err);
      setError(err?.message || 'Failed to initialize database.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  return (
    <CreditFlowContext.Provider
      value={{
        repository,
        business,
        customers,
        products,
        invoices,
        payments,
        metrics,
        isLoading,
        error,
        refreshData
      }}
    >
      {children}
    </CreditFlowContext.Provider>
  );
};

export const useCreditFlow = (): CreditFlowContextValue => {
  const context = useContext(CreditFlowContext);
  if (!context) {
    throw new Error('useCreditFlow must be used within a CreditFlowProvider');
  }
  return context;
};
