import {defineConfig, devices} from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser', testMatch: '**/*.spec.ts', fullyParallel: false,
  workers: 1, retries: 0, timeout: 45000,
  use: {baseURL: 'http://127.0.0.1:3100', trace: 'retain-on-failure'},
  projects: [
    {name: 'desktop', use: {...devices['Desktop Chrome'], launchOptions: {args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']}}},
    {name: 'mobile', use: {...devices['Pixel 7'], launchOptions: {args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']}}}
  ],
  webServer: {command: 'next dev -p 3100 -H 127.0.0.1', url: 'http://127.0.0.1:3100/map-test-internal',
    reuseExistingServer: false, timeout: 120000}
});
