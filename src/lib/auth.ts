import type { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { provisionUser } from "@/lib/provision";
import { verifySsoToken } from "@/lib/signing";

/**
 * There is no password here. The only way in is the sign-in handoff from the
 * dues portal: a 60-second signed token, accepted once, for this department.
 */
export const authOptions: AuthOptions = {
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      id: "dues-sso",
      name: "Dues portal",
      credentials: { token: { label: "Token", type: "text" } },
      async authorize(credentials) {
        const raw = credentials?.token;
        if (!raw) return null;

        const claims = verifySsoToken(raw, env.duesPushToken);
        if (!claims) return null;
        if (claims.departmentCode.trim().toLowerCase() !== env.departmentCode.trim().toLowerCase()) return null;

        // Single use: a replayed token hits the primary key and is refused.
        try {
          await prisma.usedSsoToken.create({ data: { jti: claims.jti, expiresAt: new Date(claims.exp * 1000) } });
        } catch {
          return null;
        }
        await prisma.usedSsoToken.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(() => {});

        const user = await provisionUser(claims);
        return { id: user.id, name: user.name, email: user.email };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.uid = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.uid) session.user.id = token.uid;
      return session;
    },
  },
  secret: process.env.AUTH_SECRET,
};
