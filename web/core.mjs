export const DAY = 23.9344696;
export const defaults = {declination:40,elevation:20,hours:1,properMotion:20,includeFuture:true,allSky:false,fmin:.05,fmax:1000};
export const numericRanges = {declination:[-90,90],elevation:[0,89],hours:[1,12],properMotion:[.001,10000],fmin:[.001,10000],fmax:[.001,10000]};
export const sortOptions={
 resolution:{label:'Angular resolution',title:'angular resolution',defaultDirection:'asc',asc:'Finest plotted resolution first',desc:'Coarsest plotted resolution first'},
 quality:{label:'Image quality proxy',title:'image quality proxy',defaultDirection:'desc',asc:'Smallest antenna-count proxy first',desc:'Largest antenna-count proxy first'},
 sensitivity:{label:'Sensitivity proxy',title:'sensitivity proxy',defaultDirection:'asc',asc:'Lowest rms (best sensitivity) first',desc:'Highest rms (weakest sensitivity) first'}
};
export function orderRows(rows,sortBy='resolution',direction='asc'){
 const value=r=>sortBy==='quality'?r.quality:sortBy==='sensitivity'?r.rms_uJy:Math.min(...r.bands.map(b=>b.resolution_arcsec));
 return [...rows].sort((a,b)=>{
  const av=value(a),bv=value(b),am=av==null||!Number.isFinite(av),bm=bv==null||!Number.isFinite(bv);
  if(am!==bm)return am?1:-1;
  return (am?0:(av-bv)*(direction==='desc'?-1:1))||a.name.localeCompare(b.name);
 });
}
const rad=x=>x*Math.PI/180;
export function settings(input={}) {
 const s={...defaults,...input};
 for(const [k,[lo,hi]] of Object.entries(numericRanges)) {
  const value=s[k]===''||s[k]===null?NaN:Number(s[k]);
  s[k]=Number.isNaN(value)?defaults[k]:Math.max(lo,Math.min(hi,value));
 }
 s.fmin=Math.min(s.fmin,s.fmax);
 s.sortBy=Object.hasOwn(sortOptions,s.sortBy)?s.sortBy:'resolution';
 s.sortDirection=['asc','desc'].includes(s.sortDirection)?s.sortDirection:sortOptions[s.sortBy].defaultDirection;
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
function networkBand(f, b, s, elevation) {
 const roster=b.station_ids?f.stations.filter(st=>b.station_ids.includes(st.id)):f.stations;
 const w=s.allSky?{stations:roster,duration_hours:DAY,extent_km:extent(roster)}:networkWindow(roster,s.declination,elevation,s.hours);
 const n=w.stations.length,subset=n<roster.length;
 const scale=subset&&n>=3?extent(roster)/w.extent_km:1;
 return {...b,resolution_arcsec:b.resolution_arcsec*scale,participating_antennas:n,reference_station_count:roster.length,participating_stations:w.stations.map(st=>st.name),visible_hours:w.duration_hours,subset,resolution_scale:scale};
}
export function evaluate(catalogue,input={}) {
 const s=settings(input),included=[],excluded=[];
 for(const f of catalogue.facilities) {
  const custom=Array.isArray(s.facilityIds);
  if(custom?!s.facilityIds.includes(f.id):(f.default_enabled===false||(!s.includeFuture&&f.category==='future'))) continue;
  let bands=f.bands.filter(b=>b.frequency_GHz>=s.fmin&&b.frequency_GHz<=s.fmax);
  if(!bands.length) {
   excluded.push({...f,bands:[],available:false,exclusion_type:'frequency',exclusion_reason:`No plotted band is within ${s.fmin}–${s.fmax} GHz. Available marker frequencies: ${f.bands.map(b=>b.frequency_GHz).join(', ')} GHz.`});
   continue;
  }
  const effectiveElevation=Math.max(s.elevation,f.minimum_elevation_deg??0);
  let n=f.antenna_count,d=DAY,names=[],scale=1,reason='',subset=false,bandExcluded=[];
  if(f.visibility_model==='station-network') {
   const assessed=bands.map(b=>networkBand(f,b,s,effectiveElevation));
   const accepted=assessed.filter(b=>b.participating_antennas>=catalogue.methods.minimum_imaging_stations);
   const ref=accepted[0]||assessed[0];
   n=ref.participating_antennas;names=ref.participating_stations;d=ref.visible_hours;scale=ref.resolution_scale;subset=ref.subset;
   bandExcluded=assessed.filter(b=>!accepted.includes(b)).map(b=>({label:b.label,frequency_GHz:b.frequency_GHz,reason:`Only ${b.participating_antennas} stations share a continuous ${s.hours} h window; at least 3 required.`}));
   if(!accepted.length) reason=bandExcluded[0].reason;
   bands=accepted.length?accepted:assessed;
  } else if(!s.allSky) {
   d=duration(f.site.latitude_deg,s.declination,effectiveElevation);
   if(d+1e-9<s.hours) reason=`Above ${effectiveElevation}° for ${d.toFixed(2)} h; ${s.hours} continuous hour(s) required.`;
  }
  const missingRms=f.sensitivity.rms_1h_uJy==null;
  const rms=subset||missingRms?null:f.sensitivity.rms_1h_uJy/Math.sqrt(s.hours);
  bands=bands.map(b=>({...b,time_days:travelDays(b.resolution_arcsec,s.properMotion)}));
  const row={...f,bands,excluded_bands:bandExcluded,available:!reason,exclusion_reason:reason,visible_hours:d,effective_elevation_deg:effectiveElevation,participating_antennas:n,participating_stations:names,baselines:Math.max(0,n*(n-1)/2),quality:n*n,resolution_scale:scale,rms_uJy:rms,sensitivity_reason:subset?'Subset sensitivity requires station SEFDs; not estimated.':missingRms?f.sensitivity.reference:'Representative reference, thermal-equivalent exposure scaling.',subset};
  (reason?excluded:included).push(row);
 }
 return {data_version:catalogue.data_version,settings:s,ordering:{title:`Major radio facilities ranked by ${sortOptions[s.sortBy].title}`,description:sortOptions[s.sortBy][s.sortDirection]},rows:orderRows(included,s.sortBy,s.sortDirection),excluded};
}
