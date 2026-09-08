import type { BoardSize, Coord } from '../types';
import { shipAt, type Board } from '../board';
import { fireAt, markScan, shotEvents, type GameEvent } from '../resolve';

/** The unit offers two search patterns; both cover the centre plus four cells. */
export type ScanPattern = 'X' | 'PLUS';

const OFFSETS: Record<ScanPattern, Coord[]> = {
	X: [
		{ row: 0, col: 0 },
		{ row: -1, col: -1 },
		{ row: -1, col: 1 },
		{ row: 1, col: -1 },
		{ row: 1, col: 1 }
	],
	PLUS: [
		{ row: 0, col: 0 },
		{ row: -1, col: 0 },
		{ row: 1, col: 0 },
		{ row: 0, col: -1 },
		{ row: 0, col: 1 }
	]
};

export function scanCells(centre: Coord, pattern: ScanPattern, size: BoardSize): Coord[] {
	return OFFSETS[pattern]
		.map((offset) => ({ row: centre.row + offset.row, col: centre.col + offset.col }))
		.filter((c) => c.row >= 0 && c.row < size.rows && c.col >= 0 && c.col < size.cols);
}

export interface Aircraft {
	/** 0 and 1; the unit calls them the red and blue squadrons. */
	id: 0 | 1;
	/** Cell of the carrier it rides on. Hit that cell before launch and it is lost. */
	home: Coord;
	/** Centre of its sweep over the enemy grid, or null while still aboard. */
	at: Coord | null;
	pattern: ScanPattern;
	/** One firing pass only; afterwards it can still search. */
	armed: boolean;
	alive: boolean;
}

export function newAircraft(id: 0 | 1, home: Coord): Aircraft {
	return { id, home, at: null, pattern: 'PLUS', armed: true, alive: true };
}

export function liveAircraft(flight: readonly Aircraft[]): Aircraft[] {
	return flight.filter((plane) => plane.alive);
}

/** A plane still on deck dies with the cell it is parked on. */
export function grounded(flight: readonly Aircraft[]): Aircraft[] {
	return liveAircraft(flight).filter((plane) => plane.at === null);
}

export interface SweepOutcome {
	events: GameEvent[];
	/** True when the pass used up the aircraft's single strike. */
	spentAmmo: boolean;
}

/**
 * Flies a sweep over `target`.
 *
 * With its strike still available the aircraft attacks everything it finds and
 * marks the rest of the pattern as water. Once spent it can only search: it
 * reports whether anything is down there without doing damage, which is the
 * reading of "out of ammo and can only scan".
 */
export function flySweep(
	target: Board,
	centre: Coord,
	pattern: ScanPattern,
	armed: boolean,
	shooter: 'player' | 'cpu',
	announceSunk = true,
	turn?: number
): SweepOutcome {
	const cells = scanCells(centre, pattern, target.size);
	const found = cells.filter((cell) => shipAt(target, cell) !== null);

	if (!armed || found.length === 0) {
		// A search pass leaves the water it looked at marked, but harms nothing.
		if (!armed) {
			for (const cell of cells) markScan(target, cell);
			return {
				spentAmmo: false,
				events: [{ type: 'scan', side: shooter, coord: centre, detected: found.length > 0 }]
			};
		}

		const events: GameEvent[] = [];
		for (const cell of cells) {
			const outcome = fireAt(target, cell, announceSunk, turn);
			events.push(...shotEvents(shooter, cell, outcome));
		}
		return { spentAmmo: false, events };
	}

	const events: GameEvent[] = [];
	for (const cell of cells) {
		const outcome = fireAt(target, cell, announceSunk, turn);
		events.push(...shotEvents(shooter, cell, outcome));
	}
	return { spentAmmo: true, events };
}

/**
 * Anti-aircraft fire. The enemy's planes hover over your own ocean grid, so
 * this is aimed at a coordinate of your board, not theirs.
 */
export function fireAntiAir(flight: Aircraft[], at: Coord): Aircraft | null {
	const hit = flight.find(
		(plane) => plane.alive && plane.at !== null && plane.at.row === at.row && plane.at.col === at.col
	);
	if (!hit) return null;
	hit.alive = false;
	return hit;
}

/** Planes still on deck are lost when the cell they sit on is hit. */
export function loseGroundedAt(flight: Aircraft[], at: Coord): Aircraft[] {
	const lost: Aircraft[] = [];
	for (const plane of flight) {
		if (plane.alive && plane.at === null && plane.home.row === at.row && plane.home.col === at.col) {
			plane.alive = false;
			lost.push(plane);
		}
	}
	return lost;
}
