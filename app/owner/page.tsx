import type {Metadata} from 'next';
import {OwnerPortal} from '../../components/admin/OwnerPortal';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Owner Dashboard | DayBridge',description:'Owner-only court and staff setup.',robots:{index:false,follow:false}};
export default function OwnerPage(){return <OwnerPortal/>;}
