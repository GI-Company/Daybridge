import {randomInt} from 'node:crypto';

/** Independent of the participant's name and birthday. Auth and SQL enforce uniqueness. */
export function generateParticipantUsername(){
 let username='';
 for(let i=0;i<4;i++)username+=String.fromCharCode(97+randomInt(26));
 for(let i=0;i<4;i++)username+=randomInt(10);
 return username;
}
