import {test, expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

test.beforeEach(async ({page}) => {
  const png = await readFile('tests/browser/tile.png');
  await page.route('**/api/travel/map-tile/**', route => route.fulfill({contentType: 'image/png', body: png}));
});

test('changing destination rejects an obsolete route response', async ({page}) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => {release = resolve;});
  await page.route('**/test-delayed-route', async route => {
    await gate;
    await route.fulfill({body: 'Old destination route'}).catch(() => undefined);
  });
  await page.goto('/map-test-internal');
  const requested = page.waitForRequest('**/test-delayed-route');
  await page.getByRole('button', {name: 'Start delayed route', exact: true}).click();
  await requested;
  await page.getByRole('button', {name: 'Change destination', exact: true}).click();
  release();
  await expect(page.getByTestId('selection')).toHaveText('class');
  await expect(page.getByTestId('request-result')).toHaveText('Pending');
  await expect(page.getByTestId('request-result')).not.toHaveText('Old destination route');
});

test('permitted device location is delivered to the shared travel flow', async ({page, context}) => {
  await context.setGeolocation({latitude: 34.598, longitude: -83.763});
  await context.grantPermissions(['geolocation']);
  await page.goto('/map-test-internal');
  await expect(page.getByTestId('position')).toHaveText('34.598,-83.763', {timeout: 20000});
  await expect(page.getByText('Live device location enabled')).toBeVisible();
  await expect(page.locator('.maplibregl-user-location-dot')).toBeVisible();
});
