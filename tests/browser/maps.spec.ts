import {test, expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

test.beforeEach(async ({page}) => {
  const png = await readFile('tests/browser/tile.png');
  await page.route('**/api/travel/map-tile/**', route => route.fulfill({contentType: 'image/png', body: png}));
  await page.route('**/api/travel/map-overlay/**', route => route.fulfill({contentType: 'image/png', body: png}));
});

test('starts the real worker, renders selectable markers, and supports zoom and pan', async ({page}) => {
  const failures: string[] = [];
  page.on('pageerror', error => failures.push(error.message));
  const worker = page.waitForEvent('worker');
  await page.goto('/map-test-internal');
  expect((await worker).url()).toMatch(/\/maps\/maplibre\/6\.15\.0\/maplibre-gl-worker\.mjs$/);
  await expect(page.getByText('Loading interactive map…')).toBeHidden({timeout: 20000});
  await expect(page.locator('section [role="alert"]')).toBeHidden();
  const canvas = page.locator('canvas.maplibregl-canvas');
  await canvas.click();
  await expect(page.getByTestId('selection')).toHaveText('clinic');
  await expect(page.locator('.maplibregl-popup')).toContainText('Test clinic');
  await page.getByRole('button', {name: 'Zoom in', exact: true}).click();
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.move(bounds!.x + 120, bounds!.y + 120);
  await page.mouse.down(); await page.mouse.move(bounds!.x + 220, bounds!.y + 150, {steps: 12}); await page.mouse.up();
  await expect(page.locator('section [role="alert"]')).toBeHidden();
  expect(failures).toEqual([]);
});

test('updates routes and destinations without destroying the map', async ({page}, testInfo) => {
  await page.goto('/map-test-internal');
  await expect(page.getByText('Loading interactive map…')).toBeHidden({timeout: 20000});
  const canvas = page.locator('canvas.maplibregl-canvas');
  await canvas.evaluate(node => node.setAttribute('data-persistent-map', 'yes'));
  await page.getByRole('button', {name: 'Show route', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Fit route', exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'Alternative route', exact: true}).click();
  await expect(canvas).toHaveAttribute('data-persistent-map', 'yes');
  await page.getByRole('button', {name: 'Fit route', exact: true}).click();
  await page.screenshot({path: testInfo.outputPath('interactive-route.png')});
  await page.getByRole('button', {name: 'Change destination', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Fit route', exact: true})).toBeHidden();
  await expect(page.locator('.maplibregl-popup')).toContainText('Test class');
  await expect(canvas).toHaveAttribute('data-persistent-map', 'yes');
});

test('traffic failure keeps the street map interactive and can be retried', async ({page}) => {
  let broken = true;
  let requests = 0;
  const png = await readFile('tests/browser/tile.png');
  await page.route('**/api/travel/map-overlay/flow/**', route => {
    requests++;
    return broken ? route.fulfill({status: 503, json: {error: 'Test outage'}}) :
      route.fulfill({contentType: 'image/png', body: png});
  });
  await page.goto('/map-test-internal');
  await expect(page.getByText('Loading interactive map…')).toBeHidden({timeout: 20000});
  await page.getByRole('button', {name: 'Traffic flow', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Retry traffic', exact: true})).toBeVisible();
  await expect(page.locator('section [role="alert"]')).toBeHidden();
  const before = requests;
  broken = false;
  await page.getByRole('button', {name: 'Retry traffic', exact: true}).click();
  await expect.poll(() => requests).toBeGreaterThan(before);
  await page.getByRole('button', {name: 'Zoom in', exact: true}).click();
  await expect(page.locator('section [role="alert"]')).toBeHidden();
});

test('a tile outage retries the interactive renderer without a static image', async ({page}) => {
  let broken = true;
  let recovering = false;
  let release!: () => void;
  const recovery = new Promise<void>(resolve => {release = resolve;});
  const png = await readFile('tests/browser/tile.png');
  const staticRequests: string[] = [];
  page.on('request', request => {if (request.url().includes('static-map')) staticRequests.push(request.url());});
  await page.route('**/api/travel/map-tile/**', async route => {
    if (recovering) await recovery;
    return broken ? route.fulfill({status: 503, json: {error: 'Test outage'}}) :
      route.fulfill({contentType: 'image/png', body: png});
  });
  await page.goto('/map-test-internal');
  await expect(page.getByRole('button', {name: 'Retry interactive map', exact: true})).toBeVisible();
  const canvas=page.locator('canvas.maplibregl-canvas');
  await canvas.evaluate(node=>node.setAttribute('data-retry-canvas','kept'));
  recovering = true;
  await page.getByRole('button', {name: 'Retry interactive map', exact: true}).click();
  broken = false;
  release();
  await expect(page.getByText('Loading interactive map…')).toBeHidden({timeout: 20000});
  await expect(page.locator('section [role="alert"]')).toBeHidden();
  await page.getByRole('button', {name: 'Zoom in', exact: true}).click();
  await expect(canvas).toHaveAttribute('data-retry-canvas','kept');
  expect(staticRequests).toEqual([]);
});

test('appointment route uses the same functioning interactive engine', async ({page}) => {
  await page.goto('/map-test-internal');
  await page.getByRole('button', {name: 'Toggle appointment map', exact: true}).click();
  await expect(page.getByRole('region', {name: 'TomTom route map', exact: true})).toBeVisible();
  await expect(page.getByText('Loading interactive map…')).toBeHidden({timeout: 20000});
  await expect(page.locator('section [role="alert"]')).toBeHidden();
  await page.getByRole('button', {name: 'Fit route', exact: true}).click();
  await page.getByRole('button', {name: 'Zoom in', exact: true}).click();
});

test('street loading returns after zoom and recovering imagery keeps the same interactive canvas',async({page})=>{
 const png=await readFile('tests/browser/tile.png');let paused=false,release!:()=>void;
 const blocked=new Promise<void>(resolve=>{release=resolve;});
 await page.route('**/api/travel/map-tile/**',async route=>{if(paused)await blocked;await route.fulfill({contentType:'image/png',body:png}).catch(()=>undefined);});
 await page.goto('/map-test-internal');await expect(page.getByText('Loading interactive map…')).toBeHidden();
 const canvas=page.locator('canvas.maplibregl-canvas');await canvas.evaluate(node=>node.setAttribute('data-kept','yes'));
 paused=true;
 await page.getByRole('button',{name:'Zoom in',exact:true}).click();
 await expect(page.getByText('Loading interactive map…')).toBeVisible();
 await expect(page.getByRole('region',{name:'Interactive TomTom street map'})).toHaveAttribute('aria-busy','true');
 paused=false;release();
 await expect(page.getByText('Loading interactive map…')).toBeHidden();
 await expect(canvas).toHaveAttribute('data-kept','yes');
});
test('updating just the starting-point marker does not undo user panning or refit the route',async({page})=>{
 await page.goto('/map-test-internal');await page.getByRole('button',{name:'Show route',exact:true}).click();
 await expect(page.getByText('Loading interactive map…')).toBeHidden();
 const canvas=page.locator('canvas.maplibregl-canvas'),box=(await canvas.boundingBox())!;
 await page.mouse.move(box.x+100,box.y+100);await page.mouse.down();await page.mouse.move(box.x+200,box.y+180,{steps:12});await page.mouse.up();
 // Let drag inertia finish before testing that an unrelated marker update preserves the viewport.
 await page.waitForTimeout(700);
 await expect(page.getByTestId('map-view-center')).not.toBeEmpty();
 const center=await page.getByTestId('map-view-center').innerText();
 await page.getByRole('button',{name:'Update origin only',exact:true}).click();
 await page.waitForTimeout(500);
 await expect(page.getByTestId('map-view-center')).toHaveText(center);
});
