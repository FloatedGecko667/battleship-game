import type { Edition } from './edition';

/** The three game types the tie-in unit offers. DELUXE only. */
export type GameType = 'CLASSIC' | 'MULTI_ATTACK' | 'SALVO';

/** Unofficial toggles, offered on the CLASSIC edition. */
export interface HouseRules {
	/** A hit earns another shot. */
	bonusTurn: boolean;
	/** Ships may not touch, not even at a corner. */
	noAdjacency: boolean;
	/** Fire once per surviving ship. */
	salvo: boolean;
	/** Sinking a ship is not announced. */
	sunkSilence: boolean;
}

export const NO_HOUSE_RULES: HouseRules = {
	bonusTurn: false,
	noAdjacency: false,
	salvo: false,
	sunkSilence: false
};

export interface RuleSet {
	edition: Edition;
	/** Ignored on CLASSIC, which uses the house toggles instead. */
	gameType: GameType;
	house: HouseRules;
}

export const DEFAULT_RULES: RuleSet = {
	edition: 'CLASSIC',
	gameType: 'CLASSIC',
	house: NO_HOUSE_RULES
};

/**
 * What the engine actually acts on, after folding the edition, the official
 * game type and the house toggles together.
 */
export interface EffectiveRules {
	/** Shots per turn equal the shooter's surviving ships. */
	salvo: boolean;
	/** Landing a hit grants another turn. */
	extraTurnOnHit: boolean;
	/** A sonar contact also grants another turn (MULTI-ATTACK only). */
	extraTurnOnScan: boolean;
	noAdjacency: boolean;
	/** Suppresses the sunk announcement, so the shooter is never told. */
	sunkSilence: boolean;
}

/**
 * SUNK SILENCE contradicts the rulebook, which names the ship on every
 * sinking, so it is dropped on DELUXE rather than silently overriding the
 * official behaviour.
 */
export function effectiveRules(rules: RuleSet): EffectiveRules {
	if (rules.edition === 'DELUXE') {
		return {
			salvo: rules.gameType === 'SALVO',
			extraTurnOnHit: rules.gameType === 'MULTI_ATTACK',
			extraTurnOnScan: rules.gameType === 'MULTI_ATTACK',
			noAdjacency: rules.house.noAdjacency,
			sunkSilence: false
		};
	}

	return {
		salvo: rules.house.salvo,
		extraTurnOnHit: rules.house.bonusTurn,
		extraTurnOnScan: false,
		noAdjacency: rules.house.noAdjacency,
		sunkSilence: rules.house.sunkSilence
	};
}

export const GAME_TYPE_NAME: Record<GameType, string> = {
	CLASSIC: 'Classic',
	MULTI_ATTACK: 'Multi-Attack',
	SALVO: 'Salvo'
};

export const HOUSE_RULE_NAME: Record<keyof HouseRules, string> = {
	bonusTurn: 'Bonus turn',
	noAdjacency: 'No adjacency',
	salvo: 'Salvo',
	sunkSilence: 'Sunk silence'
};

export const HOUSE_RULE_BLURB: Record<keyof HouseRules, string> = {
	bonusTurn: 'A hit earns another shot.',
	noAdjacency: 'Ships may not touch, not even diagonally.',
	salvo: 'Fire once per surviving ship.',
	sunkSilence: 'Sinkings are never announced.'
};
