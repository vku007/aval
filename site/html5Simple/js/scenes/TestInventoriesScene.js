/**
 * TestInventoriesScene
 * The Blitz stage at the real 390×844 size, with the storage tables filled
 * from the extended start. The tools canvas edits columns and rows for the
 * player and the enemy. The slot cap is columns times rows.
 */
const INVENTORY_PREVIEW_STACK = {
    stones: 21,
    scissors: 12,
    papers: 12,
    NA_effect_stone: 3,
    NA_effect_scissors: 2,
    NA_effect_papers: 5,
    NT_effect: 3
};

const INVENTORY_PREVIEW_MOVES = ['Stone', 'Scissors', 'Paper'];

class TestInventoriesScene extends Phaser.Scene {
    constructor() {
        super({ key: 'TestInventoriesScene' });
    }

    init() {
        exitTestsCanvas(this);
    }

    create() {
        exitTestsCanvas(this);
        fxEnter(this);
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        this._left = false;
        this.inventoryGrids = resolveInventoryGrids(null);
        this.heatMap = new UiHeatMap(this, {
            x: 0,
            y: 0,
            width: width,
            height: height
        }, { interactive: false });
        const boxes = localAdvancedPanelBoxes(width, height);
        this.panelBoxes = boxes;
        this.stageMarkup = createMarkupLayer(this, boxes);
        const currentTitle = this.stageMarkup.list.find((item) => item.text === 'current turn');
        if (currentTitle) {
            currentTitle.setOrigin(1, 0);
            currentTitle.setPosition(width - 4, currentTitle.y);
        }
        BlitzGameScene.prototype.fitInventoryPanelLabels.call(this, boxes);
        applyCompositeHeatMapDefault(this);
        this.tables = {
            player: this.mountInventorySide('player', ''),
            enemy: this.mountInventorySide('enemy', 'enemy_')
        };
        this.paintInventoryTables();
        this.events.once('shutdown', () => closeEditorTools());
        openEditorTools(this, TestInventoriesToolsScene);
    }

    update(time, delta) {
        if (this.heatMap && typeof this.heatMap.update === 'function') {
            this.heatMap.update(time, delta);
        }
    }

    mountInventorySide(which, prefix) {
        const side = inventorySide(this, which);
        const boxes = this.panelBoxes;
        const lead = prefix || '';
        const items = [];
        const na = [];
        INVENTORY_PREVIEW_MOVES.forEach((moveType) => {
            const spec = which === 'enemy'
                ? enemyInventoryStorageSpec(moveType)
                : inventoryStorageSpec(moveType);
            const key = moveType === 'Stone' ? 'stone' : moveType.toLowerCase();
            const panel = boxes.find((box) => box.label === `${lead}${key}_storage_panel`);
            items.push(this.mountInventoryTable(panel, side.items, {
                name: spec.itemsLabel,
                frame: 'items',
                direction: 'desc',
                shape: 'rectangle'
            }));
            na.push(this.mountInventoryTable(panel, side.na, {
                name: spec.effectsLabel,
                frame: 'na',
                direction: 'asc',
                shape: 'round'
            }));
        });
        const ntPanel = boxes.find((box) => box.label === `${lead}NT_effects_panel`);
        const nt = this.mountInventoryTable(ntPanel, side.nt, {
            name: which === 'enemy' ? 'Enemy NT Effects' : 'NT Effects',
            frame: 'nt',
            direction: 'asc',
            shape: 'round'
        });
        return { items: items, na: na, nt: nt };
    }

    mountInventoryTable(panel, grid, options) {
        if (!panel || !this.heatMap) {
            return null;
        }
        const frame = options.frame === 'nt'
            ? ntEffectsIndicatorFrame(panel)
            : stoneStorageIndicatorFrames(panel)[options.frame === 'na' ? 'right' : 'left'];
        const placed = heatMapIndicatorOptions(this.heatMap, frame);
        return new HmVerticalTableAmountIndicator(this.heatMap, Object.assign({
            name: options.name,
            columns: grid.columns,
            rows: grid.rows,
            fitGap: INVENTORY_FIT_GAP,
            direction: options.direction,
            shape: options.shape
        }, placed));
    }

    setInventoryGrid(which, table, axis, next) {
        const side = this.inventoryGrids && this.inventoryGrids[which];
        const current = side && side[table];
        if (!current) {
            return false;
        }
        const candidate = { columns: current.columns, rows: current.rows };
        candidate[axis] = next;
        const resolved = resolveInventoryTable(candidate, current);
        if (resolved.columns !== candidate.columns || resolved.rows !== candidate.rows) {
            return false;
        }
        side[table] = resolved;
        this.paintInventoryTables();
        return true;
    }

    paintInventoryTables() {
        ['player', 'enemy'].forEach((which) => {
            const side = inventorySide(this, which);
            const book = this.tables && this.tables[which];
            if (!book) {
                return;
            }
            book.items.forEach((indicator, index) => {
                const spec = which === 'enemy'
                    ? enemyInventoryStorageSpec(INVENTORY_PREVIEW_MOVES[index])
                    : inventoryStorageSpec(INVENTORY_PREVIEW_MOVES[index]);
                syncTableAmountIndicator(
                    indicator,
                    side.items,
                    INVENTORY_PREVIEW_STACK[spec.itemKey],
                    0
                );
            });
            book.na.forEach((indicator, index) => {
                const spec = which === 'enemy'
                    ? enemyInventoryStorageSpec(INVENTORY_PREVIEW_MOVES[index])
                    : inventoryStorageSpec(INVENTORY_PREVIEW_MOVES[index]);
                syncTableAmountIndicator(
                    indicator,
                    side.na,
                    INVENTORY_PREVIEW_STACK[spec.effectKey],
                    0
                );
            });
            syncTableAmountIndicator(book.nt, side.nt, INVENTORY_PREVIEW_STACK.NT_effect, 0);
        });
    }

    leave() {
        if (this._left) {
            return;
        }
        this._left = true;
        closeEditorTools();
        fxGoTo(this, 'TestsScene');
    }
}

class TestInventoriesToolsScene extends Phaser.Scene {
    constructor() {
        super({ key: 'TestInventoriesToolsScene' });
    }

    create() {
        this.host = this.game.registry.get('editorHost');
        this.readouts = [];
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        this.add.text(16, 16, 'Inventory', {
            font: `${UI.title}px monospace`,
            fill: '#000000'
        }).setOrigin(0, 0);
        this.status = this.add.text(16, 52, 'Cap is columns times rows.', {
            font: `${UI.body}px monospace`,
            fill: '#666666',
            wordWrap: { width: width - 32 }
        }).setOrigin(0, 0);

        const backH = UI.menuBtnH;
        const top = 96;
        const gap = 12;
        const panelH = height - top - backH - 24;
        const panelW = Math.floor((width - 16 * 2 - gap) / 2);
        this.buildSidePanel(16, top, panelW, panelH, 'PLAYER', 'player');
        this.buildSidePanel(16 + panelW + gap, top, panelW, panelH, 'ENEMY', 'enemy');
        this.stepButton(width / 2, height - 12 - backH / 2, Math.min(200, width - 32), backH, 'BACK', () => {
            if (this.host && typeof this.host.leave === 'function') {
                this.host.leave();
            }
        });
        this.refresh();
    }

    buildSidePanel(x, y, width, height, title, which) {
        const graphics = this.add.graphics();
        graphics.lineStyle(2, 0x000000, 1);
        graphics.strokeRect(x, y, width, height);
        this.add.text(x + 12, y + 10, title, {
            font: `${UI.heading}px monospace`,
            fill: '#000000'
        }).setOrigin(0, 0);
        const tables = [
            { key: 'items', label: 'Items' },
            { key: 'na', label: 'NA' },
            { key: 'nt', label: 'Core' }
        ];
        const blockTop = y + 44;
        const blockH = (y + height - 12 - blockTop) / tables.length;
        tables.forEach((table, index) => {
            const blockY = blockTop + index * blockH;
            this.add.text(x + 12, blockY + 4, table.label, {
                font: `${UI.body}px monospace`,
                fill: '#000000'
            }).setOrigin(0, 0);
            this.buildAxisRow(x + 12, blockY + blockH * 0.38, width - 24, which, table.key, 'columns', 'Columns');
            this.buildAxisRow(x + 12, blockY + blockH * 0.68, width - 24, which, table.key, 'rows', 'Rows');
            const cap = this.add.text(x + 12, blockY + blockH * 0.88, '', {
                font: `${UI.small}px monospace`,
                fill: '#666666'
            }).setOrigin(0, 0);
            this.readouts.push({
                text: cap,
                get: () => {
                    const grid = this.grid(which, table.key);
                    return grid ? `Cap ${grid.columns * grid.rows}` : '';
                }
            });
        });
    }

    buildAxisRow(x, y, width, which, table, axis, label) {
        this.add.text(x, y, label, {
            font: `${UI.small}px monospace`,
            fill: '#000000'
        }).setOrigin(0, 0.5);
        const value = this.add.text(x + width - 108, y, '', {
            font: `${UI.body}px monospace`,
            fill: '#000000'
        }).setOrigin(0.5, 0.5);
        this.readouts.push({
            text: value,
            get: () => {
                const grid = this.grid(which, table);
                return grid ? String(grid[axis]) : '';
            }
        });
        this.stepButton(x + width - 72, y, 36, 32, '−', () => this.step(which, table, axis, -1));
        this.stepButton(x + width - 28, y, 36, 32, '+', () => this.step(which, table, axis, 1));
    }

    grid(which, table) {
        const host = this.host;
        const side = host && host.inventoryGrids && host.inventoryGrids[which];
        return side && side[table];
    }

    step(which, table, axis, delta) {
        const grid = this.grid(which, table);
        if (!grid || !this.host || typeof this.host.setInventoryGrid !== 'function') {
            return;
        }
        const accepted = this.host.setInventoryGrid(which, table, axis, grid[axis] + delta);
        if (this.status) {
            this.status.setText(accepted
                ? 'Cap is columns times rows.'
                : 'Stays inside 1–12, and the cap stays at most 64.');
        }
        this.refresh();
    }

    refresh() {
        this.readouts.forEach((item) => {
            item.text.setText(item.get());
        });
    }

    stepButton(x, y, width, height, label, onClick) {
        const btn = this.add.container(x, y);
        const bg = this.add.graphics();
        bg.lineStyle(2, 0x000000, 1);
        bg.strokeRect(-width / 2, -height / 2, width, height);
        const text = this.add.text(0, 0, label, {
            font: `${UI.body}px monospace`,
            fill: '#000000'
        }).setOrigin(0.5);
        btn.add([bg, text]);
        const hit = new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height);
        btn.setInteractive(hit, Phaser.Geom.Rectangle.Contains, { useHandCursor: true });
        btn.on('pointerdown', () => onClick());
        return btn;
    }
}
