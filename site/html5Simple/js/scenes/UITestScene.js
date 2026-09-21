/**
 * UITestScene
 * Sandbox for trying UI effects.
 */
class UITestScene extends Phaser.Scene {
    constructor() {
        super({ key: 'UITestScene' });
        console.log('[UITestScene] Constructor called');
    }

    init() {
        enterTestsCanvas(this);
    }

    create() {
        enterTestsCanvas(this);
        console.log('[UITestScene] create() started');
        fxEnter(this);
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        this.add.text(width / 2, 56, 'UI plazma ball', {
            font: `${UI.title}px monospace`,
            fill: '#000000'
        }).setOrigin(0.5);

        this.add.text(width / 2, 88, 'Yellow ball test', {
            font: `${UI.body}px monospace`,
            fill: '#666666'
        }).setOrigin(0.5);

        const backH = UI.menuBtnH;
        const panelTop = 120;
        const panelBottom = height - UI.pad - backH - 24;
        this.createTestPanel(UI.pad, panelTop, width - UI.pad * 2, panelBottom - panelTop);

        this.createMenuButton(
            width / 2,
            height - UI.pad - backH / 2,
            'BACK',
            () => this.onBackClick(),
            backH
        );
    }

    update(time, delta) {
        if (this.plasma && typeof this.plasma.update === 'function') {
            this.plasma.update(time, delta);
        }
    }

    createTestPanel(x, y, width, height) {
        this.effectsHost = this.add.container(x, y);
        this.effectsHost.setSize(width, height);

        const inset = 2;
        this.plasma = attachPlasmaBall(this, x + inset, y + inset, width - inset * 2, height - inset * 2);

        const frame = this.add.graphics();
        frame.lineStyle(2, 0x000000, 1);
        frame.strokeRect(x, y, width, height);

        this.add.text(x + 12, y + 12, 'TEST PANEL', {
            font: `bold ${UI.small}px monospace`,
            fill: '#ffe27a',
            stroke: '#041028',
            strokeThickness: 3
        }).setOrigin(0, 0);

        this.testPanel = { x, y, width, height, frame };
    }

    onBackClick() {
        console.log('[UITestScene] Back clicked');
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
