/**
 * UIEditorScene
 * One UiHeatMap on Stage. UiHotBalls and UiHotRods stamp into it.
 * Effects edits the map; Objects picks an emitter; Props edits that emitter.
 */
class UIEditorScene extends Phaser.Scene {
    constructor() {
        super({ key: 'UIEditorScene' });
        console.log('[UIEditorScene] Constructor called');
    }

    init() {
        enterTestsCanvas(this);
    }

    create() {
        enterTestsCanvas(this);
        console.log('[UIEditorScene] create() started');
        fxEnter(this);
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        this.add.text(width / 2, 40, 'UI Editor', {
            font: `${UI.title}px monospace`,
            fill: '#000000'
        }).setOrigin(0.5);

        this.editorStatus = this.add.text(width / 2, 68, 'Shared heat map · tap Stage to set a rod end or orbit a ball', {
            font: `${UI.body}px monospace`,
            fill: '#666666'
        }).setOrigin(0.5);

        const backH = UI.menuBtnH;
        const pad = UI.pad;
        const gap = 10;
        const gridTop = 88;
        const gridBottom = height - pad - backH - 16;
        const gridW = width - pad * 2;
        const gridH = gridBottom - gridTop;
        const panelW = Math.floor((gridW - gap) / 2);
        const panelH = Math.floor((gridH - gap) / 2);
        const col2 = pad + panelW + gap;
        const row2 = gridTop + panelH + gap;

        this.stagePanel = this.createEditorPanel(pad, gridTop, panelW, panelH, 'STAGE');
        this.effectsPanel = this.createEditorPanel(col2, gridTop, panelW, panelH, 'EFFECTS');
        this.objectsPanel = this.createEditorPanel(pad, row2, panelW, panelH, 'OBJECTS');
        this.propsPanel = this.createEditorPanel(col2, row2, panelW, panelH, 'PROPS');

        const stageInset = 2;
        const stageLabelH = 28;
        this.heatMap = new UiHeatMap(this, {
            x: this.stagePanel.x + stageInset,
            y: this.stagePanel.y + stageLabelH,
            width: this.stagePanel.width - stageInset * 2,
            height: this.stagePanel.height - stageLabelH - stageInset
        });
        this.heatMap.onTap = (cell) => {
            if (this.selectedObject && typeof this.selectedObject.retarget === 'function') {
                this.selectedObject.retarget(cell);
            }
        };
        this.heatMap.createEffectsEditor(this.effectsPanel);

        this.balls = [
            new UiHotBall(this.heatMap, {
                name: 'Hot Ball 1',
                params: { phase: 0, tiltX: 0, tiltY: 0, tiltZ: 0, orbitRadius: 16 }
            }),
            new UiHotBall(this.heatMap, {
                name: 'Hot Ball 2',
                params: { phase: 90, tiltX: 90, tiltY: 0, tiltZ: 0, orbitRadius: 16 }
            }),
            new UiHotBall(this.heatMap, {
                name: 'Hot Ball 3',
                params: { phase: 180, tiltX: 0, tiltY: 90, tiltZ: 0, orbitRadius: 16 }
            })
        ];
        this.rods = [
            new UiHotRod(this.heatMap, {
                name: 'Hot Rod 1',
                params: { energy: 1.5, thickness: 4, delay: 0.4, startAngle: 0, endAngle: 40 }
            }),
            new UiHotRod(this.heatMap, {
                name: 'Hot Rod 2',
                params: { energy: 1.2, thickness: 3, delay: 0.6, startAngle: 60, endAngle: 120 }
            }),
            new UiHotRod(this.heatMap, {
                name: 'Hot Rod 3',
                params: { energy: 1.8, thickness: 5, delay: 0.2, startAngle: 120, endAngle: 20 }
            })
        ];
        this.objects = this.balls.concat(this.rods);
        this.selectedObject = this.balls[0];
        this.createObjectsList(this.objectsPanel);
        this.createFileBar(this.objectsPanel);
        this.ballProps = new UiPropEditor(this, this.propsPanel, {
            getTarget: () => this.selectedObject && this.selectedObject.kind === 'hot-ball'
                ? this.selectedObject
                : null,
            tabs: UiHotBall.PROP_TABS
        });
        this.rodProps = new UiPropEditor(this, this.propsPanel, {
            getTarget: () => this.selectedObject && this.selectedObject.kind === 'hot-rod'
                ? this.selectedObject
                : null,
            tabs: UiHotRod.PROP_TABS,
            rowH: 24,
            active: false
        });

        this.createMenuButton(
            width / 2,
            height - pad - backH / 2,
            'BACK',
            () => this.onBackClick(),
            backH
        );
    }

    update(time, delta) {
        if (this.heatMap && typeof this.heatMap.update === 'function') {
            this.heatMap.update(time, delta);
        }
        this.refreshActiveProps();
    }

    refreshActiveProps() {
        const editor = this.activePropEditor();
        if (editor) {
            editor.refreshValues();
        }
    }

    activePropEditor() {
        if (this.selectedObject && this.selectedObject.kind === 'hot-rod') {
            return this.rodProps;
        }
        return this.ballProps;
    }

    syncPropEditors() {
        const isRod = !!(this.selectedObject && this.selectedObject.kind === 'hot-rod');
        if (this.ballProps) {
            this.ballProps.setActive(!isRod);
        }
        if (this.rodProps) {
            this.rodProps.setActive(isRod);
        }
    }

    createObjectsList(panel) {
        const rowH = 28;
        const gap = 4;
        const top = panel.y + 32;
        this.objectRows = this.objects.map((object, index) => {
            const y = top + index * (rowH + gap);
            const row = this.createObjectRow(
                panel.x + 8,
                y,
                panel.width - 16,
                rowH,
                object.name,
                () => this.selectObject(object)
            );
            row.object = object;
            return row;
        });
        this.refreshObjectRows();
    }

    selectObject(object) {
        this.selectedObject = object;
        this.refreshObjectRows();
        this.syncPropEditors();
    }

    refreshObjectRows() {
        if (!this.objectRows) {
            return;
        }
        this.objectRows.forEach((row) => {
            if (row.object && row.buttonText) {
                row.buttonText.setText(row.object.name);
            }
            this.redrawObjectRow(row, row.object === this.selectedObject);
        });
    }

    createObjectRow(x, y, width, height, label, callback) {
        const btn = this.add.container(x + width / 2, y + height / 2);
        const bg = this.add.graphics();
        const text = this.add.text(0, 0, label, {
            font: `${UI.body}px monospace`,
            fill: '#000000'
        }).setOrigin(0.5);
        btn.add([bg, text]);
        btn.buttonBg = bg;
        btn.buttonText = text;
        btn.rowWidth = width;
        btn.rowHeight = height;
        const hitArea = new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height);
        btn.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains, { useHandCursor: true });
        bindPress(this, btn, { onClick: callback });
        this.redrawObjectRow(btn, false);
        return btn;
    }

    redrawObjectRow(btn, selected) {
        const w = btn.rowWidth;
        const h = btn.rowHeight;
        const bg = btn.buttonBg;
        bg.clear();
        if (selected) {
            bg.fillStyle(0x000000, 1);
            bg.fillRect(-w / 2, -h / 2, w, h);
            btn.buttonText.setColor('#ffffff');
        } else {
            bg.lineStyle(2, 0x000000, 1);
            bg.strokeRect(-w / 2, -h / 2, w, h);
            btn.buttonText.setColor('#000000');
        }
    }

    createFileBar(panel) {
        const btnH = 36;
        const gap = 8;
        const inset = 8;
        const y = panel.y + panel.height - inset - btnH / 2;
        const innerW = panel.width - inset * 2;
        const btnW = Math.floor((innerW - gap) / 2);
        const startX = panel.x + inset + btnW / 2;
        this.createFileButton(startX, y, btnW, btnH, 'SAVE', () => this.onSaveClick());
        this.createFileButton(startX + btnW + gap, y, btnW, btnH, 'LOAD', () => this.onLoadClick());
        this.fileBusy = false;
    }

    createFileButton(x, y, btnWidth, btnHeight, label, callback) {
        const btn = this.add.container(x, y);
        const bg = this.add.graphics();
        bg.lineStyle(2, 0x000000, 1);
        bg.strokeRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight);
        const text = this.add.text(0, 0, label, {
            font: `${UI.body}px monospace`,
            fill: '#000000'
        }).setOrigin(0.5);
        btn.add([bg, text]);
        btn.buttonText = text;
        const hitArea = new Phaser.Geom.Rectangle(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight);
        btn.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains, { useHandCursor: true });
        btn.on('pointerdown', () => callback());
        return btn;
    }

    setEditorStatus(message) {
        if (this.editorStatus) {
            this.editorStatus.setText(message || '');
        }
    }

    onSaveClick() {
        try {
            const bytes = saveUiEditorPresetFile(serializeUiEditor(this.heatMap, this.balls, this.rods));
            this.setEditorStatus(`Saved ${bytes} bytes — check Downloads`);
        } catch (error) {
            console.warn('[UIEditorScene] Save failed', error);
            this.setEditorStatus('Save failed');
        }
    }

    onLoadClick() {
        if (this.fileBusy) {
            return;
        }
        this.fileBusy = true;
        loadUiEditorPresetFile().then((data) => {
            applyUiEditorPreset(this.heatMap, this.balls, data, this.rods);
            this.refreshObjectRows();
            this.refreshActiveProps();
            this.setEditorStatus('Loaded');
        }).catch((error) => {
            if (error && error.name === 'AbortError') {
                return;
            }
            console.warn('[UIEditorScene] Load failed', error);
            this.setEditorStatus(error && error.message ? error.message : 'Load failed');
        }).finally(() => {
            this.fileBusy = false;
        });
    }

    createEditorPanel(x, y, width, height, label) {
        const frame = this.add.graphics();
        frame.lineStyle(2, 0x000000, 1);
        frame.strokeRect(x, y, width, height);

        this.add.text(x + 12, y + 12, label, {
            font: `bold ${UI.small}px monospace`,
            fill: '#333333'
        }).setOrigin(0, 0);

        return { x, y, width, height, frame, label };
    }

    onBackClick() {
        console.log('[UIEditorScene] Back clicked');
        fxGoTo(this, 'TestsScene');
    }

    createMenuButton(x, y, label, callback, btnHeight = UI.menuBtnH) {
        const btn = this.add.container(x, y);
        const btnWidth = UI.menuBtnW;

        const bg = this.add.graphics();
        bg.lineStyle(2, 0x000000, 1);
        bg.strokeRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight);

        const text = this.add.text(0, 0, label, {
            font: `${UI.heading}px monospace`,
            fill: '#000000'
        }).setOrigin(0.5);

        btn.add([bg, text]);
        btn.buttonText = text;

        const hitArea = new Phaser.Geom.Rectangle(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight);
        btn.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains, { useHandCursor: true });
        bindPress(this, btn, { onClick: callback, particles: true });
        return btn;
    }
}
