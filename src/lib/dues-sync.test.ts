import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    duesPayment: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    duesPaymentChange: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/db";
import { upsertDuesPayment, WrongDepartmentError } from "./dues-sync";

const db = vi.mocked(prisma, true);

const payment = (over: object = {}) => ({
  id: "p1",
  amount: "50.00",
  currency: "GHS",
  paymentType: "FRESHER",
  status: "SUCCESS",
  paidAt: "2026-10-01T10:00:00.000Z",
  updatedAt: "2026-10-01T10:00:00.000Z",
  departmentCode: "gesa",
  academicSession: { id: "s1", name: "2026/2027" },
  ...over,
});
const stored = (over: object = {}) => ({
  id: "p1", amount: 5000, status: "SUCCESS", paidAt: new Date("2026-10-01T10:00:00.000Z"), duesUpdatedAt: new Date("2026-10-01T10:00:00.000Z"), ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  process.env.DEPARTMENT_CODE = "GESA";
  db.duesPayment.update.mockReturnValue("update-op" as any);
  db.duesPaymentChange.create.mockReturnValue("change-op" as any);
  db.$transaction.mockResolvedValue([] as any);
});

describe("upsertDuesPayment", () => {
  it("creates a new payment with the amount in pesewas", async () => {
    db.duesPayment.findUnique.mockResolvedValue(null);
    expect(await upsertDuesPayment(payment())).toBe("created");
    expect(db.duesPayment.create).toHaveBeenCalledWith({ data: expect.objectContaining({ id: "p1", amount: 5000, status: "SUCCESS" }) });
  });

  it("is idempotent: the same event again changes nothing", async () => {
    db.duesPayment.findUnique.mockResolvedValue(stored() as any);
    expect(await upsertDuesPayment(payment())).toBe("unchanged");
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("ignores an older event that arrives late", async () => {
    db.duesPayment.findUnique.mockResolvedValue(stored({ duesUpdatedAt: new Date("2026-10-05T00:00:00.000Z") }) as any);
    expect(await upsertDuesPayment(payment())).toBe("stale");
    expect(db.duesPayment.update).not.toHaveBeenCalled();
  });

  it("records a correction (SUCCESS -> REFUNDED) with a visible change row", async () => {
    db.duesPayment.findUnique.mockResolvedValue(stored() as any);
    expect(await upsertDuesPayment(payment({ status: "REFUNDED", updatedAt: "2026-10-03T09:00:00.000Z" }))).toBe("updated");
    expect(db.duesPaymentChange.create).toHaveBeenCalledWith({
      data: { paymentId: "p1", fromStatus: "SUCCESS", toStatus: "REFUNDED", fromAmount: 5000, toAmount: 5000 },
    });
    expect(db.$transaction).toHaveBeenCalledWith(["update-op", "change-op"]);
  });

  it("falls back to updating when a push and a sync race to create the same row", async () => {
    db.duesPayment.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(stored() as any);
    db.duesPayment.create.mockRejectedValueOnce({ code: "P2002" });
    expect(await upsertDuesPayment(payment())).toBe("unchanged");
  });

  it("rejects another department's payment and malformed data", async () => {
    await expect(upsertDuesPayment(payment({ departmentCode: "MINING" }))).rejects.toBeInstanceOf(WrongDepartmentError);
    await expect(upsertDuesPayment(payment({ amount: "5e3" }))).rejects.toThrow();
    await expect(upsertDuesPayment(payment({ status: "PENDING" }))).rejects.toThrow();
    expect(db.duesPayment.create).not.toHaveBeenCalled();
  });
});
