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
        `${source}\n;globalThis.BlitzGameScene = BlitzGameScene;\nglobalThis.inventoryStorageSpec = inventoryStorageSpec;`,
        ctx,
        { filename: 'BlitzGameScene.js' }
    );
}

function inventory(stones, na) {
    return {
        payload: {
            playerContext: {
                inventory: {
                    items: {
                        stones: stones,
                        scissors: 12,
                        papers: 10,
                        NA_effect_stone: na,
                        NA_effect_scissors: 5,
                        NA_effect_papers: 3,
                        NT_effect: 3
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

describe('stone storage indicators', () => {
    it('shows inventory stones on the left and NA stone effects on the right', () => {
        const ctx = loadHeat();
        loadScene(ctx);
        const heatMap = createHeatMap(ctx);
        const scene = Object.create(ctx.BlitzGameScene.prototype);
        scene.heatMap = heatMap;
        scene.panelBoxes = [
            { label: 'stone_storage_panel', x: 0, y: 700, width: 120, height: 120 },
            { label: 'scissors_storage_panel', x: 130, y: 700, width: 120, height: 120 },
            { label: 'paper_storage_panel', x: 260, y: 700, width: 120, height: 120 },
            { label: 'NT_effects_panel', x: 340, y: 700, width: 40, height: 120 }
        ];
        scene.stone = new ctx.HotMapUiStone(heatMap);
        scene.scissor = new ctx.HotMapUiScissor(heatMap);
        scene.paper = new ctx.HotMapUiNewPaper(heatMap);
        scene.selectedEffects = [];
        scene.gameData = inventory(20, 2);
        fill(scene.stone, 3);
        scene.stoneCountText = { setVisible() {} };
        scene.stoneNaText = { setVisible() {} };
        scene.scissorsCountText = { setVisible() {} };
        scene.scissorsNaText = { setVisible() {} };
        scene.paperCountText = { setVisible() {} };
        scene.paperNaText = { setVisible() {} };
        let ntTextVisible = true;
        scene.ntEffectText = {
            setVisible(value) {
                ntTextVisible = value;
            }
        };

        scene.createStoneStorageIndicators(scene.panelBoxes[0]);
        scene.createStorageIndicators(scene.panelBoxes[1], ctx.inventoryStorageSpec('Scissors'));
        scene.createStorageIndicators(scene.panelBoxes[2], ctx.inventoryStorageSpec('Paper'));
        scene.createNtEffectsIndicator(scene.panelBoxes[3]);
        scene.syncStoneStorageIndicators();

        const stones = scene.stonesIndicator;
        const effects = scene.stoneNaIndicator;
        expect(stones).toBeInstanceOf(ctx.HmVerticalTableAmountIndicator);
        expect(stones.columns).toBe(3);
        expect(stones.direction).toBe('desc');
        expect(stones.shape).toBe('rectangle');
        expect(stones.maxAmount).toBe(21);
        expect(stones.stored).toBe(20);
        expect(stones.selected).toBe(3);
        expect(stones.items[0].kind).toBe('back-highlight');
        expect(stones.items[0].emitter.center.row).toBeGreaterThan(stones.items[1].emitter.center.row);
        expect(stones.center.col).toBeLessThan(effects.center.col);
        const span = heatMap.field.cols - 1;
        const cells = (pixels) => (pixels / heatMap.bounds.width) * span;
        expect(stones.width).toBeCloseTo(cells(54), 5);
        expect(effects.width).toBeCloseTo(cells(18), 5);
        expect(stones.center.col).toBeCloseTo(cells(8 + 27), 5);
        expect(effects.center.col).toBeCloseTo(cells(120 - 8 - 9), 5);

        expect(effects.columns).toBe(1);
        expect(effects.direction).toBe('asc');
        expect(effects.shape).toBe('round');
        expect(effects.maxAmount).toBe(8);
        expect(effects.stored).toBe(2);
        expect(effects.selected).toBe(0);
        expect(effects.items[0].kind).toBe('round');
        expect(effects.items[0].emitter.center.col).toBeCloseTo(effects.items[1].emitter.center.col, 5);
        expect(effects.items[0].emitter.center.row).toBeLessThan(effects.items[1].emitter.center.row);

        scene.selectedEffects = ['NegateSize'];
        scene.syncStoneStorageIndicators();
        expect(effects.selected).toBe(1);

        scene.gameData = inventory(15, 1);
        scene.syncStoneStorageIndicators();
        expect(stones.maxAmount).toBe(21);
        expect(stones.stored).toBe(15);
        expect(effects.maxAmount).toBe(8);
        expect(effects.stored).toBe(1);

        expect(scene.scissorsIndicator.maxAmount).toBe(21);
        expect(scene.scissorsIndicator.stored).toBe(12);
        expect(scene.scissorsIndicator.selected).toBe(0);
        expect(scene.scissorsNaIndicator.stored).toBe(5);
        expect(scene.scissorsNaIndicator.selected).toBe(0);
        expect(scene.paperIndicator.maxAmount).toBe(21);
        expect(scene.paperIndicator.stored).toBe(10);
        expect(scene.paperIndicator.selected).toBe(0);
        expect(scene.scissorsIndicator.shape).toBe('rectangle');
        expect(scene.scissorsNaIndicator.shape).toBe('round');
        expect(scene.paperIndicator.columns).toBe(3);
        expect(scene.scissorsNaIndicator.columns).toBe(1);
        expect(scene.scissorsNaIndicator.maxAmount).toBe(8);
        expect(scene.paperNaIndicator.columns).toBe(1);
        expect(scene.paperNaIndicator.maxAmount).toBe(8);
        expect(scene.scissorsNaIndicator.width).toBeCloseTo(effects.width, 5);
        expect(scene.scissorsIndicator.center.col).toBeGreaterThan(stones.center.col);
        expect(scene.paperIndicator.center.col).toBeGreaterThan(scene.scissorsIndicator.center.col);

        scene.stone.clear({ instant: true });
        fill(scene.paper, 4);
        scene.selectedEffects = ['NegateSize'];
        scene.syncStoneStorageIndicators();
        expect(scene.paperIndicator.selected).toBe(4);
        expect(scene.paperNaIndicator.selected).toBe(1);
        expect(stones.selected).toBe(0);
        expect(scene.scissorsIndicator.selected).toBe(0);
        expect(scene.scissorsNaIndicator.selected).toBe(0);

        const ntPanel = scene.panelBoxes[3];
        const nt = scene.ntEffectsIndicator;
        expect(ntTextVisible).toBe(false);
        expect(nt).toBeInstanceOf(ctx.HmVerticalTableAmountIndicator);
        expect(nt.columns).toBe(1);
        expect(nt.direction).toBe('asc');
        expect(nt.shape).toBe('round');
        expect(nt.maxAmount).toBe(6);
        expect(nt.stored).toBe(3);
        expect(nt.selected).toBe(0);
        expect(nt.items[0].kind).toBe('round');
        expect(nt.items[0].emitter.center.row).toBeLessThan(nt.items[1].emitter.center.row);
        expect(nt.items[0].emitter.center.col).toBeCloseTo(nt.items[5].emitter.center.col, 5);
        expect(nt.width).toBeCloseTo(cells((ntPanel.width - 16) * 0.5), 5);
        expect(nt.center.col).toBeCloseTo(cells(ntPanel.x + ntPanel.width / 2), 5);

        scene.gameData.payload.playerContext.inventory.items.NT_effect = 2;
        scene.syncStoneStorageIndicators();
        expect(nt.maxAmount).toBe(6);
        expect(nt.stored).toBe(2);
        expect(nt.selected).toBe(0);

        scene.selectedEffects = ['Protection'];
        scene.syncStoneStorageIndicators();
        expect(nt.selected).toBe(1);
        expect(scene.paperNaIndicator.selected).toBe(0);
    });

    it('shows the spent inventory as stored until the next move adds an item', () => {
        const ctx = loadHeat();
        loadScene(ctx);
        const heatMap = createHeatMap(ctx);
        const scene = Object.create(ctx.BlitzGameScene.prototype);
        scene.heatMap = heatMap;
        scene.panelBoxes = [
            { label: 'stone_storage_panel', x: 0, y: 700, width: 120, height: 120 },
            { label: 'scissors_storage_panel', x: 130, y: 700, width: 120, height: 120 },
            { label: 'paper_storage_panel', x: 260, y: 700, width: 120, height: 120 },
            { label: 'NT_effects_panel', x: 340, y: 700, width: 40, height: 120 }
        ];
        scene.stone = new ctx.HotMapUiStone(heatMap);
        scene.scissor = new ctx.HotMapUiScissor(heatMap);
        scene.paper = new ctx.HotMapUiNewPaper(heatMap);
        scene.selectedEffects = ['NegateSize', 'SizeOnly'];
        scene.gameData = inventory(21, 3);
        scene._sending = false;
        fill(scene.stone, 3);
        const countText = () => ({
            value: '',
            setText(value) {
                this.value = value;
            },
            setFont() {},
            setVisible() {},
            width: 0
        });
        scene.stoneCountText = countText();
        scene.stoneNaText = countText();
        scene.scissorsCountText = countText();
        scene.scissorsNaText = countText();
        scene.paperCountText = countText();
        scene.paperNaText = countText();
        scene.ntEffectText = countText();
        scene.createStoneStorageIndicators(scene.panelBoxes[0]);
        scene.createStorageIndicators(scene.panelBoxes[1], ctx.inventoryStorageSpec('Scissors'));
        scene.createStorageIndicators(scene.panelBoxes[2], ctx.inventoryStorageSpec('Paper'));
        scene.createNtEffectsIndicator(scene.panelBoxes[3]);
        scene.syncStoneStorageIndicators();
        expect(scene.stonesIndicator.stored).toBe(21);
        expect(scene.stonesIndicator.selected).toBe(3);
        expect(scene.stoneNaIndicator.selected).toBe(1);
        expect(scene.ntEffectsIndicator.selected).toBe(1);

        scene.acceptMoveInventory(inventory(18, 2));
        scene.gameData.payload.playerContext.inventory.items.NT_effect = 2;
        scene.refreshInventoryReadout();
        expect(scene.stonesIndicator.stored).toBe(18);
        expect(scene.stonesIndicator.selected).toBe(0);
        expect(scene.stoneNaIndicator.stored).toBe(2);
        expect(scene.stoneNaIndicator.selected).toBe(0);
        expect(scene.ntEffectsIndicator.stored).toBe(2);
        expect(scene.ntEffectsIndicator.selected).toBe(0);
        expect(scene.stoneCountText.value).toBe('18');
        expect(scene.stoneNaText.value).toBe('2');
        expect(scene.ntEffectText.value).toBe('2');

        scene._sending = true;
        scene.beginNextInventorySelection();
        scene.refreshInventoryReadout();
        expect(scene.stonesIndicator.selected).toBe(0);
        expect(scene.stoneNaIndicator.selected).toBe(0);

        scene._sending = false;
        scene.refreshMatchReadout = function () {
            this.refreshInventoryReadout();
        };
        scene.addCompositeItem('stone', 9);
        expect(scene.stonesIndicator.stored).toBe(18);
        expect(scene.stonesIndicator.selected).toBe(4);
        expect(scene.stoneCountText.value).toBe('14 + 4');
    });
});
