import type { BoardSize, Coord, FleetShip, Mark, Ship, ShipClass } from './types';
import { cellsOf } from './geometry';
import { shipLength } from './fleet';

export interface Board {
	size: BoardSize;
	ships: FleetShip[];
	/** Row-major, length rows*cols. `null` means nothing has been fired there. */
	marks: (Mark | null)[];
}

export function cellIndex(coord: Coord, size: BoardSize): number {
	return coord.row * size.cols + coord.col;
}

export function indexToCoord(index: number, size: BoardSize): Coord {
	return { row: Math.floor(index / size.cols), col: index % size.cols };
}

export function createBoard(size: BoardSize, ships: readonly Ship[]): Board {
	return {
		size,
		ships: ships.map((ship) => ({ ...ship, hits: new Array(shipLength(ship.class)).fill(false) })),
		marks: new Array(size.rows * size.cols).fill(null)
	};
}

export function markAt(board: Board, coord: Coord): Mark | null {
	return board.marks[cellIndex(coord, board.size)];
}

/** True once every cell of the ship has been hit. */
export function isSunk(ship: FleetShip): boolean {
	return ship.hits.every(Boolean);
}

export function isFleetDestroyed(board: Board): boolean {
	return board.ships.every(isSunk);
}

export function survivingShips(board: Board): FleetShip[] {
	return board.ships.filter((ship) => !isSunk(ship));
}

/** The ship occupying a cell, plus which of its hull segments that cell is. */
export function shipAt(
	board: Board,
	coord: Coord
): { ship: FleetShip; segment: number } | null {
	for (const ship of board.ships) {
		const cells = cellsOf(ship);
		for (let segment = 0; segment < cells.length; segment++) {
			if (cells[segment].row === coord.row && cells[segment].col === coord.col) {
				return { ship, segment };
			}
		}
	}
	return null;
}

/** Hull classes still afloat, for the fleet status panel. */
export function afloatClasses(board: Board): ShipClass[] {
	return survivingShips(board).map((ship) => ship.class);
}
