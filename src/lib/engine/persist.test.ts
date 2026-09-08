import { describe, expect, it } from 'vitest';
import {
	boardSnapshot,
	clearSnapshot,
	readSnapshot,
	restoreBoard,
	writeSnapshot,
	SNAPSHOT_VERSION,
	type Snapshot
} from './persist';
import { boardSize } from './edition';
import { createBoard, markAt } from './board';
import { fireAt } from './resolve';
import { randomFleet } from './placement';
import { mulberry32 } from './rng';

/** Stands in for localStorage, including the shapes that misbehave. */
function fakeStore(initial: Record<string, string> = {}) {
	const map = new Map(Object.entries(initial));
	return {
		getItem: (k: string) => map.get(k) ?? null,
		setItem: (k: string, v: string) => void map.set(k, v),
		removeItem: (k: string) => void map.delete(k),
		size: () => map.size
	};
}

const SIZE = boardSize('DELUXE');

function playedBoard() {
	const board = createBoard(SIZE, randomFleet(SIZE, mulberry32(3)));
	fireAt(board, { row: 0, col: 0 });
	fireAt(board, { row: 5, col: 5 });
	return board;
}

describe('board snapshots', () => {
	it('round-trips ships, damage and marks', () => {
		const board = playedBoard();
		const restored = restoreBoard(SIZE, JSON.parse(JSON.stringify(boardSnapshot(board))));

		expect(restored.ships).toEqual(board.ships);
		expect(restored.marks).toEqual(board.marks);
		expect(markAt(restored, { row: 0, col: 0 })).toEqual(markAt(board, { row: 0, col: 0 }));
	});

	it('copies rather than aliasing the live board', () => {
		const board = playedBoard();
		const snapshot = boardSnapshot(board);
		fireAt(board, { row: 9, col: 9 });

		expect(snapshot.marks[9 * SIZE.cols + 9]).toBeNull();
	});
});

describe('storage', () => {
	const snap = (over: Partial<Snapshot> = {}) =>
		({
			version: SNAPSHOT_VERSION,
			playerBoard: boardSnapshot(playedBoard()),
			cpuBoard: boardSnapshot(playedBoard()),
			...over
		}) as Snapshot;

	it('writes and reads a snapshot back', () => {
		const store = fakeStore();
		expect(writeSnapshot(snap(), store)).toBe(true);
		expect(readSnapshot(store)?.version).toBe(SNAPSHOT_VERSION);
	});

	it('returns null when nothing was saved', () => {
		expect(readSnapshot(fakeStore())).toBeNull();
	});

	it('drops a save written by an older shape', () => {
		const store = fakeStore();
		writeSnapshot(snap({ version: SNAPSHOT_VERSION - 1 }), store);
		expect(readSnapshot(store)).toBeNull();
	});

	it('drops a save that is missing its fleets', () => {
		const store = fakeStore({
			'salvonet.game': JSON.stringify({ version: SNAPSHOT_VERSION, playerBoard: { ships: [] } })
		});
		expect(readSnapshot(store)).toBeNull();
	});

	it('survives corrupt JSON rather than throwing', () => {
		const store = fakeStore({ 'salvonet.game': '{not json' });
		expect(() => readSnapshot(store)).not.toThrow();
		expect(readSnapshot(store)).toBeNull();
	});

	it('reports failure instead of throwing when the quota is full', () => {
		const store = {
			getItem: () => null,
			setItem: () => {
				throw new Error('QuotaExceededError');
			},
			removeItem: () => {}
		};
		expect(writeSnapshot(snap(), store)).toBe(false);
	});

	it('does nothing at all when storage is unavailable', () => {
		expect(writeSnapshot(snap(), null)).toBe(false);
		expect(readSnapshot(null)).toBeNull();
		expect(() => clearSnapshot(null)).not.toThrow();
	});

	it('clears a saved game', () => {
		const store = fakeStore();
		writeSnapshot(snap(), store);
		clearSnapshot(store);
		expect(readSnapshot(store)).toBeNull();
	});
});
