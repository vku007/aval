/**
 * Menu Scene - Casual iPhone Game Style
 * Bright, cheerful, bouncy animations
 */
class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
    console.log('[MenuScene] Constructor called');
  }

  create() {
    console.log('[MenuScene] create() started');
    
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    
    // Set bright background
    this.cameras.main.setBackgroundColor('#f0f4ff');
    
    // Fade in
    this.cameras.main.fadeIn(300, 255, 255, 255);
    
    // Create background decorations
    this.createBackground(width, height);
    
    // Title with bounce-in animation
    this.createTitle(width);
    
    // Menu buttons
    this.createMenuButtons(width, height);
    
    // Auth status
    this.createAuthStatus(width, height);
    
    // Floating decorations
    this.createFloatingDecorations(width, height);
    
    console.log('[MenuScene] create() completed');
  }

  /**
   * Create cheerful background
   */
  createBackground(width, height) {
    // Soft gradient circles
    const bg = this.add.graphics();
    
    // Large soft circles
    bg.fillStyle(0x5B7FFF, 0.08);
    bg.fillCircle(100, 150, 200);
    
    bg.fillStyle(0xFF6B9D, 0.06);
    bg.fillCircle(width - 80, height - 100, 180);
    
    bg.fillStyle(0xFFB347, 0.06);
    bg.fillCircle(width - 150, 100, 120);
    
    // Small decorative dots
    const dotColors = [0x5B7FFF, 0xFF6B9D, 0xFFB347, 0x4CD964, 0xFFCC00];
    for (let i = 0; i < 20; i++) {
      const color = dotColors[i % dotColors.length];
      const x = Phaser.Math.Between(50, width - 50);
      const y = Phaser.Math.Between(50, height - 50);
      const size = Phaser.Math.Between(3, 8);
      
      const dot = this.add.circle(x, y, size, color, 0.2);
      
      // Gentle floating animation
      this.tweens.add({
        targets: dot,
        y: y + Phaser.Math.Between(-20, 20),
        alpha: Phaser.Math.FloatBetween(0.1, 0.3),
        duration: Phaser.Math.Between(2000, 4000),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    }
  }

  /**
   * Create animated title
   */
  createTitle(width) {
    // Main title
    const title = this.add.text(width / 2, -50, 'AVAL', {
      fontFamily: 'Fredoka, Nunito, sans-serif',
      fontSize: '72px',
      fontWeight: '700',
      color: '#5B7FFF'
    }).setOrigin(0.5);
    
    // Add shadow/outline effect
    title.setShadow(3, 3, '#4A6FEF', 0);
    
    // Bounce in animation
    this.tweens.add({
      targets: title,
      y: 90,
      duration: 800,
      ease: 'Bounce.easeOut'
    });
    
    // Subtitle
    const subtitle = this.add.text(width / 2, 145, '🎮 Fun Physics Game', {
      fontFamily: 'Nunito, sans-serif',
      fontSize: '20px',
      fontWeight: '600',
      color: '#636E72'
    }).setOrigin(0.5).setAlpha(0);
    
    // Fade in subtitle
    this.tweens.add({
      targets: subtitle,
      alpha: 1,
      delay: 500,
      duration: 400
    });
    
    // Gentle wiggle on title
    this.tweens.add({
      targets: title,
      angle: { from: -2, to: 2 },
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      delay: 1000
    });
  }

  /**
   * Create menu buttons
   */
  createMenuButtons(width, height) {
    const buttonY = height / 2 + 20;
    const buttons = [
      { text: '▶️  PLAY', color: 0x5B7FFF, callback: () => this.onPlayClick() },
      { text: '⚙️  SETTINGS', color: 0xFF6B9D, callback: () => this.onSettingsClick() },
      { text: '🏆  SCORES', color: 0xFFB347, callback: () => this.onScoresClick() }
    ];
    
    buttons.forEach((btn, index) => {
      const y = buttonY + (index * 70);
      this.createButton(width / 2, y, btn.text, btn.color, btn.callback, index);
    });
  }

  /**
   * Create a cartoon-style button
   */
  createButton(x, y, text, color, callback, index) {
    const btnWidth = 220;
    const btnHeight = 55;
    
    // Button container (starts off-screen)
    const container = this.add.container(x + 400, y);
    
    // Button shadow
    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.15);
    shadow.fillRoundedRect(-btnWidth/2 + 4, -btnHeight/2 + 6, btnWidth, btnHeight, 16);
    
    // Button background
    const bg = this.add.graphics();
    bg.fillStyle(color, 1);
    bg.fillRoundedRect(-btnWidth/2, -btnHeight/2, btnWidth, btnHeight, 16);
    
    // Button highlight (top shine)
    const highlight = this.add.graphics();
    highlight.fillStyle(0xffffff, 0.3);
    highlight.fillRoundedRect(-btnWidth/2 + 8, -btnHeight/2 + 4, btnWidth - 16, 20, 10);
    
    // Button text
    const label = this.add.text(0, 0, text, {
      fontFamily: 'Fredoka, Nunito, sans-serif',
      fontSize: '22px',
      fontWeight: '600',
      color: '#ffffff'
    }).setOrigin(0.5);
    
    // Add shadow to text
    label.setShadow(1, 2, 'rgba(0,0,0,0.2)', 0);
    
    container.add([shadow, bg, highlight, label]);
    
    // Slide in animation
    this.tweens.add({
      targets: container,
      x: x,
      duration: 500,
      ease: 'Back.easeOut',
      delay: 200 + (index * 100)
    });
    
    // Interactive area
    const hitArea = this.add.rectangle(x, y, btnWidth, btnHeight, 0xffffff, 0);
    hitArea.setInteractive({ useHandCursor: true });
    
    // Store original position
    container.originalY = y;
    
    // Hover effect
    hitArea.on('pointerover', () => {
      this.tweens.add({
        targets: container,
        scaleX: 1.08,
        scaleY: 1.08,
        y: y - 4,
        duration: 150,
        ease: 'Back.easeOut'
      });
    });
    
    hitArea.on('pointerout', () => {
      this.tweens.add({
        targets: container,
        scaleX: 1,
        scaleY: 1,
        y: y,
        duration: 150,
        ease: 'Quad.easeOut'
      });
    });
    
    // Click effect
    hitArea.on('pointerdown', () => {
      this.tweens.add({
        targets: container,
        scaleX: 0.95,
        scaleY: 0.95,
        duration: 100,
        yoyo: true,
        onComplete: () => {
          // Play a "pop" effect
          this.addClickEffect(x, y, color);
          callback();
        }
      });
    });
    
    return container;
  }

  /**
   * Add click particle effect
   */
  addClickEffect(x, y, color) {
    // Create burst of particles
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const particle = this.add.circle(x, y, 6, color, 0.8);
      
      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * 50,
        y: y + Math.sin(angle) * 50,
        alpha: 0,
        scale: 0.3,
        duration: 400,
        ease: 'Quad.easeOut',
        onComplete: () => particle.destroy()
      });
    }
  }

  /**
   * Create auth status display
   */
  createAuthStatus(width, height) {
    const isAuth = this.registry.get('authenticated');
    const user = this.registry.get('user');
    
    // Status container
    const statusY = height - 60;
    
    if (isAuth && user) {
      // Welcome message with avatar
      const welcomeText = this.add.text(width / 2, statusY, `👋 Welcome, ${user.name || 'Player'}!`, {
        fontFamily: 'Nunito, sans-serif',
        fontSize: '16px',
        fontWeight: '700',
        color: '#4CD964'
      }).setOrigin(0.5);
    } else {
      // Guest mode with login prompt
      const guestText = this.add.text(width / 2, statusY - 10, '🎮 Playing as Guest', {
        fontFamily: 'Nunito, sans-serif',
        fontSize: '14px',
        fontWeight: '600',
        color: '#636E72'
      }).setOrigin(0.5);
      
      // Login button (smaller, subtle)
      this.createSmallButton(width / 2, statusY + 20, '🔐 Login to Save', 0xAF7AC5, () => this.goToLogin());
    }
    
    // Version
    this.add.text(width - 15, height - 15, 'v1.0', {
      fontFamily: 'Nunito, sans-serif',
      fontSize: '11px',
      color: '#B2BEC3'
    }).setOrigin(1, 1);
  }

  /**
   * Create a small text button
   */
  createSmallButton(x, y, text, color, callback) {
    const btn = this.add.text(x, y, text, {
      fontFamily: 'Nunito, sans-serif',
      fontSize: '13px',
      fontWeight: '700',
      color: '#' + color.toString(16).padStart(6, '0')
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    
    btn.on('pointerover', () => btn.setScale(1.1));
    btn.on('pointerout', () => btn.setScale(1));
    btn.on('pointerdown', callback);
    
    return btn;
  }

  /**
   * Create floating decorations
   */
  createFloatingDecorations(width, height) {
    // Add floating game elements in background
    const decorations = ['star', 'coin', 'heart'];
    
    decorations.forEach((key, i) => {
      if (!this.textures.exists(key)) {
        console.log('[MenuScene] Texture not found:', key);
        return;
      }
      
      // Create multiple instances
      for (let j = 0; j < 2; j++) {
        const x = Phaser.Math.Between(60, width - 60);
        const y = Phaser.Math.Between(180, height - 120);
        
        const decoration = this.add.image(x, y, key)
          .setAlpha(0.4)
          .setScale(0.7);
        
        // Floating animation
        this.tweens.add({
          targets: decoration,
          y: y + Phaser.Math.Between(-15, 15),
          rotation: Phaser.Math.FloatBetween(-0.2, 0.2),
          duration: Phaser.Math.Between(2000, 3000),
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
          delay: i * 200 + j * 300
        });
      }
    });
    
    // Add a couple of clouds if texture exists
    if (this.textures.exists('cloud')) {
      for (let i = 0; i < 2; i++) {
        const cloud = this.add.image(
          Phaser.Math.Between(50, width - 50),
          Phaser.Math.Between(50, 150),
          'cloud'
        ).setAlpha(0.3).setScale(0.6);
        
        // Slow drift
        this.tweens.add({
          targets: cloud,
          x: cloud.x + 30,
          duration: 8000,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
      }
    }
  }

  // ============ BUTTON HANDLERS ============

  onPlayClick() {
    console.log('[MenuScene] PLAY clicked');
    this.showToast('🎮 Coming soon!', 0x5B7FFF);
  }

  onSettingsClick() {
    console.log('[MenuScene] SETTINGS clicked');
    this.showToast('⚙️ Settings coming soon!', 0xFF6B9D);
  }

  onScoresClick() {
    console.log('[MenuScene] SCORES clicked');
    this.showToast('🏆 Leaderboard coming soon!', 0xFFB347);
  }

  goToLogin() {
    console.log('[MenuScene] Login clicked');
    window.location.href = '/login.html?redirect=' + encodeURIComponent(window.location.href);
  }

  /**
   * Show a cute toast notification
   */
  showToast(message, color) {
    const width = this.cameras.main.width;
    
    // Toast container
    const toast = this.add.container(width / 2, 50);
    
    // Background
    const bg = this.add.graphics();
    bg.fillStyle(color, 0.95);
    bg.fillRoundedRect(-120, -22, 240, 44, 22);
    
    // Highlight
    const highlight = this.add.graphics();
    highlight.fillStyle(0xffffff, 0.2);
    highlight.fillRoundedRect(-115, -19, 230, 18, 12);
    
    // Text
    const text = this.add.text(0, 0, message, {
      fontFamily: 'Nunito, sans-serif',
      fontSize: '16px',
      fontWeight: '700',
      color: '#ffffff'
    }).setOrigin(0.5);
    
    toast.add([bg, highlight, text]);
    toast.setAlpha(0);
    toast.setScale(0.8);
    
    // Animate in
    this.tweens.add({
      targets: toast,
      alpha: 1,
      scale: 1,
      y: 80,
      duration: 400,
      ease: 'Back.easeOut',
      onComplete: () => {
        // Wait then animate out
        this.time.delayedCall(1500, () => {
          this.tweens.add({
            targets: toast,
            alpha: 0,
            scale: 0.8,
            y: 50,
            duration: 300,
            ease: 'Quad.easeIn',
            onComplete: () => toast.destroy()
          });
        });
      }
    });
  }
}

console.log('[MenuScene.js] Script loaded');
