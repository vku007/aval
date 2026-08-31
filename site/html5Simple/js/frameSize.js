/**
 * Logical game size is always 390×844 (phone-m). Phaser Scale.FIT
 * scales that into a same-aspect box that fills the viewport.
 */
const GAME_WIDTH = 390;
const GAME_HEIGHT = 844;
const GAME_ASPECT = GAME_WIDTH / GAME_HEIGHT;

const UI = {
    pad: 12,
    title: 28,
    heading: 20,
    body: 14,
    small: 11,
    menuBtnW: 320,
    menuBtnH: 48,
    menuBtnGap: 62,
};

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
