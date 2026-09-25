/**
 * TestsScene
 * Hub for UI effect sandboxes.
 */
class TestsScene extends Phaser.Scene {
    constructor() {
        super({ key: 'TestsScene' });
        console.log('[TestsScene] Constructor called');
    }

    init() {
        enterTestsCanvas(this);
    }

    create() {
        enterTestsCanvas(this);
        console.log('[TestsScene] create() started');
        fxEnter(this);
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        this.add.text(width / 2, 56, 'Tests', {
            font: `${UI.title}px monospace`,
            fill: '#000000'
        }).setOrigin(0.5);

        this.add.text(width / 2, 88, 'Pick a sandbox', {
            font: `${UI.body}px monospace`,
            fill: '#666666'
        }).setOrigin(0.5);

        const buttons = [
            { label: 'UI EDITOR', onClick: () => this.onUiEditorClick(), height: UI.menuPrimaryH, strong: true },
            { label: 'COMPOSITE UI EDITOR', onClick: () => this.onCompositeUiEditorClick(), height: UI.menuPrimaryH, strong: true },
            { label: 'UI PLAZMA BALL', onClick: () => this.onPlasmaClick(), height: UI.menuPrimaryH, strong: true },
            { label: 'HOT MAP BALL', onClick: () => this.onHotMapClick(), height: UI.menuPrimaryH, strong: true },
            { label: 'ROTATED HOT MAP BALL', onClick: () => this.onRotatedHotMapClick(), height: UI.menuPrimaryH, strong: true },
            { label: 'MOVE HOT ROD', onClick: () => this.onMoveHotRodClick(), height: UI.menuPrimaryH, strong: true },
            { label: 'BACK HIGHLIGHT', onClick: () => this.onBackHighlightClick(), height: UI.menuPrimaryH, strong: true },
            { label: 'SHARD', onClick: () => this.onShardClick(), height: UI.menuPrimaryH, strong: true },
            { label: 'SHEET', onClick: () => this.onSheetClick(), height: UI.menuPrimaryH, strong: true },
            { label: 'MOVE HOT CIRCLE', onClick: () => this.onMoveHotCircleClick(), height: UI.menuPrimaryH, strong: true },
            { label: 'BACK', onClick: () => this.onBackClick(), height: UI.menuBtnH, strong: false }
        ];
        const gap = 16;
        const mid = Math.ceil(buttons.length / 2);
        const columns = [buttons.slice(0, mid), buttons.slice(mid)];
        const columnHeight = (list) => list.reduce((sum, btn) => sum + btn.height, 0) + gap * Math.max(0, list.length - 1);
        const blockHeight = Math.max(...columns.map(columnHeight));
        const btnWidth = UI.menuBtnW;
        const blockWidth = btnWidth * 2 + gap;
        const leftX = (width - blockWidth) / 2 + btnWidth / 2;
        const xs = [leftX, leftX + btnWidth + gap];
        const top = 140 + (height - 140 - 24 - blockHeight) / 2;

        columns.forEach((column, index) => {
            let y = top;
            column.forEach((btn) => {
                this.createMenuButton(
                    xs[index],
                    y + btn.height / 2,
                    btn.label,
                    btn.onClick,
                    btn.height,
                    {
                        strong: btn.strong,
                        idleKind: btn.strong && UI.fx.menuPrimaryPulse ? 'pulse' : null,
                        particles: true
                    }
                );
                y += btn.height + gap;
            });
        });
    }

    onUiEditorClick() {
        console.log('[TestsScene] UI Editor clicked');
        fxGoTo(this, 'UIEditorScene');
    }

    onCompositeUiEditorClick() {
        console.log('[TestsScene] Composite UI Editor clicked');
        fxGoTo(this, 'CompositeUIEditorScene');
    }

    onPlasmaClick() {
        console.log('[TestsScene] UI plazma ball clicked');
        fxGoTo(this, 'UITestScene');
    }

    onHotMapClick() {
        console.log('[TestsScene] Hot map ball clicked');
        fxGoTo(this, 'HotMapBallScene');
    }

    onRotatedHotMapClick() {
        console.log('[TestsScene] Rotated hot map ball clicked');
        fxGoTo(this, 'RotatedHotMapBallScene');
    }

    onMoveHotRodClick() {
        console.log('[TestsScene] Move hot rod clicked');
        fxGoTo(this, 'MoveHotRodScene');
    }

    onBackHighlightClick() {
        console.log('[TestsScene] Back highlight clicked');
        fxGoTo(this, 'BackHighlightScene');
    }

    onShardClick() {
        console.log('[TestsScene] Shard clicked');
        fxGoTo(this, 'ShardScene');
    }

    onSheetClick() {
        console.log('[TestsScene] Sheet clicked');
        fxGoTo(this, 'SheetScene');
    }

    onMoveHotCircleClick() {
        console.log('[TestsScene] Move hot circle clicked');
        fxGoTo(this, 'MoveHotCircleScene');
    }

    onBackClick() {
        console.log('[TestsScene] Back clicked');
        fxGoTo(this, 'MenuScene');
    }

    createMenuButton(x, y, label, callback, btnHeight = UI.menuBtnH, options = {}) {
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

        bindPress(this, btn, {
            onClick: callback,
            strong: !!options.strong,
            particles: !!options.particles,
            idleKind: options.idleKind || null
        });

        if (options.idleKind) {
            fxStartIdle(this, btn, options.idleKind);
        }
        return btn;
    }
}
