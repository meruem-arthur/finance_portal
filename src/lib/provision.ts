import { prisma } from "@/lib/db";
import type { SsoClaims } from "@/lib/signing";

/**
 * Turns a verified dues-portal identity into a local user.
 *
 * Identity comes from the dues portal, but the finance ROLE is the finance
 * portal's own decision:
 *  - a dues SUPER_ADMIN is always a finance super admin (platform-wide role);
 *  - anyone else starts as PENDING until the super admin grants a role, unless
 *    the super admin pre-authorized their email;
 *  - a person who is no longer a dues super admin loses finance super admin.
 */
export async function provisionUser(claims: Pick<SsoClaims, "sub" | "name" | "email" | "role">) {
  const email = claims.email.trim().toLowerCase();
  const isSuper = claims.role === "SUPER_ADMIN";
  const now = new Date();

  const byDues = await prisma.user.findUnique({ where: { duesUserId: claims.sub } });
  if (byDues) {
    let financeRole = byDues.financeRole;
    if (isSuper) financeRole = "SUPER_ADMIN";
    else if (financeRole === "SUPER_ADMIN") financeRole = "PENDING";

    // Follow an email change made in the dues portal, unless the address is taken here.
    const emailTaken = byDues.email !== email ? await prisma.user.findUnique({ where: { email } }) : null;
    return prisma.user.update({
      where: { id: byDues.id },
      data: {
        name: claims.name,
        duesRole: claims.role,
        financeRole,
        lastLoginAt: now,
        ...(byDues.email !== email && !emailTaken ? { email } : {}),
      },
    });
  }

  const byEmail = await prisma.user.findUnique({ where: { email } });
  if (byEmail) {
    if (byEmail.duesUserId) throw new Error("This email is already linked to a different dues account");
    // Pre-authorized by the super admin: bind to this dues identity.
    return prisma.user.update({
      where: { id: byEmail.id },
      data: {
        duesUserId: claims.sub,
        name: claims.name,
        duesRole: claims.role,
        financeRole: isSuper ? "SUPER_ADMIN" : byEmail.financeRole,
        lastLoginAt: now,
      },
    });
  }

  return prisma.user.create({
    data: {
      duesUserId: claims.sub,
      email,
      name: claims.name,
      duesRole: claims.role,
      financeRole: isSuper ? "SUPER_ADMIN" : "PENDING",
      lastLoginAt: now,
    },
  });
}
