"use client";

import { useRef } from "react";
import { selectSemester } from "@/lib/actions/semesters";

export function SemesterSwitcher({ semesters, currentId }: { semesters: { id: string; label: string }[]; currentId: string | null }) {
  const formRef = useRef<HTMLFormElement>(null);
  if (semesters.length === 0) return null;
  return (
    <form ref={formRef} action={selectSemester}>
      <label className="label" htmlFor="semesterId">Semester</label>
      <select id="semesterId" name="semesterId" defaultValue={currentId ?? ""} className="input" onChange={() => formRef.current?.requestSubmit()}>
        {semesters.map((s) => (
          <option key={s.id} value={s.id}>{s.label}</option>
        ))}
      </select>
    </form>
  );
}
