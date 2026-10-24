import {mkdir, readFile, readdir, writeFile, rm} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import './prepare-maps.mjs';

// The harness is created only for this subprocess and never ships as an app
// route. No authentication checks on real API routes are bypassed.
const target = new URL('../app/map-test-internal/', import.meta.url);
const page = new URL('page.tsx', target);
const source = "export {default} from '../../tests/browser/MapHarness';\n";
const configFiles = ['../tsconfig.json', '../next-env.d.ts'].map(path => new URL(path, import.meta.url));
const originalConfigs = await Promise.all(configFiles.map(path => readFile(path)));
await mkdir(target, {recursive: true});
const entries = await readdir(target);
if (entries.length && (entries.length !== 1 || entries[0] !== 'page.tsx' || await readFile(page, 'utf8') !== source)) {
  throw new Error('Test harness path contains non-test files; refusing to overwrite it.');
}
await writeFile(page, source);
const production=process.argv.includes('--production');
try {
  if(production){
    const build=spawn(process.execPath,['node_modules/next/dist/bin/next','build'],{stdio:'inherit',env:{...process.env,NEXT_DIST_DIR:'.next-map-tests'}});
    const [code]=await once(build,'exit');if(code!==0)throw new Error('Production harness build failed');
  }
  const child = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', ...process.argv.slice(2).filter(arg=>arg!=='--production')], {
    stdio: 'inherit', env: {...process.env, NEXT_DIST_DIR: '.next-map-tests', DAYBRIDGE_TEST_PRODUCTION: production?'true':'false'}
  });
  const interrupt = () => child.kill('SIGINT');
  const terminate = () => child.kill('SIGTERM');
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', terminate);
  const [code] = await once(child, 'exit');
  process.removeListener('SIGINT', interrupt);
  process.removeListener('SIGTERM', terminate);
  process.exitCode = code ?? 1;
} finally {
  await rm(target, {recursive: true, force: true});
  await Promise.all(configFiles.map((path, index) => writeFile(path, originalConfigs[index])));
}
