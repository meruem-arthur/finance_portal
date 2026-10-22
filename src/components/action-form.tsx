"use client";

import { useEffect, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import clsx from "clsx";
import { initialState, type ActionState } from "@/lib/action-state";

export function SubmitButton({
  children,
  pendingText = "Saving...",
  className = "btn-gold",
  confirm,
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
  /** Ask "are you sure?" before submitting. */
  confirm?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={className}
      onClick={confirm ? (e) => { if (!window.confirm(confirm)) e.preventDefault(); } : undefined}
    >
      {pending ? pendingText : children}
    </button>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  if (state.error) return <p role="alert" className="mt-2 text-sm text-bad">{state.error}</p>;
  if (state.ok && state.message) return <p role="status" className="mt-2 text-sm text-good">{state.message}</p>;
  return null;
}

/** A form wired to a server action, showing its error or success message. */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction] = useFormState(action, initialState);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form ref={ref} action={formAction} className={clsx(className)}>
      {children}
      <FormMessage state={state} />
    </form>
  );
}
