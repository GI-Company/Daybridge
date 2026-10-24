/** Clock-independent identities prevent duplicate records when offline devices create items simultaneously. */
export function newRecordId(prefix:string):string{return prefix+'-'+crypto.randomUUID();}
