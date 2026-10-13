import type { ShipClass } from '$lib/engine/types';
import type { WeaponId } from '$lib/engine/weapons/index';
import type { GameType, HouseRules, Weapons } from '$lib/engine/ruleset';
import type { Difficulty } from '$lib/engine/ai';

/** A sentence with one emphasised phrase: `pre <strong>em</strong> post`. */
export interface Rich {
	pre: string;
	em: string;
	post: string;
}

/** A key and what it does, rendered as `<kbd>key</kbd> action`. */
export type KeyHint = readonly [key: string, action: string];

/**
 * The source of truth for every player-facing string. Other locales are typed
 * against this shape, so a missing or mistyped entry fails the type check.
 */
export const en = {
	langName: 'English',
	speechLang: 'en-US',

	header: {
		edition: 'EDITION',
		editionAria: 'Edition',
		editionHintDeploy: 'CLASSIC is 10×10; DELUXE is 14×10 with the advanced weapons.',
		editionHintLocked:
			'The edition sets the board size, so it is fixed once a battle starts. Press NEW to change it.',
		cpu: 'CPU',
		cpuAria: 'CPU difficulty',
		sound: 'SOUND',
		muted: 'MUTED',
		newGame: 'NEW',
		lang: 'LANG',
		langAria: 'Language'
	},

	difficulty: { 1: 'ENSIGN', 2: 'CAPTAIN', 3: 'ADMIRAL' } as Record<Difficulty, string>,

	status: {
		resumed: 'Picked up where you left off.',
		deployLead: 'Deploying —',
		deployKeys: [
			['Tab', 'selects a ship'],
			['R', 'rotates'],
			['Shift+R', 'reshuffles'],
			['←↑↓→', 'move'],
			['Enter', 'commits']
		] as readonly KeyHint[],
		selected: 'Selected:',
		awaiting: 'Awaiting orders.',
		enemyFiring: 'Enemy is firing…',
		salvo: (allowance: number, called: number) =>
			`Salvo: call ${allowance} targets (${called} called).`,
		reticle: 'Reticle',
		aiming: 'Aiming',
		standDown: 'stands down.',
		armsWeapon: 'arms a weapon.',
		battleKeys: [
			['←↑↓→', 'move it'],
			['Enter', 'fires'],
			['M', 'mutes']
		] as readonly KeyHint[],
		won: 'Enemy fleet destroyed.',
		lost: 'Our fleet is lost.',
		playAgain: 'New game'
	},

	boards: {
		tabsAria: 'Boards',
		enemy: 'Enemy waters',
		own: 'Your fleet',
		fireHere: '◀ fire here'
	},

	ships: {
		CV: 'Aircraft Carrier',
		BB: 'Battleship',
		CA: 'Cruiser',
		SS: 'Submarine',
		DD2: 'Destroyer',
		DD: 'Destroyer',
		DE: 'Destroyer Escort',
		PB: 'Patrol Boat'
	} as Record<ShipClass, string>,

	fleet: {
		enemyTitle: 'Enemy fleet',
		ownTitle: 'Own fleet',
		afloat: 'afloat',
		cellsHit: (hits: number, total: number) => `${hits}/${total} hull cells hit`
	},

	hullCodes: {
		title: 'Hull Codes',
		code: 'Code',
		ship: 'Ship',
		length: 'Len',
		status: 'Status',
		sunk: 'SUNK'
	},

	helm: {
		title: 'Helm',
		none: 'Nothing can get under way. Damaged ships hold their position.',
		astern: '◀ Astern',
		ahead: 'Ahead ▶',
		note: "Moving is the turn's action — you do not also fire.",
		fuel: (n: number) => `${n} left`,
		fuelAria: (n: number) => `${n} moves of fuel left`
	},

	weapons: {
		title: 'Weapons',
		names: {
			BB_MISSILE: 'Missile',
			DD_MISSILE: 'Salvo missile',
			DE_HOMING: 'Homing missile',
			DE_SONAR: 'Sonar',
			CV_AIRCRAFT: 'Aircraft',
			ANTI_AIR: 'Anti-aircraft'
		} as Record<WeaponId, string>,
		blurbs: {
			BB_MISSILE: 'Blasts a 3×3 area around the centre you call.',
			DD_MISSILE: 'Strikes three cells in a row or column.',
			DE_HOMING: 'Runs from the grid edge until it meets a ship.',
			DE_SONAR: 'Reports whether a 3×3 area holds anything. No position, no count.',
			CV_AIRCRAFT: 'Sends a plane over five cells. Each plane strikes once, then only searches.',
			ANTI_AIR: 'Fires into your own waters at an enemy plane you think is overhead.'
		} as Record<WeaponId, string>,
		noneEdition: {
			pre: 'Special weapons belong to the Deluxe game. ',
			em: 'Set Edition to DELUXE',
			post: ' at the top of the page.'
		} as Rich,
		noneBasic: {
			pre: 'This mission is running Basic weapons. ',
			em: 'Choose Advanced',
			post: ' under Weapons in the Mission panel, before the battle starts.'
		} as Rich,
		noneShips: 'Every ship that carried a special weapon has been sunk. Nothing left to fire.',
		axis: (horizontal: boolean) =>
			`Axis: ${horizontal ? 'Horizontal' : 'Vertical'} — press P to switch`,
		pattern: (plus: boolean) => `Pattern: ${plus ? '+' : '✕'} — press P to switch`,
		aloft: 'aloft',
		onDeck: 'on deck',
		strike: 'strike',
		search: 'search',
		notYet: 'Ready to arm once the battle starts.',
		aimOwn: {
			pre: 'Click ',
			em: 'your own board',
			post: ' where you think an enemy plane is overhead.'
		} as Rich,
		aimEdge: {
			pre: 'Click a cell on the ',
			em: 'edge',
			post: ' of the enemy board to launch from.'
		} as Rich,
		aimSweep: { pre: 'Click the ', em: 'enemy board', post: ' where the plane should search.' } as Rich,
		aimCentre: { pre: 'Click the ', em: 'enemy board', post: ' at the centre of the strike.' } as Rich,
		escStandsDown: 'Esc stands down.',
		pickPre: 'Press',
		pickPost: ', or pick one above.'
	},

	rules: {
		missionTitle: 'Mission',
		houseTitle: 'House Rules',
		gameType: 'Game type',
		weapons: 'Weapons',
		gameTypes: {
			CLASSIC: 'Classic',
			MULTI_ATTACK: 'Multi-Attack',
			SALVO: 'Salvo'
		} as Record<GameType, string>,
		weaponModes: { BASIC: 'Basic', ADVANCED: 'Advanced' } as Record<Weapons, string>,
		houseNames: {
			bonusTurn: 'Bonus turn',
			noAdjacency: 'No adjacency',
			salvo: 'Salvo',
			sunkSilence: 'Sunk silence',
			mobileFleet: 'Mobile fleet'
		} as Record<keyof HouseRules, string>,
		houseBlurbs: {
			bonusTurn: 'A hit earns another shot.',
			noAdjacency: 'Ships may not touch, not even diagonally.',
			salvo: 'Fire once per surviving ship.',
			sunkSilence: 'Sinkings are never announced.',
			mobileFleet:
				'Once a turn, move one undamaged ship a cell along its axis. Each ship has 3 moves a game, and a miss goes stale.'
		} as Record<keyof HouseRules, string>,
		locked: 'Locked once the battle starts.'
	},

	formations: {
		title: 'Formations',
		code: 'Code',
		deploy: 'Deploy',
		listAria: 'Rulebook formations'
	},

	legend: {
		title: 'Legend',
		miss: 'Miss',
		hit: 'Hit',
		scan: 'Sonar sweep centre',
		ownHull: 'Your hull',
		enemyHull: 'Enemy hull (revealed on sinking)',
		aircraft: 'Aircraft — on deck, or hovering once launched'
	},

	lamps: { hit: 'HIT', miss: 'MISS', idle: 'awaiting fire', hitSr: 'hit', missSr: 'miss' },

	log: {
		title: 'Log',
		shot: (ours: boolean, at: string, hit: boolean) =>
			`${ours ? 'Salvo' : 'Incoming'} ${at} — ${hit ? 'HIT' : 'miss'}`,
		sunk: (ours: boolean, name: string, code: string) =>
			`${ours ? 'Our' : 'Enemy'} ${name} is down (${code})`,
		scan: (at: string, detected: boolean) =>
			`Sonar ${at} — ${detected ? 'contact' : 'clear water'}`,
		repeat: (at: string) => `${at} already resolved`,
		extraTurn: 'Extra turn granted',
		deploy: 'Deploy your fleet. R rotates, arrows move, Enter confirms.',
		onStation: 'Fleet on station. Awaiting orders.',
		underWay: (name: string, ahead: boolean) =>
			`${name} under way, one cell ${ahead ? 'ahead' : 'astern'}`,
		cpuUnderWay: 'A ship is under way',
		antiAir: (at: string, downed: boolean) =>
			`Anti-aircraft fire at ${at} — ${downed ? 'enemy aircraft down' : 'nothing there'}`,
		notEdge: 'That launch point is not on the grid edge.',
		noAircraft: 'No aircraft left to fly.',
		deckLoss: (count: number) => `${count} aircraft destroyed on deck`
	}
};

export type Messages = typeof en;
