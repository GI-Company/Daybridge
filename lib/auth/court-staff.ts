/**
 * Supabase Auth-style login alias; not a deliverable email address.
 * Authorization always requires a signed session, MFA, and court membership.
 */
export const COURT_STAFF_NAME=/^[a-z][a-z0-9_-]{2,31}$/;
export const COURT_LOGIN_SLUG=/^[a-z][a-z0-9-]{1,62}$/;

export type CourtStaffScope={
  state_code:string;
  circuit_slug:string;
  court_slug:string;
};
export function courtStaffAuthEmail(username:string,stateCode:string,circuitSlug:string,courtSlug:string):string|null{
  const name=username.trim().toLowerCase();
  const state=stateCode.trim().toLowerCase();
  const circuit=circuitSlug.trim().toLowerCase();
  const court=courtSlug.trim().toLowerCase();
  if(!COURT_STAFF_NAME.test(name)||!/^[a-z]{2}$/.test(state)||
    !COURT_LOGIN_SLUG.test(circuit)||!COURT_LOGIN_SLUG.test(court))return null;
  return name+'@'+state+'.'+circuit+'.'+court;
}
export function resolveCourtStaffLogin(input:string,scope:CourtStaffScope):string|null{
  const raw=input.trim().toLowerCase();
  const name=raw.split('@',1)[0];
  const expected=courtStaffAuthEmail(name,scope.state_code,scope.circuit_slug,scope.court_slug);
  if(!expected)return null;
  return raw===name||raw===expected?expected:null;
}
