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

  test("unauthenticated home page shows login prompt", async ({ page }) => {
    await page.goto("/");
    // No middleware redirect — the page renders with a "Log in with Google" CTA
    await expect(page.getByRole("link", { name: /log in with google/i })).toBeVisible();
  });
});
