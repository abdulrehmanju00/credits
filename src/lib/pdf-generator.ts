import { jsPDF } from 'jspdf';
import { InvoicePrintPayload } from './invoice-print-data';

/**
 * Generates and downloads a clean, professional A4 portrait PDF for an invoice.
 * Adheres to standard business document formatting with crisp typography,
 * unclipped margins, and proper PKR currency formatting.
 */
export function generateInvoicePDF(payload: InvoicePrintPayload): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // Primary brand colors
  const primaryColor: [number, number, number] = [5, 150, 105]; // #059669 emerald
  const textDark: [number, number, number] = [15, 23, 42]; // #0f172a
  const textMuted: [number, number, number] = [100, 116, 139]; // #64748b
  const borderColor: [number, number, number] = [226, 232, 240]; // #e2e8f0
  const lightBg: [number, number, number] = [248, 250, 252]; // #f8fafc

  // 1. Business Header & Invoice Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...primaryColor);
  doc.text('CreditFlow', margin, y + 4);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...textDark);
  doc.text('INVOICE', pageWidth - margin, y + 4, { align: 'right' });

  y += 12;

  // Business Details (Left) vs Invoice Meta (Right)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...textDark);
  doc.text(payload.business.name || 'Shah Traders', margin, y);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...primaryColor);
  doc.text(payload.invoice.number, pageWidth - margin, y, { align: 'right' });

  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...textMuted);

  const businessLines = [
    payload.business.address ? `${payload.business.address}, ${payload.business.city}` : payload.business.city,
    `Phone: ${payload.business.phone}`,
    `Email: ${payload.business.email}`,
    payload.business.taxNumber ? `NTN / Tax ID: ${payload.business.taxNumber}` : ''
  ].filter(Boolean);

  businessLines.forEach((line) => {
    doc.text(line, margin, y);
    y += 4.2;
  });

  // Invoice meta tags on the right
  let metaY = y - businessLines.length * 4.2;
  doc.text(`Issue Date: ${payload.invoice.issueDate}`, pageWidth - margin, metaY, { align: 'right' });
  metaY += 4.2;
  doc.text(`Due Date: ${payload.invoice.dueDate}`, pageWidth - margin, metaY, { align: 'right' });
  metaY += 4.2;
  doc.text(`Status: ${payload.invoice.status} (${payload.invoice.paymentStatus})`, pageWidth - margin, metaY, { align: 'right' });
  if (payload.invoice.reference) {
    metaY += 4.2;
    doc.text(`Ref: ${payload.invoice.reference}`, pageWidth - margin, metaY, { align: 'right' });
  }

  y = Math.max(y, metaY) + 6;

  // Divider
  doc.setDrawColor(...borderColor);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // 2. Bill To Box
  doc.setFillColor(...lightBg);
  doc.roundedRect(margin, y, contentWidth, 24, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...textMuted);
  doc.text('BILLED TO', margin + 6, y + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...textDark);
  doc.text(payload.customer.name, margin + 6, y + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...textMuted);
  const custContact = [
    payload.customer.city,
    payload.customer.phone ? `Ph: ${payload.customer.phone}` : '',
    payload.customer.email ? `Email: ${payload.customer.email}` : ''
  ].filter(Boolean).join('  |  ');
  doc.text(custContact, margin + 6, y + 18);

  y += 32;

  // 3. Line Items Table
  // Table Header
  const colDesc = margin + 4;
  const colQty = margin + 92;
  const colPrice = margin + 125;
  const colTotal = pageWidth - margin - 4;

  doc.setFillColor(...lightBg);
  doc.rect(margin, y - 4, contentWidth, 8, 'F');
  doc.setDrawColor(...borderColor);
  doc.line(margin, y + 4, pageWidth - margin, y + 4);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...textDark);
  doc.text('Description', colDesc, y + 1);
  doc.text('Qty', colQty, y + 1, { align: 'center' });
  doc.text('Unit Price (PKR)', colPrice, y + 1, { align: 'right' });
  doc.text('Amount (PKR)', colTotal, y + 1, { align: 'right' });

  y += 9;

  // Table Body Rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...textDark);

  payload.lineItems.forEach((item, idx) => {
    // Alternating faint row background
    if (idx % 2 === 1) {
      doc.setFillColor(252, 253, 254);
      doc.rect(margin, y - 3.5, contentWidth, 7.5, 'F');
    }

    doc.setFont('helvetica', 'medium');
    doc.text(item.description, colDesc, y + 1.5);

    doc.setFont('helvetica', 'normal');
    doc.text(String(item.quantity), colQty, y + 1.5, { align: 'center' });
    doc.text(item.unitPricePKR.replace('PKR ', ''), colPrice, y + 1.5, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.text(item.amountPKR.replace('PKR ', ''), colTotal, y + 1.5, { align: 'right' });

    // Faint row bottom line
    doc.setDrawColor(241, 245, 249);
    doc.setLineWidth(0.2);
    doc.line(margin, y + 4, pageWidth - margin, y + 4);

    y += 7.5;
  });

  y += 4;

  // 4. Financial Summary Card (Right Aligned)
  const summaryWidth = 78;
  const summaryX = pageWidth - margin - summaryWidth;

  const summaryItems = [
    { label: 'Subtotal', value: payload.summary.subtotalPKR },
    ...(payload.summary.discountPaisa > 0 ? [{ label: 'Discount', value: `- ${payload.summary.discountPKR}` }] : []),
    ...(payload.summary.taxPaisa > 0 ? [{ label: 'Tax', value: payload.summary.taxPKR }] : []),
    { label: 'Total Amount', value: payload.summary.totalPKR, isBold: true },
    { label: 'Amount Paid', value: payload.summary.paidPKR },
    { label: 'Remaining Balance', value: payload.summary.balanceDuePKR, isHighlight: true }
  ];

  summaryItems.forEach((row) => {
    if (row.isHighlight) {
      y += 2;
      doc.setFillColor(232, 247, 240); // #e8f7f0
      doc.roundedRect(summaryX - 4, y - 3.5, summaryWidth + 4, 8, 1.5, 1.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(...primaryColor);
      doc.text(row.label, summaryX, y + 2);
      doc.text(row.value, pageWidth - margin - 2, y + 2, { align: 'right' });
      y += 8;
    } else {
      doc.setFont('helvetica', row.isBold ? 'bold' : 'normal');
      doc.setFontSize(row.isBold ? 9.5 : 8.5);
      doc.setTextColor(...(row.isBold ? textDark : textMuted));
      doc.text(row.label, summaryX, y);
      doc.text(row.value, pageWidth - margin, y, { align: 'right' });
      y += 5.5;
    }
  });

  // 5. Notes / Payment Terms (Left Side if present)
  let notesY = y;
  if (payload.invoice.notes) {
    const notesBoxWidth = contentWidth - summaryWidth - 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...textDark);
    doc.text('Notes & Payment Instructions:', margin, notesY - 18);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...textMuted);
    const splitNotes = doc.splitTextToSize(payload.invoice.notes, notesBoxWidth);
    doc.text(splitNotes, margin, notesY - 13);
  }

  // 6. Footer (Pinned to bottom of A4)
  const footerY = pageHeight - margin + 4;
  doc.setDrawColor(...borderColor);
  doc.setLineWidth(0.3);
  doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...textMuted);
  doc.text(
    payload.business.footerNotes || 'Thank you for your business. For bank transfers, quote invoice number.',
    margin,
    footerY
  );
  doc.text('Powered by CreditFlow', pageWidth - margin, footerY, { align: 'right' });

  // 7. Save file with invoice number filename
  const filename = `${payload.invoice.number || 'Invoice'}.pdf`;
  doc.save(filename);
}
