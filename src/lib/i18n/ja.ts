import type { Messages } from './en';

export const ja: Messages = {
	langName: '日本語',
	speechLang: 'ja-JP',

	header: {
		edition: 'エディション',
		editionAria: 'エディション',
		editionHintDeploy: 'CLASSIC は 10×10。DELUXE は 14×10 で特殊兵器が使えます。',
		editionHintLocked:
			'エディションで盤面の大きさが決まるため、戦闘開始後は変更できません。変更するには「新規」を押してください。',
		cpu: 'CPU',
		cpuAria: 'CPU の強さ',
		sound: 'サウンド',
		muted: '消音中',
		newGame: '新規',
		lang: '言語',
		langAria: '表示言語'
	},

	difficulty: { 1: '少尉', 2: '艦長', 3: '提督' },

	status: {
		resumed: '中断した対局を再開しました。',
		deployLead: '配置中 —',
		deployKeys: [
			['Tab', '艦を選択'],
			['R', '回転'],
			['Shift+R', '再配置'],
			['←↑↓→', '移動'],
			['Enter', '確定']
		],
		selected: '選択中:',
		awaiting: '命令待機中。',
		enemyFiring: '敵が砲撃中…',
		salvo: (allowance, called) => `斉射: ${allowance} 箇所を指定（${called} 指定済み）。`,
		reticle: '照準',
		aiming: '照準中の兵器',
		standDown: 'で解除。',
		armsWeapon: 'で兵器を選択。',
		battleKeys: [
			['←↑↓→', '照準移動'],
			['Enter', '射撃'],
			['M', '消音']
		],
		won: '敵艦隊を撃滅した。',
		lost: '我が艦隊は全滅した。',
		playAgain: '新しい対局'
	},

	boards: {
		tabsAria: '盤面',
		enemy: '敵海域',
		own: '自艦隊',
		fireHere: '◀ ここを撃つ'
	},

	ships: {
		CV: '航空母艦',
		BB: '戦艦',
		CA: '巡洋艦',
		SS: '潜水艦',
		DD2: '駆逐艦',
		DD: '駆逐艦',
		DE: '護衛駆逐艦',
		PB: '哨戒艇'
	},

	fleet: {
		enemyTitle: '敵艦隊',
		ownTitle: '自艦隊',
		afloat: '隻 健在',
		cellsHit: (hits, total) => `船体 ${hits}/${total} マス被弾`
	},

	hullCodes: {
		title: '艦種コード',
		code: 'コード',
		ship: '艦種',
		length: '全長',
		status: '状態',
		sunk: '撃沈'
	},

	helm: {
		title: '操艦',
		none: '航行できる艦がありません。被弾した艦はその場に留まります。',
		astern: '◀ 後進',
		ahead: '前進 ▶',
		note: '航行するとそのターンは射撃できません。'
	},

	weapons: {
		title: '兵装',
		names: {
			BB_MISSILE: 'ミサイル',
			DD_MISSILE: '連装ミサイル',
			DE_HOMING: '追尾ミサイル',
			DE_SONAR: 'ソナー',
			CV_AIRCRAFT: '艦載機',
			ANTI_AIR: '対空射撃'
		},
		blurbs: {
			BB_MISSILE: '指定した中心の 3×3 マスを一斉に攻撃する。',
			DD_MISSILE: '縦または横に並んだ 3 マスを攻撃する。',
			DE_HOMING: '盤面の端から直進し、最初に当たった艦で止まる。',
			DE_SONAR: '3×3 マスに艦がいるかだけを報告する。位置と隻数は分からない。',
			CV_AIRCRAFT: '艦載機で 5 マスを偵察する。各機 1 回だけ攻撃でき、以後は偵察のみ。',
			ANTI_AIR: '敵機がいると思う自海域のマスを撃つ。'
		},
		noneEdition: {
			pre: '特殊兵器はデラックス版のルールです。',
			em: 'ページ上部のエディションを DELUXE に',
			post: '切り替えてください。'
		},
		noneBasic: {
			pre: 'この対局は基本兵装です。戦闘開始前にミッション欄の兵装で',
			em: '「高度」を選んで',
			post: 'ください。'
		},
		noneShips: '特殊兵器を積んだ艦はすべて撃沈されました。使える兵器はありません。',
		axis: (horizontal) => `方向: ${horizontal ? '横' : '縦'} — P で切替`,
		pattern: (plus) => `走査形: ${plus ? '+' : '✕'} — P で切替`,
		aloft: '飛行中',
		onDeck: '艦上',
		strike: '攻撃可',
		search: '偵察のみ',
		notYet: '戦闘が始まると選択できます。',
		aimOwn: { pre: '敵機がいると思う', em: '自艦隊の盤面', post: 'のマスをクリック。' },
		aimEdge: { pre: '敵盤面の', em: '端', post: 'のマスをクリックして発射位置を指定。' },
		aimSweep: { pre: '', em: '敵盤面', post: 'の偵察したい位置をクリック。' },
		aimCentre: { pre: '', em: '敵盤面', post: 'の攻撃の中心をクリック。' },
		escStandsDown: 'Esc で解除。',
		pickPre: 'キー',
		pickPost: '、または上の一覧から選択。'
	},

	rules: {
		missionTitle: 'ミッション',
		houseTitle: 'ハウスルール',
		gameType: 'ゲームタイプ',
		weapons: '兵装',
		gameTypes: {
			CLASSIC: 'クラシック',
			MULTI_ATTACK: 'マルチアタック',
			SALVO: 'サルボ'
		},
		weaponModes: { BASIC: '基本', ADVANCED: '高度' },
		houseNames: {
			bonusTurn: 'ボーナスターン',
			noAdjacency: '接触禁止',
			salvo: 'サルボ',
			sunkSilence: '撃沈非通知',
			mobileFleet: '機動艦隊'
		},
		houseBlurbs: {
			bonusTurn: '命中するともう一度撃てる。',
			noAdjacency: '艦同士を斜めも含めて隣接させない。',
			salvo: '残っている艦の数だけ撃てる。',
			sunkSilence: '撃沈しても知らされない。',
			mobileFleet:
				'毎ターン、無傷の艦を1隻だけ艦の向きに沿って1マス動かせる。古い外れは無効になる。'
		},
		locked: '戦闘開始後は変更できません。'
	},

	formations: {
		title: 'フォーメーション',
		code: 'コード',
		deploy: '配置',
		listAria: 'ルールブックのフォーメーション'
	},

	legend: {
		title: '凡例',
		miss: '外れ',
		hit: '命中',
		scan: 'ソナー探知の中心',
		ownHull: '自艦の船体',
		enemyHull: '敵艦の船体（撃沈時に判明）',
		aircraft: '艦載機 — 艦上、または発進後は上空'
	},

	lamps: { hit: '命中', miss: '外れ', idle: '射撃待ち', hitSr: '命中', missSr: '外れ' },

	log: {
		title: '戦闘ログ',
		shot: (ours, at, hit) => `${ours ? '砲撃' : '被弾警報'} ${at} — ${hit ? '命中' : '外れ'}`,
		sunk: (ours, name, code) => `${ours ? '我が' : '敵'}${name}（${code}）撃沈`,
		scan: (at, detected) => `ソナー ${at} — ${detected ? '反応あり' : '反応なし'}`,
		repeat: (at) => `${at} は解決済み`,
		extraTurn: '追加ターン獲得',
		deploy: '艦隊を配置せよ。R で回転、矢印で移動、Enter で確定。',
		onStation: '艦隊配置完了。命令を待つ。',
		underWay: (name, ahead) => `${name}、1マス${ahead ? '前進' : '後進'}`,
		cpuUnderWay: '敵艦が航行した',
		antiAir: (at, downed) => `対空射撃 ${at} — ${downed ? '敵機撃墜' : '敵影なし'}`,
		notEdge: 'その発射位置は盤面の端ではありません。',
		noAircraft: '飛べる艦載機が残っていません。',
		deckLoss: (count) => `艦上の艦載機 ${count} 機が撃破された`
	}
};
