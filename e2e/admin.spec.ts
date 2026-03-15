import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  const devLoginButton = page.getByRole("button", { name: /dev login/i });
  await expect(devLoginButton).toBeVisible({ timeout: 5000 });
  await devLoginButton.click();
  await expect(page).toHaveURL("/", { timeout: 10000 });
});

test.describe("Admin tab", () => {
  test("Admin tab is visible and accessible", async ({ page }) => {
    await expect(page.getByRole("tab", { name: "Admin" })).toBeVisible();
  });

  test("Admin tab content renders the Simulate Live Data toggle", async ({ page }) => {
    await page.getByRole("tab", { name: "Admin" }).click();
    const toggle = page.getByRole("switch", { name: /simulate live data/i });
    await expect(toggle).toBeVisible({ timeout: 5000 });
    // Toggle is off by default
    await expect(toggle).toHaveAttribute("aria-checked", "false");
  });

  test("Simulate Live Data toggle can be clicked and updates status", async ({ page }) => {
    // Mock the admin API so the test doesn't depend on Alpaca credentials
    await page.route("/api/admin/simulate", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ enabled: false, tradingDate: null, symbolCount: 0 }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ enabled: true, tradingDate: "2025-01-10", symbolCount: 10 }),
        });
      }
    });

    await page.reload();
    await page.getByRole("tab", { name: "Admin" }).click();

    const toggle = page.getByRole("switch", { name: /simulate live data/i });
    await expect(toggle).toBeVisible({ timeout: 5000 });
    await expect(toggle).toHaveAttribute("aria-checked", "false");

    await toggle.click();

    await expect(toggle).toHaveAttribute("aria-checked", "true", { timeout: 5000 });
    await expect(page.getByText(/replaying 2025-01-10/i)).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Error badge", () => {
  test("shows red error badge when SSE stream sends source:error", async ({ page }) => {
    // Intercept the SSE stream and immediately return an error payload
    await page.route("/api/stocks/quotes/stream", async (route) => {
      const errorPayload = JSON.stringify({ quotes: [], realtime: false, source: "error" });
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        headers: {
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
        body: `data: ${errorPayload}\n\n`,
      });
    });

    await page.reload();
    await expect(page.getByText(/error refreshing price data/i)).toBeVisible({ timeout: 10000 });
  });
});
