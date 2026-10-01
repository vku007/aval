/**
 * SheetScene
 * Sheet hot map. Heat cycles like back highlight / shard.
 * The sheet follows one cosine from 0 to 2π. Glisten sweeps along it.
 */
class SheetScene extends Phaser.Scene {
    constructor() {
        super({ key: 'SheetScene' });
        console.log('[SheetScene] Constructor called');
    }

    init() {
        enterTestsCanvas(this);
    }

    create() {
        enterTestsCanvas(this);
        console.log('[SheetScene] create() started');
        fxEnter(this);
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        this.add.text(width / 2, 56, 'Sheet', {
            font: `${UI.heading}px monospace`,
            fill: '#000000'
        }).setOrigin(0.5);

        this.add.text(width / 2, 88, 'Cosine sheet. Glisten repeats', {
            font: `${UI.body}px monospace`,
            fill: '#666666'
        }).setOrigin(0.5);

        const backH = UI.menuBtnH;
        const settingsH = 420;
        const gap = 12;
        const panelTop = 120;
        const settingsTop = height - UI.pad - backH - 16 - settingsH;
        const testH = settingsTop - gap - panelTop;

        this.createTestPanel(UI.pad, panelTop, width - UI.pad * 2, testH);
        this.createSettingsPanel(UI.pad, settingsTop, width - UI.pad * 2, settingsH);

        this.createMenuButton(
            width / 2,
            height - UI.pad - backH / 2,
            'BACK',
            () => this.onBackClick(),
            backH
        );
    }

    update(time, delta) {
        if (this.heatMap && typeof this.heatMap.update === 'function') {
            this.heatMap.update(time, delta);
        }
    }

    createTestPanel(x, y, width, height) {
        this.effectsHost = this.add.container(x, y);
        this.effectsHost.setSize(width, height);

        const inset = 2;
        this.heatMap = attachSheet(this, x + inset, y + inset, width - inset * 2, height - inset * 2);

        const frame = this.add.graphics();
        frame.lineStyle(2, 0x000000, 1);
        frame.strokeRect(x, y, width, height);

        this.add.text(x + 12, y + 12, 'TEST PANEL', {
            font: `bold ${UI.small}px monospace`,
            fill: '#c8c8c8',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0, 0);

        this.testPanel = { x, y, width, height, frame };
    }

    createSettingsPanel(x, y, width, height) {
        const frame = this.add.graphics();
        frame.lineStyle(2, 0x000000, 1);
        frame.strokeRect(x, y, width, height);

        this.add.text(x + 12, y + 18, 'SETTINGS', {
            font: `bold ${UI.small}px monospace`,
            fill: '#333333'
        }).setOrigin(0, 0.5);

        const tabW = 72;
        const tabH = 28;
        const tabY = y + 18;
        const right = x + width - 12;
        const tabGap = 8;
        const tabOrder = ['ball', 'field', 'from', 'to'];
        const tabLabels = { ball: 'BALL', field: 'FIELD', from: 'FROM', to: 'TO' };
        tabOrder.forEach((key, index) => {
            const fromRight = tabOrder.length - 1 - index;
            const tabX = right - tabW / 2 - fromRight * (tabW + tabGap);
            this[`${key}TabBtn`] = this.createTabButton(tabX, tabY, tabW, tabH, tabLabels[key], () => {
                this.setSettingsTab(key);
            });
        });

        const poseRows = [
            { key: 'width', label: 'WIDTH', decimals: 0 },
            { key: 'height', label: 'HEIGHT', decimals: 0 },
            { key: 'skew', label: 'SKEW', decimals: 0 },
            { key: 'bend', label: 'BEND', decimals: 0 },
            { key: 'cosine', label: 'PHASE', decimals: 0 },
            { key: 'heat', label: 'HEAT', decimals: 1 }
        ];
        const fieldRows = [
            { key: 'cycling', label: 'CYCLING', type: 'bool' },
            { key: 'speed', label: 'SPEED', decimals: 1 },
            { key: 'delay', label: 'DELAY', decimals: 1 },
            { key: 'gap', label: 'GAP', decimals: 1 },
            { key: 'glistenOn', label: 'GLISTEN', type: 'bool' },
            { key: 'glistenSpeed', label: 'GL SPEED', decimals: 1 },
            { key: 'glistenDelay', label: 'GL DELAY', decimals: 1 },
            { key: 'glistenPower', label: 'GL POWER', decimals: 1 },
            { key: 'diffusion', label: 'DIFFUSE', decimals: 1 },
            { key: 'cooling', label: 'COOL', decimals: 2 }
        ];
        const ballRows = [
            { key: 'radius', label: 'DOT SIZE', decimals: 1 },
            { key: 'energy', label: 'DOT HEAT', decimals: 1 },
            { key: 'ballSpeed', label: 'SPEED', decimals: 2 },
            { key: 'ballDelta', label: 'DELTA', decimals: 0 }
        ];
        const rowH = 32;
        const rowTop = y + 38;
        this.settingsValues = {};
        this.ballTabBody = this.add.container(0, 0);
        this.fieldTabBody = this.add.container(0, 0);
        this.fromTabBody = this.add.container(0, 0);
        this.toTabBody = this.add.container(0, 0);
        fieldRows.forEach((row, index) => {
            const rowY = rowTop + index * rowH;
            if (row.type === 'bool') {
                this.createBoolRow(this.fieldTabBody, x + 8, rowY, width - 16, rowH, row, 'field');
            } else {
                this.createStepperRow(this.fieldTabBody, x + 8, rowY, width - 16, rowH, row, 'field');
            }
        });
        ballRows.forEach((row, index) => {
            this.createStepperRow(this.ballTabBody, x + 8, rowTop + index * rowH, width - 16, rowH, row, 'ball');
        });
        poseRows.forEach((row, index) => {
            this.createStepperRow(this.fromTabBody, x + 8, rowTop + index * rowH, width - 16, rowH, row, 'from');
        });
        poseRows.forEach((row, index) => {
            this.createStepperRow(this.toTabBody, x + 8, rowTop + index * rowH, width - 16, rowH, row, 'to');
        });

        this.settingsPanel = { x, y, width, height, frame };
        this.setSettingsTab('from');
    }

    setSettingsTab(tab) {
        this.settingsTab = tab;
        const bodies = {
            ball: this.ballTabBody,
            field: this.fieldTabBody,
            from: this.fromTabBody,
            to: this.toTabBody
        };
        const buttons = {
            ball: this.ballTabBtn,
            field: this.fieldTabBtn,
            from: this.fromTabBtn,
            to: this.toTabBtn
        };
        Object.keys(bodies).forEach((key) => {
            const on = key === tab;
            bodies[key].setVisible(on);
            this.setTreeInputEnabled(bodies[key], on);
            this.redrawTabButton(buttons[key], on);
        });
    }

    setTreeInputEnabled(node, enabled) {
        if (node.input) {
            node.input.enabled = enabled;
        }
        if (node.list) {
            node.list.forEach((child) => this.setTreeInputEnabled(child, enabled));
        }
    }

    createTabButton(x, y, btnWidth, btnHeight, label, callback) {
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
        this.redrawTabButton(btn, false);
        return btn;
    }

    redrawTabButton(btn, selected) {
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

    createBoolRow(parent, x, y, width, height, row, group) {
        const btnW = 72;
        const btnH = 32;
        const label = this.add.text(x + 4, y + height / 2, row.label, {
            font: `${UI.body}px monospace`,
            fill: '#000000'
        }).setOrigin(0, 0.5);
        const toggle = this.createBoolToggle(x + width - btnW / 2, y + height / 2, btnW, btnH, () => {
            this.onNudgeParam(group, row.key, 1);
        });
        this.settingsValues[`${group}.${row.key}`] = { type: 'bool', toggle, group, key: row.key };
        this.redrawBoolToggle(toggle, !!this.readParam(group, row.key));
        parent.add([label, toggle]);
    }

    createBoolToggle(x, y, btnWidth, btnHeight, callback) {
        const btn = this.add.container(x, y);
        const bg = this.add.graphics();
        const text = this.add.text(0, 0, 'OFF', {
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
        return btn;
    }

    redrawBoolToggle(btn, on) {
        if (!btn) {
            return;
        }
        const w = btn.tabWidth;
        const h = btn.tabHeight;
        const bg = btn.buttonBg;
        bg.clear();
        if (on) {
            bg.fillStyle(0x000000, 1);
            bg.fillRect(-w / 2, -h / 2, w, h);
            btn.buttonText.setColor('#ffffff');
            btn.buttonText.setText('ON');
        } else {
            bg.lineStyle(2, 0x000000, 1);
            bg.strokeRect(-w / 2, -h / 2, w, h);
            btn.buttonText.setColor('#000000');
            btn.buttonText.setText('OFF');
        }
    }

    createStepperRow(parent, x, y, width, height, row, group) {
        const btnW = 40;
        const btnH = 32;
        const btnGap = 6;
        const plusX = x + width - btnW / 2;
        const minusX = plusX - btnW - btnGap;
        const valueX = minusX - btnW / 2 - 8;

        const label = this.add.text(x + 4, y + height / 2, row.label, {
            font: `${UI.body}px monospace`,
            fill: '#000000'
        }).setOrigin(0, 0.5);

        const value = this.add.text(valueX, y + height / 2, this.formatParam(group, row), {
            font: `${UI.body}px monospace`,
            fill: '#000000'
        }).setOrigin(1, 0.5);
        this.settingsValues[`${group}.${row.key}`] = { text: value, decimals: row.decimals, group, key: row.key };

        const minus = this.createStepButton(minusX, y + height / 2, btnW, btnH, '−', () => {
            this.onNudgeParam(group, row.key, -1);
        });
        const plus = this.createStepButton(plusX, y + height / 2, btnW, btnH, '+', () => {
            this.onNudgeParam(group, row.key, 1);
        });
        parent.add([label, value, minus, plus]);
    }

    readParam(group, key) {
        if (!this.heatMap) {
            return 0;
        }
        if (key === 'cycling') {
            return !!this.heatMap.cycling;
        }
        if (key === 'glistenOn') {
            return this.heatMap.glistenOn !== false;
        }
        if (group === 'from' || group === 'to') {
            return this.heatMap[group][key];
        }
        return this.heatMap.params[key];
    }

    formatParam(group, row) {
        return Number(this.readParam(group, row.key)).toFixed(row.decimals);
    }

    onNudgeParam(group, key, dir) {
        if (!this.heatMap || typeof this.heatMap.nudgeParam !== 'function') {
            return;
        }
        this.heatMap.nudgeParam(group, key, dir);
        const slot = this.settingsValues[`${group}.${key}`];
        if (!slot) {
            return;
        }
        if (slot.type === 'bool') {
            this.redrawBoolToggle(slot.toggle, !!this.readParam(group, key));
            return;
        }
        slot.text.setText(Number(this.readParam(group, key)).toFixed(slot.decimals));
    }

    createStepButton(x, y, btnWidth, btnHeight, label, callback) {
        const btn = this.add.container(x, y);
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
        bindPress(this, btn, { onClick: callback });
        return btn;
    }

    onBackClick() {
        console.log('[SheetScene] Back clicked');
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
