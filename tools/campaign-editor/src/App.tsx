import { useState } from 'preact/hooks';
import type { Cell, TabId } from './model/document.js';
import { HexMap } from './map/HexMap.js';
import { MapTools, SelectionKitActions } from './map/MapTools.js';
import { selectionAfterClick, useBrush, useClearSelectionOnEscape } from './map/useBrush.js';
import { ChapterPanel } from './panels/ChapterPanel.js';
import { InventoryPanel } from './panels/InventoryPanel.js';
import { ProblemsPanel } from './panels/ProblemsPanel.js';
import { RewardsPanel } from './panels/RewardsPanel.js';
import { RoutesPanel } from './panels/RoutesPanel.js';
import { RulesPanel } from './panels/RulesPanel.js';
import { TilePanel } from './panels/TilePanel.js';
import { incompleteRouteCount } from './routes/walk.js';
import { useEditor, type EditorDialog } from './state/useEditor.js';
import { TopBar } from './TopBar.js';

const TABS: { id: TabId; label: string }[] = [
  { id: 'tile', label: 'Tile' },
  { id: 'chapter', label: 'Chapter' },
  { id: 'rules', label: 'Rules' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'rewards', label: 'Rewards' },
  { id: 'routes', label: 'Routes' },
  { id: 'problems', label: 'Problems' }
];

export function App() {
  const editor = useEditor();
  const [hoverReveal, setHoverReveal] = useState(true);
  const onCellPointer = useBrush(editor.state.brush, editor.state.doc.tiles, editor.dispatch);
  useClearSelectionOnEscape(editor.dispatch);
  const failingRoutes = incompleteRouteCount(editor.state.doc, editor.state.routes);
  const tab = TABS.find((item) => item.id === editor.state.tab) ?? TABS[0];
  const tabLabel = tab.id === 'routes' ? `Routes ${failingRoutes}` : tab.label;

  return (
    <div class="editor">
      <TopBar
        sourceName={editor.state.sourceName}
        errorCount={editor.errorCount}
        warningCount={editor.warningCount}
        canUndo={editor.canUndo}
        canRedo={editor.canRedo}
        canExport={editor.errorCount === 0}
        saving={editor.saving}
        status={editor.status}
        pendingDraft={editor.pendingDraft}
        onOpenFile={(file) => {
          void editor.openChapterFile(file);
        }}
        onBundled={editor.loadBundled}
        onUndo={editor.undo}
        onRedo={editor.redo}
        onSave={() => {
          void editor.saveChapter();
        }}
        onExport={editor.exportChapter}
        onResumeDraft={editor.resumeDraft}
        onDiscardDraft={editor.discardDraft}
      />
      {editor.dialog && <IssuesDialog dialog={editor.dialog} onClose={editor.dismissDialog} />}
      <div class="workspace">
        <section class="map-pane" aria-label="Map">
          <div class="map-canvas">
            <HexMap
              settings={editor.state.doc}
              selection={editor.state.selection}
              problems={editor.problems}
              overlay={editor.state.overlay}
              hoverReveal={hoverReveal}
              onCellClick={(cell, meta) => selectCell(editor.dispatch, editor.state.selection, cell, meta.shift)}
              onCellPointer={onCellPointer}
            />
          </div>
          <MapTools
            brush={editor.state.brush}
            overlay={editor.state.overlay}
            hoverReveal={hoverReveal}
            onBrush={(brush) => editor.dispatch({ type: 'setBrush', brush })}
            onOverlay={(overlay) => editor.dispatch({ type: 'setOverlay', overlay })}
            onHoverReveal={setHoverReveal}
          />
        </section>
        <section class="side" aria-label="Editor">
          <div class="tabs" role="tablist">
            {TABS.map((item) => (
              <button
                type="button"
                role="tab"
                key={item.id}
                aria-selected={item.id === editor.state.tab}
                onClick={() => editor.dispatch({ type: 'setTab', tab: item.id })}
              >
                {item.id === 'routes' ? `Routes ${failingRoutes}` : item.label}
              </button>
            ))}
          </div>
          <div class="panel" role="tabpanel" aria-label={tabLabel}>
            {editor.state.tab === 'tile' && (
              <>
                <SelectionKitActions
                  settings={editor.state.doc}
                  selection={editor.state.selection}
                  onAction={(action) => editor.dispatch(action)}
                />
                <TilePanel
                  settings={editor.state.doc}
                  selection={editor.state.selection}
                  onAction={(action) => editor.dispatch(action)}
                />
              </>
            )}
            {editor.state.tab === 'chapter' && (
              <ChapterPanel settings={editor.state.doc} onAction={(action) => editor.dispatch(action)} />
            )}
            {editor.state.tab === 'rules' && (
              <RulesPanel settings={editor.state.doc} onAction={(action) => editor.dispatch(action)} />
            )}
            {editor.state.tab === 'inventory' && (
              <InventoryPanel
                settings={editor.state.doc}
                onAction={(action) => editor.dispatch(action)}
                onSelect={(cell) => editor.dispatch({ type: 'select', cells: [cell] })}
              />
            )}
            {editor.state.tab === 'rewards' && (
              <RewardsPanel settings={editor.state.doc} onAction={(action) => editor.dispatch(action)} />
            )}
            {editor.state.tab === 'routes' && (
              <RoutesPanel
                settings={editor.state.doc}
                routes={editor.state.routes}
                selection={editor.state.selection}
                onRoutes={(routes) => editor.dispatch({ type: 'setRoutes', routes })}
              />
            )}
            {editor.state.tab === 'problems' && (
              <ProblemsPanel
                problems={editor.problems}
                selection={editor.state.selection}
                onProblem={editor.openProblem}
              />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function selectCell(
  dispatch: (action: { type: 'select'; cells: Cell[] }) => void,
  selection: Cell[],
  cell: Cell,
  shift: boolean
): void {
  dispatch({ type: 'select', cells: selectionAfterClick(selection, cell, shift) });
}

function IssuesDialog({ dialog, onClose }: { dialog: EditorDialog; onClose: () => void }) {
  return (
    <div class="modal-backdrop">
      <div class="modal" role="dialog" aria-modal="true" aria-label={dialog.title}>
        <h2>{dialog.title}</h2>
        {dialog.issues ? (
          <ul>
            {dialog.issues.map((issue, index) => (
              <li key={index}>
                {issue.path.length > 0 ? `${issue.path.map((part) => String(part)).join('.')}: ` : ''}
                {issue.message}
              </li>
            ))}
          </ul>
        ) : (
          <p>{dialog.message}</p>
        )}
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
