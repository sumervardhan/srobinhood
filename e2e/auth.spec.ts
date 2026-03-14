import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("login page renders correctly", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "sRobinhood" })).toBeVisible();
    await expect(page.getByRole("button", { name: /continue with google/i })).toBeVisible();
  });

  test("dev login flow works", async ({ page }) => {
    await page.goto("/login");

    // Dev login button is only visible when ALLOW_DEV_LOGIN=true
    const devLoginButton = page.getByRole("button", { name: /dev login/i });
    await expect(devLoginButton).toBeVisible({ timeout: 5000 });
    await devLoginButton.click();

    // After login, should redirect to home page
    await expect(page).toHaveURL("/", { timeout: 10000 });
  });

  test("redirects unauthenticated users to login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
});
