/**
 * Logical game size is always 390×844 (phone-m). Phaser Scale.FIT
 * scales that into a same-aspect box that fills the viewport.
 */
const GAME_WIDTH = 390;
const GAME_HEIGHT = 844;
const GAME_ASPECT = GAME_WIDTH / GAME_HEIGHT;

const LAYOUT_KEYS = ['thumb', 'balanced', 'arena'];
const LAYOUT_STORAGE_KEY = 'uiLayout';
const FX_KEYS = ['quiet', 'casual', 'arcade'];
const FX_STORAGE_KEY = 'uiFx';

const UI = {
    pad: 12,
    title: 28,
    heading: 20,
    body: 14,
    small: 11,
    menuBtnW: 320,
    menuBtnH: 56,
    menuPrimaryH: 64,
    menuBtnGap: 72,
    touchMin: 48,
    touchPlay: 64,
    backW: 64,
    backH: 44,
    roundSize: 36,
    fieldH: 48,
    layouts: {},
    activeLayoutKey: 'thumb',
    layout: null,
    effects: {},
    activeFxKey: 'casual',
    fx: null,
};

UI.layouts = {
    thumb: {
        id: 'thumb',
        label: 'A Thumb',
        structure: 'hud-status-play',
        fonts: { title: 32, heading: 22, body: 16, small: 13 },
        hud: 0.18,
        status: 0.22,
        play: 0.60,
        roundSize: 40,
        showPanelLabels: false,
        goFullWidth: true,
        goW: 0,
        goH: 64,
        moveH: 72,
        cancelH: 48,
        backW: 64,
        backH: 48,
        backPlacement: 'play-row',
        sideColumnRatio: 0,
        statusFont: 'body',
        actionLayout: 'thumb-stack',
    },
    balanced: {
        id: 'balanced',
        label: 'B Balanced',
        structure: 'four-panel',
        fonts: { title: 28, heading: 20, body: 16, small: 13 },
        characters: 0.10,
        results: 0.12,
        currentMove: 0.28,
        actions: 0.50,
        roundSize: 36,
        showPanelLabels: false,
        goFullWidth: false,
        goW: 72,
        goH: 64,
        moveH: 72,
        cancelH: 64,
        backW: 64,
        backH: 44,
        backPlacement: 'top-left',
        sideColumnRatio: 0.22,
        statusFont: 'body',
        actionLayout: 'two-row',
    },
    arena: {
        id: 'arena',
        label: 'C Arena',
        structure: 'hud-arena-grid',
        fonts: { title: 28, heading: 22, body: 16, small: 13 },
        hud: 0.12,
        arena: 0.50,
        actions: 0.38,
        roundSize: 36,
        showPanelLabels: false,
        goFullWidth: false,
        goW: 80,
        goH: 80,
        moveH: 80,
        cancelH: 48,
        backW: 44,
        backH: 44,
        backPlacement: 'hud',
        sideColumnRatio: 0.28,
        statusFont: 'heading',
        actionLayout: 'grid-2x2',
    },
};

function resolveLayoutKey() {
    try {
        const params = new URLSearchParams(window.location.search);
        const fromQuery = params.get('layout');
        if (fromQuery && UI.layouts[fromQuery]) {
            return fromQuery;
        }
    } catch (e) {
        // ignore
    }
    try {
        const stored = localStorage.getItem(LAYOUT_STORAGE_KEY);
        if (stored && UI.layouts[stored]) {
            return stored;
        }
    } catch (e) {
        // ignore
    }
    return 'thumb';
}

function applyUiLayout(key) {
    const id = UI.layouts[key] ? key : 'thumb';
    const layout = UI.layouts[id];
    UI.activeLayoutKey = id;
    UI.layout = layout;
    UI.title = layout.fonts.title;
    UI.heading = layout.fonts.heading;
    UI.body = layout.fonts.body;
    UI.small = layout.fonts.small;
    UI.roundSize = layout.roundSize;
    UI.backW = layout.backW;
    UI.backH = layout.backH;
    try {
        localStorage.setItem(LAYOUT_STORAGE_KEY, id);
    } catch (e) {
        // ignore
    }
    return layout;
}

function cycleUiLayout() {
    const index = LAYOUT_KEYS.indexOf(UI.activeLayoutKey);
    const next = LAYOUT_KEYS[(index + 1) % LAYOUT_KEYS.length];
    return applyUiLayout(next);
}

UI.effects = {
    quiet: {
        id: 'quiet',
        label: 'A Quiet',
        pressDown: 0.96,
        pressDownStrong: 0.94,
        overshoot: 1,
        selectFill: 0xe6e6e6,
        selectStroke: 2,
        goPulse: false,
        goBounce: false,
        goPulseScale: 1.04,
        goPulseMs: 900,
        goBouncePx: 0,
        roundPop: false,
        roundPopFrom: 0.4,
        roundPopPeak: 1.1,
        scorePunch: false,
        scorePunchScale: 1.12,
        errorPop: false,
        errorPopFrom: 0.85,
        statusFade: false,
        pressParticles: false,
        fallingStars: 4,
        stressChanged: true,
        stressShakePx: 3,
        stressStars: 3,
        winBurst: false,
        camShake: false,
        camShakeMs: 150,
        camShakeIntensity: 0.01,
        menuPrimaryPulse: false,
        sceneFade: true,
        sceneFadeMs: 80,
        modalPop: false,
        sceneFlash: false,
    },
    casual: {
        id: 'casual',
        label: 'B Casual',
        pressDown: 0.90,
        pressDownStrong: 0.88,
        overshoot: 1.04,
        selectFill: 0xe6e6e6,
        selectStroke: 3,
        goPulse: true,
        goBounce: false,
        goPulseScale: 1.04,
        goPulseMs: 900,
        goBouncePx: 0,
        roundPop: true,
        roundPopFrom: 0.4,
        roundPopPeak: 1.1,
        scorePunch: true,
        scorePunchScale: 1.25,
        errorPop: true,
        errorPopFrom: 0.85,
        statusFade: true,
        pressParticles: false,
        fallingStars: 7,
        stressChanged: true,
        stressShakePx: 5,
        stressStars: 5,
        winBurst: false,
        camShake: false,
        camShakeMs: 150,
        camShakeIntensity: 0.01,
        menuPrimaryPulse: false,
        sceneFade: true,
        sceneFadeMs: 180,
        modalPop: true,
        sceneFlash: false,
    },
    arcade: {
        id: 'arcade',
        label: 'C Arcade',
        pressDown: 0.86,
        pressDownStrong: 0.84,
        overshoot: 1.06,
        selectFill: 0xe6e6e6,
        selectStroke: 3,
        goPulse: true,
        goBounce: true,
        goPulseScale: 1.04,
        goPulseMs: 900,
        goBouncePx: 3,
        roundPop: true,
        roundPopFrom: 0.4,
        roundPopPeak: 1.12,
        scorePunch: true,
        scorePunchScale: 1.35,
        errorPop: true,
        errorPopFrom: 0.85,
        statusFade: true,
        pressParticles: true,
        fallingStars: 11,
        stressChanged: true,
        stressShakePx: 7,
        stressStars: 8,
        winBurst: true,
        camShake: true,
        camShakeMs: 150,
        camShakeIntensity: 0.01,
        menuPrimaryPulse: true,
        sceneFade: true,
        sceneFadeMs: 280,
        modalPop: true,
        sceneFlash: true,
    },
};

function resolveFxKey() {
    try {
        const params = new URLSearchParams(window.location.search);
        const fromQuery = params.get('fx');
        if (fromQuery && UI.effects[fromQuery]) {
            return fromQuery;
        }
    } catch (e) {
        // ignore
    }
    try {
        const stored = localStorage.getItem(FX_STORAGE_KEY);
        if (stored && UI.effects[stored]) {
            return stored;
        }
    } catch (e) {
        // ignore
    }
    return 'casual';
}

function applyUiFx(key) {
    const id = UI.effects[key] ? key : 'casual';
    UI.activeFxKey = id;
    UI.fx = UI.effects[id];
    try {
        localStorage.setItem(FX_STORAGE_KEY, id);
    } catch (e) {
        // ignore
    }
    return UI.fx;
}

function cycleUiFx() {
    const index = FX_KEYS.indexOf(UI.activeFxKey);
    const next = FX_KEYS[(index + 1) % FX_KEYS.length];
    return applyUiFx(next);
}

function writeUiQueryParams() {
    try {
        const url = new URL(window.location.href);
        url.searchParams.set('layout', UI.activeLayoutKey);
        url.searchParams.set('fx', UI.activeFxKey);
        window.history.replaceState({}, '', url);
    } catch (e) {
        // ignore
    }
}

function isUiDebug() {
    try {
        return new URLSearchParams(window.location.search).get('debug') === '1';
    } catch (e) {
        return false;
    }
}

applyUiLayout(resolveLayoutKey());
applyUiFx(resolveFxKey());

function fitGameFrame(availW, availH) {
  const width = availW ?? window.innerWidth;
  const height = availH ?? window.innerHeight;
  let w;
  let h;
  if (width / height > GAME_ASPECT) {
    h = height;
    w = Math.floor(h * GAME_ASPECT);
  } else {
    w = width;
    h = Math.floor(w / GAME_ASPECT);
  }
  return { w: Math.max(1, w), h: Math.max(1, h), name: 'phone-m' };
}

function applyGameFrame(frame) {
  const root = document.documentElement;
  root.style.setProperty('--game-frame-w', frame.w + 'px');
  root.style.setProperty('--game-frame-h', frame.h + 'px');
  const el = document.getElementById('game-container');
  if (el) {
    el.dataset.frame = frame.name;
  }
  return frame;
}
