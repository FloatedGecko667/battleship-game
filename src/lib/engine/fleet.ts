import type { ShipClass } from './types';
import type { Edition } from './edition';

export interface ShipSpec {
	class: ShipClass;
	/** Hull code drawn on the board and in the HULL CODES panel. */
	code: string;
	/** Number of cells the hull occupies. */
	length: number;
	/** The ship this stands in for in the official rules (Navy / Alien on DELUXE). */
	official: string;
}

const SPECS: readonly ShipSpec[] = [
	{ class: 'CV', code: 'CV', length: 5, official: 'Aircraft Carrier / Flagship' },
	{ class: 'BB', code: 'BB', length: 4, official: 'Battleship / Heavy Ordnance Craft' },
	{ class: 'CA', code: 'CA', length: 3, official: 'Cruiser (1990 edition)' },
	{ class: 'SS', code: 'SS', length: 3, official: 'Submarine (1990 edition)' },
	/**
	 * The 1990 destroyer is two cells long, but DELUXE's DD is three. A class
	 * determines its length everywhere (`cellsOf`), so the two need distinct
	 * keys even though both are drawn as DD.
	 */
	{ class: 'DD2', code: 'DD', length: 2, official: 'Destroyer (1990 edition)' },
	{
		class: 'DD',
		code: 'DD',
		length: 3,
		official: 'Red Japanese Destroyer / Red Storm Stinger'
	},
	{
		class: 'DE',
		code: 'DE',
		length: 3,
		official: 'Blue American Destroyer / Blue Shredder Stinger'
	},
	{ class: 'PB', code: 'PB', length: 2, official: 'RHIB / Small Assault Ship' }
];

const BY_CLASS = new Map(SPECS.map((spec) => [spec.class, spec]));

export function shipSpec(cls: ShipClass): ShipSpec {
	const spec = BY_CLASS.get(cls);
	if (!spec) throw new Error(`unknown ship class: ${cls}`);
	return spec;
}

/**
 * CLASSIC sails the 1990 fleet, submarine included. DELUXE follows the tie-in
 * rulebook, whose two three-cell ships are both destroyers distinguished only
 * by colour (red / blue) - which collides with this game's "friendly is blue,
 * hostile is red" rule, so they become DD and DE.
 */
export const FLEETS: Record<Edition, readonly ShipSpec[]> = {
	CLASSIC: (['CV', 'BB', 'CA', 'SS', 'DD2'] as const).map(shipSpec),
	DELUXE: (['CV', 'BB', 'DD', 'DE', 'PB'] as const).map(shipSpec)
};

export function fleetFor(edition: Edition): readonly ShipSpec[] {
	return FLEETS[edition];
}

export function fleetClasses(edition: Edition): ShipClass[] {
	return FLEETS[edition].map((spec) => spec.class);
}

export function shipLength(cls: ShipClass): number {
	return shipSpec(cls).length;
}

export function hullCode(cls: ShipClass): string {
	return shipSpec(cls).code;
}

/** Total hull cells across a fleet. Both editions come to 5 + 4 + 3 + 3 + 2 = 17. */
export function fleetCells(edition: Edition): number {
	return FLEETS[edition].reduce((sum, spec) => sum + spec.length, 0);
}
