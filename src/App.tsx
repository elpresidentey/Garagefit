import { useEffect, useMemo, useRef, useState } from 'react';
import { VEHICLES, DATA_STAMP, DEFAULT_BASELINE_ID } from './data';
import { CarGlyph } from './icons';
import type { FilterState, SortKey, Vehicle } from './types';

const FUELS = ['Gasoline', 'Hybrid', 'PHEV', 'EV', 'Hydrogen'];
const BODIES = [...new Set(VEHICLES.map((v) => v.body))];
const MAKES = [...new Set(VEHICLES.map((v) => v.make))].sort();
const SAFETY_SCORE: Record<string, number> = { 'TSP+': 3, TSP: 2, '—': 0 };
const money = (n: number) => '$' + Math.round(n).toLocaleString();
const byId = (id: string | null) => VEHICLES.find((v) => v.id === id) ?? null;
// Width fit-bar scale (mirrors-out inches across the catalog).
const WMIN = 69, WMAX = 98;
const wPct = (w: number) => Math.min(100, Math.max(0, ((w - WMIN) / (WMAX - WMIN)) * 100)).toFixed(1);
/** Magnitude of the relative difference, e.g. "12%". Direction comes from the pill. */
function pctDiff(v: number, base: number): string {
  if (!base || v === base) return '';
  const p = Math.abs(((v - base) / base) * 100);
  return `${p >= 10 ? Math.round(p) : p.toFixed(1)}%`;
}

const PRESETS: { id: string; label: string; fn: (v: Vehicle) => boolean }[] = [
  { id: 'ev50', label: '⚡ EVs under $50k', fn: (v) => v.fuel === 'EV' && v.msrp < 50000 },
  { id: 'fam', label: '👨‍👩‍👧 Family SUVs', fn: (v) => (v.body === 'SUV' || v.body === 'Minivan') && v.seats >= 7 },
  { id: 'safe', label: '🛡️ Top Safety', fn: (v) => v.safety === 'TSP+' || v.safety === 'TSP' },
  { id: 'fueleff', label: '🌿 40+ MPG(e)', fn: (v) => v.eff >= 40 },
  { id: 'lrev', label: '🔋 Long-range EVs 250mi+', fn: (v) => v.fuel === 'EV' && (v.rangeMi ?? 0) >= 250 },
  { id: 'hands', label: '🛣️ Hands-free', fn: (v) => v.handsFree },
  { id: 'compact', label: '🅿️ Compact ≤78″', fn: (v) => v.widthExtended <= 78 },
];

function readURL(): Partial<FilterState> {
  const p = new URLSearchParams(location.search);
  const out: Partial<FilterState> = {};
  const b = p.get('b');
  if (b && byId(b)) out.baselineId = b;
  if (p.get('q')) out.q = p.get('q')!;
  if (p.get('preset')) out.preset = p.get('preset')!;
  if (p.get('sort')) out.sort = p.get('sort') as SortKey;
  if (p.get('view') === 'table' || p.get('view') === 'cards') out.view = p.get('view') as 'cards' | 'table';
  if (p.get('maxPrice')) out.maxPrice = +p.get('maxPrice')!;
  if (p.get('minYear')) out.minYear = +p.get('minYear')!;
  if (p.get('maxWidth')) out.maxWidth = +p.get('maxWidth')!;
  (['narrowOnly', 'topSafety', 'handsFree'] as const).forEach((k) => { if (p.get(k) === '1') (out as Record<string, unknown>)[k] = true; });
  if (p.get('fuels')) out.fuels = p.get('fuels')!.split(',');
  if (p.get('bodies')) out.bodies = p.get('bodies')!.split(',');
  if (p.get('make')) out.make = p.get('make')!;
  if (p.get('minEff')) out.minEff = +p.get('minEff')!;
  return out;
}

const DEFAULTS: FilterState = {
  baselineId: DEFAULT_BASELINE_ID, q: '', preset: '', sort: 'fit', view: 'cards',
  maxPrice: 80000, minYear: 2019, maxWidth: 98, narrowOnly: false,
  topSafety: false, handsFree: false, fuels: [], bodies: [], make: '', minEff: 0,
};

function Delta({ kind, v, b }: { kind: 'msrp' | 'eff' | 'width' | 'seats' | 'safety'; v: number | string; b: number | string }) {
  let cls = 'same', label = '= same';
  if (kind === 'msrp' && typeof v === 'number' && typeof b === 'number') {
    const d = v - b;
    if (d === 0) label = '= same price';
    else if (d < 0) { cls = 'good'; label = `▲ ${money(-d)} cheaper`; }
    else { cls = 'bad'; label = `▼ ${money(d)} more`; }
  } else if (kind === 'eff' && typeof v === 'number' && typeof b === 'number') {
    const d = v - b;
    if (d === 0) label = '= same';
    else if (d > 0) { cls = 'good'; label = `▲ +${d} better`; }
    else { cls = 'bad'; label = `▼ ${d} worse`; }
  } else if (kind === 'width' && typeof v === 'number' && typeof b === 'number') {
    const d = +(v - b).toFixed(1);
    if (d === 0) label = '= same width';
    else if (d < 0) { cls = 'good'; label = `▲ ${d}″ narrower`; }
    else { cls = 'bad'; label = `▼ +${d}″ wider`; }
  } else if (kind === 'seats' && typeof v === 'number' && typeof b === 'number') {
    const d = v - b;
    if (d === 0) label = '= seats';
    else if (d > 0) { cls = 'good'; label = `▲ +${d} seats`; }
    else { cls = 'bad'; label = `▼ ${d} seats`; }
  } else if (kind === 'safety') {
    const a = SAFETY_SCORE[String(v)] ?? 0, c = SAFETY_SCORE[String(b)] ?? 0;
    if (a === c) label = String(v) || '—';
    else if (a > c) { cls = 'good'; label = `▲ ${v} better`; }
    else { cls = 'bad'; label = `▼ ${v} worse`; }
  }
  return <span className={`pill ${cls}`}>{label}</span>;
}

function Modal({ label, onClose, children }: { label: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const prev = useRef<HTMLElement | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    prev.current = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); closeRef.current(); return; }
      if (e.key !== 'Tab' || !ref.current) return;
      const items = [...ref.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
        .filter((i) => !i.hasAttribute('disabled') && i.tabIndex !== -1);
      if (!items.length) { e.preventDefault(); return; }
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prevOverflow;
      prev.current?.focus?.();
    };
  }, []);
  return (
    <div className="modal" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className="sheet" role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}>
        {children}
      </div>
    </div>
  );
}

// Cost assumptions for the fuel-cost estimate (shown as a footnote in the UI).
const MILES_YR = 12000, GAS_PRICE = 3.5, ELEC_PRICE = 0.17, KWH_PER_GAL = 33.7;
/** Estimated annual fuel/charging cost, or null when it can't be fairly computed (H2, blended PHEV). */
function annualFuel(v: Vehicle): number | null {
  if (!v.eff) return null;
  if (v.fuel === 'EV') return ((MILES_YR / v.eff) * KWH_PER_GAL * ELEC_PRICE);
  if (v.fuel === 'Hydrogen' || v.fuel === 'PHEV') return null;
  if (v.effUnit === 'MPGe') return null;
  return (MILES_YR / v.eff) * GAS_PRICE;
}
/** Annual fuel volume: gallons for MPG vehicles, kWh for EVs, else null. */
function annualEnergy(v: Vehicle): { amount: number; unit: string } | null {
  if (!v.eff) return null;
  if (v.fuel === 'EV') return { amount: (MILES_YR / v.eff) * KWH_PER_GAL, unit: 'kWh' };
  if (v.fuel === 'Hydrogen' || v.fuel === 'PHEV' || v.effUnit === 'MPGe') return null;
  return { amount: MILES_YR / v.eff, unit: 'gal' };
}
/** Annual tailpipe+charging CO₂ in metric tons (US avg grid for EVs), else null. */
function annualCO2(v: Vehicle): number | null {
  const e = annualEnergy(v);
  if (!e) return null;
  return e.unit === 'gal' ? (e.amount * 8.89) / 1000 : (e.amount * 0.39) / 1000;
}
/** 5-yr ownership sketch: depreciation (55% of MSRP) + 5× fuel, when computable. */
function fiveYear(v: Vehicle): { depr: number; fuel: number | null; total: number | null } {
  const depr = v.msrp * 0.55;
  const f = annualFuel(v);
  return { depr, fuel: f == null ? null : f * 5, total: f == null ? null : depr + f * 5 };
}
/** Percentile context across the catalog (same-unit peers for efficiency). */
function percentiles(v: Vehicle): { cheaperThan: number; efficientThan: number; narrowerThan: number; peerN: number } {
  const cheaperThan = Math.round((VEHICLES.filter((x) => x.msrp > v.msrp).length / VEHICLES.length) * 100);
  const peers = VEHICLES.filter((x) => x.effUnit === v.effUnit);
  const efficientThan = Math.round((peers.filter((x) => x.eff < v.eff).length / Math.max(1, peers.length)) * 100);
  const narrowerThan = Math.round((VEHICLES.filter((x) => x.widthExtended > v.widthExtended).length / VEHICLES.length) * 100);
  return { cheaperThan, efficientThan, narrowerThan, peerN: peers.length };
}

function verdict(v: Vehicle, b: Vehicle | null): string | null {
  if (!b || v.id === b.id) return null;
  let good = 0, bad = 0;
  if (v.msrp !== b.msrp) (v.msrp < b.msrp ? good++ : bad++);
  if (v.eff !== b.eff) (v.eff > b.eff ? good++ : bad++);
  if (v.widthExtended !== b.widthExtended) (v.widthExtended < b.widthExtended ? good++ : bad++);
  if (v.seats !== b.seats) (v.seats > b.seats ? good++ : bad++);
  const s = (SAFETY_SCORE[v.safety] ?? 0) - (SAFETY_SCORE[b.safety] ?? 0);
  if (s !== 0) (s > 0 ? good++ : bad++);
  const fit = v.widthExtended <= b.widthExtended
    ? `At ${v.widthExtended}″ mirrors-out, it fits anywhere your ${b.model} fits.`
    : `It needs ${(v.widthExtended - b.widthExtended).toFixed(1)}″ more clearance than your ${b.model} — measure the garage.`;
  if (!good && !bad) return `Matches your ${b.model} on every headline dimension. ${fit}`;
  const parts = [];
  if (good) parts.push(`${good} upgrade${good > 1 ? 's' : ''}`);
  if (bad) parts.push(`${bad} trade-off${bad > 1 ? 's' : ''}`);
  return `${parts.join(' and ')} vs your ${b.year} ${b.make} ${b.model}. ${fit}`;
}

export default function App() {
  const [f, setF] = useState<FilterState>(() => {
    const saved = localStorage.getItem('gf-state-v1');
    const base = saved ? { ...DEFAULTS, ...JSON.parse(saved) } : DEFAULTS;
    return { ...base, ...readURL() };
  });
  const [favs, setFavs] = useState<string[]>(() => JSON.parse(localStorage.getItem('gf-favs') || '[]'));
  const [compare, setCompare] = useState<string[]>([]);
  const [shown, setShown] = useState(24);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [colsOpen, setColsOpen] = useState(false);
  const [cols, setCols] = useState({ price: true, eff: true, seats: true, width: true, safety: true, fuel: true });
  const [detail, setDetail] = useState<Vehicle | null>(null);
  const [cmpOpen, setCmpOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [dark, setDark] = useState(localStorage.getItem('gf-theme') === 'dark');
  const [offline, setOffline] = useState(!navigator.onLine);
  const [swUpdate, setSwUpdate] = useState(false);
  useEffect(() => {
    const on = () => setSwUpdate(true);
    window.addEventListener('gf:sw-update', on);
    return () => window.removeEventListener('gf:sw-update', on);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    localStorage.setItem('gf-theme', dark ? 'dark' : 'light');
  }, [dark]);
  useEffect(() => {
    const on = () => setOffline(!navigator.onLine);
    window.addEventListener('online', on); window.addEventListener('offline', on);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', on); };
  }, []);

  // Section scrollspy + back-to-top visibility
  const [showTop, setShowTop] = useState(false);
  const [activeSec, setActiveSec] = useState('');
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setShowTop(window.scrollY > 700);
        const marks = ['baseline', 'browse', 'results'].map((id) => {
          const el = document.getElementById(id);
          return { id, d: el ? Math.abs(el.getBoundingClientRect().top - 160) : Number.POSITIVE_INFINITY };
        });
        marks.sort((a, b) => a.d - b.d);
        if (marks[0] && marks[0].d < 600) setActiveSec(marks[0].id);
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, []);
  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  useEffect(() => {
    localStorage.setItem('gf-state-v1', JSON.stringify(f));
    localStorage.setItem('gf-favs', JSON.stringify(favs));
    if (f.baselineId) localStorage.setItem('gf-base', f.baselineId);
    const p = new URLSearchParams();
    if (f.baselineId) p.set('b', f.baselineId);
    if (f.q) p.set('q', f.q);
    if (f.preset) p.set('preset', f.preset);
    if (f.sort !== 'fit') p.set('sort', f.sort);
    if (f.view !== 'cards') p.set('view', f.view);
    p.set('maxPrice', String(f.maxPrice)); p.set('minYear', String(f.minYear)); p.set('maxWidth', String(f.maxWidth));
    if (f.narrowOnly) p.set('narrowOnly', '1');
    if (f.topSafety) p.set('topSafety', '1');
    if (f.handsFree) p.set('handsFree', '1');
    if (f.fuels.length) p.set('fuels', f.fuels.join(','));
    if (f.bodies.length) p.set('bodies', f.bodies.join(','));
    if (f.make) p.set('make', f.make);
    if (f.minEff) p.set('minEff', String(f.minEff));
    history.replaceState(null, '', '?' + p.toString());
  }, [f, favs]);

  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(''), 2200); return () => clearTimeout(t); } }, [toast]);

  const baseline = byId(f.baselineId);

  const results = useMemo(() => {
    const fitScore = (v: Vehicle) => {
      if (!baseline) return 0;
      let s = 0;
      s += (baseline.msrp - v.msrp) / 5000;
      s += (v.eff - baseline.eff) / 10;
      s += (baseline.widthExtended - v.widthExtended) * 2;
      if ((SAFETY_SCORE[v.safety] ?? 0) > (SAFETY_SCORE[baseline.safety] ?? 0)) s += 2;
      return -s;
    };
    const sorts: Record<SortKey, (a: Vehicle, b: Vehicle) => number> = {
      'price-asc': (a, b) => a.msrp - b.msrp, 'price-desc': (a, b) => b.msrp - a.msrp,
      'eff-desc': (a, b) => b.eff - a.eff, 'year-desc': (a, b) => b.year - a.year,
      'safety-desc': (a, b) => (SAFETY_SCORE[b.safety] ?? 0) - (SAFETY_SCORE[a.safety] ?? 0),
      'width-asc': (a, b) => a.widthExtended - b.widthExtended, fit: (a, b) => fitScore(b) - fitScore(a),
    };
    const r = VEHICLES.filter((v) => {
      if (f.q && !(v.make + ' ' + v.model + ' ' + v.trim + ' ' + v.year).toLowerCase().includes(f.q.toLowerCase())) return false;
      if (v.msrp > f.maxPrice || v.year < f.minYear || v.widthExtended > f.maxWidth) return false;
      if (f.narrowOnly && baseline && v.widthExtended > baseline.widthExtended) return false;
      if (f.topSafety && !(v.safety === 'TSP' || v.safety === 'TSP+')) return false;
      if (f.handsFree && !v.handsFree) return false;
      if (f.fuels.length && !f.fuels.includes(v.fuel)) return false;
      if (f.bodies.length && !f.bodies.includes(v.body)) return false;
      if (f.make && v.make !== f.make) return false;
      if (v.eff < f.minEff) return false;
      const pr = PRESETS.find((p) => p.id === f.preset);
      if (pr && !pr.fn(v)) return false;
      return true;
    });
    return r.sort(sorts[f.sort]);
  }, [f, baseline]);

  const patch = (p: Partial<FilterState>) => { setF((s) => ({ ...s, ...p })); setShown(24); };
  const toggleCmp = (id: string) => {
    setCompare((c) => {
      if (c.includes(id)) return c.filter((x) => x !== id);
      if (c.length >= 4) { setToast('Compare tray holds up to 4'); return c; }
      return [...c, id];
    });
  };
  const share = async () => {
    try { await navigator.clipboard.writeText(location.href); setToast('Share link copied ✓'); }
    catch { prompt('Copy link:', location.href); }
  };
  const exportCSV = () => {
    const head = 'year,make,model,trim,body,seats,fuel,eff,effUnit,msrp,widthFolded,widthExtended,safety';
    const rows = results.map((v) => [v.year, v.make, v.model, '"' + v.trim + '"', v.body, v.seats, v.fuel, v.eff, v.effUnit, v.msrp, v.widthFolded, v.widthExtended, v.safety].join(','));
    const blob = new Blob([[head, ...rows].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'garagefit.csv'; a.click();
    setToast(`Exported ${results.length} vehicles`);
  };
  const tags: string[] = [];
  if (f.preset) tags.push(PRESETS.find((p) => p.id === f.preset)?.label ?? f.preset);
  if (f.q) tags.push(`“${f.q}”`);
  if (f.maxPrice < 80000) tags.push(`≤ ${money(f.maxPrice)}`);
  if (f.minYear > 2019) tags.push(`${f.minYear}+`);
  if (f.maxWidth < 98) tags.push(`≤ ${f.maxWidth}″`);
  if (f.topSafety) tags.push('Top safety');
  if (f.handsFree) tags.push('Hands-free');
  if (f.fuels.length) tags.push(f.fuels.join(', '));
  if (f.bodies.length) tags.push(f.bodies.join(', '));
  if (f.make) tags.push(f.make);

  const clearFilters = () => patch({ preset: '', maxPrice: 80000, minYear: 2019, maxWidth: 98, narrowOnly: false, topSafety: false, handsFree: false, make: '', minEff: 0, q: '', fuels: [], bodies: [] });

  return (
    <>
      <a className="skip" href="#results">Skip to results</a>
      {swUpdate && (
        <div className="updatebar" role="status">
          <span>New version available — reload to get the latest vehicles and fixes.</span>
          <button className="btn primary" onClick={() => (window as unknown as { __gfUpdateSW?: () => void }).__gfUpdateSW?.()}>Reload to update</button>
          <button className="btn ghost" onClick={() => setSwUpdate(false)} aria-label="Dismiss update notice">✕</button>
        </div>
      )}
      <header className="topbar">
        <div className="wrap topbar-in">
          <a className="brand" href="#results" onClick={(e) => { e.preventDefault(); jump('results'); }} style={{ textDecoration: 'none', color: 'inherit' }}>
            <span className="logo" aria-hidden="true">▣</span>
            <div><strong>GarageFit</strong><small>Find cars that actually fit your life</small></div>
          </a>
          <nav className="topnav" aria-label="Section navigation">
            <a href="#baseline" className={activeSec === 'baseline' ? 'on' : ''} aria-current={activeSec === 'baseline' ? 'true' : undefined} onClick={(e) => { e.preventDefault(); jump('baseline'); }}>Your baseline</a>
            <a href="#browse" className={activeSec === 'browse' ? 'on' : ''} aria-current={activeSec === 'browse' ? 'true' : undefined} onClick={(e) => { e.preventDefault(); jump('browse'); }}>Browse &amp; filter</a>
            <a href="#results" className={activeSec === 'results' ? 'on' : ''} aria-current={activeSec === 'results' ? 'true' : undefined} onClick={(e) => { e.preventDefault(); jump('results'); }}>Results</a>
          </nav>
          <div className="top-actions">
            {offline && <span className="pill same">● offline — cached</span>}
            <div className="searchbox"><span aria-hidden="true">⌕</span><label className="sr-only" htmlFor="gf-search">Search make, model, or trim</label><input id="gf-search" value={f.q} onChange={(e) => patch({ q: e.target.value })} type="search" placeholder="Search make, model, trim…" /></div>
            <button className="btn ghost" onClick={() => setDark((d) => !d)} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} aria-pressed={dark}>◐</button>
            <button className="btn ghost" onClick={share}>⤴ <span className="btn-txt">Share</span></button>
            <button className="btn ghost" onClick={exportCSV}>⭳ <span className="btn-txt">CSV</span></button>
            <button className="btn ghost" onClick={() => window.print()} aria-label="Print this view">⎙</button>
          </div>
        </div>
      </header>

      <main className="wrap">
        <section className="baseline" id="baseline" aria-label="Your baseline vehicle">
          {baseline ? (
            <>
              <div className="b-car" aria-hidden="true"><CarGlyph body={baseline.body} />
                {baseline.imageUrl && (
                  <img
                    key={baseline.id}
                    src={baseline.imageUrl}
                    alt=""
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    onLoad={(e) => e.currentTarget.classList.add('ld')}
                    onError={(e) => e.currentTarget.remove()}
                  />
                )}
              </div>
              <div className="b-info">
                <span className="kicker">Your baseline vehicle</span>
                <h2>{baseline.year} {baseline.make} {baseline.model} <span className="sub">{baseline.trim}</span></h2>
                <p>{baseline.body} · {baseline.fuel} · {baseline.seats} seats · {baseline.legroom}″ legroom{baseline.rangeMi ? ` · ${baseline.rangeMi} mi range` : ''}</p>
                <div className="b-stats">
                  <span className="stat"><b>{money(baseline.msrp)}</b>MSRP</span>
                  <span className="stat"><b>{baseline.eff} {baseline.effUnit}</b>efficiency</span>
                  <span className="stat"><b>{baseline.widthExtended}″</b>mirrors out</span>
                  <span className="stat"><b>{baseline.widthFolded}″</b>mirrors folded</span>
                  <span className="stat"><b>{baseline.safety === '—' ? 'Not rated' : baseline.safety}</b>IIHS safety</span>
                </div>
              </div>
              <div className="b-select">
                <label className="b-label" htmlFor="gf-baseline">Comparing against</label>
                <div className="b-row">
                  <select id="gf-baseline" value={baseline.id} onChange={(e) => patch({ baselineId: e.target.value })}>
                    {VEHICLES.map((v) => <option key={v.id} value={v.id}>{v.year} {v.make} {v.model} {v.trim}</option>)}
                  </select>
                  <button className="btn ghost" onClick={() => patch({ baselineId: null })}>Clear</button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="b-info"><span className="kicker">Comparison mode</span><h2>No baseline — showing absolute values</h2><p>Pick a car you own so every row shows ▲ better / ▼ worse relative to it.</p></div>
              <div className="b-select">
                <label className="b-label" htmlFor="gf-baseline-new">Choose your baseline</label>
                <select id="gf-baseline-new" defaultValue="" onChange={(e) => e.target.value && patch({ baselineId: e.target.value })}>
                  <option value="">Choose baseline…</option>
                  {VEHICLES.map((v) => <option key={v.id} value={v.id}>{v.year} {v.make} {v.model} {v.trim}</option>)}
                </select>
              </div>
            </>
          )}
        </section>

        <div className="stickybar" id="browse">
          <div className="presets" role="toolbar" aria-label="Quick presets">{PRESETS.map((p) => <button key={p.id} className={'preset' + (f.preset === p.id ? ' on' : '')} aria-pressed={f.preset === p.id} onClick={() => patch({ preset: f.preset === p.id ? '' : p.id })}>{p.label}</button>)}</div>
          <div className="controls">
            <div className="control"><label htmlFor="gf-sort">Sort</label>
              <select id="gf-sort" value={f.sort} onChange={(e) => setF((s) => ({ ...s, sort: e.target.value as SortKey }))}>
                <option value="fit">Best fit</option><option value="price-asc">Price ↑</option>
                <option value="price-desc">Price ↓</option><option value="eff-desc">Efficiency ↓</option>
                <option value="year-desc">Newest</option><option value="safety-desc">Safest</option>
                <option value="width-asc">Narrowest</option>
              </select>
            </div>
            <div className="control seg" role="group" aria-label="Result layout">
              <button className={f.view === 'cards' ? 'seg-on' : ''} aria-pressed={f.view === 'cards'} onClick={() => setF((s) => ({ ...s, view: 'cards' }))}>▦ Cards</button>
              <button className={f.view === 'table' ? 'seg-on' : ''} aria-pressed={f.view === 'table'} onClick={() => setF((s) => ({ ...s, view: 'table' }))}>☰ Table</button>
            </div>
            <button className="btn" onClick={() => setFiltersOpen((o) => !o)} aria-expanded={filtersOpen} aria-controls="gf-filters">Filters ▾</button>
            <button className="btn ghost" onClick={() => setColsOpen((o) => !o)} aria-expanded={colsOpen} aria-controls="gf-cols">Columns</button>
          </div>
          <div className="summary">{tags.length ? tags.map((t) => <span key={t} className="tag">{t}</span>) : 'Showing everything — add a preset or filter to narrow.'}{baseline && <span className="tag">vs {baseline.model}</span>}</div>
          {filtersOpen && (
            <div className="filters" id="gf-filters">
              <div className="fgrid">
                <fieldset><legend>Year &amp; Price</legend>
                  <label htmlFor="gf-maxprice">Max price ${f.maxPrice}</label><input id="gf-maxprice" type="range" min={20000} max={120000} step={1000} value={f.maxPrice} onChange={(e) => patch({ maxPrice: +e.target.value })} />
                  <label htmlFor="gf-minyear">Min year {f.minYear}</label><input id="gf-minyear" type="range" min={2019} max={2026} value={f.minYear} onChange={(e) => patch({ minYear: +e.target.value })} />
                </fieldset>
                <fieldset><legend>Garage fit</legend>
                  <label htmlFor="gf-maxwidth">Max width (out, in) {f.maxWidth}</label><input id="gf-maxwidth" type="range" min={68} max={98} step={0.5} value={f.maxWidth} onChange={(e) => patch({ maxWidth: +e.target.value })} />
                  <label className="check"><input type="checkbox" checked={f.narrowOnly} onChange={(e) => patch({ narrowOnly: e.target.checked })} /> Fits my baseline width</label>
                </fieldset>
                <fieldset><legend>Safety &amp; assist</legend>
                  <label className="check"><input type="checkbox" checked={f.topSafety} onChange={(e) => patch({ topSafety: e.target.checked })} /> Top safety only</label>
                  <label className="check"><input type="checkbox" checked={f.handsFree} onChange={(e) => patch({ handsFree: e.target.checked })} /> Hands-free driving</label>
                </fieldset>
                <fieldset><legend>Powertrain &amp; efficiency</legend>
                  <div className="checks">{FUELS.map((x) => <label key={x}><input type="checkbox" checked={f.fuels.includes(x)} onChange={(e) => patch({ fuels: e.target.checked ? [...f.fuels, x] : f.fuels.filter((y) => y !== x) })} /> {x}</label>)}</div>
                  <label htmlFor="gf-mineff">Min efficiency {f.minEff} MPG(e)</label><input id="gf-mineff" type="range" min={0} max={140} value={f.minEff} onChange={(e) => patch({ minEff: +e.target.value })} />
                </fieldset>
                <fieldset><legend>Type &amp; make</legend>
                  <div className="checks">{BODIES.map((x) => <label key={x}><input type="checkbox" checked={f.bodies.includes(x)} onChange={(e) => patch({ bodies: e.target.checked ? [...f.bodies, x] : f.bodies.filter((y) => y !== x) })} /> {x}</label>)}</div>
                  <label className="sr-only" htmlFor="gf-make">Make</label>
                  <select id="gf-make" value={f.make} onChange={(e) => patch({ make: e.target.value })}><option value="">All makes</option>{MAKES.map((m) => <option key={m}>{m}</option>)}</select>
                </fieldset>
              </div>
              <div className="f-actions"><button className="btn ghost" onClick={clearFilters}>Clear all filters</button></div>
            </div>
          )}
          {colsOpen && <div className="cols" id="gf-cols">{(Object.keys(cols) as (keyof typeof cols)[]).map((k) => <label key={k}><input type="checkbox" checked={cols[k]} onChange={(e) => setCols((c) => ({ ...c, [k]: e.target.checked }))} /> {k}</label>)}</div>}
        </div>

        <div className="count" role="status" aria-live="polite">{results.length} of {VEHICLES.length} vehicles{baseline ? ` vs your ${baseline.year} ${baseline.make} ${baseline.model}` : ''}</div>

        {f.view === 'cards' ? (
          <>
            <section className="grid" id="results" aria-label="Vehicle results">
              {results.slice(0, shown).map((v, i) => (
                <article
                  className="card card-click" key={v.id} aria-labelledby={`t-${v.id}`}
                  style={{ animationDelay: `${Math.min(i, 11) * 35}ms` }}
                  tabIndex={0}
                  aria-label={`View closer analysis of ${v.year} ${v.make} ${v.model} ${v.trim}`}
                  onClick={() => setDetail(v)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetail(v); } }}
                >
                  <div className={`carimg fuel-${v.fuel}`}><CarGlyph body={v.body} />
                    {v.imageUrl && (
                      <img
                        className="car-photo"
                        src={v.imageUrl}
                        alt=""
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onLoad={(e) => e.currentTarget.classList.add('ld')}
                        onError={(e) => e.currentTarget.remove()}
                      />
                    )}
                    <span className="fuel">{v.fuel}{v.rangeMi ? ` · ${v.rangeMi}mi` : ''}</span>
                    <button className="fav" aria-label={favs.includes(v.id) ? `Remove ${v.make} ${v.model} from favorites` : `Add ${v.make} ${v.model} to favorites`} aria-pressed={favs.includes(v.id)} onClick={(e) => { e.stopPropagation(); setFavs((s) => s.includes(v.id) ? s.filter((x) => x !== v.id) : [...s, v.id]); }}>{favs.includes(v.id) ? '★' : '☆'}</button>
                  </div>
                  <div className="shade" aria-hidden="true"></div>
                  <div className="body">
                    <h3 id={`t-${v.id}`}>{v.year} {v.make} {v.model}</h3>
                    <div className="sub">{v.trim} · {v.body} · {v.seats} seats · {v.safety}{v.nhtsaStars ? ` · ★${v.nhtsaStars} NHTSA` : ''}</div>
                    <div className="price">{money(v.msrp)}<small> MSRP</small></div>
                    <div className="deltas">
                      {baseline ? (<><Delta kind="msrp" v={v.msrp} b={baseline.msrp} /><Delta kind="eff" v={v.eff} b={baseline.eff} /><Delta kind="width" v={v.widthExtended} b={baseline.widthExtended} /></>) : (<span className="pill same">{v.eff} {v.effUnit} · {v.widthExtended}″ wide</span>)}
                    </div>
                    <div className="fitbar">
                      <div className="track">
                        {baseline && <span className="tick" style={{ left: `${wPct(baseline.widthExtended)}%` }} title={`Baseline: ${baseline.widthExtended}″`} />}
                        <span className="dot" style={{ left: `${wPct(v.widthExtended)}%` }} title={`${v.widthExtended}″ mirrors out`} />
                      </div>
                      <div className="lbl"><span>↔ {v.widthExtended}″ wide</span>{baseline && <span>base {baseline.widthExtended}″</span>}</div>
                    </div>
                    <div className="specrow"><span>⛽ {v.eff} {v.effUnit}</span><span>↔ {v.widthExtended}″</span><span>🛡️ {v.safety}</span>{v.handsFree && <span>🛣️ hands-free</span>}</div>
                    <div className="actions">
                      <button className="btn" onClick={(e) => { e.stopPropagation(); patch({ baselineId: v.id }); setToast('Baseline set — table now shows ▲▼ vs it'); }}>Set baseline</button>
                      <button className="btn ghost" onClick={(e) => { e.stopPropagation(); setDetail(v); }}>More specs</button>
                      <button className="btn ghost" onClick={(e) => { e.stopPropagation(); toggleCmp(v.id); }}>{compare.includes(v.id) ? '✓ in tray' : '+ Compare'}</button>
                    </div>
                  </div>
                </article>
              ))}
            </section>
            {!results.length && <div className="empty">No vehicles match. <button className="btn" onClick={clearFilters}>Clear filters</button></div>}
            <div className="morewrap">{results.length > shown && <button className="btn big" onClick={() => setShown((s) => s + 24)}>Show more</button>}</div>
          </>
        ) : (
          <section className="tablewrap" aria-label="Vehicle results table"><table><caption className="sr-only">Vehicles compared against your baseline</caption><thead><tr>
            <th scope="col">Vehicle</th>{cols.price && <th scope="col">Price</th>}{cols.eff && <th scope="col">Eff.</th>}{cols.seats && <th scope="col">Seats</th>}
            {cols.width && <th scope="col">Width out</th>}{cols.safety && <th scope="col">Safety</th>}{cols.fuel && <th scope="col">Fuel</th>}<th scope="col"><span className="sr-only">Actions</span></th>
          </tr></thead><tbody>
            {results.map((v) => (
              <tr key={v.id} className="row-click" onClick={() => setDetail(v)} title={`View closer analysis of ${v.year} ${v.make} ${v.model}`}>
                <td><b>{v.year} {v.make} {v.model}</b><br /><small style={{ color: 'var(--muted)' }}>{v.trim} · {v.body}</small></td>
                {cols.price && <td>{money(v.msrp)}<br />{baseline && <Delta kind="msrp" v={v.msrp} b={baseline.msrp} />}</td>}
                {cols.eff && <td>{v.eff} {v.effUnit}<br />{baseline && <Delta kind="eff" v={v.eff} b={baseline.eff} />}</td>}
                {cols.seats && <td>{v.seats}<br />{baseline && <Delta kind="seats" v={v.seats} b={baseline.seats} />}</td>}
                {cols.width && <td>{v.widthExtended}″<br />{baseline && <Delta kind="width" v={v.widthExtended} b={baseline.widthExtended} />}</td>}
                {cols.safety && <td>{v.safety}<br />{baseline && <Delta kind="safety" v={v.safety} b={baseline.safety} />}</td>}
                {cols.fuel && <td>{v.fuel}</td>}
                <td><button className="btn" onClick={(e) => { e.stopPropagation(); patch({ baselineId: v.id }); }}>Baseline</button> <button className="btn ghost" onClick={(e) => { e.stopPropagation(); setDetail(v); }}>Specs</button></td>
              </tr>
            ))}
          </tbody></table></section>
        )}
      </main>

      {!!compare.length && (
        <div className="tray">
          <span>⚖️ {compare.map((id) => { const v = byId(id)!; return `${v.make} ${v.model}`; }).join(' · ')}</span>
          <button className="go" onClick={() => setCmpOpen(true)}>Compare ({compare.length})</button>
          <button onClick={() => setCompare([])}>Clear</button>
        </div>
      )}

      {cmpOpen && (
        <Modal label={`Side-by-side comparison of ${compare.length} vehicles`} onClose={() => setCmpOpen(false)}>
            <h2>Side-by-side ({compare.length})</h2>
            <div className="cmp">{compare.map((id) => { const v = byId(id)!; return (
              <div className="col" key={id}>
                <b>{v.year} {v.make} {v.model}</b><div><small>{v.trim}</small></div>
                <div>{money(v.msrp)} {baseline && <Delta kind="msrp" v={v.msrp} b={baseline.msrp} />}</div>
                <div>{v.eff} {v.effUnit} {baseline && <Delta kind="eff" v={v.eff} b={baseline.eff} />}</div>
                <div>{v.widthExtended}″ {baseline && <Delta kind="width" v={v.widthExtended} b={baseline.widthExtended} />}</div>
                <div>{v.seats} seats · {v.safety}</div><div>{v.fuel}{v.rangeMi ? ` · ${v.rangeMi}mi` : ''}</div>
              </div>); })}
            </div>
            <p><button className="btn" onClick={() => setCmpOpen(false)}>Close</button></p>
        </Modal>
      )}

      {detail && (
        <Modal label={`${detail.year} ${detail.make} ${detail.model} closer analysis`} onClose={() => setDetail(null)}>
          {(() => {
            const b = baseline && baseline.id !== detail.id ? baseline : null;
            const myCost = annualFuel(detail);
            const baseCost = b ? annualFuel(b) : null;
            type Cell = { label: string; mine: string; base?: string; cell?: React.ReactNode };
            const rows: Cell[] = [
              { label: 'Price (MSRP)', mine: money(detail.msrp), base: b ? money(b.msrp) : undefined,
                cell: b ? <><Delta kind="msrp" v={detail.msrp} b={b.msrp} />{pctDiff(detail.msrp, b.msrp) && <small> · {pctDiff(detail.msrp, b.msrp)}</small>}</> : undefined },
              { label: 'Efficiency', mine: `${detail.eff} ${detail.effUnit}`, base: b ? `${b.eff} ${b.effUnit}` : undefined,
                cell: b ? <><Delta kind="eff" v={detail.eff} b={b.eff} />{pctDiff(detail.eff, b.eff) && <small> · {pctDiff(detail.eff, b.eff)}</small>}</> : undefined },
              { label: 'Est. fuel cost / yr', mine: myCost != null ? money(myCost) : '—', base: baseCost != null ? money(baseCost) : undefined,
                cell: myCost != null && baseCost != null && myCost !== baseCost
                  ? (myCost < baseCost
                      ? <span className="pill good">▲ saves {money(baseCost - myCost)}/yr</span>
                      : <span className="pill bad">▼ costs {money(myCost - baseCost)} more/yr</span>)
                  : (b ? <span className="pill same">n/a</span> : undefined) },
              { label: 'Fuel type', mine: detail.fuel, base: b?.fuel,
                cell: b && b.fuel !== detail.fuel ? <span className="pill same">{b.fuel} → {detail.fuel}</span> : (b ? <span className="pill same">= same</span> : undefined) },
              ...(detail.rangeMi ? [{ label: 'EV range', mine: `${detail.rangeMi} mi` } as Cell] : []),
              { label: 'Model year', mine: `${detail.year}`, base: b ? `${b.year}` : undefined,
                cell: b && b.year !== detail.year ? <span className="pill same">{Math.abs(detail.year - b.year)} yr{Math.abs(detail.year - b.year) > 1 ? 's' : ''} {detail.year > b.year ? 'newer' : 'older'}</span> : (b ? <span className="pill same">= same</span> : undefined) },
              { label: 'Width, mirrors out', mine: `${detail.widthExtended}″`, base: b ? `${b.widthExtended}″` : undefined,
                cell: b ? <Delta kind="width" v={detail.widthExtended} b={b.widthExtended} /> : undefined },
              { label: 'Width, mirrors folded', mine: `${detail.widthFolded}″`, base: b ? `${b.widthFolded}″` : undefined },
              { label: 'Seats / doors', mine: `${detail.seats} / ${detail.doors}`, base: b ? `${b.seats} / ${b.doors}` : undefined,
                cell: b ? <Delta kind="seats" v={detail.seats} b={b.seats} /> : undefined },
              { label: 'Body type', mine: detail.body, base: b?.body,
                cell: b ? <span className="pill same">{b.body === detail.body ? '= same' : `${b.body} → ${detail.body}`}</span> : undefined },
              { label: 'Safety', mine: detail.safety, base: b?.safety,
                cell: b ? <Delta kind="safety" v={detail.safety} b={b.safety} /> : undefined },
              { label: 'NHTSA rating', mine: detail.nhtsaStars ? `${'★'.repeat(detail.nhtsaStars)}${'☆'.repeat(5 - detail.nhtsaStars)} ${detail.nhtsaStars}/5` : 'Not rated',
                base: b ? (b.nhtsaStars ? `${b.nhtsaStars}/5` : 'Not rated') : undefined,
                cell: b && detail.nhtsaStars && b.nhtsaStars
                  ? (detail.nhtsaStars === b.nhtsaStars
                      ? <span className="pill same">= same</span>
                      : detail.nhtsaStars > b.nhtsaStars
                        ? <span className="pill good">▲ +{detail.nhtsaStars - b.nhtsaStars} star{detail.nhtsaStars - b.nhtsaStars > 1 ? 's' : ''}</span>
                        : <span className="pill bad">▼ {detail.nhtsaStars - b.nhtsaStars} star{(detail.nhtsaStars - b.nhtsaStars) < -1 ? 's' : ''}</span>)
                  : (b ? <span className="pill same">n/a</span> : undefined) },
              { label: 'Front legroom', mine: `${detail.legroom}″`, base: b ? `${b.legroom}″` : undefined,
                cell: b && b.legroom !== detail.legroom
                  ? <span className="pill same">{detail.legroom > b.legroom ? `+${(detail.legroom - b.legroom).toFixed(1)}″ roomier` : `${(detail.legroom - b.legroom).toFixed(1)}″ tighter`}</span>
                  : (b ? <span className="pill same">= same</span> : undefined) },
              { label: 'Hands-free driving', mine: detail.handsFree ? 'Yes' : 'No', base: b ? (b.handsFree ? 'Yes' : 'No') : undefined,
                cell: b && b.handsFree !== detail.handsFree
                  ? (detail.handsFree ? <span className="pill good">▲ gains hands-free</span> : <span className="pill bad">▼ loses hands-free</span>)
                  : (b ? <span className="pill same">= same</span> : undefined) },
            ];
            const keys: { dir: 'up' | 'dn' | 'chg'; text: string }[] = [];
            if (b) {
              if (b.fuel !== detail.fuel) keys.push({ dir: 'chg', text: `Powertrain switch: ${b.fuel} → ${detail.fuel}` });
              if (myCost != null && baseCost != null && myCost !== baseCost) {
                const d = Math.abs(Math.round(myCost - baseCost));
                keys.push(myCost < baseCost
                  ? { dir: 'up', text: `Saves ≈ $${d.toLocaleString()}/yr in fuel (${MILES_YR.toLocaleString()} mi/yr)` }
                  : { dir: 'dn', text: `Costs ≈ $${d.toLocaleString()}/yr more in fuel` });
              }
              if (detail.msrp !== b.msrp) {
                const d = Math.abs(detail.msrp - b.msrp);
                keys.push(detail.msrp < b.msrp
                  ? { dir: 'up', text: `${money(d)} cheaper (${pctDiff(detail.msrp, b.msrp)})` }
                  : { dir: 'dn', text: `${money(d)} pricier (${pctDiff(detail.msrp, b.msrp)})` });
              }
              if (detail.widthExtended !== b.widthExtended) {
                const d = Math.abs(detail.widthExtended - b.widthExtended).toFixed(1);
                keys.push(detail.widthExtended < b.widthExtended
                  ? { dir: 'up', text: `${d}″ narrower — easier garage fit` }
                  : { dir: 'dn', text: `${d}″ wider — check garage clearance` });
              }
              if (detail.seats !== b.seats) keys.push(detail.seats > b.seats ? { dir: 'up', text: `+${detail.seats - b.seats} seats` } : { dir: 'dn', text: `${detail.seats - b.seats} seats` });
              const s = (SAFETY_SCORE[detail.safety] ?? 0) - (SAFETY_SCORE[b.safety] ?? 0);
              if (s !== 0) keys.push(s > 0 ? { dir: 'up', text: `Safety step up (${b.safety} → ${detail.safety})` } : { dir: 'dn', text: `Safety step down (${b.safety} → ${detail.safety})` });
              if (detail.handsFree !== b.handsFree) keys.push(detail.handsFree ? { dir: 'up', text: 'Gains hands-free driving' } : { dir: 'dn', text: 'Loses hands-free driving' });
              if (detail.eff !== b.eff) keys.push(detail.eff > b.eff ? { dir: 'up', text: `+${detail.eff - b.eff} ${detail.effUnit} efficiency` } : { dir: 'dn', text: `${detail.eff - b.eff} ${detail.effUnit} efficiency` });
            }
            const v = verdict(detail, baseline);
            const my5 = fiveYear(detail);
            const base5 = b ? fiveYear(b) : null;
            const myCO2 = annualCO2(detail);
            const baseCO2 = b ? annualCO2(b) : null;
            const myKwh = annualEnergy(detail);
            const pct = percentiles(detail);
            const sibs = VEHICLES.filter((x) => x.make === detail.make && x.model === detail.model && x.id !== detail.id).slice(0, 6);
            return (
              <>
                {detail.imageUrl && (
                  <div className="d-photo">
                    <img src={detail.imageUrl} alt={`${detail.year} ${detail.make} ${detail.model}`} onError={(e) => e.currentTarget.closest('.d-photo')?.remove()} />
                    <span className="fuel">{detail.fuel}{detail.rangeMi ? ` · ${detail.rangeMi}mi` : ''}</span>
                  </div>
                )}
                <span className="kicker">Closer analysis{detail.verified ? ' · ✓ specs verified' : ''}</span>
                <h2>{detail.year} {detail.make} {detail.model} <small style={{ color: 'var(--muted)' }}>{detail.trim}</small></h2>
                <p className="d-sub">{detail.body} · {detail.doors} doors · {detail.seats} seats · {detail.fuel}{detail.handsFree ? ' · hands-free driving' : ''}</p>
                {v ? <p className="verdict" role="status">{v}</p> : <p className="verdict">{baseline ? 'This is your baseline vehicle — everything compares against it.' : 'Set a baseline to see upgrade/trade-off verdicts here.'}</p>}
                {!!keys.length && (
                  <>
                    <h3 className="keys-h">Key differences</h3>
                    <ul className="keys">
                      {keys.slice(0, 6).map((k, i) => (
                        <li key={i}><span className={k.dir === 'up' ? 'up' : k.dir === 'dn' ? 'dn' : 'chg'}>{k.dir === 'up' ? '▲' : k.dir === 'dn' ? '▼' : '◆'}</span> {k.text}</li>
                      ))}
                    </ul>
                  </>
                )}
                <div className="arows" role="table" aria-label={`${detail.model} versus baseline by dimension`}>
                  <div className="arow ahead" role="row"><span role="columnheader">Dimension</span><span role="columnheader">{detail.model}</span>{b && <span role="columnheader">vs {b.model}</span>}</div>
                  {rows.map((r) => (
                    <div className="arow" role="row" key={r.label}>
                      <span role="cell">{r.label}</span>
                      <span role="cell"><b>{r.mine}</b>{r.base && <small> · base {r.base}</small>}</span>
                      <span role="cell">{r.cell ?? (b && r.base ? <span className="pill same">=</span> : null)}</span>
                    </div>
                  ))}
                  <div className="arow" role="row">
                    <span role="cell">Annual CO₂</span>
                    <span role="cell"><b>{myCO2 != null ? `${myCO2.toFixed(1)} t` : '—'}</b>{baseCO2 != null && <small> · base {baseCO2.toFixed(1)} t</small>}</span>
                    <span role="cell">{b && myCO2 != null && baseCO2 != null && myCO2 !== baseCO2
                      ? (myCO2 < baseCO2
                          ? <span className="pill good">▲ {(baseCO2 - myCO2).toFixed(1)} t less</span>
                          : <span className="pill bad">▼ +{(myCO2 - baseCO2).toFixed(1)} t</span>)
                      : (b ? <span className="pill same">n/a</span> : null)}</span>
                  </div>
                  {myKwh && (
                    <div className="arow" role="row">
                      <span role="cell">Annual consumption</span>
                      <span role="cell"><b>{Math.round(myKwh.amount).toLocaleString()} {myKwh.unit}</b></span>
                      <span role="cell">{b && (() => { const bk = annualEnergy(b); return bk && bk.unit === myKwh.unit && bk.amount !== myKwh.amount ? (
                        bk.amount > myKwh.amount
                          ? <span className="pill good">▲ {Math.round(bk.amount - myKwh.amount).toLocaleString()} {myKwh.unit} less</span>
                          : <span className="pill bad">▼ +{Math.round(myKwh.amount - bk.amount).toLocaleString()} {myKwh.unit}</span>
                      ) : <span className="pill same">=</span>; })()}</span>
                    </div>
                  )}
                </div>

                <h3 className="keys-h">5-year ownership sketch</h3>
                <div className="arows">
                  <div className="arow"><span>Depreciation (55% of MSRP)</span><span><b>{money(my5.depr)}</b></span><span>{base5 && <small>base {money(base5.depr)}</small>}</span></div>
                  <div className="arow"><span>Fuel over 5 yrs</span><span><b>{my5.fuel != null ? money(my5.fuel) : '—'}</b></span><span>{base5 && <small>base {base5.fuel != null ? money(base5.fuel) : '—'}</small>}</span></div>
                  <div className="arow"><span><b>5-yr total</b></span><span><b>{my5.total != null ? money(my5.total) : '—'}</b></span><span>{base5 && my5.total != null && base5.total != null && my5.total !== base5.total
                    ? (my5.total < base5.total
                        ? <span className="pill good">▲ saves {money(base5.total - my5.total)}</span>
                        : <span className="pill bad">▼ {money(my5.total - base5.total)} more</span>)
                    : null}</span></div>
                </div>

                <h3 className="keys-h">Garage fit, visualised</h3>
                <div className="gfit">
                  {[
                    { name: detail.model, f: detail.widthFolded, e: detail.widthExtended, cls: 'me' },
                    ...(b ? [{ name: `${b.model} (baseline)`, f: b.widthFolded, e: b.widthExtended, cls: 'base' }] : []),
                  ].map((r) => (
                    <div className="grow" key={r.name}>
                      <span className="gname">{r.name}</span>
                      <div className="gtrack">
                        <span className={`gbar ${r.cls}`} style={{ left: `${wPct(r.f)}%`, width: `${Math.max(1.5, +wPct(r.e) - +wPct(r.f))}%` }} />
                      </div>
                      <span className="gval">{r.f}″–{r.e}″</span>
                    </div>
                  ))}
                  <p className="fnote" style={{ marginTop: 6 }}>Bar spans folded → mirrors-out width on a {WMIN}–{WMAX}″ scale. Mirror swing: {((detail.widthExtended - detail.widthFolded)).toFixed(1)}″{b && ` vs baseline ${((b.widthExtended - b.widthFolded)).toFixed(1)}″`}.</p>
                </div>

                <h3 className="keys-h">Standing in the catalog ({VEHICLES.length} vehicles)</h3>
                <div className="pcts">
                  <span className="pct"><b>{pct.cheaperThan}%</b>priced above it</span>
                  <span className="pct"><b>{pct.efficientThan}%</b>less efficient <small>({detail.effUnit}, n={pct.peerN})</small></span>
                  <span className="pct"><b>{pct.narrowerThan}%</b>wider than it</span>
                </div>

                {!!sibs.length && (
                  <>
                    <h3 className="keys-h">More {detail.model} trims</h3>
                    <div className="sibs">
                      {sibs.map((s) => (
                        <button key={s.id} className="btn ghost" onClick={() => setDetail(s)}>{s.year} {s.trim} · {money(s.msrp)}</button>
                      ))}
                    </div>
                  </>
                )}
                <p className="fnote">Fuel-cost estimate assumes {MILES_YR.toLocaleString()} mi/yr at ${GAS_PRICE.toFixed(2)}/gal gas and ${ELEC_PRICE.toFixed(2)}/kWh electricity; CO₂ uses 8.89 kg/gal and 0.39 kg/kWh (US avg grid). 5-yr sketch = 55% depreciation + fuel, excl. insurance/maintenance. PHEV figures are blended — check EPA numbers. Snapshot pricing, not dealer quotes.</p>
                {detail.imageCredit && <p className="credit">{detail.imageCredit}</p>}
                <p className="d-actions">
                  <button className="btn primary" onClick={() => { patch({ baselineId: detail.id }); setDetail(null); }}>Set as baseline</button>{' '}
                  <button className="btn" onClick={() => { toggleCmp(detail.id); setDetail(null); }}>+ Compare tray</button>{' '}
                  <button className="btn ghost" onClick={() => setDetail(null)}>Close</button>
                </p>
              </>
            );
          })()}
        </Modal>
      )}

      {toast && <div className="toast show" role="status" aria-live="polite">{toast}</div>}
      <button className={'totop' + (showTop ? ' show' : '')} onClick={() => jump('results')} aria-hidden={!showTop} tabIndex={showTop ? 0 : -1} aria-label="Back to top">↑</button>
      <footer className="foot">
        <div className="wrap foot-in">
          <div className="brand"><span className="logo" aria-hidden="true">▣</span><div><strong>GarageFit</strong><small>Find cars that actually fit your life</small></div></div>
          <nav className="foot-nav" aria-label="Footer">
            <a href="#baseline" onClick={(e) => { e.preventDefault(); jump('baseline'); }}>Your baseline</a>
            <a href="#browse" onClick={(e) => { e.preventDefault(); jump('browse'); }}>Browse &amp; filter</a>
            <a href="#results" onClick={(e) => { e.preventDefault(); jump('results'); }}>Results</a>
            <button className="linklike" onClick={exportCSV}>Export CSV</button>
            <button className="linklike" onClick={share}>Share view</button>
            <button className="linklike" onClick={() => window.print()}>Print</button>
          </nav>
          <div className="foot-meta">
            <span>Dataset snapshot {DATA_STAMP} · {VEHICLES.length} vehicles ({VEHICLES.filter((v) => v.verified).length} with manufacturer/EPA-verified specs)</span>
            <span>Snapshot pricing, not live dealer pricing · MSRP USD</span>
          </div>
        </div>
      </footer>
    </>
  );
}
