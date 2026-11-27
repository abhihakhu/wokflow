import { useMemo, useState } from 'react';
import {
  AWAY_GRACE_RANGE,
  MAX_PLANNED_MIN,
  MIN_PLANNED_MIN,
  type MotionPreference,
} from '@wokflow/core';
import { toFormError, type FormError } from '../format';
import { listPacks } from '../packs';
import type { SettingsState } from '../state/useSettings';

const MOTION_OPTIONS: Array<{ value: MotionPreference; label: string }> = [
  { value: 'system', label: 'Follow system' },
  { value: 'reduce', label: 'Calm (still)' },
  { value: 'full', label: 'Full animation' },
];

export function SettingsView({ state, onDone }: { state: SettingsState; onDone(): void }) {
  const packs = useMemo(() => listPacks(), []);
  const { settings } = state;
  const [companionPack, setCompanionPack] = useState(settings.companionPack);
  const [defaultSimmerMin, setDefaultSimmerMin] = useState(settings.defaultSimmerMin);
  const [awayGraceSec, setAwayGraceSec] = useState(settings.awayGraceSec);
  const [motion, setMotion] = useState(settings.motion);
  const [error, setError] = useState<FormError>();
  const invalid = (field: string) => (error?.field === field ? true : undefined);

  return (
    <form
      className="stack"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        state
          .save({ companionPack, defaultSimmerMin, awayGraceSec, motion })
          .then(onDone, (err: unknown) => setError(toFormError(err)));
      }}
    >
      <h2>Settings</h2>
      {error && (
        <p className="error" role="alert">
          {error.message}
        </p>
      )}

      <fieldset className="stack tight plain">
        <legend>
          <h3>Companion</h3>
        </legend>
        <div className="pack-grid">
          {packs.map((option) => (
            <label key={option.folder} className={`pack-card${option.error ? ' broken' : ''}`}>
              <input
                type="radio"
                name="companion"
                value={option.folder}
                checked={companionPack === option.folder}
                disabled={Boolean(option.error)}
                onChange={() => setCompanionPack(option.folder)}
              />
              {option.preview ? (
                <span
                  className="pack-preview"
                  aria-hidden="true"
                  style={{
                    backgroundImage: `url(${option.preview.url})`,
                    backgroundSize: `${option.preview.frames * 100}% 100%`,
                    aspectRatio: String(option.preview.aspect),
                  }}
                />
              ) : (
                <span className="pack-preview empty" aria-hidden="true" />
              )}
              <span className="pack-name">{option.name}</span>
              {option.error && <span className="pack-error">{option.error}</span>}
            </label>
          ))}
        </div>
        <p className="muted">
          Add a pack by putting its folder in <code>packs/</code> and restarting the app. See
          packs/README.md.
        </p>
      </fieldset>

      <div className="row">
        <label className="grow">
          Default session (minutes)
          <input
            type="number"
            min={MIN_PLANNED_MIN}
            max={MAX_PLANNED_MIN}
            value={defaultSimmerMin}
            onChange={(e) => setDefaultSimmerMin(Number(e.target.value))}
            aria-invalid={invalid('defaultSimmerMin')}
          />
        </label>
        <label className="grow">
          Away grace period (seconds)
          <input
            type="number"
            min={AWAY_GRACE_RANGE.min}
            max={AWAY_GRACE_RANGE.max}
            value={awayGraceSec}
            onChange={(e) => setAwayGraceSec(Number(e.target.value))}
            aria-invalid={invalid('awayGraceSec')}
          />
        </label>
      </div>
      <p className="muted">
        Hiding WokFlow for less than the grace period doesn’t count as stepping away.
      </p>

      <fieldset className="pills">
        <legend>Kitchen animation</legend>
        {MOTION_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className="pill wide"
            aria-pressed={motion === option.value}
            onClick={() => setMotion(option.value)}
          >
            {option.label}
          </button>
        ))}
      </fieldset>

      <div className="row">
        <button type="button" className="btn ghost" onClick={onDone}>
          Cancel
        </button>
        <button type="submit" className="btn primary">
          Save
        </button>
      </div>
    </form>
  );
}
