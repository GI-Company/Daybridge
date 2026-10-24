import {NextResponse} from 'next/server';
import {productionVersion} from '../../../lib/release/version';
export const dynamic='force-dynamic';
/** Public liveness only. Never expose configuration, credentials, records, or provider diagnostics. */
export function GET(){
 return NextResponse.json({status:'ok',version:productionVersion()},{headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex'}});
}
