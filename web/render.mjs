export const escape=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function frequencyColor(f) {const t=Math.max(0,Math.min(1,Math.log(f/.05)/Math.log(1000/.05)));return `hsl(${265-265*t},75%,48%)`;}
export function renderSVG(result, theme='light') {
 const dark=theme==='dark';
 const title=escape(result.ordering?.title||'Major radio facilities ranked by angular resolution');
 const palette=dark?{bg:'#162333',text:'#e1eaf4',stripe:'#1c2d40',grid:'#304358',quality:'#9badc5',sensitivity:'#58b8b4',edge:'#b9cbdc'}:{bg:'#ffffff',text:'#26374b',stripe:'#f5f8fb',grid:'#e2e8ef',quality:'#71839b',sensitivity:'#237f81',edge:'#182b40'};
 const {rows,settings:s}=result,W=1380,H=245+rows.length*39,L=295,A=600,Q=170,G=40,XQ=L+A+35,XS=XQ+Q+G,top=92,bottom=top+rows.length*39;
 const maxExponent=Math.max(2,Math.ceil(Math.log10(Math.max(100,...rows.flatMap(r=>r.bands.map(b=>b.resolution_arcsec))))));
 const minExponent=Math.min(-4,Math.floor(Math.log10(Math.min(.0001,...rows.flatMap(r=>r.bands.map(b=>b.resolution_arcsec))))));
 const ax=x=>L+(Math.log10(x)-minExponent)/(maxExponent-minExponent)*A,qx=x=>Math.log10(Math.max(1,x))/7*Q,sx=x=>(4-Math.log10(Math.max(1/3,x)))/(4-Math.log10(1/3))*Q;
 let out=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${title}"><style>text{font-family:Arial,sans-serif;fill:${palette.text};font-size:12px}.small{font-size:11px}.head{font-size:13px;font-weight:600}</style><rect width="100%" height="100%" fill="${palette.bg}"/><text x="${L}" y="25" font-size="18" style="font-size:18px;font-weight:600">${title}</text><text class="head" x="${XQ+Q/2}" y="49" text-anchor="middle">Proxy for image quality</text><text x="${XQ+Q/2}" y="67" text-anchor="middle">N_antennas²</text><text class="head" x="${XS+Q/2}" y="49" text-anchor="middle">Proxy for sensitivity</text>`;
 for(let i=minExponent;i<=maxExponent;i++){const x=ax(10**i);out+=`<path d="M${x} ${top-10}V${bottom}" stroke="${palette.grid}"/><text x="${x}" y="${bottom+19}" text-anchor="middle">${10**i}</text><text class="small" x="${x}" y="${bottom+67}" text-anchor="middle">${(10**i*1000/s.properMotion).toPrecision(2).replace(/\.0(?=e|$)/,'')}</text>`;}
 for(const n of [1,100,10000,1000000]) {const x=XQ+qx(n);out+=`<path d="M${x} ${top-10}V${bottom}" stroke="${palette.grid}"/><text class="small" x="${x}" y="${bottom+19}" text-anchor="middle">10<tspan baseline-shift="super" font-size="8">${Math.log10(n)}</tspan></text>`;}
 out+='<g data-panel="sensitivity-axis">';
 for(const n of [1000,100,10,1]){const x=XS+sx(n);out+=`<path d="M${x} ${top-10}V${bottom}" stroke="${palette.grid}"/>${s.synchrotron?'':`<text class="small" x="${x}" y="${bottom+19}" text-anchor="middle">${n}</text>`}`;}
 out+='</g>';
 rows.forEach((r,i)=>{const y=top+i*39+9,title=escape(`${r.name}; ${r.participating_antennas} antennas; ${r.visible_hours.toFixed(2)} h common visibility. ${r.subset?'Subset; beam scaled by physical baseline extent.':''}`);
 out+=`<g data-facility="${escape(r.id)}"><title>${title}</title><rect x="10" y="${y-17}" width="${W-20}" height="36" fill="${i%2?palette.stripe:palette.bg}"/><text x="${L-15}" y="${y+4}" text-anchor="end">${escape(r.name.replace(' (exclude 108 km outlier)',''))}${r.category==='future'?' †':''}${r.subset?' *':''}</text>`;
 for(const b of r.bands){const x=ax(b.resolution_arcsec);out+=`<rect x="${x-3}" y="${y-10}" width="6" height="20" rx="2" fill="${frequencyColor(b.frequency_GHz)}" stroke="${palette.edge}" stroke-width=".45"><title>${escape(r.name)} — ${escape(b.label)}: ${b.frequency_GHz} GHz; ${b.resolution_arcsec.toPrecision(3)} arcsec; ${b.time_days.toPrecision(3)} days; ${b.participating_antennas??r.participating_antennas} antennas/stations</title></rect>`;}
 out+=`<rect x="${XQ}" y="${y-7}" width="${qx(r.quality)}" height="14" rx="2" fill="${palette.quality}"><title>${r.participating_antennas} antennas; N² = ${r.quality}; ${r.baselines} baselines</title></rect>`;
 const proxy=r.sensitivity_proxy_rms_uJy;
 if(proxy!==null) out+=`<rect x="${XS}" y="${y-7}" width="${sx(proxy)}" height="14" rx="2" fill="${palette.sensitivity}" ${r.sensitivity.provisional?'opacity=".55"':''}><title>${s.synchrotron?'Synchrotron-weighted proxy, referenced to 1 GHz; instrument rms numbers hidden':`${r.rms_uJy.toPrecision(3)} µJy/beam in ${s.hours} h; ${escape(r.sensitivity.reference)}`}${r.sensitivity.provisional?'; provisional':''}</title></rect>`;
 else out+=`<text class="small" x="${XS+Q/2}" y="${y+4}" text-anchor="middle">Not estimated</text>`;
 out+='</g>';});
 out+=`<text x="${L+A/2}" y="${bottom+40}" text-anchor="middle">Nominal angular resolution (arcsec; smaller = finer detail)</text><text x="${L+A/2}" y="${bottom+89}" text-anchor="middle">Time to reach scale (days) at ${s.properMotion} mas/day</text><text class="small" x="${XS+Q/2}" y="${bottom+40}" text-anchor="middle">${s.synchrotron?'Synchrotron-weighted proxy':`${s.hours}-hour rms (µJy/beam)`}</text><text class="small" x="${XS+Q/2}" y="${bottom+57}" text-anchor="middle">${s.synchrotron?'1 GHz reference · Sν ∝ ν⁻⁰·⁶':'Lower rms →'}</text><text class="small" x="20" y="${H-15}">† Future facility · * Station subset: approximate baseline scaling · Faded sensitivity: provisional · Catalogue ${escape(result.data_version)}</text></svg>`;
 return out;
}
