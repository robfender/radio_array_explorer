import {defaults,evaluate,settings,numericRanges,sortOptions} from './core.mjs?v=20261109-synchrotron';
import {renderSVG,escape,frequencyColor} from './render.mjs?v=20261109-synchrotron';
const catalogue=await fetch('./data/facilities.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Catalogue failed to load');return r.json()});
const form=document.querySelector('form'),chart=document.querySelector('#chart');let result;
const themeButton=document.querySelector('#theme-toggle');
const currentTheme=()=>document.documentElement.dataset.theme==='dark'?'dark':'light';
const drawChart=()=>{if(result)chart.innerHTML=renderSVG(result,currentTheme());};
function reflectTheme(){const dark=currentTheme()==='dark';themeButton.textContent=dark?'Light mode':'Dark mode';themeButton.setAttribute('aria-pressed',String(dark));}
themeButton.onclick=()=>{document.documentElement.dataset.theme=currentTheme()==='dark'?'light':'dark';try{localStorage.setItem('radio-array-theme',currentTheme());}catch{}reflectTheme();drawChart();};
reflectTheme();
const query=new URLSearchParams(location.search);
let synchrotron=query.get('synchrotron')==='true';
let sortBy=Object.hasOwn(sortOptions,query.get('sortBy'))?query.get('sortBy'):'resolution';
let sortDirection=['asc','desc'].includes(query.get('sortDirection'))?query.get('sortDirection'):sortOptions[sortBy].defaultDirection;
function reflectSort(){
 for(const button of document.querySelectorAll('[data-sort]')){
  const active=button.dataset.sort===sortBy,option=sortOptions[button.dataset.sort];
  button.setAttribute('aria-pressed',String(active));
  button.textContent=option.label+(active?(sortDirection==='asc'?' ↑':' ↓'):' ↕');
  button.title=active?`Reverse order: ${option[sortDirection==='asc'?'desc':'asc']}`:option[option.defaultDirection];
 }
 document.querySelector('#sort-description').textContent=(synchrotron&&sortBy==='sensitivity'?(sortDirection==='asc'?'Best synchrotron-weighted sensitivity first':'Weakest synchrotron-weighted sensitivity first'):sortOptions[sortBy][sortDirection])+(sortBy==='sensitivity'?'; unestimated entries stay last. Values are approximate; future arrays are projections.':'.');
}
document.querySelector('#sort-controls').onclick=e=>{
 const button=e.target.closest('[data-sort]');if(!button)return;
 if(sortBy===button.dataset.sort)sortDirection=sortDirection==='asc'?'desc':'asc';
 else{sortBy=button.dataset.sort;sortDirection=sortOptions[sortBy].defaultDirection;}
 reflectSort();update(true);
};
function reflectSpectrum(){
 const button=document.querySelector('#synchrotron-toggle');
 button.setAttribute('aria-pressed',String(synchrotron));
 button.textContent=synchrotron?'Optically thin synchrotron: on':'Optically thin synchrotron: off';
 document.querySelector('#synchrotron-description').textContent=synchrotron?'Sν ∝ ν⁻⁰·⁶; referenced to 1 GHz. Bars use each array’s sensitivity-reference frequency, not every resolution marker. Numeric sensitivity labels are hidden.':'Compare instrument rms directly, or apply a ν⁻⁰·⁶ source spectrum referenced to 1 GHz.';
}
document.querySelector('#synchrotron-toggle').onclick=()=>{synchrotron=!synchrotron;reflectSpectrum();reflectSort();update(true);};
reflectSpectrum();
reflectSort();
for(const [key,value] of Object.entries(defaults)){const input=form.elements[key];if(query.has(key)){if(input.type==='checkbox')input.checked=query.get(key)==='true';else input.value=query.get(key);}}
const arrayPanel=document.querySelector('#array-panel'),chooseArrays=document.querySelector('#choose-arrays');
let selectionOpen=query.has('facilityIds');
let chosenArrays=new Set((query.get('facilityIds')||'').split(',').filter(id=>catalogue.facilities.some(f=>f.id===id)));
const arrayOptions=document.querySelector('#array-options');
arrayOptions.innerHTML=[...catalogue.facilities].sort((a,b)=>a.name.localeCompare(b.name)).map(f=>`<label class="check array-choice"><input type="checkbox" value="${escape(f.id)}"><span>${escape(f.name)}<small>${escape(f.category)}${f.default_enabled===false?' · optional':''}</small></span></label>`).join('');
function reflectSelection(){
 arrayPanel.hidden=!selectionOpen;chooseArrays.setAttribute('aria-expanded',String(selectionOpen));
 chooseArrays.textContent='Detailed array selection';
 form.elements.includeFuture.disabled=selectionOpen;
 for(const input of arrayOptions.querySelectorAll('input'))input.checked=chosenArrays.has(input.value);
 document.querySelector('#selection-count').textContent=`${chosenArrays.size} selected`;
}
function closeSelection(){selectionOpen=false;reflectSelection();update(true);chooseArrays.focus();}
chooseArrays.onclick=()=>{
 if(selectionOpen){closeSelection();return;}
 chosenArrays=new Set(catalogue.facilities.filter(f=>f.default_enabled!==false&&(form.elements.includeFuture.checked||f.category==='real')).map(f=>f.id));
 selectionOpen=true;reflectSelection();update(true);
};
document.querySelector('#close-arrays').onclick=closeSelection;
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&selectionOpen){e.preventDefault();closeSelection();}});
arrayOptions.onchange=e=>{if(e.target.type!=='checkbox')return;if(e.target.checked)chosenArrays.add(e.target.value);else chosenArrays.delete(e.target.value);reflectSelection();update(true);};
document.querySelector('#arrays-all').onclick=()=>{chosenArrays=new Set(catalogue.facilities.map(f=>f.id));reflectSelection();update(true);};
document.querySelector('#include-selected-frequencies').onclick=()=>{
 const frequencies=catalogue.facilities.filter(f=>chosenArrays.has(f.id)).flatMap(f=>f.bands.map(b=>b.frequency_GHz));
 if(!frequencies.length)return;
 form.elements.fmin.value=Math.min(Number(form.elements.fmin.value),...frequencies);
 form.elements.fmax.value=Math.max(Number(form.elements.fmax.value),...frequencies);
 update(true);
};
document.querySelector('#arrays-none').onclick=()=>{chosenArrays.clear();reflectSelection();update(true);};
reflectSelection();
function read(){return {...Object.fromEntries(Object.keys(defaults).map(k=>[k,form.elements[k].type==='checkbox'?form.elements[k].checked:form.elements[k].value])),sortBy,sortDirection,synchrotron};}
for(const [key,[min,max]] of Object.entries(numericRanges)){form.elements[key].min=min;form.elements[key].max=max;}
function update(commit=false){try{
 const values=read();
 if(!commit&&Object.keys(numericRanges).some(k=>values[k]===''))return;
 const s=settings(selectionOpen?{...values,facilityIds:[...chosenArrays]}:values);
 if(commit)for(const key of Object.keys(numericRanges))form.elements[key].value=s[key];result=evaluate(catalogue,s);drawChart();
 document.querySelector('#error').textContent='';
 const frequencyExcluded=result.excluded.filter(r=>r.exclusion_type==='frequency');
 document.querySelector('#selection-frequency-notice').hidden=!selectionOpen||frequencyExcluded.length===0;
 document.querySelector('#selection-frequency-message').textContent=`Not shown: ${frequencyExcluded.map(r=>r.name).join(', ')}. These selected arrays have no band within your ${s.fmin}–${s.fmax} GHz frequency range. Increase the maximum frequency or use the button below to include all selected frequencies.`;
 document.querySelector('#summary').textContent=`${result.rows.length} facilities / configurations`;
 document.querySelector('#constraint').textContent=s.allSky?'All-sky reference comparison · visibility screening off':`Dec ${s.declination>0?'+':''}${s.declination}° · ≥ ${s.elevation}° elevation · ≥ ${s.hours} continuous hour(s)`;
 if(selectionOpen)document.querySelector('#constraint').textContent+=' · Individual array selection';
 document.querySelector('#unavailable summary').textContent=`${result.excluded.length} unavailable at these observing limits`;
 document.querySelector('#unavailable div').innerHTML=result.excluded.map(r=>`<p><strong>${escape(r.name)}</strong> — ${escape(r.exclusion_reason)}</p>`).join('');
 document.querySelector('#details').innerHTML='';
 const params=new URLSearchParams(Object.entries(s).map(([k,v])=>[k,String(v)]));history.replaceState(null,'',`${location.pathname}?${params}`);
 }catch(e){document.querySelector('#error').textContent=e.message;}}
form.addEventListener('input',()=>update());form.addEventListener('change',()=>update(true));form.addEventListener('submit',e=>e.preventDefault());
document.querySelector('#reset').onclick=()=>{sortBy='resolution';sortDirection='asc';synchrotron=false;reflectSpectrum();reflectSort();selectionOpen=false;reflectSelection();for(const [k,v]of Object.entries(defaults)){const x=form.elements[k];if(x.type==='checkbox')x.checked=v;else x.value=v;}update(true);};
chart.addEventListener('click',e=>{const id=e.target.closest('[data-facility]')?.dataset.facility;if(!id)return;const r=result.rows.find(x=>x.id===id);const sens=r.rms_uJy==null?r.sensitivity_reason:`${r.rms_uJy.toPrecision(3)} µJy/beam in ${result.settings.hours} h; ${r.sensitivity.reference}.`;
 document.querySelector('#details').innerHTML=`<h2>${escape(r.name)} · ${r.category}</h2><p>${r.participating_antennas} participating antennas/stations; ${r.baselines} baselines. ${result.settings.allSky?'Visibility not screened.':`${r.visible_hours.toFixed(2)} h continuous common visibility above ${r.effective_elevation_deg}°.`}</p>${r.participating_stations.length?`<p>Stations: ${escape(r.participating_stations.join(', '))}.</p>`:''}<p>Sensitivity reference (unscaled): ${escape(sens)}</p>${result.settings.synchrotron?`<p>Bar weighted for Sν ∝ ν⁻⁰·⁶ at a 1 GHz reference, using this setup’s ${r.sensitivity.frequency_GHz??'unspecified'} GHz frequency. This assumes the same power law applies across the compared frequencies.</p>`:''}<p>${r.bands.map(b=>`${escape(b.label)}: ${b.frequency_GHz} GHz / ${b.resolution_arcsec.toPrecision(3)}″`).join(' · ')}</p>${r.warnings.map(w=>`<p>${escape(w)}</p>`).join('')}${r.excluded_bands?.length?`<p>Unavailable bands: ${r.excluded_bands.map(b=>`${escape(b.label)} — ${escape(b.reason)}`).join('; ')}</p>`:''}<p>References: ${r.sources.map((u,i)=>`<a href="${escape(u)}" target="_blank" rel="noopener">Source ${i+1}</a>`).join(' · ')}</p>`;
});
function save(content,type,name){const u=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
document.querySelector('#svg').onclick=()=>save(renderSVG(result,currentTheme()),'image/svg+xml','radio-array-explorer.svg');
document.querySelector('#csv').onclick=()=>{const rows=[['catalogue_version','facility','category','frequency_GHz','resolution_arcsec','time_days','antennas','baselines','N_squared','rms_uJy','exposure_hours','sensitivity_reference','sensitivity_frequency_GHz','synchrotron_weighting','equivalent_1GHz_rms_uJy','display_proxy_rms_uJy'],...result.rows.flatMap(r=>r.bands.map(b=>[result.data_version,r.name,r.category,b.frequency_GHz,b.resolution_arcsec,b.time_days,r.participating_antennas,r.baselines,r.quality,r.rms_uJy??'',result.settings.hours,r.sensitivity.reference,r.sensitivity.frequency_GHz??'',result.settings.synchrotron,r.synchrotron_rms_1GHz_uJy??'',r.sensitivity_proxy_rms_uJy??'']))];save(rows.map(row=>row.map(x=>'"'+String(x).replaceAll('"','""')+'"').join(',')).join('\r\n'),'text/csv','radio-array-explorer.csv');};
document.querySelector('#png').onclick=async()=>{const svg=renderSVG(result,currentTheme()),url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));try{const img=new Image();img.src=url;await img.decode();const c=document.createElement('canvas');c.width=img.width*2;c.height=img.height*2;c.getContext('2d').drawImage(img,0,0,c.width,c.height);c.toBlob(blob=>{if(blob)save(blob,'image/png','radio-array-explorer.png');});}finally{URL.revokeObjectURL(url);}};
document.querySelector('#share').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);document.querySelector('#share').textContent='Link copied';setTimeout(()=>document.querySelector('#share').textContent='Copy link',2000);}catch{document.querySelector('#error').textContent='Copy the address from your browser to share these settings.';}};
document.querySelector('#frequency-legend').innerHTML=[.05,.15,1,5,22,100,1000].map(f=>`<span><i class="swatch" style="background:${frequencyColor(f)}"></i>${f}</span>`).join('');
document.querySelector('#version').textContent=`Catalogue ${catalogue.data_version} · Reference data reviewed ${catalogue.reviewed_on} · Local planning preview`;
update(true);
