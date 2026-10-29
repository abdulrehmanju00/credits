import { DueStatus, PaymentStatus, DisplayStatus } from '../types/models';

export function rupeesToPaisa(rupees: number | string): number {
  if (typeof rupees === 'string') {
    rupees = parseFloat(rupees.replace(/[^0-9.-]/g, '')) || 0;
  }
  return Math.round((Number(rupees) || 0) * 100);
}

export function paisaToRupees(paisa: number): number {
  return (Number(paisa) || 0) / 100;
}

export function formatPKR(paisa: number, includePrefix = true): string {
  const rs = (Number(paisa) || 0) / 100;
  const formatted = rs.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return includePrefix ? `PKR ${formatted}` : formatted;
}

export function formatShortPKR(paisa: number): string {
  const rs = (Number(paisa) || 0) / 100;
  if (rs >= 1000000) {
    return `PKR ${(rs / 1000000).toFixed(1)}M`;
  }
  if (rs >= 100000) {
    return `PKR ${(rs / 100000).toFixed(1)} Lakh`;
  }
  if (rs >= 1000) {
    return `PKR ${(rs / 1000).toFixed(0)}k`;
  }
  return `PKR ${rs}`;
}

export function computePaymentStatus(totalPaisa: number, paidPaisa: number): PaymentStatus {
  if (paidPaisa >= totalPaisa) return 'PAID';
  if (paidPaisa > 0) return 'PARTIAL';
  return 'UNPAID';
}

export function computeDueStatus(dueDateStr: string, currentDateStr = new Date().toISOString().split('T')[0]): DueStatus {
  if (!dueDateStr) return 'CURRENT';
  if (dueDateStr < currentDateStr) return 'OVERDUE';
  const dueTime = new Date(dueDateStr).getTime();
  const currTime = new Date(currentDateStr).getTime();
  const diffDays = Math.ceil((dueTime - currTime) / (1000 * 60 * 60 * 24));
  if (diffDays <= 7) return 'DUE_SOON';
  return 'CURRENT';
}

export function computeDisplayStatus(paymentStatus: PaymentStatus, dueStatus: DueStatus): DisplayStatus {
  if (paymentStatus === 'PAID') return 'Paid';
  if (paymentStatus === 'PARTIAL') return 'Partial';
  if (dueStatus === 'OVERDUE') return 'Overdue';
  if (dueStatus === 'DUE_SOON') return 'Due Soon';
  return 'Current';
}

export function formatDate(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}
