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
      { threshold: 0.12 }
    );
    els.forEach((e) => io.observe(e));
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

/** Configurator-style hero: pick a car, type your garage, get a verdict. */
const CONFIG_IDS = ['toyota-rav4-2024-le', 'tesla-model-y-2024', 'ford-f150-2024', 'honda-civic-2024'];
function Configurator() {
  const [id, setId] = useState(CONFIG_IDS[0]);
  const [gw, setGw] = useState(88);
  const v = VEHICLES.find((x) => x.id === id) ?? VEHICLES[0];
  const cl = gw > 0 ? +((gw - v.widthExtended).toFixed(1)) : null;
  const verdict =
    cl == null ? null :
    cl < 0 ? { cls: 'bad', text: `${(-cl).toFixed(1)}″ too wide for your garage` } :
    cl < 2 ? { cls: 'warn', text: `Tight fit — ${cl.toFixed(1)}″ to spare` } :
    { cls: 'good', text: `Fits with ${cl.toFixed(1)}″ to spare` };
  return (
    <div className="lp-config" role="group" aria-label="Try it: pick a car and check your garage">
      <div className="lp-tabs" role="tablist" aria-label="Choose a car">
        {CONFIG_IDS.map((cid) => {
          const c = VEHICLES.find((x) => x.id === cid)!;
          return (
            <button
              key={cid} role="tab" aria-selected={cid === id}
              className={'lp-tab' + (cid === id ? ' on' : '')}
              onClick={() => setId(cid)}
            >
              {c.model}
            </button>
          );
        })}
      </div>
      <div className="lp-stage">
        {v.imageUrl && <img key={v.id} className="lp-stage-img" src={v.imageUrl} alt={`${v.year} ${v.make} ${v.model}`} />}
        <div className="lp-stage-name">
          <b>{v.year} {v.make} {v.model}</b>
          <small>{v.trim} · {money(v.msrp)}</small>
        </div>
      </div>
      <div className="lp-chips">
        <span><b>{v.eff}</b> {v.effUnit}</span>
        <span><b>{v.widthExtended}″</b> wide</span>
        <span><b>{v.seats}</b> seats</span>
        <span><b>{v.safety === '—' ? 'NR' : v.safety}</b> IIHS</span>
      </div>
      <div className="lp-garage-row">
        <label>
          <span>My garage opening</span>
          <span className="lp-garage-input">
            <input
              type="number" inputMode="decimal" min={60} max={140} step={0.5} value={gw || ''}
              placeholder="88" aria-label="Garage opening width in inches"
              onChange={(e) => setGw(e.target.value === '' ? 0 : Math.min(200, Math.max(0, +e.target.value)))}
            />
            <em>in</em>
          </span>
        </label>
        {verdict && <span className={`pill ${verdict.cls}`}>{verdict.text}</span>}
      </div>
      <a className="btn primary big lp-config-cta" href={appLink(`?b=${v.id}${gw > 0 ? `&gw=${gw}` : ''}`)}>
        Compare this car →
      </a>
    </div>
  );
}

const PILLARS = [
  {
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M3 10V6.5A1.5 1.5 0 0 1 4.5 5h15A1.5 1.5 0 0 1 21 6.5V10"/><path d="M3 10h18v6.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 16.5Z"/><path d="M7 21v-3M17 21v-3M7 13.5h.01M17 13.5h.01"/></svg>
    ),
    t: '3D garage fit', d: 'Width, depth and door height against your actual garage. Every car gets a fits / doesn’t-fit verdict with inches to spare.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2.2" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="2.2" fill="currentColor" stroke="none"/><circle cx="7" cy="18" r="2.2" fill="currentColor" stroke="none"/></svg>
    ),
    t: 'Measured vs your car', d: 'Set your current car as the baseline and all 196 vehicles show better / worse on price, efficiency, width, seats and safety.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 2.5v17M17 6.5c0-2-2.2-3-5-3s-5 1-5 3 1.6 2.6 5 3.2 5 1.3 5 3.3-2.2 3-5 3-5-1-5-3"/></svg>
    ),
    t: 'True 5-year cost', d: 'Fuel at your mileage and prices, depreciation, CO₂ and monthly payment — adjustable assumptions, not hardcoded guesses.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5Z"/></svg>
    ),
    t: 'EV-ready', d: 'Range minimums, MPGe on equal footing, DC fast-charge rates and charging-cost math. Gas to electric, apples to apples.',
  },
];

const STEPS = [
  { n: '01', t: 'Set your baseline', d: 'Tell GarageFit what you drive — or add your own car in seconds when it’s not listed.' },
  { n: '02', t: 'Measure your garage', d: 'Width, depth, door height — entered once, followed everywhere.' },
  { n: '03', t: 'Filter & compare', d: 'Presets, price, safety, range. Up to 4 cars side-by-side with the best highlighted.' },
  { n: '04', t: 'Decide with numbers', d: 'Key differences, 5-year sketch, garage visualisation, catalog standing.' },
];

const FAQS = [
  {
    q: 'Is GarageFit free?',
    a: 'Yes. All 196 vehicles, garage fit, cost math and sharing are free, work offline after first load, and need no account.',
  },
  {
    q: 'Where do the specs come from?',
    a: 'Manufacturer specifications, EPA fuel economy, IIHS safety and NHTSA ratings. 2024+ prices are MSRP including destination; 2015–2023 values are typical used-market estimates. Older-year lengths follow generation specs.',
  },
  {
    q: 'How do I measure my garage?',
    a: 'The narrowest opening width (mirrors-out is what matters), usable depth wall-to-door, and door height. Try the live widget above — then open the app to keep all three on every car.',
  },
  {
    q: 'My car isn’t listed. Can I still compare?',
    a: 'Yes — “Add my car” captures your car’s basics in seconds. It’s saved in your browser and works as a baseline, in filters and in comparisons.',
  },
  {
    q: 'How are EV costs calculated?',
    a: 'From your miles per year and electricity price (both adjustable), EPA MPGe and a US-average grid factor for CO₂ — always shown next to the gas equivalent.',
  },
];

const MARQUEE = VEHICLES.filter((v) => v.imageUrl && v.year >= 2024).slice(0, 14);

/** A real slice of the app: 3 headline cars, real numbers, 88″ garage verdicts. */
const PREVIEW_IDS = ['toyota-rav4-2026-le-awd', 'tesla-model-y-2026-long-range-awd', 'honda-civic-2025-sport-hybrid'];
function ComparePreview() {
  const gw = 88;
  const cars = PREVIEW_IDS.map((id) => VEHICLES.find((v) => v.id === id)!).filter(Boolean);
  if (!cars.length) return null;
  return (
    <section className="lp-preview" aria-label="Comparison preview">
      <div className="wrap">
        <p className="lp-eyebrow rv">A taste of the app</p>
        <h2 className="rv">Three 2026 headliners, one {gw}″ garage</h2>
        <div className="lp-preview-scroll rv">
          <table className="lp-preview-table">
            <thead>
              <tr>
                <th scope="col"><span className="sr-only">Dimension</span></th>
                {cars.map((c) => (
                  <th scope="col" key={c.id}>
                    <a href={appLink(`?b=${c.id}`)}>
                      <b>{c.year} {c.make} {c.model}</b>
                      <small>{c.trim}</small>
                    </a>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Price</th>
                {cars.map((c) => <td key={c.id}>{money(c.msrp)}</td>)}
              </tr>
              <tr>
                <th scope="row">Efficiency</th>
                {cars.map((c) => <td key={c.id}>{c.eff} {c.effUnit}</td>)}
              </tr>
              <tr>
                <th scope="row">Width, mirrors out</th>
                {cars.map((c) => <td key={c.id}>{c.widthExtended}″</td>)}
              </tr>
              <tr>
                <th scope="row">Your {gw}″ garage</th>
                {cars.map((c) => {
                  const cl = +(gw - c.widthExtended).toFixed(1);
                  return (
                    <td key={c.id}>
                      {cl >= 0
                        ? <span className="pill good">{cl.toFixed(1)}″ to spare</span>
                        : <span className="pill bad">{(-cl).toFixed(1)}″ too wide</span>}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="rv"><a className="btn primary" href={appLink()}>Open the full comparison →</a></p>
      </div>
    </section>
  );
}

export default function Landing() {
  useReveal();
  const years = VEHICLES.map((v) => v.year);
  const lo = Math.min(...years), hi = Math.max(...years);
  const evs = VEHICLES.filter((v) => v.fuel === 'EV').length;
  const verified = VEHICLES.filter((v) => v.verified).length;

  return (
    <div className="lp">
      <a className="skip" href="#lp-features">Skip to content</a>

      <div className="lp-news" role="note">
        <span className="lp-news-dot" aria-hidden="true" />
        <span>2026 models are live — RAV4, Model Y Juniper, Palisade + 16 more.</span>
        <a href={appLink()}>Open the app →</a>
      </div>

      <header className="lp-nav">
        <div className="wrap lp-nav-in">
          <a className="brand" href="#top" aria-label="GarageFit home">
            <img className="logo" src="logo.svg" alt="" aria-hidden="true" />
            <div><strong>GarageFit</strong><small>Fit before you buy</small></div>
          </a>
          <nav className="lp-links" aria-label="Landing">
            <a href="#lp-features">Features</a>
            <a href="#lp-how">How it works</a>
            <a href="#lp-cars">Start with</a>
            <a href="#lp-faq">FAQ</a>
          </nav>
          <a className="btn primary" href={appLink()}>Open the app</a>
        </div>
      </header>

      <main id="top">
        <section className="lp-hero">
          <div className="wrap lp-hero-in">
            <div className="lp-hero-copy">
              <span className="lp-badge rv">{VEHICLES.length} vehicles · {lo}–{hi} · free</span>
              <h1 className="rv">Will it fit in your garage?</h1>
              <p className="lp-sub rv">
                Answer that <em>before</em> you fall in love. Pick a car, type your garage —
                GarageFit measures all {VEHICLES.length} vehicles against your space, your current car and your budget.
              </p>
              <div className="lp-cta rv">
                <a className="btn primary big" href={appLink()}>Compare all cars</a>
                <a className="btn ghost big" href="#lp-how">How it works</a>
              </div>
              <p className="lp-note rv">No account · Works offline · Shareable links</p>
            </div>
            <div className="rv"><Configurator /></div>
          </div>
        </section>

        <section className="lp-marquee" aria-label="Popular vehicles">
          <div className="wrap"><p className="lp-eyebrow">Popular right now — tap any car to compare it</p></div>
          <div className="lp-track">
            {[...MARQUEE, ...MARQUEE].map((v, i) => (
              <a key={v.id + i} className="lp-mcard" href={appLink(`?b=${v.id}`)} aria-hidden={i >= MARQUEE.length} tabIndex={i >= MARQUEE.length ? -1 : 0}>
                <img src={v.imageUrl} alt="" loading="lazy" />
                <span><b>{v.year} {v.make} {v.model}</b><small>{money(v.msrp)} · {v.eff} {v.effUnit}</small></span>
              </a>
            ))}
          </div>
        </section>

        <section className="lp-pillars" id="lp-features" aria-label="What GarageFit does">
          <div className="wrap">
            <p className="lp-eyebrow rv">Why GarageFit</p>
            <h2 className="rv">Spec sheets tell you size.<br />GarageFit tells you fit.</h2>
            <div className="lp-grid4">
              {PILLARS.map((p) => (
                <article className="lp-card rv" key={p.t}>
                  <span className="lp-ico">{p.icon}</span>
                  <h3>{p.t}</h3>
                  <p>{p.d}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-stats" aria-label="GarageFit in numbers">
          <div className="wrap lp-stats-in">
            {[
              { v: <Count to={VEHICLES.length} />, s: 'vehicles compared' },
              { v: <Count to={evs} />, s: 'EVs with range + charge data' },
              { v: <Count to={verified} />, s: 'verified spec sheets' },
              { v: <><Count to={3} /></>, s: 'dimensions of garage fit' },
            ].map(({ v, s }) => (
              <div className="lp-stat rv" key={s}><b>{v}</b><span>{s}</span></div>
            ))}
          </div>
        </section>

        <ComparePreview />

        <section className="lp-how" id="lp-how" aria-label="How it works">
          <div className="wrap">
            <p className="lp-eyebrow rv">How it works</p>
            <h2 className="rv">Four steps to a car you’ll love living with</h2>
            <ol className="lp-steps">
              {STEPS.map((s) => (
                <li className="rv" key={s.n}>
                  <span className="lp-stepn">{s.n}</span>
                  <h3>{s.t}</h3>
                  <p>{s.d}</p>
                </li>
              ))}
            </ol>
            <p className="rv"><a className="btn primary big" href={appLink()}>Start with your car →</a></p>
          </div>
        </section>

        <section className="lp-cars" id="lp-cars" aria-label="Popular starting points">
          <div className="wrap">
            <p className="lp-eyebrow rv">Shortcuts</p>
            <h2 className="rv">Start where most drivers start</h2>
            <div className="lp-grid3">
              {[
                { preset: 'fam', label: 'Family SUVs', d: '7+ seats, room for everyone and everything.', img: 'vehicles/honda-pilot-2024.jpg' },
                { preset: 'ev50', label: 'EVs under $50k', d: 'Range, charging speed and true running costs.', img: 'vehicles/tesla-model-y-2024.jpg' },
                { preset: 'fueleff', label: '40+ MPG(e)', d: 'Hybrids and EVs that sip — like the 49 MPG Civic Hybrid.', img: 'vehicles/toyota-prius-2024.jpg' },
              ].map((c) => {
                const n = VEHICLES.filter((v) =>
                  c.preset === 'fam' ? ((v.body === 'SUV' || v.body === 'Minivan') && v.seats >= 7)
                  : c.preset === 'ev50' ? (v.fuel === 'EV' && v.msrp < 50000)
                  : v.eff >= 40).length;
                return (
                  <a className="lp-shot rv" key={c.preset} href={appLink(`?preset=${c.preset}`)}>
                    <img src={c.img} alt="" loading="lazy" />
                    <span className="lp-shot-body">
                      <b>{c.label} · {n} cars</b>
                      <small>{c.d}</small>
                      <span className="linklike">Open comparison →</span>
                    </span>
                  </a>
                );
              })}
            </div>
          </div>
        </section>

        <section className="lp-faq" id="lp-faq" aria-label="Frequently asked questions">
          <div className="wrap lp-faq-in">
            <p className="lp-eyebrow rv">FAQ</p>
            <h2 className="rv">Questions, answered</h2>
            {FAQS.map((f) => (
              <details className="lp-qa rv" key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="lp-final" aria-label="Get started">
          <div className="wrap rv">
            <h2>Stop guessing. Start fitting.</h2>
            <p>Your garage, your car, your costs — {VEHICLES.length} vehicles measured against all three, starting at {money(Math.min(...VEHICLES.map((v) => v.msrp)))}.</p>
            <p>
              <a className="btn primary big" href={appLink()}>Open the app</a>{' '}
              <a className="btn big ghost" href={appLink('?preset=fam')}>Family SUVs</a>
            </p>
          </div>
        </section>
      </main>

      <footer className="foot">
        <div className="wrap foot-in">
          <div className="foot-brand">
            <img className="logo" src="logo.svg" alt="" aria-hidden="true" />
            <div><strong>GarageFit</strong><small>Find cars that actually fit your life</small></div>
            <p>Compare {VEHICLES.length} vehicles ({lo}–{hi}) against your own car — price, efficiency, garage fit, safety and seats, side by side.</p>
          </div>
          <nav className="foot-nav" aria-label="Footer">
            <div className="fcol">
              <h4>Explore</h4>
              <a href="#lp-features">Features</a>
              <a href="#lp-how">How it works</a>
              <a href="#lp-cars">Start with</a>
              <a href="#lp-faq">FAQ</a>
            </div>
            <div className="fcol">
              <h4>Actions</h4>
              <a href={appLink()}>Open the app</a>
              <a href={appLink('?preset=ev50')}>EVs under $50k</a>
              <a href={appLink('?preset=fueleff')}>40+ MPG(e)</a>
            </div>
            <div className="fcol">
              <h4>Data</h4>
              <span>{VEHICLES.length} vehicles · {verified} verified specs</span>
              <span>MSRP in USD · 2015–2023 values are typical used prices</span>
            </div>
          </nav>
        </div>
        <div className="wrap foot-base">
          <span>© 2026 GarageFit · Specs checked against EPA, NHTSA and manufacturer data</span>
          <span>Photos via Wikimedia Commons — full credit on each vehicle</span>
        </div>
      </footer>
    </div>
  );
}
