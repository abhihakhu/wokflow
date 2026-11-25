import { useState } from 'react';
import { recipeSteps, type Recipe, type RecipeKind } from '@wokflow/core';
import { dateInputValue, toFormError, type FormError } from '../format';
import type { Kitchen } from '../state/useKitchen';

interface RecipeEditorProps {
  kitchen: Kitchen;
  recipe: Recipe | undefined;
  onDone(): void;
}

export function RecipeEditor({ kitchen, recipe, onDone }: RecipeEditorProps) {
  const [title, setTitle] = useState(recipe?.title ?? '');
  const [kind, setKind] = useState<RecipeKind>(recipe?.kind ?? 'recipe');
  const [dueAt, setDueAt] = useState(dateInputValue(recipe?.dueAt));
  const [error, setError] = useState<FormError>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const steps = recipe ? recipeSteps(kitchen.tasks, recipe.id) : [];

  return (
    <form
      className="stack"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        kitchen
          .saveRecipe({ title, kind, dueAt }, recipe)
          .then(onDone, (err: unknown) => setError(toFormError(err)));
      }}
    >
      <h2>{recipe ? 'Edit recipe' : 'New recipe'}</h2>
      {error && (
        <p className="error" role="alert">
          {error.message}
        </p>
      )}
      <label>
        Name
        <input
          value={title}
          placeholder="e.g. ECE 264 exam review"
          onChange={(e) => setTitle(e.target.value)}
          aria-invalid={error?.field === 'title' ? true : undefined}
        />
      </label>
      <fieldset className="pills">
        <legend>Kind</legend>
        <button
          type="button"
          className="pill wide"
          aria-pressed={kind === 'recipe'}
          onClick={() => setKind('recipe')}
        >
          Recipe
        </button>
        <button
          type="button"
          className="pill wide"
          aria-pressed={kind === 'signature'}
          onClick={() => setKind('signature')}
        >
          Signature dish
        </button>
      </fieldset>
      <p className="muted">
        {kind === 'signature'
          ? 'A boss recipe for exams and projects. Finishing every step unlocks rare decor.'
          : 'A multi-step task. Each finished step earns an ingredient.'}
      </p>
      <label>
        Due
        <input
          type="date"
          value={dueAt}
          onChange={(e) => setDueAt(e.target.value)}
          aria-invalid={error?.field === 'dueAt' ? true : undefined}
        />
      </label>

      {recipe && steps.length > 0 && (
        <section className="stack tight" aria-labelledby="steps-heading">
          <h3 id="steps-heading">Step order</h3>
          <ol className="steps">
            {steps.map((step, i) => (
              <li key={step.id} className="row spread">
                <span className={step.status === 'done' ? 'done-text' : undefined}>
                  {step.title}
                </span>
                <span className="row">
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Move ${step.title} up`}
                    disabled={i === 0}
                    onClick={() => void kitchen.moveStep(recipe, step, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Move ${step.title} down`}
                    disabled={i === steps.length - 1}
                    onClick={() => void kitchen.moveStep(recipe, step, 1)}
                  >
                    ↓
                  </button>
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="row spread">
        <div className="row">
          <button type="button" className="btn ghost" onClick={onDone}>
            Cancel
          </button>
          <button type="submit" className="btn primary">
            Save
          </button>
        </div>
        {recipe &&
          (confirmDelete ? (
            <button
              type="button"
              className="btn danger"
              onClick={() => void kitchen.deleteRecipe(recipe).then(onDone)}
            >
              Delete recipe and {steps.length} step{steps.length === 1 ? '' : 's'}
            </button>
          ) : (
            <button type="button" className="link" onClick={() => setConfirmDelete(true)}>
              Delete…
            </button>
          ))}
      </div>
    </form>
  );
}
