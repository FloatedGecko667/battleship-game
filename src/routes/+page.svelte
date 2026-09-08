<script lang="ts">
	import { Game } from '$lib/state/game.svelte';
	import { DIFFICULTY_NAME, type Difficulty } from '$lib/engine/ai';
	import Grid from '$lib/ui/Grid.svelte';
	import Panel from '$lib/ui/Panel.svelte';
	import HullCodes from '$lib/ui/HullCodes.svelte';
	import Legend from '$lib/ui/Legend.svelte';
	import LogPanel from '$lib/ui/LogPanel.svelte';
	import FleetStatus from '$lib/ui/FleetStatus.svelte';
	import RulesPanel from '$lib/ui/RulesPanel.svelte';
	import WeaponBar from '$lib/ui/WeaponBar.svelte';
	import StatusLamps from '$lib/ui/StatusLamps.svelte';
	import type { Coord } from '$lib/engine/types';
	import { phoneticLabel, type Edition } from '$lib/engine/edition';

	const game = new Game();

	function onKey(event: KeyboardEvent) {
		game.unlockAudio();

		if (event.key === 'm' || event.key === 'M') {
			game.toggleMute();
			event.preventDefault();
			return;
		}

		const step: Record<string, Coord> = {
			ArrowUp: { row: -1, col: 0 },
			k: { row: -1, col: 0 },
			ArrowDown: { row: 1, col: 0 },
			j: { row: 1, col: 0 },
			ArrowLeft: { row: 0, col: -1 },
			h: { row: 0, col: -1 },
			ArrowRight: { row: 0, col: 1 },
			l: { row: 0, col: 1 }
		};

		if (game.phase === 'deploy') {
			if (event.key === 'r' || event.key === 'R') {
				if (event.shiftKey) game.shuffleFleet();
				else game.rotateSelected();
				event.preventDefault();
				return;
			}
			if (event.key === 'Tab') {
				game.selectNext(event.shiftKey ? -1 : 1);
				event.preventDefault();
				return;
			}
			if (event.key === 'Enter') {
				game.startBattle();
				event.preventDefault();
				return;
			}
			const delta = step[event.key];
			if (delta) {
				game.nudgeSelected(delta);
				event.preventDefault();
			}
			return;
		}

		if (game.phase === 'battle') {
			if (event.key === 'p' || event.key === 'P') {
				game.toggleOrientation();
				event.preventDefault();
				return;
			}
			const slot = Number(event.key);
			if (slot >= 1 && slot <= game.weaponsOnOffer.length) {
				game.arm(game.weaponsOnOffer[slot - 1].id);
				event.preventDefault();
				return;
			}
			if (event.key === 'Escape') {
				game.arm(null);
				event.preventDefault();
				return;
			}
			const delta = step[event.key];
			if (delta) {
				game.cursor = {
					row: Math.min(game.size.rows - 1, Math.max(0, game.cursor.row + delta.row)),
					col: Math.min(game.size.cols - 1, Math.max(0, game.cursor.col + delta.col))
				};
				game.cursorBlip();
				event.preventDefault();
				return;
			}
			if (event.key === 'Enter' || event.key === ' ') {
				game.playerFire(game.cursor);
				event.preventDefault();
			}
		}
	}
</script>

<svelte:window onkeydown={onKey} onpointerdown={() => game.unlockAudio()} />

<svelte:head>
	<title>SALVO//NET</title>
	<meta name="description" content="An offline terminal battleship game." />
</svelte:head>

<main>
	<header>
		<h1>SALVO<span class="slash">//</span>NET</h1>
		<div class="chips">
			<label class="chip select">
				<select
					bind:value={game.edition}
					aria-label="Edition"
					disabled={game.phase !== 'deploy'}
					onchange={(e) => game.reset(e.currentTarget.value as Edition)}
				>
					<option value="CLASSIC">CLASSIC</option>
					<option value="DELUXE">DELUXE</option>
				</select>
			</label>
			<span class="chip">{game.size.cols}×{game.size.rows}</span>
			<label class="chip select">
				CPU
				<select bind:value={game.difficulty} aria-label="CPU difficulty">
					{#each [1, 2, 3] as const as level (level)}
						<option value={level}>{DIFFICULTY_NAME[level]}</option>
					{/each}
				</select>
			</label>
			<button
				class="chip toggle"
				type="button"
				aria-pressed={game.muted}
				onclick={() => game.toggleMute()}
			>{game.muted ? 'MUTED' : 'SOUND'}</button>
			<StatusLamps lamp={game.lamp} />
		</div>
	</header>

	{#if game.phase === 'deploy'}
		<p class="hint">
			Deploying — <kbd>Tab</kbd> selects a ship, <kbd>R</kbd> rotates,
			<kbd>Shift</kbd>+<kbd>R</kbd> reshuffles, arrows move, <kbd>Enter</kbd> commits.
			Selected: <strong>{game.playerFleet[game.selected]?.class}</strong>
		</p>
	{:else if game.phase === 'battle'}
		<p class="hint">
			{game.turn === 'player' ? 'Awaiting orders.' : 'Enemy is firing…'}
			{#if game.allowance > 1}
				Salvo: call {game.allowance} targets ({game.pending.length} called).
			{/if}
			Reticle <strong>{phoneticLabel(game.cursor.row, game.cursor.col)}</strong>.
			{#if game.armed}
				Aiming <strong>{game.armed}</strong> — <kbd>Esc</kbd> stands down.
			{:else if game.weaponsOnOffer.length}
				<kbd>1</kbd>–<kbd>{game.weaponsOnOffer.length}</kbd> arms a weapon.
			{/if}
			Arrows move it, <kbd>Enter</kbd> fires, <kbd>M</kbd> mutes.
		</p>
	{:else}
		<p class="hint result">
			{game.winner === 'player' ? 'Enemy fleet destroyed.' : 'Our fleet is lost.'}
			<button type="button" onclick={() => game.reset()}>New game</button>
		</p>
	{/if}

	<div class="boards">
		<Grid
			board={game.cpuBoard}
			tone="enemy"
			revealShips={false}
			label="Enemy waters"
			cursor={game.phase === 'battle' ? game.cursor : null}
			pending={game.pending}
			aim={game.armed === 'ANTI_AIR' ? [] : game.aimPreview}
			aircraft={game.playerFlight.filter((p) => p.alive && p.at).map((p) => p.at!)}
			onFire={game.phase === 'battle' && game.turn === 'player'
				? (c) => game.playerFire(c)
				: undefined}
			onHover={(c) => {
				if (game.phase === 'battle') game.cursor = c;
			}}
		/>
		<Grid
			board={game.playerBoard}
			tone="ally"
			revealShips={true}
			label="Your fleet"
			highlight={game.phase === 'deploy' ? game.playerFleet[game.selected]?.class : null}
			aircraft={game.playerFlight.filter((p) => p.alive && !p.at).map((p) => p.home)}
			aim={game.armed === 'ANTI_AIR' ? game.aimPreview : []}
			onFire={game.armed === 'ANTI_AIR' && game.turn === 'player'
				? (c) => game.fireOwnWaters(c)
				: undefined}
			onHover={(c) => {
				if (game.armed === 'ANTI_AIR') game.cursor = c;
			}}
		/>
	</div>

	<div class="panels">
		<FleetStatus board={game.cpuBoard} title="Enemy fleet" tone="enemy" />
		<FleetStatus board={game.playerBoard} title="Own fleet" tone="ally" />
		<HullCodes board={game.playerBoard} />
		<WeaponBar
			weapons={game.weaponsOnOffer}
			armed={game.armed}
			orientation={game.orientation}
			rounds={(id) => game.roundsFor(id)}
			onArm={(id) => game.arm(id)}
			onOrientation={() => game.toggleOrientation()}
			flight={game.flightReady}
			activePlane={game.activePlane}
			onSelectPlane={(i) => game.selectPlane(i)}
		/>
		<RulesPanel
			edition={game.edition}
			gameType={game.rules.gameType}
			house={game.rules.house}
			locked={game.phase !== 'deploy'}
			onToggle={(key, value) => game.setHouseRule(key, value)}
			onGameType={(type) => game.setGameType(type)}
			weapons={game.rules.weapons}
			onWeapons={(w) => game.setWeapons(w)}
		/>
		<Legend />
		<LogPanel lines={game.log} />
	</div>
</main>

<style>
	main {
		max-width: 1400px;
		margin: 0 auto;
		padding: 1.25rem 1rem 3rem;
	}

	header {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.75rem 1.25rem;
		border-bottom: 1px solid var(--rule-dim);
		padding-bottom: 0.6rem;
		margin-bottom: 0.9rem;
	}

	h1 {
		margin: 0;
		font-size: 1.05rem;
		letter-spacing: 0.28em;
		color: var(--ally);
		text-shadow: 0 0 6px var(--ally-glow), 0 0 18px var(--ally-glow);
	}

	.slash {
		color: var(--enemy);
		text-shadow: 0 0 6px var(--enemy-glow);
	}

	.chips {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-left: auto;
	}

	.chip {
		border: 1px solid var(--rule-faint);
		padding: 0.1rem 0.45rem;
		font-size: 0.62rem;
		letter-spacing: 0.14em;
		color: var(--text-dim);
	}

	.hint {
		margin: 0 0 0.9rem;
		font-size: 0.72rem;
		color: var(--text-dim);
	}

	.hint.result {
		color: var(--text);
	}

	kbd {
		border: 1px solid var(--rule-faint);
		padding: 0 0.25rem;
		font: inherit;
		font-size: 0.68rem;
		color: var(--text);
	}

	.chip.select {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
	}

	.chip.select select {
		background: transparent;
		border: 0;
		color: var(--ally);
		font: inherit;
		font-size: 0.62rem;
		letter-spacing: 0.14em;
		cursor: pointer;
	}

	.chip.select option {
		background: var(--bg-panel);
		color: var(--text);
	}

	.chip.toggle {
		background: transparent;
		cursor: pointer;
		font-family: inherit;
	}

	.chip.toggle[aria-pressed='true'] {
		color: var(--enemy);
		border-color: var(--enemy-dim);
	}

	button {
		margin-left: 0.75rem;
		border: 1px solid var(--ally-dim);
		background: transparent;
		color: var(--ally);
		font: inherit;
		font-size: 0.7rem;
		letter-spacing: 0.12em;
		padding: 0.2rem 0.6rem;
		cursor: pointer;
	}

	.boards {
		display: flex;
		flex-wrap: wrap;
		gap: 1.75rem;
		margin-bottom: 1.5rem;
	}

	.panels {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 1.1rem 1rem;
		align-items: start;
	}
</style>
