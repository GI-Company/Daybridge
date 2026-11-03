import {NextResponse} from 'next/server';
import {serviceClient} from '../../../../lib/admin/courts';
export const runtime='nodejs';
export const dynamic='force-dynamic';

type State={code:string;name:string};
type Circuit={id:string;state_code:string;name:string};
type Court={id:string;circuit_id:string;court_name:string};

// Only the explicitly published names appear here. No admin identities,
// participant metadata, license totals, passwords or private records are exposed.
export async function GET(){
  const headers={'Cache-Control':'no-store'};
  try{
    const service=serviceClient();
    const [stateQuery,circuitQuery,courtQuery]=await Promise.all([
      service.from('daybridge_states').select('code,name'),
      service.from('daybridge_judicial_circuits').select('id,state_code,name'),
      service.from('daybridge_courts')
        .select('id,circuit_id,court_name').eq('enabled',true).eq('listed',true),
    ]);
    if(stateQuery.error||circuitQuery.error||courtQuery.error)
      return NextResponse.json({error:'Court directory not ready',courts:[]},{status:503,headers});

    const states=new Map(((stateQuery.data||[]) as State[]).map(s=>[s.code,s.name]));
    const circuits=new Map(((circuitQuery.data||[]) as Circuit[]).map(c=>[c.id,c]));
    const courts=((courtQuery.data||[]) as Court[]).flatMap(c=>{
      const circuit=circuits.get(c.circuit_id);
      if(!circuit)return [];
      const stateName=states.get(circuit.state_code);
      if(!stateName)return [];
      return [{
        id:c.id,
        state_code:circuit.state_code,
        state_name:stateName,
        circuit_id:circuit.id,
        circuit_name:circuit.name,
        court_name:c.court_name,
      }];
    }).sort((a,b)=>a.state_name.localeCompare(b.state_name)||
      a.circuit_name.localeCompare(b.circuit_name)||
      a.court_name.localeCompare(b.court_name));

    return NextResponse.json({courts},{headers});
  }catch{
    return NextResponse.json({error:'Court directory unavailable',courts:[]},{status:503,headers});
  }
}
