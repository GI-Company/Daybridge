import 'server-only';
import {NextResponse} from 'next/server';
import {z} from 'zod';
import {authenticated, jsonError} from './auth';
import {takeTravelApiSlot} from './rate-limit';
import {tomTomKey} from './tomtom';
import {orbisRasterTileUrl, type OrbisRasterLayer} from './map-layers';

const coordinates = z.object({
  z: z.coerce.number().int().min(0).max(18),
  x: z.coerce.number().int().min(0), y: z.coerce.number().int().min(0)
});

/** One authenticated proxy for street and traffic imagery. Keys stay server-side. */
export async function serveMapTile(request: Request, layer: OrbisRasterLayer, params: unknown) {
  try {
    const parsed = coordinates.safeParse(params);
    if (!parsed.success) return jsonError('Invalid map tile coordinates', 400);
    const {z, x, y} = parsed.data;
    if (x >= 2 ** z || y >= 2 ** z) return jsonError('Map tile out of range', 400);
    const auth = await authenticated();
    if (!auth) return jsonError('Unauthorized', 401);
    if (!await takeTravelApiSlot(auth.userId, `map-${layer}`)) return jsonError('Map request limit reached', 429);
    const url = orbisRasterTileUrl(layer, z, x, y);
    const key = layer === 'streets' ? process.env.MAPS_DISPLAY?.trim() || tomTomKey() : tomTomKey();
    const upstream = await fetch(url, {
      headers: {'TomTom-Api-Key': key, 'TomTom-Api-Version': '2', Accept: 'image/png'},
      cache: 'no-store', signal: AbortSignal.any([request.signal, AbortSignal.timeout(8000)])
    });
    if (!upstream.ok) {
      // Never log the upstream URL or error body: they may contain credentials.
      console.warn('TomTom tile rejected', {layer, status: upstream.status});
      return jsonError(upstream.status === 429 ? 'Map imagery rate-limited' : 'Map imagery unavailable', upstream.status === 429 ? 429 : 502);
    }
    if (!upstream.headers.get('content-type')?.startsWith('image/png')) return jsonError('Unexpected map tile format', 502);
    const bytes = await upstream.arrayBuffer();
    const signature = new Uint8Array(bytes, 0, Math.min(8, bytes.byteLength));
    if (bytes.byteLength > 1024 * 1024 || [137,80,78,71,13,10,26,10].some((value, i) => signature[i] !== value)) {
      return jsonError('Invalid map tile response', 502);
    }
    return new NextResponse(bytes, {headers: {
      'Content-Type': 'image/png', 'Cache-Control': `private, max-age=${layer === 'streets' ? 300 : 45}`,
      'X-Content-Type-Options': 'nosniff', Vary: 'Cookie'
    }});
  } catch {
    return jsonError('Map tile service unavailable', 503);
  }
}
