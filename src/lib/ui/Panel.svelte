<script lang="ts">
	/** A framed TUI box with its title notched into the top rule. */
	interface Props {
		title: string;
		tone?: 'neutral' | 'ally' | 'enemy';
		children?: import('svelte').Snippet;
	}

	let { title, tone = 'neutral', children }: Props = $props();
</script>

<section class="panel" data-tone={tone}>
	<h2 class="title">{title}</h2>
	<div class="body">
		{@render children?.()}
	</div>
</section>

<style>
	.panel {
		position: relative;
		border: 1px solid var(--rule-dim);
		background: var(--bg-panel);
		padding: 0.9rem 0.75rem 0.75rem;
	}

	.panel[data-tone='ally'] {
		border-color: var(--ally-dim);
	}

	.panel[data-tone='enemy'] {
		border-color: var(--enemy-dim);
	}

	.title {
		position: absolute;
		top: 0;
		left: 0.75rem;
		transform: translateY(-50%);
		margin: 0;
		padding: 0 0.5rem;
		background: var(--bg-panel);
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--text-dim);
	}

	.panel[data-tone='ally'] .title {
		color: var(--ally);
	}

	.panel[data-tone='enemy'] .title {
		color: var(--enemy);
	}

	.body {
		font-size: 0.78rem;
	}
</style>
