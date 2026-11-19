import type { ChapterSettings } from '@apiv2/domain/campaign/ChapterSettingsSchema.js';
import { reduce, type DocAction, type EditorState, type UiAction } from './document.js';

const UI_TYPES = new Set<UiAction['type']>(['load', 'select', 'setTab', 'setBrush', 'setOverlay', 'setRoutes']);

function isDocAction(action: DocAction | UiAction): action is DocAction {
  return !UI_TYPES.has(action.type as UiAction['type']);
}

/**
 * Undo stack over chapter documents.
 * A group stays open across UI actions. The next doc action with another id, or none, closes it.
 */
export class EditorHistory {
  past: ChapterSettings[] = [];
  future: ChapterSettings[] = [];
  state: EditorState;
  private group: string | undefined;

  constructor(state: EditorState) {
    this.state = state;
  }

  dispatch(action: DocAction | UiAction, groupId?: string): void {
    if (action.type === 'load') {
      this.past = [];
      this.future = [];
      this.group = undefined;
      this.state = reduce(this.state, action);
      return;
    }
    if (!isDocAction(action)) {
      this.state = reduce(this.state, action);
      return;
    }
    const sameGroup = groupId !== undefined && groupId === this.group;
    if (!sameGroup) {
      this.past = [...this.past, structuredClone(this.state.doc)];
      this.future = [];
      this.group = groupId;
    }
    this.state = reduce(this.state, action);
  }

  undo(): void {
    const previous = this.past.at(-1);
    if (!previous) return;
    this.future = [...this.future, structuredClone(this.state.doc)];
    this.past = this.past.slice(0, -1);
    this.group = undefined;
    this.state = { ...this.state, doc: previous };
  }

  redo(): void {
    const next = this.future.at(-1);
    if (!next) return;
    this.past = [...this.past, structuredClone(this.state.doc)];
    this.future = this.future.slice(0, -1);
    this.group = undefined;
    this.state = { ...this.state, doc: next };
  }
}
