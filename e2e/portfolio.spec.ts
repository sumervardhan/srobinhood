import { test, expect } from "@playwright/test";

// Log in via dev credentials before each test
test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  const devLoginButton = page.getByRole("button", { name: /dev login/i });
  await expect(devLoginButton).toBeVisible({ timeout: 5000 });
  await devLoginButton.click();
  await expect(page).toHaveURL("/", { timeout: 10000 });
});

test.describe("Portfolio page", () => {
  test("renders the header and tab bar", async ({ page }) => {
    // Nav is a <header> containing the sRobinhood brand link
    await expect(page.getByRole("link", { name: "sRobinhood" }).first()).toBeVisible();
    // Tabs rendered via role="tablist"
    await expect(page.getByRole("tab", { name: "Portfolio" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "All Stocks" })).toBeVisible();
  });

  test("spending power card is visible", async ({ page }) => {
    await expect(page.getByText(/spending power/i)).toBeVisible();
  });

  test("All Stocks tab shows stock rows", async ({ page }) => {
    await page.getByRole("tab", { name: "All Stocks" }).click();
    // Stocks are listed as rows — wait for at least one ticker symbol to appear
    await expect(page.getByText("AAPL")).toBeVisible({ timeout: 10000 });
  });
});
