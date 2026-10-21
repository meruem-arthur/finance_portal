import { formatGHS } from '../lib/financeData'

export default function StatCard({ label, value, tone = 'gold' }) {
  const color = tone === 'gold' ? 'text-[var(--gold-bright)]' : tone === 'rose' ? 'text-rose-300' : 'text-emerald-300'
  return (
    <div className="glass rounded-2xl px-5 py-4 flex-1 min-w-[150px]">
      <p className="text-xs uppercase tracking-wider text-white/50 mb-1">{label}</p>
      <p className={`mono-figure text-2xl font-semibold ${color}`}>{formatGHS(value)}</p>
    </div>
  )
}
