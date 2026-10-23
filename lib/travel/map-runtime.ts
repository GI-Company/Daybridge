'use client';

let runtime: Promise<typeof import('maplibre-gl')> | undefined;

export function loadMapRuntime() {
  runtime ??= import('maplibre-gl').then(module => {
    module.setWorkerUrl(`/maps/maplibre/${module.getVersion()}/maplibre-gl-worker.mjs`);
    return module;
  }).catch(error => {
    runtime = undefined;
    throw error;
  });
  return runtime;
}
