import { redirect } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Card, PageHeader } from "@/components/ui";
import { preauthorize, setRole } from "@/lib/actions/team";
import { requireAccess } from "@/lib/authz";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const LABEL: Record<string, string> = { SUPER_ADMIN: "Super admin", FINANCIAL_SECRETARY: "Financial secretary", PENDING: "Waiting for access", REVOKED: "Access removed" };

export default async function TeamPage() {
  const { user: me, role } = await requireAccess();
  if (role !== "SUPER_ADMIN") redirect("/");

  const users = await prisma.user.findMany({ orderBy: [{ financeRole: "asc" }, { name: "asc" }] });

  return (
    <>
      <PageHeader title="Team" subtitle="People sign in through the dues portal. Only the access you grant here lets them into the finance portal." />

      <Card className="mb-6 overflow-x-auto p-2">
        <table className="w-full min-w-[640px]">
          <thead><tr><th className="th">Person</th><th className="th">Access</th><th className="th">Last sign-in</th><th className="th" /></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-gold/10">
                <td className="td"><p className="font-medium">{u.name}</p><p className="text-xs text-paper/50">{u.email}</p></td>
                <td className="td">{LABEL[u.financeRole]}{!u.duesUserId && <p className="text-xs text-paper/50">Hasn&apos;t signed in yet</p>}</td>
                <td className="td figure text-paper/70">{u.lastLoginAt ? u.lastLoginAt.toISOString().slice(0, 16).replace("T", " ") : "-"}</td>
                <td className="td">
                  {u.financeRole === "SUPER_ADMIN" || u.id === me.id ? (
                    <span className="text-xs text-paper/40">{u.id === me.id ? "You" : "Set in the dues portal"}</span>
                  ) : (
                    <ActionForm action={setRole} className="flex items-center gap-2">
                      <input type="hidden" name="userId" value={u.id} />
                      <select name="role" defaultValue={u.financeRole} className="input w-52">
                        <option value="FINANCIAL_SECRETARY">Financial secretary</option>
                        <option value="PENDING">Waiting for access</option>
                        <option value="REVOKED">Remove access</option>
                      </select>
                      <SubmitButton pendingText="...">Save</SubmitButton>
                    </ActionForm>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card>
        <h2 className="mb-1 text-lg font-semibold">Approve someone in advance</h2>
        <p className="mb-3 text-sm text-paper/60">Enter their dues-portal email. They become a financial secretary the first time they sign in with it.</p>
        <ActionForm action={preauthorize} resetOnSuccess className="flex flex-wrap items-end gap-3">
          <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" required className="input w-72" /></div>
          <SubmitButton>Approve</SubmitButton>
        </ActionForm>
      </Card>
    </>
  );
}
