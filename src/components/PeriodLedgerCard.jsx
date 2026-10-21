import { useEffect, useState } from 'react'
import { subscribeTransactions, computeSummary, formatGHS } from '../lib/financeData'

export default function PeriodLedgerCard({ period, selected, onSelect }) {
  const [transactions, setTransactions] = useState(period.transactions || [])

  useEffect(() => {
    const unsub = subscribeTransactions(period.id, setTransactions)
    return unsub
  }, [period.id])

  const { income, expenditure, balance } = computeSummary(transactions)

  return (
    <button
      onClick={() => onSelect(period.id)}
      className={`ledger-card glass focus-ring text-left rounded-2xl pt-4 pb-5 px-5 min-w-[260px] max-w-[260px] shrink-0 transition
        ${selected ? 'ring-2 ring-[var(--gold-bright)]' : ''}`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full
          ${period.status === 'open' ? 'bg-emerald-400/15 text-emerald-300' : 'bg-white/10 text-white/50'}`}>
          {period.status === 'open' ? 'Ongoing' : 'Closed'}
        </span>
        <span className="text-[11px] text-white/40">{period.startDate}</span>
      </div>
      <h3 className="display text-lg font-semibold leading-snug mb-4">{period.name}</h3>

      <div className="border-t border-dashed border-[var(--line)] pt-3 space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-white/50">Income</span>
          <span className="mono-figure text-emerald-300">{formatGHS(income)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-white/50">Expenditure</span>
          <span className="mono-figure text-rose-300">{formatGHS(expenditure)}</span>
        </div>
        <div className="flex justify-between text-sm pt-1.5 border-t border-[var(--line)] mt-1.5">
          <span className="font-semibold text-white/70">Balance</span>
          <span className="mono-figure font-semibold text-[var(--gold-bright)]">{formatGHS(balance)}</span>
        </div>
      </div>
    </button>
  )
}
