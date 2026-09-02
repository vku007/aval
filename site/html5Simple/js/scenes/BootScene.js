/**
 * BootScene
 * Handles procedural asset generation, guest auth, then fade to menu
 */
class BootScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BootScene' });
        console.log('[BootScene] Constructor called');
    }

    preload() {
        console.log('[BootScene] preload() started');
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        this.add.text(width / 2, height / 2 - 40, 'Sweet Adventure', {
            font: `${UI.title}px monospace`,
            fill: '#000000'
        }).setOrigin(0.5);

        this.subtitleText = this.add.text(width / 2, height / 2 + 24, 'Getting ready...', {
            font: `${UI.heading}px monospace`,
            fill: '#000000'
        }).setOrigin(0.5);

        if (isUiDebug()) {
            this.add.text(width / 2, height - 28, `Canvas: ${width}x${height}`, {
                font: `${UI.small}px monospace`,
                fill: '#666666'
            }).setOrigin(0.5);
        }

        this.generateTextures();
    }

    create() {
        console.log('[BootScene] create() started');
        fxEnter(this);
        this.bootStartedAt = Date.now();
        this.authDone = false;
        this._leftBoot = false;
        this.input.on('pointerdown', this.trySkipBoot, this);
        this.performAuth();
    }

    trySkipBoot() {
        if (!this.authDone) return;
        this.goToMenu();
    }

    async performAuth() {
        console.log('[BootScene] performAuth() started');

        let user = await gameAPI.initAuth();
        console.log('[BootScene] After initAuth, user:', user);

        if (!user) {
            console.log('[BootScene] No valid token, logging in as guest...');
            try {
                user = await gameAPI.loginAsGuest();
                console.log('[BootScene] Guest login successful:', user);
            } catch (error) {
                console.error('[BootScene] Guest login failed:', error);
            }
        }

        console.log('[BootScene] Storing user in registry:', user);
        this.registry.set('currentUser', user);

        this.authDone = true;
        if (this.subtitleText) {
            this.subtitleText.setText('Tap to continue');
        }

        const elapsed = Date.now() - this.bootStartedAt;
        const wait = Math.max(0, 800 - elapsed);
        this.time.delayedCall(wait, () => this.goToMenu());
    }

    goToMenu() {
        if (this._leftBoot) return;
        this._leftBoot = true;
        this.input.off('pointerdown', this.trySkipBoot, this);
        console.log('[BootScene] Starting MenuScene');
        fxGoTo(this, 'MenuScene', undefined, { flash: true });
    }

    /**
     * Generate debug wireframe textures
     */
    generateTextures() {
        const candy = this.make.graphics({ x: 0, y: 0, add: false });
        candy.lineStyle(2, 0x000000, 1);
        candy.strokeCircle(32, 32, 30);
        candy.generateTexture('candy', 64, 64);

        const jelly = this.make.graphics({ x: 0, y: 0, add: false });
        jelly.lineStyle(2, 0x000000, 1);
        jelly.strokeRect(4, 4, 56, 56);
        jelly.generateTexture('jelly', 64, 64);

        const dot = this.make.graphics({ x: 0, y: 0, add: false });
        dot.lineStyle(1, 0x000000, 1);
        dot.strokeCircle(4, 4, 3);
        dot.generateTexture('dot', 8, 8);

        const sweet = this.make.graphics({ x: 0, y: 0, add: false });
        sweet.lineStyle(2, 0x000000, 1);
        sweet.strokeCircle(32, 32, 28);
        sweet.lineBetween(32, 4, 32, 60);
        sweet.lineBetween(4, 32, 60, 32);
        sweet.generateTexture('sweet', 64, 64);
    }
}
