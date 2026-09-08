/** Zero-based board coordinate. `row` 0 is rank A, `col` 0 is file 1. */
export interface Coord {
	row: number;
	col: number;
}

/** Direction the bow points. The hull extends backwards from the bow. */
export type Facing = 'N' | 'E' | 'S' | 'W';

/** Hull classification codes. See PLAN.md §2.2 for the mapping to the official ships. */
export type ShipClass = 'CV' | 'BB' | 'DD' | 'DE' | 'PB';

export type Side = 'player' | 'cpu';

export interface Ship {
	class: ShipClass;
	/** Cell the bow occupies. */
	bow: Coord;
	facing: Facing;
}

/** A ship placed on a board, with its damage tracked per cell. */
export interface FleetShip extends Ship {
	/** Parallel to `cellsOf(ship)`: `hits[i]` is true once that cell has been hit. */
	hits: boolean[];
}

export type ShotResult = 'hit' | 'miss';

/** What the shooter has learnt about one cell of the opposing board. */
export type MarkKind = 'miss' | 'hit' | 'scan';

export interface Mark {
	kind: MarkKind;
	/** Set on `hit` marks once the ship that owned the cell was sunk. */
	revealedClass?: ShipClass;
	/**
	 * Turn the mark was made. Only stamped under MOBILE FLEET, where a miss
	 * stops being the last word on a cell once ships can sail into it.
	 */
	turn?: number;
}

export interface BoardSize {
	rows: number;
	cols: number;
}
