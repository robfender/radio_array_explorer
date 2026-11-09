"""Standalone renderer. All catalogue/visibility/ranking calculations use web/core.mjs."""
from pathlib import Path
import csv
import json
import subprocess
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.colors import LogNorm
from matplotlib.cm import ScalarMappable

ROOT = Path(__file__).resolve().parent

def calculate(dec=None, category='all', **options):
    if category not in {'all', 'real_only'}:
        raise ValueError('category must be all or real_only')
    settings = dict(allSky=dec is None, declination=40 if dec is None else dec,
                    includeFuture=category == 'all', **options)
    return json.loads(subprocess.check_output(
        ['node', str(ROOT/'scripts/evaluate.mjs'), json.dumps(settings)], text=True))

def selected(dec):
    """Compatibility for the paused ejecta model; calculations remain in shared core."""
    return [(r['name'], [(b['frequency_GHz'], b['resolution_arcsec']) for b in r['bands']])
            for r in calculate(dec)['rows']]

def draw(dec, suffix, metric='antennas', category='all', output_dir=None, **options):
    if metric != 'antennas':
        raise ValueError('Image quality uses antenna count squared, not baseline count squared')
    result = calculate(dec, category, **options)
    data = result['rows']; settings = result['settings']
    fig, (ax, aq, asen) = plt.subplots(1, 3, figsize=(18, 9),
        gridspec_kw={'width_ratios': [5, 1.5, 1.5]})
    ys = np.arange(len(data))
    for y, r in zip(ys, data):
        for b in r['bands']:
            f, beam = b['frequency_GHz'], b['resolution_arcsec']
            ax.scatter(beam, y, c=[f], cmap='turbo', norm=LogNorm(.05, 1000), s=68,
                       edgecolor='black', linewidth=.4, zorder=3)
            ax.plot([beam, beam], [y-.18, y+.18], color='black', lw=1)
    coarsest=max([100]+[b['resolution_arcsec'] for r in data for b in r['bands']])
    max_scale=10**np.ceil(np.log10(coarsest))
    finest=min([.0001]+[b['resolution_arcsec'] for r in data for b in r['bands']])
    min_scale=10**np.floor(np.log10(finest))
    ax.set(xscale='log', xlim=(min_scale,max_scale), ylim=(len(data)-.3,-.7))
    ax.set_yticks(ys, [r['name']+(' *' if r['subset'] else '') for r in data])
    ax.set_xlabel('Nominal angular resolution (arcsec; smaller = finer detail)')
    motion = settings['properMotion']/1000
    ta = ax.secondary_xaxis('bottom', functions=(lambda a:a/motion,lambda d:d*motion))
    ta.spines['bottom'].set_position(('outward',58))
    ta.set_xticks([.01,.1,1,10,100,1000], ['0.01','0.1','1','10','100','1000'])
    ta.set_xlabel(f"Time to reach angular scale (days) at {settings['properMotion']:g} mas/day",fontsize=10)
    ax.grid(axis='x',which='both',alpha=.25)
    ax.set_title(result['ordering']['title'],fontsize=14)
    aq.set(xscale='log',xlim=(.6,1e7),ylim=ax.get_ylim(),yticks=[])
    aq.set_title('Proxy for image quality\nN_antennas²',fontsize=10)
    for y,r in zip(ys,data):
        aq.barh(y,r['quality']-.6,left=.6,height=.38,color='#64748b')
    aq.set_xticks([1,1e2,1e4,1e6]);aq.grid(axis='x',alpha=.2)
    asen.set_title('Proxy for sensitivity',fontsize=10)
    asen.set(xscale='log',xlim=(10000,1/3),ylim=ax.get_ylim(),yticks=[])
    for y,r in zip(ys,data):
        rms = r['sensitivity_proxy_rms_uJy']
        if rms is None:
            asen.text(.5,y,'Not estimated',transform=asen.get_yaxis_transform(),ha='center',va='center',fontsize=7)
        else:
            asen.barh(y,rms-10000,left=10000,height=.38,color='#327d83',edgecolor='#245c60',linewidth=.4,
                      hatch='///' if r['sensitivity']['provisional'] else None)
    if settings['synchrotron']:
        asen.set_xticks([])
        asen.set_xlabel('Synchrotron-weighted proxy\n1 GHz reference; Sν ∝ ν⁻⁰·⁶',fontsize=9)
    else:
        asen.set_xticks([1000,100,10,1],['1000','100','10','1'])
        asen.set_xlabel(f"{settings['hours']:g}-hour rms (µJy/beam)\nLower rms →",fontsize=9)
    asen.grid(axis='x',alpha=.2)
    cb=fig.colorbar(ScalarMappable(norm=LogNorm(.05,1000),cmap='turbo'),ax=ax,pad=.02)
    cb.set_label('Observing frequency (GHz; log scale)')
    note=(f"Catalogue {result['data_version']}. N² is an approximate count proxy. Sensitivity uses one reference setup per array, not necessarily a plotted beam.\n"
          'Hatched sensitivity bars are provisional. Noise is thermal-equivalent; no calibration/confusion floor. Planned facilities are projections.\n'
          '* Station subset: nominal beams scaled by physical baseline extent, not projected beam synthesis. Subset sensitivity is not estimated.\n')
    if dec is not None:
        note+=f"Dec {dec:+g}°: ≥{settings['hours']:g} continuous h above {settings['elevation']:g}°; VLBI needs ≥3 simultaneous stations. FAST Core Array enforces ≥50°; LOFAR International uses Dutch-core screening."
    else:
        note+='All-sky reference: visibility screening off. See web interface for sources and assumptions.'
    fig.text(.02,.015,note,fontsize=8)
    fig.tight_layout(rect=[0,.15,1,1])
    folder=Path(output_dir) if output_dir else ROOT/'outputs';folder.mkdir(parents=True,exist_ok=True)
    out=folder/('radio_array_resolution'+suffix+'_'+category)
    fig.savefig(str(out)+'.png',dpi=200);fig.savefig(str(out)+'.pdf');plt.close(fig)
    Path(str(out)+'.json').write_text(json.dumps(result,indent=2))
    with open(str(out)+'.csv','w') as file:
        w=csv.writer(file);w.writerow(['array','category','frequency_GHz','resolution_arcsec','time_days','antennas','baselines','antenna_count_squared','rms_uJy','exposure_hours','synchrotron_weighting','sensitivity_proxy_rms_uJy'])
        for r in data:
            for b in r['bands']:
                w.writerow([r['name'],r['category'],b['frequency_GHz'],b['resolution_arcsec'],b['time_days'],r['participating_antennas'],r['baselines'],r['quality'],r['rms_uJy'],settings['hours'],settings['synchrotron'],r['sensitivity_proxy_rms_uJy']])
    return result

if __name__ == '__main__':
    for dec,suffix in [(None,''),(40,'_dec_plus40'),(-40,'_dec_minus40')]:
        for category in ['all','real_only']:
            draw(dec,suffix,category=category)
