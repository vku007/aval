/**
 * RotatedHotMapBallScene
 * Orbiting hot ball on a heat map. Tap to set the orbit point.
 */
class RotatedHotMapBallScene extends Phaser.Scene {
    constructor() {
        super({ key: 'RotatedHotMapBallScene' });
        console.log('[RotatedHotMapBallScene] Constructor called');
    }

    init() {
        enterTestsCanvas(this);
    }

    create() {
        enterTestsCanvas(this);
        console.log('[RotatedHotMapBallScene] create() started');
        fxEnter(this);
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        this.add.text(width / 2, 56, 'Rotated hot map ball', {
            font: `${UI.heading}px monospace`,
            fill: '#000000'
        }).setOrigin(0.5);

        this.add.text(width / 2, 88, 'Orbiting heat test', {
            font: `${UI.body}px monospace`,
            fill: '#666666'
        }).setOrigin(0.5);

        const backH = UI.menuBtnH;
        const settingsH = 218;
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
        this.heatMap = attachRotatedHeatMap(this, x + inset, y + inset, width - inset * 2, height - inset * 2);

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
        this.heatTabBtn = this.createTabButton(x + width - 12 - tabW * 1.5 - 8, tabY, tabW, tabH, 'HEAT', () => {
            this.setSettingsTab('heat');
        });
        this.geoTabBtn = this.createTabButton(x + width - 12 - tabW / 2, tabY, tabW, tabH, 'GEO', () => {
            this.setSettingsTab('geo');
        });

        const heatRows = [
            { key: 'diffusion', label: 'DIFFUSE', decimals: 1 },
            { key: 'cooling', label: 'COOL', decimals: 2 },
            { key: 'radius', label: 'DOT SIZE', decimals: 1 },
            { key: 'energy', label: 'DOT HEAT', decimals: 1 }
        ];
        const geoRows = [
            { key: 'angleSpeed', label: 'ANG SPEED', decimals: 1 },
            { key: 'orbitRadius', label: 'RADIUS', decimals: 0 },
            { key: 'tiltX', label: 'TILT X', decimals: 0 },
            { key: 'tiltY', label: 'TILT Y', decimals: 0 },
            { key: 'tiltZ', label: 'TILT Z', decimals: 0 }
        ];
        const rowH = 32;
        const rowTop = y + 38;
        this.settingsValues = {};
        this.heatTabBody = this.add.container(0, 0);
        this.geoTabBody = this.add.container(0, 0);
        heatRows.forEach((row, index) => {
            this.createStepperRow(this.heatTabBody, x + 8, rowTop + index * rowH, width - 16, rowH, row);
        });
        geoRows.forEach((row, index) => {
            this.createStepperRow(this.geoTabBody, x + 8, rowTop + index * rowH, width - 16, rowH, row);
        });

        this.settingsPanel = { x, y, width, height, frame };
        this.setSettingsTab('heat');
    }

    setSettingsTab(tab) {
        this.settingsTab = tab;
        const heatOn = tab === 'heat';
        this.heatTabBody.setVisible(heatOn);
        this.geoTabBody.setVisible(!heatOn);
        this.setTreeInputEnabled(this.heatTabBody, heatOn);
        this.setTreeInputEnabled(this.geoTabBody, !heatOn);
        this.redrawTabButton(this.heatTabBtn, heatOn);
        this.redrawTabButton(this.geoTabBtn, !heatOn);
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

    createStepperRow(parent, x, y, width, height, row) {
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

        const value = this.add.text(valueX, y + height / 2, this.formatParam(row), {
            font: `${UI.body}px monospace`,
            fill: '#000000'
        }).setOrigin(1, 0.5);
        this.settingsValues[row.key] = { text: value, decimals: row.decimals };

        const minus = this.createStepButton(minusX, y + height / 2, btnW, btnH, '−', () => {
            this.onNudgeParam(row.key, -1);
        });
        const plus = this.createStepButton(plusX, y + height / 2, btnW, btnH, '+', () => {
            this.onNudgeParam(row.key, 1);
        });
        parent.add([label, value, minus, plus]);
    }

    formatParam(row) {
        const value = this.heatMap && this.heatMap.params
            ? this.heatMap.params[row.key]
            : 0;
        return Number(value).toFixed(row.decimals);
    }

    onNudgeParam(key, dir) {
        if (!this.heatMap || typeof this.heatMap.nudgeParam !== 'function') {
            return;
        }
        this.heatMap.nudgeParam(key, dir);
        const slot = this.settingsValues[key];
        if (slot) {
            slot.text.setText(Number(this.heatMap.params[key]).toFixed(slot.decimals));
        }
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
        console.log('[RotatedHotMapBallScene] Back clicked');
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
