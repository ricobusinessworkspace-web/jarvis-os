import { test, expect } from '@playwright/test';

/**
 * Rauchtest für die Heute-Ansicht. Prüft, dass die Seite rendert, die Karten
 * da sind und nichts hängen bleibt — nicht einzelne Zahlen, die sich täglich
 * ändern.
 */
test.describe('Heute-Ansicht', () => {
  test('rendert alle Karten', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/Jarvis OS/);

    // Datum als Überschrift, z.B. „Mittwoch, 9. September"
    await expect(page.locator('h1')).toContainText(/\w+tag, \d+\. \w+/);

    for (const titel of ['Calls', 'Körper', 'Ursachen', 'Aufgaben', 'Aktivität']) {
      await expect(page.getByRole('heading', { name: titel, exact: true })).toBeVisible();
    }
  });

  test('zeigt die Blockposition', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/Block \d+ · Woche \d+ von 12/)).toBeVisible();
  });

  test('Reiter sind erreichbar', async ({ page }) => {
    for (const [pfad, titel] of [
      ['/verlauf', 'Verlauf'],
      ['/vertrieb', 'Vertrieb'],
      ['/health', 'Health'],
    ] as const) {
      await page.goto(pfad);
      await expect(page.getByRole('heading', { name: titel, level: 1 })).toBeVisible();
    }
  });

  test('Routine lässt sich bearbeiten', async ({ page }) => {
    await page.goto('/');
    const routine = page.locator('.crm-card').filter({ hasText: 'Routine' }).first();
    await routine.getByRole('button', { name: 'Bearbeiten' }).click();
    // Im Bearbeiten-Modus gibt es ein Feld zum Anlegen neuer Schritte.
    await expect(routine.getByPlaceholder('Schritt hinzufügen')).toBeVisible();
  });
});
