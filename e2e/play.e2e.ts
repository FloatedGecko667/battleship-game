import { expect, test, type Page } from '@playwright/test';

/**
 * The checks the plan called for, against the real build. These cover the
 * things unit tests cannot: that the wiring in the page actually reaches the
 * engine, and that a game can be played through the interface.
 */

async function fresh(page: Page) {
	await page.goto('/');
	await page.evaluate(() => localStorage.clear());
	await page.reload();
	await expect(page.getByRole('heading', { name: /Firing Solution/ })).toBeVisible();
}

const enemyCells = (page: Page) => page.locator('.board').first().locator('.cell');
const ownCells = (page: Page) => page.locator('.board').nth(1).locator('.cell');
const logLines = (page: Page) => page.locator('.line');

async function setEdition(page: Page, edition: 'CLASSIC' | 'DELUXE') {
	await page.getByLabel('Edition').selectOption(edition);
}

async function commitFleet(page: Page) {
	await page.locator('body').press('Enter');
	await expect(page.locator('.hint')).toContainText('orders');
}

/**
 * Fires until one fleet is gone.
 *
 * Clicks land only on the player's turn - the CPU takes 420ms and anything
 * sent during it is ignored - so each shot waits for the turn to come back
 * rather than firing on a fixed cadence.
 */
async function playToFinish(page: Page) {
	const cells = enemyCells(page);
	const total = await cells.count();
	// The resume banner is a .hint too, so pick out the status line.
	const status = page.locator('.hint:not(.resumed)');

	for (let i = 0; i < total; i++) {
		// Wait for the turn to come back - or for the game to have been decided
		// by the shot the CPU just took, which can happen between iterations.
		await expect(status).toContainText(/Awaiting orders|fleet is lost|fleet destroyed/, {
			timeout: 15_000
		});
		if (await page.locator('.hint.result').count()) return;
		await cells.nth(i).click();
		await page.waitForTimeout(30);
	}
}

test('CLASSIC: deploy, fire with the keyboard only, and play to a decision', async ({ page }) => {
	test.setTimeout(180_000); // a full game is ~100 shots with a CPU pause each
	await fresh(page);
	await commitFleet(page);

	// Move the reticle and fire without ever using the mouse.
	await page.locator('body').press('ArrowDown');
	await page.locator('body').press('ArrowRight');
	await expect(page.locator('.hint')).toContainText('Bravo 2');
	await page.locator('body').press('Enter');
	await expect(logLines(page)).toContainText([/Salvo B2/]);

	// Then sweep the board until one fleet is gone. Firing in cell order will
	// usually lose to LEVEL 2, so what matters is that the game reaches an end.
	await playToFinish(page);
	await expect(page.locator('.hint.result')).toContainText(/fleet is lost|fleet destroyed/);
	await expect(page.getByRole('button', { name: 'New game' })).toBeVisible();
});

test('DELUXE advanced: the battleship missile resolves the nine cells it previews', async ({
	page
}) => {
	await fresh(page);
	await setEdition(page, 'DELUXE');
	await page.getByRole('radio', { name: 'Advanced' }).check();
	await commitFleet(page);

	await page.getByRole('button', { name: /Missile/ }).first().click();
	const target = enemyCells(page).nth(5 * 14 + 5);
	await target.hover();
	await expect(page.locator('.cell.aimed')).toHaveCount(9);

	await target.click();
	await expect(page.locator('.board').first().locator('.pin')).toHaveCount(9);
	// One round only, so the weapon leaves the list.
	await expect(page.getByRole('button', { name: /^BB/ })).toHaveCount(0);
});

test('DELUXE advanced: an aircraft sweeps five cells and then only searches', async ({ page }) => {
	await fresh(page);
	await setEdition(page, 'DELUXE');
	await page.getByRole('radio', { name: 'Advanced' }).check();
	await commitFleet(page);

	await page.getByRole('button', { name: /Aircraft/ }).click();
	const centre = enemyCells(page).nth(5 * 14 + 5);
	await centre.hover();
	await expect(page.locator('.cell.aimed')).toHaveCount(5);

	// The pattern toggle swaps between the plus and the X, still five cells.
	await page.locator('body').press('p');
	await centre.hover();
	await expect(page.locator('.cell.aimed')).toHaveCount(5);

	await centre.click();
	await expect(logLines(page)).toContainText([/Salvo|Sonar/]);
	// One plane has left the deck.
	await expect(page.locator('.board').nth(1).locator('.plane')).toHaveCount(1);
});

test('the A1 formation deploys exactly as the rulebook draws it', async ({ page }) => {
	await fresh(page);
	await setEdition(page, 'DELUXE');

	await page.getByPlaceholder('A1').fill('A1');
	await page.getByRole('button', { name: 'Deploy' }).click();

	// CV G7-G11, BB E10-E13, DD I2-I4, DE B4-B6, PB G14-H14, planes on G8/G10.
	const occupied = await ownCells(page).evaluateAll((cells) =>
		cells.map((c, i) => (c.querySelector('.hull') ? i : -1)).filter((i) => i >= 0)
	);
	const label = (i: number) => `${'ABCDEFGHIJ'[Math.floor(i / 14)]}${(i % 14) + 1}`;
	expect(occupied.map(label).sort()).toEqual(
		[
			'B4', 'B5', 'B6',
			'E10', 'E11', 'E12', 'E13',
			'G10', 'G11', 'G14', 'G7', 'G8', 'G9',
			'H14',
			'I2', 'I3', 'I4'
		].sort()
	);
	await expect(page.locator('.board').nth(1).locator('.plane')).toHaveCount(2);
});

test('a whole game is playable with the sound off', async ({ page }) => {
	test.setTimeout(180_000);
	await fresh(page);
	await page.getByRole('button', { name: /SOUND|MUTED/ }).click();
	await expect(page.getByRole('button', { name: 'MUTED' })).toBeVisible();

	await commitFleet(page);
	await playToFinish(page);
	await expect(page.locator('.hint.result')).toContainText(/fleet is lost|fleet destroyed/);
});

test('an interrupted game is picked up after a reload', async ({ page }) => {
	await fresh(page);
	await commitFleet(page);

	await enemyCells(page).nth(0).click();
	await page.waitForTimeout(700);
	const before = await logLines(page).allTextContents();

	await page.reload();
	await expect(page.locator('.hint.resumed')).toBeVisible();
	expect(await logLines(page).allTextContents()).toEqual(before);
});

test('the weapons panel says which setting is hiding the arsenal', async ({ page }) => {
	await fresh(page);
	const panel = page
		.locator('.panel')
		.filter({ has: page.locator('.title', { hasText: /^Weapons$/ }) });

	// CLASSIC has no special weapons at all.
	await expect(panel).toContainText('Set Edition to DELUXE');

	await setEdition(page, 'DELUXE');
	await expect(panel).toContainText('Choose Advanced');

	await page.getByRole('radio', { name: 'Advanced' }).check();
	// The number that arms each weapon is on its button.
	await expect(panel.getByRole('button', { name: /1\s+BB\s+Missile/ })).toBeVisible();
	await expect(panel).toContainText('once the battle starts');
});

test('an armed weapon points at the board it wants', async ({ page }) => {
	await fresh(page);
	await setEdition(page, 'DELUXE');
	await page.getByRole('radio', { name: 'Advanced' }).check();
	await commitFleet(page);

	const enemyLabel = page.locator('.label').filter({ hasText: 'Enemy waters' });
	const ownLabel = page.locator('.label').filter({ hasText: 'Your fleet' });

	await page.locator('body').press('1'); // the battleship missile
	await expect(enemyLabel).toContainText('fire here');
	await expect(ownLabel).not.toContainText('fire here');

	// Anti-aircraft fire is aimed at your own grid instead.
	await page.locator('body').press('5');
	await expect(ownLabel).toContainText('fire here');
	await expect(enemyLabel).not.toContainText('fire here');

	// And the enemy board must not accept it: the coordinate would be read
	// against the wrong ocean.
	await expect(enemyCells(page).nth(20)).toBeDisabled();
	await expect(ownCells(page).nth(20)).toBeEnabled();

	await page.locator('body').press('Escape');
	await expect(ownLabel).not.toContainText('fire here');
});
