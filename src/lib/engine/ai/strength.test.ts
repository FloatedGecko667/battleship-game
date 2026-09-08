import { describe, expect, it } from 'vitest';
import { boardSize } from '../edition';
import { createBoard } from '../board';
import { fireAt } from '../resolve';
import { mulberry32 } from '../rng';
import { randomFleet } from '../placement';
import { chooseShot, type Difficulty } from './index';
import { moveShip, shipsUnderWay } from '../movement';
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

	it('pays roughly half as much again against a fleet that keeps moving', () => {
		// Measured over 300 games with a 2000-shot cap: a median of 65 and about
		// 1-2% that a ship evades indefinitely, since moving costs the defender
		// their turn rather than being free.
		const rng = mulberry32(11);
		const finished: number[] = [];

		for (let seed = 0; seed < 60; seed++) {
			const board = createBoard(CLASSIC, randomFleet(CLASSIC, mulberry32(seed)));
			let shots = 0;
			let turn = 0;

			while (!board.ships.every((ship) => ship.hits.every(Boolean)) && shots < 600) {
				if (rng.next() < 0.3) {
					const movers = shipsUnderWay(board);
					if (movers.length) {
						moveShip(board, movers[rng.int(movers.length)], rng.next() < 0.5 ? 'ahead' : 'astern');
					}
				}
				const shot = chooseShot(board, 3, rng, turn);
				if (!shot) break;
				fireAt(board, shot, true, turn);
				shots++;
				turn++;
			}
			if (board.ships.every((ship) => ship.hits.every(Boolean))) finished.push(shots);
		}

		// Most games must still end, and end in a sane number of shots.
		expect(finished.length).toBeGreaterThan(50);
		const mean = finished.reduce((a, b) => a + b, 0) / finished.length;
		expect(mean).toBeGreaterThan(50);
		expect(mean).toBeLessThan(120);
	});

	it('still clears the wider DELUXE board', () => {
		const mean = meanShots(3, 40, boardSize('DELUXE'));
		// 140 cells instead of 100, so more shots are expected - but not a sweep.
		expect(mean).toBeGreaterThan(45);
		expect(mean).toBeLessThan(90);
	});
});
