import { isRedirectError } from "next/dist/client/components/redirect";
import { ActionError } from "@/lib/authz";
import type { ActionState } from "@/lib/action-state";

/** Runs a server action body, turning expected problems into a message for the form. */
export async function runAction(body: () => Promise<string | void>): Promise<ActionState> {
  try {
    const message = await body();
    return { ok: true, message: message || undefined };
  } catch (err) {
    if (isRedirectError(err)) throw err;
    if (err instanceof ActionError) return { ok: false, error: err.message };
    console.error("server action failed", err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
