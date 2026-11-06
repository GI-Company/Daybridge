'use client';
import {CourtSharingPanel} from '../../components/settings/CourtSharing';
import {ParticipantProgress} from '../../components/admin/ParticipantProgress';
export function ReportingHarness(){return new URLSearchParams(window.location.search).get('reporting')==='participant'?<main className="mx-auto max-w-3xl p-3"><CourtSharingPanel eligible={[{id:'private-court-event',kind:'event',label:'Private court meeting title',categories:['meeting','check_in','obligation']},{id:'private-class-event',kind:'event',label:'Private class title',categories:['class']}]}/></main>:<main className="mx-auto max-w-6xl p-3"><ParticipantProgress courtId="d6000000-0000-4000-8000-000000000001"/></main>;}
