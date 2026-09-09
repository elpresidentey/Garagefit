import { useEffect, useRef, useState } from 'react';
import { VEHICLES } from './data';
import type { Vehicle } from './types';

const appLink = (q = '') => `#/app${q}`;
const money = (n: number) => '$' + Math.round(n).toLocaleString();

const HERO_FRAMES = [
  {
    src: 'vehicles/mercedes-s-500-2024.jpg', alt: 'Mercedes S-Class driving through the city', label: 'The long view', position: '58% center',
    eyebrow: 'GarageFit · 2026 vehicle guide', headA: 'Find the car', headB: 'that fits.',
    sub: 'Measure the things that matter before the test drive: your garage, your budget and the road ahead.',
  },
  {
    src: 'vehicles/lucid-air-2024.jpg', alt: 'Lucid Air electric sedan', label: 'Electric forward', position: '52% center',
    eyebrow: 'GarageFit · EVs, judged fairly', headA: 'Electric,', headB: 'made obvious.',
    sub: 'Range, charging speed and true five-year cost — gas and electric on equal terms.',
  },
  {
    src: 'vehicles/bmw-i4-2024.jpg', alt: 'BMW i4 electric car', label: 'Daily driver', position: '56% center',
    eyebrow: 'GarageFit · 196 vehicles', headA: 'Built for', headB: 'the daily drive.',
    sub: 'Every option measured against the car you have, the garage you own and the budget you set.',
  },
];

function useReveal() {
  useEffect(() => {
    const els = [...document.querySelectorAll('.rv')];
    if (!('IntersectionObserver' in window)) {
      els.forEach((e) => e.classList.add('vis'));
      return;
    }
    // Two-way reveal: elements animate in whether you scroll down to them or
    // back up to them — leaving the viewport resets them so they replay.
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.target.classList.toggle('vis', e.isIntersecting)),
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' }
    );
    els.forEach((e) => io.observe(e));
    const nav = document.querySelector<HTMLElement>('.t-nav');
    const hero = document.querySelector<HTMLElement>('.t-hero');
    const onScroll = () => {
      nav?.classList.toggle('scrolled', window.scrollY > 24);
      const scrollable = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      nav?.style.setProperty('--nav-progress', String(Math.min(1, window.scrollY / scrollable)));
      // Scroll-linked hero: copy drifts up and dims as the hero scrolls away.
      if (hero) {
        const p = Math.max(0, Math.min(1, window.scrollY / (hero.offsetHeight * 0.7)));
        hero.style.setProperty('--par', p.toFixed(4));
      }
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    const root = document.documentElement;
    root.classList.add('gf-smooth');
    return () => {
      io.disconnect();
      window.removeEventListener('scroll', onScroll);
      root.classList.remove('gf-smooth');
    };
  }, []);
}

/** Scrollspy: light up the nav pill for the section currently in view. */
function useScrollSpy() {
  useEffect(() => {
    const links = [...document.querySelectorAll<HTMLAnchorElement>('.t-links a')];
    if (!links.length || !('IntersectionObserver' in window)) return;
    const byId = new Map<string, HTMLAnchorElement>();
    links.forEach((l) => {
      const id = l.getAttribute('href')?.replace('#', '');
      if (id) byId.set(id, l);
    });
    const io = new IntersectionObserver(
      (es) => {
        es.forEach((e) => {
          if (!e.isIntersecting) return;
          links.forEach((l) => l.classList.remove('on'));
          byId.get(e.target.id)?.classList.add('on');
        });
      },
      { rootMargin: '-35% 0px -55% 0px' }
    );
    byId.forEach((_, id) => {
      const sec = document.getElementById(id);
      if (sec) io.observe(sec);
    });
    return () => io.disconnect();
  }, []);
}

function Count({ to, suffix = '' }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        const t0 = performance.now(), dur = 1100;
        const tick = (t: number) => {
          const p = Math.min(1, (t - t0) / dur);
          setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
          if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [to]);
  return <span ref={ref}>{n.toLocaleString()}{suffix}</span>;
}

/** One-tap garage sizes: opening width × usable depth × door height, in inches. */
const GARAGE_PRESETS = [
  { name: 'Single', w: 96, d: 228, h: 84 },
  { name: 'Double', w: 192, d: 228, h: 84 },
];

function loadGarage(): [number, number, number] {
  try {
    const g = JSON.parse(localStorage.getItem('gf-garage') || 'null');
    if (g && typeof g === 'object') return [+g.w || 0, +g.d || 0, +g.h || 0];
  } catch { /* fresh start */ }
  return [88, 0, 0];
}

/** Smart 3D fit checker: width + depth + height, live top matches, near-misses, presets, persisted. */
function FitStrip() {
  const [dims, setDims] = useState<[number, number, number]>(loadGarage);
  const [gw, gl, gh] = dims;
  useEffect(() => {
    try { localStorage.setItem('gf-garage', JSON.stringify({ w: gw, d: gl, h: gh })); } catch { /* private mode */ }
  }, [gw, gl, gh]);
  const set = (i: number, v: number) =>
    setDims((d) => { const n: [number, number, number] = [d[0], d[1], d[2]]; n[i] = v; return n; });
  const num = (v: string, max: number) => (v === '' ? 0 : Math.min(max, Math.max(0, +v)));
  const applyPreset = (p: { w: number; d: number; h: number }) => setDims([p.w, p.d, p.h]);
  const activePreset = GARAGE_PRESETS.find((p) => p.w === gw && p.d === gl && p.h === gh)?.name;

  // Per-car clearances on each SET dimension; unset dims are ignored.
  const clearances = (v: Vehicle): { w: number | null; d: number | null; h: number | null } => ({
    w: gw > 0 ? +(gw - v.widthExtended).toFixed(1) : null,
    d: gl > 0 && v.lengthIn != null ? +(gl - v.lengthIn).toFixed(1) : null,
    h: gh > 0 && v.heightIn != null ? +(gh - v.heightIn).toFixed(1) : null,
  });
  const dimsSet = (gw > 0 ? 1 : 0) + (gl > 0 ? 1 : 0) + (gh > 0 ? 1 : 0);
  const fits3 = (v: Vehicle) => {
    const c = clearances(v);
    const vals = [c.w, c.d, c.h].filter((x): x is number => x !== null);
    return vals.length > 0 && vals.every((x) => x >= 0);
  };
  const minClear = (v: Vehicle) => {
    const vals = Object.values(clearances(v)).filter((x): x is number => x !== null);
    return vals.length ? Math.min(...vals) : Infinity;
  };

  const matches = dimsSet > 0 ? VEHICLES.filter(fits3).sort((a, b) => minClear(a) - minClear(b)) : [];
  const top = matches.slice(0, 5);
  const nearMiss = gw > 0
    ? VEHICLES.filter((v) => { const c = +(gw - v.widthExtended).toFixed(1); return c < 0 && c >= -3; })
      .sort((a, b) => (gw - b.widthExtended) - (gw - a.widthExtended)).slice(0, 3)
    : [];
  const gaugeCars = LINEUP.map((c) => VEHICLES.find((v) => v.id === c.id)!).filter(Boolean);
  const scaleLo = gaugeCars.length ? Math.min(...gaugeCars.map((c) => c.widthExtended)) - 8 : 60;
  const scaleHi = gaugeCars.length ? Math.max(...gaugeCars.map((c) => c.widthExtended)) + 8 : 100;
  const pct = (x: number) => Math.max(0, Math.min(100, ((x - scaleLo) / (scaleHi - scaleLo)) * 100));
  const dimWord = [gw > 0 && `${gw}″ wide`, gl > 0 && `${gl}″ deep`, gh > 0 && `${gh}″ tall`].filter(Boolean).join(' · ');
  const link = dimsSet > 0
    ? appLink(`?gw=${gw}&gl=${gl}&gh=${gh}&gwOnly=1`)
    : appLink();
  const fields: { label: string; value: number; max: number; ph: string; hint: string }[] = [
    { label: 'Opening width', value: gw, max: 220, ph: '88', hint: 'in' },
    { label: 'Usable depth', value: gl, max: 400, ph: '228', hint: 'in' },
    { label: 'Door height', value: gh, max: 200, ph: '84', hint: 'in' },
  ];

  return (
    <div className="t-fit rv">
      <div className="t-gauge" aria-hidden="true">
        <span className="t-gauge-fill" style={{ width: gw > 0 ? `${pct(gw)}%` : '0%' }} />
        {gaugeCars.map((c) => (
          <span
            key={c.id}
            className={`t-gauge-tick ${dimsSet > 0 && fits3(c) ? 'fits' : dimsSet > 0 ? 'wide' : ''}`}
            style={{ left: `${pct(c.widthExtended)}%` }}
          />
        ))}
        <span className="t-gauge-open" style={{ left: gw > 0 ? `${pct(gw)}%` : '0%', opacity: gw > 0 ? 1 : 0 }}>
          <em>your opening</em>
        </span>
      </div>
      <div className="t-fit-row">
        {fields.map((f, i) => (
          <label className="t-fit-field" key={f.label}>
            <span>{f.label}</span>
            <span className="t-fit-input">
              <input
                type="number" inputMode="decimal" min={0} max={f.max} step={0.5}
                value={f.value || ''} placeholder={f.ph}
                aria-label={`${f.label} in inches`}
                onChange={(e) => set(i, num(e.target.value, f.max))}
              />
              <em>{f.hint}</em>
            </span>
          </label>
        ))}
        <div className="t-fit-field">
          <span>Garage type</span>
          <span className="t-fit-presets" role="group" aria-label="Garage presets">
            {GARAGE_PRESETS.map((p) => (
              <button key={p.name} type="button" className={activePreset === p.name ? 'on' : ''} onClick={() => applyPreset(p)} aria-pressed={activePreset === p.name}>
                {p.name}
              </button>
            ))}
            {dimsSet > 0 && <button type="button" onClick={() => setDims([0, 0, 0])}>Clear</button>}
          </span>
        </div>
      </div>
      {dimsSet > 0 ? (
        <>
          <p className="t-fit-count">
            <strong><Count to={matches.length} /></strong>
            of {VEHICLES.length} vehicles fit{dimWord ? ` — ${dimWord}` : ''}
          </p>
          {top.length > 0 && (
            <div className="t-matches" aria-live="polite" aria-label="Closest fits">
              {top.map((v) => (
                <a className="t-match" key={v.id} href={appLink(`?b=${v.id}&gw=${gw}&gl=${gl}&gh=${gh}`)}>
                  {v.imageUrl && <img src={v.imageUrl} alt="" loading="lazy" />}
                  <span title={`${v.year} ${v.make} ${v.model} ${v.trim}`}><b>{v.year} {v.make} {v.model}</b><em>{minClear(v).toFixed(1)}″ to spare</em></span>
                </a>
              ))}
            </div>
          )}
          {nearMiss.length > 0 && (
            <p className="t-near" aria-live="polite">
              Just misses: {nearMiss.map((v) => `${v.model} (+${(v.widthExtended - gw).toFixed(1)}″)`).join(' · ')}
            </p>
          )}
        </>
      ) : (
        <p className="t-fit-count">Type any dimension to see what fits</p>
      )}
      <div className="t-fit-verdicts" aria-live="polite">
        {dimsSet > 0
          ? gaugeCars.map((c) => {
              const ok = fits3(c);
              const cl = minClear(c);
              return (
                <span key={c.id} className={`t-verdict ${ok ? 'good' : 'bad'}`}>
                  <b>{c.model}</b> {ok ? `${cl.toFixed(1)}″ spare` : 'doesn’t fit'}
                </span>
              );
            })
          : <span className="t-verdict idle">Headliners will report here</span>}
      </div>
      <a className="t-btn t-btn-dark" href={link}>See them in the app</a>
    </div>
  );
}

const LINEUP = [
  {
    id: 'tesla-model-y-2024', name: 'Model Y', line: 'Long Range AWD · 310 mi · $47,990',
    eyebrow: 'Electric everyday',
    img: 'vehicles/tesla-model-y-2024.jpg',
    chips: ['310 mi range', 'Dual AWD', 'From $47,990'],
  },
  {
    id: 'toyota-rav4-2024-le', name: 'RAV4', line: 'LE AWD · 30 MPG · $30,075',
    eyebrow: 'The all-rounder',
    img: 'vehicles/toyota-rav4-2024-le.jpg',
    chips: ['30 MPG', 'AWD', 'From $30,075'],
  },
  {
    id: 'ford-f150-2024', name: 'F-150', line: 'XL SuperCrew 4WD · 20 MPG · $47,600',
    eyebrow: 'Works hard',
    img: 'vehicles/ford-f150-2024.jpg',
    chips: ['America\'s truck', '4WD', 'From $47,600'],
  },
];

const FEATURES = [
  {
    img: 'vehicles/honda-pilot-2024.jpg', k: 'Garage fit',
    t: 'Measured against your actual garage', d: 'Width, depth and door height — every car gets a fits or doesn’t-fit verdict with inches to spare. No tape measure required twice.',
    chips: ['Width', 'Depth', 'Door height'],
  },
  {
    img: 'vehicles/toyota-prius-2024.jpg', k: 'True cost',
    t: 'Five years of ownership, honestly', d: 'Fuel at your mileage and prices, depreciation, CO₂ and monthly payments. Assumptions adjustable, never hardcoded.',
    chips: ['Fuel', 'Depreciation', 'Monthly'],
  },
  {
    img: 'vehicles/hyundai-ioniq-5-2024.jpg', k: 'EV ready',
    t: 'Gas to electric, apples to apples', d: 'Range minimums, MPGe on equal footing, DC fast-charge rates and charging-cost math across all 21 EVs.',
    chips: ['Range', 'MPGe', 'Fast charge'],
  },
];

const STEPS = ['Set your baseline', 'Measure your garage', 'Filter & compare', 'Decide with numbers'];

/** Rotating stories for the "Built for the real world" panel — same cadence as the hero. */
const DECISION_FRAMES = [
  { src: 'vehicles/honda-pilot-2024.jpg', alt: 'Honda Pilot parked outdoors', n: '01', cap: 'The decision starts at home.' },
  { src: 'vehicles/toyota-prius-2024.jpg', alt: 'Toyota Prius hybrid on the road', n: '02', cap: 'Know what it really costs.' },
  { src: 'vehicles/hyundai-ioniq-5-2024.jpg', alt: 'Hyundai Ioniq 5 electric SUV', n: '03', cap: 'Go electric with confidence.' },
];

function DecisionMedia() {
  const [frame, setFrame] = useState(0);
  const [live, setLive] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(([e]) => setLive(e.isIntersecting), { threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!live) return;
    // Same as hero: instant cuts under reduced motion, crossfade otherwise.
    const t = window.setInterval(() => setFrame((f) => (f + 1) % DECISION_FRAMES.length), 6200);
    return () => window.clearInterval(t);
  }, [live]);
  return (
    <div className="t-decision-media rv" ref={ref}>
      {DECISION_FRAMES.map((f, i) => (
        <figure className={`t-decision-slide ${frame === i ? 'active' : ''}`} key={f.src} aria-hidden={frame !== i}>
          <img src={f.src} alt={f.alt} loading="lazy" />
          <div className="t-decision-scrim" aria-hidden="true" />
          <figcaption><span>{f.n}</span> {f.cap}</figcaption>
        </figure>
      ))}
      <div className="t-decision-frames" role="group" aria-label="Choose story">
        {DECISION_FRAMES.map((f, i) => (
          <button
            key={f.src} type="button"
            className={frame === i ? 'on' : ''}
            onClick={() => setFrame(i)}
            aria-label={`Show story ${f.n}: ${f.cap}`}
            aria-pressed={frame === i}
          />
        ))}
      </div>
    </div>
  );
}

const FAQS = [
  {
    q: 'Is GarageFit free?',
    a: 'Yes. All 196 vehicles, garage fit, cost math and sharing are free, work offline after first load, and need no account.',
  },
  {
    q: 'Where do the specs come from?',
    a: 'Manufacturer specifications, EPA fuel economy, IIHS safety and NHTSA ratings. 2024+ prices are MSRP including destination; 2015–2023 values are typical used-market estimates.',
  },
  {
    q: 'How do I measure my garage?',
    a: 'The narrowest opening width, usable depth wall-to-door, and door height. Enter them once — every vehicle then shows clearance in inches.',
  },
  {
    q: 'My car isn’t listed. Can I still compare?',
    a: 'Yes — “Add my car” captures your car’s basics in seconds. It’s saved in your browser and works as a baseline, in filters and in comparisons.',
  },
];

const PREVIEW_IDS = ['toyota-rav4-2026-le-awd', 'tesla-model-y-2026-long-range-awd', 'honda-civic-2025-sport-hybrid'];

/** Comparison preview with crosshair column highlight — hover a car, its whole column lights up. */
function CompareTable({ gw }: { gw: number }) {
  const cars = PREVIEW_IDS.map((id) => VEHICLES.find((v) => v.id === id)!).filter(Boolean);
  const best = Math.min(...cars.map((c) => c.msrp));
  const [hl, setHl] = useState(-1);
  const col = (i: number) => ({ className: hl === i ? 'hl' : undefined, onMouseEnter: () => setHl(i) });
  return (
    <div className="t-table-wrap rv" onMouseLeave={() => setHl(-1)}>
      <table>
        <thead>
          <tr>
            <th scope="col"><span className="sr-only">Dimension</span></th>
            {cars.map((c, i) => (
              <th scope="col" key={c.id} {...col(i)}><a href={appLink(`?b=${c.id}`)}>{c.year} {c.make} {c.model}<small>{c.trim}</small></a></th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr><th scope="row">Price</th>{cars.map((c, i) => <td key={c.id} {...col(i)}>{money(c.msrp)}{c.msrp === best && <em className="t-best">Best</em>}</td>)}</tr>
          <tr><th scope="row">Efficiency</th>{cars.map((c, i) => <td key={c.id} {...col(i)}>{c.eff} {c.effUnit}</td>)}</tr>
          <tr><th scope="row">Width</th>{cars.map((c, i) => <td key={c.id} {...col(i)}>{c.widthExtended}″</td>)}</tr>
          <tr>
            <th scope="row">{gw}″ garage</th>
            {cars.map((c, i) => {
              const cl = +(gw - c.widthExtended).toFixed(1);
              return (
                <td key={c.id} {...col(i)}>
                  {cl >= 0
                    ? <span className="pill good">{cl.toFixed(1)}″ spare</span>
                    : <span className="pill bad">{(-cl).toFixed(1)}″ too wide</span>}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function VehicleSlider() {
  const brands = [...new Set(VEHICLES.map((v) => v.make))];
  const duplicatedBrands = [...brands, ...brands];

  return (
    <div className="t-slider-marquee">
      {duplicatedBrands.map((brand, index) => (
        <span className="t-slider-brand" key={`${brand}-${index}`}>
          {brand}
        </span>
      ))}
    </div>
  );
}

export default function Landing() {
  useReveal();
  useScrollSpy();
  const [heroFrame, setHeroFrame] = useState(0);
  const [heroPaused, setHeroPaused] = useState(false);
  const years = VEHICLES.map((v) => v.year);
  const lo = Math.min(...years), hi = Math.max(...years);
  const evs = VEHICLES.filter((v) => v.fuel === 'EV').length;
  const gw = 88;

  useEffect(() => {
    const onVis = () => setHeroPaused(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    onVis();
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => {
    if (heroPaused) return;
    // Rotates for everyone: motion-safe users get the crossfade, reduced-motion
    // users get instant cuts (all transitions are disabled for them in CSS).
    // HERO_DWELL: each frame stays a full 8s so the headline can be read; matches t-dotfill.
    const timer = window.setInterval(() => setHeroFrame((frame) => (frame + 1) % HERO_FRAMES.length), 8000);
    return () => window.clearInterval(timer);
  }, [heroPaused]);

  return (
    <div className="lp t">
      <a className="skip" href="#t-models">Skip to content</a>

      <header className="t-nav">
        <a className="t-logo" href="#top" aria-label="GarageFit home">
          <img src="logo.svg" alt="" aria-hidden="true" />
          <span className="t-logo-label"><strong>GARAGEFIT</strong><small>Car guide</small></span>
        </a>
        <nav className="t-links" aria-label="Landing">
          <a href="#t-models">Vehicles</a>
          <a href="#t-compare">Compare</a>
          <a href="#t-how">How It Works</a>
          <a href="#t-faq">FAQ</a>
        </nav>
        <span className="t-nav-ctas">
          <a className="t-nav-utility" href="#t-models">Explore vehicles <span aria-hidden="true">↗</span></a>
          <a className="t-btn t-btn-dark t-btn-sm" href={appLink()}>Start comparing <span aria-hidden="true">→</span></a>
        </span>
      </header>

      <main id="top">
        <section
          className="t-hero"
          aria-label="GarageFit introduction"
          onMouseEnter={() => setHeroPaused(true)}
          onMouseLeave={() => setHeroPaused(document.hidden)}
        >
          <div className="t-hero-media" aria-live="polite">
            {HERO_FRAMES.map((frame, index) => (
              <img
                className={`t-hero-img ${heroFrame === index ? 'active' : ''}`}
                src={frame.src}
                alt={frame.alt}
                style={{ objectPosition: frame.position }}
                aria-hidden={heroFrame !== index}
                loading={index === 0 ? 'eager' : 'lazy'}
                fetchPriority={index === 0 ? 'high' : 'auto'}
                key={frame.src}
              />
            ))}
          </div>
          <div className="t-hero-scrim" aria-hidden="true" />
          <div className="t-hero-copy">
            <div className="t-hero-title">
              <div className="t-hero-swap" key={`t-${heroFrame}`}>
                <p className="t-eyebrow t-hero-reveal t-hero-kicker">{HERO_FRAMES[heroFrame].eyebrow}</p>
                <h1 className="t-hero-reveal t-hero-headline"><span>{HERO_FRAMES[heroFrame].headA}</span><i>{HERO_FRAMES[heroFrame].headB}</i></h1>
              </div>
            </div>
            <div className="t-hero-bottom t-hero-reveal">
              <div className="t-hero-swap" key={`b-${heroFrame}`}>
                <p>{HERO_FRAMES[heroFrame].sub}</p>
              </div>
              <div className="t-hero-cta">
                <a className="t-btn t-btn-solid" href={appLink()}>Find your fit</a>
                <a className="t-btn t-btn-outline" href="#t-how">See how it works</a>
              </div>
              <p className="t-hero-note">{VEHICLES.length} vehicles · Free to use · No account</p>
            </div>
          </div>
          <div className="t-hero-frames" aria-label="Hero vehicle photos">
            {HERO_FRAMES.map((frame, index) => (
              <button
                type="button"
                className={heroFrame === index ? 'on' : ''}
                onClick={() => setHeroFrame(index)}
                aria-label={`Show ${frame.label} photo`}
                aria-pressed={heroFrame === index}
                key={frame.src}
              />
            ))}
          </div>
          <a className="t-scroll" href="#t-models" aria-label="Scroll to vehicles">↓</a>
        </section>

        <section id="t-models" className="t-models" aria-label="Featured vehicles">
          <div className="t-models-heading wrap rv">
            <p className="t-kicker">Start with a point of view</p>
            <h2>A few good places<br/>to begin.</h2>
            <p>Every vehicle is measured on the same terms, so the comparison starts clear and stays useful.</p>
          </div>
          <div className="t-models-grid">
          {LINEUP.map((c) => (
            <article className="t-panel" key={c.id}>
              <img src={c.img} alt={`${c.name} vehicle photo`} loading="lazy" />
              <div className="t-panel-scrim" aria-hidden="true" />
              <div className="t-panel-copy rv">
                <span className="t-pill">{c.eyebrow}</span>
                <h3>{c.name}</h3>
                <p>{c.line}</p>
                <div className="t-panel-chips">
                  {c.chips.map((s) => <span key={s}>{s}</span>)}
                </div>
                <div className="t-panel-cta">
                  <a className="t-btn t-btn-solid" href={appLink(`?b=${c.id}`)}>Compare</a>
                  <a className="t-btn t-btn-outline" href={appLink()}>All Cars</a>
                </div>
              </div>
            </article>
          ))}
          </div>
        </section>

        <section className="t-slider" aria-label="All vehicles">
          <div className="t-slider-in">
            <div className="t-slider-header rv">
              <h2>Explore all {VEHICLES.length} vehicles</h2>
              <p>Browse the complete lineup of cars, SUVs, and EVs with detailed dimensions, efficiency ratings, and pricing.</p>
            </div>
            <VehicleSlider />
          </div>
        </section>

        <section className="t-strip" aria-label="Garage fit checker">
          <div className="wrap">
            <p className="t-kicker rv">Fit checker</p>
            <h2 className="rv">Will it fit in your garage?</h2>
            <FitStrip />
          </div>
        </section>

        <section className="t-stats" aria-label="GarageFit in numbers">
          <div className="wrap t-stats-in">
            {[
              { v: <Count to={VEHICLES.length} />, s: 'Vehicles' },
              { v: <Count to={evs} />, s: 'EVs' },
              { v: <Count to={hi - lo + 1} suffix=" yrs" />, s: 'Model years' },
              { v: <Count to={3} />, s: 'Fit dimensions' },
            ].map(({ v, s }) => (
              <div className="rv" key={s}><b>{v}</b><span>{s}</span></div>
            ))}
          </div>
        </section>

        <section className="t-decision" aria-label="A better way to choose a car">
          <div className="t-decision-inner">
            <DecisionMedia />
            <div className="t-decision-copy rv">
              <p className="t-kicker">Built for the real world</p>
              <h2>Choose for the life you have.</h2>
              <p className="t-decision-lede">Check the dimensions, monthly ownership cost and real-world range before your shortlist becomes a compromise.</p>
              <ol className="t-decision-list">
                <li><b>01</b><span><strong>Measure your space</strong>Know the clearance before the driveway does.</span></li>
                <li><b>02</b><span><strong>Set your baseline</strong>Compare every option to the car you have now.</span></li>
                <li><b>03</b><span><strong>See the trade-offs</strong>Price, efficiency and fit — in one clear view.</span></li>
              </ol>
              <a className="t-arrow-link t-arrow-dark" href={appLink()}>Build your comparison <span aria-hidden="true">→</span></a>
            </div>
          </div>
        </section>

        <section className="t-editorial" aria-label="What GarageFit does">
          <div className="wrap">
            <h2 className="rv">Comparison built for the way you actually decide</h2>
            <div className="t-editorial-grid">
              {FEATURES.map((f) => (
                <div className="t-editorial-col rv" key={f.k}>
                  <p className="t-editorial-k">{f.k}</p>
                  <h3>{f.t}</h3>
                  <p>{f.d}</p>
                  <a className="t-arrow-link t-arrow-dark" href={appLink()}>Explore in the app <span aria-hidden="true">→</span></a>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="t-compare" className="t-table-sec" aria-label="Comparison preview">
          <div className="wrap">
            <h2 className="rv">Three headliners, one {gw}″ garage</h2>
            <CompareTable gw={gw} />
            <p className="rv"><a className="t-btn t-btn-dark" href={appLink()}>Full Comparison</a></p>
          </div>
        </section>

        <section id="t-how" className="t-how" aria-label="How it works">
          <div className="wrap">
            <h2 className="rv">Four steps. Zero guesswork.</h2>
            <ol>
              {STEPS.map((s, i) => (
                <li className="rv" key={s}><b>0{i + 1}</b><span>{s}</span></li>
              ))}
            </ol>
          </div>
        </section>

        <section className="t-band" aria-label="Open the app">
          <div className="wrap rv">
            <h3>Get behind the numbers</h3>
            <a className="t-btn t-btn-dark" href={appLink()}>Open the app</a>
          </div>
        </section>

        <section id="t-faq" className="t-faq" aria-label="Frequently asked questions">
          <div className="wrap t-faq-in">
            <h2 className="rv">Questions</h2>
            {FAQS.map((f) => (
              <details className="rv" key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="t-explore" aria-label="Keep exploring">
          <div className="wrap rv">
            <p>Keep exploring</p>
            <div>
              <a href={appLink()}>Compare cars</a>
              <a href={appLink('?preset=ev50')}>EVs under $50k</a>
              <a href="#t-compare">Fit table</a>
              <a href="#t-faq">FAQ</a>
            </div>
          </div>
        </section>

        <section className="t-final" aria-label="Get started">
          <div className="wrap rv">
            <h2>Stop guessing.<br/>Start fitting.</h2>
            <div className="t-final-side">
              <p>{VEHICLES.length} vehicles measured against your garage, your budget and five years of true cost — before you ever set foot in a dealership.</p>
              <div>
                <a className="t-btn t-btn-solid" href={appLink()}>Compare Cars</a>
                <a className="t-arrow-link" href={appLink('?preset=fam')}>Family SUVs <span aria-hidden="true">→</span></a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="t-foot">
        <div className="wrap t-foot-top">
          <div className="t-foot-brand">
            <p className="t-foot-state">Find the car that fits your life.</p>
            <p className="t-foot-sub">Free, works offline after first load, no account. Built for the decision everyone actually makes in the driveway.</p>
          </div>
          <nav className="t-foot-cols" aria-label="Footer">
            <div>
              <h3>Product</h3>
              <a href={appLink()}>Open the app</a>
              <a href={appLink('?preset=ev50')}>EVs under $50k</a>
              <a href="#t-compare">Compare</a>
            </div>
            <div>
              <h3>Learn</h3>
              <a href="#t-how">How it works</a>
              <a href="#t-faq">FAQ</a>
              <a href="#t-models">Vehicles</a>
            </div>
          </nav>
        </div>
        <p className="t-mark" aria-hidden="true">GARAGEFIT</p>
        <div className="wrap t-foot-bottom">
          <small id="t-fine">© 2026 GarageFit · Specs from manufacturer data, EPA fuel economy and NHTSA/IIHS ratings<sup>1</sup> · Photos via Wikimedia Commons</small>
          <small className="t-fine-note"><sup>1</sup> Model-year coverage reflects published manufacturer specifications; prices are MSRP including destination where noted, or typical used-market estimates for 2015–2023.</small>
        </div>
      </footer>
    </div>
  );
}
