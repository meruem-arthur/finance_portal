// Admin-only audit report generator. Builds a print-ready PDF straight in the
// browser (no server) that itemizes every transaction for a period, or for
// every period at once — something the finance exec can hand over the moment
// an audit is requested, without digging through anything else.

import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { computeSummary } from './financeData'

// jsPDF's built-in Helvetica font doesn't include the cedi glyph (₵) — it
// renders as garbled text. Use a plain "GHS" prefix in PDFs instead of the
// symbol formatGHS() uses elsewhere in the app.
function formatGHSForPdf(amount) {
  return 'GHS ' + Number(amount || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const PURPLE = [75, 18, 99]
const GOLD = [180, 140, 60]
const INK = [30, 30, 35]

function addHeader(doc, subtitle) {
  doc.setFillColor(...PURPLE)
  doc.rect(0, 0, 210, 28, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('GESA Finance Ledger', 14, 14)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('Geomatic Engineering Students Association · UMaT', 14, 20)
  doc.setTextColor(...INK)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text(subtitle, 14, 38)
  doc.setFont('helvetica', 'normal')
}

function addFooter(doc) {
  const pageCount = doc.internal.getNumberOfPages()
  const generated = new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(120, 120, 120)
    doc.text(`Generated ${generated} — for audit / record-keeping purposes`, 14, 289)
    doc.text(`Page ${i} of ${pageCount}`, 196, 289, { align: 'right' })
  }
}

function transactionRows(transactions) {
  return [...transactions]
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map((t) => [
      t.date,
      t.type === 'income' ? 'Income' : 'Expenditure',
      t.description,
      (t.type === 'income' ? '+ ' : '- ') + formatGHSForPdf(t.amount),
    ])
}

function summaryTable(doc, startY, summary) {
  autoTable(doc, {
    startY,
    body: [
      ['Total income', formatGHSForPdf(summary.income)],
      ['Total expenditure', formatGHSForPdf(summary.expenditure)],
      ['Balance', formatGHSForPdf(summary.balance)],
    ],
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 1.5 },
    columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right' } },
    margin: { left: 14 },
    tableWidth: 90,
  })
  return doc.lastAutoTable.finalY
}

export function exportPeriodAuditPdf(period, transactions) {
  const doc = new jsPDF()
  const summary = computeSummary(transactions)

  addHeader(doc, `Audit report — ${period.name}`)
  doc.setFontSize(10)
  doc.setTextColor(90, 90, 90)
  doc.text(`Period: ${period.startDate} to ${period.endDate}  ·  Status: ${period.status}`, 14, 45)

  autoTable(doc, {
    startY: 52,
    head: [['Date', 'Type', 'Description', 'Amount']],
    body: transactionRows(transactions),
    headStyles: { fillColor: GOLD, textColor: 255 },
    styles: { fontSize: 9, cellPadding: 2.5 },
    columnStyles: { 3: { halign: 'right' } },
  })

  const afterTableY = doc.lastAutoTable.finalY + 8
  doc.setFontSize(11)
  doc.setTextColor(...INK)
  doc.setFont('helvetica', 'bold')
  doc.text('Summary', 14, afterTableY)
  doc.setFont('helvetica', 'normal')
  summaryTable(doc, afterTableY + 3, summary)

  addFooter(doc)
  doc.save(`${period.name.replace(/\s+/g, '-').toLowerCase()}-audit-report.pdf`)
}

// periodsWithTransactions: [{ period, transactions }, ...]
export function exportFullAuditPdf(periodsWithTransactions) {
  const doc = new jsPDF()
  addHeader(doc, 'Full audit report — all periods')
  doc.setFontSize(10)
  doc.setTextColor(90, 90, 90)
  doc.text(`Covers ${periodsWithTransactions.length} financial period(s)`, 14, 45)

  let cursorY = 52
  const grand = { income: 0, expenditure: 0, balance: 0 }

  periodsWithTransactions.forEach(({ period, transactions }, idx) => {
    const summary = computeSummary(transactions)
    grand.income += summary.income
    grand.expenditure += summary.expenditure
    grand.balance += summary.balance

    if (idx > 0) {
      doc.addPage()
      addHeader(doc, `Audit report — ${period.name}`)
      cursorY = 45
    } else {
      doc.setFontSize(12)
      doc.setTextColor(...INK)
      doc.setFont('helvetica', 'bold')
      doc.text(period.name, 14, cursorY)
      doc.setFont('helvetica', 'normal')
      cursorY += 5
    }

    doc.setFontSize(9)
    doc.setTextColor(90, 90, 90)
    doc.text(`${period.startDate} to ${period.endDate} · Status: ${period.status}`, 14, cursorY)

    autoTable(doc, {
      startY: cursorY + 5,
      head: [['Date', 'Type', 'Description', 'Amount']],
      body: transactionRows(transactions),
      headStyles: { fillColor: GOLD, textColor: 255 },
      styles: { fontSize: 9, cellPadding: 2.5 },
      columnStyles: { 3: { halign: 'right' } },
    })

    const afterY = doc.lastAutoTable.finalY + 3
    cursorY = summaryTable(doc, afterY, summary) + 5
  })

  doc.addPage()
  addHeader(doc, 'Grand total — all periods')
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('Summary across all periods', 14, 45)
  doc.setFont('helvetica', 'normal')
  summaryTable(doc, 50, grand)

  addFooter(doc)
  doc.save('gesa-finance-full-audit-report.pdf')
}
