import chapterRaw from '@apiv2/domain/campaign/chapter-i.json?raw';
import {
  chapterErrors,
  checkChapterSettings,
  type ChapterSettings,
  type Problem
} from '@apiv2/domain/campaign/ChapterSettingsSchema.js';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  clearDraft,
  downloadChapter,
  loadDraft,
  openFile,
  saveDraft,
  saveToRepo,
  type ChapterDraft
} from '../io/files.js';
import { createEditorState, type Cell, type DocAction, type EditorState, type TabId, type UiAction } from '../model/document.js';
import { EditorHistory } from '../model/history.js';
import { readChapterText, serializeChapter, type ChapterIssue } from '../model/serialize.js';

const UI_ONLY = new Set<UiAction['type']>(['select', 'setTab', 'setBrush', 'setOverlay']);

let bundledSettings: ChapterSettings | undefined;

function bundledChapter(): ChapterSettings {
  if (!bundledSettings) {
    const read = readChapterText(chapterRaw);
    if (!read.ok) {
      throw new Error(read.issues.map((issue) => issue.message).join('; '));
    }
    bundledSettings = read.settings;
  }
  return bundledSettings;
}

/** Tab that owns a problem path when the problem has no tile. */
export function tabForProblem(path: (string | number)[]): TabId | null {
  switch (path[0]) {
    case 'rules':
      return 'rules';
    case 'defenderKits':
    case 'rounds':
    case 'startingInventory':
      return 'inventory';
    case 'easyRewards':
      return 'rewards';
    case 'id':
    case 'title':
    case 'goal':
    case 'rulesetVersion':
      return 'chapter';
    case 'tiles':
      return 'tile';
    default:
      return null;
  }
}

export interface EditorDialog {
  title: string;
  issues?: ChapterIssue[];
  message?: string;
}

export interface EditorController {
  state: EditorState;
  problems: Problem[];
  errorCount: number;
  warningCount: number;
  canUndo: boolean;
  canRedo: boolean;
  pendingDraft: boolean;
  saving: boolean;
  status: string | null;
  dialog: EditorDialog | null;
  dispatch: (action: DocAction | UiAction, groupId?: string) => void;
  undo: () => void;
  redo: () => void;
  openChapterFile: (file: File) => Promise<void>;
  loadBundled: () => void;
  exportChapter: () => void;
  saveChapter: () => Promise<void>;
  resumeDraft: () => void;
  discardDraft: () => void;
  dismissDialog: () => void;
  openProblem: (problem: Problem) => void;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
}

function draftOf(state: EditorState): ChapterDraft {
  return {
    doc: state.doc,
    baseline: state.baseline,
    sourceName: state.sourceName,
    routes: state.routes
  };
}

export function useEditor(): EditorController {
  const historyRef = useRef<EditorHistory | null>(null);
  if (historyRef.current === null) {
    historyRef.current = new EditorHistory(createEditorState(bundledChapter(), 'bundled'));
  }
  const history = historyRef.current;

  const [pendingDraft, setPendingDraft] = useState<ChapterDraft | null>(() => loadDraft());
  const [, bumpVersion] = useState(0);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [dialog, setDialog] = useState<EditorDialog | null>(null);

  const offerPending = useRef(pendingDraft !== null);
  const skipSave = useRef(true);
  const skipNextSave = useRef(false);
  const savingRef = useRef(false);
  const openRef = useRef<(file: File) => void>(() => {});
  const commands = useRef({ undo: () => {}, redo: () => {} });

  const state = history.state;
  const problems = useMemo(
    () => checkChapterSettings(state.doc, { baseline: state.baseline }),
    [state.doc, state.baseline]
  );
  const errorCount = chapterErrors(problems).length;
  const warningCount = problems.length - errorCount;

  function bump(): void {
    bumpVersion((current) => current + 1);
  }

  function noteDocChange(): void {
    offerPending.current = false;
    setPendingDraft(null);
    setStatus(null);
  }

  function dispatch(action: DocAction | UiAction, groupId?: string): void {
    if (!UI_ONLY.has(action.type as UiAction['type'])) noteDocChange();
    history.dispatch(action, groupId);
    bump();
  }

  function undo(): void {
    if (history.past.length === 0) return;
    noteDocChange();
    history.undo();
    bump();
  }

  function redo(): void {
    if (history.future.length === 0) return;
    noteDocChange();
    history.redo();
    bump();
  }

  async function openChapterFile(file: File): Promise<void> {
    const result = await openFile(file);
    if (!result.ok) {
      setDialog({ title: 'Could not open file', issues: result.issues });
      return;
    }
    setDialog(null);
    dispatch({ type: 'load', doc: result.settings, sourceName: file.name || 'draft' });
  }
  openRef.current = (file) => {
    void openChapterFile(file);
  };

  function loadBundled(): void {
    const untouched =
      history.past.length === 0 && history.future.length === 0 && history.state.sourceName === 'bundled';
    if (pendingDraft || untouched) {
      if (pendingDraft) clearDraft();
      skipNextSave.current = true;
    }
    dispatch({ type: 'load', doc: bundledChapter(), sourceName: 'bundled' });
  }

  function exportChapter(): void {
    if (chapterErrors(checkChapterSettings(history.state.doc, { baseline: history.state.baseline })).length > 0) {
      return;
    }
    downloadChapter(serializeChapter(history.state.doc));
  }

  async function saveChapter(): Promise<void> {
    const current = history.state;
    const found = checkChapterSettings(current.doc, { baseline: current.baseline });
    if (chapterErrors(found).length > 0 || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setStatus(null);
    try {
      const result = await saveToRepo(serializeChapter(current.doc));
      if (result.ok) {
        setStatus('Saved chapter-i.json');
        return;
      }
      if ('problems' in result) {
        setDialog({ title: 'Could not save', issues: result.problems });
        return;
      }
      setDialog({ title: 'Could not save', message: result.message });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function resumeDraft(): void {
    const draft = pendingDraft;
    if (!draft) return;
    offerPending.current = false;
    history.dispatch({ type: 'load', doc: draft.doc, sourceName: draft.sourceName });
    history.dispatch({ type: 'setRoutes', routes: draft.routes });
    history.state = { ...history.state, baseline: structuredClone(draft.baseline) };
    setPendingDraft(null);
    setStatus(null);
    setDialog(null);
    bump();
  }

  function discardStoredDraft(): void {
    offerPending.current = false;
    clearDraft();
    setPendingDraft(null);
  }

  function openProblem(problem: Problem): void {
    if (problem.tile) {
      const cell: Cell = { q: problem.tile.q, r: problem.tile.r };
      dispatch({ type: 'select', cells: [cell] });
      return;
    }
    const tab = tabForProblem(problem.path);
    if (tab) dispatch({ type: 'setTab', tab });
  }

  commands.current = { undo, redo };

  useEffect(() => {
    if (skipSave.current || skipNextSave.current) {
      skipSave.current = false;
      skipNextSave.current = false;
      return;
    }
    if (offerPending.current) return;
    saveDraft(draftOf(state));
  }, [state.doc, state.baseline, state.sourceName, state.routes]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      if (event.key.toLowerCase() !== 'z') return;
      if (isTypingTarget(event.target)) return;
      event.preventDefault();
      if (event.shiftKey) commands.current.redo();
      else commands.current.undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const onDragOver = (event: DragEvent) => {
      const types = event.dataTransfer?.types;
      if (!types || ![...types].includes('Files')) return;
      event.preventDefault();
    };
    const onDrop = (event: DragEvent) => {
      const file = event.dataTransfer?.files?.[0];
      if (!file) return;
      event.preventDefault();
      openRef.current(file);
    };
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  return {
    state,
    problems,
    errorCount,
    warningCount,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    pendingDraft: pendingDraft !== null,
    saving,
    status,
    dialog,
    dispatch,
    undo,
    redo,
    openChapterFile,
    loadBundled,
    exportChapter,
    saveChapter,
    resumeDraft,
    discardDraft: discardStoredDraft,
    dismissDialog: () => setDialog(null),
    openProblem
  };
}
