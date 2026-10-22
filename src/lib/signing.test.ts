import { describe, it, expect } from "vitest";
import { createSsoToken, signPush, verifyPush, verifySsoToken, type SsoClaims } from "./signing";

// Vectors produced by the DUES PORTAL's own signing code (src/lib/finance/signing.ts),
// so these tests fail if the two apps ever drift apart.
const TOKEN = "shared-token";
const NOW = 1_800_000_000;
const BODY = '{"event":"payment.updated","payment":{"id":"p1"}}';
const DUES_PUSH_SIG = "e421006452e73600a17f4047bbb086b31dd0148af1889830b3c3963e326bf677";
const DUES_SSO =
  "eyJzdWIiOiJ1MSIsIm5hbWUiOiJBbWEgTWVuc2FoIiwiZW1haWwiOiJhbWFAZXhhbXBsZS5jb20iLCJyb2xlIjoiREVQQVJUTUVOVF9BRE1JTiIsImRlcGFydG1lbnRDb2RlIjoiR0VTQSIsImlzcyI6ImR1ZXMiLCJhdWQiOiJmaW5hbmNlIiwiaWF0IjoxODAwMDAwMDAwLCJleHAiOjE4MDAwMDAwNjAsImp0aSI6IjM4MzYzYTczLWNlZGYtNDQ1ZC1iN2MzLTJlZTVkNWFiNjdkNyJ9.hfR8N1QF3sXxxgTip3c8E-fXuiwsk5huDF-U6vstlT0";

describe("compatibility with the dues portal", () => {
  it("produces the same push signature", () => {
    expect(signPush(BODY, NOW, TOKEN)).toBe(DUES_PUSH_SIG);
    expect(verifyPush(BODY, NOW, DUES_PUSH_SIG, TOKEN, NOW + 5)).toBe(true);
  });
  it("accepts a sign-in token minted by the dues portal", () => {
    expect(verifySsoToken(DUES_SSO, TOKEN, NOW + 5)).toMatchObject({ sub: "u1", email: "ama@example.com", role: "DEPARTMENT_ADMIN", departmentCode: "GESA" });
  });
});

describe("rejections", () => {
  it("refuses stale pushes, tampered bodies and wrong secrets", () => {
    expect(verifyPush(BODY, NOW, DUES_PUSH_SIG, TOKEN, NOW + 301)).toBe(false);
    expect(verifyPush(BODY + "x", NOW, DUES_PUSH_SIG, TOKEN, NOW)).toBe(false);
    expect(verifyPush(BODY, NOW, DUES_PUSH_SIG, "other", NOW)).toBe(false);
    expect(verifyPush(BODY, NOW, "", TOKEN, NOW)).toBe(false);
  });
  it("refuses expired, forged and wrong-secret sign-in tokens", () => {
    expect(verifySsoToken(DUES_SSO, TOKEN, NOW + 61)).toBeNull();
    expect(verifySsoToken(DUES_SSO, "other", NOW)).toBeNull();
    const [payload, sig] = DUES_SSO.split(".");
    const claims = { ...JSON.parse(Buffer.from(payload, "base64url").toString()), role: "SUPER_ADMIN" };
    expect(verifySsoToken(`${Buffer.from(JSON.stringify(claims)).toString("base64url")}.${sig}`, TOKEN, NOW)).toBeNull();
  });
  it("refuses a token with the wrong audience even if correctly signed", () => {
    const bad = createSsoToken({ iss: "dues", aud: "other", sub: "u", name: "n", email: "e@x.com", role: "SUPER_ADMIN", departmentCode: "GESA", iat: NOW, exp: NOW + 60, jti: "j" } as unknown as SsoClaims, TOKEN);
    expect(verifySsoToken(bad, TOKEN, NOW)).toBeNull();
  });
});
