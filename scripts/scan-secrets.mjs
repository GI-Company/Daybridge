import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';

// Focused source scan, not a replacement for provider secret scanning or historical review.
const files=execFileSync('git',['ls-files','-z','--cached','--others','--exclude-standard'],{encoding:'utf8'}).split('\0').filter(Boolean);
let failures=0;
for(const file of new Set(files)){
 if(/\.(png|jpg|jpeg|ico|woff2?|pdf|mp4|zip)$/.test(file))continue;
 let source;try{source=readFileSync(file,'utf8');}catch{continue;}
 const rules=[/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/\bgh[pousr]_[A-Za-z0-9]{30,}\b/,/\bgithub_pat_[A-Za-z0-9_]{40,}\b/,/\bAKIA[A-Z0-9]{16}\b/,/\bsb_secret_[A-Za-z0-9_-]{20,}\b/];
 let found=rules.some(rule=>rule.test(source));
 for(const match of source.matchAll(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)){
  try{if(JSON.parse(Buffer.from(match[0].split('.')[1],'base64url').toString()).role==='service_role')found=true;}catch{}
 }
 if(found){console.error('Potential secret in '+file+'; value redacted');failures++;}
}
if(failures)process.exitCode=1;
else console.log('Focused secret scan passed ('+new Set(files).size+' source paths; working tree only).');
