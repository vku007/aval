import { useEffect, useRef, useState } from 'preact/hooks';

export interface IntFieldProps {
  label: string;
  /** `null` displays empty. `0` displays `0`. */
  value: number | null;
  /** Smallest integer that commits. Empty text commits `0` when that is inside the range. */
  min?: number;
  max?: number;
  readOnly?: boolean;
  disabled?: boolean;
  onCommit: (value: number) => void;
}

export interface FieldOption<T extends string> {
  value: T;
  label: string;
}

export function IntField({
  label,
  value,
  min = 0,
  max,
  readOnly = false,
  disabled = false,
  onCommit
}: IntFieldProps) {
  const [text, setText] = useState(() => shown(value));
  const [invalid, setInvalid] = useState(false);
  // Enter commits and then blurs. The blur must not record a second change.
  const committed = useRef<number | null>(null);

  useEffect(() => {
    setText(shown(value));
    setInvalid(false);
    committed.current = null;
  }, [value]);

  function commit(raw: string) {
    if (readOnly || disabled) return;
    const parsed = parseCount(raw, min, max);
    if (parsed === null) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    if (sameAmount(value, parsed) || committed.current === parsed) {
      setText(shown(value));
      return;
    }
    committed.current = parsed;
    setText(String(parsed));
    onCommit(parsed);
  }

  if (readOnly) {
    return (
      <div class="int-field">
        <span class="field-label">{label}</span>
        <span class="int-value">{shown(value)}</span>
      </div>
    );
  }

  return (
    <label class="int-field">
      <span class="field-label">{label}</span>
      <input
        type="text"
        inputMode="numeric"
        value={text}
        disabled={disabled}
        aria-invalid={invalid ? 'true' : undefined}
        onInput={(event) => {
          setText((event.currentTarget as HTMLInputElement).value);
          setInvalid(false);
        }}
        onBlur={(event) => commit((event.currentTarget as HTMLInputElement).value)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return;
          event.preventDefault();
          const input = event.currentTarget as HTMLInputElement;
          commit(input.value);
          input.blur();
        }}
      />
    </label>
  );
}

export function Select<T extends string>({
  label,
  value,
  options,
  disabled = false,
  onChange
}: {
  label: string;
  value: T;
  options: readonly FieldOption<T>[];
  disabled?: boolean;
  onChange: (value: T) => void;
}) {
  return (
    <label class="select-field">
      <span class="field-label">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange((event.currentTarget as HTMLSelectElement).value as T)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Checkbox({
  label,
  checked,
  disabled = false,
  onChange
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label class="check-field">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange((event.currentTarget as HTMLInputElement).checked)}
      />
      <span class="field-label">{label}</span>
    </label>
  );
}

export function MixedHint() {
  return <span class="mixed-hint">Mixed</span>;
}

function shown(value: number | null): string {
  return value === null ? '' : String(value);
}

/** `null` matches a blank stack row, which means zero. */
function sameAmount(value: number | null, next: number): boolean {
  if (value === null) return next === 0;
  return value === next;
}

function parseCount(raw: string, min: number, max: number | undefined): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') {
    if (min <= 0 && (max === undefined || max >= 0)) return 0;
    return null;
  }
  if (!/^[+]?\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  if (!Number.isSafeInteger(value) || value < min) return null;
  if (max !== undefined && value > max) return null;
  return value;
}
