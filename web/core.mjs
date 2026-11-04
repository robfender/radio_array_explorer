export const DAY = 23.9344696;
export const defaults = {declination:40,elevation:20,hours:1,properMotion:20,includeFuture:true,allSky:false,fmin:.05,fmax:1000};
export const numericRanges = {declination:[-90,90],elevation:[0,89],hours:[1,12],properMotion:[.001,10000],fmin:[.001,10000],fmax:[.001,10000]};
const rad=x=>x*Math.PI/180;
export function settings(input={}) {
 const s={...defaults,...input};
 for(const [k,[lo,hi]] of Object.entries(numericRanges)) {
  const value=s[k]===''||s[k]===null?NaN:Number(s[k]);
  s[k]=Number.isNaN(value)?defaults[k]:Math.max(lo,Math.min(hi,value));
 }
 s.fmin=Math.min(s.fmin,s.fmax);
 return s;
}
export function duration(latitude,declination,elevation) {
 const a=Math.sin(rad(latitude))*Math.sin(rad(declination)),b=Math.cos(rad(latitude))*Math.cos(rad(declination));
 if(Math.abs(b)<1e-12) return a>=Math.sin(rad(elevation))-1e-12?DAY:0;
 const c=(Math.sin(rad(elevation))-a)/b;
 return c<=-1?DAY:c>=1?0:DAY*Math.acos(c)/Math.PI;
}
export function extent(stations) {
 let max=0;
 for(const a of stations) for(const b of stations) {
  const dot=Math.sin(rad(a.latitude_deg))*Math.sin(rad(b.latitude_deg))+Math.cos(rad(a.latitude_deg))*Math.cos(rad(b.latitude_deg))*Math.cos(rad(a.longitude_deg-b.longitude_deg));
  max=Math.max(max,6371*Math.sqrt(Math.max(0,2-2*dot)));
 } return max;
}
export function networkWindow(stations,dec,el,hours) {
 const intervals=stations.map(st=>{
  const d=duration(st.latitude_deg,dec,el),c=(( -st.longitude_deg/360*DAY)%DAY+DAY)%DAY;
  if(d>=DAY-1e-9) return {st,spans:[[-DAY,2*DAY]]};
  return {st,spans:[-DAY,0,DAY].map(offset=>[c-d/2+offset,c+d/2+offset]).filter(([a,b])=>b-a>=hours-1e-9)};
 });
 const ends=[0,DAY,...intervals.flatMap(x=>x.spans.flatMap(([a,b])=>[a,b-hours])).filter(x=>x>=0&&x<=DAY)].sort((a,b)=>a-b);
 const candidates=[...ends,...ends.slice(1).map((x,i)=>(x+ends[i])/2)];
 let best={stations:[],duration_hours:0,extent_km:0};
 for(const start of candidates) {
  const active=intervals.map(x=>({st:x.st,span:x.spans.find(([a,b])=>start>=a-1e-9&&start+hours<=b+1e-9)})).filter(x=>x.span);
  const d=active.length?Math.min(DAY,Math.min(...active.map(x=>x.span[1]))-Math.max(...active.map(x=>x.span[0]))):0;
  const ex=extent(active.map(x=>x.st));
  if(active.length>best.stations.length||(active.length===best.stations.length&&(ex>best.extent_km+1e-6||(Math.abs(ex-best.extent_km)<1e-6&&d>best.duration_hours)))) best={stations:active.map(x=>x.st),duration_hours:d,extent_km:ex};
 } return best;
}
export const travelDays=(arcsec,masPerDay)=>arcsec*1000/masPerDay;
export function evaluate(catalogue,input={}) {
 const s=settings(input),included=[],excluded=[];
 for(const f of catalogue.facilities) {
  if(!s.includeFuture&&f.category==='future') continue;
  let bands=f.bands.filter(b=>b.frequency_GHz>=s.fmin&&b.frequency_GHz<=s.fmax);
  if(!bands.length) continue;
  let n=f.antenna_count,d=DAY,retained=f.stations||[],scale=1,reason='';
  if(!s.allSky) {
   if(f.visibility_model==='station-network') {
    const w=networkWindow(f.stations,s.declination,s.elevation,s.hours);n=w.stations.length;retained=w.stations;d=w.duration_hours;
    if(n<catalogue.methods.minimum_imaging_stations) reason=`Only ${n} stations share a continuous ${s.hours} h window; at least 3 required for this imaging comparison.`;
    if(n>=3&&n<f.stations.length) scale=extent(f.stations)/w.extent_km;
   } else {
    d=duration(f.site.latitude_deg,s.declination,s.elevation);
    if(d+1e-9<s.hours) reason=`Above ${s.elevation}° for ${d.toFixed(2)} h; ${s.hours} continuous hour(s) required.`;
   }
  }
  const subset=f.visibility_model==='station-network'&&n<f.antenna_count;
  const rms=subset?null:f.sensitivity.rms_1h_uJy/Math.sqrt(s.hours);
  bands=bands.map(b=>({...b,resolution_arcsec:b.resolution_arcsec*scale,time_days:travelDays(b.resolution_arcsec*scale,s.properMotion)}));
  const row={...f,bands,available:!reason,exclusion_reason:reason,visible_hours:d,participating_antennas:n,participating_stations:retained.map(x=>x.name),baselines:Math.max(0,n*(n-1)/2),quality:n*n,resolution_scale:scale,rms_uJy:rms,sensitivity_reason:subset?'Subset sensitivity requires station SEFDs; not estimated.':'Representative reference, thermal-equivalent exposure scaling.',subset};
  (reason?excluded:included).push(row);
 }
 included.sort((a,b)=>Math.min(...a.bands.map(x=>x.resolution_arcsec))-Math.min(...b.bands.map(x=>x.resolution_arcsec)));
 return {data_version:catalogue.data_version,settings:s,rows:included,excluded};
}
