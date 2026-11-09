import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { createHeatMap, loadHeat, SITE_ROOT } from './harness.js';

function loadScene(ctx) {
    ctx.Phaser.Scene = class Scene {};
    const source = fs.readFileSync(
        path.join(SITE_ROOT, 'js/scenes/BlitzGameScene.js'),
        'utf8'
    );
    vm.runInContext(
        `${source}\n;globalThis.BlitzGameScene = BlitzGameScene;\nglobalThis.localAdvancedPanelBoxes = localAdvancedPanelBoxes;\nglobalThis.enemyInventoryStorageSpec = enemyInventoryStorageSpec;`,
        ctx,
        { filename: 'BlitzGameScene.js' }
    );
}

function advancedStart(enemyItems) {
    return {
        payload: {
            playerContext: {
                inventory: {
                    items: {
                        stones: 21,
                        scissors: 12,
                        papers: 12,
                        NA_effect_stone: 3,
                        NA_effect_scissors: 2,
                        NA_effect_papers: 5,
                        NT_effect: 3
                    }
                }
            },
            enemyContext: enemyItems
                ? { inventory: { items: enemyItems } }
                : {}
        }
    };
}

const NPC_START = {
    stones: 21,
    scissors: 12,
    papers: 12,
    NA_effect_stone: 3,
    NA_effect_scissors: 2,
    NA_effect_papers: 5,
    NT_effect: 3
};

function fill(group, count) {
    for (let index = 0; index < count; index += 1) {
        group.addItem({ animate: false });
    }
}

function box(boxes, label) {
    return boxes.find((item) => item.label === label);
}

describe('enemy storage indicators', () => {
    it('gives the enemy band the same panels as the player inventory', () => {
        const ctx = loadHeat();
        loadScene(ctx);
        const boxes = ctx.localAdvancedPanelBoxes(390, 844);
        const enemyBand = box(boxes, 'enemy_inventory');
        const playerBand = box(boxes, 'inventory');
        const reveal = box(boxes, 'enemy_data');
        expect(enemyBand.height).toBe(playerBand.height);
        expect(reveal.y).toBe(enemyBand.y + enemyBand.height);
        [
            ['enemy_stone_storage_panel', 'stone_storage_panel'],
            ['enemy_scissors_storage_panel', 'scissors_storage_panel'],
            ['enemy_paper_storage_panel', 'paper_storage_panel'],
            ['enemy_NT_effects_panel', 'NT_effects_panel']
        ].forEach(([enemyLabel, playerLabel]) => {
            const enemy = box(boxes, enemyLabel);
            const player = box(boxes, playerLabel);
            expect(enemy.width).toBe(player.width);
            expect(enemy.height).toBe(player.height);
        });
    });

    it('shows the NPC stacks as stored and leaves them unselected', () => {
        const ctx = loadHeat();
        loadScene(ctx);
        const heatMap = createHeatMap(ctx);
        const boxes = ctx.localAdvancedPanelBoxes(390, 844);
        const scene = Object.create(ctx.BlitzGameScene.prototype);
        scene.heatMap = heatMap;
        scene.panelBoxes = boxes;
        scene.stone = new ctx.HotMapUiStone(heatMap);
        scene.scissor = new ctx.HotMapUiScissor(heatMap);
        scene.paper = new ctx.HotMapUiNewPaper(heatMap);
        scene.selectedEffects = [];
        scene.gameData = advancedStart(NPC_START);
        scene.createStoneStorageIndicators(box(boxes, 'stone_storage_panel'));
        scene.createEnemyInventoryReadout(boxes);

        const stones = scene.enemyStonesIndicator;
        const effects = scene.enemyStoneNaIndicator;
        expect(stones).toBeInstanceOf(ctx.HmVerticalTableAmountIndicator);
        expect(stones.columns).toBe(3);
        expect(stones.direction).toBe('desc');
        expect(stones.shape).toBe('rectangle');
        expect(stones.maxAmount).toBe(21);
        expect(stones.stored).toBe(21);
        expect(stones.selected).toBe(0);
        expect(stones.name).toBe('Enemy Stones');

        expect(effects.columns).toBe(1);
        expect(effects.direction).toBe('asc');
        expect(effects.shape).toBe('round');
        expect(effects.maxAmount).toBe(8);
        expect(effects.stored).toBe(3);
        expect(effects.selected).toBe(0);
        expect(effects.name).toBe('Enemy NA Stones');

        expect(scene.enemyScissorsIndicator.stored).toBe(12);
        expect(scene.enemyScissorsIndicator.selected).toBe(0);
        expect(scene.enemyScissorsIndicator.shape).toBe('rectangle');
        expect(scene.enemyScissorsNaIndicator.stored).toBe(2);
        expect(scene.enemyScissorsNaIndicator.columns).toBe(1);
        expect(scene.enemyScissorsNaIndicator.maxAmount).toBe(8);
        expect(scene.enemyPapersIndicator.stored).toBe(12);
        expect(scene.enemyPapersIndicator.columns).toBe(3);
        expect(scene.enemyPapersNaIndicator.stored).toBe(5);
        expect(scene.enemyPapersNaIndicator.shape).toBe('round');
        expect(scene.enemyScissorsIndicator.center.col).toBeGreaterThan(stones.center.col);
        expect(scene.enemyPapersIndicator.center.col).toBeGreaterThan(scene.enemyScissorsIndicator.center.col);

        const nt = scene.enemyNtEffectsIndicator;
        expect(nt).toBeInstanceOf(ctx.HmVerticalTableAmountIndicator);
        expect(nt.name).toBe('Enemy NT Effects');
        expect(nt.columns).toBe(1);
        expect(nt.direction).toBe('asc');
        expect(nt.shape).toBe('round');
        expect(nt.maxAmount).toBe(6);
        expect(nt.stored).toBe(3);
        expect(nt.selected).toBe(0);

        fill(scene.stone, 3);
        scene.selectedEffects = ['NegateSize'];
        scene.stoneCountText = { setVisible() {}, setText() {}, setFont() {}, width: 0 };
        scene.stoneNaText = { setVisible() {}, setText() {}, setFont() {}, width: 0 };
        scene.scissorsCountText = { setVisible() {}, setText() {}, setFont() {}, width: 0 };
        scene.scissorsNaText = { setVisible() {}, setText() {}, setFont() {}, width: 0 };
        scene.paperCountText = { setVisible() {}, setText() {}, setFont() {}, width: 0 };
        scene.paperNaText = { setVisible() {}, setText() {}, setFont() {}, width: 0 };
        scene.ntEffectText = { setVisible() {}, setText() {}, setFont() {}, width: 0, panelBox: box(boxes, 'NT_effects_panel') };
        scene.createStorageIndicators(box(boxes, 'scissors_storage_panel'), {
            itemKey: 'scissors',
            effectKey: 'NA_effect_scissors',
            compositeKey: 'scissor',
            countText: 'scissorsCountText',
            naText: 'scissorsNaText',
            itemsName: 'scissorsIndicator',
            effectsName: 'scissorsNaIndicator',
            itemsLabel: 'Scissors',
            effectsLabel: 'NA Scissors'
        });
        scene.createStorageIndicators(box(boxes, 'paper_storage_panel'), {
            itemKey: 'papers',
            effectKey: 'NA_effect_papers',
            compositeKey: 'paper',
            countText: 'paperCountText',
            naText: 'paperNaText',
            itemsName: 'paperIndicator',
            effectsName: 'paperNaIndicator',
            itemsLabel: 'Papers',
            effectsLabel: 'NA Papers'
        });
        scene.createNtEffectsIndicator(box(boxes, 'NT_effects_panel'));
        scene.syncStoneStorageIndicators();
        scene.syncEnemyStorageIndicators();
        expect(scene.stonesIndicator.selected).toBe(3);
        expect(scene.stoneNaIndicator.selected).toBe(1);
        expect(stones.selected).toBe(0);
        expect(effects.selected).toBe(0);
        expect(scene.enemyScissorsIndicator.selected).toBe(0);
        expect(scene.enemyScissorsNaIndicator.selected).toBe(0);
        expect(scene.enemyPapersIndicator.selected).toBe(0);
        expect(scene.enemyPapersNaIndicator.selected).toBe(0);
        expect(nt.selected).toBe(0);

        scene.gameData = advancedStart({
            stones: 18,
            scissors: 12,
            papers: 12,
            NA_effect_stone: 3,
            NA_effect_scissors: 2,
            NA_effect_papers: 5,
            NT_effect: 2
        });
        scene.syncEnemyStorageIndicators();
        expect(stones.stored).toBe(18);
        expect(stones.selected).toBe(0);
        expect(nt.stored).toBe(2);
        expect(nt.selected).toBe(0);

        scene.gameData = advancedStart(null);
        scene.syncEnemyStorageIndicators();
        expect(stones.stored).toBe(0);
        expect(effects.stored).toBe(0);
        expect(scene.enemyScissorsIndicator.stored).toBe(0);
        expect(scene.enemyPapersIndicator.stored).toBe(0);
        expect(scene.enemyPapersNaIndicator.stored).toBe(0);
        expect(nt.stored).toBe(0);
        expect(stones.selected).toBe(0);
    });
});
