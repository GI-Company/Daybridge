import {copyFile, mkdir, readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname, join} from 'node:path';

// MapLibre 6 no longer embeds its worker. Publish the installed worker alongside
// the app, with a versioned URL so an installed PWA cannot reuse an older worker.
const require = createRequire(import.meta.url);
const packagePath = require.resolve('maplibre-gl/package.json');
const {version} = JSON.parse(await readFile(packagePath, 'utf8'));
const target = new URL(`../public/maps/maplibre/${version}/`, import.meta.url);
await mkdir(target, {recursive: true});
for (const name of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) {
  await copyFile(join(dirname(packagePath), 'dist', name), new URL(name, target));
}
