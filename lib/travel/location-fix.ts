import type {Point} from './types';
import {validMapPoint} from './geometry.ts';
export const LOCATION_MAX_AGE=120000;
export const LOCATION_MAX_ACCURACY=200;
export type LocationFix={point:Point;recordedAt:number;accuracy:number};
export function freshLocation(fix:LocationFix|null|undefined,now=Date.now()):LocationFix|null{
 if(!fix||!fix.point||!validMapPoint(fix.point)||!Number.isFinite(fix.recordedAt)||!Number.isFinite(fix.accuracy)||fix.accuracy<0||fix.accuracy>LOCATION_MAX_ACCURACY||now-fix.recordedAt>=LOCATION_MAX_AGE||fix.recordedAt>now+10000)return null;
 return fix;
}
