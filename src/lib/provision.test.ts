import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: { user: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() } },
}));

import { prisma } from "@/lib/db";
import { provisionUser } from "./provision";

const db = vi.mocked(prisma, true);
const claims = (over: object = {}) => ({ sub: "d1", name: "Ama", email: "Ama@Example.com", role: "DEPARTMENT_ADMIN" as const, ...over });

beforeEach(() => {
  vi.clearAllMocks();
  db.user.update.mockImplementation((async (a: any) => ({ id: "u", ...a.data })) as any);
  db.user.create.mockImplementation((async (a: any) => ({ id: "new", ...a.data })) as any);
});

describe("provisionUser", () => {
  it("a first-time department admin starts PENDING - no access until granted", async () => {
    db.user.findUnique.mockResolvedValue(null);
    const u = await provisionUser(claims());
    expect(u).toMatchObject({ financeRole: "PENDING", email: "ama@example.com", duesUserId: "d1" });
  });

  it("a dues super admin is always a finance super admin", async () => {
    db.user.findUnique.mockResolvedValue(null);
    expect(await provisionUser(claims({ role: "SUPER_ADMIN" }))).toMatchObject({ financeRole: "SUPER_ADMIN" });
  });

  it("keeps a granted financial secretary role on later sign-ins", async () => {
    db.user.findUnique.mockResolvedValueOnce({ id: "u1", email: "ama@example.com", duesUserId: "d1", financeRole: "FINANCIAL_SECRETARY" } as any);
    expect(await provisionUser(claims())).toMatchObject({ financeRole: "FINANCIAL_SECRETARY" });
  });

  it("does not resurrect a revoked person", async () => {
    db.user.findUnique.mockResolvedValueOnce({ id: "u1", email: "ama@example.com", duesUserId: "d1", financeRole: "REVOKED" } as any);
    expect(await provisionUser(claims())).toMatchObject({ financeRole: "REVOKED" });
  });

  it("demotes someone who is no longer a dues super admin", async () => {
    db.user.findUnique.mockResolvedValueOnce({ id: "u1", email: "ama@example.com", duesUserId: "d1", financeRole: "SUPER_ADMIN" } as any);
    expect(await provisionUser(claims())).toMatchObject({ financeRole: "PENDING" });
  });

  it("binds a pre-authorized email to the dues identity and keeps the granted role", async () => {
    db.user.findUnique.mockResolvedValueOnce(null); // by dues id
    db.user.findUnique.mockResolvedValueOnce({ id: "pre", email: "ama@example.com", duesUserId: null, financeRole: "FINANCIAL_SECRETARY" } as any);
    const u = await provisionUser(claims());
    expect(db.user.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "pre" } }));
    expect(u).toMatchObject({ duesUserId: "d1", financeRole: "FINANCIAL_SECRETARY" });
  });

  it("refuses an email already linked to a different dues account", async () => {
    db.user.findUnique.mockResolvedValueOnce(null);
    db.user.findUnique.mockResolvedValueOnce({ id: "x", email: "ama@example.com", duesUserId: "other" } as any);
    await expect(provisionUser(claims())).rejects.toThrow(/different dues account/);
  });
});
