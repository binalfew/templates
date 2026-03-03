import { test, expect } from "@playwright/test";

test("health check returns 200", async ({ request }) => {
  const response = await request.get("/up");
  expect(response.status()).toBe(200);
  expect(await response.text()).toBe("OK");
});

test("home page redirects to login", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Welcome back")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
});
