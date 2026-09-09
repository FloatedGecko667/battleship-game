import type { Board } from './board';
import type { Coord, FleetShip, Mark, Side } from './types';
import type { Edition } from './edition';
import type { RuleSet } from './ruleset';
import type { Arsenal } from './weapons/index';
import type { Aircraft } from './weapons/aircraft';

const KEY = 'firingsolution.game';

/** Read as a fallback so a game saved under the old name is not orphaned. */
const LEGACY_KEYS = ['salvonet.game'];

/** Bumped whenever the shape below changes, so stale saves are dropped. */
export const SNAPSHOT_VERSION = 1;

export interface BoardSnapshot {
	ships: FleetShip[];
	marks: (Mark | null)[];
}

export interface Snapshot {
	version: number;
	edition: Edition;
	rules: RuleSet;
	difficulty: 1 | 2 | 3;
	phase: 'deploy' | 'battle' | 'result';
	turn: Side;
	winner: Side | null;
	cursor: Coord;
	pending: Coord[];
	playerBoard: BoardSnapshot;
	cpuBoard: BoardSnapshot;
	playerFlight: Aircraft[];
	cpuFlight: Aircraft[];
	playerArsenal: Arsenal;
	cpuArsenal: Arsenal;
	log: { id: number; side: 'player' | 'cpu' | 'system'; text: string }[];
}

export function boardSnapshot(board: Board): BoardSnapshot {
	return {
		ships: board.ships.map((ship) => ({ ...ship, bow: { ...ship.bow }, hits: [...ship.hits] })),
		marks: board.marks.map((mark) => (mark ? { ...mark } : null))
	};
}

export function restoreBoard(size: Board['size'], snapshot: BoardSnapshot): Board {
	return {
		size,
		ships: snapshot.ships.map((ship) => ({ ...ship, bow: { ...ship.bow }, hits: [...ship.hits] })),
		marks: snapshot.marks.map((mark) => (mark ? { ...mark } : null))
	};
}

const KEY_ORDER = [KEY, ...LEGACY_KEYS];

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>;

function storage(): Storage | null {
	try {
		return globalThis.localStorage ?? null;
	} catch {
		// Blocked site data throws on access rather than returning undefined.
		return null;
	}
}

export function writeSnapshot(snapshot: Snapshot, store: Storage | null = storage()): boolean {
	if (!store) return false;
	try {
		store.setItem(KEY, JSON.stringify(snapshot));
		return true;
	} catch {
		// A full quota is not worth interrupting a game over.
		return false;
	}
}

export function readSnapshot(store: Storage | null = storage()): Snapshot | null {
	if (!store) return null;
	try {
		const raw = KEY_ORDER.map((key) => store.getItem(key)).find(Boolean);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as Snapshot;
		// A save from an older shape would restore into nonsense, so drop it.
		if (parsed?.version !== SNAPSHOT_VERSION) return null;
		if (!parsed.playerBoard?.ships?.length || !parsed.cpuBoard?.ships?.length) return null;
		return parsed;
	} catch {
		return null;
	}
}

export function clearSnapshot(store: Storage | null = storage()): void {
	try {
		for (const key of KEY_ORDER) store?.removeItem(key);
	} catch {
		// Nothing to do: the save is unreachable either way.
	}
}
