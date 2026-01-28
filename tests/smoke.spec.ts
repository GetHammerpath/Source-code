import { test, expect } from "@playwright/test";

const ROUTES = [
  "/",
  "/auth",
  "/dashboard",
  "/new-request",
  "/templates",
  "/video-generator",
  "/sora-storyboard-generator",
  "/sora2-latest",
  "/runway-extend",
  "/bulk-video",
  "/smart-bulk",
  "/long-form",
  "/assets",
  "/pricing",
  "/checkout",
  "/checkout/success",
  "/checkout/cancel",
  "/account/billing",
  "/admin",
  "/admin/users",
  "/admin/credits",
  "/admin/providers",
  "/admin/billing",
  "/admin/renders",
  "/admin/audit",
];

test("smoke: load key routes without page crashes", async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });
  page.on("pageerror", (err) => {
    pageErrors.push(err.message);
  });

  for (const route of ROUTES) {
    const resp = await page.goto(route, { waitUntil: "domcontentloaded" });
    expect(resp?.status(), `Expected 2xx/3xx for ${route}`).toBeLessThan(400);
    await page.waitForTimeout(300);
  }

  // Best-effort: click obvious navigation links if present (non-destructive).
  // These may not exist if the app redirects to auth.
  const navLinkNames = [
    "Dashboard",
    "Long-Form Generator",
    "AI Video (Veo)",
    "Bulk Video",
    "Smart Bulk",
    "Asset Library",
    "Billing & Credits",
    "View as Admin",
  ];

  for (const name of navLinkNames) {
    const link = page.getByRole("link", { name: new RegExp(name, "i") });
    if (await link.count()) {
      await link.first().click({ trial: true }).catch(() => {});
      await link.first().click().catch(() => {});
      await page.waitForTimeout(200);
    }
  }

  // Fail on hard JS crashes; log console errors to help debugging.
  if (pageErrors.length) {
    throw new Error(`Page errors:\n${pageErrors.join("\n")}`);
  }

  // Don't hard-fail on all console errors (some pages may intentionally log),
  // but DO fail if we see the classic React crash signature.
  const crashy = consoleErrors.filter((e) =>
    /Uncaught|TypeError|ReferenceError|Cannot read properties of undefined|React has detected/i.test(e)
  );
  expect(crashy, `Console errors:\n${consoleErrors.join("\n")}`).toEqual([]);
});

