/**
 * BootScene
 * Handles procedural asset generation and loading
 */
class BootScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BootScene' });
        console.log('[BootScene] Constructor called');
    }

    preload() {
        console.log('[BootScene] preload() started');
        // Debug mode - simple text
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Title
        this.add.text(width / 2, height / 2 - 40, 'BOOT SCENE', {
            font: `${UI.title}px monospace`,
            fill: '#000000'
        }).setOrigin(0.5);
        
        this.add.text(width / 2, height / 2 + 24, 'Loading...', {
            font: `${UI.heading}px monospace`,
            fill: '#000000'
        }).setOrigin(0.5);
        
        this.add.text(width / 2, height - 28, `Canvas: ${width}x${height}`, {
            font: `${UI.small}px monospace`,
            fill: '#666666'
        }).setOrigin(0.5);

        this.generateTextures();
    }

    create() {
        console.log('[BootScene] create() started');
        
        // Perform async authentication, then transition after 5 seconds
        this.performAuth();
    }

    async performAuth() {
        console.log('[BootScene] performAuth() started');
        
        // Try existing token first
        let user = await gameAPI.initAuth();
        console.log('[BootScene] After initAuth, user:', user);
        
        // If no valid token, login as guest
        if (!user) {
            console.log('[BootScene] No valid token, logging in as guest...');
            try {
                user = await gameAPI.loginAsGuest();
                console.log('[BootScene] Guest login successful:', user);
            } catch (error) {
                console.error('[BootScene] Guest login failed:', error);
                // Continue anyway with null user
            }
        }
        
        // Store user in registry for MenuScene
        console.log('[BootScene] Storing user in registry:', user);
        this.registry.set('currentUser', user);
        console.log('[BootScene] Verify registry has user:', this.registry.get('currentUser'));
        
        // Show the boot scene for at least 5 seconds from create()
        this.time.delayedCall(5000, () => {
            console.log('[BootScene] Starting MenuScene');
            this.scene.start('MenuScene');
        });
    }

    /**
     * Generate debug wireframe textures
     */
    generateTextures() {
        // 1. Candy (Circle outline)
        const candy = this.make.graphics({ x: 0, y: 0, add: false });
        candy.lineStyle(2, 0x000000, 1);
        candy.strokeCircle(32, 32, 30);
        candy.generateTexture('candy', 64, 64);

        // 2. Jelly (Square outline)
        const jelly = this.make.graphics({ x: 0, y: 0, add: false });
        jelly.lineStyle(2, 0x000000, 1);
        jelly.strokeRect(4, 4, 56, 56);
        jelly.generateTexture('jelly', 64, 64);

        // 3. Dot (Small circle)
        const dot = this.make.graphics({ x: 0, y: 0, add: false });
        dot.lineStyle(1, 0x000000, 1);
        dot.strokeCircle(4, 4, 3);
        dot.generateTexture('dot', 8, 8);
        
        // 4. Sweet (Circle with cross)
        const sweet = this.make.graphics({ x: 0, y: 0, add: false });
        sweet.lineStyle(2, 0x000000, 1);
        sweet.strokeCircle(32, 32, 28);
        sweet.lineBetween(32, 4, 32, 60);
        sweet.lineBetween(4, 32, 60, 32);
        sweet.generateTexture('sweet', 64, 64);
    }
}

