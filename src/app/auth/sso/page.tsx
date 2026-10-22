"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

/**
 * Landing page of the sign-in handoff. The dues portal sends the one-time token
 * in the URL fragment (#token=...), which never reaches any server log. We read
 * it, remove it from the address bar straight away, and exchange it for a session.
 */
export default function SsoPage() {
  const router = useRouter();
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const token = new URLSearchParams(window.location.hash.slice(1)).get("token");
    window.history.replaceState(null, "", window.location.pathname);
    if (!token) {
      setError("This page is only reached from the dues portal.");
      return;
    }
    signIn("dues-sso", { token, redirect: false }).then((res) => {
      if (res?.ok && !res.error) router.replace("/");
      else setError("This sign-in link is invalid or has expired.");
    });
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="glass w-full max-w-md p-8 text-center">
        {error ? (
          <>
            <p role="alert" className="text-bad">{error}</p>
            <a href="/login" className="btn-gold mt-6">Back to sign in</a>
          </>
        ) : (
          <p className="text-paper/70">Signing you in...</p>
        )}
      </div>
    </main>
  );
}
