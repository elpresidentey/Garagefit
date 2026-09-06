import { useEffect, useRef, useState } from 'react';
import { VEHICLES } from './data';

const appLink = (q = '') => `#/app${q}`;
const money = (n: number) => '$' + Math.round(n).toLocaleString();

function useReveal() {
  useEffect(() => {
    const els = [...document.querySelectorAll('.rv')];
    if (!('IntersectionObserver' in window)) {
      els.forEach((e) => e.classList.add('vis'));
      return;
    }
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && e.target.classList.add('vis')),
      { threshold: 0.1 }
    );
    els.forEach((e) => io.observe(e));
    const nav = document.querySelector('.t-nav');
    const onScroll = () => nav?.classList.toggle('scrolled', window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { io.disconnect(); window.removeEventListener('scroll', onScroll); };
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

/** One-line fit checker: type a width, get a count. */
function FitStrip() {
  const [gw, setGw] = useState(88);
  const n = VEHICLES.filter((v) => v.widthExtended <= (gw || 0)).length;
  return (
    <div className="t-fit rv">
      <label className="t-fit-field">
        <span>Your garage opening</span>
        <span className="t-fit-input">
          <input
            type="number" inputMode="decimal" min={60} max={140} step={0.5} value={gw || ''}
            placeholder="88" aria-label="Garage opening width in inches"
            onChange={(e) => setGw(e.target.value === '' ? 0 : Math.min(200, Math.max(0, +e.target.value)))}
          />
          <em>in</em>
        </span>
        <span className="t-fit-presets" role="group" aria-label="Common openings">
          {[84, 96, 108].map((w) => (
            <button key={w} type="button" className={gw === w ? 'on' : ''} onClick={() => setGw(w)} aria-pressed={gw === w}>
              {w}″
            </button>
          ))}
        </span>
      </label>
      <p className="t-fit-count">
        {gw > 0 ? <><strong><Count to={n} /></strong> of {VEHICLES.length} vehicles fit</> : 'Type a width to see what fits'}
      </p>
      <a className="t-btn t-btn-dark" href={gw > 0 ? appLink(`?gw=${gw}&gwOnly=1`) : appLink()}>See them</a>
    </div>
  );
}

const LINEUP = [
  {
    id: 'tesla-model-y-2024', name: 'Model Y', line: 'Long Range AWD · 310 mi · $47,990',
    img: 'vehicles/tesla-model-y-2024.jpg',
  },
  {
    id: 'toyota-rav4-2024-le', name: 'RAV4', line: 'LE AWD · 30 MPG · $30,075',
    img: 'vehicles/toyota-rav4-2024-le.jpg',
  },
  {
    id: 'ford-f150-2024', name: 'F-150', line: 'XL SuperCrew 4WD · 20 MPG · $47,600',
    img: 'vehicles/ford-f150-2024.jpg',
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

export default function Landing() {
  useReveal();
  const years = VEHICLES.map((v) => v.year);
  const lo = Math.min(...years), hi = Math.max(...years);
  const evs = VEHICLES.filter((v) => v.fuel === 'EV').length;
  const cars = PREVIEW_IDS.map((id) => VEHICLES.find((v) => v.id === id)!).filter(Boolean);
  const gw = 88;
  const best = Math.min(...cars.map((c) => c.msrp));

  return (
    <div className="lp t">
      <a className="skip" href="#t-models">Skip to content</a>

      <div className="t-banner" role="note">
        <span>2026 models are live — RAV4, Model Y Juniper, Palisade + 16 more</span>
        <a href={appLink()}>Open the app</a>
      </div>

      <header className="t-nav">
        <a className="t-logo" href="#top" aria-label="GarageFit home">
          <img src="logo.svg" alt="" aria-hidden="true" />
          <strong>GARAGEFIT</strong>
        </a>
        <nav className="t-links" aria-label="Landing">
          <a href="#t-models">Vehicles</a>
          <a href="#t-compare">Compare</a>
          <a href="#t-how">How It Works</a>
          <a href="#t-faq">FAQ</a>
        </nav>
        <a className="t-btn t-btn-dark t-btn-sm" href={appLink()}>Compare Cars</a>
      </header>

      <main id="top">
        <section className="t-hero" aria-label="GarageFit introduction">
          <img className="t-hero-img" src="vehicles/tesla-model-y-2024.jpg" alt="Tesla Model Y on the road" fetchPriority="high" />
          <div className="t-hero-scrim" aria-hidden="true" />
          <div className="t-hero-copy">
            <p className="t-eyebrow rv">Fit before you buy</p>
            <h1 className="rv">Cars that fit your life</h1>
            <p className="rv">Compare {VEHICLES.length} vehicles ({lo}–{hi}) against your car, your garage and your budget. Free.</p>
            <div className="t-hero-cta rv">
              <a className="t-btn t-btn-dark" href={appLink()}>Compare Cars</a>
              <a className="t-btn t-btn-light" href="#t-how">How It Works</a>
            </div>
            <p className="t-hero-specs rv" aria-label="Highlights">
              <span><b>{VEHICLES.length}</b> vehicles</span>
              <span><b>3D</b> garage fit</span>
              <span><b>5-yr</b> true cost</span>
            </p>
          </div>
          <a className="t-scroll" href="#t-models" aria-label="Scroll to vehicles">↓</a>
        </section>

        <section id="t-models" aria-label="Featured vehicles">
          {LINEUP.map((c) => (
            <article className="t-panel" key={c.id}>
              <img src={c.img} alt={`${c.name} vehicle photo`} loading="lazy" />
              <div className="t-panel-scrim" aria-hidden="true" />
              <div className="t-panel-copy rv">
                <h2>{c.name}</h2>
                <p>{c.line}</p>
                <div className="t-panel-cta">
                  <a className="t-btn t-btn-dark" href={appLink(`?b=${c.id}`)}>Compare</a>
                  <a className="t-btn t-btn-light" href={appLink()}>All Cars</a>
                </div>
              </div>
            </article>
          ))}
        </section>

        <section className="t-strip" aria-label="Garage fit checker">
          <div className="wrap">
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

        {FEATURES.map((f, i) => (
          <section className={'t-feat' + (i % 2 ? ' flip' : '')} key={f.k} aria-label={f.t}>
            <div className="t-feat-img rv"><img src={f.img} alt={`${f.t} — vehicle photo`} loading="lazy" /></div>
            <div className="t-feat-copy rv">
              <p className="t-kicker">{f.k}</p>
              <h2>{f.t}</h2>
              <p>{f.d}</p>
              <p className="t-chips" aria-label="Includes">
                {f.chips.map((c) => <span key={c}>{c}</span>)}
              </p>
              <a className="t-btn t-btn-dark" href={appLink()}>Try It</a>
            </div>
          </section>
        ))}

        <section id="t-compare" className="t-table-sec" aria-label="Comparison preview">
          <div className="wrap">
            <h2 className="rv">Three headliners, one {gw}″ garage</h2>
            <div className="t-table-wrap rv">
              <table>
                <thead>
                  <tr>
                    <th scope="col"><span className="sr-only">Dimension</span></th>
                    {cars.map((c) => (
                      <th scope="col" key={c.id}><a href={appLink(`?b=${c.id}`)}>{c.year} {c.make} {c.model}<small>{c.trim}</small></a></th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr><th scope="row">Price</th>{cars.map((c) => <td key={c.id}>{money(c.msrp)}{c.msrp === best && <em className="t-best">Best</em>}</td>)}</tr>
                  <tr><th scope="row">Efficiency</th>{cars.map((c) => <td key={c.id}>{c.eff} {c.effUnit}</td>)}</tr>
                  <tr><th scope="row">Width</th>{cars.map((c) => <td key={c.id}>{c.widthExtended}″</td>)}</tr>
                  <tr>
                    <th scope="row">{gw}″ garage</th>
                    {cars.map((c) => {
                      const cl = +(gw - c.widthExtended).toFixed(1);
                      return (
                        <td key={c.id}>
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

        <section className="t-final" aria-label="Get started">
          <div className="wrap rv">
            <h2>Stop guessing. Start fitting.</h2>
            <div>
              <a className="t-btn t-btn-dark" href={appLink()}>Compare Cars</a>{' '}
              <a className="t-btn t-btn-light" href={appLink('?preset=fam')}>Family SUVs</a>
            </div>
          </div>
        </section>
      </main>

      <footer className="t-foot">
        <div className="wrap">
          <p className="t-mark" aria-hidden="true">GARAGEFIT</p>
          <small>© 2026 GarageFit · EPA, NHTSA and manufacturer data · Photos via Wikimedia Commons</small>
          <nav aria-label="Footer">
            <a href={appLink()}>App</a>
            <a href={appLink('?preset=ev50')}>EVs</a>
            <a href="#t-faq">FAQ</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
