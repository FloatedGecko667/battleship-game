import type { Coord, ShipClass, ShotResult, Side } from './types';
import { cellsOf } from './geometry';
import { cellIndex, isFleetDestroyed, isSunk, markAt, shipAt, type Board } from './board';

/**
 * Everything that happens in a turn is emitted here. Sound, the status lamps and
 * the battle log all read this one stream rather than re-deriving state.
 */
export type GameEvent =
	| { type: 'shot'; side: Side; coord: Coord; result: ShotResult }
	| { type: 'sunk'; side: Side; shipClass: ShipClass }
	| { type: 'scan'; side: Side; coord: Coord; detected: boolean }
	| { type: 'repeat'; side: Side; coord: Coord }
	| { type: 'extraTurn'; side: Side; reason: 'hit' | 'scan' }
	| { type: 'victory'; side: Side };

export interface ShotOutcome {
	result: ShotResult;
	/** Set only when this shot completed a ship. */
	sunk?: ShipClass;
	/** True when the cell had already been fired at, so nothing changed. */
	repeat: boolean;
}

/**
 * Fires at one cell of `target`. The defender never reveals which ship was hit;
 * the class comes back only when the shot sinks it (rulebook: "Sinking a ship").
 */
export function fireAt(target: Board, coord: Coord): ShotOutcome {
	const existing = markAt(target, coord);
	if (existing && existing.kind !== 'scan') {
		return { result: existing.kind === 'hit' ? 'hit' : 'miss', repeat: true };
	}

	const hit = shipAt(target, coord);
	if (!hit) {
		target.marks[cellIndex(coord, target.size)] = { kind: 'miss' };
		return { result: 'miss', repeat: false };
	}

	hit.ship.hits[hit.segment] = true;
	const sunk = isSunk(hit.ship);
	target.marks[cellIndex(coord, target.size)] = {
		kind: 'hit',
		...(sunk ? { revealedClass: hit.ship.class } : {})
	};

	// A sinking shot reveals the whole hull, so backfill the earlier hit marks.
	if (sunk) {
		for (const cell of cellsOf(hit.ship)) {
			const mark = target.marks[cellIndex(cell, target.size)];
			if (mark?.kind === 'hit') mark.revealedClass = hit.ship.class;
		}
	}

	return { result: 'hit', repeat: false, ...(sunk ? { sunk: hit.ship.class } : {}) };
}

/** Records a sonar sweep centre. Detection is binary: no count, no position. */
export function markScan(target: Board, coord: Coord): void {
	const index = cellIndex(coord, target.size);
	// Never paint over what a shot already established.
	if (target.marks[index] === null) target.marks[index] = { kind: 'scan' };
}

/** Turns one shot into the event stream, from `shooter`'s point of view. */
export function shotEvents(shooter: Side, coord: Coord, outcome: ShotOutcome): GameEvent[] {
	if (outcome.repeat) return [{ type: 'repeat', side: shooter, coord }];

	const events: GameEvent[] = [{ type: 'shot', side: shooter, coord, result: outcome.result }];
	if (outcome.sunk) {
		events.push({ type: 'sunk', side: other(shooter), shipClass: outcome.sunk });
	}
	return events;
}

export function other(side: Side): Side {
	return side === 'player' ? 'cpu' : 'player';
}

export function victoryEvent(shooter: Side, target: Board): GameEvent | null {
	return isFleetDestroyed(target) ? { type: 'victory', side: shooter } : null;
}
