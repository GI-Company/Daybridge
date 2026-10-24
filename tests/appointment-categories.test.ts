import test from 'node:test';
import assert from 'node:assert/strict';
import {appointmentCategories,appointmentCategory} from '../lib/appointment-categories.ts';
test('existing accounts keep the exact category identity and colors without a migration',()=>{
 const categories=appointmentCategories({});assert.equal(categories.length,9);
 assert.deepEqual(appointmentCategory({},'court'),{id:'court',label:'Court',color:'#d97706'});
 assert.equal(appointmentCategory({},'drug_testing').label,'Drug test check-in');
});
test('removed categories retain their name and color for existing events and can be restored',()=>{
 const profile={appointmentCategories:[{id:'court' as const,label:'Court',color:'#a12345',hidden:true},{id:'custom_abc' as const,label:'Family',color:'#345678'}]};
 assert.equal(appointmentCategories(profile).filter(c=>!c.hidden).some(c=>c.id==='court'),false);
 assert.equal(appointmentCategory(profile,'court').color,'#a12345');
 assert.equal(appointmentCategory(profile,'custom_abc').label,'Family');
 const restored={appointmentCategories:appointmentCategories(profile).map(c=>({...c,hidden:false}))};
 assert.equal(appointmentCategory(restored,'court').hidden,false);
});
test('category presentation rejects unsafe colors and invalid category identifiers',()=>{
 const profile={appointmentCategories:[{id:'custom_abc' as const,label:'  Family  ',color:'url(https://untrusted.invalid)'},{id:'custom_bad<script>' as const,label:'Bad',color:'#000000'}]};
 assert.equal(appointmentCategory(profile,'custom_abc').color,'#475569');assert.equal(appointmentCategory(profile,'custom_abc').label,'Family');
 assert.equal(appointmentCategories(profile).some(c=>c.id==='custom_bad<script>'),false);
});
