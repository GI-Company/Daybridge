'use client';

import React, { useState } from 'react';
import {
  X,
  Calendar,
  Pill,
  CheckSquare,
  DollarSign,
  Scale,
  Briefcase,
  HeartHandshake,
  Receipt,
  PhoneCall,
  Clock,
  MapPin,
  AlertCircle,
  GraduationCap,
  Users,
  ChevronLeft,
  MapPinned,
} from 'lucide-react';
import { useDayBridge } from '../../lib/storage/store';
import { parseDollarsToCents } from '../../lib/budget';
import {AddBudgetAccount} from '../money/AddBudgetAccount';
import {enrollTrafficAlerts} from '../../lib/travel/auto-reminder';
import { EventCategory, VenueType, PriorityLevel, SavedPlaceCategory } from '../../lib/types';

interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialType?: QuickAddType;
  initialDate?: string;
}

type QuickAddType = 'event' | 'class' | 'self_help' | 'medication' | 'task' | 'transaction' | 'bill' | 'contact' | 'location';
const addChoices: {id: QuickAddType; label: string; detail: string; icon: typeof Calendar}[] = [
 {id:'event',label:'Appointment',detail:'Court, work, or personal',icon:Calendar},
 {id:'class',label:'Class / Group',detail:'Classes and sessions',icon:GraduationCap},
 {id:'self_help',label:'Self-Help Meeting',detail:'AA, NA, SMART, or other',icon:Users},
 {id:'task',label:'Task',detail:'Something to remember',icon:CheckSquare},
 {id:'medication',label:'Medication',detail:'Doses and reminders',icon:Pill},
 {id:'transaction',label:'Expense / Income',detail:'Track money',icon:DollarSign},
 {id:'bill',label:'Bill',detail:'Payment due date',icon:Receipt},
 {id:'location',label:'Saved Location',detail:'A place to remember',icon:MapPinned},
 {id:'contact',label:'Contact',detail:'Person or resource',icon:PhoneCall}
];
const localDate = () => {
 const now=new Date();
 return [now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
};
const hourLater=(value:string)=>{
 const parts=value.split(':').map(Number);
 return [String((parts[0]+1)%24).padStart(2,'0'),String(parts[1]||0).padStart(2,'0')].join(':');
};

export const QuickAddModal: React.FC<QuickAddModalProps> = ({ isOpen, onClose, initialType, initialDate }) => {
  const { profile, addEvent, addMedication, addTask, addTransaction, addBill, addContact, addSavedPlace, accounts, savedPlaces } = useDayBridge();

  const [activeType, setActiveType] = useState<QuickAddType|null>(initialType??null);
  const [advanced,setAdvanced]=useState(false);
  const [formError,setFormError]=useState('');
  const [selectedAccountId,setSelectedAccountId]=useState('');
  const [creatingAccount,setCreatingAccount]=useState(false);
  const activeAccounts=accounts.filter(a=>a.isActive);
  const effectiveAccountId=selectedAccountId || (activeAccounts.length===1?activeAccounts[0].id:'');
  const [placeName,setPlaceName]=useState('');
  const [placeAddress,setPlaceAddress]=useState('');
  const [placeKind,setPlaceKind]=useState<SavedPlaceCategory>('other');
  const [locationCandidates,setLocationCandidates]=useState<Array<{label:string;lat:number;lon:number}>>([]);
  const [verifiedLocation,setVerifiedLocation]=useState<{label:string;lat:number;lon:number}|null>(null);
  const [locationBusy,setLocationBusy]=useState(false);

  // Event form state
  const [eventTitle, setEventTitle] = useState('');
  const [eventCategory, setEventCategory] = useState<EventCategory>('personal');
  const [eventDate, setEventDate] = useState(initialDate||localDate());
  const [eventStartTime, setEventStartTime] = useState('10:00');
  const [eventEndTime, setEventEndTime] = useState('11:00');
  const [eventVenue, setEventVenue] = useState<VenueType>('in_person');
  const [eventLocation, setEventLocation] = useState('');
  const [verifiedEventLocation,setVerifiedEventLocation]=useState<{label:string;lat:number;lon:number}|null>(null);
  const [eventLocationCandidates,setEventLocationCandidates]=useState<Array<{label:string;lat:number;lon:number}>>([]);
  const [checkingEventAddress,setCheckingEventAddress]=useState(false);
  const [eventTravelBuffer, setEventTravelBuffer] = useState('15');
  const [eventRepeat, setEventRepeat] = useState<'none'|'daily'|'weekly'>('none');
  const isCheckIn=activeType==='event'&&eventCategory==='drug_testing';
  const [eventContact, setEventContact] = useState('');

  // Medication form state
  const [medName, setMedName] = useState('');
  const [medStrength, setMedStrength] = useState('');
  const [medInstructions, setMedInstructions] = useState('');
  const [medTimes, setMedTimes] = useState<string[]>(['08:00']);
  const [medDays, setMedDays] = useState<number[]>([0,1,2,3,4,5,6]);
  const [medError,setMedError]=useState('');
  const [medInventory, setMedInventory] = useState('30');
  const [medIsPrn, setMedIsPrn] = useState(false);

  // Task form state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskPriority, setTaskPriority] = useState<PriorityLevel>('medium');
  const [taskDueDate, setTaskDueDate] = useState(localDate());

  // Money transaction form state
  const [txType, setTxType] = useState<'expense' | 'income'>('expense');
  const [txAmount, setTxAmount] = useState('');
  const [txCategory, setTxCategory] = useState('fuel');
  const [txNotes, setTxNotes] = useState('');

  // Bill form state
  const [billTitle, setBillTitle] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [billDueDate, setBillDueDate] = useState(localDate());
  const [billAutopay, setBillAutopay] = useState(false);

  // Contact form state
  const [contactName, setContactName] = useState('');
  const [contactCategory, setContactCategory] = useState<
    'court' | 'therapist' | 'doctor' | 'pharmacy' | 'case_manager' | 'transport' | 'emergency' | 'other'
  >('court');
  const [contactPhone, setContactPhone] = useState('');
  const [contactNotes, setContactNotes] = useState('');

  if (!isOpen) return null;

  const switchType=(type:QuickAddType)=>{
    setActiveType(type);
    setAdvanced(false);
    setFormError('');
  };
  const requestClose=()=>{
    const hasDraft=Boolean(eventTitle.trim()||medName.trim()||taskTitle.trim()||txAmount||
      billTitle.trim()||contactName.trim()||placeName.trim()||placeAddress.trim());
    if(!hasDraft||window.confirm('Discard this unfinished entry?'))onClose();
  };
  async function verifyAddress(){
    if(placeAddress.trim().length<6){setFormError('Enter a street address and city.');return;}
    setLocationBusy(true);setFormError('');setLocationCandidates([]);setVerifiedLocation(null);
    try{
      const response=await fetch('/api/travel/geocode',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({address:placeAddress})});
      if(!response.ok)throw Error();
      const data=await response.json() as {results?:Array<{label:string;lat:number;lon:number}>};
      const results=(data.results||[]).filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon));
      setLocationCandidates(results);
      if(!results.length)setFormError('No matching address found. Add city and state, then retry.');
    }catch{setFormError('Address verification is unavailable. Your saved locations have not changed.');}
    finally{setLocationBusy(false);}
  }

  async function verifyEventAddress(){
    if(eventLocation.trim().length<6){setFormError('Enter a street address and city.');return;}
    setCheckingEventAddress(true);setFormError('');setEventLocationCandidates([]);setVerifiedEventLocation(null);
    try{
      const response=await fetch('/api/travel/geocode',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({address:eventLocation.trim()})
      });
      if(!response.ok)throw Error();
      const body=await response.json() as {results?:Array<{label:string;lat:number;lon:number}>};
      const choices=(body.results||[]).filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon));
      setEventLocationCandidates(choices);
      if(!choices.length)setFormError('No matching street address found. Add a city and state.');
    }catch{setFormError('Address verification is unavailable. The appointment can still be saved without traffic monitoring.');}
    finally{setCheckingEventAddress(false);}
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (activeType === 'event' || activeType === 'class' || activeType === 'self_help') {
      if (!eventTitle.trim())return;
      const start=new Date(eventDate+'T'+eventStartTime+':00');
      const end=new Date(eventDate+'T'+eventEndTime+':00');
      if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<=start){
        setFormError('Choose a valid date and an end time after the start time.');return;
      }
      const startIso = `${eventDate}T${eventStartTime}:00`;
      const endIso = `${eventDate}T${eventEndTime}:00`;
      const rrule = eventRepeat==='daily'?'FREQ=DAILY':eventRepeat==='weekly'?'FREQ=WEEKLY':undefined;

      const matchedPlace=savedPlaces.find(place=>place.address===eventLocation.trim())||
        (verifiedEventLocation&&verifiedEventLocation.label===eventLocation.trim()
          ?{address:verifiedEventLocation.label,lat:verifiedEventLocation.lat,lon:verifiedEventLocation.lon}:null);
      const created=addEvent({
        title: eventTitle.trim(),
        category: activeType==='class'?'class':activeType==='self_help'?'self_help':eventCategory,
        description: activeType==='self_help'?'Private self-help meeting':'',
        startTime: startIso,
        endTime: endIso,
        timezone: profile.timezone,
        venueType: isCheckIn?'phone':eventVenue,
        location: isCheckIn?undefined:eventLocation.trim(),
        destinationLat:isCheckIn?undefined:matchedPlace?.lat,
        destinationLon:isCheckIn?undefined:matchedPlace?.lon,
        contactInfo: eventContact.trim(),
        rrule,
        checkInReminderMinutes: isCheckIn?15:undefined,
        travelBufferMinutes: !isCheckIn&&eventVenue==='in_person'?(parseInt(eventTravelBuffer, 10) || 0):0,
        prepChecklist: [],
      });
      if(!isCheckIn&&matchedPlace&&eventVenue==='in_person'){
        void enrollTrafficAlerts(created,matchedPlace).catch(()=>undefined);
      }
    } else if (activeType === 'medication') {
      if (!medName.trim()) return;
      const times=[...new Set(medTimes)].sort();
      if(!medIsPrn&&(medDays.length===0||times.length===0||times.length!==medTimes.length||times.some(t=>!/^([01]\d|2[0-3]):[0-5]\d$/.test(t)))){
        setMedError('Select at least one repeat day and unique, valid dose times.');return;
      }
      setMedError('');
      addMedication(
        {
          name: medName.trim(),
          strengthText: medStrength.trim(),
          instructions: medInstructions.trim(),
          isPrn: medIsPrn,
          inventoryCount: medInventory ? parseInt(medInventory, 10) : undefined,
          refillThreshold: 7,
          notes: '',
        },
        medIsPrn ? [] : times.map(timeOfDay=>({
          timeOfDay,daysOfWeek:[...medDays],dosageLabel:medStrength.trim()||'1 dose'
        }))
      );
    } else if (activeType === 'task') {
      if (!taskTitle.trim()) return;
      addTask({
        title: taskTitle.trim(),
        priority: taskPriority,
        dueDate: taskDueDate ? `${taskDueDate}T12:00:00` : undefined,
        isRecurring: false,
        subtasks: [],
      });
    } else if (activeType === 'transaction') {
      const cents = parseDollarsToCents(txAmount);
      if(!/^\d+(?:\.\d{1,2})?$/.test(txAmount.trim())||!Number.isSafeInteger(cents)||cents<=0){
        setFormError('Enter an amount greater than zero, with up to two decimal places.');return;
      }
      if(!effectiveAccountId||!accounts.some(account=>account.id===effectiveAccountId&&account.isActive)){
        setFormError('Choose the account for this transaction.');return;
      }
      const signedCents = txType === 'expense' ? -Math.abs(cents) : Math.abs(cents);
      addTransaction({
        accountId: effectiveAccountId,
        amountCents: signedCents,
        transactionType: txType,
        category: txCategory,
        transactionDate: localDate(),
        notes: txNotes.trim(),
        isPending: false,
      });
    } else if (activeType === 'bill') {
      const cents = parseDollarsToCents(billAmount);
      if (!billTitle.trim() || !cents) return;
      addBill({
        title: billTitle.trim(),
        category: 'utilities',
        amountCents: Math.abs(cents),
        nextDueDate: billDueDate,
        isAutopay: billAutopay,
      });
    } else if(activeType==='location'){
      if(!placeName.trim()||!verifiedLocation){
        setFormError('Enter a name and verify the correct street address.');return;
      }
      if(savedPlaces.some(p=>p.category===placeKind&&p.address.toLowerCase()===verifiedLocation.label.toLowerCase())){
        setFormError('This location is already saved in that category.');return;
      }
      addSavedPlace({label:placeName.trim().slice(0,80),address:verifiedLocation.label,
        lat:verifiedLocation.lat,lon:verifiedLocation.lon,category:placeKind});
    } else if (activeType === 'contact') {
      if (!contactName.trim()) return;
      addContact({
        name: contactName.trim(),
        category: contactCategory,
        phone: contactPhone.trim(),
        notes: contactNotes.trim(),
        isEmergency: contactCategory === 'emergency',
      });
    }

    onClose();
  };

  return (
    <div data-daybridge-draft="true" role="dialog" aria-modal="true" aria-label="Add DayBridge record" className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50">
          <h2 className="font-semibold text-slate-900 text-base flex items-center gap-2">
            {activeType===null?'What would you like to add?':('Add '+addChoices.find(item=>item.id===activeType)?.label)}
          </h2>
          <div className="flex items-center gap-2">
          {activeType!==null&&<button type="button" onClick={()=>{if(creatingAccount)setCreatingAccount(false);else setActiveType(null);setFormError('');}}
            className="flex min-h-[44px] items-center gap-1 rounded-lg px-2 text-xs font-semibold text-teal-900">
            <ChevronLeft className="h-4 w-4"/>Back
          </button>}
          <button type="button"
            onClick={requestClose}
            className="p-2 text-slate-700 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
          </div>
        </div>

        {activeType===null&&<div className="p-4 sm:p-5">
          <p className="mb-4 text-sm text-slate-700">Choose what you want to add. You'll only see fields for that item.</p>
          <div className="grid grid-cols-2 gap-3">
            {addChoices.map(({id,label,detail,icon:Icon})=><button key={id} type="button" onClick={()=>switchType(id)}
              className="flex min-h-[100px] flex-col items-start justify-center gap-1.5 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-teal-400 hover:bg-teal-50 focus-visible:ring-2 focus-visible:ring-teal-700">
              <Icon aria-hidden="true" className="h-5 w-5 text-teal-800"/>
              <strong className="text-sm leading-tight text-slate-950">{label}</strong>
              <span className="text-xs text-slate-600">{detail}</span>
            </button>)}
          </div>
        </div>}

        {/* Dynamic Form Body */}
        {activeType==='transaction'&&creatingAccount?
          <div className="p-4"><AddBudgetAccount
            onCreated={id=>{setSelectedAccountId(id);setCreatingAccount(false);setFormError('')}}
            onCancel={()=>setCreatingAccount(false)}/></div>
          :activeType!==null&&<form onSubmit={handleSave} className="max-h-[min(76vh,720px)] overflow-y-auto p-5 space-y-4">
          <p className="text-xs text-slate-600">Only the essentials are required. Additional settings are optional.</p>
          {/* EVENT / CLASS / MEETING FORM */}
          {(activeType === 'event'||activeType === 'class'||activeType === 'self_help') && (
            <>
                {activeType==='event'&&<label className="block text-sm font-medium text-slate-800">Appointment type
                  <select value={eventCategory} onChange={e=>{
                    const category=e.target.value as EventCategory;setEventCategory(category);
                    if(category==='drug_testing'){setEventRepeat('daily');if(!eventTitle.trim())setEventTitle('Drug test check-in');}
                  }}
                    className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-3 text-sm">
                    <option value="personal">Personal appointment</option>
                    <option value="court">Court appearance</option>
                    <option value="drug_testing">Drug test check-in</option>
                    <option value="therapy">Therapy</option>
                    <option value="work">Work shift</option>
                    <option value="case_management">Case management</option>
                    <option value="other">Other</option>
                  </select>
                </label>}

              {isCheckIn&&<p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-950">Check whether you are selected for a randomized drug test. Reminders start at the beginning of your window and repeat every 15 minutes until the end time or until you mark that day done. Uses appointment notifications and your quiet hours.</p>}
              {activeType==='self_help'&&<p className="rounded-lg bg-teal-50 p-3 text-xs text-teal-950">Self-help meetings are kept as private calendar events. Attendance is self-reported; no GPS check-in is required.</p>}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  {activeType==='class'?'Class / group name':activeType==='self_help'?'Meeting name':'Title'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={activeType==='class'?'e.g. Weekly accountability class':activeType==='self_help'?'e.g. Thursday recovery meeting':'e.g. Appointment or shift'}
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:border-teal-500"
                />
              </div>


              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium text-slate-800">Date
                  <input type="date" required value={eventDate}
                    onChange={e=>setEventDate(e.target.value)}
                    className="mt-1 block w-full min-w-0 rounded-xl border border-slate-300 bg-white p-3 text-sm"/>
                </label>
                <label className="block text-sm font-medium text-slate-800">Start time
                  <input type="time" required value={eventStartTime}
                    onChange={e=>{setEventStartTime(e.target.value);setEventEndTime(hourLater(e.target.value));}}
                    className="mt-1 block w-full min-w-0 rounded-xl border border-slate-300 bg-white p-3 text-sm"/>
                </label>
              </div>
                <label className="block text-sm font-medium text-slate-800">End time
                  <input type="time" required value={eventEndTime} onChange={e=>setEventEndTime(e.target.value)}
                    className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-3 text-sm"/>
                </label>
              <label className="block text-sm font-medium text-slate-800">Repeat
                <select aria-label="Repeat" value={eventRepeat} onChange={e=>setEventRepeat(e.target.value as 'none'|'daily'|'weekly')}
                  className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-3 text-sm">
                  <option value="none">Does not repeat</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly on this day</option>
                </select>
              </label>
              {!isCheckIn&&<>
              <p className="text-xs text-slate-600">For automatic traffic alerts, verify the destination below or choose a saved location. Approve a starting point in Travel settings once; background traffic monitoring then needs no further setup for each eligible appointment.</p>
              {!!savedPlaces.length&&<label className="block text-sm font-medium text-slate-800">Choose a saved location (optional)
                <select value={savedPlaces.find(p=>p.address===eventLocation)?.id||''}
                  onChange={e=>{
                    const place=savedPlaces.find(p=>p.id===e.target.value);
                    if(place){setEventLocation(place.address);setVerifiedEventLocation(null);setEventLocationCandidates([]);}
                  }}
                  className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-3 text-sm">
                  <option value="">Enter a location instead</option>
                  {savedPlaces.map(place=><option key={place.id} value={place.id}>{place.label}</option>)}
                </select>
              </label>}
              <label className="block text-sm font-medium text-slate-800">Location or meeting link (optional)
                <input type="text" value={eventLocation}
                  onChange={e=>{setEventLocation(e.target.value);setVerifiedEventLocation(null);setEventLocationCandidates([]);}}
                  placeholder="Street address, city, state, or online link"
                  className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-3 text-sm"/>
              </label>
              {eventVenue==='in_person'&&eventLocation.trim().length>=6&&
               !savedPlaces.some(p=>p.address===eventLocation.trim())&&<div className="space-y-2">
                <button type="button" disabled={checkingEventAddress}
                  onClick={()=>void verifyEventAddress()}
                  className="min-h-[44px] w-full rounded-xl border border-teal-300 bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-950 disabled:opacity-50">
                  {checkingEventAddress?'Finding street address…':'Verify this address for traffic alerts'}
                </button>
                {eventLocationCandidates.map((candidate,i)=><button type="button" key={i}
                  onClick={()=>{setEventLocation(candidate.label);setVerifiedEventLocation(candidate);setEventLocationCandidates([]);setFormError('');}}
                  className="block min-h-[44px] w-full rounded-xl border border-slate-300 bg-white p-3 text-left text-sm text-slate-800">
                  {candidate.label}
                </button>)}
                {verifiedEventLocation&&verifiedEventLocation.label===eventLocation.trim()
                 ?<p role="status" className="text-xs text-teal-800">Address verified for automatic route estimates.</p>
                 :<p className="text-xs text-slate-600">You can still save the appointment without verifying; traffic alerts won't start until an address is verified.</p>}
               </div>}
              </>}
              <button type="button" onClick={()=>setAdvanced(prev=>!prev)}
                aria-expanded={advanced}
                className="flex w-full min-h-[44px] items-center justify-between border-t border-slate-200 pt-3 text-sm font-semibold text-teal-900">
                {advanced?'Hide optional settings':'More options (optional)'}
                <span aria-hidden="true">{advanced?'−':'+'}</span>
              </button>
              {advanced&&<div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                {!isCheckIn&&<>
                <label className="block text-sm font-medium text-slate-800">Meeting format
                  <select value={eventVenue} onChange={e=>setEventVenue(e.target.value as VenueType)}
                    className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-3 text-sm">
                    <option value="in_person">In person</option>
                    <option value="virtual">Online</option>
                    <option value="phone">By phone</option>
                  </select>
                </label>
                {eventVenue==='in_person'&&<label className="block text-sm font-medium text-slate-800">Travel preparation (minutes)
                  <select value={eventTravelBuffer} onChange={e=>setEventTravelBuffer(e.target.value)}
                    className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-3 text-sm">
                    <option value="0">No buffer</option>
                    <option value="15">15 minutes</option>
                    <option value="30">30 minutes</option>
                    <option value="45">45 minutes</option>
                    <option value="60">60 minutes</option>
                  </select>
                </label>}
                </>}
                <label className="block text-sm font-medium text-slate-800">Contact or instructor (optional)
                  <input type="text" value={eventContact} onChange={e=>setEventContact(e.target.value)}
                    className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-3 text-sm"
                    placeholder="Name or phone number"/>
                </label>
              </div>}
            </>
          )}

          {/* MEDICATION FORM */}
          {activeType === 'medication' && (
            <>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Medication Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sertraline, Lisinopril, Blood Pressure Rx"
                  value={medName}
                  onChange={(e) => setMedName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Strength / Dose</label>
                  <input
                    type="text"
                    placeholder="e.g. 50 mg, 1 tablet"
                    value={medStrength}
                    onChange={(e) => setMedStrength(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Initial Pill Count (Optional)</label>
                  <input
                    type="number"
                    placeholder="e.g. 30"
                    value={medInventory}
                    onChange={(e) => setMedInventory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:border-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1">Label Instructions</label>
                <input
                  type="text"
                  placeholder="e.g. Take daily in the morning with water."
                  value={medInstructions}
                  onChange={(e) => setMedInstructions(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:border-teal-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isPrn"
                  checked={medIsPrn}
                  onChange={(e) => setMedIsPrn(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-teal-500 bg-slate-50"
                />
                <label htmlFor="isPrn" className="text-xs text-slate-700">
                  As needed (PRN) — no fixed daily reminder time
                </label>
              </div>

              {!medIsPrn && (
                <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <fieldset className="space-y-2">
                   <legend className="text-sm font-semibold text-slate-900">Scheduled dose times</legend>
                   <p className="text-xs text-slate-700">Add a time for each dose prescribed on the label, e.g. morning and evening.</p>
                   {medTimes.map((time,index)=>(
                    <div key={index} className="flex items-center gap-2">
                     <label className="flex-1 text-xs text-slate-700">Dose {index+1}
                      <input type="time" required value={time} onChange={e=>{setMedError('');setMedTimes(prev=>prev.map((v,i)=>i===index?e.target.value:v))}} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"/>
                     </label>
                     {medTimes.length>1&&<button type="button" onClick={()=>setMedTimes(prev=>prev.filter((_,i)=>i!==index))} className="mt-4 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs text-rose-800">Remove</button>}
                    </div>
                   ))}
                   {medTimes.length<8&&<button type="button" onClick={()=>setMedTimes(prev=>[...prev,'20:00'])} className="rounded-lg border border-teal-300 bg-white px-3 py-2 text-xs font-semibold text-teal-900">+ Add another time</button>}
                  </fieldset>
                  <fieldset className="space-y-2">
                   <legend className="text-xs font-semibold text-slate-700">Repeat on</legend>
                   <div className="grid grid-cols-7 gap-1">{['Su','Mo','Tu','We','Th','Fr','Sa'].map((day,i)=><label key={day} className="flex flex-col items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 text-[11px]"><input type="checkbox" checked={medDays.includes(i)} onChange={e=>setMedDays(prev=>e.target.checked?[...prev,i].sort():prev.filter(x=>x!==i))}/>{day}</label>)}</div>
                  </fieldset>
                  {medError&&<p role="alert" className="text-xs text-rose-800">{medError}</p>}
                </div>
              )}

              <p className="text-[11px] text-slate-600 italic">
                * Personal logging only. Always follow prescription label and clinician instructions.
              </p>
            </>
          )}

          {/* TASK FORM */}
          {activeType === 'task' && (
            <>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Task Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Print weekly review log, confirm ride to court"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Priority</label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value as PriorityLevel)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:border-teal-500 min-h-[42px]"
                  >
                    <option value="urgent">Urgent</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:border-teal-500"
                  />
                </div>
              </div>
            </>
          )}

          {/* TRANSACTION FORM */}
          {activeType === 'transaction' && (
            <>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {setTxType('expense');setTxCategory('fuel')}}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold min-h-[44px] transition ${
                    txType === 'expense'
                      ? 'bg-rose-50 text-rose-900 border border-rose-400'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  Expense
                </button>
                <button
                  type="button"
                  onClick={() => {setTxType('income');setTxCategory('wages')}}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold min-h-[44px] transition ${
                    txType === 'income'
                      ? 'bg-teal-500/20 text-teal-800 border border-teal-500/40'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  Income
                </button>
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1">Amount ($)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={txAmount}
                  onChange={(e) => setTxAmount(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-base font-semibold text-slate-900 focus:border-teal-500"
                />
              </div>

              <label className="block text-sm font-semibold text-slate-800">Account
                <select required value={effectiveAccountId} onChange={e=>setSelectedAccountId(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-3 text-sm">
                  <option value="">Choose an account</option>
                  {accounts.filter(a=>a.isActive).map(account=><option key={account.id} value={account.id}>{account.name}</option>)}
                </select>
              </label>
              {activeAccounts.length===0&&<p role="status" className="text-sm text-amber-900">First, add where your money is kept. You can start with a $0 balance.</p>}
              <button type="button" onClick={()=>setCreatingAccount(true)}
                className="min-h-[44px] rounded-lg border border-teal-300 bg-white px-3 py-2 text-sm font-semibold text-teal-900">+ Add an account</button>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Category</label>
                  <select
                    value={txCategory}
                    onChange={(e) => setTxCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:border-teal-500 min-h-[42px]"
                  >
                    {txType==='income'&&<>
                      <option value="wages">Paycheck / wages</option>
                      <option value="wage_advance">Wage advance</option>
                      <option value="refund">Refund</option>
                      <option value="other">Other income</option>
                    </>}
                    {txType==='expense'&&<>
                      <option value="fuel">Fuel / Bus</option>
                    <option value="food">Groceries / Food</option>
                    <option value="prescriptions">Prescriptions</option>
                    <option value="court">Court / Fees</option>
                    <option value="housing">Housing / Rent</option>
                    <option value="other">Other expense</option>
                    </>}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Note / Description</label>
                  <input
                    type="text"
                    placeholder="e.g. Gas pump #4"
                    value={txNotes}
                    onChange={(e) => setTxNotes(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:border-teal-500"
                  />
                </div>
              </div>
            </>
          )}

          {/* BILL FORM */}
          {activeType === 'bill' && (
            <>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Bill Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Electric bill, Phone service"
                  value={billTitle}
                  onChange={(e) => setBillTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Amount ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="65.00"
                    value={billAmount}
                    onChange={(e) => setBillAmount(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Due Date</label>
                  <input
                    type="date"
                    required
                    value={billDueDate}
                    onChange={(e) => setBillDueDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:border-teal-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="billAutopay"
                  checked={billAutopay}
                  onChange={(e) => setBillAutopay(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-teal-500 bg-slate-50"
                />
                <label htmlFor="billAutopay" className="text-xs text-slate-700">
                  Set on Autopay (Informational reminder)
                </label>
              </div>
            </>
          )}

          {/* LOCATION FORM: verified coordinates are required for routing */}
          {activeType==='location'&&<>
            <label className="block text-sm font-semibold text-slate-900">Place name
              <input type="text" required maxLength={80} value={placeName} onChange={e=>setPlaceName(e.target.value)}
                placeholder="e.g. Weekly class" className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-3 text-sm"/>
            </label>
            <label className="block text-sm font-semibold text-slate-900">Street address and city
              <input type="text" required value={placeAddress} onChange={e=>{setPlaceAddress(e.target.value);setVerifiedLocation(null);setLocationCandidates([]);}}
                placeholder="Street address, city, state" className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-3 text-sm"/>
            </label>
            <button type="button" disabled={locationBusy||placeAddress.trim().length<6}
              onClick={()=>void verifyAddress()}
              className="min-h-[44px] w-full rounded-xl border border-teal-300 bg-teal-50 p-3 text-sm font-semibold text-teal-950 disabled:opacity-50">
              {locationBusy?'Verifying address…':'Verify address'}
            </button>
            {!!locationCandidates.length&&<fieldset className="space-y-2">
              <legend className="text-xs font-semibold text-slate-800">Choose the correct match</legend>
              {locationCandidates.map((candidate,i)=><button key={i} type="button" onClick={()=>{setVerifiedLocation(candidate);setPlaceAddress(candidate.label);setFormError('');}}
                className={'block min-h-[44px] w-full rounded-xl border p-3 text-left text-sm '+
                (verifiedLocation?.label===candidate.label?'border-teal-700 bg-teal-50 text-teal-950':'border-slate-300 bg-white text-slate-800')}>
                {candidate.label}
              </button>)}
            </fieldset>}
            {verifiedLocation&&<p className="text-xs text-teal-900">Verified address selected. It will be available in your private saved places.</p>}
            <button type="button" onClick={()=>setAdvanced(prev=>!prev)} aria-expanded={advanced}
              className="flex w-full min-h-[44px] items-center justify-between border-t border-slate-200 pt-3 text-sm font-semibold text-teal-900">
              {advanced?'Hide optional settings':'More options (optional)'} <span aria-hidden="true">{advanced?'−':'+'}</span>
            </button>
            {advanced&&<label className="block text-sm font-medium text-slate-800">Place type
              <select value={placeKind} onChange={e=>setPlaceKind(e.target.value as SavedPlaceCategory)}
                className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-3 text-sm">
                <option value="other">Other</option>
                <option value="home">Home</option>
                <option value="work">Work</option>
                <option value="therapy">Therapy</option>
                <option value="class">Class or meeting</option>
                <option value="court">Court</option>
                <option value="drug_testing">Drug testing</option>
              </select>
            </label>}
          </>}

          {/* CONTACT FORM */}
          {activeType === 'contact' && (
            <>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Contact Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Officer Miller, Dr. Chen, Pharmacy Desk"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Category</label>
                  <select
                    value={contactCategory}
                    onChange={(e) => setContactCategory(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:border-teal-500 min-h-[42px]"
                  >
                    <option value="court">Court Officer / Case Worker</option>
                    <option value="therapist">Therapist / Counselor</option>
                    <option value="doctor">Doctor / Clinic</option>
                    <option value="pharmacy">Pharmacy</option>
                    <option value="transport">Transit / Driver</option>
                    <option value="emergency">Emergency / Crisis</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    placeholder="(555) 000-0000"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:border-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1">Notes / Hours</label>
                <input
                  type="text"
                  placeholder="e.g. Office hours 9am-4pm"
                  value={contactNotes}
                  onChange={(e) => setContactNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:border-teal-500"
                />
              </div>
            </>
          )}

          {formError&&<p role="alert" className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-950">{formError}</p>}
          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={requestClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 min-h-[44px] transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-teal-500 hover:bg-teal-400 active:scale-95 text-slate-950 min-h-[44px] shadow-lg shadow-teal-100/70 transition"
            >
              Save {activeType==='class'?'Class':activeType==='self_help'?'Meeting':activeType==='event'?(isCheckIn?'Check-in':'Appointment'):activeType==='location'?'Location':activeType==='transaction'?'Transaction':'Record'}
            </button>
          </div>
        </form>}
      </div>
    </div>
  );
};
