import type { BoardSize, Coord } from '../types';

export type Orientation = 'H' | 'V';

function onBoard(coord: Coord, size: BoardSize): boolean {
	return coord.row >= 0 && coord.row < size.rows && coord.col >= 0 && coord.col < size.cols;
}

/**
 * The battleship's missile: nine cells around a centre. Anything hanging off
 * the board is simply dropped, so an edge shot is legal but covers less.
 */
export function block3x3(centre: Coord, size: BoardSize): Coord[] {
	const cells: Coord[] = [];
	for (let dr = -1; dr <= 1; dr++) {
		for (let dc = -1; dc <= 1; dc++) {
			const cell = { row: centre.row + dr, col: centre.col + dc };
			if (onBoard(cell, size)) cells.push(cell);
		}
	}
	return cells;
}

/** The destroyer's missile: three cells in a row, addressed by their centre. */
export function line3(centre: Coord, orientation: Orientation, size: BoardSize): Coord[] {
	const cells: Coord[] = [];
	for (let d = -1; d <= 1; d++) {
		const cell =
			orientation === 'H'
				? { row: centre.row, col: centre.col + d }
				: { row: centre.row + d, col: centre.col };
		if (onBoard(cell, size)) cells.push(cell);
	}
	return cells;
}

/**
 * The escort's homing missile: launched from a cell on the grid edge, running
 * straight across. Returns the whole lane in travel order; the resolver stops
 * it at the first ship it meets.
 *
 * Returns an empty lane if the launch cell is not on an edge of the chosen
 * axis, which keeps an illegal launch from silently becoming a legal one.
 */
export function homingLane(launch: Coord, orientation: Orientation, size: BoardSize): Coord[] {
	if (!onBoard(launch, size)) return [];

	let step: Coord | null = null;
	if (orientation === 'H') {
		if (launch.col === 0) step = { row: 0, col: 1 };
		else if (launch.col === size.cols - 1) step = { row: 0, col: -1 };
	} else {
		if (launch.row === 0) step = { row: 1, col: 0 };
		else if (launch.row === size.rows - 1) step = { row: -1, col: 0 };
	}
	if (!step) return [];

	const lane: Coord[] = [];
	let cell = launch;
	while (onBoard(cell, size)) {
		lane.push(cell);
		cell = { row: cell.row + step.row, col: cell.col + step.col };
	}
	return lane;
}

/** Cells a sonar sweep covers: the centre and its eight neighbours. */
export function sonarArea(centre: Coord, size: BoardSize): Coord[] {
	return block3x3(centre, size);
}

/** Every edge cell that can launch a homing missile along the given axis. */
export function launchCells(orientation: Orientation, size: BoardSize): Coord[] {
	const cells: Coord[] = [];
	if (orientation === 'H') {
		for (let row = 0; row < size.rows; row++) {
			cells.push({ row, col: 0 }, { row, col: size.cols - 1 });
		}
	} else {
		for (let col = 0; col < size.cols; col++) {
			cells.push({ row: 0, col }, { row: size.rows - 1, col });
		}
	}
	return cells;
}
