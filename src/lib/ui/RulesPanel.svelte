<script lang="ts">
	import {
		GAME_TYPE_NAME,
		HOUSE_RULE_BLURB,
		HOUSE_RULE_NAME,
		WEAPONS_NAME,
		type GameType,
		type HouseRules,
		type Weapons
	} from '$lib/engine/ruleset';
	import type { Edition } from '$lib/engine/edition';
	import Panel from './Panel.svelte';

	interface Props {
		edition: Edition;
		gameType: GameType;
		house: HouseRules;
		/** Rules may only change before the first shot. */
		locked: boolean;
		onToggle: (key: keyof HouseRules, value: boolean) => void;
		onGameType: (gameType: GameType) => void;
		weapons: Weapons;
		onWeapons: (weapons: Weapons) => void;
	}

	let { edition, gameType, house, locked, onToggle, onGameType, weapons, onWeapons }: Props =
		$props();

	const keys = Object.keys(HOUSE_RULE_NAME) as (keyof HouseRules)[];
	const types = Object.keys(GAME_TYPE_NAME) as GameType[];
	const weaponModes = Object.keys(WEAPONS_NAME) as Weapons[];

	/**
	 * On DELUXE the official game type drives salvo and the extra turn, and the
	 * rulebook always names a sunk ship - so those toggles have nothing to say.
	 */
	const overridden = $derived<Record<string, boolean>>(
		edition === 'DELUXE'
			? { salvo: true, bonusTurn: true, sunkSilence: true, noAdjacency: false }
			: {}
	);
</script>

<Panel title={edition === 'DELUXE' ? 'Mission' : 'House Rules'}>
	{#if edition === 'DELUXE'}
		<fieldset disabled={locked}>
			<legend>Game type</legend>
			{#each types as type (type)}
				<label class="radio">
					<input
						type="radio"
						name="gameType"
						value={type}
						checked={gameType === type}
						onchange={() => onGameType(type)}
					/>
					<span class="name">{GAME_TYPE_NAME[type]}</span>
				</label>
			{/each}
		</fieldset>

		<fieldset disabled={locked}>
			<legend>Weapons</legend>
			{#each weaponModes as mode (mode)}
				<label class="radio">
					<input
						type="radio"
						name="weapons"
						value={mode}
						checked={weapons === mode}
						onchange={() => onWeapons(mode)}
					/>
					<span class="name">{WEAPONS_NAME[mode]}</span>
				</label>
			{/each}
		</fieldset>
	{/if}

	<ul>
		{#each keys as key (key)}
			{#if !overridden[key]}
				<li>
					<label>
						<input
							type="checkbox"
							checked={house[key]}
							disabled={locked}
							onchange={(e) => onToggle(key, e.currentTarget.checked)}
						/>
						<span class="name">{HOUSE_RULE_NAME[key]}</span>
					</label>
					<span class="blurb">{HOUSE_RULE_BLURB[key]}</span>
				</li>
			{/if}
		{/each}
	</ul>
	{#if locked}
		<p class="locked">Locked once the battle starts.</p>
	{/if}
</Panel>

<style>
	fieldset {
		border: 0;
		border-bottom: 1px solid var(--rule-faint);
		margin: 0 0 0.5rem;
		padding: 0 0 0.5rem;
	}

	legend {
		padding: 0;
		font-size: 0.62rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--text-dim);
	}

	.radio {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.72rem;
		cursor: pointer;
	}

	.radio input {
		accent-color: var(--ally);
	}

	ul {
		display: grid;
		gap: 0.35rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	label {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		cursor: pointer;
		font-size: 0.72rem;
	}

	input:disabled + .name {
		color: var(--text-dim);
	}

	input {
		accent-color: var(--ally);
		cursor: pointer;
	}

	.name {
		letter-spacing: 0.06em;
	}

	.blurb {
		display: block;
		padding-left: 1.35rem;
		font-size: 0.64rem;
		color: var(--text-dim);
	}

	.locked {
		margin: 0.5rem 0 0;
		font-size: 0.64rem;
		color: var(--text-dim);
	}
</style>
