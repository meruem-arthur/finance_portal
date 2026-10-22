"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { signOut } from "next-auth/react";
import { BookOpen, CalendarRange, LayoutDashboard, LogOut, Menu, PiggyBank, Users, Wallet, X } from "lucide-react";

type Item = { href: string; label: string; icon: React.ReactNode; superOnly?: boolean };

const ITEMS: Item[] = [
  { href: "/", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
  { href: "/ledger", label: "Ledger", icon: <BookOpen size={18} /> },
  { href: "/dues", label: "Dues income", icon: <Wallet size={18} /> },
  { href: "/budget", label: "Budgets", icon: <PiggyBank size={18} /> },
  { href: "/semesters", label: "Semesters", icon: <CalendarRange size={18} />, superOnly: true },
  { href: "/team", label: "Team", icon: <Users size={18} />, superOnly: true },
];

export function AppShell({
  departmentName,
  userName,
  role,
  switcher,
  children,
}: {
  departmentName: string;
  userName: string;
  role: "SUPER_ADMIN" | "FINANCIAL_SECRETARY";
  switcher: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  const nav = (
    <>
      <div className="mb-6 px-2">
        <p className="font-display text-lg font-bold text-goldBright">Finance</p>
        <p className="text-xs text-paper/60">{departmentName}</p>
      </div>
      <div className="mb-4 px-1">{switcher}</div>
      <nav className="flex-1 space-y-1">
        {ITEMS.filter((i) => !i.superOnly || role === "SUPER_ADMIN").map((i) => {
          const active = i.href === "/" ? pathname === "/" : pathname?.startsWith(i.href);
          return (
            <Link key={i.href} href={i.href} className={clsx("nav-link", active && "nav-link-active")}>
              {i.icon}
              {i.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-4 border-t border-gold/20 pt-4">
        <p className="truncate px-2 text-sm font-medium">{userName}</p>
        <p className="mb-2 px-2 text-xs text-paper/50">{role === "SUPER_ADMIN" ? "Super admin" : "Financial secretary"}</p>
        <button type="button" className="nav-link w-full" onClick={() => signOut({ callbackUrl: "/login" })}>
          <LogOut size={18} />
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <div className="flex items-center gap-3 border-b border-gold/20 bg-ink/80 px-4 py-3 md:hidden">
        <button type="button" aria-label="Open menu" onClick={() => setOpen(true)}>
          <Menu size={22} />
        </button>
        <p className="font-display font-bold text-goldBright">Finance</p>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="relative flex h-full w-72 max-w-[85vw] flex-col border-r border-gold/20 bg-ink px-4 py-5">
            <button type="button" aria-label="Close menu" className="absolute right-3 top-3" onClick={() => setOpen(false)}>
              <X size={20} />
            </button>
            {nav}
          </aside>
        </div>
      )}

      <aside className="hidden w-64 flex-shrink-0 flex-col border-r border-gold/20 bg-ink/60 px-4 py-5 md:flex">{nav}</aside>
      <main className="min-w-0 flex-1 p-4 sm:p-8">{children}</main>
    </div>
  );
}
