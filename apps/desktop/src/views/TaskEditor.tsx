import { useState } from 'react';
import type { Recipe, Task } from '@wokflow/core';
import { dateInputValue, toFormError, type FormError } from '../format';
import type { Kitchen } from '../state/useKitchen';

interface TaskEditorProps {
  kitchen: Kitchen;
  task: Task | undefined;
  onDone(): void;
}

export function TaskEditor({ kitchen, task, onDone }: TaskEditorProps) {
  const [title, setTitle] = useState(task?.title ?? '');
  const [notes, setNotes] = useState(task?.notes ?? '');
  const [dueAt, setDueAt] = useState(dateInputValue(task?.dueAt));
  const [estSessions, setEstSessions] = useState(task?.estSessions ?? 1);
  const [tags, setTags] = useState(task?.tags.join(', ') ?? '');
  const [error, setError] = useState<FormError>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const recipe: Recipe | undefined = task?.recipeId
    ? kitchen.recipes.find((r) => r.id === task.recipeId)
    : undefined;
  const invalid = (field: string) => (error?.field === field ? true : undefined);

  return (
    <form
      className="stack"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        kitchen
          .saveTask(
            {
              title,
              notes,
              dueAt,
              estSessions,
              tags,
              ...(task?.recipeId ? { recipeId: task.recipeId } : {}),
            },
            task,
          )
          .then(onDone, (err: unknown) => setError(toFormError(err)));
      }}
    >
      <h2>{task ? 'Edit task' : 'New task'}</h2>
      {recipe && <p className="muted">Step of {recipe.title}</p>}
      {error && (
        <p className="error" role="alert">
          {error.message}
        </p>
      )}
      <label>
        Title
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-invalid={invalid('title')}
          required
        />
      </label>
      <label>
        Notes
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          aria-invalid={invalid('notes')}
        />
      </label>
      <div className="row">
        <label className="grow">
          Due
          <input
            type="date"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            aria-invalid={invalid('dueAt')}
          />
        </label>
        <label className="grow">
          Sessions
          <input
            type="number"
            min={1}
            max={20}
            value={estSessions}
            onChange={(e) => setEstSessions(Number(e.target.value))}
            aria-invalid={invalid('estSessions')}
          />
        </label>
      </div>
      <label>
        Tags <span className="muted">comma-separated</span>
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          aria-invalid={invalid('tags')}
        />
      </label>
      <div className="row spread">
        <div className="row">
          <button type="button" className="btn ghost" onClick={onDone}>
            Cancel
          </button>
          <button type="submit" className="btn primary">
            Save
          </button>
        </div>
        {task &&
          (confirmDelete ? (
            <button
              type="button"
              className="btn danger"
              onClick={() => void kitchen.deleteTask(task).then(onDone)}
            >
              Really delete
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
