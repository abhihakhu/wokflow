import { useState } from 'react';
import {
  DECOR_CATALOG,
  describeShortfall,
  ownsDecor,
  shortfall,
  type DecorCost,
  type DecorItem,
} from '@wokflow/core';
// The decor-only entry point: importing '@wokflow/scene' would pull PixiJS into the main bundle.
import { DECOR_ART } from '@wokflow/scene/decor';
import { decorFileUrl } from '../decorArt';
import type { Kitchen } from '../state/useKitchen';

function Price({ cost }: { cost: DecorCost }) {
  return (
    <span className="price">
      <span>
        <span className="coin" aria-hidden="true" /> {cost.coins}
        <span className="sr-only"> coins</span>
      </span>
      {cost.ingredients > 0 && (
        <span>
          <span className="chili" aria-hidden="true" /> {cost.ingredients}
          <span className="sr-only"> ingredients</span>
        </span>
      )}
      {cost.rareDecor > 0 && (
        <span>
          ✦ {cost.rareDecor}
          <span className="sr-only"> rare decor</span>
        </span>
      )}
    </span>
  );
}

export function Shop({ kitchen, onDone }: { kitchen: Kitchen; onDone(): void }) {
  const [message, setMessage] = useState<{ text: string; error: boolean }>();

  async function buy(item: DecorItem) {
    try {
      await kitchen.buyDecor(item.id);
      setMessage({ text: `The ${item.name} is in your kitchen.`, error: false });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : String(err), error: true });
    }
  }

  return (
    <div className="stack">
      <div className="row spread">
        <h2>Market</h2>
        <button type="button" className="btn small ghost" onClick={onDone}>
          Back to menu
        </button>
      </div>
      <p className="muted">Spend what your sessions earn on things for the kitchen.</p>
      {message && (
        <p className={message.error ? 'error' : 'earned'} role="status">
          {message.text}
        </p>
      )}
      <ul className="shop">
        {DECOR_CATALOG.map((item) => {
          const owned = ownsDecor(kitchen.inventory, item.id);
          const missing = describeShortfall(shortfall(kitchen.wallet, item.cost));
          const hidden = kitchen.placements.some((p) => p.id === item.id && !p.visible);
          const art = DECOR_ART[item.id];
          return (
            <li key={item.id} className={`shop-item${owned ? ' owned' : ''}`}>
              {art && <img className="shop-art" src={decorFileUrl(art.file)} alt="" />}
              <div className="shop-body">
                <span className="shop-name">{item.name}</span>
                <span className="muted">{item.description}</span>
                {owned ? (
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={!hidden}
                      onChange={(e) => void kitchen.setDecorVisible(item.id, e.target.checked)}
                    />
                    Shown in the kitchen
                  </label>
                ) : (
                  <div className="row spread">
                    <Price cost={item.cost} />
                    <button
                      type="button"
                      className="btn small primary"
                      disabled={Boolean(missing)}
                      aria-describedby={missing ? `need-${item.id}` : undefined}
                      onClick={() => void buy(item)}
                    >
                      Buy
                    </button>
                  </div>
                )}
                {!owned && missing && (
                  <span id={`need-${item.id}`} className="shop-need">
                    {missing}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
