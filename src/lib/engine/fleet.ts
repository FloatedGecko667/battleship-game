import type { ShipClass } from './types';

export interface ShipSpec {
	class: ShipClass;
	/** Number of cells the hull occupies. */
	length: number;
	/** Full name shown in the HULL CODES panel. */
	name: string;
	/** The ship this stands in for in the official rulebook (Navy / Alien). */
	official: string;
}

/**
 * The official fleet is 5/4/3/3/2. Both three-cell ships are destroyers in the
 * rulebook, distinguished only by colour (red / blue) - which collides with this
 * game's "friendly is blue, hostile is red" rule, so they become DD and DE here.
 */
export const FLEET: readonly ShipSpec[] = [
	{ class: 'CV', length: 5, name: 'Aircraft Carrier', official: 'Aircraft Carrier / Flagship' },
	{ class: 'BB', length: 4, name: 'Battleship', official: 'Battleship / Heavy Ordnance Craft' },
	{ class: 'DD', length: 3, name: 'Destroyer', official: 'Red Japanese Destroyer / Red Storm Stinger' },
	{
		class: 'DE',
		length: 3,
		name: 'Destroyer Escort',
		official: 'Blue American Destroyer / Blue Shredder Stinger'
	},
	{ class: 'PB', length: 2, name: 'Patrol Boat', official: 'RHIB / Small Assault Ship' }
] as const;

const BY_CLASS = new Map(FLEET.map((spec) => [spec.class, spec]));

export function shipSpec(cls: ShipClass): ShipSpec {
	const spec = BY_CLASS.get(cls);
	if (!spec) throw new Error(`unknown ship class: ${cls}`);
	return spec;
}

export function shipLength(cls: ShipClass): number {
	return shipSpec(cls).length;
}

/** Total hull cells across the fleet: 5 + 4 + 3 + 3 + 2 = 17. */
export const FLEET_CELLS = FLEET.reduce((sum, spec) => sum + spec.length, 0);
