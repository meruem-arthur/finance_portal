import Link from "next/link";
import { Banner } from "@/components/ui";

export function NoSemester({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  return (
    <Banner tone="info">
      No semester has been set up yet.{" "}
      {isSuperAdmin ? (
        <>
          <Link href="/semesters" className="underline">Create the first semester</Link> to start tracking income, spending and budgets.
        </>
      ) : (
        "Ask the super admin to create the semester dates."
      )}
    </Banner>
  );
}
