/**
 * MenuScene
 * Candy style menu with Game, Inventory, Start Game, and Exit buttons
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

        this.titleText = this.add.text(width / 2, 56, 'Sweet Adventure', {
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
            { label: 'LOGIN', onClick: () => this.onGameClick(), height: UI.menuBtnH },
            { label: 'REGISTER', onClick: () => this.onRegisterClick(), height: UI.menuBtnH },
            { label: 'LOGOUT', onClick: () => this.onLogoutClick(), height: UI.menuBtnH },
            { label: 'INVENTORY', onClick: () => console.log('Inventory Clicked'), height: UI.menuBtnH },
            { label: 'START GAME', onClick: () => this.onStartGameClick(), height: UI.menuPrimaryH },
            { label: 'UI TESTS', onClick: () => this.onUiTestsClick(), height: UI.menuBtnH },
            { label: 'EXIT', onClick: () => console.log('Exit Clicked'), height: UI.menuBtnH },
        ];
        const gap = 16;
        const totalHeight = buttons.reduce((sum, btn) => sum + btn.height, 0) + gap * (buttons.length - 1);
        const switcherH = UI.touchMin;
        const skinH = 28;
        const buttonYStart = 120 + (height - 120 - switcherH - 24 - skinH - 12 - totalHeight) / 2;

        let y = buttonYStart;
        buttons.forEach((btn) => {
            const isPrimary = btn.label === 'START GAME';
            const made = this.createMenuButton(width / 2, y + btn.height / 2, btn.label, btn.onClick, btn.height, {
                strong: isPrimary,
                idleKind: isPrimary && UI.fx.menuPrimaryPulse ? 'pulse' : null,
                particles: true
            });
            if (isPrimary) {
                this.startGameBtn = made;
            }
            this.menuButtons.push(made);
            y += btn.height + gap;
        });

        const chipW = 170;
        const chipGap = 8;
        const chipY = height - 16 - switcherH / 2;
        const skinY = chipY - switcherH / 2 - 10 - skinH / 2;
        this.skinSwitch = createUiSkinSwitch(this, (on) => this.setMenuSkin(on), { y: skinY });
        this.createDebugChip(
            width / 2 - chipW / 2 - chipGap / 2,
            chipY,
            chipW,
            `Layout: ${UI.layout.label}`,
            () => {
                cycleUiLayout();
                writeUiQueryParams();
                this.scene.restart();
            }
        );
        this.createDebugChip(
            width / 2 + chipW / 2 + chipGap / 2,
            chipY,
            chipW,
            `FX: ${UI.fx.label}`,
            () => {
                cycleUiFx();
                writeUiQueryParams();
                this.scene.restart();
            }
        );
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
            const btn = buttons.find((candidate) => menuHighlightKey(candidate.menuLabel) === key);
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
            if (!this.skinHost) {
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

    /**
     * Handle LOGIN button click - show in-canvas login modal
     */
    onGameClick(x, y) {
        console.log('Login button clicked');
        
        // Launch login modal scene as overlay
        this.scene.launch('LoginModalScene', {
            onLoginSuccess: (user) => this.updatePlayerPanel(user)
        });
    }

    onRegisterClick() {
        console.log('[MenuScene] onRegisterClick() called');
        
        // Check if user is already a regular user
        // Guest users have the name "Guest User"
        const user = this.registry.get('currentUser');
        console.log('[MenuScene] Current user:', user);
        console.log('[MenuScene] User name:', user?.name);
        console.log('[MenuScene] Is guest?', user?.name === 'Guest User');
        
        if (user && user.name !== 'Guest User') {
            // Already a regular user
            console.log('[MenuScene] User is already registered, not showing modal');
            // Could show a message or do nothing
            return;
        }
        
        console.log('[MenuScene] Launching RegisterModalScene...');
        // Launch register modal scene as overlay
        this.scene.launch('RegisterModalScene', {
            onRegisterSuccess: (user) => this.updatePlayerPanel(user)
        });
        console.log('[MenuScene] RegisterModalScene launch command sent');
    }

    onLogoutClick() {
        if (typeof gameAPI !== 'undefined' && typeof gameAPI.clearAuth === 'function') {
            gameAPI.clearAuth();
        } else {
            localStorage.removeItem('aval_auth_token');
            localStorage.removeItem('idToken');
        }
        this.registry.set('currentUser', null);
        window.location.reload();
    }

    onStartGameClick() {
        console.log('[MenuScene] Start Game button clicked');
        fxGoTo(this, 'GameSelectScene', undefined, { flash: true });
    }

    onUiTestsClick() {
        console.log('[MenuScene] UI Tests button clicked');
        fxGoTo(this, 'TestsScene');
    }

    updatePlayerPanel(user) {
        // Update the player text
        if (this.playerText && user?.name) {
            this.playerText.setText(`Player: ${user.name}`);
            this.currentDisplayName = user.name;
            this.registry.set('currentUser', user);
            console.log('[MenuScene] Player panel updated to:', user.name);
        }
    }

    createDebugChip(x, y, btnWidth, label, onClick) {
        const btn = this.add.container(x, y);
        const btnHeight = UI.touchMin;

        const bg = this.add.graphics();
        bg.lineStyle(2, 0x000000, 1);
        bg.strokeRect(-btnWidth/2, -btnHeight/2, btnWidth, btnHeight);

        const text = this.add.text(0, 0, label, {
            font: `${UI.body}px monospace`,
            fill: '#000000'
        }).setOrigin(0.5);

        btn.add([bg, text]);

        const hitArea = new Phaser.Geom.Rectangle(-btnWidth/2, -btnHeight/2, btnWidth, btnHeight);
        btn.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains, { useHandCursor: true });
        bindPress(this, btn, { onClick });
        return btn;
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

