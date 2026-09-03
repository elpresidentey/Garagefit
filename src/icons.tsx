// Flat single-color car silhouettes (side view) per body type.
// Designed to sit on the fuel-gradient card stages — no emoji, no external assets.
const WHEEL_TIRE = '#15130f';
const WHEEL_HUB = '#d8d2c2';
const GLASS = '#ffffff';

interface Shape {
  body: string;
  glass: string[];
  wheels: [number, number][];
}

const SHAPES: Record<string, Shape> = {
  Sedan: {
    body: 'M2 32 C2 26 4 24 10 23 L26 21 L34 11 C35 9 37 8 40 8 L56 8 C59 8 61 9 62 11 L68 21 L86 22 C91 22 94 25 94 29 L94 32 C94 34 93 35 91 35 L4 35 C3 35 2 34 2 32 Z',
    glass: ['M37 11 L43 11 L43 18 L31 18 Z', 'M45 11 L54 11 L59 18 L45 18 Z'],
    wheels: [[25, 34], [71, 34]],
  },
  SUV: {
    body: 'M2 32 C2 26 4 24 10 23 L22 22 L28 10 C29 8 31 7 34 7 L62 7 C65 7 67 8 68 10 L74 22 L86 23 C91 23 94 26 94 30 L94 32 C94 34 93 35 91 35 L4 35 C3 35 2 34 2 32 Z',
    glass: ['M32 10 L45 10 L45 19 L27 19 Z', 'M47 10 L60 10 L64 19 L47 19 Z'],
    wheels: [[25, 34], [71, 34]],
  },
  Crossover: {
    body: 'M2 32 C2 26 4 24 10 23 L23 22 L30 11 C31 9 33 8 36 8 L58 8 C61 8 63 9 64 11 L70 21 L86 22 C91 22 94 25 94 29 L94 32 C94 34 93 35 91 35 L4 35 C3 35 2 34 2 32 Z',
    glass: ['M34 11 L45 11 L45 19 L29 19 Z', 'M47 11 L57 11 L61 19 L47 19 Z'],
    wheels: [[25, 34], [71, 34]],
  },
  Truck: {
    body: 'M2 25 L50 25 L50 18 L58 18 L64 8 C65 6 67 5 69 5 L76 5 C78 5 80 6 81 8 L86 18 L92 19 C94 19 94 21 94 23 L94 32 C94 34 93 35 91 35 L4 35 C3 35 2 34 2 32 Z',
    glass: ['M60 18 L63 18 L66 12 L66 8 L60 8 Z', 'M68 8 L75 8 L79 18 L68 18 Z'],
    wheels: [[22, 34], [72, 34]],
  },
  Minivan: {
    body: 'M4 33 C4 24 8 20 16 19 L30 17 L38 8 C39 6 41 5 44 5 L66 5 C69 5 71 6 72 8 L80 19 L88 21 C92 22 94 25 94 29 L94 32 C94 34 93 35 91 35 L6 35 C5 35 4 34 4 33 Z',
    glass: ['M33 17 L44 17 L44 8 L40 8 Z', 'M46 17 L46 8 L63 8 L68 17 Z', 'M70 17 L74 12 L78 19 Z'],
    wheels: [[25, 34], [71, 34]],
  },
  Wagon: {
    body: 'M2 32 C2 26 4 24 10 23 L28 21 L36 11 C37 9 39 8 42 8 L60 8 C63 8 65 9 66 12 L70 21 L86 22 C91 22 94 25 94 29 L94 32 C94 34 93 35 91 35 L4 35 C3 35 2 34 2 32 Z',
    glass: ['M39 11 L45 11 L45 18 L33 18 Z', 'M47 11 L58 11 L62 18 L47 18 Z'],
    wheels: [[25, 34], [71, 34]],
  },
  Hatch: {
    body: 'M6 32 C6 26 8 24 14 23 L28 21 L36 11 C37 9 39 8 42 8 L56 8 C59 8 61 9 62 11 L68 21 L84 22 C89 22 92 25 92 29 L92 32 C92 34 91 35 89 35 L8 35 C7 35 6 34 6 32 Z',
    glass: ['M39 11 L45 11 L45 18 L33 18 Z', 'M47 11 L55 11 L59 18 L47 18 Z'],
    wheels: [[27, 34], [69, 34]],
  },
  Coupe: {
    body: 'M2 33 C4 27 8 25 16 24 L30 22 L40 12 C41 10 43 9 46 9 L58 9 C61 9 63 10 64 12 L69 22 L86 23 C91 23 94 26 94 30 L94 32 C94 34 93 35 91 35 L4 35 C3 35 2 34 2 33 Z',
    glass: ['M43 12 L56 12 L60 19 L37 19 Z'],
    wheels: [[25, 34], [71, 34]],
  },
};

export function CarGlyph({ body, className }: { body: string; className?: string }) {
  const s = SHAPES[body] ?? SHAPES.Sedan;
  return (
    <svg viewBox="0 0 96 42" className={className} aria-hidden="true" focusable="false">
      <path d={s.body} fill="currentColor" />
      {s.glass.map((d, i) => (
        <path key={i} d={d} fill={GLASS} opacity="0.85" />
      ))}
      {s.wheels.map(([cx, cy], i) => (
        <g key={i}>
          <circle cx={cx} cy={cy} r="7" fill={WHEEL_TIRE} />
          <circle cx={cx} cy={cy} r="2.8" fill={WHEEL_HUB} />
        </g>
      ))}
    </svg>
  );
}
