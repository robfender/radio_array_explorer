import {defaults,evaluate,settings,numericRanges} from './core.mjs';
import {renderSVG,escape,frequencyColor} from './render.mjs';
const catalogue=await fetch('./data/facilities.json').then(r=>{if(!r.ok)throw Error('Catalogue failed to load');return r.json()});
const form=document.querySelector('form'),chart=document.querySelector('#chart');let result;
const themeButton=document.querySelector('#theme-toggle');
const currentTheme=()=>document.documentElement.dataset.theme==='dark'?'dark':'light';
const drawChart=()=>{if(result)chart.innerHTML=renderSVG(result,currentTheme());};
function reflectTheme(){const dark=currentTheme()==='dark';themeButton.textContent=dark?'Light mode':'Dark mode';themeButton.setAttribute('aria-pressed',String(dark));}
themeButton.onclick=()=>{document.documentElement.dataset.theme=currentTheme()==='dark'?'light':'dark';try{localStorage.setItem('radio-array-theme',currentTheme());}catch{}reflectTheme();drawChart();};
reflectTheme();
const query=new URLSearchParams(location.search);
for(const [key,value] of Object.entries(defaults)){const input=form.elements[key];if(query.has(key)){if(input.type==='checkbox')input.checked=query.get(key)==='true';else input.value=query.get(key);}}
function read(){return Object.fromEntries(Object.keys(defaults).map(k=>[k,form.elements[k].type==='checkbox'?form.elements[k].checked:form.elements[k].value]));}
for(const [key,[min,max]] of Object.entries(numericRanges)){form.elements[key].min=min;form.elements[key].max=max;}
function update(commit=false){try{
 const values=read();
 if(!commit&&Object.keys(numericRanges).some(k=>values[k]===''))return;
 const s=settings(values);
 if(commit)for(const key of Object.keys(numericRanges))form.elements[key].value=s[key];result=evaluate(catalogue,s);drawChart();
 document.querySelector('#error').textContent='';
 document.querySelector('#summary').textContent=`${result.rows.length} facilities / configurations`;
 document.querySelector('#constraint').textContent=s.allSky?'All-sky reference comparison · visibility screening off':`Dec ${s.declination>0?'+':''}${s.declination}° · ≥ ${s.elevation}° elevation · ≥ ${s.hours} continuous hour(s)`;
 document.querySelector('#unavailable summary').textContent=`${result.excluded.length} unavailable at these observing limits`;
 document.querySelector('#unavailable div').innerHTML=result.excluded.map(r=>`<p><strong>${escape(r.name)}</strong> — ${escape(r.exclusion_reason)}</p>`).join('');
 document.querySelector('#details').innerHTML='';
 const params=new URLSearchParams(Object.entries(s).map(([k,v])=>[k,String(v)]));history.replaceState(null,'',`${location.pathname}?${params}`);
 }catch(e){document.querySelector('#error').textContent=e.message;}}
form.addEventListener('input',()=>update());form.addEventListener('change',()=>update(true));form.addEventListener('submit',e=>e.preventDefault());
document.querySelector('#reset').onclick=()=>{for(const [k,v]of Object.entries(defaults)){const x=form.elements[k];if(x.type==='checkbox')x.checked=v;else x.value=v;}update(true);};
chart.addEventListener('click',e=>{const id=e.target.closest('[data-facility]')?.dataset.facility;if(!id)return;const r=result.rows.find(x=>x.id===id);const sens=r.rms_uJy==null?r.sensitivity_reason:`${r.rms_uJy.toPrecision(3)} µJy/beam in ${result.settings.hours} h; ${r.sensitivity.reference}.`;
 document.querySelector('#details').innerHTML=`<h2>${escape(r.name)} · ${r.category}</h2><p>${r.participating_antennas} participating antennas/stations; ${r.baselines} baselines. ${result.settings.allSky?'Visibility not screened.':`${r.visible_hours.toFixed(2)} h continuous common visibility.`}</p>${r.participating_stations.length?`<p>Stations: ${escape(r.participating_stations.join(', '))}.</p>`:''}<p>Sensitivity: ${escape(sens)}</p><p>${r.bands.map(b=>`${escape(b.label)}: ${b.frequency_GHz} GHz / ${b.resolution_arcsec.toPrecision(3)}″`).join(' · ')}</p>${r.warnings.map(w=>`<p>${escape(w)}</p>`).join('')}<p>References: ${r.sources.map((u,i)=>`<a href="${escape(u)}" target="_blank" rel="noopener">Source ${i+1}</a>`).join(' · ')}</p>`;
});
function save(content,type,name){const u=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
document.querySelector('#svg').onclick=()=>save(renderSVG(result,currentTheme()),'image/svg+xml','radio-array-explorer.svg');
document.querySelector('#csv').onclick=()=>{const rows=[['catalogue_version','facility','category','frequency_GHz','resolution_arcsec','time_days','antennas','baselines','N_squared','rms_uJy','exposure_hours','sensitivity_reference'],...result.rows.flatMap(r=>r.bands.map(b=>[result.data_version,r.name,r.category,b.frequency_GHz,b.resolution_arcsec,b.time_days,r.participating_antennas,r.baselines,r.quality,r.rms_uJy??'',result.settings.hours,r.sensitivity.reference]))];save(rows.map(row=>row.map(x=>'"'+String(x).replaceAll('"','""')+'"').join(',')).join('\r\n'),'text/csv','radio-array-explorer.csv');};
document.querySelector('#png').onclick=async()=>{const svg=renderSVG(result,currentTheme()),url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));try{const img=new Image();img.src=url;await img.decode();const c=document.createElement('canvas');c.width=img.width*2;c.height=img.height*2;c.getContext('2d').drawImage(img,0,0,c.width,c.height);c.toBlob(blob=>{if(blob)save(blob,'image/png','radio-array-explorer.png');});}finally{URL.revokeObjectURL(url);}};
document.querySelector('#share').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);document.querySelector('#share').textContent='Link copied';setTimeout(()=>document.querySelector('#share').textContent='Copy link',2000);}catch{document.querySelector('#error').textContent='Copy the address from your browser to share these settings.';}};
document.querySelector('#frequency-legend').innerHTML=[.05,.15,1,5,22,100,1000].map(f=>`<span><i class="swatch" style="background:${frequencyColor(f)}"></i>${f}</span>`).join('');
document.querySelector('#version').textContent=`Catalogue ${catalogue.data_version} · Reference data reviewed ${catalogue.reviewed_on} · Local planning preview`;
update(true);
