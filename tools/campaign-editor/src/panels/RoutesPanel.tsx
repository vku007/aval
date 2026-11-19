import type { CampaignScoreRecord } from '@apiv2/domain/campaign/CampaignScore.js';
import type { ChapterSettings } from '@apiv2/domain/campaign/ChapterSettingsSchema.js';
import { ITEM_KEYS, type InventoryItemKey } from '@apiv2/domain/value-object/GamePlayerInventory.js';
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { Cell, Route, RouteStep } from '../model/document.js';
import { referenceRoutes, walkRoute, type RouteResult } from '../routes/walk.js';

export interface RoutesPanelProps {
  settings: ChapterSettings;
  routes: Route[];
  selection: Cell[];
  onRoutes: (routes: Route[]) => void;
}

const STEP_TYPES: RouteStep['type'][] = ['attack', 'search', 'dig', 'upgrade', 'buy', 'end_turn'];

export function RoutesPanel({ settings, routes, selection, onRoutes }: RoutesPanelProps) {
  const weights = settings.rules.scoreWeights;
  const reference = useMemo(
    () => referenceRoutes().map((route) => walkRoute(settings, route)),
    [settings]
  );
  const designer = useMemo(() => routes.map((route) => walkRoute(settings, route)), [settings, routes]);

  return (
    <div class="routes">
      <section aria-label="Reference routes">
        <h2>Reference</h2>
        {reference.map((result) => (
          <RouteCard key={result.route.name} result={result} weights={weights} />
        ))}
      </section>
      <section aria-label="Designer routes">
        <h2>Designer</h2>
        <button type="button" onClick={() => onRoutes([...routes, { name: `Route ${routes.length + 1}`, steps: [] }])}>
          Add route
        </button>
        {routes.length === 0 && <p class="routes-empty">No designer routes.</p>}
        {designer.map((result, index) => (
          <DesignerRoute
            key={index}
            result={result}
            index={index}
            routes={routes}
            selection={selection}
            weights={weights}
            onRoutes={onRoutes}
          />
        ))}
      </section>
    </div>
  );
}

function DesignerRoute({
  result,
  index,
  routes,
  selection,
  weights,
  onRoutes
}: {
  result: RouteResult;
  index: number;
  routes: Route[];
  selection: Cell[];
  weights: ChapterSettings['rules']['scoreWeights'];
  onRoutes: (routes: Route[]) => void;
}) {
  const route = routes[index];
  const name = route.name;

  function commit(next: Route) {
    onRoutes(routes.map((item, itemIndex) => (itemIndex === index ? next : item)));
  }

  return (
    <article class="route-card" data-route={name} data-kind="designer" data-completed={result.completed ? 'true' : 'false'}>
      <header class="route-header">
        <input
          class="route-name"
          aria-label={`${name} name`}
          value={name}
          onInput={(event) => commit({ ...route, name: (event.currentTarget as HTMLInputElement).value })}
        />
        <button type="button" aria-label={`${name} delete`} onClick={() => onRoutes(routes.filter((_, itemIndex) => itemIndex !== index))}>
          Delete
        </button>
      </header>
      <p class="route-status">{statusText(result)}</p>
      <StepTable result={result} routeName={name} onMove={(stepIndex, delta) => commit(moveStep(route, stepIndex, delta))} onDelete={(stepIndex) => commit(deleteStep(route, stepIndex))} />
      <ScoreLines result={result} weights={weights} />
      <StepAdder
        routeName={name}
        selection={selection}
        onAdd={(step) => commit({ ...route, steps: [...route.steps, step] })}
      />
    </article>
  );
}

function RouteCard({
  result,
  weights
}: {
  result: RouteResult;
  weights: ChapterSettings['rules']['scoreWeights'];
}) {
  return (
    <article class="route-card" data-route={result.route.name} data-kind="reference" data-completed={result.completed ? 'true' : 'false'}>
      <h3>{result.route.name}</h3>
      <p class="route-status">{statusText(result)}</p>
      <StepTable result={result} />
      <ScoreLines result={result} weights={weights} />
    </article>
  );
}

function StepTable({
  result,
  routeName,
  onMove,
  onDelete
}: {
  result: RouteResult;
  routeName?: string;
  onMove?: (index: number, delta: number) => void;
  onDelete?: (index: number) => void;
}) {
  if (result.route.steps.length === 0) return null;
  const editable = routeName !== undefined && onMove !== undefined && onDelete !== undefined;
  return (
    <table>
      <thead>
        <tr>
          <th>Step</th>
          <th>Turn</th>
          <th>Copper</th>
          <th>Silver</th>
          <th>Owned</th>
          <th>Error</th>
          {editable && <th>Order</th>}
        </tr>
      </thead>
      <tbody>
        {result.route.steps.map((step, index) => {
          const row = result.steps[index];
          return (
            <tr key={index} data-ok={row ? (row.ok ? 'true' : 'false') : undefined}>
              <td>{stepText(step)}</td>
              <td>{row ? row.turn : ''}</td>
              <td>{row ? row.copper : ''}</td>
              <td>{row ? row.silver : ''}</td>
              <td>{row ? row.owned : ''}</td>
              <td>{row?.error ?? ''}</td>
              {editable && (
                <td class="route-order">
                  <button
                    type="button"
                    aria-label={`${routeName} move step ${index + 1} up`}
                    disabled={index === 0}
                    onClick={() => onMove(index, -1)}
                  >
                    Up
                  </button>
                  <button
                    type="button"
                    aria-label={`${routeName} move step ${index + 1} down`}
                    disabled={index === result.route.steps.length - 1}
                    onClick={() => onMove(index, 1)}
                  >
                    Down
                  </button>
                  <button type="button" aria-label={`${routeName} delete step ${index + 1}`} onClick={() => onDelete(index)}>
                    Delete step
                  </button>
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ScoreLines({
  result,
  weights
}: {
  result: RouteResult;
  weights: ChapterSettings['rules']['scoreWeights'];
}) {
  if (!result.score) return null;
  return (
    <ul class="score-lines">
      {scoreLines(result.score, weights).map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  );
}

function StepAdder({
  routeName,
  selection,
  onAdd
}: {
  routeName: string;
  selection: Cell[];
  onAdd: (step: RouteStep) => void;
}) {
  const cell = selection[0];
  const [type, setType] = useState<RouteStep['type']>('attack');
  const [q, setQ] = useState(cell ? String(cell.q) : '0');
  const [r, setR] = useState(cell ? String(cell.r) : '0');
  const [result, setResult] = useState<'win' | 'loss'>('win');
  const [item, setItem] = useState<InventoryItemKey>('stones');
  const [amount, setAmount] = useState('1');
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    if (!cell) return;
    setQ(String(cell.q));
    setR(String(cell.r));
  }, [cell?.q, cell?.r]);

  function addFromForm(event: Event) {
    event.preventDefault();
    const step = readForm(type, q, r, result, item, amount);
    if (!step) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    onAdd(step);
  }

  const needsCell = type === 'attack' || type === 'search' || type === 'dig' || type === 'upgrade';

  return (
    <div class="route-adder">
      {cell && (
        <div class="route-quick">
          <span>
            Selected ({cell.q},{cell.r})
          </span>
          <button type="button" aria-label={`${routeName} attack`} onClick={() => onAdd({ type: 'attack', q: cell.q, r: cell.r })}>
            Attack
          </button>
          <button type="button" aria-label={`${routeName} search`} onClick={() => onAdd({ type: 'search', q: cell.q, r: cell.r })}>
            Search
          </button>
          <button type="button" aria-label={`${routeName} dig`} onClick={() => onAdd({ type: 'dig', q: cell.q, r: cell.r })}>
            Dig
          </button>
          <button type="button" aria-label={`${routeName} upgrade`} onClick={() => onAdd({ type: 'upgrade', q: cell.q, r: cell.r })}>
            Upgrade
          </button>
        </div>
      )}
      <form class="route-form" onSubmit={addFromForm}>
        <label>
          Type
          <select
            aria-label={`${routeName} step type`}
            value={type}
            onChange={(event) => {
              setInvalid(false);
              setType((event.currentTarget as HTMLSelectElement).value as RouteStep['type']);
            }}
          >
            {STEP_TYPES.map((stepType) => (
              <option key={stepType} value={stepType}>
                {stepType === 'end_turn' ? 'end turn' : stepType}
              </option>
            ))}
          </select>
        </label>
        {needsCell && (
          <>
            <label>
              q
              <input
                aria-label={`${routeName} q`}
                value={q}
                aria-invalid={invalid && !wholeNumber(q) ? 'true' : undefined}
                onInput={(event) => {
                  setInvalid(false);
                  setQ((event.currentTarget as HTMLInputElement).value);
                }}
              />
            </label>
            <label>
              r
              <input
                aria-label={`${routeName} r`}
                value={r}
                aria-invalid={invalid && !wholeNumber(r) ? 'true' : undefined}
                onInput={(event) => {
                  setInvalid(false);
                  setR((event.currentTarget as HTMLInputElement).value);
                }}
              />
            </label>
          </>
        )}
        {type === 'attack' && (
          <label>
            Result
            <select
              aria-label={`${routeName} result`}
              value={result}
              onChange={(event) => setResult((event.currentTarget as HTMLSelectElement).value as 'win' | 'loss')}
            >
              <option value="win">win</option>
              <option value="loss">loss</option>
            </select>
          </label>
        )}
        {type === 'buy' && (
          <>
            <label>
              Item
              <select
                aria-label={`${routeName} item`}
                value={item}
                onChange={(event) => setItem((event.currentTarget as HTMLSelectElement).value as InventoryItemKey)}
              >
                {ITEM_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {key}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Amount
              <input
                aria-label={`${routeName} amount`}
                value={amount}
                aria-invalid={invalid && !parseAmount(amount) ? 'true' : undefined}
                onInput={(event) => {
                  setInvalid(false);
                  setAmount((event.currentTarget as HTMLInputElement).value);
                }}
              />
            </label>
          </>
        )}
        <button type="submit" aria-label={`${routeName} add step`}>
          Add step
        </button>
      </form>
    </div>
  );
}

function statusText(result: RouteResult): string {
  if (result.route.steps.length === 0 && result.completed) return 'No steps';
  if (!result.completed) {
    const error = result.steps.find((step) => !step.ok)?.error ?? 'This route did not start';
    return `Stopped: ${error}`;
  }
  if (result.score) return `Score ${result.score.total}`;
  return 'Finished without a score';
}

function scoreLines(score: CampaignScoreRecord, weights: ChapterSettings['rules']['scoreWeights']): string[] {
  return [
    `base ${weights.base}`,
    `turns ${score.turns} × -${weights.perTurn} = ${-score.turns * weights.perTurn}`,
    `victories ${score.victories} × ${weights.perVictory} = ${score.victories * weights.perVictory}`,
    `silver ${score.silver} × ${weights.perSilver} = ${score.silver * weights.perSilver}`,
    `copper ${score.copper} × ${weights.perCopper} = ${score.copper * weights.perCopper}`,
    `total ${score.total}`
  ];
}

export function stepText(step: RouteStep): string {
  switch (step.type) {
    case 'attack':
      return `attack (${step.q},${step.r}) ${step.result ?? 'win'}`;
    case 'search':
    case 'dig':
    case 'upgrade':
      return `${step.type} (${step.q},${step.r})`;
    case 'buy':
      return `buy ${step.item} ${step.amount}`;
    case 'end_turn':
      return 'end turn';
    default: {
      const unreachable: never = step;
      return unreachable;
    }
  }
}

function moveStep(route: Route, index: number, delta: number): Route {
  const next = index + delta;
  if (next < 0 || next >= route.steps.length) return route;
  const steps = route.steps.map((step) => ({ ...step }));
  const [step] = steps.splice(index, 1);
  steps.splice(next, 0, step);
  return { name: route.name, steps };
}

function deleteStep(route: Route, index: number): Route {
  return { name: route.name, steps: route.steps.filter((_, stepIndex) => stepIndex !== index).map((step) => ({ ...step })) };
}

function readForm(
  type: RouteStep['type'],
  qText: string,
  rText: string,
  result: 'win' | 'loss',
  item: InventoryItemKey,
  amountText: string
): RouteStep | null {
  if (type === 'end_turn') return { type: 'end_turn' };
  if (type === 'buy') {
    const amount = parseAmount(amountText);
    return amount === null ? null : { type: 'buy', item, amount };
  }
  const cell = parseCell(qText, rText);
  if (!cell) return null;
  if (type === 'attack') {
    return result === 'loss' ? { type: 'attack', ...cell, result: 'loss' } : { type: 'attack', ...cell };
  }
  return { type, ...cell };
}

function wholeNumber(text: string): boolean {
  return /^-?\d+$/.test(text.trim());
}

function parseCell(qText: string, rText: string): Cell | null {
  if (!wholeNumber(qText) || !wholeNumber(rText)) return null;
  return { q: Number(qText), r: Number(rText) };
}

function parseAmount(text: string): number | null {
  if (!/^\d+$/.test(text.trim())) return null;
  const amount = Number(text);
  return amount >= 1 ? amount : null;
}
