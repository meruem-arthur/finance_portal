import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/authz";
import { SignOutButton } from "@/components/sign-out-button";

export const dynamic = "force-dynamic";

export default async function AwaitingAccessPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.financeRole === "SUPER_ADMIN" || user.financeRole === "FINANCIAL_SECRETARY") redirect("/");

  const revoked = user.financeRole === "REVOKED";
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="glass w-full max-w-md p-8 text-center">
        <h1 className="text-2xl font-bold">{revoked ? "Access removed" : "Waiting for access"}</h1>
        <p className="mt-3 text-sm text-paper/70">
          {revoked
            ? "Your access to the finance portal has been removed. Contact the super admin if you think this is a mistake."
            : `You're signed in as ${user.email}, but the super admin hasn't given you access to the finance portal yet. Ask them to grant it, then sign in again.`}
        </p>
        <div className="mt-6">
          <SignOutButton />
        </div>
      </div>
    </main>
  );
}
