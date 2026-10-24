import {test, expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

test.beforeEach(async ({page,context}) => {
  await context.setGeolocation({latitude:34.59,longitude:-83.72});
  await context.grantPermissions(['geolocation']);
  const tile = await readFile('tests/browser/tile.png');
  await page.route('**/api/travel/map-tile/**', route => route.fulfill({contentType: 'image/png', body: tile}));
  await page.route('**/api/travel/route', async route => {
    const input = route.request().postDataJSON();
    await route.fulfill({json: {basis: 'live', checkedAt: new Date().toISOString(), routes: [
      {durationSeconds: 1200, delaySeconds: 120, distanceMeters: 12000, historicSeconds: null, points: [input.origin, input.destination], instructions: ['Follow the test road.']},
      {durationSeconds: 1500, delaySeconds: 60, distanceMeters: 14000, historicSeconds: null, points: [input.origin, input.destination]}
    ]}});
  });
});

async function openCalendar(page: import('@playwright/test').Page) {
  await page.goto('/map-test-internal');
  await page.getByRole('button', {name: 'Show calendar map', exact: true}).click();
}

test('next calendar trip loads automatically with details immediately below the map', async ({page}, testInfo) => {
  const requested = page.waitForRequest('**/api/travel/route');
  await openCalendar(page);
  const input = (await requested).postDataJSON();
  expect(input.destination).toEqual({lat: 34.6, lon: -83.7});
  expect(input.origin).toEqual({lat: 34.59, lon: -83.72});
  expect(input.arriveAt).toBeTruthy();
  const details = page.getByRole('region', {name: 'Trip details', exact: true});
  await expect(details.getByRole('heading', {name: 'Work appointment', exact: true})).toBeVisible();
  await expect(details.getByRole('button', {name: 'Fastest · 20 min', exact: true})).toBeVisible();
  await expect(details.getByText('Leave by', {exact: true})).toBeVisible();
  expect(await details.evaluate(element => element.previousElementSibling?.getAttribute('aria-label'))).toBe('Explore map');
  await expect(page.getByRole('heading', {name: 'Plan a trip', exact: true})).toHaveCount(0);
  await expect(page.getByRole('button', {name: /Get route|Preview route|Plan trip/})).toHaveCount(0);
  await expect(page.getByText('Loading interactive map…')).toBeHidden({timeout: 20000});
  await details.getByRole('button', {name: 'Alternative 1 · 25 min', exact: true}).click();
  await expect(details.getByRole('button', {name: 'Alternative 1 · 25 min', exact: true})).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({path: testInfo.outputPath('calendar-map-details.png'), fullPage: true});
});

test('rescheduling the calendar automatically updates the next destination and travel mode', async ({page}) => {
  await openCalendar(page);
  await expect(page.getByRole('heading', {name: 'Work appointment', exact: true})).toBeVisible();
  const next = page.waitForRequest(request => request.url().endsWith('/api/travel/route') && request.postDataJSON().destination.lat === 34.61);
  await page.getByRole('button', {name: 'Reschedule work', exact: true}).click();
  const input = (await next).postDataJSON();
  expect(input.travelMode).toBe('bicycle');
  await expect(page.getByRole('region', {name: 'Trip details', exact: true}).getByRole('heading')).toHaveText('Therapy appointment');
});

test('cancelled appointments disappear and empty calendars do not invent trips', async ({page}) => {
  await openCalendar(page);
  await page.getByRole('button', {name: 'Cancel work', exact: true}).click();
  await expect(page.getByRole('region', {name: 'Trip details', exact: true}).getByRole('heading')).toHaveText('Therapy appointment');
  await page.getByRole('button', {name: 'Clear schedule', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'No upcoming in-person trips', exact: true})).toBeVisible();
  await expect(page.getByRole('group', {name: 'Route alternatives', exact: true})).toHaveCount(0);
});

test('unverified calendar addresses ask for correction without routing to another appointment', async ({page}) => {
  await openCalendar(page);
  await page.getByRole('button', {name: 'Unverify work', exact: true}).click();
  const details = page.getByRole('region', {name: 'Trip details', exact: true});
  await expect(details.getByRole('heading')).toHaveText('Work appointment');
  await expect(details.getByText('Verify this appointment’s destination in Schedule to calculate its route automatically.')).toBeVisible();
  await expect(details.getByRole('group', {name: 'Route alternatives', exact: true})).toHaveCount(0);
  await details.getByRole('button', {name: 'Open Schedule', exact: true}).click();
  await expect(page.getByTestId('opened-schedule')).toHaveText(/^\d{4}-\d{2}-\d{2}$/);
});

test('slow route responses cannot overwrite the rescheduled calendar trip', async ({page}) => {
  let release!: () => void;
  const waiting = new Promise<void>(resolve => {release = resolve;});
  await page.route('**/api/travel/route', async route => {
    const input = route.request().postDataJSON();
    if (input.destination.lat === 34.6) await waiting;
    await route.fulfill({json: {basis: 'live', checkedAt: new Date().toISOString(), routes: [
      {durationSeconds: input.destination.lat === 34.6 ? 600 : 1800, delaySeconds: 0, distanceMeters: 10000,
        historicSeconds: null, points: [input.origin, input.destination]}
    ]}}).catch(() => undefined);
  });
  const requested = page.waitForRequest('**/api/travel/route');
  await openCalendar(page); await requested;
  await page.getByRole('button', {name: 'Reschedule work', exact: true}).click();
  const details = page.getByRole('region', {name: 'Trip details', exact: true});
  await expect(details.getByRole('button', {name: 'Fastest · 30 min', exact: true})).toBeVisible();
  release();
  await expect(details.getByRole('heading')).toHaveText('Therapy appointment');
  await expect(details.getByRole('button', {name: 'Fastest · 10 min', exact: true})).toHaveCount(0);
});
