import {serveMapTile} from '../../../../../../../lib/travel/map-tile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: {params: Promise<{z: string; x: string; y: string}>}) {
  return serveMapTile(request, 'streets', await context.params);
}
