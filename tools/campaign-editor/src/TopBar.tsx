import { useRef } from 'preact/hooks';

export function countPhrase(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? '' : 's'}`;
}

export interface TopBarProps {
  sourceName: string;
  errorCount: number;
  warningCount: number;
  canUndo: boolean;
  canRedo: boolean;
  canExport: boolean;
  saving: boolean;
  status: string | null;
  pendingDraft: boolean;
  onOpenFile: (file: File) => void;
  onBundled: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onExport: () => void;
  onResumeDraft: () => void;
  onDiscardDraft: () => void;
}

export function TopBar({
  sourceName,
  errorCount,
  warningCount,
  canUndo,
  canRedo,
  canExport,
  saving,
  status,
  pendingDraft,
  onOpenFile,
  onBundled,
  onUndo,
  onRedo,
  onSave,
  onExport,
  onResumeDraft,
  onDiscardDraft
}: TopBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function onFileChange(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) onOpenFile(file);
  }

  return (
    <header class="topbar">
      <span class="title">Chapter I</span>
      <span class="source">{sourceName}</span>
      {pendingDraft && (
        <>
          <button type="button" onClick={onResumeDraft}>
            Resume draft
          </button>
          <button type="button" onClick={onDiscardDraft}>
            Discard
          </button>
        </>
      )}
      <button type="button" onClick={() => inputRef.current?.click()}>
        Open
      </button>
      <input
        ref={inputRef}
        class="file-input"
        type="file"
        accept="application/json,.json"
        aria-label="Open chapter file"
        onChange={onFileChange}
      />
      <button type="button" onClick={onBundled}>
        Bundled
      </button>
      <button type="button" onClick={onUndo} disabled={!canUndo}>
        Undo
      </button>
      <button type="button" onClick={onRedo} disabled={!canRedo}>
        Redo
      </button>
      <span class="counts">
        {countPhrase(errorCount, 'error')} {countPhrase(warningCount, 'warning')}
      </span>
      {import.meta.env.DEV && (
        <button type="button" onClick={onSave} disabled={!canExport || saving}>
          Save to repo
        </button>
      )}
      <button type="button" onClick={onExport} disabled={!canExport}>
        Export
      </button>
      {status && (
        <span class="status" role="status">
          {status}
        </span>
      )}
    </header>
  );
}
