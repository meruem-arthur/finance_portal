/** Central place for environment settings so a missing one fails with a clear message. */
function need(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing environment variable ${name}`);
  return v;
}

export const env = {
  get departmentCode() { return need("DEPARTMENT_CODE"); },
  get departmentName() { return process.env.DEPARTMENT_NAME?.trim() || process.env.DEPARTMENT_CODE?.trim() || "Department"; },
  get duesPortalUrl() { return need("DUES_PORTAL_URL").replace(/\/+$/, ""); },
  get duesApiKey() { return need("DUES_API_KEY"); },
  get duesPushToken() { return need("DUES_PUSH_TOKEN"); },
  get cronSecret() { return process.env.CRON_SECRET?.trim() || null; },
};
