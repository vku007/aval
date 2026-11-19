import type { ChapterSettings } from '@apiv2/domain/campaign/ChapterSettingsSchema.js';
import { useEffect, useRef, useState } from 'preact/hooks';
import { IntField } from '../components/fields.js';
import type { DocAction } from '../model/document.js';

export interface ChapterPanelProps {
  settings: ChapterSettings;
  onAction: (action: DocAction) => void;
}

export function ChapterPanel({ settings, onAction }: ChapterPanelProps) {
  return (
    <div class="form-panel">
      <div class="readout">
        <span class="field-label">Id</span>
        <span>{settings.id}</span>
      </div>
      <BlurText
        label="Title"
        value={settings.title}
        onCommit={(title) => onAction({ type: 'setChapter', patch: { title } })}
      />
      <BlurText
        label="Goal"
        value={settings.goal}
        multiline
        onCommit={(goal) => onAction({ type: 'setChapter', patch: { goal } })}
      />
      <div class="version-row">
        <IntField
          label="Ruleset version"
          value={settings.rulesetVersion}
          min={1}
          onCommit={(rulesetVersion) => onAction({ type: 'setChapter', patch: { rulesetVersion } })}
        />
        <button
          type="button"
          onClick={() =>
            onAction({ type: 'setChapter', patch: { rulesetVersion: settings.rulesetVersion + 1 } })
          }
        >
          Bump
        </button>
      </div>
    </div>
  );
}

function BlurText({
  label,
  value,
  multiline = false,
  onCommit
}: {
  label: string;
  value: string;
  multiline?: boolean;
  onCommit: (value: string) => void;
}) {
  const [text, setText] = useState(value);
  const committed = useRef<string | null>(null);

  useEffect(() => {
    setText(value);
    committed.current = null;
  }, [value]);

  function commit(raw: string) {
    if (raw === value || committed.current === raw) {
      setText(value);
      return;
    }
    committed.current = raw;
    onCommit(raw);
  }

  function onInput(event: Event) {
    setText((event.currentTarget as HTMLInputElement | HTMLTextAreaElement).value);
  }

  function onBlur(event: Event) {
    commit((event.currentTarget as HTMLInputElement | HTMLTextAreaElement).value);
  }

  return (
    <label class="text-field">
      <span class="field-label">{label}</span>
      {multiline ? (
        <textarea value={text} rows={3} onInput={onInput} onBlur={onBlur} />
      ) : (
        <input
          type="text"
          value={text}
          onInput={onInput}
          onBlur={onBlur}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            const input = event.currentTarget as HTMLInputElement;
            commit(input.value);
            input.blur();
          }}
        />
      )}
    </label>
  );
}
