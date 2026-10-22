import { prisma } from "@/lib/db";

/** Who did what. Never allowed to break the action being logged. */
export async function audit(userId: string | null, action: string, entity: string, entityId?: string | null, summary?: string) {
  try {
    await prisma.auditLog.create({ data: { userId, action, entity, entityId: entityId ?? null, summary: summary ?? null } });
  } catch (err) {
    console.error("audit log write failed", action, err);
  }
}
