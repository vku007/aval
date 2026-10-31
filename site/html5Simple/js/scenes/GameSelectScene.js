/**
 * GameSelectScene
 * Choose classic (simple) or extended game before creating a match
 */
class GameSelectScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameSelectScene' });
        console.log('[GameSelectScene] Constructor called');
    }

    create() {
        console.log('[GameSelectScene] create() started');
        fxEnter(this);
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        const user = this.registry.get('currentUser');
        const displayName = user?.name || 'Not Logged In';

        this.add.text(UI.pad, UI.pad, `Player: ${displayName}`, {
            font: `${UI.body}px monospace`,
            fill: '#000000',
            wordWrap: { width: width - UI.pad * 2 }
        }).setOrigin(0, 0);

        this.add.text(width / 2, 56, 'Warm Adventure', {
            font: `${UI.title}px monospace`,
            fill: '#000000'
        }).setOrigin(0.5);

        this.add.text(width / 2, 88, 'Choose a game', {
            font: `${UI.body}px monospace`,
            fill: '#666666'
        }).setOrigin(0.5);

        const buttons = [
            {
                label: 'BLITZ GAME',
                kind: 'blitz',
                height: UI.menuPrimaryH,
                strong: true
            },
            {
                label: 'BACK',
                kind: null,
                height: UI.menuBtnH,
                strong: false
            }
        ];
        const gap = 16;
        const totalHeight = buttons.reduce((sum, btn) => sum + btn.height, 0) + gap * (buttons.length - 1);
        let y = 140 + (height - 140 - 24 - totalHeight) / 2;

        buttons.forEach((btn) => {
            const made = this.createMenuButton(
                width / 2,
                y + btn.height / 2,
                btn.label,
                () => {
                    if (btn.kind) {
                        this.onSelectKind(btn.kind, made);
                    } else {
                        this.onBackClick();
                    }
                },
                btn.height,
                {
                    strong: btn.strong,
                    idleKind: btn.strong && UI.fx.menuPrimaryPulse ? 'pulse' : null,
                    particles: true
                }
            );
            y += btn.height + gap;
        });
    }

    onBackClick() {
        console.log('[GameSelectScene] Back clicked');
        fxGoTo(this, 'MenuScene');
    }

    onSelectKind(kind) {
        console.log('[GameSelectScene] Selected kind:', kind);
        if (kind === 'blitz') {
            fxGoTo(this, 'BlitzGameScene', undefined, { flash: true });
        }
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
