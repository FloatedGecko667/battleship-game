import { describe, expect, it } from 'vitest';
import { boardSize } from '../edition';
import { createBoard } from '../board';
import { fireAt } from '../resolve';
import { mulberry32 } from '../rng';
import { randomFleet } from '../placement';
import { chooseShot, type Difficulty } from './index';
import type { BoardSize } from '../types';

/** Shots the level needs to clear a whole fleet on its own. */
function shotsToClear(difficulty: Difficulty, seed: number, size: BoardSize): number {
	const rng = mulberry32(seed);
	const board = createBoard(size, randomFleet(size, rng));
	let shots = 0;

	while (!board.ships.every((ship) => ship.hits.every(Boolean))) {
		const shot = chooseShot(board, difficulty, rng);
		if (!shot) break;
		fireAt(board, shot);
		if (++shots > size.rows * size.cols) break;
	}
	return shots;
}

function meanShots(difficulty: Difficulty, games: number, size: BoardSize): number {
	let total = 0;
	for (let seed = 0; seed < games; seed++) total += shotsToClear(difficulty, seed, size);
	return total / games;
}

const CLASSIC = boardSize('CLASSIC');
const GAMES = 200;

/**
 * Locks in the measured strength of each level. Numbers come from a 300-game
 * sweep: L1 95.6, L2 50.5, L3 45.4 on 10x10. The bands are wide enough to
 * absorb seed noise but tight enough that a regression in the search shows up.
 */
describe('difficulty ladder', () => {
	it('leaves LEVEL 1 barely better than exhausting the board', () => {
		expect(meanShots(1, GAMES, CLASSIC)).toBeGreaterThan(85);
	});

	it('puts LEVEL 2 far ahead of random but short of the density search', () => {
		const mean = meanShots(2, GAMES, CLASSIC);
		expect(mean).toBeGreaterThan(40);
		expect(mean).toBeLessThan(60);
	});

	it('lands LEVEL 3 in the 40-50 band', () => {
		const mean = meanShots(3, GAMES, CLASSIC);
		expect(mean).toBeGreaterThan(40);
		expect(mean).toBeLessThan(50);
	});

	it('orders the levels strictly', () => {
		const [l1, l2, l3] = ([1, 2, 3] as Difficulty[]).map((d) => meanShots(d, 80, CLASSIC));
		expect(l2).toBeLessThan(l1);
		expect(l3).toBeLessThan(l2);
	});

	it('still clears the wider DELUXE board', () => {
		const mean = meanShots(3, 40, boardSize('DELUXE'));
		// 140 cells instead of 100, so more shots are expected - but not a sweep.
		expect(mean).toBeGreaterThan(45);
		expect(mean).toBeLessThan(90);
	});
});
