import { AppShell } from "@/components/app-shell";
import { SemesterSwitcher } from "@/components/semester-switcher";
import { requireAccess } from "@/lib/authz";
import { env } from "@/lib/env";
import { getCurrentSemester } from "@/lib/queries";
import { semesterLabel } from "@/lib/semesters";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, role } = await requireAccess();
  const { semesters, current } = await getCurrentSemester();

  return (
    <AppShell
      departmentName={env.departmentName}
      userName={user.name}
      role={role}
      switcher={<SemesterSwitcher semesters={semesters.map((s) => ({ id: s.id, label: semesterLabel(s) }))} currentId={current?.id ?? null} />}
    >
      {children}
    </AppShell>
  );
}
