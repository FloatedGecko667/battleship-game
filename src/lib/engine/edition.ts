import type { BoardSize } from './types';

export type Edition = 'CLASSIC' | 'DELUXE';

/**
 * CLASSIC is the 10x10 game everyone knows. DELUXE is the 2012 tie-in unit,
 * whose ocean grid is A-J by 1-14 (see docs/ rulebook pp. 18-27).
 */
export const BOARD_SIZE: Record<Edition, BoardSize> = {
	CLASSIC: { rows: 10, cols: 10 },
	DELUXE: { rows: 10, cols: 14 }
};

/** Rank letters. Both editions use ten ranks, A through J. */
export const RANKS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'] as const;

/** The rulebook calls ranks out in the NATO alphabet; the TUI shows both. */
export const PHONETIC: Record<(typeof RANKS)[number], string> = {
	A: 'Alpha',
	B: 'Bravo',
	C: 'Charlie',
	D: 'Delta',
	E: 'Echo',
	F: 'Foxtrot',
	G: 'Golf',
	H: 'Hotel',
	I: 'India',
	J: 'Juliet'
};

export function boardSize(edition: Edition): BoardSize {
	return BOARD_SIZE[edition];
}

/** "B5" style label for a zero-based coordinate. */
export function coordLabel(row: number, col: number): string {
	return `${RANKS[row]}${col + 1}`;
}

/**
 * "Bravo 5". The unit calls coordinates in the NATO alphabet, and spelling the
 * rank out also makes screen-reader output unambiguous.
 */
export function phoneticLabel(row: number, col: number): string {
	return `${PHONETIC[RANKS[row]]} ${col + 1}`;
}

/** Parses "B5" / "b5" back into a zero-based coordinate, or null if malformed. */
export function parseCoord(label: string, size: BoardSize): { row: number; col: number } | null {
	const match = /^([A-Ja-j])(\d{1,2})$/.exec(label.trim());
	if (!match) return null;
	const row = RANKS.indexOf(match[1].toUpperCase() as (typeof RANKS)[number]);
	const col = Number(match[2]) - 1;
	if (row < 0 || row >= size.rows || col < 0 || col >= size.cols) return null;
	return { row, col };
}
