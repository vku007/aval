/**
 * HotMapBallScene
 * Sandbox for a click-to-diffuse heat map.
 */
class HotMapBallScene extends Phaser.Scene {
    constructor() {
        super({ key: 'HotMapBallScene' });
        console.log('[HotMapBallScene] Constructor called');
    }

    create() {
        console.log('[HotMapBallScene] create() started');
        fxEnter(this);
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        this.add.text(width / 2, 56, 'Hot map ball', {
            font: `${UI.title}px monospace`,
            fill: '#000000'
        }).setOrigin(0.5);

        this.add.text(width / 2, 88, 'Heat map test', {
            font: `${UI.body}px monospace`,
            fill: '#666666'
        }).setOrigin(0.5);

        const backH = UI.menuBtnH;
        const settingsH = 186;
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
        this.heatMap = attachHeatMap(this, x + inset, y + inset, width - inset * 2, height - inset * 2);

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

        this.add.text(x + 12, y + 10, 'SETTINGS', {
            font: `bold ${UI.small}px monospace`,
            fill: '#333333'
        }).setOrigin(0, 0);

        const rows = [
            { key: 'diffusion', label: 'DIFFUSE', decimals: 1 },
            { key: 'cooling', label: 'COOL', decimals: 2 },
            { key: 'radius', label: 'DOT SIZE', decimals: 1 },
            { key: 'energy', label: 'DOT HEAT', decimals: 1 }
        ];
        const rowH = 40;
        const rowTop = y + 26;
        this.settingsValues = {};
        rows.forEach((row, index) => {
            this.createStepperRow(
                x + 8,
                rowTop + index * rowH,
                width - 16,
                rowH,
                row
            );
        });

        this.settingsPanel = { x, y, width, height, frame };
    }

    createStepperRow(x, y, width, height, row) {
        const btnW = 40;
        const btnH = 32;
        const btnGap = 6;
        const plusX = x + width - btnW / 2;
        const minusX = plusX - btnW - btnGap;
        const valueX = minusX - btnW / 2 - 8;

        this.add.text(x + 4, y + height / 2, row.label, {
            font: `${UI.body}px monospace`,
            fill: '#000000'
        }).setOrigin(0, 0.5);

        const value = this.add.text(valueX, y + height / 2, this.formatParam(row), {
            font: `${UI.body}px monospace`,
            fill: '#000000'
        }).setOrigin(1, 0.5);
        this.settingsValues[row.key] = { text: value, decimals: row.decimals };

        this.createStepButton(minusX, y + height / 2, btnW, btnH, '−', () => {
            this.onNudgeParam(row.key, -1);
        });
        this.createStepButton(plusX, y + height / 2, btnW, btnH, '+', () => {
            this.onNudgeParam(row.key, 1);
        });
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
        console.log('[HotMapBallScene] Back clicked');
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
