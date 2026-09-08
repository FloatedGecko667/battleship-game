import type { Coord, ShipClass } from '../types';
import { isSunk, shipAt, type Board } from '../board';
import { fireAt, markScan, shotEvents, type GameEvent } from '../resolve';
import { block3x3, homingLane, line3, sonarArea, type Orientation } from './patterns';

export type WeaponId = 'BB_MISSILE' | 'DD_MISSILE' | 'DE_HOMING' | 'DE_SONAR';

export interface WeaponSpec {
	id: WeaponId;
	/** The weapon is unusable once this ship goes down. */
	ship: ShipClass;
	name: string;
	/** Uses per game; null means unlimited. */
	ammo: number | null;
	/** What the player has to aim. */
	aim: 'centre' | 'line' | 'edge';
	blurb: string;
}

export const WEAPONS: readonly WeaponSpec[] = [
	{
		id: 'BB_MISSILE',
		ship: 'BB',
		name: 'Missile',
		ammo: 1,
		aim: 'centre',
		blurb: 'Blasts a 3×3 area around the centre you call.'
	},
	{
		id: 'DD_MISSILE',
		ship: 'DD',
		name: 'Salvo missile',
		ammo: 2,
		aim: 'line',
		blurb: 'Strikes three cells in a row or column.'
	},
	{
		id: 'DE_HOMING',
		ship: 'DE',
		name: 'Homing missile',
		ammo: 2,
		aim: 'edge',
		blurb: 'Runs from the grid edge until it meets a ship.'
	},
	{
		id: 'DE_SONAR',
		ship: 'DE',
		name: 'Sonar',
		ammo: null,
		aim: 'centre',
		blurb: 'Reports whether a 3×3 area holds anything. No position, no count.'
	}
] as const;

const BY_ID = new Map(WEAPONS.map((spec) => [spec.id, spec]));

export function weaponSpec(id: WeaponId): WeaponSpec {
	const spec = BY_ID.get(id);
	if (!spec) throw new Error(`unknown weapon: ${id}`);
	return spec;
}

/** Uses spent so far, per weapon. */
export type Arsenal = Record<WeaponId, number>;

export function emptyArsenal(): Arsenal {
	return { BB_MISSILE: 0, DD_MISSILE: 0, DE_HOMING: 0, DE_SONAR: 0 };
}

/** Rounds left, or Infinity for the sonar. */
export function roundsLeft(spec: WeaponSpec, arsenal: Arsenal): number {
	return spec.ammo === null ? Infinity : spec.ammo - arsenal[spec.id];
}

/** A weapon is live only while its own ship is still afloat and it has rounds. */
export function isAvailable(spec: WeaponSpec, ownBoard: Board, arsenal: Arsenal): boolean {
	const ship = ownBoard.ships.find((s) => s.class === spec.ship);
	if (!ship || isSunk(ship)) return false;
	return roundsLeft(spec, arsenal) > 0;
}

export function availableWeapons(ownBoard: Board, arsenal: Arsenal): WeaponSpec[] {
	return WEAPONS.filter((spec) => isAvailable(spec, ownBoard, arsenal));
}

export interface WeaponUse {
	weapon: WeaponId;
	/** BB, DD and the sonar aim at a centre; the homing missile at an edge cell. */
	at: Coord;
	/** DD and the homing missile pick an axis first. */
	orientation?: Orientation;
}

/**
 * Cells the shot would touch, for the aiming preview. The homing missile shows
 * its whole lane - where it actually stops depends on the defender's board,
 * which the shooter must not be shown in advance.
 */
export function previewCells(use: WeaponUse, target: Board): Coord[] {
	switch (use.weapon) {
		case 'BB_MISSILE':
			return block3x3(use.at, target.size);
		case 'DD_MISSILE':
			return line3(use.at, use.orientation ?? 'H', target.size);
		case 'DE_HOMING':
			return homingLane(use.at, use.orientation ?? 'H', target.size);
		case 'DE_SONAR':
			return sonarArea(use.at, target.size);
	}
}

export interface WeaponOutcome {
	events: GameEvent[];
	/** False when the aim was illegal, so no round is spent. */
	fired: boolean;
}

export function fireWeapon(
	target: Board,
	use: WeaponUse,
	shooter: 'player' | 'cpu',
	announceSunk = true
): WeaponOutcome {
	if (use.weapon === 'DE_SONAR') {
		const area = sonarArea(use.at, target.size);
		const detected = area.some((cell) => shipAt(target, cell) !== null);
		markScan(target, use.at);
		return { fired: true, events: [{ type: 'scan', side: shooter, coord: use.at, detected }] };
	}

	if (use.weapon === 'DE_HOMING') {
		const lane = homingLane(use.at, use.orientation ?? 'H', target.size);
		if (!lane.length) return { fired: false, events: [] };

		const events: GameEvent[] = [];
		for (const cell of lane) {
			const outcome = fireAt(target, cell, announceSunk);
			events.push(...shotEvents(shooter, cell, outcome));
			// The missile stops on the first ship it meets.
			if (outcome.result === 'hit' && !outcome.repeat) break;
		}
		return { fired: true, events };
	}

	const cells =
		use.weapon === 'BB_MISSILE'
			? block3x3(use.at, target.size)
			: line3(use.at, use.orientation ?? 'H', target.size);
	if (!cells.length) return { fired: false, events: [] };

	const events: GameEvent[] = [];
	for (const cell of cells) {
		const outcome = fireAt(target, cell, announceSunk);
		events.push(...shotEvents(shooter, cell, outcome));
	}
	return { fired: true, events };
}
