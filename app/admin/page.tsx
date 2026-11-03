import type {Metadata} from 'next';
import {AdminPortal} from '../../components/admin/AdminPortal';
export const dynamic='force-dynamic';
export const metadata:Metadata={
  title:'Court Admin | DayBridge',
  description:'Court-scoped account administration for authorized DayBridge program staff.',
  robots:{index:false,follow:false}
};
export default function AdminPage(){return <AdminPortal/>;}
