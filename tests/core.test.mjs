import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {execFileSync} from 'node:child_process';
import {evaluate,orderRows,settings,numericRanges,defaults,duration,networkWindow,DAY,travelDays} from '../web/core.mjs';import {renderSVG} from '../web/render.mjs';
const cat=JSON.parse(readFileSync(new URL('../web/data/facilities.json',import.meta.url)));
test('catalogue invariants and adopted bands',()=>{assert.equal(new Set(cat.facilities.map(f=>f.id)).size,24);for(const f of cat.facilities){assert.equal(f.category,/^(SKA-|DSA|FAST Core Array)/.test(f.name)?'future':'real');assert.ok(f.sources.length);assert.ok(f.bands.every(b=>b.frequency_GHz>0&&b.resolution_arcsec>0));}assert.equal(cat.facilities.find(f=>f.name==='DSA').antenna_count,1650);assert.equal(cat.facilities.find(f=>f.name==='MeerKAT').bands.length,4);assert.equal(cat.facilities.find(f=>f.name==='LOFAR-NL').bands.length,2);});
test('visibility duration, poles and grazing boundaries',()=>{assert.ok(Math.abs(duration(0,0,0)-DAY/2)<1e-9);assert.equal(duration(90,40,20),DAY);assert.equal(duration(90,-40,20),0);assert.equal(duration(-30.71,40,20),0);assert.equal(duration(34.08,-40,20),0);});
test('network requires simultaneous continuous time',()=>{const stations=[{name:'A',latitude_deg:0,longitude_deg:0},{name:'B',latitude_deg:0,longitude_deg:180}];assert.equal(networkWindow(stations,0,20,1).stations.length,1);const wrap=[{name:'A',latitude_deg:40,longitude_deg:1},{name:'B',latitude_deg:40,longitude_deg:-1}];assert.equal(networkWindow(wrap,40,20,1).stations.length,2);});
test('practical north/south limits and future filter',()=>{const north=evaluate(cat,{declination:40});assert.ok(!north.rows.some(r=>r.name==='MeerKAT'));const south=evaluate(cat,{declination:-40});assert.ok(!south.rows.some(r=>r.name.startsWith('JVLA')));assert.ok(!south.rows.some(r=>r.name==='VLBA'));assert.ok(evaluate(cat,{includeFuture:false,allSky:true}).rows.every(r=>r.category==='real'));});
test('rank, count, noise exposure and proper-motion conversion',()=>{const a=evaluate(cat,{allSky:true}),b=evaluate(cat,{allSky:true,hours:4});for(let i=1;i<a.rows.length;i++)assert.ok(Math.min(...a.rows[i-1].bands.map(x=>x.resolution_arcsec))<=Math.min(...a.rows[i].bands.map(x=>x.resolution_arcsec)));for(const r of a.rows){assert.equal(r.baselines,r.participating_antennas*(r.participating_antennas-1)/2);assert.equal(b.rows.find(x=>x.id===r.id).rms_uJy,r.rms_uJy/2);}assert.equal(travelDays(1,20),50);assert.equal(evaluate(cat,{properMotion:0}).settings.properMotion,.001);});
test('standalone CLI and browser module agree exactly',()=>{for(const input of [{declination:40},{declination:-40,includeFuture:false},{allSky:true,properMotion:33,hours:2}]){const cli=JSON.parse(execFileSync(process.execPath,['scripts/evaluate.mjs',JSON.stringify(input)],{encoding:'utf8'}));assert.deepEqual(cli,evaluate(cat,input));assert.equal(renderSVG(cli),renderSVG(evaluate(cat,input)));}});

test('numeric settings clamp bounds and recover incomplete entries',()=>{
 for(const [key,[lo,hi]] of Object.entries(numericRanges)){
  const input={fmax:10000};
  assert.equal(settings({...input,[key]:lo-100})[key],lo);
  assert.equal(settings({...input,[key]:hi+100})[key],hi);
  assert.equal(settings({...input,[key]:Infinity})[key],hi);
  assert.equal(settings({...input,[key]:-Infinity})[key],lo);
  assert.equal(settings({...input,[key]:''})[key],defaults[key]);
  assert.equal(settings({...input,[key]:'invalid'})[key],defaults[key]);
 }
 assert.equal(settings({fmin:20,fmax:10}).fmin,10);
 assert.equal(settings({fmax:999999}).fmax,10000);
});

test('ATA active array, band midpoints and declination limits',()=>{
 const f=cat.facilities.find(f=>f.id==='allen-telescope-array');
 assert.equal(f.antenna_count,28);assert.equal(f.installed_antenna_count,42);
 assert.equal(f.category,'real');assert.equal(f.bands.length,4);
 for(const b of f.bands)assert.equal(b.frequency_GHz,(b.frequency_min_GHz+b.frequency_max_GHz)/2);
 assert.ok(f.bands[0].resolution_arcsec>100);
 const north=evaluate(cat,{declination:40,includeFuture:false});
 const row=north.rows.find(r=>r.id===f.id);assert.equal(row.baselines,378);
 assert.ok(row.rms_uJy>100&&row.rms_uJy<150);assert.equal(row.sensitivity.provisional,true);
 assert.ok(!evaluate(cat,{declination:-40}).rows.some(r=>r.id===f.id));
 assert.ok(renderSVG(north).includes('>1000</text>'));
});

test('FAST design bands, full array and instrument elevation limit',()=>{
 const f=cat.facilities.find(f=>f.id==='fast-core-array');
 assert.equal(f.category,'future');assert.equal(f.antenna_count,25);
 assert.equal(f.minimum_elevation_deg,50);assert.equal(f.maximum_baseline_m,10000);
 assert.equal(f.bands.length,3);
 for(const b of f.bands){assert.equal(b.frequency_GHz,(b.frequency_min_GHz+b.frequency_max_GHz)/2);assert.ok(Math.abs(b.resolution_arcsec*b.frequency_GHz-4.3*1.4)<1e-9);}
 const north=evaluate(cat,{declination:40});const r=north.rows.find(r=>r.id===f.id);
 assert.equal(r.baselines,300);assert.equal(r.effective_elevation_deg,50);
 assert.ok(r.rms_uJy>.5&&r.rms_uJy<.6);assert.equal(r.sensitivity.provisional,true);
 assert.ok(!evaluate(cat,{declination:-40}).rows.some(r=>r.id===f.id));
 // At -14 deg transit exceeds 50 deg, but the duration is below 1 h.
 assert.ok(!evaluate(cat,{declination:-14,elevation:0}).rows.some(r=>r.id===f.id));
 assert.equal(evaluate(cat,{declination:40,elevation:60}).rows.find(r=>r.id===f.id).effective_elevation_deg,60);
 assert.ok(!evaluate(cat,{allSky:true,includeFuture:false}).rows.some(r=>r.id===f.id));
});

test('individual selection overrides category, preserves visibility and permits clearing',()=>{
 const ids=['meerkat','dsa'];
 const custom=evaluate(cat,{allSky:true,includeFuture:false,facilityIds:ids});
 assert.deepEqual(new Set(custom.rows.map(r=>r.id)),new Set(ids));
 assert.equal(evaluate(cat,{allSky:true,facilityIds:[]}).rows.length,0);
 const north=evaluate(cat,{declination:40,includeFuture:false,facilityIds:ids});
 assert.deepEqual(north.rows.map(r=>r.id),['dsa']);
 assert.ok(north.excluded.some(r=>r.id==='meerkat'));
 assert.ok(!evaluate(cat,{allSky:true,includeFuture:false}).rows.some(r=>r.id==='dsa'));
 const cli=JSON.parse(execFileSync(process.execPath,['scripts/evaluate.mjs',JSON.stringify({allSky:true,includeFuture:false,facilityIds:ids})],{encoding:'utf8'}));
 assert.deepEqual(cli,custom);
});

test('EHT and GMVA require explicit opt-in and disappear when selection closes',()=>{
 for(const input of [{allSky:true},{allSky:true,includeFuture:false},{declination:40},{declination:-40}]){
  const r=evaluate(cat,input);assert.ok(![...r.rows,...r.excluded].some(f=>['eht','gmva'].includes(f.id)));
 }
 const r=evaluate(cat,{allSky:true,facilityIds:['eht','gmva']});
 assert.deepEqual(r.rows.map(f=>f.id),['eht','gmva']);
 const eht=r.rows[0];assert.equal(eht.default_enabled,false);assert.equal(eht.category,'real');
 assert.equal(eht.bands.length,2);assert.equal(eht.bands[1].participating_antennas,6);
 assert.equal(eht.rms_uJy,null);assert.equal(r.rows[1].rms_uJy,29);
 assert.ok(renderSVG(r).includes('>0.00001</text>'));
 const high=evaluate(cat,{allSky:true,facilityIds:['eht'],fmin:300});
 assert.equal(high.rows[0].participating_antennas,6);assert.equal(high.rows[0].baselines,15);
 const north=evaluate(cat,{declination:40,facilityIds:['eht','gmva']});
 assert.ok(north.rows.length>0);for(const f of north.rows)assert.ok(f.visible_hours>=1);
 const cli=JSON.parse(execFileSync(process.execPath,['scripts/evaluate.mjs',JSON.stringify({allSky:true,facilityIds:['eht','gmva']})],{encoding:'utf8'}));assert.deepEqual(cli,r);
});

test('selected millimetre arrays outside a frequency cap explain why they are hidden',()=>{
 const r=evaluate(cat,{allSky:true,facilityIds:['eht','gmva'],fmax:40});
 assert.equal(r.rows.length,0);assert.equal(r.excluded.length,2);
 for(const f of r.excluded){assert.equal(f.exclusion_type,'frequency');assert.match(f.exclusion_reason,/0.05–40 GHz/);}
 assert.equal(evaluate(cat,{allSky:true,facilityIds:['eht','gmva'],fmax:1000}).rows.length,2);
});

test('WSRT and uGMRT are default real arrays with midpoint frequencies and valid limits',()=>{
 const all=evaluate(cat,{allSky:true,includeFuture:false});
 for(const id of ['wsrt','gmrt']){
  const f=all.rows.find(f=>f.id===id);assert.ok(f);assert.equal(f.category,'real');assert.equal(f.default_enabled,true);
  for(const b of f.bands)assert.equal(b.frequency_GHz,(b.frequency_min_GHz+b.frequency_max_GHz)/2);
  assert.ok(f.rms_uJy>0);assert.equal(f.sensitivity.provisional,true);
 }
 const wsrt=all.rows.find(f=>f.id==='wsrt'),gmrt=all.rows.find(f=>f.id==='gmrt');
 assert.equal(wsrt.participating_antennas,12);assert.equal(wsrt.baselines,66);assert.equal(wsrt.bands.length,1);
 assert.equal(gmrt.participating_antennas,30);assert.equal(gmrt.baselines,435);assert.equal(gmrt.bands.length,4);
 assert.ok(gmrt.rms_uJy>8&&gmrt.rms_uJy<10);
 assert.ok(!evaluate(cat,{declination:-40}).rows.some(f=>f.id==='wsrt'));
 assert.ok(evaluate(cat,{declination:-40}).rows.some(f=>f.id==='gmrt'));
 assert.equal(evaluate(cat,{declination:40,elevation:0}).rows.find(f=>f.id==='gmrt').effective_elevation_deg,17);
});

test('ranking controls sort metrics in both directions and keep missing sensitivity last',()=>{
 const rows=[{name:'B',baselines:100,rms_uJy:10,bands:[{resolution_arcsec:1}]},{name:'A',baselines:400,rms_uJy:2,bands:[{resolution_arcsec:.1}]},{name:'C',baselines:10,rms_uJy:null,bands:[{resolution_arcsec:10}]}];
 for(const [key,asc,desc] of [['resolution',['A','B','C'],['C','B','A']],['baselines',['C','B','A'],['A','B','C']],['sensitivity',['A','B','C'],['B','A','C']]]){
  assert.deepEqual(orderRows(rows,key,'asc').map(r=>r.name),asc);assert.deepEqual(orderRows(rows,key,'desc').map(r=>r.name),desc);
 }
 assert.equal(settings({sortBy:'baselines'}).sortDirection,'desc');assert.equal(settings({sortBy:'invalid',sortDirection:'invalid'}).sortBy,'resolution');
 for(const sortBy of ['resolution','baselines','sensitivity'])for(const sortDirection of ['asc','desc']){
  const input={allSky:true,facilityIds:['eht','dsa','gmrt'],sortBy,sortDirection};
  const result=evaluate(cat,input),cli=JSON.parse(execFileSync(process.execPath,['scripts/evaluate.mjs',JSON.stringify(input)],{encoding:'utf8'}));
  assert.deepEqual(cli,result);assert.ok(renderSVG(result).includes(result.ordering.title));
  if(sortBy==='sensitivity')assert.equal(result.rows.at(-1).id,'eht');
 }
});

test('synchrotron weighting converts to a 1 GHz flux threshold with the correct sign',async()=>{
 const {synchrotronEquivalentRms}=await import('../web/core.mjs');
 assert.equal(synchrotronEquivalentRms(10,1),10);
 assert.ok(Math.abs(synchrotronEquivalentRms(10,10)-39.81071705534972)<1e-10);
 assert.ok(Math.abs(synchrotronEquivalentRms(10,.1)-2.51188643150958)<1e-10);
 assert.equal(synchrotronEquivalentRms(10,null),null);assert.equal(synchrotronEquivalentRms(null,1),null);
 const raw=evaluate(cat,{allSky:true}),weighted=evaluate(cat,{allSky:true,synchrotron:true});
 for(const r of weighted.rows){
  const original=raw.rows.find(x=>x.id===r.id);assert.equal(r.rms_uJy,original.rms_uJy);assert.deepEqual(r.bands,original.bands);
  assert.ok(r.sensitivity.frequency_GHz>0);assert.equal(r.sensitivity_proxy_rms_uJy,r.rms_uJy*r.sensitivity.frequency_GHz**.6);
 }
 const svg=renderSVG(weighted);assert.ok(svg.includes('Synchrotron-weighted proxy'));assert.ok(!svg.includes('µJy/beam'));
 const sensitivityAxis=svg.match(/<g data-panel="sensitivity-axis">(.*?)<\/g>/s)[1];assert.ok(!sensitivityAxis.includes('<text'));
 assert.ok(renderSVG(raw).includes('1-hour rms (µJy/beam)'));
 assert.equal(settings({synchrotron:'false'}).synchrotron,false);assert.equal(settings({synchrotron:'true'}).synchrotron,true);
});
test('weighted sensitivity ranking and standalone evaluation match the plotted metric',()=>{
 const input={allSky:true,synchrotron:true,sortBy:'sensitivity',facilityIds:['eht','dsa','gmrt','alma-c-1-compact']};
 const r=evaluate(cat,input),cli=JSON.parse(execFileSync(process.execPath,['scripts/evaluate.mjs',JSON.stringify(input)],{encoding:'utf8'}));
 assert.deepEqual(cli,r);assert.equal(r.rows.at(-1).id,'eht');assert.equal(r.rows.at(-1).sensitivity_proxy_rms_uJy,null);
 for(let i=1;i<r.rows.length-1;i++)assert.ok(r.rows[i-1].sensitivity_proxy_rms_uJy<=r.rows[i].sensitivity_proxy_rms_uJy);
 const missing=structuredClone(cat);missing.facilities.find(f=>f.id==='dsa').sensitivity.frequency_GHz=null;
 const noReference=evaluate(missing,{allSky:true,synchrotron:true,facilityIds:['dsa']});assert.equal(noReference.rows[0].sensitivity_proxy_rms_uJy,null);
});


test('baseline counts drive bar widths and legacy links use the new metric',()=>{
 const result=evaluate(cat,{allSky:true,sortBy:'quality'});
 assert.equal(result.settings.sortBy,'baselines');
 const dsa=result.rows.find(r=>r.id==='dsa');assert.equal(dsa.baselines,1360425);
 assert.ok(result.rows.every(r=>!Object.hasOwn(r,'quality')));
 const svg=renderSVG(result);
 assert.ok(svg.includes('No. baselines'));assert.doesNotMatch(svg,/image.?quality|N²|N_antennas/i);
 const row=svg.match(/<g data-facility="dsa">(.*?)<\/g>/s)[1];
 assert.ok(row.includes(`width="${Math.log10(dsa.baselines)/7*170}"`));
 for(let i=1;i<result.rows.length;i++)assert.ok(result.rows[i-1].baselines>=result.rows[i].baselines);
});
