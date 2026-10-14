<script lang="ts">
	import {
		type GameType,
		type HouseRules,
		type Weapons
	} from '$lib/engine/ruleset';
	import type { Edition } from '$lib/engine/edition';
	import Panel from './Panel.svelte';
	import { i18n } from '$lib/i18n/index.svelte';

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

	const t = $derived(i18n.t.rules);
	const keys: (keyof HouseRules)[] = ['bonusTurn', 'noAdjacency', 'salvo', 'sunkSilence', 'mobileFleet'];
	const types: GameType[] = ['CLASSIC', 'MULTI_ATTACK', 'SALVO'];
	const weaponModes: Weapons[] = ['BASIC', 'ADVANCED'];

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

<Panel title={edition === 'DELUXE' ? t.missionTitle : t.houseTitle}>
	{#if edition === 'DELUXE'}
		<fieldset disabled={locked}>
			<legend>{t.gameType}</legend>
			{#each types as type (type)}
				<label class="radio">
					<input
						type="radio"
						name="gameType"
						value={type}
						checked={gameType === type}
						onchange={() => onGameType(type)}
					/>
					<span class="name">{t.gameTypes[type]}</span>
				</label>
			{/each}
		</fieldset>

		<fieldset disabled={locked}>
			<legend>{t.weapons}</legend>
			{#each weaponModes as mode (mode)}
				<label class="radio">
					<input
						type="radio"
						name="weapons"
						value={mode}
						checked={weapons === mode}
						onchange={() => onWeapons(mode)}
					/>
					<span class="name">{t.weaponModes[mode]}</span>
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
						<span class="name">{t.houseNames[key]}</span>
					</label>
					<span class="blurb">{t.houseBlurbs[key]}</span>
				</li>
			{/if}
		{/each}
	</ul>
	{#if locked}
		<p class="locked">{t.locked}</p>
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
		font-size: 0.75rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--text-dim);
	}

	.radio {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.75rem;
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
		font-size: 0.75rem;
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
		font-size: 0.75rem;
		color: var(--text-dim);
	}

	.locked {
		margin: 0.5rem 0 0;
		font-size: 0.75rem;
		color: var(--text-dim);
	}
</style>
