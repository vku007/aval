/**
 * Phaser 3 Game Configuration
 * Main entry point for the game
 */

console.log('[game.js] Script starting...');

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('[Game] DOM ready, checking dependencies...');
  
  // Check if Phaser is loaded
  if (typeof Phaser === 'undefined') {
    console.error('[Game] ERROR: Phaser is not loaded!');
    document.getElementById('loading-screen').innerHTML = '<p style="color: red;">Error: Phaser not loaded</p>';
    return;
  }
  console.log('[Game] Phaser version:', Phaser.VERSION);
  
  // Check if Planck is loaded
  if (typeof planck === 'undefined') {
    console.error('[Game] ERROR: Planck.js is not loaded!');
    document.getElementById('loading-screen').innerHTML = '<p style="color: red;">Error: Planck.js not loaded</p>';
    return;
  }
  console.log('[Game] Planck.js loaded');
  
  // Check if scenes are loaded
  if (typeof BootScene === 'undefined') {
    console.error('[Game] ERROR: BootScene is not defined!');
    return;
  }
  console.log('[Game] BootScene loaded');
  
  if (typeof MenuScene === 'undefined') {
    console.error('[Game] ERROR: MenuScene is not defined!');
    return;
  }
  console.log('[Game] MenuScene loaded');
  
  // GameScene removed - focusing on BootScene and MenuScene
  console.log('[Game] GameScene: not loaded (removed)');
  
  // Check if API is loaded
  if (typeof gameAPI === 'undefined') {
    console.error('[Game] ERROR: gameAPI is not defined!');
    return;
  }
  console.log('[Game] gameAPI loaded');
  
  console.log('[Game] All dependencies loaded, initializing Phaser...');
  
  // Game configuration
  const config = {
    type: Phaser.AUTO, // WebGL with Canvas fallback
    width: 800,
    height: 600,
    parent: 'phaser-game',
    backgroundColor: '#0a0e17',
    
    // Pixel art scaling (disable for smooth graphics)
    pixelArt: false,
    
    // Anti-aliasing
    antialias: true,
    
    // Scale manager
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      min: {
        width: 400,
        height: 300
      },
      max: {
        width: 1600,
        height: 1200
      }
    },
    
    // Scenes (order matters for loading)
    scene: [
      BootScene,
      MenuScene
    ],
    
    // Audio
    audio: {
      disableWebAudio: false
    },
    
    // Performance
    fps: {
      target: 60,
      forceSetTimeOut: false
    },
    
    // Disable Phaser's built-in physics (we use Planck.js)
    physics: {
      default: null
    },
    
    // Callbacks
    callbacks: {
      preBoot: (game) => {
        console.log('[Game] preBoot callback');
      },
      postBoot: (game) => {
        console.log('[Game] postBoot callback - game fully initialized');
      }
    }
  };
  
  console.log('[Game] Creating Phaser.Game instance...');
  
  try {
    // Create game instance
    const game = new Phaser.Game(config);
    
    // Store reference globally for debugging
    window.game = game;
    window.gameAPI = gameAPI;
    
    console.log('[Game] Phaser.Game instance created successfully');
    
    // Handle visibility change (pause/resume)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        console.log('[Game] Tab hidden');
      } else {
        console.log('[Game] Tab visible');
      }
    });
    
    // Handle window resize
    window.addEventListener('resize', () => {
      game.scale.refresh();
    });
    
  } catch (error) {
    console.error('[Game] Failed to create Phaser.Game:', error);
    document.getElementById('loading-screen').innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
  }
  
  // Error handling
  window.addEventListener('error', (event) => {
    console.error('[Game] Unhandled error:', event.error);
  });
  
  window.addEventListener('unhandledrejection', (event) => {
    console.error('[Game] Unhandled promise rejection:', event.reason);
  });
});

console.log('[game.js] Script loaded, waiting for DOMContentLoaded...');

/**
 * Utility: Get URL parameter
 */
function getUrlParam(name) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}

/**
 * Utility: Format number with commas
 */
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
