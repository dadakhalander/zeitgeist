import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PayrollResult, UserProfile, TimeLog } from '../types';
import { format } from 'date-fns';

export function generatePayslipPDF(
  result: PayrollResult,
  logs: TimeLog[],
  profile: UserProfile | null,
  date: Date
) {
  const doc = new jsPDF();
  const monthYear = format(date, 'MMMM yyyy');

  // Header
  doc.setFontSize(20);
  doc.text('PAYSLIP SIMULATION', 105, 20, { align: 'center' });
  
  doc.setFontSize(10);
  doc.text(`Period: ${monthYear}`, 105, 28, { align: 'center' });
  doc.text(`Generated on: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`, 105, 33, { align: 'center' });

  // Employee Profile
  doc.setFontSize(12);
  doc.text('Employee Information', 14, 45);
  doc.line(14, 47, 196, 47);
  
  doc.setFontSize(10);
  doc.text(`Name: ${profile?.displayName || 'Not set'}`, 14, 55);
  doc.text(`Tax Class: ${profile?.taxClass || '1'}`, 14, 60);
  doc.text(`State: ${profile?.state || 'BY'}`, 14, 65);
  doc.text(`Hourly Rate: ${profile?.hourlyRate || 0} EUR`, 14, 70);

  // Earnings Table
  doc.setFontSize(12);
  doc.text('Earnings Breakdown', 14, 85);
  autoTable(doc, {
    startY: 88,
    head: [['Description', 'Amount (EUR)']],
    body: [
      ['Taxable Gross Salary', result.taxableGross.toFixed(2)],
      ['Tax-Free SFN Bonus (Holiday/Sunday)', result.taxFreeBonus.toFixed(2)],
      [{ content: 'Total Gross Pay', styles: { fontStyle: 'bold' } }, { content: result.gross.toFixed(2), styles: { fontStyle: 'bold' } }],
    ],
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246] }
  });

  // Deductions Table
  const finalY = (doc as any).lastAutoTable.finalY || 88;
  doc.setFontSize(12);
  doc.text('Deductions', 14, finalY + 15);
  autoTable(doc, {
    startY: finalY + 18,
    head: [['Description', 'Employee Amount (EUR)']],
    body: [
      ['Income Tax (Lohnsteuer)', `-${result.taxes.incomeTax.toFixed(2)}`],
      ['Solidarity Surcharge (Soli)', `-${result.taxes.solidaritySurcharge.toFixed(2)}`],
      ['Church Tax', `-${result.taxes.churchTax.toFixed(2)}`],
      ['Health Insurance (KV)', `-${result.socialSecurity.health.toFixed(2)}`],
      ['Pension Insurance (RV)', `-${result.socialSecurity.pension.toFixed(2)}`],
      ['Unemployment Insurance (AV)', `-${result.socialSecurity.unemployment.toFixed(2)}`],
      ['Care Insurance (PV)', `-${result.socialSecurity.care.toFixed(2)}`],
      [{ content: 'Total Deductions', styles: { fontStyle: 'bold' } }, { content: `-${(result.gross - result.net).toFixed(2)}`, styles: { fontStyle: 'bold' } }],
    ],
    theme: 'striped',
    headStyles: { fillColor: [244, 63, 94] }
  });

  // Net Pay Highlight
  const secondFinalY = (doc as any).lastAutoTable.finalY;
  doc.setFillColor(59, 130, 246, 0.1);
  doc.rect(14, secondFinalY + 10, 182, 20, 'F');
  doc.setFontSize(14);
  doc.setTextColor(30, 64, 175);
  doc.setFont('helvetica', 'bold');
  doc.text('NET PAYOUT', 20, secondFinalY + 23);
  doc.text(`${result.net.toFixed(2)} EUR`, 190, secondFinalY + 23, { align: 'right' });

  // Shift Log Summary
  doc.addPage();
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(16);
  doc.text('Attendance Log Summary', 14, 20);
  
  autoTable(doc, {
    startY: 25,
    head: [['Date', 'Type', 'Hours', 'Gross Pay']],
    body: logs.map(log => {
      // We could calculate individual pay here if needed, but for now just summary
      const hours = log.startTime && log.endTime ? 'Logged' : '8.0';
      return [log.date, log.type, hours, '---'];
    }),
    theme: 'grid',
    headStyles: { fillColor: [75, 85, 99] }
  });

  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text('Disclaimer: This is a simulation based on German 2024 tax rules. Official payslips may differ based on specific health insurance providers or additional benefits.', 14, doc.internal.pageSize.height - 10);

  doc.save(`Payslip_${monthYear.replace(' ', '_')}.pdf`);
}
