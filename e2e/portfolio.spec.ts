import { test, expect } from "@playwright/test";

// Shared setup: log in via dev credentials before each test
test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  const devLoginButton = page.getByRole("button", { name: /dev login/i });
  await expect(devLoginButton).toBeVisible({ timeout: 5000 });
  await devLoginButton.click();
  await expect(page).toHaveURL("/", { timeout: 10000 });
});

test.describe("Portfolio page", () => {
  test("renders the main nav and tabs", async ({ page }) => {
    await expect(page.getByRole("navigation")).toBeVisible();
    // Tabs: Stocks / Portfolio / Orders
    await expect(page.getByRole("tab", { name: /stocks/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /portfolio/i })).toBeVisible();
  });

  test("spending power card is visible", async ({ page }) => {
    await expect(page.getByText(/spending power/i)).toBeVisible();
  });

  test("stock search input is present", async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search stocks/i);
    await expect(searchInput).toBeVisible();
  });

  test("can search for a stock symbol", async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search stocks/i);
    await searchInput.fill("AAPL");
    // Expect AAPL to appear in the results list
    await expect(page.getByText("AAPL")).toBeVisible({ timeout: 5000 });
  });
});
