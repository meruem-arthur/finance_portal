import { useEffect, useMemo, useState } from 'react'
import { subscribePeriods, subscribeTransactions, computeSummary, formatGHS } from '../lib/financeData'
import { exportSummaryCsv } from '../lib/exportCsv'
import PeriodLedgerCard from '../components/PeriodLedgerCard'
import StatCard from '../components/StatCard'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'

export default function PublicDashboard() {
  const [periods, setPeriods] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [transactions, setTransactions] = useState([])

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

  // Running balance across all periods, oldest -> newest, for the trend line
  const trend = useMemo(() => {
    const sorted = [...periods].sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
    let running = 0
    return sorted.map((p) => {
      const s = computeSummary(p.transactions || [])
      running += s.balance
      return { name: p.name.length > 14 ? p.name.slice(0, 14) + '…' : p.name, balance: running }
    })
  }, [periods])

  return (
    <div className="min-h-screen">
      <header className="max-w-5xl mx-auto px-6 pt-10 pb-6">
        <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--gold-bright)]/80 mb-1">GESA UMaT · Geomatic Engineering</p>
        <h1 className="display text-3xl md:text-4xl font-extrabold">Finance Ledger</h1>
        <p className="text-white/50 text-sm mt-1">Transparent finances, accessible anytime.</p>
      </header>

      <main className="max-w-5xl mx-auto px-6 pb-16">
        {/* Hero ledger strip */}
        <section className="mb-8">
          <div className="flex gap-4 overflow-x-auto pb-3 -mx-1 px-1">
            {periods.map((p) => (
              <PeriodLedgerCard key={p.id} period={p} selected={p.id === selectedId} onSelect={setSelectedId} />
            ))}
            {periods.length === 0 && (
              <p className="text-white/40 text-sm py-6">No financial periods have been published yet.</p>
            )}
          </div>
        </section>

        {selectedPeriod && (
          <>
            <section className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <h2 className="display text-xl font-semibold">{selectedPeriod.name}</h2>
                <button
                  onClick={() => exportSummaryCsv(selectedPeriod, summary)}
                  className="btn-ghost text-xs"
                >
                  Export summary (CSV)
                </button>
              </div>
              <div className="flex flex-wrap gap-4">
                <StatCard label="Income" value={summary.income} tone="green" />
                <StatCard label="Expenditure" value={summary.expenditure} tone="rose" />
                <StatCard label="Balance available" value={summary.balance} tone="gold" />
              </div>
              <p className="text-white/35 text-xs mt-3">
                Showing summary totals for this period. Itemized transactions are kept by the finance executive and shared on request.
              </p>
            </section>
          </>
        )}

        {trend.length > 1 && (
          <section className="glass rounded-2xl p-5">
            <h3 className="text-sm uppercase tracking-wider text-white/50 mb-4">Balance trend across programs</h3>
            <div style={{ width: '100%', height: 220 }}>
              <ResponsiveContainer>
                <LineChart data={trend} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="name" stroke="rgba(255,255,255,0.35)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="rgba(255,255,255,0.35)" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#140b22', border: '1px solid var(--line)', borderRadius: 10, fontSize: 12 }}
                    formatter={(v) => formatGHS(v)}
                  />
                  <Line type="monotone" dataKey="balance" stroke="#e8c97a" strokeWidth={2.5} dot={{ r: 3, fill: '#e8c97a' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
