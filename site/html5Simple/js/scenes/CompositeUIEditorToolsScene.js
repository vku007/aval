/**
 * CompositeUIEditorToolsScene
 * Copy of UIEditorToolsScene. Second canvas: effects, props, and the object list.
 * The stage stays on the main game canvas.
 */
class CompositeUIEditorToolsScene extends Phaser.Scene {
    constructor() {
        super({ key: 'CompositeUIEditorToolsScene' });
    }

    get heatMap() {
        return this.host.heatMap;
    }

    get balls() {
        return this.host.balls;
    }

    get rods() {
        return this.host.rods;
    }

    get highlighters() {
        return this.host.highlighters;
    }

    get shards() {
        return this.host.shards;
    }

    get sheets() {
        return this.host.sheets;
    }

    get objects() {
        return this.host.objects;
    }

    get selectedObject() {
        return this.host.selectedObject;
    }

    set selectedObject(value) {
        this.host.selectedObject = value;
    }

    create() {
        this.host = this.game.registry.get('editorHost');
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        const gap = 10;
        const colW = Math.floor((width - gap) / 2);
        const colX = 0;
        const objX = colW + gap;
        const objW = width - objX;

        const title = this.add.text(colX + 12, 18, 'Composite UI Editor', {
            font: `${UI.title}px monospace`,
            fill: '#000000'
        }).setOrigin(0, 0);
        const maxTitleW = colW - 24;
        if (title.width > maxTitleW) {
            const size = Math.max(16, Math.floor(UI.title * maxTitleW / title.width));
            title.setStyle({
                font: `${size}px monospace`,
                fill: '#000000'
            });
        }

        this.editorStatus = this.add.text(colX + 12, 50, 'Tap Stage to move the selected object', {
            font: `${UI.body}px monospace`,
            fill: '#666666',
            wordWrap: { width: colW - 24 }
        }).setOrigin(0, 0);

        const backH = UI.menuBtnH;
        const headerH = 84;
        const midTop = headerH;
        const midBottom = height - 12 - backH - 12;
        const midH = midBottom - midTop;
        const effectsH = Math.round(midH * 0.42);
        const propsY = midTop + effectsH + gap;
        const propsH = midBottom - propsY;

        this.effectsPanel = this.createEditorPanel(colX, midTop, colW, effectsH, 'EFFECTS');
        this.propsPanel = this.createEditorPanel(colX, propsY, colW, propsH, 'PROPS');
        this.objectsPanel = this.createEditorPanel(objX, 0, objW, height, '');
        this.objectsBody = this.add.container(0, 0);
        this.transitionsBody = this.add.container(0, 0);
        this.sideTab = 'objects';
        this.transitionTab = 'add';
        this.createSideTabs(this.objectsPanel);
        this.heatMap.createEffectsEditor(this.effectsPanel, this);
        this.createObjectsList(this.objectsPanel);
        this.createFileBar(this.objectsPanel);
        this.createTransitionsPanel(this.objectsPanel);
        this.createAddEditors();
        this.setSideTab('objects');
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
        this.highlightProps = new UiPropEditor(this, this.propsPanel, {
            getTarget: () => this.selectedObject && this.selectedObject.kind === 'back-highlight'
                ? this.selectedObject
                : null,
            tabs: UiBackHighlighter.PROP_TABS,
            rowH: 24,
            active: false
        });
        this.stoneProps = new UiPropEditor(this, this.propsPanel, {
            getTarget: () => this.selectedObject && this.selectedObject.kind === 'hot-map-stone'
                ? this.selectedObject
                : null,
            tabs: HotMapUiStone.PROP_TABS,
            rowH: 24,
            active: false
        });
        this.scissorProps = new UiPropEditor(this, this.propsPanel, {
            getTarget: () => this.selectedObject && this.selectedObject.kind === 'hot-map-scissor'
                ? this.selectedObject
                : null,
            tabs: HotMapUiScissor.PROP_TABS,
            rowH: 24,
            active: false
        });
        this.paperProps = new UiPropEditor(this, this.propsPanel, {
            getTarget: () => this.selectedObject && this.selectedObject.kind === 'hot-map-paper'
                ? this.selectedObject
                : null,
            tabs: HotMapUiPaper.PROP_TABS,
            rowH: 24,
            active: false
        });
        this.sheetProps = new UiPropEditor(this, this.propsPanel, {
            getTarget: () => this.selectedObject && this.selectedObject.kind === 'sheet'
                ? this.selectedObject
                : null,
            tabs: UiSheet.PROP_TABS,
            rowH: 24,
            active: false
        });
        this.shardProps = new UiPropEditor(this, this.propsPanel, {
            getTarget: () => this.selectedObject && this.selectedObject.kind === 'shard'
                ? this.selectedObject
                : null,
            tabs: UiShard.PROP_TABS,
            rowH: 24,
            active: false
        });
        if (this.host.stone) {
            this.host.stone.onPartAdded = (object) => this.noteStonePart(object, true);
            this.host.stone.onPartRemoved = (object) => this.noteStonePart(object, false);
        }
        if (this.host.scissor) {
            this.host.scissor.onPartAdded = (object) => this.noteScissorPart(object, true);
            this.host.scissor.onPartRemoved = (object) => this.noteScissorPart(object, false);
        }
        if (this.host.paper) {
            this.host.paper.onPartAdded = (object) => this.notePaperPart(object, true);
            this.host.paper.onPartRemoved = (object) => this.notePaperPart(object, false);
        }
        this.syncPropEditors();
        this.createMenuButton(
            colX + colW / 2,
            height - 12 - backH / 2,
            'BACK',
            () => this.onBackClick(),
            backH
        );
    }

    update() {
        this.refreshActiveProps();
    }

    refreshActiveProps() {
        const editor = this.activePropEditor();
        if (editor) {
            editor.refreshValues();
        }
        [this.stoneAddProps, this.scissorAddProps, this.paperAddProps].forEach((addEditor) => {
            if (addEditor && addEditor.active) {
                addEditor.refreshValues();
            }
        });
    }

    activePropEditor() {
        const kind = this.selectedObject && this.selectedObject.kind;
        if (kind === 'hot-rod') {
            return this.rodProps;
        }
        if (kind === 'back-highlight') {
            return this.highlightProps;
        }
        if (kind === 'hot-ball') {
            return this.ballProps;
        }
        if (kind === 'hot-map-stone') {
            return this.stoneProps;
        }
        if (kind === 'hot-map-scissor') {
            return this.scissorProps;
        }
        if (kind === 'hot-map-paper') {
            return this.paperProps;
        }
        if (kind === 'shard') {
            return this.shardProps;
        }
        if (kind === 'sheet') {
            return this.sheetProps;
        }
        return null;
    }

    syncPropEditors() {
        const kind = this.selectedObject && this.selectedObject.kind;
        if (this.ballProps) {
            this.ballProps.setActive(kind === 'hot-ball');
        }
        if (this.rodProps) {
            this.rodProps.setActive(kind === 'hot-rod');
        }
        if (this.highlightProps) {
            this.highlightProps.setActive(kind === 'back-highlight');
        }
        if (this.stoneProps) {
            this.stoneProps.setActive(kind === 'hot-map-stone');
        }
        if (this.scissorProps) {
            this.scissorProps.setActive(kind === 'hot-map-scissor');
        }
        if (this.paperProps) {
            this.paperProps.setActive(kind === 'hot-map-paper');
        }
        if (this.shardProps) {
            this.shardProps.setActive(kind === 'shard');
        }
        if (this.sheetProps) {
            this.sheetProps.setActive(kind === 'sheet');
        }
        this.syncAddEditors();
    }

    addItemTarget(kind) {
        const selected = this.selectedObject;
        if (!selected) {
            return null;
        }
        let group = null;
        if (typeof selected.addItem === 'function') {
            group = selected;
        } else {
            const groups = [
                this.host && this.host.stone,
                this.host && this.host.scissor,
                this.host && this.host.paper
            ];
            group = groups.find((item) => (
                item && item.parts && item.parts.some((part) => part.object === selected)
            )) || null;
        }
        if (!group || (kind && group.kind !== kind)) {
            return null;
        }
        return group;
    }

    syncAddEditors() {
        if (!this.stoneAddProps) {
            return;
        }
        const show = this.sideTab === 'transitions' && this.transitionTab === 'add';
        const target = show ? this.addItemTarget() : null;
        const kind = target && target.kind;
        this.stoneAddProps.setActive(kind === 'hot-map-stone');
        this.scissorAddProps.setActive(kind === 'hot-map-scissor');
        this.paperAddProps.setActive(kind === 'hot-map-paper');
    }

    createSideTabs(panel) {
        const tabs = [
            { id: 'objects', label: 'OBJECTS', width: 96 },
            { id: 'transitions', label: 'TRANSITIONS', width: 128 }
        ];
        const tabH = 28;
        const tabGap = 6;
        const tabY = panel.y + 8 + tabH / 2;
        this.sideTabBtns = {};
        let x = panel.x + 12;
        tabs.forEach((tab) => {
            const btn = this.createPanelTab(x + tab.width / 2, tabY, tab.width, tabH, tab.label, () => {
                this.setSideTab(tab.id);
            });
            this.sideTabBtns[tab.id] = btn;
            x += tab.width + tabGap;
        });
    }

    setSideTab(id) {
        this.sideTab = id;
        const objectsOn = id === 'objects';
        this.objectsBody.setVisible(objectsOn);
        this.transitionsBody.setVisible(!objectsOn);
        this.setTreeInputEnabled(this.objectsBody, objectsOn);
        this.setTreeInputEnabled(this.transitionsBody, !objectsOn);
        if (objectsOn) {
            this.syncObjectRowInput();
            this.redrawObjectScrollbar();
        } else {
            this.setTransitionTab(this.transitionTab);
        }
        Object.keys(this.sideTabBtns).forEach((key) => {
            this.redrawPanelTab(this.sideTabBtns[key], key === id);
        });
        this.syncAddEditors();
    }

    createTransitionsPanel(panel) {
        const tabs = [
            { id: 'add', label: 'ADD' },
            { id: 'remove', label: 'REMOVE' },
            { id: 'hit', label: 'HIT' },
            { id: 'break', label: 'BREAK' }
        ];
        const tabH = 28;
        const tabGap = 6;
        const inset = 12;
        const room = panel.width - inset * 2;
        const tabW = Math.floor((room - tabGap * (tabs.length - 1)) / tabs.length);
        const tabY = panel.y + 8 + tabH + 8 + tabH / 2;
        this.transitionTabBtns = {};
        this.transitionBodies = {};
        tabs.forEach((tab, index) => {
            const tabX = panel.x + inset + tabW / 2 + index * (tabW + tabGap);
            const btn = this.createPanelTab(tabX, tabY, tabW, tabH, tab.label, () => {
                this.setTransitionTab(tab.id);
            });
            this.transitionsBody.add(btn);
            this.transitionTabBtns[tab.id] = btn;
            const body = this.add.container(0, 0);
            this.transitionsBody.add(body);
            this.transitionBodies[tab.id] = body;
        });
        const contentTop = panel.y + 8 + tabH + 8 + tabH + 6;
        this.addPanel = {
            x: panel.x,
            y: contentTop,
            width: panel.width,
            height: panel.height - (contentTop - panel.y)
        };
        this.setTransitionTab(this.transitionTab);
    }

    createAddEditors() {
        const panel = this.addPanel;
        const rowH = 24;
        this.stoneAddProps = new UiPropEditor(this, panel, {
            getTarget: () => this.addItemTarget('hot-map-stone'),
            tabs: HotMapUiStone.ADD_TABS,
            rowH: rowH,
            active: false
        });
        this.scissorAddProps = new UiPropEditor(this, panel, {
            getTarget: () => this.addItemTarget('hot-map-scissor'),
            tabs: HotMapUiScissor.ADD_TABS,
            rowH: rowH,
            active: false
        });
        this.paperAddProps = new UiPropEditor(this, panel, {
            getTarget: () => this.addItemTarget('hot-map-paper'),
            tabs: HotMapUiPaper.ADD_TABS,
            rowH: rowH,
            active: false
        });
    }

    setTransitionTab(id) {
        this.transitionTab = id;
        const shown = this.sideTab === 'transitions';
        Object.keys(this.transitionBodies).forEach((key) => {
            const on = shown && key === id;
            this.transitionBodies[key].setVisible(key === id);
            this.setTreeInputEnabled(this.transitionBodies[key], on);
        });
        Object.keys(this.transitionTabBtns).forEach((key) => {
            const btn = this.transitionTabBtns[key];
            if (btn.input) {
                btn.input.enabled = shown;
            }
            this.redrawPanelTab(btn, key === id);
        });
        this.syncAddEditors();
    }

    createPanelTab(x, y, btnWidth, btnHeight, label, callback) {
        const btn = this.add.container(x, y);
        const bg = this.add.graphics();
        const text = this.add.text(0, 0, label, {
            font: `${UI.small}px monospace`,
            fill: '#000000'
        }).setOrigin(0.5);
        btn.add([bg, text]);
        btn.buttonBg = bg;
        btn.buttonText = text;
        btn.tabWidth = btnWidth;
        btn.tabHeight = btnHeight;
        const hitArea = new Phaser.Geom.Rectangle(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight);
        btn.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains, { useHandCursor: true });
        bindPress(this, btn, { onClick: callback });
        this.redrawPanelTab(btn, false);
        return btn;
    }

    redrawPanelTab(btn, selected) {
        const w = btn.tabWidth;
        const h = btn.tabHeight;
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

    setTreeInputEnabled(node, enabled) {
        if (!node) {
            return;
        }
        if (node.input) {
            node.input.enabled = enabled;
        }
        if (node.list) {
            node.list.forEach((child) => this.setTreeInputEnabled(child, enabled));
        }
    }

    createObjectsList(panel) {
        const inset = 8;
        const fileH = 36;
        const headerH = 44;
        const viewX = panel.x + inset;
        const viewY = panel.y + headerH;
        const viewW = panel.width - inset * 2;
        const viewH = panel.height - headerH - inset - fileH - 8;
        const content = this.add.container(viewX, viewY);
        this.objectsBody.add(content);
        const maskG = this.make.graphics({ add: false });
        maskG.fillStyle(0xffffff, 1);
        maskG.fillRect(viewX, viewY, viewW, viewH);
        content.setMask(maskG.createGeometryMask());

        const rowW = viewW - 12;
        const rowH = 36;
        const gap = 4;
        this.objectList = {
            content,
            viewX,
            viewY,
            viewW,
            viewH,
            rowW,
            rowH,
            gap,
            contentH: 0,
            scroll: 0,
            maxScroll: 0,
            moved: false,
            drag: null
        };
        this.objectScrollGfx = this.add.graphics();
        this.objectsBody.add(this.objectScrollGfx);
        this.rebuildObjectRows();

        this.input.on('wheel', (pointer, _over, _dx, dy) => {
            if (!this.pointerInObjectList(pointer)) {
                return;
            }
            if (pointer.event && typeof pointer.event.preventDefault === 'function') {
                pointer.event.preventDefault();
            }
            this.setObjectScroll(this.objectList.scroll + dy);
        });
        this.input.on('pointerdown', (pointer) => {
            if (!this.pointerInObjectList(pointer)) {
                return;
            }
            this.objectList.moved = false;
            this.objectList.drag = { y: pointer.y, scroll: this.objectList.scroll };
        });
        this.input.on('pointermove', (pointer) => {
            const drag = this.objectList && this.objectList.drag;
            if (!drag || !pointer.isDown) {
                return;
            }
            const dy = drag.y - pointer.y;
            if (Math.abs(dy) > 6) {
                this.objectList.moved = true;
                this.setObjectScroll(drag.scroll + dy);
            }
        });
        this.input.on('pointerup', () => {
            if (this.objectList) {
                this.objectList.drag = null;
            }
        });
    }

    pointerInObjectList(pointer) {
        const list = this.objectList;
        if (!list || !pointer || this.sideTab !== 'objects') {
            return false;
        }
        const x = pointer.worldX;
        const y = pointer.worldY;
        return x >= list.viewX && x <= list.viewX + list.viewW &&
            y >= list.viewY && y <= list.viewY + list.viewH;
    }

    setObjectScroll(scroll) {
        const list = this.objectList;
        if (!list) {
            return;
        }
        list.scroll = Phaser.Math.Clamp(scroll, 0, list.maxScroll);
        list.content.y = list.viewY - list.scroll;
        this.syncObjectRowInput();
        this.redrawObjectScrollbar();
    }

    syncObjectRowInput() {
        const list = this.objectList;
        if (!list || !this.objectRows) {
            return;
        }
        const viewTop = list.viewY;
        const viewBottom = list.viewY + list.viewH;
        this.objectRows.forEach((row) => {
            const center = list.content.y + row.y;
            const top = center - row.rowHeight / 2;
            const bottom = center + row.rowHeight / 2;
            const visible = this.sideTab === 'objects' && bottom > viewTop && top < viewBottom;
            if (row.input) {
                row.input.enabled = visible;
            }
            if (row.copyBtn && row.copyBtn.input) {
                row.copyBtn.input.enabled = visible;
            }
            if (row.deleteBtn && row.deleteBtn.input) {
                row.deleteBtn.input.enabled = visible;
            }
        });
    }

    redrawObjectScrollbar() {
        const gfx = this.objectScrollGfx;
        const list = this.objectList;
        if (!gfx || !list) {
            return;
        }
        gfx.clear();
        if (list.maxScroll <= 0) {
            return;
        }
        const trackX = list.viewX + list.viewW - 4;
        const trackY = list.viewY;
        const trackH = list.viewH;
        gfx.fillStyle(0xdddddd, 1);
        gfx.fillRect(trackX, trackY, 3, trackH);
        const thumbH = Math.max(24, trackH * (list.viewH / list.contentH));
        const travel = trackH - thumbH;
        const thumbY = trackY + (list.maxScroll > 0 ? (list.scroll / list.maxScroll) * travel : 0);
        gfx.fillStyle(0x000000, 1);
        gfx.fillRect(trackX, thumbY, 3, thumbH);
    }

    rebuildObjectRows() {
        const list = this.objectList;
        if (!list) {
            return;
        }
        list.content.removeAll(true);
        const rowH = list.rowH;
        const gap = list.gap;
        this.objectRows = this.objects.map((object, index) => {
            const row = this.createObjectRow(
                list.rowW / 2,
                index * (rowH + gap) + rowH / 2,
                list.rowW,
                rowH,
                object
            );
            list.content.add(row);
            return row;
        });
        const count = this.objects.length;
        list.contentH = count === 0 ? 0 : count * rowH + (count - 1) * gap;
        list.maxScroll = Math.max(0, list.contentH - list.viewH);
        this.pruneDeadInput();
        this.setObjectScroll(list.scroll);
        this.refreshObjectRows();
    }

    pruneDeadInput() {
        const list = this.input && this.input._list;
        if (!list) {
            return;
        }
        for (let index = list.length - 1; index >= 0; index -= 1) {
            const obj = list[index];
            if (!obj || !obj.scene || !obj.input) {
                list.splice(index, 1);
            }
        }
    }

    deleteObject(object) {
        if (!object || object._removing) {
            return;
        }
        object._removing = true;
        this.time.delayedCall(0, () => this.finishDeleteObject(object));
    }

    finishDeleteObject(object) {
        if (!object) {
            return;
        }
        const index = this.objects.indexOf(object);
        this.releaseObject(object);
        if (index >= 0) {
            this.objects.splice(index, 1);
        }
        if (this.selectedObject === object) {
            const nextIndex = Math.min(index, this.objects.length - 1);
            this.selectedObject = nextIndex >= 0 ? this.objects[nextIndex] : null;
        }
        this.rebuildObjectRows();
        this.syncPropEditors();
        this.refreshActiveProps();
    }

    copyObject(object) {
        if (!object || typeof object.serialize !== 'function') {
            return;
        }
        const data = object.serialize();
        data.name = uiObjectCopyName(object.name);
        shiftUiObjectCopy(object.kind, data, this.heatMap.field);
        const created = this.spawnObject(object.kind, data);
        if (!created) {
            return;
        }
        const index = this.objects.indexOf(object);
        this.objects.splice(index + 1, 0, created);
        this.rebuildObjectRows();
        this.selectObject(created);
    }

    spawnObject(kind, data) {
        let created = null;
        if (kind === 'hot-ball') {
            created = new UiHotBall(this.heatMap, { name: data.name });
            this.balls.push(created);
        } else if (kind === 'hot-rod') {
            created = new UiHotRod(this.heatMap, { name: data.name });
            this.rods.push(created);
        } else if (kind === 'back-highlight') {
            created = new UiBackHighlighter(this.heatMap, { name: data.name });
            this.highlighters.push(created);
        } else if (kind === 'shard') {
            created = new UiShard(this.heatMap, { name: data.name });
            this.shards.push(created);
        } else if (kind === 'sheet') {
            created = new UiSheet(this.heatMap, { name: data.name });
            this.sheets.push(created);
        }
        if (created && typeof created.applySerialized === 'function') {
            created.applySerialized(data);
        }
        if (created && kind === 'sheet' && this.host.paper && typeof this.host.paper.add === 'function') {
            this.host.paper.add(created);
        } else if (created && kind === 'shard' && this.host.scissor && typeof this.host.scissor.add === 'function') {
            this.host.scissor.add(created);
        } else if (created && this.host.stone && typeof this.host.stone.add === 'function') {
            this.host.stone.add(created);
        }
        return created;
    }

    releaseObject(object) {
        if (!object) {
            return;
        }
        if (this.host.stone && typeof this.host.stone.remove === 'function') {
            this.host.stone.remove(object);
        }
        if (this.host.scissor && typeof this.host.scissor.remove === 'function') {
            this.host.scissor.remove(object);
        }
        if (this.host.paper && typeof this.host.paper.remove === 'function') {
            this.host.paper.remove(object);
        }
        if (object.kind === 'hot-ball') {
            this.heatMap.removeBall(object.motion);
            this.dropFrom(this.balls, object);
        } else if (object.kind === 'hot-rod') {
            this.heatMap.removeRod(object.emitter);
            this.dropFrom(this.rods, object);
        } else if (object.kind === 'back-highlight') {
            this.heatMap.removeHighlighter(object.emitter);
            this.dropFrom(this.highlighters, object);
        } else if (object.kind === 'shard') {
            this.heatMap.removeHighlighter(object.emitter);
            this.dropFrom(this.shards, object);
        } else if (object.kind === 'sheet') {
            this.heatMap.removeHighlighter(object.emitter);
            this.dropFrom(this.sheets, object);
        }
    }

    dropFrom(list, object) {
        const index = list.indexOf(object);
        if (index >= 0) {
            list.splice(index, 1);
        }
    }

    selectObject(object) {
        this.selectedObject = object;
        this.refreshObjectRows();
        this.syncPropEditors();
        this.refreshActiveProps();
    }

    refreshObjectRows() {
        if (!this.objectRows) {
            return;
        }
        this.objectRows.forEach((row) => {
            if (row.object && row.buttonText) {
                row.buttonText.setText(row.object.name);
            }
            if (row.typeText) {
                row.typeText.setText(uiObjectTypeLabel(row.object));
            }
            this.redrawObjectRow(row, row.object === this.selectedObject);
        });
    }

    createObjectRow(x, y, width, height, object) {
        const btn = this.add.container(x, y);
        const bg = this.add.graphics();
        const text = this.add.text(-width / 2 + 8, 0, object.name, {
            font: `${UI.body}px monospace`,
            fill: '#000000'
        }).setOrigin(0, 0.5);
        const typeText = this.add.text(-width / 2 + width - 108, 0, uiObjectTypeLabel(object), {
            font: `${UI.small}px monospace`,
            fill: '#666666'
        }).setOrigin(1, 0.5);
        const copyBtn = this.createRowAction(width / 2 - 72, 0, 44, 26, 'COPY', () => {
            if (this.objectList && this.objectList.moved) {
                return;
            }
            this.copyObject(object);
        });
        const deleteBtn = this.createRowAction(width / 2 - 22, 0, 36, 26, 'DEL', () => {
            if (this.objectList && this.objectList.moved) {
                return;
            }
            this.deleteObject(object);
        });
        btn.add([bg, text, typeText, copyBtn, deleteBtn]);
        btn.buttonBg = bg;
        btn.buttonText = text;
        btn.typeText = typeText;
        btn.copyBtn = copyBtn;
        btn.deleteBtn = deleteBtn;
        btn.object = object;
        btn.rowWidth = width;
        btn.rowHeight = height;
        const hitW = width - 92;
        const hitArea = new Phaser.Geom.Rectangle(-width / 2, -height / 2, hitW, height);
        btn.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains, { useHandCursor: true });
        btn.on('pointerup', () => {
            if (this.objectList && this.objectList.moved) {
                return;
            }
            this.selectObject(object);
        });
        this.redrawObjectRow(btn, false);
        return btn;
    }

    createRowAction(x, y, btnWidth, btnHeight, label, onClick) {
        const btn = this.add.container(x, y);
        const bg = this.add.graphics();
        bg.fillStyle(0xffffff, 1);
        bg.fillRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight);
        bg.lineStyle(2, 0x000000, 1);
        bg.strokeRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight);
        const text = this.add.text(0, 0, label, {
            font: `${UI.small}px monospace`,
            fill: '#000000'
        }).setOrigin(0.5);
        btn.add([bg, text]);
        const hitArea = new Phaser.Geom.Rectangle(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight);
        btn.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains, { useHandCursor: true });
        btn.on('pointerup', () => {
            onClick();
        });
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
            if (btn.typeText) {
                btn.typeText.setColor('#ffffff');
            }
        } else {
            bg.fillStyle(0xffffff, 1);
            bg.fillRect(-w / 2, -h / 2, w, h);
            bg.lineStyle(2, 0x000000, 1);
            bg.strokeRect(-w / 2, -h / 2, w, h);
            btn.buttonText.setColor('#000000');
            if (btn.typeText) {
                btn.typeText.setColor('#666666');
            }
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
        this.objectsBody.add(this.createFileButton(startX, y, btnW, btnH, 'SAVE', () => this.onSaveClick()));
        this.objectsBody.add(this.createFileButton(startX + btnW + gap, y, btnW, btnH, 'LOAD', () => this.onLoadClick()));
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

    noteStonePart(object, added) {
        if (!object) {
            return;
        }
        if (added) {
            if (object.kind === 'hot-ball' && this.balls.indexOf(object) < 0) {
                this.balls.push(object);
            }
            if (this.objects.indexOf(object) < 0) {
                this.objects.push(object);
            }
            this.rebuildObjectRows();
            this.selectObject(object);
            return;
        }
        this.dropFrom(this.balls, object);
        const index = this.objects.indexOf(object);
        if (index >= 0) {
            this.objects.splice(index, 1);
        }
        if (this.selectedObject === object) {
            this.selectedObject = this.objects.length ? this.objects[this.objects.length - 1] : null;
        }
        this.rebuildObjectRows();
        this.syncPropEditors();
        this.refreshActiveProps();
    }

    noteScissorPart(object, added) {
        if (!object) {
            return;
        }
        if (added) {
            if (object.kind === 'shard' && this.shards.indexOf(object) < 0) {
                this.shards.push(object);
            }
            if (this.objects.indexOf(object) < 0) {
                this.objects.push(object);
            }
            this.rebuildObjectRows();
            this.selectObject(object);
            return;
        }
        this.dropFrom(this.shards, object);
        const index = this.objects.indexOf(object);
        if (index >= 0) {
            this.objects.splice(index, 1);
        }
        if (this.selectedObject === object) {
            this.selectedObject = this.objects.length ? this.objects[this.objects.length - 1] : null;
        }
        this.rebuildObjectRows();
        this.syncPropEditors();
        this.refreshActiveProps();
    }

    ensureStoneListed() {
        const stone = this.host && this.host.stone;
        if (!stone) {
            return;
        }
        if (this.objects.indexOf(stone) < 0) {
            this.objects.unshift(stone);
        }
    }

    ensureScissorListed() {
        const scissor = this.host && this.host.scissor;
        if (!scissor) {
            return;
        }
        if (this.objects.indexOf(scissor) < 0) {
            const stoneIndex = this.host.stone ? this.objects.indexOf(this.host.stone) : -1;
            this.objects.splice(stoneIndex + 1, 0, scissor);
        }
    }

    notePaperPart(object, added) {
        if (!object) {
            return;
        }
        if (added) {
            if (object.kind === 'sheet' && this.sheets.indexOf(object) < 0) {
                this.sheets.push(object);
            }
            if (this.objects.indexOf(object) < 0) {
                this.objects.push(object);
            }
            this.rebuildObjectRows();
            this.selectObject(object);
            return;
        }
        this.dropFrom(this.sheets, object);
        const index = this.objects.indexOf(object);
        if (index >= 0) {
            this.objects.splice(index, 1);
        }
        if (this.selectedObject === object) {
            this.selectedObject = this.objects.length ? this.objects[this.objects.length - 1] : null;
        }
        this.rebuildObjectRows();
        this.syncPropEditors();
        this.refreshActiveProps();
    }

    ensurePaperListed() {
        const paper = this.host && this.host.paper;
        if (!paper) {
            return;
        }
        if (this.objects.indexOf(paper) < 0) {
            const scissorIndex = this.host.scissor ? this.objects.indexOf(this.host.scissor) : -1;
            const stoneIndex = this.host.stone ? this.objects.indexOf(this.host.stone) : -1;
            const at = scissorIndex >= 0 ? scissorIndex + 1 : stoneIndex + 1;
            this.objects.splice(at, 0, paper);
        }
    }

    ensurePresetPopulation(data) {
        this.ensureKindCount('hot-ball', data && data.balls);
        this.ensureKindCount('hot-rod', data && data.rods);
        this.ensureKindCount('back-highlight', data && data.highlighters);
    }

    ensureKindCount(kind, specs) {
        const wanted = specs || [];
        const list = kind === 'hot-ball'
            ? this.balls
            : kind === 'hot-rod'
                ? this.rods
                : this.highlighters;
        if (!list) {
            return;
        }
        for (let index = list.length; index < wanted.length; index += 1) {
            const created = this.spawnObject(kind, wanted[index] || {});
            if (created && this.objects.indexOf(created) < 0) {
                this.objects.push(created);
            }
        }
    }

    clearGroup(group) {
        if (!group) {
            return;
        }
        const previous = group.parts.map((part) => part.object);
        previous.forEach((object) => {
            this.releaseObject(object);
            this.dropFrom(this.objects, object);
        });
    }

    clearSceneObjects() {
        const keep = new Set(
            [this.host && this.host.stone, this.host && this.host.scissor, this.host && this.host.paper].filter(Boolean)
        );
        const listed = this.objects.filter((object) => !keep.has(object));
        listed.forEach((object) => {
            this.releaseObject(object);
            this.dropFrom(this.objects, object);
        });
        this.clearGroup(this.host && this.host.stone);
        this.clearGroup(this.host && this.host.scissor);
        this.clearGroup(this.host && this.host.paper);
        ['balls', 'rods', 'highlighters', 'shards', 'sheets'].forEach((key) => {
            const list = this.host && this.host[key];
            if (!list) {
                return;
            }
            list.slice().forEach((object) => {
                this.releaseObject(object);
                this.dropFrom(this.objects, object);
            });
        });
    }

    placeInGroup(group, created) {
        if (!created || !group) {
            return;
        }
        [this.host.stone, this.host.scissor, this.host.paper].forEach((other) => {
            if (other && other !== group && typeof other.remove === 'function') {
                other.remove(created);
            }
        });
        if (group.parts.every((part) => part.object !== created)) {
            group.add(created);
        }
    }

    loadGroupParts(group, entries) {
        if (!group) {
            return;
        }
        (entries || []).forEach((entry) => {
            if (!entry || !entry.kind) {
                return;
            }
            const created = this.spawnObject(entry.kind, entry.object || {});
            this.placeInGroup(group, created);
            if (created && this.objects.indexOf(created) < 0) {
                this.objects.push(created);
            }
        });
    }

    serializeCompositePreset() {
        const stone = this.host && this.host.stone;
        const scissor = this.host && this.host.scissor;
        const paper = this.host && this.host.paper;
        return {
            kind: UI_EDITOR_PRESET_KIND,
            version: 4,
            heatMap: this.heatMap && typeof this.heatMap.serialize === 'function'
                ? this.heatMap.serialize()
                : {},
            stone: stone && typeof stone.serialize === 'function' ? stone.serialize() : null,
            scissor: scissor && typeof scissor.serialize === 'function' ? scissor.serialize() : null,
            paper: paper && typeof paper.serialize === 'function' ? paper.serialize() : null
        };
    }

    setEditorStatus(message) {
        if (this.editorStatus) {
            this.editorStatus.setText(message || '');
        }
    }

    onSaveClick() {
        let preset = null;
        try {
            preset = this.serializeCompositePreset();
        } catch (error) {
            console.warn('[CompositeUIEditorScene] Save failed', error);
            this.setEditorStatus('Save failed');
            return;
        }
        const suggested = this.presetFileName || 'composite-ui.json';
        saveNamedPresetFile(preset, suggested).then((result) => {
            this.presetFileName = result.name;
            this.setEditorStatus(`Saved ${result.name}`);
        }).catch((error) => {
            if (error && (error.name === 'AbortError' || error.name === 'NotAllowedError')) {
                return;
            }
            console.warn('[CompositeUIEditorScene] Save failed', error);
            this.setEditorStatus(error && error.message ? error.message : 'Save failed');
        });
    }

    onLoadClick() {
        const pick = loadUiEditorPresetFile();
        this._presetPick = pick;
        pick.then((data) => {
            if (this._presetPick !== pick) {
                return;
            }
            this.applyLoadedPreset(data);
        }).catch((error) => {
            if (this._presetPick !== pick || (error && error.name === 'AbortError')) {
                return;
            }
            console.warn('[CompositeUIEditorScene] Load failed', error);
            this.setEditorStatus(error && error.message ? error.message : 'Load failed');
        });
    }

    applyLoadedPreset(data) {
        this.clearSceneObjects();
        if (data && data.heatMap && this.heatMap && typeof this.heatMap.applySerialized === 'function') {
            this.heatMap.applySerialized(data.heatMap);
        }
        if (data && (data.stone || data.scissor || data.paper)) {
            if (data.stone && this.host && this.host.stone) {
                this.clearGroup(this.host.stone);
                this.loadGroupParts(this.host.stone, data.stone.parts);
                this.host.stone.applySerialized(data.stone);
                this.ensureStoneListed();
            }
            if (data.scissor && this.host && this.host.scissor) {
                this.clearGroup(this.host.scissor);
                this.loadGroupParts(this.host.scissor, data.scissor.parts);
                this.host.scissor.applySerialized(data.scissor);
                this.ensureScissorListed();
            }
            if (data.paper && this.host && this.host.paper) {
                this.clearGroup(this.host.paper);
                this.loadGroupParts(this.host.paper, data.paper.parts);
                this.host.paper.applySerialized(data.paper);
                this.ensurePaperListed();
            }
        } else {
            this.ensurePresetPopulation(data);
            applyUiEditorPreset(this.heatMap, this.balls, data, this.rods, this.highlighters);
            if (this.host && this.host.stone) {
                this.host.stone.parts.forEach((part) => {
                    part.local = this.host.stone.captureLocal(part.object);
                });
            }
            this.ensureStoneListed();
            this.ensureScissorListed();
            this.ensurePaperListed();
        }
        if (this.objects.indexOf(this.selectedObject) < 0) {
            this.selectedObject = (this.host && this.host.stone) || this.objects[0] || null;
        }
        if (this.objectList) {
            this.objectList.scroll = 0;
        }
        this.rebuildObjectRows();
        this.syncPropEditors();
        this.refreshActiveProps();
        this.setEditorStatus('Loaded');
    }

    createEditorPanel(x, y, width, height, label) {
        const frame = this.add.graphics();
        frame.lineStyle(2, 0x000000, 1);
        frame.strokeRect(x, y, width, height);

        if (label) {
            this.add.text(x + 12, y + 12, label, {
                font: `bold ${UI.small}px monospace`,
                fill: '#333333'
            }).setOrigin(0, 0);
        }

        return { x, y, width, height, frame, label };
    }


    onBackClick() {
        const host = this.host;
        window.setTimeout(() => {
            if (host && typeof host.leave === 'function') {
                host.leave();
            }
        }, 0);
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
