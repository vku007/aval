import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, '../..');
export const SITE_ROOT = path.join(REPO_ROOT, 'site/html5Simple');
export const GOLDEN_PATH = path.join(HERE, 'goldens/idle.json');

/** Phone stage. cols/rows match UiSkin's 390×844 grid (cell size 3). */
export const FIELD_BOUNDS = { x: 0, y: 0, width: 390, height: 844 };
export const IDLE_FRAMES = 120;
export const DT_MS = 1000 / 60;

const HEAT_SCRIPTS = [
    'js/fx/HeatMapFx.js',
    'js/fx/RotatedHeatMapFx.js',
    'js/fx/HotRodFx.js',
    'js/fx/BackHighlightFx.js',
    'js/fx/SheetFx.js',
    'js/heat/anim/easing.js',
    'js/heat/anim/channels.js',
    'js/heat/anim/definitions.js',
    'js/heat/anim/run.js',
    'js/heat/anim/animator.js',
    'js/heat/anim/library/blocks.js',
    'js/heat/behaviours/behaviours.js',
    'js/heat/node/HeatNode.js',
    'js/heat/node/HeatItem.js',
    'js/heat/node/HeatComposite.js',
    'js/heat/node/registry.js',
    'js/heat/composites/stone.js',
    'js/heat/composites/scissor.js',
    'js/heat/composites/paper.js',
    'js/heat/composites/diskStack.js',
    'js/ui/UiHeatMap.js',
    'js/ui/UiEditorPreset.js',
    'js/ui/UiHotBall.js',
    'js/ui/UiHotRod.js',
    'js/ui/HorisontalPulse.js',
    'js/ui/VictoryPulse.js',
    'js/ui/VerticalPulse.js',
    'js/ui/UiBackHighlighter.js',
    'js/ui/UiShard.js',
    'js/ui/UiSheet.js',
    'js/ui/UiNewSheet.js',
    'js/ui/HotMapUiComposite.js',
    'js/ui/HotMapUiStone.js',
    'js/ui/HotMapUiScissor.js',
    'js/ui/HotMapUiPaper.js',
    'js/ui/HotMapUiNewPaper.js'
];

const EXPORTED = [
    'Orbit',
    'Follow',
    'PathLoop',
    'PoseCycle',
    'Glisten',
    'BallRunner',
    'DiskLoop',
    'Spin',
    'heatEase',
    'HeatChannels',
    'HeatRun',
    'tracks',
    'wait',
    'set',
    'call',
    'sequence',
    'parallel',
    'stagger',
    'transition',
    'move',
    'grow',
    'spin',
    'fade',
    'flash',
    'shake',
    'gather',
    'pose',
    'sweep',
    'heatFieldWait',
    'heatDoneRun',
    'scissorEnter',
    'stoneEnter',
    'stoneSpread',
    'rotatedOrbitOffset',
    'HeatNode',
    'HeatItem',
    'HeatComposite',
    'createItem',
    'createComposite',
    'UiHeatMap',
    'UiHotBall',
    'UiHotRod',
    'UiBackHighlighter',
    'UiShard',
    'UiSheet',
    'UiNewSheet',
    'HotMapUiStone',
    'HotMapUiScissor',
    'HotMapUiPaper',
    'HotMapUiNewPaper',
    'HorisontalPulse',
    'VerticalPulse',
    'VictoryPulse',
    'heatMapOwns',
    'wrapPhaseDeg',
    'setSheetGlistenOn'
];

function createSceneStub() {
    const image = {
        setDisplaySize() { return this; },
        setDepth() { return this; },
        setVisible() { return this; },
        destroy() {}
    };
    const zone = {
        setOrigin() { return this; },
        setInteractive() { return this; },
        on() { return this; },
        destroy() {}
    };
    return {
        textures: {
            exists() { return false; },
            remove() {},
            createCanvas() {
                return {
                    getContext() {
                        return {
                            fillStyle: '#000000',
                            fillRect() {},
                            createImageData(width, height) {
                                return {
                                    data: new Uint8ClampedArray(width * height * 4),
                                    width,
                                    height
                                };
                            },
                            putImageData() {}
                        };
                    },
                    refresh() {}
                };
            }
        },
        add: {
            image() { return image; },
            zone() { return zone; }
        },
        events: {
            once() {}
        }
    };
}

/**
 * Classic scripts share one browser global. Node's vm gives each runInContext
 * its own top-level lexical scope, so the files are concatenated and the
 * names the tests call are copied onto globalThis.
 */
export function loadHeat() {
    const sandbox = {
        console,
        Math,
        Number,
        String,
        Boolean,
        Object,
        Array,
        Error,
        JSON,
        Date,
        RegExp,
        parseInt,
        parseFloat,
        isNaN,
        isFinite,
        NaN,
        Infinity,
        undefined,
        Float32Array,
        Uint8ClampedArray,
        ArrayBuffer,
        Promise,
        Set,
        Phaser: {
            Math: {
                Clamp(value, min, max) {
                    return Math.max(min, Math.min(max, value));
                }
            },
            Geom: {
                Rectangle: function Rectangle() {}
            }
        },
        document: {
            createElement() {
                return { click() {}, style: {} };
            },
            body: { appendChild() {}, removeChild() {} }
        },
        localStorage: {
            getItem() { return null; },
            setItem() {}
        }
    };
    sandbox.globalThis = sandbox;
    sandbox.window = sandbox;
    const context = vm.createContext(sandbox);
    const source = HEAT_SCRIPTS.map((file) => {
        return fs.readFileSync(path.join(SITE_ROOT, file), 'utf8');
    }).join('\n;\n');
    const footer = EXPORTED.map((name) => `globalThis.${name} = ${name};`).join('\n');
    vm.runInContext(`${source}\n;\n${footer}`, context, { filename: 'heat-scripts.js' });
    return context;
}

export function createHeatMap(ctx) {
    return new ctx.UiHeatMap(createSceneStub(), FIELD_BOUNDS, { interactive: false });
}

export function hashGrid(grid) {
    const bytes = Buffer.from(grid.buffer, grid.byteOffset, grid.byteLength);
    return crypto.createHash('sha256').update(bytes).digest('hex');
}

export async function stepField(heatMap, frames = IDLE_FRAMES) {
    const field = heatMap.field;
    for (let frame = 0; frame < frames; frame += 1) {
        if (frame % 20 === 0) {
            await new Promise((resolve) => {
                setImmediate(resolve);
            });
        }
        field.update(frame * DT_MS, DT_MS);
    }
    return hashGrid(field.src);
}

/**
 * Composites have no `{ animate: false }` yet. Park enter/spread/travel at the
 * pose those animations commit, then hash the idle loops from that pose.
 */
export function parkCompositeIdle(ctx, composite) {
    if (composite.kind === 'hot-map-stone') {
        composite.parts.forEach((part) => {
            const object = part.object;
            const motion = object.motion;
            const spread = object._slots && object._slots.layout && object._slots.layout.active;
            if (spread && spread.status === 'running') {
                spread.finish();
            }
            const enter = object._slots && object._slots.life && object._slots.life.active;
            if (enter && (enter.status === 'running' || enter.status === 'paused')) {
                enter.cancel();
            }
            if (motion.orbitTarget) {
                motion.orbitCenter.col = motion.orbitTarget.col;
                motion.orbitCenter.row = motion.orbitTarget.row;
            }
            motion.centerFollow = null;
            motion.phaseGoal = null;
            motion.phaseFollow = null;
        });
        return;
    }
    if (composite.kind === 'hot-map-scissor') {
        composite.parts.forEach((part) => {
            const object = part.object;
            const emitter = object.emitter;
            if (typeof object.cancelAll === 'function') {
                object.cancelAll();
            }
            emitter.center.col = emitter.target.col;
            emitter.center.row = emitter.target.row;
        });
        return;
    }
    if (composite.kind === 'hot-map-paper') {
        composite.parts.forEach((part) => {
            const emitter = part.object.emitter;
            emitter.center.col = emitter.target.col;
            emitter.center.row = emitter.target.row;
            if (emitter.travel) {
                emitter.travel.stage = 'done';
            }
            emitter.glistenHold = false;
            ctx.setSheetGlistenOn(emitter, emitter.glistenAfterMove !== false);
        });
        return;
    }
    if (composite.kind === 'hot-map-new-paper') {
        composite.parts.forEach((part) => {
            part.object.ballTravel = null;
        });
    }
}

export function idleCases() {
    return {
        'hot-ball': (ctx, heatMap) => {
            new ctx.UiHotBall(heatMap);
        },
        'hot-rod': (ctx, heatMap) => {
            new ctx.UiHotRod(heatMap);
        },
        'back-highlight': (ctx, heatMap) => {
            new ctx.UiBackHighlighter(heatMap);
        },
        shard: (ctx, heatMap) => {
            new ctx.UiShard(heatMap, {
                from: { width: 56, height: 8, skew: -60, shapeHeat: 0.2, glisten: 0, heat: 0.45 },
                to: { width: 70, height: 10, skew: -30, shapeHeat: 0.6, glisten: 80, heat: 1.2 }
            });
        },
        sheet: (ctx, heatMap) => {
            new ctx.UiSheet(heatMap);
        },
        'new-sheet': (ctx, heatMap) => {
            new ctx.UiNewSheet(heatMap);
        },
        stone: (ctx, heatMap) => {
            const group = new ctx.HotMapUiStone(heatMap);
            group.addItem();
            group.addItem();
            group.addItem();
            parkCompositeIdle(ctx, group);
        },
        scissor: (ctx, heatMap) => {
            const group = new ctx.HotMapUiScissor(heatMap);
            group.addItem();
            group.addItem();
            group.addItem();
            parkCompositeIdle(ctx, group);
        },
        paper: (ctx, heatMap) => {
            const group = new ctx.HotMapUiPaper(heatMap);
            group.addItem();
            group.addItem();
            group.addItem();
            parkCompositeIdle(ctx, group);
        },
        'new-paper': (ctx, heatMap) => {
            const group = new ctx.HotMapUiNewPaper(heatMap);
            group.addItem();
            group.addItem();
            group.addItem();
            parkCompositeIdle(ctx, group);
        }
    };
}

export async function captureIdleHashes() {
    const ctx = loadHeat();
    const cases = idleCases();
    const hashes = {};
    for (const name of Object.keys(cases)) {
        await new Promise((resolve) => {
            setImmediate(resolve);
        });
        const heatMap = createHeatMap(ctx);
        cases[name](ctx, heatMap);
        hashes[name] = await stepField(heatMap);
    }
    return {
        frames: IDLE_FRAMES,
        dtMs: DT_MS,
        width: FIELD_BOUNDS.width,
        height: FIELD_BOUNDS.height,
        cases: hashes
    };
}
