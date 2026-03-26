import { test, expect } from "@playwright/test";

test.describe("Landing page smoke", () => {
  test("loads homepage and renders core UI", async ({ page }) => {
    const response = await page.goto("/", { waitUntil: "domcontentloaded" });

    expect(response).not.toBeNull();
    expect(response?.ok()).toBeTruthy();

    await expect(page).toHaveTitle(/BendScript/i);
    await expect(page.locator("#graph")).toBeVisible();
    await expect(page.locator("#statNodes")).toBeVisible();
    await expect(page.getByText("BENDSCRIPT").first()).toBeVisible();
  });
});
