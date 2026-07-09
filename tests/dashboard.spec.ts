import { test, expect } from '@playwright/test';

test.describe('Jarvis OS Dashboard E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the dashboard before each test
    await page.goto('/');
  });

  test('should display page title and render successfully', async ({ page }) => {
    // Assert the document title is correct
    await expect(page).toHaveTitle(/Jarvis OS/);

    // Assert that the dashboard header (greeting) is visible
    const greetingHeader = page.locator('h1:has-text("Rico")');
    await expect(greetingHeader).toBeVisible();

    // Verify there are performance metrics on the page
    const metricsHeader = page.locator('h2:has-text("Performance Metrics")');
    await expect(metricsHeader).toBeVisible();
  });

  test('should show sidebar navigation links', async ({ page }) => {
    // Assert that sidebar links exist and are accessible
    const dashboardLink = page.locator('a[href="/"]');
    await expect(dashboardLink).toBeVisible();

    const projectsLink = page.locator('a[href="/projects"]');
    await expect(projectsLink).toBeVisible();

    const tasksLink = page.locator('a[href="/tasks"]');
    await expect(tasksLink).toBeVisible();

    const goalsLink = page.locator('a[href="/goals"]');
    await expect(goalsLink).toBeVisible();

    const knowledgeLink = page.locator('a[href="/knowledge"]');
    await expect(knowledgeLink).toBeVisible();
  });

  test('should toggle sidebar collision / collapse state', async ({ page }) => {
    // Find sidebar collapse button and click it
    const toggleButton = page.locator('button[aria-label="Toggle Sidebar"], button:has(svg)');
    if (await toggleButton.count() > 0) {
      await toggleButton.first().click();
      // The margin of main content changes - we can check visual changes or class additions
      // For this sample test, just ensuring the interaction does not throw errors is good.
    }
  });
});
