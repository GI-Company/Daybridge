import {jsonError} from '../../../../../../../../lib/travel/auth';
import {serveMapTile} from '../../../../../../../../lib/travel/map-tile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: {params: Promise<{layer: string; z: string; x: string; y: string}>}) {
  const params = await context.params;
  if (params.layer !== 'flow' && params.layer !== 'incidents') return jsonError('Invalid traffic layer', 400);
  return serveMapTile(request, params.layer, params);
}
