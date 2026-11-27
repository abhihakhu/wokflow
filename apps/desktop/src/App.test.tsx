// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryStore, type Platform, type StoreSeed } from '@wokflow/data';
import { App } from './App';

// jsdom has no WebGL; the PixiJS scene is covered by @wokflow/scene's unit tests.
vi.mock('./scene/KitchenScene', () => ({ KitchenScene: () => null }));

function setup(seed: StoreSeed = {}) {
  const store = createMemoryStore(seed);
  const platform: Platform = {
    store,
    notify: async () => {},
    onAppHidden: () => () => {},
    onAppVisible: () => () => {},
  };
  const user = userEvent.setup();
  render(<App platform={platform} />);
  return { store, user };
}

afterEach(cleanup);

describe('WokFlow desktop app', () => {
  it('starts with an empty kitchen', async () => {
    setup();
    expect(await screen.findByText(/The kitchen is empty/)).toBeTruthy();
    expect(within(screen.getByRole('group', { name: 'Wallet' })).getByText(/0 coins/)).toBeTruthy();
  });

  it('adds, validates, edits and deletes a task', async () => {
    const { store, user } = setup();

    await user.click(await screen.findByRole('button', { name: '+ Task' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Give it a name.');

    await user.type(screen.getByLabelText('Title'), 'Lab 9 write-up');
    await user.type(screen.getByLabelText(/Tags/), 'Lab, ECE, lab');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    const title = await screen.findByRole('button', { name: 'Lab 9 write-up' });
    expect(screen.getByText('lab')).toBeTruthy();
    expect(screen.getByText('ece')).toBeTruthy();
    expect((await store.tasks.list())[0]?.tags).toEqual(['lab', 'ece']);

    await user.click(title);
    const titleInput = screen.getByLabelText('Title');
    await user.clear(titleInput);
    await user.type(titleInput, 'Lab 9 report');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    const renamed = await screen.findByRole('button', { name: 'Lab 9 report' });

    await user.click(renamed);
    await user.click(screen.getByRole('button', { name: 'Delete…' }));
    await user.click(screen.getByRole('button', { name: 'Really delete' }));
    expect(await screen.findByText(/The kitchen is empty/)).toBeTruthy();
    expect(await store.tasks.list()).toEqual([]);
  });

  it('builds a signature dish, reorders steps, and rewards finishing it', async () => {
    const { store, user } = setup();

    await user.click(await screen.findByRole('button', { name: '+ Recipe' }));
    await user.type(screen.getByLabelText('Name'), 'ECE 264 exam review');
    await user.click(screen.getByRole('button', { name: 'Signature dish' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    const card = (await screen.findByRole('heading', { name: 'ECE 264 exam review' })).closest(
      'section',
    )!;
    expect(within(card).getByText('Signature dish')).toBeTruthy();

    const stepInput = within(card).getByPlaceholderText('Add a step…');
    for (const step of ['Pointers', 'Linked lists']) {
      await user.type(stepInput, step);
      await user.click(within(card).getByRole('button', { name: 'Add' }));
      await within(card).findByRole('button', { name: step });
    }
    expect(within(card).getByText('0 / 2 steps')).toBeTruthy();

    // Reorder: move "Linked lists" first.
    await user.click(within(card).getByRole('button', { name: 'Edit ECE 264 exam review' }));
    await user.click(screen.getByRole('button', { name: 'Move Linked lists up' }));
    await waitFor(async () => {
      const steps = (await store.tasks.list()).sort((a, b) => a.stepIndex! - b.stepIndex!);
      expect(steps.map((s) => s.title)).toEqual(['Linked lists', 'Pointers']);
    });
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    const menuCard = (await screen.findByRole('heading', { name: 'ECE 264 exam review' })).closest(
      'section',
    )!;
    const order = within(menuCard)
      .getAllByRole('listitem')
      .map((li) => within(li).getAllByRole('button')[0]!.textContent);
    expect(order).toEqual(['Linked lists', 'Pointers']);

    await user.click(within(menuCard).getByRole('checkbox', { name: 'Complete Linked lists' }));
    expect(await screen.findByText('Step done. +1 ingredient.')).toBeTruthy();
    await user.click(within(menuCard).getByRole('checkbox', { name: 'Complete Pointers' }));
    expect(await screen.findByText(/Signature dish complete/)).toBeTruthy();
    const wallet = within(screen.getByRole('group', { name: 'Wallet' }));
    expect(wallet.getByText(/2 ingredients/)).toBeTruthy();
    expect(wallet.getByText(/1 rare decor/)).toBeTruthy();
    expect(within(menuCard).getByText('2 / 2 steps')).toBeTruthy();
  });

  it('runs a full Prep → Simmer → Plate session and persists coins', async () => {
    const { store, user } = setup();

    await user.click(await screen.findByRole('button', { name: '+ Task' }));
    await user.type(screen.getByLabelText('Title'), 'Read chapter 5');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await user.click(await screen.findByRole('button', { name: 'Prep' }));

    const start = screen.getByRole('button', { name: 'Fire up the wok' });
    expect((start as HTMLButtonElement).disabled).toBe(true);
    await user.type(screen.getByLabelText('Smallest first step'), 'Skim the headings');
    await user.type(screen.getByLabelText(/I want to understand/), 'How recursion unwinds');
    await user.click(start);

    expect(await screen.findByRole('heading', { name: 'Simmering' })).toBeTruthy();
    expect(screen.getByRole('timer')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Finish & plate' }));

    await user.type(
      screen.getByLabelText(/Explain it in 2–3 sentences/),
      'Each call waits for the smaller call. Then results return back up the stack.',
    );
    await user.click(screen.getByRole('button', { name: '4' }));
    await user.click(screen.getByLabelText('This task is finished'));
    await user.click(screen.getByRole('button', { name: 'Serve the dish' }));

    // 0 focused minutes + 10 reflection bonus + 4 × 2 rating = 18
    expect(await screen.findByText('Served! +18 coins')).toBeTruthy();
    expect(
      within(screen.getByRole('group', { name: 'Wallet' })).getByText(/18 coins/),
    ).toBeTruthy();
    expect((await store.inventory.get('coins'))?.qty).toBe(18);
    const [task] = await store.tasks.list();
    expect(task?.status).toBe('done');
    const [session] = await store.sessions.list();
    expect(session).toMatchObject({ phase: 'served', focusRating: 4, coinsEarned: 18 });
  });

  it('saves settings and uses them for the next session', async () => {
    const { store, user } = setup();

    await user.click(await screen.findByRole('button', { name: 'Settings' }));
    expect(screen.getByRole('radio', { name: /Ember/ })).toHaveProperty('checked', true);

    const grace = screen.getByLabelText(/Away grace period/);
    await user.clear(grace);
    await user.type(grace, '999');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/Grace period must be/);

    await user.clear(grace);
    await user.type(grace, '60');
    const minutes = screen.getByLabelText(/Default session/);
    await user.clear(minutes);
    await user.type(minutes, '50');
    await user.click(screen.getByRole('button', { name: 'Calm (still)' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await screen.findByRole('heading', { name: 'Today’s menu' });
    expect((await store.settings.get('settings'))?.values).toMatchObject({
      awayGraceSec: 60,
      defaultSimmerMin: 50,
      motion: 'reduce',
    });

    await user.click(screen.getByRole('button', { name: '+ Task' }));
    await user.type(screen.getByLabelText('Title'), 'Problem set');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await user.click(await screen.findByRole('button', { name: 'Prep' }));
    expect(screen.getByRole('button', { name: '50m' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('buys decor in the market, then hides it from the kitchen', async () => {
    const now = '2026-11-27T00:00:00.000Z';
    const { store, user } = setup({ inventory: [{ id: 'coins', qty: 100, updatedAt: now }] });

    await user.click(await screen.findByRole('button', { name: 'Market' }));
    const fan = screen.getByText('Paper fan').closest('li')!;
    const bonsai = screen.getByText('Bonsai pine').closest('li')!;
    expect(within(bonsai).getByRole('button', { name: 'Buy' })).toHaveProperty('disabled', true);
    expect(within(bonsai).getByText('Needs 2 more ingredients.')).toBeTruthy();

    await user.click(within(fan).getByRole('button', { name: 'Buy' }));
    expect(await screen.findByText('The Paper fan is in your kitchen.')).toBeTruthy();
    const wallet = within(screen.getByRole('group', { name: 'Wallet' }));
    expect(wallet.getByText(/60 coins/)).toBeTruthy();
    expect((await store.inventory.get('decor:paper-fan'))?.qty).toBe(1);

    const shown = within(screen.getByText('Paper fan').closest('li')!).getByRole('checkbox', {
      name: 'Shown in the kitchen',
    });
    expect(shown).toHaveProperty('checked', true);
    await user.click(shown);
    await waitFor(async () =>
      expect((await store.placements.get('paper-fan'))?.visible).toBe(false),
    );

    // The tea set costs 60: exactly what is left.
    const tea = screen.getByText('Clay tea set').closest('li')!;
    await user.click(within(tea).getByRole('button', { name: 'Buy' }));
    expect(await wallet.findByText(/0 coins/)).toBeTruthy();
  });
});
