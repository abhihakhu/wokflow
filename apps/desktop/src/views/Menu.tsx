import { useState } from 'react';
import { recipeProgress, recipeSteps, sortForMenu, type Recipe, type Task } from '@wokflow/core';
import { dueLabel } from '../format';
import type { Kitchen } from '../state/useKitchen';

interface MenuProps {
  kitchen: Kitchen;
  flash: string | undefined;
  onPrep(task: Task): void;
  onEditTask(task: Task | undefined): void;
  onEditRecipe(recipe: Recipe | undefined): void;
  onReward(message: string): void;
}

export function Menu({ kitchen, flash, onPrep, onEditTask, onEditRecipe, onReward }: MenuProps) {
  const loose = sortForMenu(kitchen.tasks.filter((t) => !t.recipeId));
  const recipes = [...kitchen.recipes].sort((a, b) =>
    (a.dueAt ?? '￿').localeCompare(b.dueAt ?? '￿'),
  );

  async function toggle(task: Task) {
    const reward = await kitchen.toggleDone(task);
    if (reward?.rareDecorUnlock)
      onReward('Signature dish complete! +1 ingredient, rare decor unlocked.');
    else if (reward) onReward(`Step done. +${reward.ingredients} ingredient.`);
  }

  return (
    <div className="stack">
      <div className="row spread">
        <h2>Today’s menu</h2>
        <div className="row">
          <button type="button" className="btn small" onClick={() => onEditTask(undefined)}>
            + Task
          </button>
          <button type="button" className="btn small" onClick={() => onEditRecipe(undefined)}>
            + Recipe
          </button>
        </div>
      </div>

      {flash && (
        <p className="earned" role="status">
          {flash}
        </p>
      )}

      {kitchen.loaded && loose.length === 0 && recipes.length === 0 && (
        <p className="muted">
          The kitchen is empty. Add a task, or a recipe for something bigger like an exam.
        </p>
      )}

      {recipes.map((recipe) => (
        <RecipeCard
          key={recipe.id}
          recipe={recipe}
          kitchen={kitchen}
          onPrep={onPrep}
          onToggle={toggle}
          onEdit={() => onEditRecipe(recipe)}
          onEditStep={onEditTask}
        />
      ))}

      {loose.length > 0 && (
        <section className="stack tight" aria-labelledby="loose-heading">
          <h3 id="loose-heading">À la carte</h3>
          <ul className="tasks">
            {loose.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onToggle={() => void toggle(task)}
                onPrep={() => onPrep(task)}
                onEdit={() => onEditTask(task)}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function RecipeCard({
  recipe,
  kitchen,
  onPrep,
  onToggle,
  onEdit,
  onEditStep,
}: {
  recipe: Recipe;
  kitchen: Kitchen;
  onPrep(task: Task): void;
  onToggle(task: Task): Promise<void>;
  onEdit(): void;
  onEditStep(task: Task): void;
}) {
  const [newStep, setNewStep] = useState('');
  const [error, setError] = useState<string>();
  const steps = recipeSteps(kitchen.tasks, recipe.id);
  const progress = recipeProgress(kitchen.tasks, recipe.id);
  const due = dueLabel(recipe.dueAt);
  const headingId = `recipe-${recipe.id}`;

  return (
    <section className="recipe" aria-labelledby={headingId}>
      <div className="row spread">
        <div className="stack tight">
          {recipe.kind === 'signature' && <span className="badge">Signature dish</span>}
          <h3 id={headingId}>{recipe.title}</h3>
        </div>
        <button type="button" className="link" onClick={onEdit} aria-label={`Edit ${recipe.title}`}>
          Edit
        </button>
      </div>
      <div className="row spread muted">
        <span>
          {progress.done} / {progress.total} steps
        </span>
        {due && <span className={due.overdue ? 'overdue' : undefined}>{due.text}</span>}
      </div>
      <div
        className="progress"
        role="progressbar"
        aria-label={`${recipe.title} progress`}
        aria-valuemin={0}
        aria-valuemax={progress.total}
        aria-valuenow={progress.done}
      >
        <div style={{ width: `${progress.ratio * 100}%` }} />
      </div>
      <ol className="tasks">
        {steps.map((step) => (
          <TaskRow
            key={step.id}
            task={step}
            isNext={progress.next?.id === step.id}
            onToggle={() => void onToggle(step)}
            onPrep={() => onPrep(step)}
            onEdit={() => onEditStep(step)}
          />
        ))}
      </ol>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          kitchen.addStep(recipe, newStep).then(
            () => {
              setNewStep('');
              setError(undefined);
            },
            (err: unknown) => setError(err instanceof Error ? err.message : String(err)),
          );
        }}
      >
        <label className="grow">
          <span className="sr-only">New step for {recipe.title}</span>
          <input
            value={newStep}
            placeholder="Add a step…"
            onChange={(e) => setNewStep(e.target.value)}
            aria-invalid={error ? true : undefined}
          />
        </label>
        <button type="submit" className="btn small" disabled={!newStep.trim()}>
          Add
        </button>
      </form>
      {error && <p className="error">{error}</p>}
    </section>
  );
}

function TaskRow({
  task,
  isNext,
  onToggle,
  onPrep,
  onEdit,
}: {
  task: Task;
  isNext?: boolean;
  onToggle(): void;
  onPrep(): void;
  onEdit(): void;
}) {
  const done = task.status === 'done';
  const due = dueLabel(task.dueAt);
  return (
    <li className={`task${done ? ' done' : ''}${isNext ? ' next' : ''}`}>
      <input
        type="checkbox"
        checked={done}
        onChange={onToggle}
        aria-label={`${done ? 'Reopen' : 'Complete'} ${task.title}`}
      />
      <div className="task-body">
        <button type="button" className="task-title" onClick={onEdit}>
          {task.title}
        </button>
        <span className="task-meta">
          {task.status === 'in_progress' && <span>In progress</span>}
          {due && <span className={due.overdue && !done ? 'overdue' : undefined}>{due.text}</span>}
          {task.tags.map((tag) => (
            <span key={tag} className="tag">
              {tag}
            </span>
          ))}
        </span>
      </div>
      {!done && (
        <button type="button" className="btn small" onClick={onPrep}>
          Prep
        </button>
      )}
    </li>
  );
}
