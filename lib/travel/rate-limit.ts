import 'server-only';
import {adminClient} from './monitor';

const limits = {
  'map-streets': 600, 'map-flow': 600, 'map-incidents': 600,
  places: 12, geocode: 20, route: 30, 'push-test': 5, device: 12
} as const;
export type TravelRequestScope = keyof typeof limits;

export async function takeTravelApiSlot(userId: string, scope: TravelRequestScope) {
  const bucket = new Date(Math.floor(Date.now() / 60000) * 60000).toISOString();
  const {data, error} = await adminClient().rpc('take_scoped_travel_api_slot', {
    p_user_id: userId, p_bucket: bucket, p_scope: scope, p_limit: limits[scope]
  });
  if (error) throw new Error('Travel request limiter unavailable');
  return data === true;
}
