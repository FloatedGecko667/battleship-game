import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import WeaponBar from './WeaponBar.svelte';
import { WEAPONS } from '$lib/engine/weapons/index';
import { i18n } from '$lib/i18n/index.svelte';

afterEach(() => i18n.set('en'));

const base = {
	weapons: [],
	armed: null,
	orientation: 'H' as const,
	rounds: () => 1,
	onArm: () => {},
	onOrientation: () => {},
	flight: [],
	activePlane: 0,
	onSelectPlane: () => {},
	reason: null,
	inBattle: true
};

describe('WeaponBar', () => {
	it('tells CLASSIC players where the special weapons are', async () => {
		const screen = await render(WeaponBar, { ...base, reason: 'edition' });
		await expect.element(screen.getByText('Set Edition to DELUXE')).toBeVisible();
	});

	it('tells BASIC players which setting hides them', async () => {
		const screen = await render(WeaponBar, { ...base, reason: 'basic' });
		await expect.element(screen.getByText('Choose Advanced')).toBeVisible();
	});

	it('says so when every armed ship has been sunk', async () => {
		const screen = await render(WeaponBar, { ...base, reason: 'ships' });
		await expect.element(screen.getByText(/Nothing left to fire/)).toBeVisible();
	});

	it('gives each weapon a number key and arms it on click', async () => {
		const onArm = vi.fn();
		const screen = await render(WeaponBar, { ...base, weapons: WEAPONS.slice(0, 2), onArm });

		await expect.element(screen.getByRole('button', { name: /1\s+BB\s+Missile/ })).toBeVisible();
		await screen.getByRole('button', { name: /2\s+DD\s+Salvo missile/ }).click();
		expect(onArm).toHaveBeenCalledWith('DD_MISSILE');
	});

	it('cannot be armed before the battle starts', async () => {
		const screen = await render(WeaponBar, { ...base, weapons: WEAPONS.slice(0, 1), inBattle: false });
		await expect.element(screen.getByRole('button', { name: /Missile/ })).toBeDisabled();
		await expect.element(screen.getByText('Ready to arm once the battle starts.')).toBeVisible();
	});

	it('words the empty states in Japanese', async () => {
		i18n.set('ja');
		const screen = await render(WeaponBar, { ...base, reason: 'edition' });
		await expect.element(screen.getByText(/デラックス版のルール/)).toBeVisible();
	});

	it('translates weapon names and the aiming hint', async () => {
		i18n.set('ja');
		const screen = await render(WeaponBar, {
			...base,
			weapons: WEAPONS.slice(0, 1),
			armed: 'BB_MISSILE'
		});
		await expect.element(screen.getByText('ミサイル')).toBeVisible();
		await expect.element(screen.getByText(/攻撃の中心をクリック/)).toBeVisible();
	});
});
