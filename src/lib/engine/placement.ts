import type { BoardSize, Coord, Facing, Ship, ShipClass } from './types';
import { FLEET, shipLength } from './fleet';
import { cellsOf, coordKey, inBounds, kickOffsets, rotateCW } from './geometry';
import type { Rng } from './rng';

export interface PlacementRules {
	/** House rule: ships may not touch, not even diagonally. */
	noAdjacency: boolean;
}

export const DEFAULT_PLACEMENT_RULES: PlacementRules = { noAdjacency: false };

/** Cells occupied by the given ships. */
function occupiedCells(fleet: readonly Ship[]): Set<string> {
	const taken = new Set<string>();
	for (const ship of fleet) {
		for (const cell of cellsOf(ship)) taken.add(coordKey(cell));
	}
	return taken;
}

/** The eight neighbours of a cell, board bounds not considered. */
function neighbours(cell: Coord): Coord[] {
	const out: Coord[] = [];
	for (let dr = -1; dr <= 1; dr++) {
		for (let dc = -1; dc <= 1; dc++) {
			if (dr === 0 && dc === 0) continue;
			out.push({ row: cell.row + dr, col: cell.col + dc });
		}
	}
	return out;
}

/**
 * `others` must not contain `ship` itself - callers moving an existing ship
 * should use `rotateWithKick` / `nudge`, which strip it out for you.
 */
export function canPlace(
	ship: Ship,
	others: readonly Ship[],
	size: BoardSize,
	rules: PlacementRules = DEFAULT_PLACEMENT_RULES
): boolean {
	const cells = cellsOf(ship);
	if (!cells.every((cell) => inBounds(cell, size))) return false;

	const taken = occupiedCells(others.filter((other) => other !== ship));
	if (cells.some((cell) => taken.has(coordKey(cell)))) return false;

	if (rules.noAdjacency) {
		for (const cell of cells) {
			for (const near of neighbours(cell)) {
				if (taken.has(coordKey(near))) return false;
			}
		}
	}
	return true;
}

/**
 * Rotates clockwise about the bow. If the result does not fit, slides along the
 * hull axis (a "wall kick") and takes the first position that does. Returns null
 * when no offset works, so the caller can reject the rotation.
 */
export function rotateWithKick(
	ship: Ship,
	fleet: readonly Ship[],
	size: BoardSize,
	rules: PlacementRules = DEFAULT_PLACEMENT_RULES
): Ship | null {
	const others = fleet.filter((other) => other !== ship);
	const facing: Facing = rotateCW(ship.facing);
	for (const offset of kickOffsets(facing, shipLength(ship.class))) {
		const candidate: Ship = {
			class: ship.class,
			facing,
			bow: { row: ship.bow.row + offset.row, col: ship.bow.col + offset.col }
		};
		if (canPlace(candidate, others, size, rules)) return candidate;
	}
	return null;
}

/** Moves a ship by a delta, returning null if the destination is illegal. */
export function nudge(
	ship: Ship,
	delta: Coord,
	fleet: readonly Ship[],
	size: BoardSize,
	rules: PlacementRules = DEFAULT_PLACEMENT_RULES
): Ship | null {
	const others = fleet.filter((other) => other !== ship);
	const candidate: Ship = {
		class: ship.class,
		facing: ship.facing,
		bow: { row: ship.bow.row + delta.row, col: ship.bow.col + delta.col }
	};
	return canPlace(candidate, others, size, rules) ? candidate : null;
}

/** Places the whole fleet at random. Retries the layout if it paints itself into a corner. */
export function randomFleet(
	size: BoardSize,
	rng: Rng,
	rules: PlacementRules = DEFAULT_PLACEMENT_RULES,
	classes: readonly ShipClass[] = FLEET.map((spec) => spec.class)
): Ship[] {
	for (let attempt = 0; attempt < 200; attempt++) {
		const fleet: Ship[] = [];
		let ok = true;

		for (const cls of classes) {
			const placed = placeOne(cls, fleet, size, rng, rules);
			if (!placed) {
				ok = false;
				break;
			}
			fleet.push(placed);
		}
		if (ok) return fleet;
	}
	throw new Error('could not place the fleet; board is too small or rules too strict');
}

function placeOne(
	cls: ShipClass,
	fleet: readonly Ship[],
	size: BoardSize,
	rng: Rng,
	rules: PlacementRules
): Ship | null {
	const facings: Facing[] = ['N', 'E', 'S', 'W'];
	for (let tries = 0; tries < 400; tries++) {
		const candidate: Ship = {
			class: cls,
			facing: facings[rng.int(facings.length)],
			bow: { row: rng.int(size.rows), col: rng.int(size.cols) }
		};
		if (canPlace(candidate, fleet, size, rules)) return candidate;
	}
	return null;
}
