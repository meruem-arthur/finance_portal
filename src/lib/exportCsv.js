// Builds a CSV file in the browser and triggers a download — no server needed.

function toCsvValue(value) {
  const str = String(value ?? '')
  if (/[",\n]/.test(str)) return '"' + str.replace(/"/g, '""') + '"'
  return str
}

function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map(toCsvValue).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// Summary-only export — what members see: totals per period, no line items.
export function exportSummaryCsv(period, summary) {
  const rows = [
    ['Period', 'Start date', 'End date', 'Status', 'Income (GHS)', 'Expenditure (GHS)', 'Balance (GHS)'],
    [period.name, period.startDate, period.endDate, period.status, summary.income, summary.expenditure, summary.balance],
  ]
  downloadCsv(`${period.name.replace(/\s+/g, '-').toLowerCase()}-summary.csv`, rows)
}

// Full itemized export — for the finance exec's own records.
export function exportLedgerCsv(period, transactions) {
  const rows = [
    ['Period', period.name],
    ['Start date', period.startDate],
    ['End date', period.endDate],
    [],
    ['Date', 'Type', 'Description', 'Amount (GHS)'],
    ...transactions.map((t) => [t.date, t.type, t.description, t.amount]),
  ]
  downloadCsv(`${period.name.replace(/\s+/g, '-').toLowerCase()}-full-ledger.csv`, rows)
}
