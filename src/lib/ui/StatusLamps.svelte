<script lang="ts">
	/** Stands in for the unit's hit/miss lamps. Red for a hit, amber for a miss. */
	interface Props {
		lamp: 'none' | 'hit' | 'miss';
	}

	let { lamp }: Props = $props();
</script>

<div class="lamps" role="status" aria-live="polite">
	<span class="lamp hit" class:on={lamp === 'hit'} aria-hidden="true"></span>
	<span class="label">HIT</span>
	<span class="lamp miss" class:on={lamp === 'miss'} aria-hidden="true"></span>
	<span class="label">MISS</span>
	<span class="sr">{lamp === 'none' ? 'awaiting fire' : lamp}</span>
</div>

<style>
	.lamps {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.62rem;
		letter-spacing: 0.16em;
		color: var(--text-dim);
	}

	.lamp {
		width: 0.6rem;
		height: 0.6rem;
		border-radius: 50%;
		border: 1px solid var(--rule-faint);
		background: #0b0b0b;
		transition: background 120ms linear, box-shadow 120ms linear;
	}

	.lamp.hit.on {
		background: var(--enemy);
		box-shadow: 0 0 6px var(--enemy-glow), 0 0 14px var(--enemy-glow);
	}

	.lamp.miss.on {
		background: var(--lamp-miss);
		box-shadow: 0 0 6px rgba(255, 179, 0, 0.5), 0 0 14px rgba(255, 179, 0, 0.4);
	}

	.label {
		margin-right: 0.5rem;
	}

	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}
</style>
