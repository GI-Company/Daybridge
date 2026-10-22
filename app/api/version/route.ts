import {NextResponse} from 'next/server';
import {productionVersion} from '../../../lib/release/version';

export const dynamic='force-dynamic';
export const revalidate=0;
export const runtime='nodejs';

export async function GET(){
 return NextResponse.json({version:productionVersion()},{
  headers:{
   'Cache-Control':'private, no-store, no-cache, must-revalidate, max-age=0',
   'Pragma':'no-cache',
   'Expires':'0',
   'X-Robots-Tag':'noindex',
  }
 });
}
