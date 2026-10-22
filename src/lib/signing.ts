import crypto from "crypto";

/**
 * Verifies what the dues portal signs. Mirrors src/lib/finance/signing.ts in
 * the dues portal; both use HMAC-SHA256 with the shared DUES_PUSH_TOKEN but
 * sign differently-prefixed messages ("push." / "sso.") so one can never be
 * replayed as the other.
 */
export function timingSafeEqualStrings(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function signPush(body: string, timestampSeconds: number, token: string): string {
  return crypto.createHmac("sha256", token).update(`push.${timestampSeconds}.${body}`).digest("hex");
}

export function verifyPush(
  body: string,
  timestampSeconds: number,
  signature: string,
  token: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  toleranceSeconds = 300
): boolean {
  if (!Number.isFinite(timestampSeconds) || !signature) return false;
  if (Math.abs(nowSeconds - timestampSeconds) > toleranceSeconds) return false;
  return timingSafeEqualStrings(signPush(body, timestampSeconds, token), signature);
}

export type SsoClaims = {
  iss: "dues";
  aud: "finance";
  sub: string;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "DEPARTMENT_ADMIN";
  departmentCode: string;
  iat: number;
  exp: number;
  jti: string;
};

function ssoSignature(payloadB64: string, token: string): string {
  return crypto.createHmac("sha256", token).update(`sso.${payloadB64}`).digest("base64url");
}

/** Used by tests to mint tokens; production tokens are minted by the dues portal. */
export function createSsoToken(claims: SsoClaims, token: string): string {
  const payloadB64 = Buffer.from(JSON.stringify(claims), "utf8").toString("base64url");
  return `${payloadB64}.${ssoSignature(payloadB64, token)}`;
}

export function verifySsoToken(value: string, token: string, nowSeconds = Math.floor(Date.now() / 1000)): SsoClaims | null {
  const parts = value.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  if (!timingSafeEqualStrings(ssoSignature(payloadB64, token), sig)) return null;
  try {
    const c = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as SsoClaims;
    if (c.iss !== "dues" || c.aud !== "finance") return null;
    if (typeof c.exp !== "number" || c.exp < nowSeconds) return null;
    if (!c.sub || !c.email || !c.jti) return null;
    if (c.role !== "SUPER_ADMIN" && c.role !== "DEPARTMENT_ADMIN") return null;
    return c;
  } catch {
    return null;
  }
}
