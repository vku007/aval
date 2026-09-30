/**
 * AlterSheetScene
 * Sandbox for UiNewSheet: one hot disk and balls around its center.
 */
class AlterSheetScene extends Phaser.Scene {
    constructor() {
        super({ key: 'AlterSheetScene' });
        console.log('[AlterSheetScene] Constructor called');
    }

    init() {
        enterTestsCanvas(this);
    }

    create() {
        enterTestsCanvas(this);
        console.log('[AlterSheetScene] create() started');
        fxEnter(this);
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        this.add.text(width / 2, 56, 'Alter Sheet', {
            font: `${UI.heading}px monospace`,
            fill: '#000000'
        }).setOrigin(0.5);

        this.add.text(width / 2, 88, 'One disk and balls. Tilt turns them together', {
            font: `${UI.body}px monospace`,
            fill: '#666666'
        }).setOrigin(0.5);

        const backH = UI.menuBtnH;
        const settingsH = 248;
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
        bindSceneHeatObjects(this);
        if (this.heatMap && typeof this.heatMap.update === 'function') {
            this.heatMap.update(time, delta);
        }
        if (this.propEditor) {
            this.propEditor.refreshValues();
        }
    }

    createTestPanel(x, y, width, height) {
        const inset = 2;
        this.heatMap = new UiHeatMap(this, {
            x: x + inset,
            y: y + inset,
            width: width - inset * 2,
            height: height - inset * 2
        }, {
            texKey: 'alter-sheet-field'
        });
        this.sheet = new UiNewSheet(this.heatMap);
        this.heatMap.onTap = (cell) => {
            this.sheet.setPivot(cell);
        };

        const frame = this.add.graphics();
        frame.lineStyle(2, 0x000000, 1);
        frame.strokeRect(x, y, width, height);

        this.add.text(x + 12, y + 12, 'TEST PANEL', {
            font: `bold ${UI.small}px monospace`,
            fill: '#c8c8c8',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0, 0);
    }

    createSettingsPanel(x, y, width, height) {
        const frame = this.add.graphics();
        frame.lineStyle(2, 0x000000, 1);
        frame.strokeRect(x, y, width, height);

        this.add.text(x + 12, y + 18, 'SETTINGS', {
            font: `bold ${UI.small}px monospace`,
            fill: '#333333'
        }).setOrigin(0, 0.5);

        this.propEditor = new UiPropEditor(this, { x, y, width, height }, {
            getTarget: () => this.sheet,
            tabs: UiNewSheet.PROP_TABS
        });
    }

    onBackClick() {
        console.log('[AlterSheetScene] Back clicked');
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
