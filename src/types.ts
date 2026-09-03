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
}

export type SortKey = 'fit' | 'price-asc' | 'price-desc' | 'eff-desc' | 'year-desc' | 'safety-desc' | 'width-asc';

export interface FilterState {
  baselineId: string | null;
  q: string;
  preset: string;
  sort: SortKey;
  view: 'cards' | 'table';
  maxPrice: number;
  minYear: number;
  maxWidth: number;
  narrowOnly: boolean;
  topSafety: boolean;
  handsFree: boolean;
  fuels: string[];
  bodies: string[];
  make: string;
  minEff: number;
}
