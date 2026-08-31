/**
 * Boot Scene - Casual iPhone Game Style
 * Bright colors, bouncy animations, friendly loading
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
    
    // Set cheerful background
    this.cameras.main.setBackgroundColor('#f0f4ff');
    
    // Create cute loading animation
    this.createLoadingUI(width, height);
    
    // Progress events
    this.load.on('progress', (value) => {
      console.log('[BootScene] Load progress:', Math.round(value * 100) + '%');
      this.updateProgress(value);
    });

    this.load.on('complete', () => {
      console.log('[BootScene] Assets loaded');
    });

    console.log('[BootScene] preload() completed (no external assets needed)');
  }

  /**
   * Create cheerful loading UI
   */
  createLoadingUI(width, height) {
    // Bouncing mascot circles
    const colors = [0x5B7FFF, 0xFF6B9D, 0xFFB347];
    this.loadingBalls = [];
    
    for (let i = 0; i < 3; i++) {
      const ball = this.add.circle(
        width / 2 - 50 + (i * 50),
        height / 2 - 30,
        15,
        colors[i]
      );
      
      // Add cute face to middle ball
      if (i === 1) {
        // Eyes
        this.add.circle(ball.x - 5, ball.y - 3, 3, 0xffffff);
        this.add.circle(ball.x + 5, ball.y - 3, 3, 0xffffff);
        this.add.circle(ball.x - 5, ball.y - 3, 1.5, 0x2D3436);
        this.add.circle(ball.x + 5, ball.y - 3, 1.5, 0x2D3436);
        // Smile
        const smile = this.add.graphics();
        smile.lineStyle(2, 0x2D3436);
        smile.beginPath();
        smile.arc(ball.x, ball.y + 2, 6, 0.2, Math.PI - 0.2);
        smile.strokePath();
      }
      
      // Bouncing animation
      this.tweens.add({
        targets: ball,
        y: ball.y - 20,
        duration: 400,
        ease: 'Quad.easeOut',
        yoyo: true,
        repeat: -1,
        delay: i * 150
      });
      
      this.loadingBalls.push(ball);
    }
    
    // Loading text
    this.loadingText = this.add.text(width / 2, height / 2 + 40, 'Loading...', {
      fontFamily: 'Fredoka, Nunito, sans-serif',
      fontSize: '24px',
      fontWeight: '600',
      color: '#636E72'
    }).setOrigin(0.5);
    
    // Progress bar background
    this.progressBg = this.add.graphics();
    this.progressBg.fillStyle(0xe0e0e0, 1);
    this.progressBg.fillRoundedRect(width / 2 - 100, height / 2 + 70, 200, 16, 8);
    
    // Progress bar fill
    this.progressBar = this.add.graphics();
    
    // Fun tip text
    const tips = [
      '✨ Getting things ready...',
      '🎮 Preparing the fun...',
      '🌟 Almost there...',
      '🎨 Adding colors...'
    ];
    this.tipText = this.add.text(width / 2, height / 2 + 110, tips[0], {
      fontFamily: 'Nunito, sans-serif',
      fontSize: '14px',
      color: '#B2BEC3'
    }).setOrigin(0.5);
    
    // Cycle through tips
    let tipIndex = 0;
    this.time.addEvent({
      delay: 800,
      callback: () => {
        tipIndex = (tipIndex + 1) % tips.length;
        this.tipText.setText(tips[tipIndex]);
      },
      loop: true
    });
  }

  /**
   * Update progress bar
   */
  updateProgress(value) {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    
    this.progressBar.clear();
    
    // Gradient-like effect with solid color
    const progressWidth = 196 * value;
    if (progressWidth > 0) {
      this.progressBar.fillStyle(0x5B7FFF, 1);
      this.progressBar.fillRoundedRect(
        width / 2 - 98,
        height / 2 + 72,
        progressWidth,
        12,
        6
      );
    }
  }

  create() {
    console.log('[BootScene] create() started');
    
    // Run async initialization
    this.initializeGame().catch(error => {
      console.error('[BootScene] Initialization error:', error);
      this.finishInitialization();
    });
  }

  async initializeGame() {
    console.log('[BootScene] initializeGame() started');
    
    // Update loading text
    this.loadingText.setText('Creating world...');
    
    // Generate cartoon-style textures
    console.log('[BootScene] Generating textures...');
    await this.delay(300); // Small delay for visual feedback
    this.generateTextures();
    console.log('[BootScene] Textures generated');
    
    // Update loading text
    this.loadingText.setText('Connecting...');
    
    // Initialize authentication
    console.log('[BootScene] Initializing auth...');
    await this.initAuth();
    console.log('[BootScene] Auth initialized');
    
    // Final loading
    this.loadingText.setText('Ready! 🎉');
    await this.delay(500);
    
    // Finish initialization
    this.finishInitialization();
  }

  /**
   * Simple delay helper
   */
  delay(ms) {
    return new Promise(resolve => this.time.delayedCall(ms, resolve));
  }

  finishInitialization() {
    console.log('[BootScene] finishInitialization() called');
    
    // Hide HTML loading screen
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
      console.log('[BootScene] Hiding loading screen');
      loadingScreen.classList.add('hidden');
    }
    
    // Update connection status
    const statusEl = document.getElementById('connection-status');
    const indicatorEl = document.querySelector('.status-indicator');
    if (statusEl) statusEl.textContent = 'Online';
    if (indicatorEl) indicatorEl.classList.add('connected');
    
    console.log('[BootScene] Transitioning to MenuScene...');
    
    // Fun transition effect
    this.cameras.main.fadeOut(300, 255, 255, 255);
    this.time.delayedCall(300, () => {
      this.scene.start('MenuScene');
    });
  }

  /**
   * Generate cartoon-style procedural textures
   */
  generateTextures() {
    console.log('[BootScene] generateTextures() started');
    
    try {
      // Player - Cute blue character
      const playerGraphics = this.make.graphics({ x: 0, y: 0 });
      playerGraphics.fillStyle(0x5B7FFF, 1);
      playerGraphics.fillRoundedRect(4, 4, 32, 32, 8);
      // Highlight
      playerGraphics.fillStyle(0x7B9FFF, 1);
      playerGraphics.fillRoundedRect(6, 6, 12, 8, 4);
      // Eyes
      playerGraphics.fillStyle(0xffffff, 1);
      playerGraphics.fillCircle(14, 18, 5);
      playerGraphics.fillCircle(26, 18, 5);
      playerGraphics.fillStyle(0x2D3436, 1);
      playerGraphics.fillCircle(15, 18, 2.5);
      playerGraphics.fillCircle(27, 18, 2.5);
      // Smile
      playerGraphics.lineStyle(2, 0x2D3436);
      playerGraphics.beginPath();
      playerGraphics.arc(20, 26, 6, 0.3, Math.PI - 0.3);
      playerGraphics.strokePath();
      playerGraphics.generateTexture('player', 40, 40);
      playerGraphics.destroy();
      console.log('[BootScene] Created player texture');

      // Ball - Bouncy yellow ball
      const ballGraphics = this.make.graphics({ x: 0, y: 0 });
      ballGraphics.fillStyle(0xFFCC00, 1);
      ballGraphics.fillCircle(16, 16, 14);
      // Highlight
      ballGraphics.fillStyle(0xFFE066, 1);
      ballGraphics.fillCircle(11, 11, 5);
      // Outline
      ballGraphics.lineStyle(2, 0xE6B800);
      ballGraphics.strokeCircle(16, 16, 13);
      ballGraphics.generateTexture('ball', 32, 32);
      ballGraphics.destroy();
      console.log('[BootScene] Created ball texture');

      // Crate - Cute wooden box
      const crateGraphics = this.make.graphics({ x: 0, y: 0 });
      crateGraphics.fillStyle(0xFFB347, 1);
      crateGraphics.fillRoundedRect(2, 2, 28, 28, 4);
      // Wood pattern
      crateGraphics.lineStyle(2, 0xE69A30);
      crateGraphics.lineBetween(2, 16, 30, 16);
      crateGraphics.lineBetween(16, 2, 16, 30);
      // Highlight
      crateGraphics.fillStyle(0xFFCC7A, 1);
      crateGraphics.fillRoundedRect(4, 4, 10, 6, 2);
      crateGraphics.generateTexture('crate', 32, 32);
      crateGraphics.destroy();
      console.log('[BootScene] Created crate texture');

      // Star - Collectible star
      const starGraphics = this.make.graphics({ x: 0, y: 0 });
      starGraphics.fillStyle(0xFFCC00, 1);
      this.drawStar(starGraphics, 16, 16, 5, 12, 6);
      starGraphics.fillStyle(0xFFE066, 1);
      this.drawStar(starGraphics, 14, 14, 5, 6, 3);
      starGraphics.generateTexture('star', 32, 32);
      starGraphics.destroy();
      console.log('[BootScene] Created star texture');

      // Heart - Life/health
      const heartGraphics = this.make.graphics({ x: 0, y: 0 });
      heartGraphics.fillStyle(0xFF6B9D, 1);
      this.drawHeart(heartGraphics, 16, 14, 12);
      heartGraphics.fillStyle(0xFF8FB3, 1);
      heartGraphics.fillCircle(11, 11, 4);
      heartGraphics.generateTexture('heart', 32, 32);
      heartGraphics.destroy();
      console.log('[BootScene] Created heart texture');

      // Platform - Green grassy platform
      const platformGraphics = this.make.graphics({ x: 0, y: 0 });
      platformGraphics.fillStyle(0x4CD964, 1);
      platformGraphics.fillRoundedRect(0, 4, 128, 20, 6);
      // Grass top
      platformGraphics.fillStyle(0x5DE075, 1);
      platformGraphics.fillRoundedRect(0, 2, 128, 10, 6);
      // Grass details
      platformGraphics.fillStyle(0x6EE786, 1);
      for (let i = 0; i < 8; i++) {
        platformGraphics.fillTriangle(
          8 + i * 16, 2,
          12 + i * 16, -4,
          16 + i * 16, 2
        );
      }
      platformGraphics.generateTexture('platform', 128, 24);
      platformGraphics.destroy();
      console.log('[BootScene] Created platform texture');

      // Cloud - Fluffy cloud
      const cloudGraphics = this.make.graphics({ x: 0, y: 0 });
      cloudGraphics.fillStyle(0xffffff, 0.9);
      cloudGraphics.fillCircle(20, 20, 15);
      cloudGraphics.fillCircle(40, 18, 18);
      cloudGraphics.fillCircle(60, 20, 15);
      cloudGraphics.fillCircle(30, 28, 12);
      cloudGraphics.fillCircle(50, 28, 12);
      cloudGraphics.generateTexture('cloud', 80, 40);
      cloudGraphics.destroy();
      console.log('[BootScene] Created cloud texture');

      // Coin - Golden coin
      const coinGraphics = this.make.graphics({ x: 0, y: 0 });
      coinGraphics.fillStyle(0xFFCC00, 1);
      coinGraphics.fillCircle(12, 12, 10);
      coinGraphics.lineStyle(2, 0xE6B800);
      coinGraphics.strokeCircle(12, 12, 9);
      // Dollar sign or star
      coinGraphics.fillStyle(0xE6B800, 1);
      coinGraphics.fillCircle(12, 12, 4);
      coinGraphics.fillStyle(0xFFE066, 1);
      coinGraphics.fillCircle(9, 9, 3);
      coinGraphics.generateTexture('coin', 24, 24);
      coinGraphics.destroy();
      console.log('[BootScene] Created coin texture');

      console.log('[BootScene] All procedural textures generated successfully');
    } catch (error) {
      console.error('[BootScene] Error generating textures:', error);
      throw error;
    }
  }

  /**
   * Draw a star shape
   */
  drawStar(graphics, cx, cy, spikes, outerRadius, innerRadius) {
    let rot = Math.PI / 2 * 3;
    let step = Math.PI / spikes;
    
    graphics.beginPath();
    graphics.moveTo(cx, cy - outerRadius);
    
    for (let i = 0; i < spikes; i++) {
      let x = cx + Math.cos(rot) * outerRadius;
      let y = cy + Math.sin(rot) * outerRadius;
      graphics.lineTo(x, y);
      rot += step;
      
      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      graphics.lineTo(x, y);
      rot += step;
    }
    
    graphics.lineTo(cx, cy - outerRadius);
    graphics.closePath();
    graphics.fillPath();
  }

  /**
   * Draw a heart shape
   */
  drawHeart(graphics, cx, cy, size) {
    graphics.beginPath();
    graphics.moveTo(cx, cy + size * 0.4);
    
    // Left curve
    graphics.bezierCurveTo(
      cx - size * 0.5, cy,
      cx - size * 0.5, cy - size * 0.5,
      cx, cy - size * 0.3
    );
    
    // Right curve
    graphics.bezierCurveTo(
      cx + size * 0.5, cy - size * 0.5,
      cx + size * 0.5, cy,
      cx, cy + size * 0.4
    );
    
    graphics.closePath();
    graphics.fillPath();
  }

  /**
   * Initialize authentication
   */
  async initAuth() {
    console.log('[BootScene] initAuth() started');
    
    // Check for token in URL
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');
    
    if (tokenFromUrl) {
      console.log('[BootScene] Found token in URL');
      gameAPI.setToken(tokenFromUrl);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    // Try to authenticate
    try {
      console.log('[BootScene] Attempting auth...');
      const user = await gameAPI.initAuth();
      
      if (user) {
        console.log('[BootScene] Authenticated:', user.name || user.id);
        this.updateUserUI(user);
        this.registry.set('user', user);
        this.registry.set('authenticated', true);
      } else {
        console.log('[BootScene] Guest mode');
        this.registry.set('authenticated', false);
        this.updateUserUI(null);
      }
    } catch (error) {
      console.error('[BootScene] Auth error:', error);
      this.registry.set('authenticated', false);
      this.updateUserUI(null);
    }
    
    // Setup logout
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        gameAPI.clearAuth();
        this.registry.set('authenticated', false);
        this.registry.set('user', null);
        this.updateUserUI(null);
        this.scene.start('MenuScene');
      });
    }
    
    console.log('[BootScene] initAuth() completed');
  }

  /**
   * Update user UI
   */
  updateUserUI(user) {
    const userNameEl = document.getElementById('user-name');
    const logoutBtn = document.getElementById('logout-btn');
    
    if (user) {
      if (userNameEl) userNameEl.textContent = `👋 ${user.name || 'Player'}`;
      if (logoutBtn) logoutBtn.style.display = 'block';
    } else {
      if (userNameEl) userNameEl.textContent = '👤 Guest';
      if (logoutBtn) logoutBtn.style.display = 'none';
    }
  }
}

console.log('[BootScene.js] Script loaded');
