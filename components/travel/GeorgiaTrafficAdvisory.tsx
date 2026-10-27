import type {GeorgiaIncident} from '../../lib/travel/georgia511-matching';

export function GeorgiaTrafficAdvisory({incidents}:{incidents?:GeorgiaIncident[]}){
 if(!incidents?.length)return null;
 return <section className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-slate-900" aria-label="Georgia 511 traffic reports">
  <h4 className="font-bold text-amber-950">Georgia 511 reports near this route</h4>
  <p className="mt-1 text-xs text-slate-700">These incidents are geographically near your planned route. The road, direction, and actual impact may differ. TomTom supplies the ETA and navigation.</p>
  <ul className="mt-2 space-y-2">
   {incidents.map(incident=><li key={incident.id} className="rounded-lg border border-amber-200 bg-white p-2">
    <p className="font-semibold">{incident.fullClosure?'Reported full closure':'Reported traffic event'}{incident.roadway?' · '+incident.roadway:''}{incident.direction?' · '+incident.direction:''}</p>
    <p className="mt-1 text-xs text-slate-700">{incident.description}</p>
   </li>)}
  </ul>
  <a className="mt-2 inline-block text-xs font-semibold text-amber-950 underline" href="https://511ga.org/" target="_blank" rel="noopener noreferrer">Review Georgia 511 updates</a>
 </section>;
}
