import { useEffect } from 'react';
import { VEHICLES } from './data';

const APP = '#/app';
const appLink = (q = '') => `#/app${q}`;

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

const MAKES = [...new Set(VEHICLES.map((v) => v.make))].sort();
const money = (n: number) => '$' + Math.round(n).toLocaleString();

const PILLARS = [
  {
    t: '3D garage fit',
    d: 'Width, depth and door height — measured against your actual garage, not a guess. Every car gets a fits / doesn’t-fit verdict with inches to spare.',
    href: appLink(),
    cta: 'Check your garage',
  },
  {
    t: 'Compared to your car',
    d: 'Pick the car you own as a baseline and every one of the 196 vehicles shows better / worse relative to it — price, efficiency, width, seats, safety.',
    href: appLink(),
    cta: 'Set your baseline',
  },
  {
    t: 'True 5-year cost',
    d: 'Fuel at your mileage and local prices, depreciation, CO₂ and an estimated monthly payment — adjustable, not hardcoded.',
    href: appLink(),
    cta: 'See real costs',
  },
  {
    t: 'EV-ready comparisons',
    d: 'Range minimums, MPGe on equal footing, DC fast-charge rates and charging-cost math for all 21 EVs. Gas-to-electric, apples to apples.',
    href: appLink('?fuels=EV'),
    cta: 'Browse EVs',
  },
];

const STEPS = [
  { n: '01', t: 'Set your baseline', d: 'Tell GarageFit what you drive today — or add your own car in seconds when it’s not listed.' },
  { n: '02', t: 'Measure your garage', d: 'Enter width, depth and door height once. Fit verdicts follow you across every view.' },
  { n: '03', t: 'Filter & compare', d: 'Presets, price, efficiency, safety and range. Side-by-side up to 4 cars with best-in-group highlighted.' },
  { n: '04', t: 'Decide with numbers', d: 'Closer analysis per car: key differences, 5-year sketch, garage visualisation, catalog standing.' },
];

const SHOWCASE = [
  {
    preset: 'fam', label: 'Family SUVs', d: '7+ seats, room for everyone and everything.',
    img: 'vehicles/honda-pilot-2024.jpg', alt: 'Honda Pilot',
  },
  {
    preset: 'ev50', label: 'EVs under $50k', d: 'Electric range, charging speed and true running costs.',
    img: 'vehicles/tesla-model-y-2024.jpg', alt: 'Tesla Model Y',
  },
  {
    preset: 'fueleff', label: '40+ MPG(e)', d: 'Hybrids and EVs that sip fuel — including the 49 MPG Civic Hybrid.',
    img: 'vehicles/toyota-prius-2024.jpg', alt: 'Toyota Prius',
  },
];

const FAQS = [
  {
    q: 'Is GarageFit free?',
    a: 'Yes. The full comparator — all 196 vehicles, garage fit, cost math and sharing — is free, works offline after first load, and needs no account.',
  },
  {
    q: 'Where do the specs come from?',
    a: 'Manufacturer specifications, EPA fuel economy, IIHS safety and NHTSA ratings. 2024+ prices are MSRP including destination; 2015–2023 values are typical used-market estimates. Length and height for older years follow generation specs.',
  },
  {
    q: 'How do I measure my garage?',
    a: 'Measure the narrowest opening width (mirrors-out is what matters), the usable depth wall-to-door, and the door height. Enter all three once — every vehicle then shows clearance in inches.',
  },
  {
    q: 'My car isn’t listed. Can I still compare?',
    a: 'Yes — “Add my car” lets you enter your car’s basics in seconds. It’s saved in your browser and works as a baseline, in filters and in side-by-side comparisons.',
  },
  {
    q: 'How are EV costs calculated?',
    a: 'From your miles per year and electricity price (adjustable), EPA MPGe and a US-average grid factor for CO₂ — shown next to the gas equivalent so the switch is honest.',
  },
];

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
              <span className="kicker rv">Fit before you buy</span>
              <h1 className="rv">A new standard for car shopping</h1>
              <p className="lp-sub rv">
                GarageFit compares {VEHICLES.length} vehicles ({lo}–{hi}) against the car you own today —
                garage fit, price, efficiency, safety and true 5-year cost, side by side.
              </p>
              <div className="lp-cta rv">
                <a className="btn primary big" href={appLink()}>Compare cars</a>
                <a className="btn ghost big" href="#lp-how">How it works</a>
              </div>
              <p className="lp-note rv">Free · No account · Works offline</p>
            </div>
            <div className="lp-hero-art rv" aria-hidden="true">
              <figure className="lp-ph lp-ph1">
                <img src="vehicles/toyota-rav4-2024-le.jpg" alt="" loading="eager" />
                <figcaption><b>RAV4</b><span className="pill good">Fits · 2.4″ spare</span></figcaption>
              </figure>
              <figure className="lp-ph lp-ph2">
                <img src="vehicles/tesla-model-y-2024.jpg" alt="" loading="lazy" />
                <figcaption><b>Model Y</b><span className="pill good">saves $980/yr</span></figcaption>
              </figure>
              <figure className="lp-ph lp-ph3">
                <img src="vehicles/ford-f150-2024.jpg" alt="" loading="lazy" />
                <figcaption><b>F-150</b><span className="pill bad">3.7″ too wide</span></figcaption>
              </figure>
            </div>
          </div>
        </section>

        <section className="lp-marquee" aria-label="Makes covered">
          <div className="wrap"><p className="lp-eyebrow">Covering the brands you cross-shop</p></div>
          <div className="lp-track">
            {[...MAKES, ...MAKES].map((m, i) => (
              <span key={i} aria-hidden={i >= MAKES.length}>{m}</span>
            ))}
          </div>
        </section>

        <section className="lp-pillars" id="lp-features" aria-label="What GarageFit does">
          <div className="wrap">
            <h2 className="rv">Car shopping, worked end-to-end — from garage to decision</h2>
            <div className="lp-grid4">
              {PILLARS.map((p) => (
                <article className="lp-card rv" key={p.t}>
                  <h3>{p.t}</h3>
                  <p>{p.d}</p>
                  <a className="linklike" href={p.href}>{p.cta} →</a>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-stats" aria-label="GarageFit in numbers">
          <div className="wrap lp-stats-in">
            {[
              [`${VEHICLES.length}`, 'vehicles compared'],
              [`${lo}–${hi}`, 'model years covered'],
              [`${evs}`, 'EVs with range + charge data'],
              [`${verified}`, 'verified spec sheets'],
            ].map(([b, s]) => (
              <div className="lp-stat rv" key={s}><b>{b}</b><span>{s}</span></div>
            ))}
          </div>
        </section>

        <section className="lp-how" id="lp-how" aria-label="How it works">
          <div className="wrap">
            <h2 className="rv">What if every car was measured against your life?</h2>
            <ol className="lp-steps">
              {STEPS.map((s) => (
                <li className="rv" key={s.n}>
                  <span className="lp-stepn">{s.n}</span>
                  <h3>{s.t}</h3>
                  <p>{s.d}</p>
                </li>
              ))}
            </ol>
            <p className="rv"><a className="btn primary" href={appLink()}>Try it now</a></p>
          </div>
        </section>

        <section className="lp-cars" id="lp-cars" aria-label="Popular starting points">
          <div className="wrap">
            <h2 className="rv">Start where most drivers start</h2>
            <div className="lp-grid3">
              {SHOWCASE.map((c) => {
                const n = VEHICLES.filter((v) =>
                  c.preset === 'fam' ? ((v.body === 'SUV' || v.body === 'Minivan') && v.seats >= 7)
                  : c.preset === 'ev50' ? (v.fuel === 'EV' && v.msrp < 50000)
                  : v.eff >= 40).length;
                return (
                  <a className="lp-shot rv" key={c.preset} href={appLink(`?preset=${c.preset}`)}>
                    <img src={c.img} alt={c.alt} loading="lazy" />
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
            <p>Your garage, your car, your costs — {VEHICLES.length} vehicles measured against all three. The cheapest starts at {money(Math.min(...VEHICLES.map((v) => v.msrp)))}.</p>
            <p>
              <a className="btn primary big" href={appLink()}>Open the app</a>{' '}
              <a className="btn ghost big" href={appLink('?preset=fam')}>Family SUVs</a>
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
