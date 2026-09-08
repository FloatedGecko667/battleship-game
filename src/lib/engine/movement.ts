import type { BoardSize, Coord, FleetShip, Ship } from './types';
import type { Board } from './board';
import { cellsOf } from './geometry';
import { canPlace, type PlacementRules } from './placement';

/** Along the hull axis: ahead of the bow, or astern. */
export type Heading = 'ahead' | 'astern';

/** Unit step from the stern towards the bow, per facing. */
const AHEAD: Record<Ship['facing'], Coord> = {
	N: { row: -1, col: 0 },
	E: { row: 0, col: 1 },
	S: { row: 1, col: 0 },
	W: { row: 0, col: -1 }
};

export function isDamaged(ship: FleetShip): boolean {
	return ship.hits.some(Boolean);
}

/**
 * Only an unmarked hull can get under way.
 *
 * This is what keeps the variant honest. The enemy's marks record what they
 * saw and must never move, so a damaged ship that sailed away would leave its
 * hit marks floating over open water - and worse, would let a cell the enemy
 * has already resolved as a hit turn back into something they need to shoot.
 * Holding damaged ships in place keeps every hit mark true.
 */
export function canGetUnderWay(ship: FleetShip): boolean {
	return !isDamaged(ship);
}

export function stepFor(ship: Ship, heading: Heading): Coord {
	const ahead = AHEAD[ship.facing];
	return heading === 'ahead' ? ahead : { row: -ahead.row, col: -ahead.col };
}

/** The ship one cell along, or null if it cannot go there. */
export function movedShip(
	ship: FleetShip,
	heading: Heading,
	fleet: readonly FleetShip[],
	size: BoardSize,
	rules?: PlacementRules
): Ship | null {
	if (!canGetUnderWay(ship)) return null;

	const step = stepFor(ship, heading);
	const candidate: Ship = {
		class: ship.class,
		facing: ship.facing,
		bow: { row: ship.bow.row + step.row, col: ship.bow.col + step.col }
	};

	const others = fleet.filter((other) => other !== ship);
	return canPlace(candidate, others, size, rules) ? candidate : null;
}

/** Ships that could move this turn, in either direction. */
export function shipsUnderWay(board: Board, rules?: PlacementRules): FleetShip[] {
	return board.ships.filter(
		(ship) =>
			canGetUnderWay(ship) &&
			(movedShip(ship, 'ahead', board.ships, board.size, rules) !== null ||
				movedShip(ship, 'astern', board.ships, board.size, rules) !== null)
	);
}

/** Moves a ship in place on the board. Returns false if the move was illegal. */
export function moveShip(
	board: Board,
	ship: FleetShip,
	heading: Heading,
	rules?: PlacementRules
): boolean {
	const moved = movedShip(ship, heading, board.ships, board.size, rules);
	if (!moved) return false;
	ship.bow = moved.bow;
	return true;
}

/** Cells the ship would occupy after the move, for the preview. */
export function previewMove(
	ship: FleetShip,
	heading: Heading,
	fleet: readonly FleetShip[],
	size: BoardSize,
	rules?: PlacementRules
): Coord[] {
	const moved = movedShip(ship, heading, fleet, size, rules);
	return moved ? cellsOf(moved) : [];
}
