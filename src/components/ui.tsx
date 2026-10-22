import clsx from "clsx";
import { formatGHS } from "@/lib/money";

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={clsx("glass p-5", className)}>{children}</section>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-paper">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-paper/60">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: number; hint?: string; tone?: "good" | "bad" | "warn" }) {
  return (
    <div className="glass p-4">
      <p className="text-xs uppercase tracking-wide text-paper/50">{label}</p>
      <p className={clsx("figure mt-1 text-2xl font-semibold", tone === "good" && "text-good", tone === "bad" && "text-bad", tone === "warn" && "text-warn")}>
        {formatGHS(value)}
      </p>
      {hint && <p className="mt-1 text-xs text-paper/50">{hint}</p>}
    </div>
  );
}

const BADGE: Record<string, string> = {
  DRAFT: "border-paper/30 text-paper/70",
  SUBMITTED: "border-warn/50 text-warn",
  APPROVED: "border-good/50 text-good",
  MUST: "border-bad/50 text-bad",
  SHOULD: "border-warn/50 text-warn",
  NICE: "border-paper/30 text-paper/70",
  OK: "border-good/50 text-good",
  WATCH: "border-warn/50 text-warn",
  OVER: "border-bad/50 text-bad",
};
const BADGE_TEXT: Record<string, string> = { MUST: "Must have", SHOULD: "Should have", NICE: "Nice to have", DRAFT: "Draft", SUBMITTED: "Submitted", APPROVED: "Approved", OK: "On track", WATCH: "Watch", OVER: "Over budget" };

export function Badge({ kind }: { kind: string }) {
  return <span className={clsx("inline-block rounded-full border px-2.5 py-0.5 text-xs", BADGE[kind])}>{BADGE_TEXT[kind] ?? kind}</span>;
}

export function Banner({ tone, children }: { tone: "bad" | "warn" | "good" | "info"; children: React.ReactNode }) {
  const styles = {
    bad: "border-bad/50 bg-bad/10 text-bad",
    warn: "border-warn/50 bg-warn/10 text-warn",
    good: "border-good/50 bg-good/10 text-good",
    info: "border-gold/40 bg-gold/10 text-goldBright",
  };
  return <div className={clsx("rounded-xl border px-4 py-3 text-sm", styles[tone])}>{children}</div>;
}

/** Spent vs budget bar. Turns amber at 80% and red past 100%. */
export function Bar({ spent, budget }: { spent: number; budget: number }) {
  const pct = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : spent > 0 ? 100 : 0;
  const over = spent > budget;
  const watch = !over && budget > 0 && spent * 100 >= budget * 80;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-white/10" role="img" aria-label={`${pct}% of budget used`}>
      <div className={clsx("h-full rounded-full", over ? "bg-bad" : watch ? "bg-warn" : "bg-good")} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-gold/25 px-4 py-8 text-center text-sm text-paper/50">{children}</p>;
}
