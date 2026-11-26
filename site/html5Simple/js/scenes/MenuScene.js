/**
 * MenuScene
 * Candy style menu with the account button, Start Game, UI Tests, and Exit
 */
class MenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MenuScene' });
        console.log('[MenuScene] Constructor called');
    }

    init() {
        exitTestsCanvas(this);
    }

    create() {
        exitTestsCanvas(this);
        console.log('[MenuScene] create() started');
        fxEnter(this);
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        this.skinHost = null;
        this.menuButtons = [];
        // Get user from registry
        const user = this.registry.get('currentUser');
        console.log('[MenuScene] User from registry:', user);
        const displayName = user?.name || 'Not Logged In';
        console.log('[MenuScene] Display name:', displayName);
        
        // User panel (upper left corner)
        this.playerText = this.add.text(UI.pad, UI.pad, `Player: ${displayName}`, {
            font: `${UI.body}px monospace`,
            fill: '#000000',
            wordWrap: { width: width - UI.pad * 2 }
        }).setOrigin(0, 0);

        this.currentDisplayName = displayName;

        this.titleText = this.add.text(width / 2, 56, 'Warm Adventure', {
            font: `${UI.title}px monospace`,
            fill: '#000000'
        }).setOrigin(0.5);

        this.subtitleText = this.add.text(width / 2, 88, 'Pick a match', {
            font: `${UI.body}px monospace`,
            fill: '#666666'
        }).setOrigin(0.5);

        if (isUiDebug()) {
            this.add.text(width / 2, 108, `${width}x${height}`, {
                font: `${UI.small}px monospace`,
                fill: '#666666'
            }).setOrigin(0.5);
        }

        const buttons = [
            {
                label: accountButtonLabel(this.registry.get('role')),
                heatName: 'Account',
                onClick: () => this.onAccountClick(),
                height: UI.menuBtnH
            },
            { label: 'START GAME', onClick: () => this.onStartGameClick(), height: UI.menuPrimaryH },
            { label: 'UI TESTS', onClick: () => this.onUiTestsClick(), height: UI.menuBtnH },
            { label: 'EXIT', onClick: () => console.log('Exit Clicked'), height: UI.menuBtnH },
        ];
        const gap = 16;
        const totalHeight = buttons.reduce((sum, btn) => sum + btn.height, 0) + gap * (buttons.length - 1);
        const skinH = 28;
        const skinMargin = 16;
        const buttonYStart = 120 + (height - 120 - skinH - skinMargin - 12 - totalHeight) / 2;

        let y = buttonYStart;
        buttons.forEach((btn) => {
            const isPrimary = btn.label === 'START GAME';
            const made = this.createMenuButton(width / 2, y + btn.height / 2, btn.label, btn.onClick, btn.height, {
                strong: isPrimary,
                idleKind: isPrimary && UI.fx.menuPrimaryPulse ? 'pulse' : null,
                particles: true,
                heatName: btn.heatName || ''
            });
            if (btn.heatName === 'Account') {
                this.accountBtn = made;
            }
            if (isPrimary) {
                this.startGameBtn = made;
            }
            this.menuButtons.push(made);
            y += btn.height + gap;
        });

        const skinY = height - skinMargin - skinH / 2;
        this.skinSwitch = createUiSkinSwitch(this, (on) => this.setMenuSkin(on), { y: skinY });
        this.setMenuSkin(isUiSkinOn());
    }

    linkMenuHighlights() {
        const list = this.skinHost && this.skinHost.highlighters;
        if (!list || !list.length) {
            return;
        }
        const buttons = this.menuButtons || [];
        list.forEach((item) => {
            const key = menuHighlightKey(item.name);
            if (!key) {
                return;
            }
            const btn = buttons.find((candidate) => {
                const name = candidate.heatName || candidate.menuLabel;
                return menuHighlightKey(name) === key;
            });
            if (!btn || btn.menuHighlight === item) {
                return;
            }
            item.armHover();
            btn.menuHighlight = item;
            btn.on('pointerover', () => item.setHovered(true));
            btn.on('pointerout', () => item.setHovered(false));
            if (pointerInsideMenuButton(this, btn)) {
                item.setHovered(true);
            }
        });
    }

    update(time, delta) {
        if (this.skinHost && isUiSkinOn()) {
            this.skinHost.update(time, delta);
        }
    }

    setMenuSkin(on) {
        if (on) {
            if (!this.menuSkinLive()) {
                if (this.skinHost) {
                    this.skinHost.setVisible(false);
                    this.skinHost = null;
                }
                const width = this.cameras.main.width;
                const height = this.cameras.main.height;
                this.skinHost = mountUiSkin(this, { x: 0, y: 0, width, height });
            }
            if (this.skinHost) {
                this.skinHost.setVisible(true);
                this.linkMenuHighlights();
            }
        } else if (this.skinHost) {
            this.skinHost.setVisible(false);
        }
        styleUiSkinText(this.playerText, on);
        styleUiSkinText(this.titleText, on);
        styleUiSkinText(this.subtitleText, on);
        (this.menuButtons || []).forEach((btn) => {
            styleUiSkinMenuButton(this, btn, on);
        });
    }

    menuSkinLive() {
        const host = this.skinHost;
        if (!host || !host.heatMap || host.heatMap.scene !== this) {
            return false;
        }
        const lists = [host.balls, host.rods, host.highlighters];
        return lists.every((list) => (list || []).every((item) => heatMapOwns(host.heatMap, item)));
    }

    onAccountClick() {
        if (this.scene.isActive('AccountModalScene')) return;
        const mode = accountButtonLabel(this.registry.get('role')) === 'LOG OUT' ? 'logout' : 'sign-in';
        this.scene.launch('AccountModalScene', {
            mode: mode,
            onSuccess: (user, role) => this.updatePlayerPanel(user, role)
        });
    }

    setAccountLabel(label) {
        const btn = this.accountBtn;
        if (!btn || !btn.buttonText) return;
        btn.buttonText.setText(label);
        btn.menuLabel = label;
        styleUiSkinMenuButton(this, btn, isUiSkinOn());
    }

    onStartGameClick() {
        console.log('[MenuScene] Start Game button clicked');
        fxGoTo(this, 'GameSelectScene', undefined, { flash: true });
    }

    onUiTestsClick() {
        console.log('[MenuScene] UI Tests button clicked');
        fxGoTo(this, 'TestsScene');
    }

    updatePlayerPanel(user, role) {
        const nextRole = arguments.length > 1 ? role : tokenRole(gameAPI.token);
        this.registry.set('role', nextRole);
        if (user) {
            this.registry.set('currentUser', user);
            if (this.playerText && user.name) {
                this.playerText.setText(`Player: ${user.name}`);
                this.currentDisplayName = user.name;
            }
        }
        this.setAccountLabel(accountButtonLabel(nextRole));
    }

    createMenuButton(x, y, label, callback, btnHeight = UI.menuBtnH, options = {}) {
        const btn = this.add.container(x, y);
        
        const btnWidth = UI.menuBtnW;

        const bg = this.add.graphics();
        bg.lineStyle(2, 0x000000, 1);
        bg.strokeRect(-btnWidth/2, -btnHeight/2, btnWidth, btnHeight);
        
        const text = this.add.text(0, 0, label, {
            font: `${UI.heading}px monospace`,
            fill: '#000000'
        }).setOrigin(0.5);
        
        btn.add([bg, text]);
        btn.menuLabel = label;
        btn.heatName = options.heatName || '';
        btn.buttonBg = bg;
        btn.buttonText = text;
        btn.buttonWidth = btnWidth;
        btn.buttonHeight = btnHeight;
        
        const hitArea = new Phaser.Geom.Rectangle(-btnWidth/2, -btnHeight/2, btnWidth, btnHeight);
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

function menuHighlightKey(name) {
    return String(name || '').toLowerCase().replace(/\s+/g, '');
}

function pointerInsideMenuButton(scene, btn) {
    const pointer = scene.input && scene.input.activePointer;
    if (!pointer || !btn) {
        return false;
    }
    const bounds = btn.getBounds();
    return Phaser.Geom.Rectangle.Contains(bounds, pointer.worldX, pointer.worldY);
}

