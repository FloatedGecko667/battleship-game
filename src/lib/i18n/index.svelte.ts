import { en, type Messages } from './en';
import { ja } from './ja';
import { coordLabel } from '$lib/engine/edition';
import { hullCode } from '$lib/engine/fleet';
import type { Coord, ShipClass, Side } from '$lib/engine/types';

export type Locale = 'en' | 'ja';

export const DICTIONARIES: Record<Locale, Messages> = { en, ja };
export const LOCALES = Object.keys(DICTIONARIES) as Locale[];

const KEY = 'firingsolution.locale';

type Store = Pick<Storage, 'getItem' | 'setItem'>;

function storage(): Store | null {
	try {
		return globalThis.localStorage ?? null;
	} catch {
		// Blocked site data throws on access rather than returning undefined.
		return null;
	}
}

function isLocale(value: unknown): value is Locale {
	return typeof value === 'string' && value in DICTIONARIES;
}

/** A saved choice wins; otherwise the first browser language we speak; otherwise English. */
export function detectLocale(
	store: Store | null = storage(),
	languages: readonly string[] = globalThis.navigator?.languages ?? []
): Locale {
	try {
		const saved = store?.getItem(KEY);
		if (isLocale(saved)) return saved;
	} catch {
		// Fall through to the browser languages.
	}
	for (const language of languages) {
		const base = language.toLowerCase().split('-')[0];
		if (isLocale(base)) return base;
	}
	return 'en';
}

class I18n {
	locale = $state<Locale>(detectLocale());

	get t(): Messages {
		return DICTIONARIES[this.locale];
	}

	set(locale: Locale, store: Store | null = storage()) {
		this.locale = locale;
		try {
			store?.setItem(KEY, locale);
		} catch {
			// The choice still holds for this visit.
		}
		if (globalThis.document) document.documentElement.lang = locale;
	}
}

export const i18n = new I18n();

/**
 * A log entry as data rather than text, so the log can be re-read in whichever
 * language is current - including entries restored from a save.
 */
export type LogMsg =
	| { k: 'shot'; side: Side; at: Coord; hit: boolean }
	| { k: 'sunk'; side: Side; cls: ShipClass }
	| { k: 'scan'; at: Coord; detected: boolean }
	| { k: 'repeat'; at: Coord }
	| { k: 'extraTurn' }
	| { k: 'victory'; winner: Side }
	| { k: 'deploy' }
	| { k: 'onStation' }
	| { k: 'underWay'; cls: ShipClass; ahead: boolean }
	| { k: 'cpuUnderWay' }
	| { k: 'antiAir'; at: Coord; downed: boolean }
	| { k: 'notEdge' }
	| { k: 'noAircraft' }
	| { k: 'deckLoss'; count: number };

const label = (at: Coord) => coordLabel(at.row, at.col);

export function logText(t: Messages, msg: LogMsg): string {
	switch (msg.k) {
		case 'shot':
			return t.log.shot(msg.side === 'player', label(msg.at), msg.hit);
		case 'sunk':
			return t.log.sunk(msg.side === 'player', t.ships[msg.cls], hullCode(msg.cls));
		case 'scan':
			return t.log.scan(label(msg.at), msg.detected);
		case 'repeat':
			return t.log.repeat(label(msg.at));
		case 'extraTurn':
			return t.log.extraTurn;
		case 'victory':
			return msg.winner === 'player' ? t.status.won : t.status.lost;
		case 'deploy':
			return t.log.deploy;
		case 'onStation':
			return t.log.onStation;
		case 'underWay':
			return t.log.underWay(t.ships[msg.cls], msg.ahead);
		case 'cpuUnderWay':
			return t.log.cpuUnderWay;
		case 'antiAir':
			return t.log.antiAir(label(msg.at), msg.downed);
		case 'notEdge':
			return t.log.notEdge;
		case 'noAircraft':
			return t.log.noAircraft;
		case 'deckLoss':
			return t.log.deckLoss(msg.count);
	}
}
