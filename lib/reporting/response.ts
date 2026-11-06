import {NextResponse} from 'next/server';
import {CourtAccessError,StaffPasswordRequired} from '../admin/courts';
import {PrivateRequestError} from '../security/request';
export const privateReportHeaders={'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'};
export function reportFailure(error:unknown){
 if(error instanceof StaffPasswordRequired)return NextResponse.json({error:error.message,password_change_required:true},{status:403,headers:privateReportHeaders});
 const known=error instanceof CourtAccessError||error instanceof PrivateRequestError;
 return NextResponse.json({error:known?error.message:'Reporting is temporarily unavailable'},{status:known?error.status:503,headers:privateReportHeaders});
}
export function rpcFailure(error:{code?:string}|null){
 if(!error)return;
 if(error.code==='42501')throw new CourtAccessError(403,'Reporting access is not available for this account');
 if(error.code==='P0001')throw new CourtAccessError(400,'Review the permitted category, eligible item and history date, then try again');
 throw new CourtAccessError(503,'Unable to complete reporting request');
}
