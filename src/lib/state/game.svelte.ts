import { boardSize, coordLabel, type Edition } from '$lib/engine/edition';
import { createBoard, isFleetDestroyed, type Board } from '$lib/engine/board';
import { randomFleet, rotateWithKick, nudge, canPlace } from '$lib/engine/placement';
import { fireAt, markScan, other, shotEvents, victoryEvent, type GameEvent } from '$lib/engine/resolve';
import { huntTarget } from '$lib/engine/ai/hunt';
import { pickRandom, type Difficulty } from '$lib/engine/ai';
import { mulberry32, type Rng } from '$lib/engine/rng';
import { shipSpec } from '$lib/engine/fleet';
import type { Coord, Ship, Side } from '$lib/engine/types';
import type { LogLine } from '$lib/ui/LogPanel.svelte';
import { Synth } from '$lib/audio/synth';
import { play, soundFor } from '$lib/audio/sounds';
import { speak } from '$lib/audio/speech';

export type Phase = 'deploy' | 'battle' | 'result';

/** Player-facing wording. The official voice lines are not reused. */
function describe(event: GameEvent): string | null {
	switch (event.type) {
		case 'shot':
			return `${event.side === 'player' ? 'Salvo' : 'Incoming'} ${coordLabel(
				event.coord.row,
				event.coord.col
			)} — ${event.result === 'hit' ? 'HIT' : 'miss'}`;
		case 'sunk':
			return `${event.side === 'player' ? 'Our' : 'Enemy'} ${shipSpec(event.shipClass).name} is down (${event.shipClass})`;
		case 'scan':
			return `Sonar ${coordLabel(event.coord.row, event.coord.col)} — ${
				event.detected ? 'contact' : 'clear water'
			}`;
		case 'repeat':
			return `${coordLabel(event.coord.row, event.coord.col)} already resolved`;
		case 'extraTurn':
			return 'Extra turn granted';
		case 'victory':
			return event.side === 'player' ? 'Enemy fleet destroyed.' : 'Our fleet is lost.';
	}
}

export class Game {
	edition = $state<Edition>('CLASSIC');
	difficulty = $state<Difficulty>(2);
	phase = $state<Phase>('deploy');
	turn = $state<Side>('player');
	winner = $state<Side | null>(null);
	lamp = $state<'none' | 'hit' | 'miss'>('none');
	muted = $state(false);
	narrate = $state(false);
	cursor = $state<Coord>({ row: 0, col: 0 });
	/** Index into `playerFleet` of the ship being positioned during deploy. */
	selected = $state(0);

	playerFleet = $state<Ship[]>([]);
	playerBoard = $state<Board>(createBoard(boardSize('CLASSIC'), []));
	cpuBoard = $state<Board>(createBoard(boardSize('CLASSIC'), []));
	log = $state<LogLine[]>([]);

	#rng: Rng;
	#logId = 0;
	#synth: Synth;

	constructor(seed = Date.now(), synth = new Synth()) {
		this.#rng = mulberry32(seed);
		this.#synth = synth;
		this.muted = synth.muted;
		this.reset();
	}

	/** Browsers only allow a context to start inside a gesture. */
	unlockAudio() {
		if (!this.#synth.started && this.#synth.unlock()) play(this.#synth, 'boot');
	}

	toggleMute() {
		this.muted = !this.muted;
		this.#synth.setMuted(this.muted);
	}

	cursorBlip() {
		play(this.#synth, 'cursor');
	}

	get size() {
		return boardSize(this.edition);
	}

	get busy() {
		return this.turn === 'cpu' || this.phase !== 'battle';
	}

	reset(edition: Edition = this.edition) {
		this.edition = edition;
		const size = boardSize(edition);
		this.playerFleet = randomFleet(size, this.#rng);
		this.playerBoard = createBoard(size, this.playerFleet);
		this.cpuBoard = createBoard(size, randomFleet(size, this.#rng));
		this.phase = 'deploy';
		this.turn = 'player';
		this.winner = null;
		this.lamp = 'none';
		this.selected = 0;
		this.cursor = { row: 0, col: 0 };
		this.log = [];
		this.#say('system', 'Deploy your fleet. R rotates, arrows move, Enter confirms.');
	}

	// ---- deployment -------------------------------------------------------

	shuffleFleet() {
		this.playerFleet = randomFleet(this.size, this.#rng);
		this.playerBoard = createBoard(this.size, this.playerFleet);
	}

	rotateSelected() {
		const ship = this.playerFleet[this.selected];
		const rotated = rotateWithKick(ship, this.playerFleet, this.size);
		if (!rotated) return false;
		this.#replaceSelected(rotated);
		return true;
	}

	nudgeSelected(delta: Coord) {
		const ship = this.playerFleet[this.selected];
		const moved = nudge(ship, delta, this.playerFleet, this.size);
		if (!moved) return false;
		this.#replaceSelected(moved);
		return true;
	}

	selectNext(step = 1) {
		const n = this.playerFleet.length;
		this.selected = (this.selected + step + n) % n;
	}

	#replaceSelected(ship: Ship) {
		const next = [...this.playerFleet];
		next[this.selected] = ship;
		this.playerFleet = next;
		this.playerBoard = createBoard(this.size, next);
	}

	get deploymentValid() {
		return this.playerFleet.every((ship, i) =>
			canPlace(ship, this.playerFleet.filter((_, j) => j !== i), this.size)
		);
	}

	startBattle() {
		if (!this.deploymentValid) return;
		this.phase = 'battle';
		this.turn = 'player';
		this.#say('system', 'Fleet on station. Awaiting orders.');
	}

	// ---- battle -----------------------------------------------------------

	playerFire(coord: Coord) {
		if (this.phase !== 'battle' || this.turn !== 'player') return;

		const outcome = fireAt(this.cpuBoard, coord);
		if (outcome.repeat) {
			this.#emit(shotEvents('player', coord, outcome));
			return;
		}

		this.#emit(shotEvents('player', coord, outcome));
		this.cpuBoard = { ...this.cpuBoard };

		if (this.#checkVictory('player', this.cpuBoard)) return;

		this.turn = 'cpu';
		setTimeout(() => this.#cpuTurn(), 420);
	}

	#cpuTurn() {
		if (this.phase !== 'battle') return;

		const shot =
			this.difficulty === 1
				? pickRandom(this.playerBoard, this.#rng)
				: huntTarget(this.playerBoard, this.#rng);
		if (!shot) return;

		const outcome = fireAt(this.playerBoard, shot);
		this.#emit(shotEvents('cpu', shot, outcome));
		this.playerBoard = { ...this.playerBoard };

		if (this.#checkVictory('cpu', this.playerBoard)) return;
		this.turn = 'player';
	}

	#checkVictory(shooter: Side, target: Board): boolean {
		const event = victoryEvent(shooter, target);
		if (!event) return false;
		this.#emit([event]);
		this.winner = shooter;
		this.phase = 'result';
		return isFleetDestroyed(target);
	}

	scan(coord: Coord) {
		markScan(this.cpuBoard, coord);
		this.cpuBoard = { ...this.cpuBoard };
	}

	// ---- plumbing ---------------------------------------------------------

	/**
	 * The single place events turn into output. Lamps, sound and the log all
	 * read this one stream, so they can never drift apart.
	 */
	#emit(events: GameEvent[]) {
		for (const event of events) {
			if (event.type === 'shot') this.lamp = event.result === 'hit' ? 'hit' : 'miss';

			const sound = soundFor(event);
			if (sound) play(this.#synth, sound);

			const text = describe(event);
			if (text) {
				this.#say(event.type === 'victory' ? 'system' : event.side, text);
				speak(text, this.narrate);
			}
		}
	}

	#say(side: LogLine['side'], text: string) {
		this.log = [...this.log, { id: this.#logId++, side, text }].slice(-120);
	}
}

export { other };
