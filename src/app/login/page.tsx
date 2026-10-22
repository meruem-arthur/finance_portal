import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export default function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  const duesUrl = process.env.DUES_PORTAL_URL?.trim().replace(/\/+$/, "");
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="glass w-full max-w-md p-8 text-center">
        <p className="font-display text-sm uppercase tracking-widest text-gold">{env.departmentName}</p>
        <h1 className="mt-2 text-3xl font-bold">Finance Portal</h1>
        <p className="mt-3 text-sm text-paper/60">
          Sign in through the dues portal with your admin account. There is no separate password here.
        </p>
        {searchParams.error && (
          <p role="alert" className="mt-4 rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">
            That sign-in didn&apos;t work or has expired. Please try again.
          </p>
        )}
        {duesUrl ? (
          <a href={`${duesUrl}/api/finance/sso`} className="btn-gold mt-6 w-full">
            Sign in with the Dues Portal
          </a>
        ) : (
          <p className="mt-6 text-sm text-bad">DUES_PORTAL_URL is not configured.</p>
        )}
      </div>
    </main>
  );
}
