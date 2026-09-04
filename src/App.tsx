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

/** Fit verdict vs the user's garage opening (mirrors-out). null when no opening is set. */
function garageFit(v: Vehicle, gw: number): { ok: boolean; tight: boolean; clearance: number } | null {
  if (!gw) return null;
  const clearance = +(gw - v.widthExtended).toFixed(1);
  return { ok: clearance >= 0, tight: clearance >= 0 && clearance < 2, clearance };
}
function garageTone(gf: { ok: boolean; tight: boolean }): 'good' | 'warn' | 'bad' {
  if (!gf.ok) return 'bad';
  return gf.tight ? 'warn' : 'good';
}

const PRESETS: { id: string; label: string; fn: (v: Vehicle) => boolean }[] = [
  { id: 'ev50', label: 'EVs under $50k', fn: (v) => v.fuel === 'EV' && v.msrp < 50000 },
  { id: 'fam', label: 'Family SUVs', fn: (v) => (v.body === 'SUV' || v.body === 'Minivan') && v.seats >= 7 },
  { id: 'safe', label: 'Top Safety', fn: (v) => v.safety === 'TSP+' || v.safety === 'TSP' },
  { id: 'fueleff', label: '40+ MPG(e)', fn: (v) => v.eff >= 40 },
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
  if (p.get('gw')) out.garageWidth = +p.get('gw')!;
  if (p.get('gwOnly') === '1') out.garageFitOnly = true;
  (['narrowOnly', 'topSafety', 'handsFree'] as const).forEach((k) => { if (p.get(k) === '1') (out as Record<string, unknown>)[k] = true; });
  if (p.get('fuels')) out.fuels = p.get('fuels')!.split(',');
  if (p.get('bodies')) out.bodies = p.get('bodies')!.split(',');
  if (p.get('make')) out.make = p.get('make')!;
  if (p.get('minEff')) out.minEff = +p.get('minEff')!;
  return out;
}

const DEFAULTS: FilterState = {
  baselineId: DEFAULT_BASELINE_ID, q: '', preset: '', sort: 'fit', view: 'cards',
  maxPrice: 80000, minYear: 2015, maxWidth: 98, garageWidth: 0, garageFitOnly: false, narrowOnly: false,
  topSafety: false, handsFree: false, fuels: [], bodies: [], make: '', minEff: 0,
};

function Delta({ kind, v, b, unit }: { kind: 'msrp' | 'eff' | 'width' | 'seats' | 'safety'; v: number | string; b: number | string; unit?: string }) {
  let cls = 'same', label = '=', title = 'Same as baseline';
  if (kind === 'msrp' && typeof v === 'number' && typeof b === 'number') {
    const d = v - b;
    if (d === 0) { label = 'Same price'; title = 'Same price as baseline'; }
    else if (d < 0) { cls = 'good'; label = `−${money(-d)}`; title = `${money(-d)} cheaper than baseline`; }
    else { cls = 'bad'; label = `+${money(d)}`; title = `${money(d)} more than baseline`; }
  } else if (kind === 'eff' && typeof v === 'number' && typeof b === 'number') {
    const d = v - b;
    if (d === 0) { label = '='; title = 'Same efficiency'; }
    else if (d > 0) { cls = 'good'; label = `+${d}${unit ? ` ${unit}` : ''}`; title = `${d}${unit ? ` ${unit}` : ''} more efficient`; }
    else { cls = 'bad'; label = `${d}${unit ? ` ${unit}` : ''}`; title = `${d}${unit ? ` ${unit}` : ''} less efficient`; }
  } else if (kind === 'width' && typeof v === 'number' && typeof b === 'number') {
    const d = +(v - b).toFixed(1);
    if (d === 0) { label = 'Same width'; title = 'Same width as baseline'; }
    else if (d < 0) { cls = 'good'; label = `${d}″`; title = `${Math.abs(d)}″ narrower than baseline`; }
    else { cls = 'bad'; label = `+${d}″`; title = `${d}″ wider than baseline`; }
  } else if (kind === 'seats' && typeof v === 'number' && typeof b === 'number') {
    const d = v - b;
    if (d === 0) { label = '='; title = 'Same seats'; }
    else if (d > 0) { cls = 'good'; label = `+${d} seats`; title = `${d} more seats`; }
    else { cls = 'bad'; label = `${d}`; title = `${d} fewer seats`; }
  } else if (kind === 'safety') {
    const a = SAFETY_SCORE[String(v)] ?? 0, c = SAFETY_SCORE[String(b)] ?? 0;
    if (a === c) { label = String(v) || '—'; title = 'Same safety rating'; }
    else if (a > c) { cls = 'good'; label = `${v} ↑`; title = `Safer: ${v} vs ${b}`; }
    else { cls = 'bad'; label = `${v} ↓`; title = `Less safe: ${v} vs ${b}`; }
  }
  return <span className={`pill ds-pill ${cls}`} title={title}>{label}</span>;
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
  const [cols, setCols] = useState({ price: true, eff: true, width: true, safety: false, seats: false, fuel: false });
  const [detail, setDetail] = useState<Vehicle | null>(null);
  const [photoFull, setPhotoFull] = useState<Vehicle | null>(null);
  const [splash, setSplash] = useState(() => { try { return !sessionStorage.getItem('gf-splash-seen'); } catch { return true; } });
  const splashBtn = useRef<HTMLButtonElement>(null);
  const dismissSplash = () => {
    setSplash(false);
    try { sessionStorage.setItem('gf-splash-seen', '1'); } catch { /* private mode: show again next visit */ }
    if (splashBtn.current && splashBtn.current.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
  };
  useEffect(() => {
    if (!splash) return;
    splashBtn.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = setTimeout(dismissSplash, 2800);
    return () => { clearTimeout(t); document.body.style.overflow = prevOverflow; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [splash]);
  const [cmpOpen, setCmpOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [dark, setDark] = useState(() => {
    try {
      const stored = localStorage.getItem('gf-theme');
      if (stored === 'dark') return true;
      if (stored === 'light') return false;
      return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    } catch { return false; }
  });
  const [offline, setOffline] = useState(!navigator.onLine);
  const [swUpdate, setSwUpdate] = useState(false);
  // Full-page vehicle view: browser-back/Escape support, body scroll lock, reset scroll on open
  const dpRef = useRef<HTMLDivElement>(null);
  const pushedRef = useRef(false);
  const closeDetail = () => { setPhotoFull(null); if (pushedRef.current) window.history.back(); else setDetail(null); };
  useEffect(() => {
    if (!detail) return;
    window.history.pushState({ gfDetail: detail.id }, '');
    pushedRef.current = true;
    dpRef.current?.scrollTo(0, 0);
    dpRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onPop = () => { pushedRef.current = false; setPhotoFull(null); setDetail(null); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); closeDetail(); } };
    window.addEventListener('popstate', onPop);
    document.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('popstate', onPop);
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prevOverflow;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail]);
  useEffect(() => {
    if (!photoFull) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setPhotoFull(null); } };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [photoFull]);
  useEffect(() => {
    const on = () => setSwUpdate(true);
    window.addEventListener('gf:sw-update', on);
    return () => window.removeEventListener('gf:sw-update', on);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    try { localStorage.setItem('gf-theme', dark ? 'dark' : 'light'); } catch { /* private mode */ }
    // Keep the status-bar / PWA theme in sync with the manual toggle
    // (the media-based metas in index.html only follow the OS).
    try {
      let m = document.querySelector<HTMLMetaElement>('meta[name="theme-color"][data-gf]');
      if (!m) {
        m = document.createElement('meta');
        m.name = 'theme-color';
        m.setAttribute('data-gf', '1');
        document.head.appendChild(m);
      }
      m.content = dark ? '#0b1220' : '#1e3a8a';
    } catch { /* head not writable in some embeds */ }
  }, [dark]);
  // Follow the OS while the user hasn't picked a theme explicitly.
  useEffect(() => {
    let mq: MediaQueryList | null = null;
    const onChange = (e: MediaQueryListEvent) => {
      try { if (!localStorage.getItem('gf-theme')) setDark(e.matches); } catch { setDark(e.matches); }
    };
    try {
      if (!localStorage.getItem('gf-theme')) {
        mq = window.matchMedia('(prefers-color-scheme: dark)');
        mq.addEventListener('change', onChange);
      }
    } catch { /* older browsers */ }
    return () => { try { mq?.removeEventListener('change', onChange); } catch { /* noop */ } };
  }, []);
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
    if (f.garageWidth) p.set('gw', String(f.garageWidth));
    if (f.garageFitOnly && f.garageWidth) p.set('gwOnly', '1');
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
      'width-asc': (a, b) => a.widthExtended - b.widthExtended, fit: (a, b) => fitScore(a) - fitScore(b),
    };
    const r = VEHICLES.filter((v) => {
      if (f.q && !(v.make + ' ' + v.model + ' ' + v.trim + ' ' + v.year).toLowerCase().includes(f.q.toLowerCase())) return false;
      if (v.msrp > f.maxPrice || v.year < f.minYear || v.widthExtended > f.maxWidth) return false;
      if (f.narrowOnly && baseline && v.widthExtended > baseline.widthExtended) return false;
      if (f.garageFitOnly && f.garageWidth && v.widthExtended > f.garageWidth) return false;
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
    try { await navigator.clipboard.writeText(location.href); setToast('Share link copied'); }
    catch { prompt('Copy link:', location.href); }
  };
  type Tag = { key: string; label: string; clear: () => void };
  const tags: Tag[] = [];
  if (f.preset) { const pr = PRESETS.find((p) => p.id === f.preset); tags.push({ key: 'preset', label: pr?.label ?? f.preset, clear: () => patch({ preset: '' }) }); }
  if (f.q) tags.push({ key: 'q', label: `“${f.q}”`, clear: () => patch({ q: '' }) });
  if (f.maxPrice < 80000) tags.push({ key: 'maxPrice', label: `≤ ${money(f.maxPrice)}`, clear: () => patch({ maxPrice: 80000 }) });
  if (f.minYear > 2015) tags.push({ key: 'minYear', label: `${f.minYear}+`, clear: () => patch({ minYear: 2015 }) });
  if (f.maxWidth < 98) tags.push({ key: 'maxWidth', label: `≤ ${f.maxWidth}″ wide`, clear: () => patch({ maxWidth: 98 }) });
  if (f.garageWidth) tags.push({ key: 'gw', label: `Garage ${f.garageWidth}″`, clear: () => patch({ garageWidth: 0, garageFitOnly: false }) });
  if (f.garageFitOnly && f.garageWidth) tags.push({ key: 'gwOnly', label: 'Fits garage', clear: () => patch({ garageFitOnly: false }) });
  if (f.topSafety) tags.push({ key: 'topSafety', label: 'Top safety', clear: () => patch({ topSafety: false }) });
  if (f.handsFree) tags.push({ key: 'handsFree', label: 'Hands-free', clear: () => patch({ handsFree: false }) });
  if (f.narrowOnly) tags.push({ key: 'narrowOnly', label: 'Fits baseline', clear: () => patch({ narrowOnly: false }) });
  if (f.minEff > 0) tags.push({ key: 'minEff', label: `${f.minEff}+ MPG(e)`, clear: () => patch({ minEff: 0 }) });
  if (f.fuels.length) tags.push({ key: 'fuels', label: f.fuels.join(' · '), clear: () => patch({ fuels: [] }) });
  if (f.bodies.length) tags.push({ key: 'bodies', label: f.bodies.join(' · '), clear: () => patch({ bodies: [] }) });
  if (f.make) tags.push({ key: 'make', label: f.make, clear: () => patch({ make: '' }) });
  const hasActive = f.preset !== '' || f.q !== '' || f.maxPrice !== 80000 || f.minYear !== 2015 || f.maxWidth !== 98
    || f.garageFitOnly || f.narrowOnly || f.topSafety || f.handsFree || f.make !== '' || f.minEff !== 0
    || f.fuels.length > 0 || f.bodies.length > 0;

  const clearFilters = () => patch({ preset: '', maxPrice: 80000, minYear: 2015, maxWidth: 98, garageFitOnly: false, narrowOnly: false, topSafety: false, handsFree: false, make: '', minEff: 0, q: '', fuels: [], bodies: [] });

  return (
    <>
      <a className="skip" href="#results">Skip to results</a>
      {splash && (
        <div className="splash" role="dialog" aria-modal="true" aria-label="Welcome to GarageFit" onClick={dismissSplash}>
          <div className="splash-in">
            <img className="splash-logo" src="logo.svg" alt="" aria-hidden="true" />
            <h1>GarageFit</h1>
            <p className="splash-tag">Find cars that actually fit your life</p>
          </div>
          <button ref={splashBtn} type="button" className="splash-skip" onClick={dismissSplash}>Skip</button>
          <div className="splash-bar" aria-hidden="true"><span /></div>
        </div>
      )}
      {swUpdate && (
        <div className="updatebar" role="status">
          <span>New version available — reload to get the latest vehicles and fixes.</span>
          <button className="btn primary" onClick={() => (window as unknown as { __gfUpdateSW?: () => void }).__gfUpdateSW?.()}>Reload to update</button>
          <button className="btn ghost" onClick={() => setSwUpdate(false)} aria-label="Dismiss update notice">Close</button>
        </div>
      )}
      <header className="topbar">
        <div className="wrap topbar-in">
          <a className="brand" href="#results" onClick={(e) => { e.preventDefault(); jump('results'); }} style={{ textDecoration: 'none', color: 'inherit' }}>
            <img className="logo" src="logo.svg" alt="" aria-hidden="true" />
            <div><strong>GarageFit</strong></div>
          </a>
          <nav className="topnav" aria-label="Section navigation">
            <a href="#baseline" className={activeSec === 'baseline' ? 'on' : ''} aria-current={activeSec === 'baseline' ? 'true' : undefined} onClick={(e) => { e.preventDefault(); jump('baseline'); }}>Your baseline</a>
            <a href="#browse" className={activeSec === 'browse' ? 'on' : ''} aria-current={activeSec === 'browse' ? 'true' : undefined} onClick={(e) => { e.preventDefault(); jump('browse'); }}>Browse &amp; filter</a>
            <a href="#results" className={activeSec === 'results' ? 'on' : ''} aria-current={activeSec === 'results' ? 'true' : undefined} onClick={(e) => { e.preventDefault(); jump('results'); }}>Results</a>
          </nav>
          <div className="top-actions">
            {offline && <span className="pill warn">offline — cached</span>}
            <div className="searchbox"><label className="sr-only" htmlFor="gf-search">Search make, model, or trim</label><input id="gf-search" value={f.q} onChange={(e) => patch({ q: e.target.value })} type="search" placeholder="Search make, model, trim…" /></div>
            <button className="btn ghost icon-btn" onClick={() => setDark((d) => !d)} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} aria-pressed={dark} title={dark ? 'Light mode' : 'Dark mode'}>
              {dark ? (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5 5l1.7 1.7M17.3 17.3L19 19M19 5l-1.7 1.7M6.7 17.3L5 19"/></svg>
              ) : (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 13.5A8 8 0 0 1 10.5 4 6.5 6.5 0 1 0 20 13.5Z"/></svg>
              )}
            </button>
            <button className="btn ghost icon-btn" onClick={share} title="Copy share link" aria-label="Copy share link">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 15V3.5M12 3.5L7.5 8M12 3.5l4.5 4.5"/><path d="M5 12.5V20h14v-7.5"/></svg>
            </button>
            <button className="btn ghost icon-btn" onClick={() => window.print()} title="Print this view" aria-label="Print this view">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 8V3.5h10V8"/><rect x="3.5" y="8" width="17" height="8.5" rx="2"/><path d="M7 13.5h10v7H7z"/></svg>
            </button>
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
                <p>{baseline.body} · {baseline.fuel} · {baseline.seats} seats</p>
                <div className="b-stats">
                  <span className="stat"><b>{money(baseline.msrp)}</b>MSRP</span>
                  <span className="stat"><b>{baseline.eff} {baseline.effUnit}</b>efficiency</span>
                  <span className="stat"><b>{baseline.widthFolded}–{baseline.widthExtended}″</b>width folded–out</span>
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
              <div className="b-info"><span className="kicker">Comparison mode</span><h2>No baseline — showing absolute values</h2><p>Pick a car you own so every row shows better / worse relative to it.</p></div>
              <div className="b-select">
                <label className="b-label" htmlFor="gf-baseline-new">Choose your baseline</label>
                <select id="gf-baseline-new" defaultValue="" onChange={(e) => e.target.value && patch({ baselineId: e.target.value })}>
                  <option value="">Choose baseline…</option>
                  {VEHICLES.map((v) => <option key={v.id} value={v.id}>{v.year} {v.make} {v.model} {v.trim}</option>)}
                </select>
              </div>
            </>
          )}
          <div className="b-garage">
            <label className="b-label" htmlFor="gf-garage">Your garage opening (mirrors-out)</label>
            <div className="b-row">
              <input id="gf-garage" className="b-garage-input" type="number" inputMode="decimal" min={60} max={140} step={0.5}
                placeholder="e.g. 88" value={f.garageWidth || ''}
                onChange={(e) => patch({ garageWidth: e.target.value === '' ? 0 : Math.min(200, Math.max(0, +e.target.value)) })}
                aria-describedby="gf-garage-hint" />
              <span className="b-garage-unit">inches</span>
              {f.garageWidth > 0 && <button className="btn ghost" onClick={() => patch({ garageWidth: 0 })}>Clear</button>}
              <span className="b-hint" id="gf-garage-hint">{f.garageWidth > 0
                ? <><strong>{VEHICLES.filter((x) => x.widthExtended <= f.garageWidth).length} of {VEHICLES.length}</strong> vehicles fit your opening</>
                : 'Optional — adds a fits / doesn’t-fit verdict to every vehicle'}</span>
            </div>
          </div>
        </section>

        <div className="stickybar" id="browse">
          <div className="presets" role="toolbar" aria-label="Quick presets">{PRESETS.map((p) => <button key={p.id} className={'preset' + (f.preset === p.id ? ' on' : '')} aria-pressed={f.preset === p.id} onClick={() => patch({ preset: f.preset === p.id ? '' : p.id })}>{p.label}</button>)}</div>
          <div className="toolbar">
            <div className="controls">
              <button className={'btn' + (filtersOpen ? ' on' : '')} onClick={() => setFiltersOpen((o) => !o)} aria-expanded={filtersOpen} aria-controls="gf-filters">Filters{tags.length ? <span className="ds-count" aria-label={`${tags.length} active`}>{tags.length}</span> : null}</button>
              <div className="control">
                <label className="sr-only" htmlFor="gf-sort">Sort</label>
                <select id="gf-sort" aria-label="Sort results" value={f.sort} onChange={(e) => setF((s) => ({ ...s, sort: e.target.value as SortKey }))}>
                  <option value="fit">Best fit</option><option value="price-asc">Price ↑</option>
                  <option value="price-desc">Price ↓</option><option value="eff-desc">Efficiency</option>
                  <option value="year-desc">Newest</option><option value="safety-desc">Safest</option>
                  <option value="width-asc">Narrowest</option>
                </select>
              </div>
              <div className="control seg" role="group" aria-label="Result layout">
                <button className={f.view === 'cards' ? 'seg-on' : ''} aria-pressed={f.view === 'cards'} title="Card view" onClick={() => setF((s) => ({ ...s, view: 'cards' }))}>Cards</button>
                <button className={f.view === 'table' ? 'seg-on' : ''} aria-pressed={f.view === 'table'} title="Table view" onClick={() => setF((s) => ({ ...s, view: 'table' }))}>Table</button>
              </div>
              {hasActive && <button className="linklike" onClick={clearFilters} title="Clear all filters" aria-label="Clear all filters">Reset</button>}
              {f.view === 'table' && <button className={'btn ghost' + (colsOpen ? ' on' : '')} onClick={() => setColsOpen((o) => !o)} aria-expanded={colsOpen} aria-controls="gf-cols">Columns</button>}
            </div>
            {tags.length > 0 && <div className="summary" aria-label="Active filters">{tags.map((t) => <span key={t.key} className="ds-chip"><span>{t.label}</span><button onClick={t.clear} aria-label={`Remove filter ${t.label}`}>×</button></span>)}</div>}
          </div>
          {filtersOpen && (
            <div className="filters" id="gf-filters">
              <div className="fgrid fgrid-3">
                <fieldset><legend>Vehicle</legend>
                  <div className="ds-field-row"><label htmlFor="gf-minyear">Year</label><output className="ds-output">{f.minYear}+</output></div>
                  <input id="gf-minyear" type="range" min={2015} max={2026} value={f.minYear} onChange={(e) => patch({ minYear: +e.target.value })} aria-label={`Minimum year ${f.minYear}`} />
                  <div className="checks">{BODIES.map((x) => <label key={x}><input type="checkbox" checked={f.bodies.includes(x)} onChange={(e) => patch({ bodies: e.target.checked ? [...f.bodies, x] : f.bodies.filter((y) => y !== x) })} /> {x}</label>)}</div>
                  <label className="sr-only" htmlFor="gf-make">Make</label>
                  <select id="gf-make" value={f.make} onChange={(e) => patch({ make: e.target.value })}><option value="">All makes</option>{MAKES.map((m) => <option key={m}>{m}</option>)}</select>
                </fieldset>
                <fieldset><legend>Price &amp; efficiency</legend>
                  <div className="ds-field-row"><label htmlFor="gf-maxprice">Max price</label><output className="ds-output">{money(f.maxPrice)}</output></div>
                  <input id="gf-maxprice" type="range" min={20000} max={120000} step={1000} value={f.maxPrice} onChange={(e) => patch({ maxPrice: +e.target.value })} aria-label={`Max price ${money(f.maxPrice)}`} />
                  <div className="checks">{FUELS.map((x) => <label key={x}><input type="checkbox" checked={f.fuels.includes(x)} onChange={(e) => patch({ fuels: e.target.checked ? [...f.fuels, x] : f.fuels.filter((y) => y !== x) })} /> {x}</label>)}</div>
                  <div className="ds-field-row"><label htmlFor="gf-mineff">Efficiency</label><output className="ds-output">{f.minEff}+ MPG(e)</output></div>
                  <input id="gf-mineff" type="range" min={0} max={140} value={f.minEff} onChange={(e) => patch({ minEff: +e.target.value })} aria-label={`Minimum efficiency ${f.minEff}`} />
                </fieldset>
                <fieldset><legend>Fit &amp; safety</legend>
                  <div className="ds-field-row"><label htmlFor="gf-maxwidth">Max width</label><output className="ds-output">{f.maxWidth}″</output></div>
                  <input id="gf-maxwidth" type="range" min={68} max={98} step={0.5} value={f.maxWidth} onChange={(e) => patch({ maxWidth: +e.target.value })} aria-label={`Max width ${f.maxWidth} inches`} />
                  <label className="check"><input type="checkbox" checked={f.narrowOnly} disabled={!baseline} onChange={(e) => patch({ narrowOnly: e.target.checked })} /> Fits baseline</label>
                  <label className="check"><input type="checkbox" checked={f.garageFitOnly} disabled={!f.garageWidth} onChange={(e) => patch({ garageFitOnly: e.target.checked })} /> Fits my garage{f.garageWidth ? ` (${f.garageWidth}″)` : ''}</label>
                  {!baseline && !f.garageWidth && <p className="f-hint">Set a baseline or garage opening above to unlock fit filters.</p>}
                  <div className="checks checks-row">
                    <label><input type="checkbox" checked={f.topSafety} onChange={(e) => patch({ topSafety: e.target.checked })} /> Top safety</label>
                    <label><input type="checkbox" checked={f.handsFree} onChange={(e) => patch({ handsFree: e.target.checked })} /> Hands-free</label>
                  </div>
                </fieldset>
              </div>
              <div className="f-actions"><button className="btn ghost" onClick={clearFilters}>Reset all</button><button className="btn primary" onClick={() => setFiltersOpen(false)}>Show {results.length} result{results.length === 1 ? '' : 's'}</button></div>
            </div>
          )}
          {f.view === 'table' && colsOpen && <div className="cols" id="gf-cols">{(Object.keys(cols) as (keyof typeof cols)[]).map((k) => <label key={k}><input type="checkbox" checked={cols[k]} onChange={(e) => setCols((c) => ({ ...c, [k]: e.target.checked }))} /> {k}</label>)}</div>}
        </div>

        <div className="count" role="status" aria-live="polite"><strong>{results.length}</strong>&nbsp;vehicle{results.length === 1 ? '' : 's'}{f.garageWidth ? ` · ${results.filter((x) => x.widthExtended <= f.garageWidth).length} fit ${f.garageWidth}″` : ''}</div>

        {f.view === 'cards' ? (
          <>
            <section className="grid grid-lean" id="results" aria-label="Vehicle results">
              {results.slice(0, shown).map((v, i) => (
                <article
                  className="card card-click card-lean" key={v.id} aria-labelledby={`t-${v.id}`}
                  style={{ animationDelay: `${Math.min(i, 11) * 35}ms` }}
                  tabIndex={0}
                  aria-label={`View ${v.year} ${v.make} ${v.model} ${v.trim}`}
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
                    <span className="fuel fuel-plain">{v.fuel}{v.rangeMi ? ` · ${v.rangeMi} mi` : ''}</span>
                    {(() => { const gf = garageFit(v, f.garageWidth); if (!gf) return null; const tone = garageTone(gf); return <span className={`gfit-dot ${tone === 'good' ? 'ok' : tone === 'warn' ? 'warn' : 'no'}`} title={gf.ok ? (gf.tight ? `Tight fit — ${gf.clearance.toFixed(1)}″ to spare` : `Fits with ${gf.clearance.toFixed(1)}″ to spare`) : `${(-gf.clearance).toFixed(1)}″ too wide`} aria-label={gf.ok ? (gf.tight ? 'Tight garage fit' : 'Fits your garage') : 'Too wide for your garage'} />; })()}
                    <button className="fav" aria-label={favs.includes(v.id) ? `Remove ${v.make} ${v.model} from favorites` : `Add ${v.make} ${v.model} to favorites`} aria-pressed={favs.includes(v.id)} onClick={(e) => { e.stopPropagation(); setFavs((s) => s.includes(v.id) ? s.filter((x) => x !== v.id) : [...s, v.id]); }}>{favs.includes(v.id) ? '★' : '☆'}</button>
                  </div>
                  <div className="shade" aria-hidden="true"></div>
                  <div className="body">
                    <h3 id={`t-${v.id}`} className="ds-truncate">{v.year} {v.make} {v.model}</h3>
                    <div className="sub ds-truncate">{v.trim} · {v.body}</div>
                    <div className="price-row"><span className="price">{money(v.msrp)}{v.used && <small> used</small>}</span><span className="ds-meta">{v.eff} {v.effUnit} · {v.widthExtended}″</span></div>
                    <div className="deltas">
                      {baseline && baseline.id !== v.id ? (<><Delta kind="msrp" v={v.msrp} b={baseline.msrp} /><Delta kind="width" v={v.widthExtended} b={baseline.widthExtended} /></>) : null}
                    </div>
                    <div className="fitbar slim">
                      <div className="track">
                        {baseline && <span className="tick" style={{ left: `${wPct(baseline.widthExtended)}%` }} title={`Baseline: ${baseline.widthExtended}″`} />}
                        {f.garageWidth > 0 && <span className="tick garage" style={{ left: `${wPct(f.garageWidth)}%` }} title={`Garage: ${f.garageWidth}″`} />}
                        <span className="dot" style={{ left: `${wPct(v.widthExtended)}%` }} title={`${v.widthExtended}″ mirrors out`} />
                      </div>
                    </div>
                    <div className="actions">
                      <button className="btn details" onClick={(e) => { e.stopPropagation(); setDetail(v); }}>Details</button>
                      <button className={'btn ghost cmp' + (compare.includes(v.id) ? ' on' : '')} aria-pressed={compare.includes(v.id)} onClick={(e) => { e.stopPropagation(); toggleCmp(v.id); }} title={compare.includes(v.id) ? 'Remove from compare' : 'Add to compare'}>{compare.includes(v.id) ? '✓' : '+'}</button>
                    </div>
                  </div>
                </article>
              ))}
            </section>
            {!results.length && <div className="empty"><strong>No matches.</strong><span className="ds-meta">Try widening price, year, or width.</span><button className="btn" onClick={clearFilters}>Reset filters</button></div>}
            <div className="morewrap">{results.length > shown && <button className="btn big" onClick={() => setShown((s) => s + 24)}>Show more ({results.length - shown} left)</button>}</div>
          </>
        ) : (
          <section className="tablewrap" aria-label="Vehicle results table"><table><caption className="sr-only">Vehicles compared against your baseline</caption><thead><tr>
            <th scope="col">Vehicle</th>{cols.price && <th scope="col">Price</th>}{cols.eff && <th scope="col">Eff.</th>}{cols.seats && <th scope="col">Seats</th>}
            {cols.width && <th scope="col">Width out</th>}{cols.safety && <th scope="col">Safety</th>}{cols.fuel && <th scope="col">Fuel</th>}<th scope="col"><span className="sr-only">Actions</span></th>
          </tr></thead><tbody>
            {results.map((v) => (
              <tr key={v.id} className="row-click" onClick={() => setDetail(v)} title={`View closer analysis of ${v.year} ${v.make} ${v.model}`}>
                <td><b>{v.year} {v.make} {v.model}</b><br /><small style={{ color: 'var(--muted)' }}>{v.trim} · {v.body}</small></td>
                {cols.price && <td>{money(v.msrp)}{v.used ? <small style={{ color: 'var(--muted)' }}> used</small> : null}<br />{baseline && <Delta kind="msrp" v={v.msrp} b={baseline.msrp} />}</td>}
                {cols.eff && <td>{v.eff} {v.effUnit}<br />{baseline && <Delta kind="eff" v={v.eff} b={baseline.eff} unit={v.effUnit} />}</td>}
                {cols.seats && <td>{v.seats}<br />{baseline && <Delta kind="seats" v={v.seats} b={baseline.seats} />}</td>}
                {cols.width && <td>{v.widthExtended}″<br />{baseline && <Delta kind="width" v={v.widthExtended} b={baseline.widthExtended} />}{(() => { const gf = garageFit(v, f.garageWidth); return gf ? <span className={`pill ${garageTone(gf)}`}>{gf.ok ? (gf.tight ? `${gf.clearance.toFixed(1)}″ tight` : `${gf.clearance.toFixed(1)}″ spare`) : `${(-gf.clearance).toFixed(1)}″ too wide`}</span> : null; })()}</td>}
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
          <span>{compare.map((id) => { const v = byId(id)!; return `${v.make} ${v.model}`; }).join(' · ')}</span>
          <button className="go" onClick={() => setCmpOpen(true)}>Compare ({compare.length})</button>
          <button onClick={() => setCompare([])}>Clear</button>
        </div>
      )}

      {cmpOpen && (
        <Modal label={`Side-by-side comparison of ${compare.length} vehicles`} onClose={() => setCmpOpen(false)}>
            <h2>Side-by-side ({compare.length})</h2>
            {(() => {
              const vs = compare.map((id) => byId(id)!).filter(Boolean);
              const bestPrice = Math.min(...vs.map((x) => x.msrp));
              const bestEff = Math.max(...vs.map((x) => x.eff));
              const bestWidth = Math.min(...vs.map((x) => x.widthExtended));
              const bestFuel = Math.min(...vs.map(annualFuel).filter((x): x is number => x != null));
              const bestCO2 = Math.min(...vs.map(annualCO2).filter((x): x is number => x != null));
              const bestFive = Math.min(...vs.map((x) => fiveYear(x).total).filter((x): x is number => x != null));
              const bestTag = <span className="pill good">Best</span>;
              return (
              <div className="tablewrap"><table className="cmp-table">
                <thead><tr>
                  <th scope="col">Dimension</th>
                  {vs.map((x) => (
                    <th scope="col" key={x.id}>
                      {x.imageUrl && <img className="cmp-photo" src={x.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => e.currentTarget.remove()} />}
                      <b>{x.year} {x.make} {x.model}</b><br /><small>{x.trim}</small><br />
                      <button className="linklike" onClick={() => toggleCmp(x.id)} aria-label={`Remove ${x.make} ${x.model} from comparison`}>Remove</button>
                    </th>
                  ))}
                </tr></thead>
                <tbody>
                  <tr><th scope="row">Price</th>{vs.map((x) => <td key={x.id}>{money(x.msrp)}{x.used ? <small> used</small> : null} {x.msrp === bestPrice && bestTag}<br />{baseline && <Delta kind="msrp" v={x.msrp} b={baseline.msrp} />}</td>)}</tr>
                  <tr><th scope="row">Efficiency</th>{vs.map((x) => <td key={x.id}>{x.eff} {x.effUnit} {x.eff === bestEff && bestTag}<br />{baseline && <Delta kind="eff" v={x.eff} b={baseline.eff} />}</td>)}</tr>
                  <tr><th scope="row">Est. fuel cost / yr</th>{vs.map((x) => { const c = annualFuel(x); return <td key={x.id}>{c != null ? <>{money(c)} {c === bestFuel && bestTag}</> : '—'}</td>; })}</tr>
                  <tr><th scope="row">Fuel type</th>{vs.map((x) => <td key={x.id}>{x.fuel}</td>)}</tr>
                  <tr><th scope="row">Range</th>{vs.map((x) => <td key={x.id}>{x.rangeMi ? `${x.rangeMi} mi` : '—'}</td>)}</tr>
                  <tr><th scope="row">Width, mirrors out</th>{vs.map((x) => <td key={x.id}>{x.widthExtended}″ {x.widthExtended === bestWidth && bestTag}<br />{baseline && <Delta kind="width" v={x.widthExtended} b={baseline.widthExtended} />}</td>)}</tr>
                  <tr><th scope="row">Width, folded</th>{vs.map((x) => <td key={x.id}>{x.widthFolded}″</td>)}</tr>
                  {f.garageWidth > 0 && <tr><th scope="row">Your garage ({f.garageWidth}″)</th>{vs.map((x) => { const g = garageFit(x, f.garageWidth); return <td key={x.id}>{g ? <span className={`pill ${garageTone(g)}`}>{g.ok ? (g.tight ? `${g.clearance.toFixed(1)}″ tight` : `${g.clearance.toFixed(1)}″ spare`) : `${(-g.clearance).toFixed(1)}″ too wide`}</span> : '—'}</td>; })}</tr>}
                  <tr><th scope="row">Seats / doors</th>{vs.map((x) => <td key={x.id}>{x.seats} / {x.doors}<br />{baseline && <Delta kind="seats" v={x.seats} b={baseline.seats} />}</td>)}</tr>
                  <tr><th scope="row">Body type</th>{vs.map((x) => <td key={x.id}>{x.body}</td>)}</tr>
                  <tr><th scope="row">IIHS safety</th>{vs.map((x) => <td key={x.id}>{x.safety}<br />{baseline && <Delta kind="safety" v={x.safety} b={baseline.safety} />}</td>)}</tr>
                  <tr><th scope="row">NHTSA rating</th>{vs.map((x) => <td key={x.id}>{x.nhtsaStars ? `${x.nhtsaStars}/5` : 'Not rated'}</td>)}</tr>
                  <tr><th scope="row">Front legroom</th>{vs.map((x) => <td key={x.id}>{x.legroom}″</td>)}</tr>
                  <tr><th scope="row">Hands-free</th>{vs.map((x) => <td key={x.id}>{x.handsFree ? 'Yes' : 'No'}</td>)}</tr>
                  <tr><th scope="row">Annual CO₂</th>{vs.map((x) => { const c = annualCO2(x); return <td key={x.id}>{c != null ? <>{c.toFixed(1)} t {c === bestCO2 && bestTag}</> : '—'}</td>; })}</tr>
                  <tr><th scope="row">5-yr total</th>{vs.map((x) => { const t = fiveYear(x).total; return <td key={x.id}>{t != null ? <>{money(t)} {t === bestFive && bestTag}</> : '—'}</td>; })}</tr>
                </tbody>
              </table></div>
              );
            })()}
            <p><button className="btn" onClick={() => setCmpOpen(false)}>Close</button></p>
        </Modal>
      )}

      {detail && (
        <div className="dpage" ref={dpRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`${detail.year} ${detail.make} ${detail.model} closer analysis`}>
          <div className="dpage-bar">
            <button className="btn ghost" onClick={closeDetail}>Back</button>
            <strong className="dpage-title">{detail.year} {detail.make} {detail.model} <small>{detail.trim}</small></strong>
            <button className="btn ghost" onClick={closeDetail} aria-label="Close vehicle page">Close</button>
          </div>
          <div className="wrap dpage-in">
          {(() => {
            const b = baseline && baseline.id !== detail.id ? baseline : null;
            const myCost = annualFuel(detail);
            const baseCost = b ? annualFuel(b) : null;
            type Cell = { label: string; mine: string; base?: string; cell?: React.ReactNode };
            const rows: Cell[] = [
              { label: detail.used ? 'Typical used value' : 'Price (MSRP)', mine: money(detail.msrp), base: b ? money(b.msrp) : undefined,
                cell: b ? <><Delta kind="msrp" v={detail.msrp} b={b.msrp} />{pctDiff(detail.msrp, b.msrp) && <small> · {pctDiff(detail.msrp, b.msrp)}</small>}</> : undefined },
              { label: 'Efficiency', mine: `${detail.eff} ${detail.effUnit}`, base: b ? `${b.eff} ${b.effUnit}` : undefined,
                cell: b ? <><Delta kind="eff" v={detail.eff} b={b.eff} />{pctDiff(detail.eff, b.eff) && <small> · {pctDiff(detail.eff, b.eff)}</small>}</> : undefined },
              { label: 'Est. fuel cost / yr', mine: myCost != null ? money(myCost) : '—', base: baseCost != null ? money(baseCost) : undefined,
                cell: myCost != null && baseCost != null && myCost !== baseCost
                  ? (myCost < baseCost
                      ? <span className="pill good">saves {money(baseCost - myCost)}/yr</span>
                      : <span className="pill bad">costs {money(myCost - baseCost)} more/yr</span>)
                  : (b ? <span className="pill same">n/a</span> : undefined) },
              { label: 'Fuel type', mine: detail.fuel, base: b?.fuel,
                cell: b && b.fuel !== detail.fuel ? <span className="pill same">{b.fuel} → {detail.fuel}</span> : (b ? <span className="pill same">= same</span> : undefined) },
              ...(detail.rangeMi ? [{ label: 'EV range', mine: `${detail.rangeMi} mi` } as Cell] : []),
              { label: 'Model year', mine: `${detail.year}`, base: b ? `${b.year}` : undefined,
                cell: b && b.year !== detail.year ? <span className="pill same">{Math.abs(detail.year - b.year)} yr{Math.abs(detail.year - b.year) > 1 ? 's' : ''} {detail.year > b.year ? 'newer' : 'older'}</span> : (b ? <span className="pill same">= same</span> : undefined) },
              { label: 'Width, mirrors out', mine: `${detail.widthExtended}″`, base: b ? `${b.widthExtended}″` : undefined,
                cell: b ? <Delta kind="width" v={detail.widthExtended} b={b.widthExtended} /> : undefined },
              ...(f.garageWidth ? [{ label: `Your garage (${f.garageWidth}″ opening)`, mine: `${detail.widthExtended}″ car`,
                cell: (() => { const gf = garageFit(detail, f.garageWidth); return gf ? (gf.ok ? <span className="pill good">{gf.clearance.toFixed(1)}″ clearance left</span> : <span className="pill bad">{(-gf.clearance).toFixed(1)}″ too wide to fit</span>) : null; })() } as Cell] : []),
              { label: 'Width, mirrors folded', mine: `${detail.widthFolded}″`, base: b ? `${b.widthFolded}″` : undefined },
              { label: 'Seats / doors', mine: `${detail.seats} / ${detail.doors}`, base: b ? `${b.seats} / ${b.doors}` : undefined,
                cell: b ? <Delta kind="seats" v={detail.seats} b={b.seats} /> : undefined },
              { label: 'Body type', mine: detail.body, base: b?.body,
                cell: b ? <span className="pill same">{b.body === detail.body ? '= same' : `${b.body} → ${detail.body}`}</span> : undefined },
              { label: 'Safety', mine: detail.safety, base: b?.safety,
                cell: b ? <Delta kind="safety" v={detail.safety} b={b.safety} /> : undefined },
              { label: 'NHTSA rating', mine: detail.nhtsaStars ? `${detail.nhtsaStars}/5` : 'Not rated',
                base: b ? (b.nhtsaStars ? `${b.nhtsaStars}/5` : 'Not rated') : undefined,
                cell: b && detail.nhtsaStars && b.nhtsaStars
                  ? (detail.nhtsaStars === b.nhtsaStars
                      ? <span className="pill same">= same</span>
                      : detail.nhtsaStars > b.nhtsaStars
                        ? <span className="pill good">+{detail.nhtsaStars - b.nhtsaStars} star{detail.nhtsaStars - b.nhtsaStars > 1 ? 's' : ''}</span>
                        : <span className="pill bad">{detail.nhtsaStars - b.nhtsaStars} star{(detail.nhtsaStars - b.nhtsaStars) < -1 ? 's' : ''}</span>)
                  : (b ? <span className="pill same">n/a</span> : undefined) },
              { label: 'Front legroom', mine: `${detail.legroom}″`, base: b ? `${b.legroom}″` : undefined,
                cell: b && b.legroom !== detail.legroom
                  ? <span className="pill same">{detail.legroom > b.legroom ? `+${(detail.legroom - b.legroom).toFixed(1)}″ roomier` : `${(detail.legroom - b.legroom).toFixed(1)}″ tighter`}</span>
                  : (b ? <span className="pill same">= same</span> : undefined) },
              { label: 'Hands-free driving', mine: detail.handsFree ? 'Yes' : 'No', base: b ? (b.handsFree ? 'Yes' : 'No') : undefined,
                cell: b && b.handsFree !== detail.handsFree
                  ? (detail.handsFree ? <span className="pill good">gains hands-free</span> : <span className="pill bad">loses hands-free</span>)
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
            const gfk = garageFit(detail, f.garageWidth);
            if (gfk) keys.push(gfk.ok ? { dir: 'up', text: `Fits your garage with ${gfk.clearance.toFixed(1)}″ to spare` } : { dir: 'dn', text: `${(-gfk.clearance).toFixed(1)}″ too wide for your garage opening` });
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
                  <button type="button" className="d-photo as-btn" onClick={() => setPhotoFull(detail)} aria-label={`View full image of ${detail.year} ${detail.make} ${detail.model}`} title="Click to view full image">
                    <img src={detail.imageUrl} alt={`${detail.year} ${detail.make} ${detail.model}`} onError={(e) => e.currentTarget.closest('.d-photo')?.remove()} />
                    <span className="fuel">{detail.fuel}{detail.rangeMi ? ` · ${detail.rangeMi}mi` : ''}</span>
                    <span className="expand-badge" aria-hidden="true">Full image</span>
                  </button>
                )}
                <span className="kicker">Closer analysis{detail.verified ? ' · specs verified' : ''}</span>
                <h2>{detail.year} {detail.make} {detail.model} <small style={{ color: 'var(--muted)' }}>{detail.trim}</small></h2>
                <p className="d-sub">{detail.body} · {detail.doors} doors · {detail.seats} seats · {detail.fuel}{detail.handsFree ? ' · hands-free driving' : ''}</p>
                {v ? <p className="verdict" role="status">{v}</p> : <p className="verdict">{baseline ? 'This is your baseline vehicle — everything compares against it.' : 'Set a baseline to see upgrade/trade-off verdicts here.'}</p>}
                {!!keys.length && (
                  <>
                    <h3 className="keys-h">Key differences</h3>
                    <ul className="keys">
                      {keys.slice(0, 3).map((k, i) => (
                        <li key={i} className={k.dir}>{k.text}</li>
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
                          ? <span className="pill good">{(baseCO2 - myCO2).toFixed(1)} t less</span>
                          : <span className="pill bad">+{(myCO2 - baseCO2).toFixed(1)} t</span>)
                      : (b ? <span className="pill same">n/a</span> : null)}</span>
                  </div>
                  {myKwh && (
                    <div className="arow" role="row">
                      <span role="cell">Annual consumption</span>
                      <span role="cell"><b>{Math.round(myKwh.amount).toLocaleString()} {myKwh.unit}</b></span>
                      <span role="cell">{b && (() => { const bk = annualEnergy(b); return bk && bk.unit === myKwh.unit && bk.amount !== myKwh.amount ? (
                        bk.amount > myKwh.amount
                          ? <span className="pill good">{Math.round(bk.amount - myKwh.amount).toLocaleString()} {myKwh.unit} less</span>
                          : <span className="pill bad">+{Math.round(myKwh.amount - bk.amount).toLocaleString()} {myKwh.unit}</span>
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
                        ? <span className="pill good">saves {money(base5.total - my5.total)}</span>
                        : <span className="pill bad">{money(my5.total - base5.total)} more</span>)
                    : null}</span></div>
                </div>

                <h3 className="keys-h">Garage fit, visualised</h3>
                <div className="gfit">
                  {[
                    { name: detail.model, f: detail.widthFolded, e: detail.widthExtended, cls: 'me' },
                    ...(b ? [{ name: `${b.model} (baseline)`, f: b.widthFolded, e: b.widthExtended, cls: 'base' }] : []),
                    ...(f.garageWidth ? [{ name: 'Your garage opening', f: f.garageWidth, e: f.garageWidth, cls: 'garage' }] : []),
                  ].map((r) => (
                    <div className="grow" key={r.name}>
                      <span className="gname">{r.name}</span>
                      <div className="gtrack">
                        <span className={`gbar ${r.cls}`} style={{ left: `${wPct(r.f)}%`, width: `${Math.max(1.5, +wPct(r.e) - +wPct(r.f))}%` }} />
                      </div>
                      <span className="gval">{r.f}″–{r.e}″</span>
                    </div>
                  ))}
                  <p className="fnote" style={{ marginTop: 6 }}>Bar spans folded → mirrors-out width on a {WMIN}–{WMAX}″ scale. Mirror swing: {((detail.widthExtended - detail.widthFolded)).toFixed(1)}″{b && ` vs baseline ${((b.widthExtended - b.widthFolded)).toFixed(1)}″`}{f.garageWidth ? ` · your opening: ${f.garageWidth}″` : ''}.</p>
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
                <p className="fnote">Fuel-cost estimate assumes {MILES_YR.toLocaleString()} mi/yr at ${GAS_PRICE.toFixed(2)}/gal gas and ${ELEC_PRICE.toFixed(2)}/kWh electricity; CO₂ uses 8.89 kg/gal and 0.39 kg/kWh (US avg grid). 5-yr sketch = 55% depreciation + fuel, excl. insurance/maintenance. PHEV figures are blended — check EPA numbers. 2024+ prices are MSRP; 2015–2023 prices are typical used-market values (rounded estimates). Some mirrors-out widths for older years are estimated from body width. Snapshot pricing, not dealer quotes.</p>
                {detail.imageCredit && <p className="credit">{detail.imageCredit}</p>}
                <p className="d-actions">
                  <button className="btn primary" onClick={() => { patch({ baselineId: detail.id }); closeDetail(); }}>Set as baseline</button>{' '}
                  <button className="btn" onClick={() => { toggleCmp(detail.id); closeDetail(); }}>+ Compare tray</button>{' '}
                  <button className="btn ghost" onClick={closeDetail}>Back to results</button>
                </p>
              </>
            );
          })()}
          </div>
        </div>
      )}
      {photoFull?.imageUrl && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label={`Full image of ${photoFull.year} ${photoFull.make} ${photoFull.model}`} onClick={() => setPhotoFull(null)}>
          <button type="button" className="lb-close" onClick={() => setPhotoFull(null)} aria-label="Close full image">Close</button>
          <img className="lb-img" src={photoFull.imageUrl} alt={`${photoFull.year} ${photoFull.make} ${photoFull.model} full image`} onClick={(e) => e.stopPropagation()} />
          {photoFull.imageCredit && <p className="lb-credit" onClick={(e) => e.stopPropagation()}>{photoFull.imageCredit}</p>}
        </div>
      )}

      {toast && <div className="toast show" role="status" aria-live="polite">{toast}</div>}
      <button className={'totop' + (showTop ? ' show' : '')} onClick={() => jump('results')} aria-hidden={!showTop} tabIndex={showTop ? 0 : -1} aria-label="Back to top">Top</button>
      <footer className="foot">
        <div className="wrap foot-in">
          <div className="foot-brand">
            <img className="logo" src="logo.svg" alt="" aria-hidden="true" />
            <div><strong>GarageFit</strong><small>Find cars that actually fit your life</small></div>
            <p>Compare {VEHICLES.length} vehicles against your own car — price, efficiency, garage fit, safety and seats, side by side.</p>
          </div>
          <nav className="foot-nav" aria-label="Footer">
            <div className="fcol">
              <h4>Explore</h4>
              <a href="#baseline" onClick={(e) => { e.preventDefault(); jump('baseline'); }}>Your baseline</a>
              <a href="#browse" onClick={(e) => { e.preventDefault(); jump('browse'); }}>Browse &amp; filter</a>
              <a href="#results" onClick={(e) => { e.preventDefault(); jump('results'); }}>Results</a>
            </div>
            <div className="fcol">
              <h4>Actions</h4>
              <button className="linklike" onClick={share}>Share view</button>
              <button className="linklike" onClick={() => window.print()}>Print</button>
            </div>
            <div className="fcol">
              <h4>Data</h4>
              <span>Snapshot {DATA_STAMP}</span>
              <span>{VEHICLES.length} vehicles · {VEHICLES.filter((v) => v.verified).length} verified specs</span>
              <span>MSRP in USD · 2015–23 values are typical used prices</span>
            </div>
          </nav>
        </div>
        <div className="wrap foot-base">
          <span>© 2026 GarageFit · Specs checked against EPA, NHTSA and manufacturer data</span>
          <span>Photos via Wikimedia Commons — full credit on each vehicle</span>
        </div>
      </footer>
    </>
  );
}
