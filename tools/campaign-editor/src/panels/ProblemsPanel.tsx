import type { Problem } from '@apiv2/domain/campaign/ChapterSettingsSchema.js';
import type { Cell } from '../model/document.js';

export interface ProblemsPanelProps {
  problems: Problem[];
  selection: Cell[];
  onProblem: (problem: Problem) => void;
}

function dotted(path: (string | number)[]): string {
  return path.map((part) => String(part)).join('.');
}

function problemName(problem: Problem): string {
  const where = problem.tile ? `(${problem.tile.q},${problem.tile.r}) ` : '';
  return `${where}${problem.message}`;
}

function isCurrent(problem: Problem, selection: Cell[]): boolean {
  if (!problem.tile) return false;
  return selection.some((cell) => cell.q === problem.tile?.q && cell.r === problem.tile?.r);
}

export function ProblemsPanel({ problems, selection, onProblem }: ProblemsPanelProps) {
  const errors = problems.filter((problem) => problem.level === 'error');
  const warnings = problems.filter((problem) => problem.level === 'warning');

  if (problems.length === 0) {
    return <p class="problems-empty">No problems.</p>;
  }

  return (
    <div class="problems">
      {errors.length > 0 && <ProblemGroup title="Errors" problems={errors} selection={selection} onProblem={onProblem} />}
      {warnings.length > 0 && (
        <ProblemGroup title="Warnings" problems={warnings} selection={selection} onProblem={onProblem} />
      )}
    </div>
  );
}

function ProblemGroup({
  title,
  problems,
  selection,
  onProblem
}: {
  title: string;
  problems: Problem[];
  selection: Cell[];
  onProblem: (problem: Problem) => void;
}) {
  return (
    <section>
      <h2>{title}</h2>
      <ul>
        {problems.map((problem) => (
          <li key={`${problem.level}:${problem.code}:${dotted(problem.path)}`}>
            <button
              type="button"
              class={`problem problem-${problem.level}`}
              aria-label={problemName(problem)}
              aria-current={isCurrent(problem, selection) ? 'true' : undefined}
              onClick={() => onProblem(problem)}
            >
              <span class="problem-level">{problem.level}</span>
              <span class="problem-message">{problemName(problem)}</span>
              <span class="problem-path">{dotted(problem.path)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
