import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  subscribePeriods, subscribeTransactions, addPeriod, updatePeriod, deletePeriod,
  addTransaction, deleteTransaction, computeSummary, formatGHS, DEMO_MODE,
  fetchAllPeriodsWithTransactions,
} from '../lib/financeData'
import { exportSummaryCsv, exportLedgerCsv } from '../lib/exportCsv'
import { exportPeriodAuditPdf, exportFullAuditPdf } from '../lib/exportPdf'

export default function AdminDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [periods, setPeriods] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [transactions, setTransactions] = useState([])

  const [newPeriodName, setNewPeriodName] = useState('')
  const [newPeriodStart, setNewPeriodStart] = useState('')
  const [newPeriodEnd, setNewPeriodEnd] = useState('')

  const [txnType, setTxnType] = useState('income')
  const [txnDesc, setTxnDesc] = useState('')
  const [txnAmount, setTxnAmount] = useState('')
  const [txnDate, setTxnDate] = useState('')
  const [generatingReport, setGeneratingReport] = useState(false)

  useEffect(() => {
    const unsub = subscribePeriods((data) => {
      setPeriods(data)
      if (!selectedId && data.length) setSelectedId(data[0].id)
    })
    return unsub
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!selectedId) return
    const unsub = subscribeTransactions(selectedId, setTransactions)
    return unsub
  }, [selectedId])

  const selectedPeriod = periods.find((p) => p.id === selectedId)
  const summary = computeSummary(transactions)

  async function handleCreatePeriod(e) {
    e.preventDefault()
    if (!newPeriodName || !newPeriodStart) return
    await addPeriod({
      name: newPeriodName,
      startDate: newPeriodStart,
      endDate: newPeriodEnd || newPeriodStart,
      status: 'open',
    })
    setNewPeriodName(''); setNewPeriodStart(''); setNewPeriodEnd('')
  }

  async function handleAddTransaction(e) {
    e.preventDefault()
    if (!selectedId || !txnDesc || !txnAmount || !txnDate) return
    await addTransaction(selectedId, {
      type: txnType,
      description: txnDesc,
      amount: Number(txnAmount),
      date: txnDate,
    })
    setTxnDesc(''); setTxnAmount(''); setTxnDate('')
  }

  async function handleToggleStatus() {
    if (!selectedPeriod) return
    await updatePeriod(selectedPeriod.id, { status: selectedPeriod.status === 'open' ? 'closed' : 'open' })
  }

  async function handleDeletePeriod() {
    if (!selectedPeriod) return
    if (!confirm(`Delete "${selectedPeriod.name}" and all its transactions? This can't be undone.`)) return
    await deletePeriod(selectedPeriod.id)
    setSelectedId(null)
  }

  async function handleFullAuditReport() {
    setGeneratingReport(true)
    try {
      const data = await fetchAllPeriodsWithTransactions()
      if (data.length === 0) {
        alert('No financial periods to include in a report yet.')
        return
      }
      exportFullAuditPdf(data)
    } finally {
      setGeneratingReport(false)
    }
  }

  return (
    <div className="min-h-screen">
      <header className="max-w-5xl mx-auto px-6 pt-8 pb-6 flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--gold-bright)]/80 mb-1">GESA UMaT · Finance admin</p>
          <h1 className="display text-2xl md:text-3xl font-extrabold">Manage the ledger</h1>
          <p className="text-white/40 text-xs mt-1">Signed in as {user?.email}{DEMO_MODE ? ' (demo)' : ''}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleFullAuditReport} disabled={generatingReport} className="btn-glass text-sm disabled:opacity-60">
            {generatingReport ? 'Generating…' : 'Full audit report (PDF)'}
          </button>
          <button onClick={() => navigate('/')} className="btn-ghost text-sm">View public page</button>
          <button onClick={async () => { await logout(); navigate('/admin/login') }} className="btn-ghost text-sm">Sign out</button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 pb-16 grid md:grid-cols-[280px_1fr] gap-6">
        {/* Periods list + create form */}
        <aside className="glass rounded-2xl p-5 h-fit">
          <h2 className="text-sm uppercase tracking-wider text-white/50 mb-3">Financial periods</h2>
          <div className="space-y-2 mb-5 max-h-72 overflow-y-auto pr-1">
            {periods.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={`focus-ring w-full text-left rounded-xl px-3 py-2 text-sm transition
                  ${p.id === selectedId ? 'bg-[var(--gold)]/20 text-[var(--gold-bright)]' : 'hover:bg-white/5 text-white/70'}`}
              >
                {p.name}
              </button>
            ))}
            {periods.length === 0 && <p className="text-white/40 text-xs">No periods yet — add one below.</p>}
          </div>

          <form onSubmit={handleCreatePeriod} className="space-y-2 border-t border-[var(--line)] pt-4">
            <p className="text-xs text-white/50 mb-1">New period / program</p>
            <input
              value={newPeriodName}
              onChange={(e) => setNewPeriodName(e.target.value)}
              placeholder="e.g. Matriculation Week"
              className="focus-ring w-full rounded-lg bg-white/5 border border-[var(--line)] px-3 py-2 text-sm outline-none"
            />
            <div className="flex gap-2">
              <input
                type="date"
                value={newPeriodStart}
                onChange={(e) => setNewPeriodStart(e.target.value)}
                className="focus-ring w-full rounded-lg bg-white/5 border border-[var(--line)] px-3 py-2 text-xs outline-none"
              />
              <input
                type="date"
                value={newPeriodEnd}
                onChange={(e) => setNewPeriodEnd(e.target.value)}
                className="focus-ring w-full rounded-lg bg-white/5 border border-[var(--line)] px-3 py-2 text-xs outline-none"
              />
            </div>
            <button type="submit" className="btn-glass w-full text-sm mt-1">Add period</button>
          </form>
        </aside>

        {/* Selected period detail */}
        <section>
          {!selectedPeriod && (
            <div className="glass rounded-2xl p-8 text-center text-white/40">
              Select or create a financial period to start entering transactions.
            </div>
          )}

          {selectedPeriod && (
            <>
              <div className="glass rounded-2xl p-5 mb-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="display text-lg font-semibold">{selectedPeriod.name}</h2>
                    <p className="text-white/40 text-xs">{selectedPeriod.startDate} – {selectedPeriod.endDate}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-end">
                    <button onClick={() => exportSummaryCsv(selectedPeriod, summary)} className="btn-ghost text-xs">
                      Export summary
                    </button>
                    <button onClick={() => exportLedgerCsv(selectedPeriod, transactions)} className="btn-ghost text-xs">
                      Export full ledger
                    </button>
                    <button onClick={() => exportPeriodAuditPdf(selectedPeriod, transactions)} className="btn-ghost text-xs">
                      Audit report (PDF)
                    </button>
                    <button onClick={handleToggleStatus} className="btn-ghost text-xs">
                      Mark as {selectedPeriod.status === 'open' ? 'closed' : 'open'}
                    </button>
                    <button onClick={handleDeletePeriod} className="btn-ghost text-xs text-rose-300 border-rose-400/30">
                      Delete period
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-4 text-sm">
                  <p className="text-white/60">Income: <span className="mono-figure text-emerald-300">{formatGHS(summary.income)}</span></p>
                  <p className="text-white/60">Expenditure: <span className="mono-figure text-rose-300">{formatGHS(summary.expenditure)}</span></p>
                  <p className="text-white/60">Balance: <span className="mono-figure text-[var(--gold-bright)] font-semibold">{formatGHS(summary.balance)}</span></p>
                </div>
              </div>

              <div className="glass rounded-2xl p-5 mb-5">
                <h3 className="text-sm uppercase tracking-wider text-white/50 mb-3">Add transaction</h3>
                <form onSubmit={handleAddTransaction} className="grid sm:grid-cols-[110px_1fr_130px_130px_auto] gap-2">
                  <select
                    value={txnType}
                    onChange={(e) => setTxnType(e.target.value)}
                    className="focus-ring rounded-lg bg-white/5 border border-[var(--line)] px-2 py-2 text-sm outline-none"
                  >
                    <option value="income">Income</option>
                    <option value="expenditure">Expenditure</option>
                  </select>
                  <input
                    value={txnDesc}
                    onChange={(e) => setTxnDesc(e.target.value)}
                    placeholder="Description"
                    className="focus-ring rounded-lg bg-white/5 border border-[var(--line)] px-3 py-2 text-sm outline-none"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={txnAmount}
                    onChange={(e) => setTxnAmount(e.target.value)}
                    placeholder="Amount (GH₵)"
                    className="focus-ring rounded-lg bg-white/5 border border-[var(--line)] px-3 py-2 text-sm outline-none"
                  />
                  <input
                    type="date"
                    value={txnDate}
                    onChange={(e) => setTxnDate(e.target.value)}
                    className="focus-ring rounded-lg bg-white/5 border border-[var(--line)] px-3 py-2 text-sm outline-none"
                  />
                  <button type="submit" className="btn-glass text-sm">Add</button>
                </form>
              </div>

              <div className="glass rounded-2xl p-5">
                <h3 className="text-sm uppercase tracking-wider text-white/50 mb-3">Transaction log</h3>
                <div className="divide-y divide-[var(--line)]">
                  {transactions.length === 0 && <p className="text-white/40 text-sm py-4">No transactions yet.</p>}
                  {transactions.map((t) => (
                    <div key={t.id} className="flex items-center justify-between py-2.5 text-sm gap-3">
                      <div className="min-w-0">
                        <p className="text-white/85 truncate">{t.description}</p>
                        <p className="text-white/35 text-xs">{t.date}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className={`mono-figure font-medium ${t.type === 'income' ? 'text-emerald-300' : 'text-rose-300'}`}>
                          {t.type === 'income' ? '+' : '−'}{formatGHS(t.amount)}
                        </span>
                        <button
                          onClick={() => deleteTransaction(selectedId, t.id)}
                          className="text-white/30 hover:text-rose-300 text-xs"
                          aria-label="Delete transaction"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  )
}
