import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { createHeatMap, loadHeat, SITE_ROOT } from './harness.js';

function loadScene(ctx) {
    ctx.Phaser.Scene = class Scene {};
    const source = fs.readFileSync(
        path.join(SITE_ROOT, 'js/scenes/LocalAdvancedGameScene.js'),
        'utf8'
    );
    vm.runInContext(
        `${source}\n;globalThis.LocalAdvancedGameScene = LocalAdvancedGameScene;`,
        ctx,
        { filename: 'LocalAdvancedGameScene.js' }
    );
}

function inventory() {
    return {
        payload: {
            playerContext: {
                inventory: {
                    items: {
                        stones: 9,
                        scissors: 9,
                        papers: 9,
                        NA_effect_stone: 1,
                        NA_effect_scissors: 1,
                        NA_effect_papers: 1,
                        NT_effect: 1
                    }
                }
            }
        }
    };
}

function fill(group, count) {
    for (let index = 0; index < count; index += 1) {
        group.addItem({ animate: false });
    }
}

function sceneFor(ctx, heatMap, activeKey) {
    const scene = Object.create(ctx.LocalAdvancedGameScene.prototype);
    scene.heatMap = heatMap;
    scene.stone = new ctx.HotMapUiStone(heatMap);
    scene.scissor = new ctx.HotMapUiScissor(heatMap);
    scene.paper = new ctx.HotMapUiNewPaper(heatMap);
    scene.selectedEffects = [];
    scene._sending = false;
    scene.currentGameId = 'game-1';
    scene.gameData = inventory();
    scene.turnCap = () => 9;
    scene.refreshMatchReadout = () => {};
    fill(scene[activeKey], 3);
    return scene;
}

const PRIME_KIND = {
    stone: 'hot-map-stone-prime',
    scissor: 'hot-map-scissors-prime',
    paper: 'hot-map-paper-prime'
};

describe('NA effect stack', () => {
    it.each([
        ['stone', 'Stone'],
        ['scissor', 'Scissors'],
        ['paper', 'Paper']
    ])('drops the %s composite to one item when NEG is chosen', (key, moveType) => {
        const ctx = loadHeat();
        loadScene(ctx);
        const heatMap = createHeatMap(ctx);
        const scene = sceneFor(ctx, heatMap, key);

        scene.onSelectEffect('NegateSize', 'effect');

        expect(scene.currentSelection()).toMatchObject({ moveType, size: 1 });
        expect(scene.selectedEffects).toEqual(['NegateSize']);
        expect(ctx.hotMapActivePartCount(scene[key])).toBe(1);
        expect(scene[key]._naHidden).toBe(true);
        expect(scene[key].items.every((item) => item.isVisible === false)).toBe(true);
        expect(scene.naPrime.kind).toBe(PRIME_KIND[key]);
        expect(scene.naPrime.circle.kind).toBe('circle');
        expect(scene.naPrime.round.kind).toBe('round');
        expect(scene.naPrime.center).toMatchObject(scene[key].center);
    });

    it('leaves the stack unchanged for SIZE and blocks adds while NEG stays on', () => {
        const ctx = loadHeat();
        loadScene(ctx);
        const heatMap = createHeatMap(ctx);
        const scene = sceneFor(ctx, heatMap, 'stone');

        scene.onSelectEffect('SizeOnly', 'effect');
        expect(ctx.hotMapActivePartCount(scene.stone)).toBe(3);
        expect(scene.naPrime).toBeFalsy();
        expect(scene.ntCore.kind).toBe('core');
        expect(scene.ntCore.circle.kind).toBe('circle');
        expect(scene.ntCore.round.kind).toBe('round');
        expect(scene.ntCore.balls()).toHaveLength(3);
        expect(scene.ntCore.center).toMatchObject(scene.stone.center);
        expect(scene.stone._naHidden).toBe(true);
        expect(scene.stone.items.every((item) => item.isVisible === false)).toBe(true);

        scene.onSelectEffect('NegateSize', 'effect');
        expect(scene.ntCore).toBeNull();
        expect(ctx.hotMapActivePartCount(scene.stone)).toBe(1);
        const prime = scene.naPrime;
        const ball = prime.parts.map((part) => part.object).find((object) => object.kind === 'hot-ball');
        expect(heatMap.field.balls).toContain(ball.motion);
        expect(heatMap.field.roots).toContain(prime);
        scene.addStockedItem('stone', 'stones', 'Stone');
        expect(ctx.hotMapActivePartCount(scene.stone)).toBe(1);
        expect(scene.naPrime).toBe(prime);

        scene.onSelectEffect('NegateSize', 'effect');
        expect(scene.selectedEffects).toEqual([]);
        expect(scene.naPrime).toBeNull();
        expect(scene.stone._naHidden).toBeFalsy();
        expect(scene.stone.items.every((item) => item.isVisible !== false)).toBe(true);
        expect(heatMap.field.balls).not.toContain(ball.motion);
        expect(heatMap.field.roots).not.toContain(prime);
        expect(ctx.hotMapActivePartCount(scene.stone)).toBe(1);
        scene.addStockedItem('stone', 'stones', 'Stone');
        expect(ctx.hotMapActivePartCount(scene.stone)).toBe(2);
    });

    it('hides the stack for SIZE and shows it again when SIZE is turned off', () => {
        const ctx = loadHeat();
        loadScene(ctx);
        const heatMap = createHeatMap(ctx);
        const scene = sceneFor(ctx, heatMap, 'paper');

        scene.onSelectEffect('SizeOnly', 'effect');
        const core = scene.ntCore;
        const ball = core.balls()[0];
        expect(ctx.hotMapActivePartCount(scene.paper)).toBe(3);
        expect(core.balls()).toHaveLength(3);
        expect(heatMap.field.balls).toContain(ball.motion);
        expect(heatMap.field.roots).toContain(core);
        expect(scene.paper.items.every((item) => item.isVisible === false)).toBe(true);

        scene.addStockedItem('paper', 'papers', 'Paper');
        expect(ctx.hotMapActivePartCount(scene.paper)).toBe(4);
        expect(scene.ntCore).toBe(core);
        expect(core.balls()).toHaveLength(4);
        expect(scene.paper.items.every((item) => item.isVisible === false)).toBe(true);

        scene.onCancelPress();
        expect(ctx.hotMapActivePartCount(scene.paper)).toBe(3);
        expect(scene.ntCore).toBe(core);
        expect(core.balls()).toHaveLength(3);
        expect(scene.paper.items.every((item) => item.isVisible === false)).toBe(true);

        scene.addStockedItem('paper', 'papers', 'Paper');
        expect(ctx.hotMapActivePartCount(scene.paper)).toBe(4);
        expect(core.balls()).toHaveLength(4);

        scene.onSelectEffect('SizeOnly', 'effect');
        expect(scene.selectedEffects).toEqual([]);
        expect(scene.ntCore).toBeNull();
        expect(scene.paper._naHidden).toBeFalsy();
        expect(scene.paper.items.every((item) => item.isVisible !== false)).toBe(true);
        expect(heatMap.field.balls).not.toContain(ball.motion);
        expect(heatMap.field.roots).not.toContain(core);
        expect(ctx.hotMapActivePartCount(scene.paper)).toBe(4);
    });

    it('removes the prime when the last item is cancelled', () => {
        const ctx = loadHeat();
        loadScene(ctx);
        const heatMap = createHeatMap(ctx);
        const scene = sceneFor(ctx, heatMap, 'scissor');

        scene.onSelectEffect('NegateSize', 'effect');
        expect(scene.naPrime.kind).toBe('hot-map-scissors-prime');
        scene.scissor.removeItem();
        scene.refreshEffectButtons();

        expect(scene.selectedEffects).toEqual([]);
        expect(scene.naPrime).toBeNull();
        expect(scene.scissor._naHidden).toBeFalsy();
    });

    it('keeps the core shown when a SIZE turn is sent', async () => {
        const ctx = loadHeat();
        loadScene(ctx);
        const heatMap = createHeatMap(ctx);
        const scene = sceneFor(ctx, heatMap, 'stone');

        scene.onSelectEffect('SizeOnly', 'effect');
        const core = scene.ntCore;
        scene.gameData.payload.playerContext.inventory.items.NT_effect = 0;
        scene._sending = true;
        scene.refreshEffectButtons();

        expect(scene.ntCore).toBe(core);
        expect(scene.stone._naHidden).toBe(true);
        expect(scene.stone.items.every((item) => item.isVisible === false)).toBe(true);
        expect(core.balls()).toHaveLength(3);

        scene.latestExchange = () => null;
        await scene.playMoveResult('user-1');

        expect(scene.ntCore).toBe(core);
        expect(scene.stone._naHidden).toBe(true);
        expect(scene.stone.items.every((item) => item.isVisible === false)).toBe(true);
        expect(core.balls()).toHaveLength(3);
    });

    it('takes the SIZE result off the core and leaves the stack hidden', () => {
        const ctx = loadHeat();
        loadScene(ctx);
        const heatMap = createHeatMap(ctx);
        const scene = sceneFor(ctx, heatMap, 'stone');

        scene.onSelectEffect('SizeOnly', 'effect');
        const core = scene.ntCore;
        const run = scene.dramaticClear(scene.stone);

        expect(run.removed).toBe(3);
        for (let frame = 0; frame < 120; frame += 1) {
            heatMap.field.update(frame * (1000 / 60), 1000 / 60);
        }

        expect(core.balls()).toHaveLength(0);
        expect(ctx.hotMapActivePartCount(scene.stone)).toBe(0);
        expect(scene.stone._naHidden).toBe(true);
        expect(scene.ntCore).toBe(core);
    });

    it('disables further move adds while an NA effect is selected', () => {
        const ctx = loadHeat();
        loadScene(ctx);
        const heatMap = createHeatMap(ctx);
        const scene = sceneFor(ctx, heatMap, 'stone');
        scene.moveButtons = { stone: {}, scissors: {}, paper: {} };
        scene.cancelButton = {};
        scene.goButton = {};
        scene.setGreenButtonEnabled = (btn, enabled) => {
            btn.isEnabled = enabled;
        };

        scene.onSelectEffect('NegateSize', 'effect');
        scene.refreshMoveButtons();

        expect(scene.moveButtons.stone.isEnabled).toBe(false);
        expect(scene.moveButtons.scissors.isEnabled).toBe(false);
        expect(scene.moveButtons.paper.isEnabled).toBe(false);
        expect(scene.goButton.isEnabled).toBe(true);
    });
});
