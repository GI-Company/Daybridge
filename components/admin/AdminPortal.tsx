'use client';
import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {ArrowLeft,KeyRound,LockKeyhole,Plus,ShieldCheck,UserRound,Users,LogOut} from 'lucide-react';
import {createClient} from '../../lib/supabase/client';
import {loginIdentifierToEmail} from '../../lib/auth/username';

type ListedCourt={id:string;state_code:string;state_name:string;circuit_name:string};
type CourtAccount={user_id:string;username:string;status:'active'|'suspended'|'removed';created_at:string};
type PortalData={court:{id:string;name:string;state:string;seat_limit:number};occupied_seats:number;participants:CourtAccount[]};
type ApiError={error?:string};
type TotpEnrollment={id:string;secret:string};

const field='mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100';
const primary='rounded-xl bg-teal-800 px-5 py-3 font-semibold text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-50';
const secondary='rounded-xl border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50';

export function AdminPortal(){
  const client=useMemo(()=>createClient(),[]);
  const [courts,setCourts]=useState<ListedCourt[]>([]);
  const [stateCode,setStateCode]=useState('');
  const [courtId,setCourtId]=useState('');
  const [session,setSession]=useState<'loading'|'signedout'|'signedin'>('loading');
  const [identifier,setIdentifier]=useState('');
  const [password,setPassword]=useState('');
  const [mfa,setMfa]=useState<'checking'|'needed'|'verified'>('checking');
  const [factorId,setFactorId]=useState('');
  const [enrollment,setEnrollment]=useState<TotpEnrollment|null>(null);
  const [code,setCode]=useState('');
  const [username,setUsername]=useState('');
  const [portal,setPortal]=useState<PortalData|null>(null);
  const [credentials,setCredentials]=useState<{username:string;temporaryPassword:string}|null>(null);
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const [directoryMessage,setDirectoryMessage]=useState('');

  const states=Array.from(new Map(courts.map(c=>[c.state_code,c.state_name])).entries())
    .map(([code,name])=>({code,name})).sort((a,b)=>a.name.localeCompare(b.name));
  const circuits=courts.filter(c=>c.state_code===stateCode);

  useEffect(()=>{
    let mounted=true;
    fetch('/api/admin/courts',{cache:'no-store'}).then(async response=>{
      const body=await response.json();
      if(!mounted)return;
      if(!response.ok)throw new Error(body.error||'Court directory unavailable');
      const list=(body.courts||[]) as ListedCourt[];
      setCourts(list);
      if(list.length){
        const requestId=new URLSearchParams(window.location.search).get('court_id');
        const initial=list.find(c=>c.id===requestId)||list[0];
        setStateCode(initial.state_code);setCourtId(initial.id);
      }
      else setDirectoryMessage('No judicial circuits have been activated for the portal.');
    }).catch(error=>{if(mounted)setDirectoryMessage(error instanceof Error?error.message:'Court directory unavailable');});
    if(!client){setSession('signedout');return()=>{mounted=false};}
    void client.auth.getUser().then(({data})=>{
      if(mounted)setSession(data.user?'signedin':'signedout');
    }).catch(()=>{if(mounted)setSession('signedout');});
    const {data:{subscription}}=client.auth.onAuthStateChange((_event,authSession)=>{
      if(mounted)setSession(authSession?.user?'signedin':'signedout');
    });
    return()=>{mounted=false;subscription.unsubscribe();};
  },[client]);

  const refreshMfa=useCallback(async()=>{
    if(!client)return;
    const {data:assurance,error}=await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if(error){setMessage('Unable to check administrator verification');setMfa('needed');return;}
    if(assurance.currentLevel==='aal2'){setMfa('verified');return;}
    const {data:factors}=await client.auth.mfa.listFactors();
    setFactorId(factors?.totp?.find(f=>f.status==='verified')?.id||'');
    setMfa('needed');
  },[client]);

  useEffect(()=>{
    if(session==='signedin'){void refreshMfa();}
    else {setMfa('checking');setPortal(null);setCredentials(null);setEnrollment(null);}
  },[session,refreshMfa]);

  const loadParticipants=useCallback(async()=>{
    if(!courtId)return;
    setMessage('');
    setPortal(null);
    try{
      const response=await fetch('/api/admin/participants?court_id='+encodeURIComponent(courtId),{cache:'no-store'});
      const data=await response.json();
      if(!response.ok)throw new Error((data as ApiError).error||'Court access denied');
      setPortal(data as PortalData);
    }catch(error){setMessage(error instanceof Error?error.message:'Court access unavailable');}
  },[courtId]);

  useEffect(()=>{
    if(session==='signedin'&&mfa==='verified')void loadParticipants();
  },[session,mfa,loadParticipants]);

  const login=async(event:React.FormEvent)=>{
    event.preventDefault();if(!client)return;
    setBusy(true);setMessage('');
    const email=loginIdentifierToEmail(identifier);
    if(!email){setMessage('Enter a valid administrator username or email.');setBusy(false);return;}
    try{
      const {error}=await client.auth.signInWithPassword({email,password});
      if(error)setMessage('Username or password not recognized.');
      else {setSession('signedin');setMfa('checking');await refreshMfa();}
    }catch{setMessage('Authentication is temporarily unavailable.');}
    finally{setPassword('');setBusy(false);}
  };

  const beginMfa=async()=>{
    if(!client)return;
    setBusy(true);setMessage('');
    try{
      const {data,error}=await client.auth.mfa.enroll({factorType:'totp',friendlyName:'DayBridge Court Portal'});
      if(error||!data?.totp?.secret)throw new Error('Could not set up authenticator');
      setEnrollment({id:data.id,secret:data.totp.secret});
      setFactorId(data.id);
    }catch(e){setMessage(e instanceof Error?e.message:'MFA setup unavailable');}
    finally{setBusy(false);}
  };
  const verifyMfa=async(event:React.FormEvent)=>{
    event.preventDefault();if(!client||!factorId)return;
    setBusy(true);setMessage('');
    try{
      const {error}=await client.auth.mfa.challengeAndVerify({factorId,code:code.trim()});
      if(error)throw error;
      setCode('');setEnrollment(null);
      await refreshMfa();
    }catch{setMessage('Verification failed. Check your authenticator code and try again.');}
    finally{setBusy(false);}
  };

  const createParticipant=async(event:React.FormEvent)=>{
    event.preventDefault();if(!courtId||!username)return;
    setBusy(true);setMessage('');setCredentials(null);
    try{
      const response=await fetch('/api/admin/participants',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({court_id:courtId,username:username.trim().toLowerCase()})
      });
      const body=await response.json();
      if(!response.ok)throw new Error(body.error||'Could not create account');
      setCredentials({username:body.username,temporaryPassword:body.temporaryPassword});
      setUsername('');await loadParticipants();
    }catch(e){setMessage(e instanceof Error?e.message:'Could not create account');}
    finally{setBusy(false);}
  };

  const changeParticipant=async(account:CourtAccount,action:'suspend'|'restore'|'remove'|'reset')=>{
    if(action==='remove'&&!window.confirm('Remove this account from the court subscription? This disables sign-in and frees the seat, but does not erase the participant’s personal records.'))return;
    if(action==='reset'&&!window.confirm('Issue a new temporary password? The old password will stop working.'))return;
    setBusy(true);setMessage('');setCredentials(null);
    try{
      const response=await fetch('/api/admin/participants',{
        method:'PATCH',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({court_id:courtId,user_id:account.user_id,action})
      });
      const body=await response.json();
      if(!response.ok)throw new Error(body.error||'Account update failed');
      if(action==='reset')setCredentials({username:account.username,temporaryPassword:body.temporaryPassword});
      await loadParticipants();
    }catch(e){setMessage(e instanceof Error?e.message:'Account update failed');}
    finally{setBusy(false);}
  };

  const logout=async()=>{
    if(client)await client.auth.signOut();
    setSession('signedout');setMessage('');setPortal(null);setCredentials(null);
  };

  return <main className="min-h-screen bg-[#f6faf9] px-4 py-8 text-slate-900 sm:px-8">
    <div className="mx-auto max-w-5xl">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="rounded-2xl bg-teal-800 p-3 text-white"><ShieldCheck className="h-6 w-6"/></span>
          <div><h1 className="text-2xl font-extrabold">DayBridge Admin Portal</h1>
          <p className="text-sm text-slate-600">Court-sponsored participant access</p></div>
        </div>
        <div className="flex items-center gap-3">
          {session==='signedin'&&<button className={secondary} type="button" onClick={()=>void logout()}><LogOut className="mr-2 inline h-4 w-4"/>Sign out</button>}
          <a href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-teal-900 hover:underline"><ArrowLeft className="h-4 w-4"/>DayBridge home</a>
        </div>
      </header>

      <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <h2 className="text-lg font-bold">Select your court</h2>
        <p className="mt-1 text-sm text-slate-600">Choose the state and judicial circuit assigned to your staff account. Selection never grants access by itself.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold">State
            <select className={field} value={stateCode} onChange={e=>{
              const state=e.target.value;setStateCode(state);setCourtId(courts.find(c=>c.state_code===state)?.id||'');setPortal(null);setCredentials(null);
            }} disabled={!states.length}>
              {!states.length&&<option value="">Not yet configured</option>}
              {states.map(s=><option key={s.code} value={s.code}>{s.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold">Judicial circuit
            <select className={field} value={courtId} onChange={e=>{setCourtId(e.target.value);setPortal(null);setCredentials(null);}} disabled={!circuits.length}>
              {!circuits.length&&<option value="">No available circuits</option>}
              {circuits.map(c=><option key={c.id} value={c.id}>{c.circuit_name}</option>)}
            </select>
          </label>
        </div>
        {directoryMessage&&<p role="status" className="mt-3 text-sm text-amber-800">{directoryMessage}</p>}
      </section>

      {session==='loading'&&<p role="status" className="mt-6 text-sm">Checking administrator session…</p>}
      {session==='signedout'&&<section className="mt-5 max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="flex items-center gap-2 text-xl font-extrabold"><KeyRound className="h-5 w-5 text-teal-800"/>Court staff sign in</h2>
        <p className="mt-2 text-sm text-slate-600">Authorized case managers and coordinators only. New staff must be assigned to a court by Global Intent Company.</p>
        <form onSubmit={e=>void login(e)} className="mt-5 space-y-4">
          <label className="block text-sm font-semibold">Username or email
            <input className={field} required autoCapitalize="none" autoComplete="username" value={identifier} onChange={e=>setIdentifier(e.target.value)}/>
          </label>
          <label className="block text-sm font-semibold">Password
            <input className={field} type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/>
          </label>
          <button type="submit" disabled={busy||!courtId||!client} className={primary+' w-full'}><LockKeyhole className="mr-2 inline h-4 w-4"/>Sign in securely</button>
        </form>
      </section>}

      {session==='signedin'&&mfa==='needed'&&<section className="mt-5 max-w-lg rounded-3xl border border-amber-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-extrabold">Administrator verification required</h2>
        <p className="mt-2 text-sm text-slate-700">Every administrative session must pass a second factor. This does not change participant login preferences.</p>
        {!factorId&&!enrollment&&<button type="button" disabled={busy} className={primary+' mt-5'} onClick={()=>void beginMfa()}>Set up authenticator</button>}
        {enrollment&&<p className="mt-4 rounded-xl bg-teal-50 p-3 text-sm">Add this setup key to your authenticator app, then enter its current six-digit code: <strong className="mt-2 block select-all break-all font-mono">{enrollment.secret}</strong></p>}
        {factorId&&<form onSubmit={e=>void verifyMfa(e)} className="mt-5 space-y-4">
          <label className="block text-sm font-semibold">Six-digit authenticator code
            <input className={field} required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e=>setCode(e.target.value)}/>
          </label>
          <button className={primary+' w-full'} type="submit" disabled={busy}>Verify administrator</button>
        </form>}
      </section>}

      {session==='signedin'&&mfa==='verified'&&portal&&<section className="mt-5 space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-600">Licensed seats</p><p className="mt-1 text-3xl font-bold">{portal.court.seat_limit}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-600">Assigned seats</p><p className="mt-1 text-3xl font-bold">{portal.occupied_seats}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-600">Available</p><p className="mt-1 text-3xl font-bold">{Math.max(0,portal.court.seat_limit-portal.occupied_seats)}</p></div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-6">
          <h2 className="flex items-center gap-2 text-lg font-extrabold"><Plus className="h-5 w-5 text-teal-800"/>Create participant account</h2>
          <p className="mt-2 text-sm text-slate-600">A strong temporary password is generated for you and shown only once. Give it to the participant privately; they must choose a new password at first sign-in. Usernames must be unique across DayBridge.</p>
          <form className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={e=>void createParticipant(e)}>
            <label className="flex-1 text-sm font-semibold">Participant username
              <input className={field} required autoCapitalize="none" spellCheck={false} minLength={3} maxLength={32} pattern="[a-z][a-z0-9_-]{2,31}" placeholder="enotah-p001" value={username} onChange={e=>setUsername(e.target.value.toLowerCase())}/>
            </label>
            <button className={primary} disabled={busy||portal.occupied_seats>=portal.court.seat_limit}>Create account</button>
          </form>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-lg font-extrabold"><Users className="h-5 w-5 text-teal-800"/>Participant accounts</h2>
          <p className="mt-1 text-sm text-slate-600">Account administration only. This dashboard cannot read private schedules, medications, notes, finances, or attendance.</p>
          <div className="mt-5 divide-y divide-slate-100">
            {!portal.participants.length&&<p className="py-6 text-sm text-slate-600">No accounts assigned to this court yet.</p>}
            {portal.participants.map(p=><div key={p.user_id} className="flex flex-wrap items-center gap-3 py-4">
              <span className="rounded-xl bg-slate-100 p-3 text-slate-600"><UserRound className="h-4 w-4"/></span>
              <div className="min-w-0 flex-1"><p className="break-all text-sm font-bold">{p.username}</p><p className="text-xs capitalize text-slate-600">{p.status}</p></div>
              <div className="flex flex-wrap gap-2">
                {p.status==='active'&&<>
                  <button disabled={busy} className={secondary+' text-xs'} onClick={()=>void changeParticipant(p,'reset')}>Reset password</button>
                  <button disabled={busy} className={secondary+' text-xs'} onClick={()=>void changeParticipant(p,'suspend')}>Suspend</button>
                </>}
                {p.status!=='active'&&<button disabled={busy} className={secondary+' text-xs'} onClick={()=>void changeParticipant(p,'restore')}>Restore</button>}
                {p.status!=='removed'&&<button disabled={busy} className={secondary+' text-xs'} onClick={()=>void changeParticipant(p,'remove')}>Remove from court</button>}
              </div>
            </div>)}
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-600">Removing a court seat disables new sign-ins but does not permanently delete the person's data. Existing sessions may remain valid until token expiration; offline devices cannot be remotely wiped.</p>
        </div>
      </section>}

      {credentials&&<section role="status" className="mt-5 rounded-2xl border-2 border-teal-500 bg-white p-5">
        <h2 className="font-extrabold text-teal-900">Temporary credentials — displayed once</h2>
        <p className="mt-2 text-sm text-slate-700">Share privately with the participant. Do not email, screenshot, or retain this password in a shared document.</p>
        <p className="mt-3 text-sm">Username: <strong className="font-mono">{credentials.username}</strong></p>
        <p className="mt-2 break-all text-sm">Temporary password: <strong className="font-mono">{credentials.temporaryPassword}</strong></p>
        <button type="button" className={secondary+' mt-4'} onClick={()=>setCredentials(null)}>Dismiss credentials</button>
      </section>}

      {message&&<p role="alert" className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">{message}</p>}
      <footer className="mt-8 border-t border-slate-200 pt-5 text-xs text-slate-600">DayBridge is a participant-owned personal organizer. Court staff manage access only; participants retain responsibility for their private records. This portal is not a court case-management system.</footer>
    </div>
  </main>;
}
