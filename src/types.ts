export type Fuel = 'Gasoline' | 'Hybrid' | 'PHEV' | 'EV' | 'Hydrogen';
export type Body = 'Sedan' | 'SUV' | 'Crossover' | 'Truck' | 'Hatch' | 'Coupe' | 'Wagon' | 'Minivan';

export interface Vehicle {
  id: string;
  year: number;
  make: string;
  model: string;
  trim: string;
  body: string;
  seats: number;
  doors: number;
  fuel: string;
  eff: number;
  effUnit: string;
  msrp: number;
  widthFolded: number;
  widthExtended: number;
  legroom: number;
  safety: string;
  handsFree: boolean;
  rangeMi: number | null;
  tag?: string;
  /** Optional real photo URL. When absent (or if it fails to load),
   *  the card falls back to the body-type glyph on a fuel gradient. */
  imageUrl?: string;
  /** Required if imageUrl is set and the license needs it (e.g. Wikimedia Commons). */
  imageCredit?: string;
  /** NHTSA 5-star overall rating (1-5) from api.nhtsa.gov, where rated. */
  nhtsaStars?: number;
  /** True when MSRP, efficiency, and body width were verified against manufacturer/EPA sources. */
  verified?: boolean;
  /** True for pre-2024 records where `msrp` is a typical used-market value, not the original sticker. */
  used?: boolean;
}

export type SortKey = 'fit' | 'price-asc' | 'price-desc' | 'eff-desc' | 'year-desc' | 'year-asc' | 'safety-desc' | 'width-asc';

export interface FilterState {
  baselineId: string | null;
  q: string;
  preset: string;
  sort: SortKey;
  view: 'cards' | 'table';
  maxPrice: number;
  minYear: number;
  maxWidth: number;
  /** User's garage opening clearance, mirrors-out, in inches. 0 = not set. */
  garageWidth: number;
  /** When true (and garageWidth is set), hide vehicles wider than the opening. */
  garageFitOnly: boolean;
  narrowOnly: boolean;
  topSafety: boolean;
  handsFree: boolean;
  fuels: string[];
  bodies: string[];
  make: string;
  minEff: number;
}
