export class PrivateRequestError extends Error {
 status:number;
 constructor(message:string,status:number){super(message);this.status=status;}
}
export function assertSameOrigin(request:Request){
 const origin=request.headers.get('origin'),site=request.headers.get('sec-fetch-site');
 if(site==='cross-site'||site==='same-site')throw new PrivateRequestError('Cross-origin requests are not allowed',403);
 if(origin&&origin!==new URL(request.url).origin)throw new PrivateRequestError('Cross-origin requests are not allowed',403);
}
/** Bound the actual stream as well as Content-Length; reject malformed input before calling providers. */
export async function readPrivateJSON(request:Request,maxBytes=8192):Promise<unknown>{
 assertSameOrigin(request);
 if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')throw new PrivateRequestError('Content-Type must be application/json',415);
 const length=request.headers.get('content-length');
 if(length&&(!/^\d+$/.test(length)||Number(length)>maxBytes))throw new PrivateRequestError('Request body is too large',413);
 const reader=request.body?.getReader();if(!reader)throw new PrivateRequestError('A JSON body is required',400);
 let count=0;const chunks:Uint8Array[]=[];
 while(true){const {done,value}=await reader.read();if(done)break;count+=value.byteLength;if(count>maxBytes){await reader.cancel();throw new PrivateRequestError('Request body is too large',413);}chunks.push(value);}
 const bytes=new Uint8Array(count);let position=0;for(const chunk of chunks){bytes.set(chunk,position);position+=chunk.byteLength;}
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new PrivateRequestError('Invalid JSON body',400);}
}
