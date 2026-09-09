import { boardSize, coordLabel, type Edition } from '$lib/engine/edition';
import { createBoard, isFleetDestroyed, markAt, type Board } from '$lib/engine/board';
import { randomFleet, rotateWithKick, nudge, canPlace } from '$lib/engine/placement';
import {
	earnsExtraTurn,
	fireAt,
	markScan,
	other,
	shotEvents,
	shotsPerTurn,
	victoryEvent,
	type GameEvent
} from '$lib/engine/resolve';
import { chooseSalvo, type Difficulty } from '$lib/engine/ai';
import { chooseWeapon } from '$lib/engine/ai/weaponChoice';
import {
	availableWeapons,
	emptyArsenal,
	fireWeapon,
	previewCells,
	roundsLeft,
	isCarrierWeapon,
	weaponSpec,
	type Arsenal,
	type WeaponId,
	type WeaponUse
} from '$lib/engine/weapons/index';
import type { Orientation } from '$lib/engine/weapons/patterns';
import {
	fireAntiAir,
	flySweep,
	liveAircraft,
	loseGroundedAt,
	newAircraft,
	type Aircraft,
	type ScanPattern
} from '$lib/engine/weapons/aircraft';
import {
	DEFAULT_RULES,
	effectiveRules,
	NO_HOUSE_RULES,
	type GameType,
	type HouseRules,
	type RuleSet,
	type Weapons
} from '$lib/engine/ruleset';
import { mulberry32, type Rng } from '$lib/engine/rng';
import { shipSpec } from '$lib/engine/fleet';
import { cellsOf } from '$lib/engine/geometry';
import {
	moveShip,
	previewMove,
	shipsUnderWay,
	type Heading
} from '$lib/engine/movement';
import { FORMATIONS, type FormationId } from '$lib/data/formations';
import {
	boardSnapshot,
	clearSnapshot,
	readSnapshot,
	restoreBoard,
	writeSnapshot,
	SNAPSHOT_VERSION,
	type Snapshot
} from '$lib/engine/persist';
import type { Coord, Ship, ShipClass, Side } from '$lib/engine/types';
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

	rules = $state<RuleSet>({ ...DEFAULT_RULES, house: { ...NO_HOUSE_RULES } });
	/** Cells called but not yet answered, while a salvo is being assembled. */
	pending = $state<Coord[]>([]);
	/** Rounds spent, per weapon, for each side. */
	playerArsenal = $state<Arsenal>(emptyArsenal());
	cpuArsenal = $state<Arsenal>(emptyArsenal());
	/** The weapon the player is aiming, if any. */
	armed = $state<WeaponId | null>(null);
	orientation = $state<Orientation>('H');
	pattern = $state<ScanPattern>('PLUS');
	/** Own planes, hovering over enemy waters once launched. */
	playerFlight = $state<Aircraft[]>([]);
	cpuFlight = $state<Aircraft[]>([]);
	/** Which own plane the next launch order applies to. */
	activePlane = $state(0);
	/** Set while the fleet came from a rulebook formation rather than by hand. */
	presetId = $state<FormationId | null>(null);
	/** Turns elapsed. Only used to age misses under MOBILE FLEET. */
	turnCount = $state(0);
	/** Index into shipsUnderWay of the hull the player is about to move. */
	movingShip = $state(0);
	/** True when this session picked up an interrupted game. */
	resumed = $state(false);

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

	/**
	 * Picks up an interrupted game, or starts a fresh one.
	 *
	 * The save is read first on purpose: constructing a Game runs reset(), which
	 * clears the save, so reading afterwards would always find nothing.
	 */
	static resume(seed = Date.now(), synth = new Synth()): Game {
		const saved = readSnapshot();
		const game = new Game(seed, synth);
		if (saved) game.restore(saved);
		return game;
	}

	snapshot(): Snapshot {
		return {
			version: SNAPSHOT_VERSION,
			edition: this.edition,
			rules: structuredClone($state.snapshot(this.rules)),
			difficulty: this.difficulty,
			phase: this.phase,
			turn: this.turn,
			winner: this.winner,
			cursor: { ...this.cursor },
			pending: this.pending.map((c) => ({ ...c })),
			playerBoard: boardSnapshot($state.snapshot(this.playerBoard) as Board),
			cpuBoard: boardSnapshot($state.snapshot(this.cpuBoard) as Board),
			playerFlight: structuredClone($state.snapshot(this.playerFlight)) as Aircraft[],
			cpuFlight: structuredClone($state.snapshot(this.cpuFlight)) as Aircraft[],
			playerArsenal: { ...this.playerArsenal },
			cpuArsenal: { ...this.cpuArsenal },
			log: this.log.map((line) => ({ ...line }))
		};
	}

	restore(saved: Snapshot) {
		this.edition = saved.edition;
		this.rules = saved.rules;
		this.difficulty = saved.difficulty;
		this.phase = saved.phase;
		this.turn = saved.turn;
		this.winner = saved.winner;
		this.cursor = saved.cursor;
		this.pending = saved.pending;
		this.playerBoard = restoreBoard(this.size, saved.playerBoard);
		this.cpuBoard = restoreBoard(this.size, saved.cpuBoard);
		this.playerFleet = this.playerBoard.ships.map((ship) => ({
			class: ship.class,
			bow: { ...ship.bow },
			facing: ship.facing
		}));
		this.playerFlight = saved.playerFlight;
		this.cpuFlight = saved.cpuFlight;
		this.playerArsenal = saved.playerArsenal;
		this.cpuArsenal = saved.cpuArsenal;
		this.log = saved.log;
		this.#logId = (saved.log.at(-1)?.id ?? 0) + 1;
		this.armed = null;
		this.presetId = null;
		this.resumed = true;

		// Constructing this Game cleared the stored save, so put it back.
		this.#checkpoint();

		// A save taken mid-CPU-turn would otherwise stall the game forever.
		if (this.phase === 'battle' && this.turn === 'cpu') {
			setTimeout(() => this.#cpuTurn(), 420);
		}
	}

	/** Exposed so tests can hand the same silent synth to a resumed game. */
	get synthForTest() {
		return this.#synth;
	}

	#save() {
		writeSnapshot(this.snapshot());
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

	get effective() {
		return effectiveRules(this.rules);
	}

	/** Shots the player may call this turn. */
	get allowance() {
		return shotsPerTurn(this.playerBoard, this.effective);
	}

	setGameType(gameType: GameType) {
		this.rules = { ...this.rules, gameType };
	}

	setWeapons(weapons: Weapons) {
		this.rules = { ...this.rules, weapons };
		if (weapons === 'BASIC') this.armed = null;
	}

	get weaponsOnOffer() {
		if (!this.effective.advancedWeapons) return [];
		return availableWeapons(this.playerBoard, this.playerArsenal);
	}

	roundsFor(id: WeaponId) {
		return roundsLeft(weaponSpec(id), this.playerArsenal);
	}

	arm(id: WeaponId | null) {
		this.armed = this.armed === id ? null : id;
		this.pending = [];
	}

	/** Which board the armed weapon is aimed at, for the interface to point at. */
	get aimingAt(): 'enemy' | 'own' | null {
		if (!this.armed) return null;
		return weaponSpec(this.armed).ownWaters ? 'own' : 'enemy';
	}

	/**
	 * Why the weapons list is empty, so the interface can say what to do about
	 * it rather than only that there is nothing there.
	 */
	get weaponsUnavailableReason(): 'edition' | 'basic' | 'ships' | null {
		if (this.weaponsOnOffer.length) return null;
		if (this.edition !== 'DELUXE') return 'edition';
		if (this.rules.weapons !== 'ADVANCED') return 'basic';
		return 'ships';
	}

	toggleOrientation() {
		this.orientation = this.orientation === 'H' ? 'V' : 'H';
		this.pattern = this.pattern === 'PLUS' ? 'X' : 'PLUS';
	}

	selectPlane(id: number) {
		this.activePlane = id;
	}

	/** Planes still able to fly, in slot order. */
	get flightReady() {
		return liveAircraft(this.playerFlight);
	}

	/** The turn number handed to fireAt, or undefined when misses never go stale. */
	get markTurn() {
		return this.effective.mobileFleet ? this.turnCount : undefined;
	}

	get placementRules() {
		return { noAdjacency: this.effective.noAdjacency };
	}

	/** Own ships that could get under way this turn. */
	get underWay() {
		if (!this.effective.mobileFleet || this.phase !== 'battle' || this.turn !== 'player') return [];
		return shipsUnderWay(this.playerBoard, this.placementRules);
	}

	selectMover(index: number) {
		this.movingShip = index;
	}

	/** Where the selected ship would end up, for the preview. */
	movePreview(heading: Heading): Coord[] {
		const ship = this.underWay[this.movingShip];
		if (!ship) return [];
		return previewMove(ship, heading, this.playerBoard.ships, this.size, this.placementRules);
	}

	/** Gets one ship under way. This is the turn's action, in place of firing. */
	steer(heading: Heading) {
		if (this.phase !== 'battle' || this.turn !== 'player') return false;
		const ship = this.underWay[this.movingShip];
		if (!ship || !moveShip(this.playerBoard, ship, heading, this.placementRules)) return false;

		this.playerBoard = { ...this.playerBoard };
		this.playerFleet = this.playerBoard.ships.map((s) => ({
			class: s.class,
			bow: { ...s.bow },
			facing: s.facing
		}));
		// The deck moved, so anything still parked on it moves too.
		this.#reseatFlight(this.playerFlight, ship.class);

		this.#say('player', `${shipSpec(ship.class).name} under way, one cell ${heading}`);
		play(this.#synth, 'launch');
		this.pending = [];
		this.#afterPlayerTurn([]);
		return true;
	}

	/** Keeps parked aircraft on their carrier after it moves. */
	#reseatFlight(flight: Aircraft[], moved: ShipClass) {
		if (moved !== 'CV') return;
		const carrier = this.playerBoard.ships.find((s) => s.class === 'CV');
		if (!carrier) return;
		const deck = cellsOf(carrier);
		flight.forEach((plane, i) => {
			if (plane.at === null) plane.home = { ...deck[i === 0 ? 1 : 3] };
		});
		this.playerFlight = [...flight];
	}

	/** Cells the armed weapon would touch if fired at the reticle. */
	get aimPreview(): Coord[] {
		if (!this.armed) return [];
		return previewCells(
			{
				weapon: this.armed,
				at: this.cursor,
				orientation: this.orientation,
				pattern: this.pattern
			},
			this.cpuBoard
		);
	}

	setHouseRule<K extends keyof HouseRules>(key: K, value: HouseRules[K]) {
		this.rules = { ...this.rules, house: { ...this.rules.house, [key]: value } };
		// Placement legality can change under NO ADJACENCY, so start clean.
		if (this.phase === 'deploy') this.shuffleFleet();
	}

	get busy() {
		return this.turn === 'cpu' || this.phase !== 'battle';
	}

	reset(edition: Edition = this.edition) {
		this.edition = edition;
		this.rules = { ...this.rules, edition };
		const size = boardSize(edition);
		const placement = { noAdjacency: this.effective.noAdjacency };
		this.playerFleet = randomFleet(size, this.#rng, placement);
		this.playerBoard = createBoard(size, this.playerFleet);
		this.cpuBoard = createBoard(size, randomFleet(size, this.#rng, placement));
		this.playerFlight = this.#boardFlight(this.playerBoard);
		this.cpuFlight = this.#boardFlight(this.cpuBoard);
		this.pending = [];
		this.playerArsenal = emptyArsenal();
		this.cpuArsenal = emptyArsenal();
		this.armed = null;
		this.activePlane = 0;
		this.phase = 'deploy';
		this.turn = 'player';
		this.winner = null;
		this.lamp = 'none';
		this.selected = 0;
		this.cursor = { row: 0, col: 0 };
		this.log = [];
		this.resumed = false;
		clearSnapshot();
		this.#say('system', 'Deploy your fleet. R rotates, arrows move, Enter confirms.');
	}

	// ---- deployment -------------------------------------------------------

	/** The rulebook's preset formations are drawn on the 14-wide grid only. */
	get presetsAvailable() {
		return this.edition === 'DELUXE';
	}

	/**
	 * Deploys one of the hundred formations from the rulebook, aircraft included.
	 * Rejected on CLASSIC, where files 11-14 do not exist.
	 */
	usePreset(id: FormationId) {
		if (!this.presetsAvailable) return false;
		const formation = FORMATIONS[id];
		if (!formation) return false;

		this.playerFleet = formation.ships.map((ship) => ({ ...ship, bow: { ...ship.bow } }));
		this.playerBoard = createBoard(this.size, this.playerFleet);
		this.playerFlight = formation.aircraft.map((cell, i) =>
			newAircraft(i as 0 | 1, { ...cell })
		);
		this.presetId = id;
		return true;
	}

	shuffleFleet() {
		this.presetId = null;
		this.playerFleet = randomFleet(this.size, this.#rng, {
			noAdjacency: this.effective.noAdjacency
		});
		this.playerBoard = createBoard(this.size, this.playerFleet);
		this.playerFlight = this.#boardFlight(this.playerBoard);
	}

	rotateSelected() {
		const ship = this.playerFleet[this.selected];
		const rotated = rotateWithKick(ship, this.playerFleet, this.size, {
			noAdjacency: this.effective.noAdjacency
		});
		if (!rotated) return false;
		this.#replaceSelected(rotated);
		return true;
	}

	nudgeSelected(delta: Coord) {
		const ship = this.playerFleet[this.selected];
		const moved = nudge(ship, delta, this.playerFleet, this.size, {
			noAdjacency: this.effective.noAdjacency
		});
		if (!moved) return false;
		this.#replaceSelected(moved);
		return true;
	}

	selectNext(step = 1) {
		const n = this.playerFleet.length;
		this.selected = (this.selected + step + n) % n;
	}

	/** Parks both planes on the carrier, on its second and fourth cells. */
	#boardFlight(board: Board): Aircraft[] {
		const carrier = board.ships.find((ship) => ship.class === 'CV');
		if (!carrier) return [];
		const cells = cellsOf(carrier);
		return [newAircraft(0, cells[1]), newAircraft(1, cells[3])];
	}

	#replaceSelected(ship: Ship) {
		this.presetId = null;
		const next = [...this.playerFleet];
		next[this.selected] = ship;
		this.playerFleet = next;
		this.playerBoard = createBoard(this.size, next);
		// Moving the carrier takes its deck - and therefore its planes - with it.
		this.playerFlight = this.#boardFlight(this.playerBoard);
	}

	get deploymentValid() {
		const placement = { noAdjacency: this.effective.noAdjacency };
		return this.playerFleet.every((ship, i) =>
			canPlace(
				ship,
				this.playerFleet.filter((_, j) => j !== i),
				this.size,
				placement
			)
		);
	}

	startBattle() {
		if (!this.deploymentValid) return;
		this.phase = 'battle';
		this.turn = 'player';
		this.pending = [];
		this.#say('system', 'Fleet on station. Awaiting orders.');
		this.#save();
	}

	// ---- battle -----------------------------------------------------------

	/**
	 * Calls one cell. Under Salvo the whole volley is assembled first and only
	 * answered once it is complete, which is what stops the player from steering
	 * later shots with the results of earlier ones.
	 */
	/** Fires the armed special weapon at the reticle. */
	fireArmed(coord: Coord) {
		if (this.phase !== 'battle' || this.turn !== 'player' || !this.armed) return;
		// Anti-aircraft fire is aimed at your own grid, where the enemy's planes
		// hover. Reaching it from the enemy board would read the coordinate
		// against the wrong ocean entirely, so it has to come via fireOwnWaters.
		if (weaponSpec(this.armed).ownWaters) return;
		this.cursor = coord;

		if (isCarrierWeapon(this.armed)) {
			this.#fireCarrierWeapon(this.armed, coord);
			return;
		}

		const use: WeaponUse = { weapon: this.armed, at: coord, orientation: this.orientation };
		const outcome = fireWeapon(this.cpuBoard, use, 'player', !this.effective.sunkSilence, this.markTurn);
		if (!outcome.fired) {
			this.#say('system', 'That launch point is not on the grid edge.');
			return;
		}

		this.playerArsenal = { ...this.playerArsenal, [this.armed]: this.playerArsenal[this.armed] + 1 };
		this.armed = null;

		this.#emit(outcome.events);
		this.cpuBoard = { ...this.cpuBoard };
		this.#afterPlayerTurn(outcome.events);
	}

	/** Anti-aircraft fire is aimed at your own waters, so it has its own entry. */
	fireOwnWaters(coord: Coord) {
		if (this.phase !== 'battle' || this.turn !== 'player') return;
		if (this.armed !== 'ANTI_AIR') return;
		this.#fireCarrierWeapon('ANTI_AIR', coord);
	}

	#fireCarrierWeapon(weapon: WeaponId, coord: Coord) {
		if (weapon === 'ANTI_AIR') {
			const downed = fireAntiAir(this.cpuFlight, coord);
			this.cpuFlight = [...this.cpuFlight];
			this.armed = null;
			this.#say(
				'player',
				downed
					? `Anti-aircraft fire at ${coordLabel(coord.row, coord.col)} — enemy aircraft down`
					: `Anti-aircraft fire at ${coordLabel(coord.row, coord.col)} — nothing there`
			);
			play(this.#synth, downed ? 'shootdown' : 'miss');
			this.#afterPlayerTurn([]);
			return;
		}

		const plane = this.flightReady[this.activePlane];
		if (!plane) {
			this.#say('system', 'No aircraft left to fly.');
			return;
		}

		const launching = plane.at === null;
		plane.at = coord;
		plane.pattern = this.pattern;

		const outcome = flySweep(
			this.cpuBoard,
			coord,
			this.pattern,
			plane.armed,
			'player',
			!this.effective.sunkSilence
		);
		if (outcome.spentAmmo) plane.armed = false;

		this.playerFlight = [...this.playerFlight];
		this.armed = null;

		if (launching) play(this.#synth, 'launch');
		this.#emit(outcome.events);
		this.cpuBoard = { ...this.cpuBoard };
		this.#afterPlayerTurn(outcome.events);
	}

	playerFire(coord: Coord) {
		if (this.phase !== 'battle' || this.turn !== 'player') return;
		this.cursor = coord;
		if (this.armed) {
			this.fireArmed(coord);
			return;
		}
		if (markAt(this.cpuBoard, coord)?.kind === 'hit') return;
		if (markAt(this.cpuBoard, coord)?.kind === 'miss') return;

		const already = this.pending.findIndex((c) => c.row === coord.row && c.col === coord.col);
		if (already >= 0) {
			// Tapping a called cell again takes it back.
			this.pending = this.pending.filter((_, i) => i !== already);
			return;
		}

		if (this.pending.length >= this.allowance) return;
		this.pending = [...this.pending, coord];
		if (this.pending.length >= this.allowance) this.#resolvePlayerVolley();
	}

	#resolvePlayerVolley() {
		const volley = this.pending;
		this.pending = [];

		const events: GameEvent[] = [];
		for (const coord of volley) {
			const outcome = fireAt(this.cpuBoard, coord, !this.effective.sunkSilence, this.markTurn);
			events.push(...shotEvents('player', coord, outcome));
		}
		this.#emit(events);
		this.cpuBoard = { ...this.cpuBoard };
		this.#afterPlayerTurn(events);
	}

	#afterPlayerTurn(events: GameEvent[]) {
		this.turnCount++;
		this.#reapGrounded(events, 'cpu');
		if (this.#checkVictory('player', this.cpuBoard)) return;

		if (earnsExtraTurn(events, this.effective)) {
			this.#emit([{ type: 'extraTurn', side: 'player', reason: 'hit' }]);
			return;
		}

		this.turn = 'cpu';
		this.#checkpoint();
		setTimeout(() => this.#cpuTurn(), 420);
	}

	#cpuTurn() {
		if (this.phase !== 'battle') return;

		if (this.effective.advancedWeapons && this.difficulty === 3) {
			const use = chooseWeapon(this.playerBoard, this.cpuBoard, this.cpuArsenal, this.#rng);
			if (use) {
				const outcome = fireWeapon(
					this.playerBoard,
					use,
					'cpu',
					!this.effective.sunkSilence
				);
				if (outcome.fired) {
					this.cpuArsenal = {
						...this.cpuArsenal,
						[use.weapon]: this.cpuArsenal[use.weapon] + 1
					};
					this.#emit(outcome.events);
					this.playerBoard = { ...this.playerBoard };
					this.#afterCpuTurn(outcome.events);
					return;
				}
			}
		}

		// Under MOBILE FLEET, pull a threatened hull out of the line of fire
		// instead of shooting. The CPU is held to the same one-ship-a-turn limit.
		if (this.effective.mobileFleet && this.#cpuSteer()) return;

		const count = shotsPerTurn(this.cpuBoard, this.effective);
		const volley = chooseSalvo(
			this.playerBoard,
			this.difficulty,
			this.#rng,
			count,
			this.markTurn
		);
		if (!volley.length) return;

		const events: GameEvent[] = [];
		for (const shot of volley) {
			const outcome = fireAt(this.playerBoard, shot, !this.effective.sunkSilence, this.markTurn);
			events.push(...shotEvents('cpu', shot, outcome));
		}
		this.#emit(events);
		this.playerBoard = { ...this.playerBoard };
		this.#afterCpuTurn(events);
	}

	/**
	 * Moves a CPU ship the player has been shooting near. Returns true when it
	 * spent the turn doing so.
	 */
	#cpuSteer(): boolean {
		const candidates = shipsUnderWay(this.cpuBoard, this.placementRules);
		if (!candidates.length) return false;

		const threatened = candidates.find((ship) =>
			cellsOf(ship).some((cell) => this.#firedNear(cell))
		);
		if (!threatened) return false;

		const heading: Heading = this.#rng.next() < 0.5 ? 'ahead' : 'astern';
		const moved =
			moveShip(this.cpuBoard, threatened, heading, this.placementRules) ||
			moveShip(this.cpuBoard, threatened, heading === 'ahead' ? 'astern' : 'ahead', this.placementRules);
		if (!moved) return false;

		this.cpuBoard = { ...this.cpuBoard };
		this.#say('cpu', 'A ship is under way');
		play(this.#synth, 'launch');
		this.#afterCpuTurn([]);
		return true;
	}

	/** True when the player has resolved a shot within one cell of `cell`. */
	#firedNear(cell: Coord): boolean {
		for (let dr = -1; dr <= 1; dr++) {
			for (let dc = -1; dc <= 1; dc++) {
				const row = cell.row + dr;
				const col = cell.col + dc;
				if (row < 0 || row >= this.size.rows || col < 0 || col >= this.size.cols) continue;
				const mark = markAt(this.cpuBoard, { row, col });
				if (mark && mark.kind !== 'scan') return true;
			}
		}
		return false;
	}

	#afterCpuTurn(events: GameEvent[]) {
		this.turnCount++;
		this.#reapGrounded(events, 'player');
		if (this.#checkVictory('cpu', this.playerBoard)) return;

		if (earnsExtraTurn(events, this.effective)) {
			this.#emit([{ type: 'extraTurn', side: 'cpu', reason: 'hit' }]);
			setTimeout(() => this.#cpuTurn(), 420);
			return;
		}

		this.turn = 'player';
		this.#checkpoint();
	}

	/** A plane still on deck is lost when the cell under it is hit. */
	#reapGrounded(events: readonly GameEvent[], owner: Side) {
		const flight = owner === 'cpu' ? this.cpuFlight : this.playerFlight;
		if (!flight.length) return;

		let lost = 0;
		for (const event of events) {
			if (event.type !== 'shot' || event.result !== 'hit') continue;
			lost += loseGroundedAt(flight, event.coord).length;
		}
		if (!lost) return;

		if (owner === 'cpu') this.cpuFlight = [...flight];
		else this.playerFlight = [...flight];

		this.#say(
			owner === 'cpu' ? 'player' : 'cpu',
			`${lost} aircraft destroyed on deck`
		);
		play(this.#synth, 'shootdown');
	}

	#checkVictory(shooter: Side, target: Board): boolean {
		const event = victoryEvent(shooter, target);
		if (!event) return false;
		this.#emit([event]);
		this.winner = shooter;
		this.phase = 'result';
		this.#save();
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

	/** Called after anything that changes the position, so a reload resumes it. */
	#checkpoint() {
		if (this.phase === 'battle' || this.phase === 'result') this.#save();
	}
}

export { other };
