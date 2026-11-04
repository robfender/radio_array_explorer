import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {execFileSync} from 'node:child_process';
import {evaluate,settings,numericRanges,defaults,duration,networkWindow,DAY,travelDays} from '../web/core.mjs';import {renderSVG} from '../web/render.mjs';
const cat=JSON.parse(readFileSync(new URL('../web/data/facilities.json',import.meta.url)));
test('catalogue invariants and adopted bands',()=>{assert.equal(new Set(cat.facilities.map(f=>f.id)).size,18);for(const f of cat.facilities){assert.equal(f.category,/^(SKA-|DSA)/.test(f.name)?'future':'real');assert.ok(f.sources.length);assert.ok(f.bands.every(b=>b.frequency_GHz>0&&b.resolution_arcsec>0));}assert.equal(cat.facilities.find(f=>f.name==='DSA').antenna_count,1650);assert.equal(cat.facilities.find(f=>f.name==='MeerKAT').bands.length,4);assert.equal(cat.facilities.find(f=>f.name==='LOFAR-NL').bands.length,2);});
test('visibility duration, poles and grazing boundaries',()=>{assert.ok(Math.abs(duration(0,0,0)-DAY/2)<1e-9);assert.equal(duration(90,40,20),DAY);assert.equal(duration(90,-40,20),0);assert.equal(duration(-30.71,40,20),0);assert.equal(duration(34.08,-40,20),0);});
test('network requires simultaneous continuous time',()=>{const stations=[{name:'A',latitude_deg:0,longitude_deg:0},{name:'B',latitude_deg:0,longitude_deg:180}];assert.equal(networkWindow(stations,0,20,1).stations.length,1);const wrap=[{name:'A',latitude_deg:40,longitude_deg:1},{name:'B',latitude_deg:40,longitude_deg:-1}];assert.equal(networkWindow(wrap,40,20,1).stations.length,2);});
test('practical north/south limits and future filter',()=>{const north=evaluate(cat,{declination:40});assert.ok(!north.rows.some(r=>r.name==='MeerKAT'));const south=evaluate(cat,{declination:-40});assert.ok(!south.rows.some(r=>r.name.startsWith('JVLA')));assert.ok(!south.rows.some(r=>r.name==='VLBA'));assert.ok(evaluate(cat,{includeFuture:false,allSky:true}).rows.every(r=>r.category==='real'));});
test('rank, count, noise exposure and proper-motion conversion',()=>{const a=evaluate(cat,{allSky:true}),b=evaluate(cat,{allSky:true,hours:4});for(let i=1;i<a.rows.length;i++)assert.ok(Math.min(...a.rows[i-1].bands.map(x=>x.resolution_arcsec))<=Math.min(...a.rows[i].bands.map(x=>x.resolution_arcsec)));for(const r of a.rows){assert.equal(r.quality,r.participating_antennas**2);assert.equal(b.rows.find(x=>x.id===r.id).rms_uJy,r.rms_uJy/2);}assert.equal(travelDays(1,20),50);assert.equal(evaluate(cat,{properMotion:0}).settings.properMotion,.001);});
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
