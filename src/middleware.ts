import { withAuth } from "next-auth/middleware";

// Every page needs a session except sign-in itself and the machine endpoints,
// which carry their own signature/secret checks. WHAT a signed-in person may do
// is decided server-side (src/lib/authz.ts), never here.
export default withAuth({
  pages: { signIn: "/login" },
  secret: process.env.AUTH_SECRET,
});

export const config = {
  matcher: ["/((?!login|auth/sso|api/auth|api/webhooks|api/cron|_next/static|_next/image|favicon.ico).*)"],
};
