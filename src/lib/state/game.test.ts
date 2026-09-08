import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Game } from './game.svelte';
import { Synth } from '$lib/audio/synth';
import { FakeAudioContext } from '$lib/audio/fakeContext';
import { untriedCells, viewOf } from '$lib/engine/ai';
import { shipAt } from '$lib/engine/board';
import { cellsOf } from '$lib/engine/geometry';

function makeGame(seed = 42) {
	const contexts: FakeAudioContext[] = [];
	class Tracked extends FakeAudioContext {
		constructor() {
			super();
			contexts.push(this);
		}
	}
	const synth = new Synth(Tracked as unknown as new () => AudioContext);
	synth.unlock();
	const game = new Game(seed, synth);
	return { game, synth, ctx: () => contexts[0] };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('turn flow', () => {
	it('starts in deployment with a legal fleet and an empty enemy board', () => {
		const { game } = makeGame();
		expect(game.phase).toBe('deploy');
		expect(game.playerFleet).toHaveLength(5);
		expect(game.deploymentValid).toBe(true);
		expect(untriedCells(viewOf(game.cpuBoard))).toHaveLength(100);
	});

	it('hands the turn to the CPU and back after a shot', () => {
		const { game } = makeGame();
		game.startBattle();

		game.playerFire({ row: 0, col: 0 });
		expect(game.turn).toBe('cpu');

		vi.runAllTimers();
		expect(game.turn).toBe('player');
		// One shot each.
		expect(untriedCells(viewOf(game.cpuBoard))).toHaveLength(99);
		expect(untriedCells(viewOf(game.playerBoard))).toHaveLength(99);
	});

	it('ignores a shot while the CPU is thinking', () => {
		const { game } = makeGame();
		game.startBattle();
		game.playerFire({ row: 0, col: 0 });

		game.playerFire({ row: 5, col: 5 });
		expect(untriedCells(viewOf(game.cpuBoard))).toHaveLength(99);
	});

	it('lights the lamp to match the shot', () => {
		const { game } = makeGame();
		game.startBattle();

		const target = game.cpuBoard.ships[0];
		game.playerFire(cellsOf(target)[0]);
		expect(game.lamp).toBe('hit');

		vi.runAllTimers();
		const empty = untriedCells(viewOf(game.cpuBoard)).find((c) => !shipAt(game.cpuBoard, c));
		game.playerFire(empty!);
		expect(game.lamp).toBe('miss');
	});

	it('ends the game once a whole fleet is down', () => {
		const { game } = makeGame();
		game.startBattle();

		for (const ship of game.cpuBoard.ships) {
			for (const cell of cellsOf(ship)) {
				if (game.phase !== 'battle') break;
				game.playerFire(cell);
				vi.runAllTimers();
			}
		}

		expect(game.phase).toBe('result');
		expect(game.winner).toBe('player');
	});
});

describe('deployment controls', () => {
	it('rotates the selected ship and keeps the fleet legal', () => {
		const { game } = makeGame();
		const before = game.playerFleet[game.selected].facing;
		const rotated = game.rotateSelected();

		if (rotated) expect(game.playerFleet[game.selected].facing).not.toBe(before);
		expect(game.deploymentValid).toBe(true);
	});

	it('cycles the selection through the whole fleet', () => {
		const { game } = makeGame();
		const seen = new Set<number>();
		for (let i = 0; i < 5; i++) {
			seen.add(game.selected);
			game.selectNext();
		}
		expect(seen.size).toBe(5);
		expect(game.selected).toBe(0);
	});

	it('reshuffles into another legal fleet', () => {
		const { game } = makeGame();
		game.shuffleFleet();
		expect(game.deploymentValid).toBe(true);
		expect(game.playerBoard.ships).toHaveLength(5);
	});
});

describe('audio wiring', () => {
	it('drives the synth from the event stream', () => {
		const { game, ctx } = makeGame();
		game.startBattle();

		const before = ctx().nodes.length;
		game.playerFire({ row: 0, col: 0 });
		expect(ctx().nodes.length).toBeGreaterThan(before);
	});

	it('goes silent when muted, while the log keeps running', () => {
		const { game, ctx } = makeGame();
		game.startBattle();
		game.toggleMute();
		expect(game.muted).toBe(true);

		const before = ctx().nodes.length;
		const lines = game.log.length;
		game.playerFire({ row: 0, col: 0 });

		expect(ctx().nodes.length).toBe(before);
		expect(game.log.length).toBeGreaterThan(lines);
	});
});
