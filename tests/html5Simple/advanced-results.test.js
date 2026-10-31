import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { SITE_ROOT } from './harness.js';

function loadUtil() {
    const context = vm.createContext({ console });
    const source = fs.readFileSync(
        path.join(SITE_ROOT, 'js/utils/SimpleGameSceneUtil.js'),
        'utf8'
    );
    vm.runInContext(
        `${source}\n;globalThis.SimpleGameSceneUtil = SimpleGameSceneUtil;`,
        context,
        { filename: 'SimpleGameSceneUtil.js' }
    );
    return context.SimpleGameSceneUtil;
}

function finishedMatch() {
    return {
        payload: {
            gameContext: { status: 'finished' },
            enemyContext: { name: 'Rival' },
            playerContext: {
                roundStates: [
                    {
                        status: 'finished',
                        winnerId: 'ada',
                        subRoundStates: [
                            {
                                status: 'done',
                                winnerId: null,
                                moves: [
                                    move('ada', 'Stone', 2, [{ kind: 'NegateSize' }]),
                                    move('npc', 'Stone', 2, [])
                                ]
                            },
                            {
                                status: 'done',
                                winnerId: 'ada',
                                moves: [
                                    move('ada', 'Scissors', 3, [{ kind: 'SizeOnly' }]),
                                    move('npc', 'Paper', 4, [])
                                ]
                            }
                        ]
                    },
                    {
                        status: 'finished',
                        winnerId: 'npc',
                        subRoundStates: [
                            {
                                status: 'done',
                                winnerId: 'npc',
                                moves: [
                                    move('ada', 'Paper', 1, [{ kind: 'Overpower' }]),
                                    move('npc', 'Scissors', 1, [])
                                ]
                            }
                        ]
                    },
                    {
                        status: 'finished',
                        winnerId: 'ada',
                        subRoundStates: [
                            {
                                status: 'done',
                                winnerId: 'ada',
                                moves: [
                                    move('ada', 'Stone', 4, []),
                                    move('npc', 'Scissors', 2, [])
                                ]
                            }
                        ]
                    },
                    {
                        status: 'current',
                        subRoundStates: []
                    }
                ]
            }
        }
    };
}

function move(userId, moveType, size, effects) {
    return {
        userId,
        context: { moveType, size, effects }
    };
}

describe('advanced game results', () => {
    it('counts the winner, finished rounds, and what the player spent', () => {
        const util = loadUtil();
        const summary = util.summarizeAdvancedResult(finishedMatch(), 'ada');

        expect(summary.winner).toBe('you');
        expect(summary.playerScore).toBe(2);
        expect(summary.enemyScore).toBe(1);
        expect(summary.rounds).toBe(3);
        expect(summary.items).toEqual({ stones: 6, scissors: 3, papers: 1, total: 10 });
        expect(summary.enemyItems).toEqual({ stones: 2, scissors: 3, papers: 4, total: 9 });
        expect(summary.effects).toEqual({
            NA_effect_stone: 1,
            NA_effect_scissors: 0,
            NA_effect_papers: 1,
            NT_effect: 1,
            total: 3
        });
        expect(summary.enemyEffects).toEqual({
            NA_effect_stone: 0,
            NA_effect_scissors: 0,
            NA_effect_papers: 0,
            NT_effect: 0,
            total: 0
        });
    });

    it('builds a finished match stub for the choose-game results button', () => {
        const util = loadUtil();
        const summary = util.summarizeAdvancedResult(util.finishedAdvancedGameStub('ada'), 'ada');

        expect(summary.winner).toBe('you');
        expect(summary.playerScore).toBe(2);
        expect(summary.enemyScore).toBe(1);
        expect(summary.rounds).toBe(3);
        expect(summary.items.total).toBe(10);
        expect(summary.enemyItems.stones).toBe(2);
        expect(summary.effects.total).toBe(3);
        expect(summary.enemyEffects.NA_effect_stone).toBe(0);
    });

    it('names the enemy when the enemy has more finished rounds', () => {
        const util = loadUtil();
        const summary = util.summarizeAdvancedResult(finishedMatch(), 'npc');

        expect(summary.winner).toBe('enemy');
        expect(summary.playerScore).toBe(1);
        expect(summary.enemyScore).toBe(2);
        expect(summary.items).toEqual({ stones: 2, scissors: 3, papers: 4, total: 9 });
        expect(summary.enemyItems).toEqual({ stones: 6, scissors: 3, papers: 1, total: 10 });
        expect(summary.effects.total).toBe(0);
        expect(summary.enemyEffects).toEqual({
            NA_effect_stone: 1,
            NA_effect_scissors: 0,
            NA_effect_papers: 1,
            NT_effect: 1,
            total: 3
        });
    });

    it('opens the results scene from a finished advanced match and returns to the menu', () => {
        const scene = fs.readFileSync(
            path.join(SITE_ROOT, 'js/scenes/BlitzGameScene.js'),
            'utf8'
        );
        const results = fs.readFileSync(
            path.join(SITE_ROOT, 'js/scenes/AdvancedGameResultsScene.js'),
            'utf8'
        );
        const html = fs.readFileSync(path.join(SITE_ROOT, 'index.html'), 'utf8');
        const game = fs.readFileSync(path.join(SITE_ROOT, 'js/game.js'), 'utf8');

        const tests = fs.readFileSync(
            path.join(SITE_ROOT, 'js/scenes/TestsScene.js'),
            'utf8'
        );

        expect(scene).toContain("fxGoTo(this, 'AdvancedGameResultsScene'");
        expect(tests).toContain("label: 'RESULTS'");
        expect(tests).toContain('finishedAdvancedGameStub');
        expect(tests).toContain("fxGoTo(this, 'AdvancedGameResultsScene'");
        expect(results).toContain("fxGoTo(this, this.returnTo || 'MenuScene')");
        expect(results).toContain("return 'Victory!'");
        expect(results).toContain("return 'Defeat...'");
        expect(results).toContain('this.resultTitle(summary)');
        expect(results).not.toContain('Advanced game results');
        expect(results).toContain('new RoundsResultBar');
        expect(results).toContain('new StonesResultBar');
        expect(results).toContain('endLeftValue: summary.items.stones');
        expect(results).toContain('endRightValue: summary.enemyItems.stones');
        expect(results).toContain('this.resultBars()');
        expect(results).toContain('new StonePrimeResultBar');
        expect(results).toContain('endLeftValue: summary.effects.NA_effect_stone');
        expect(results).toContain('endRightValue: summary.enemyEffects.NA_effect_stone');
        expect(results).toContain('new ScissorsResultBar');
        expect(results).toContain('endLeftValue: summary.items.scissors');
        expect(results).toContain('endRightValue: summary.enemyItems.scissors');
        expect(results).toContain('new ScissorsPrimeResultBar');
        expect(results).toContain('endLeftValue: summary.effects.NA_effect_scissors');
        expect(results).toContain('endRightValue: summary.enemyEffects.NA_effect_scissors');
        expect(results).toContain('new PaperResultBar');
        expect(results).toContain('endLeftValue: summary.items.papers');
        expect(results).toContain('endRightValue: summary.enemyItems.papers');
        expect(results).toContain('new PaperPrimeResultBar');
        expect(results).toContain('endLeftValue: summary.effects.NA_effect_papers');
        expect(results).toContain('endRightValue: summary.enemyEffects.NA_effect_papers');
        expect(results).toContain('new CoreResultBar');
        expect(results).toContain('endLeftValue: summary.effects.NT_effect');
        expect(results).toContain('endRightValue: summary.enemyEffects.NT_effect');
        expect(results).not.toContain('Items spent');
        expect(results).not.toContain('Effects spent');
        expect(results).not.toContain('linkStonePrimeComposite');
        expect(results).not.toContain('createResultBarStonePrime');
        expect(results).toContain('captionText');
        expect(results).toContain('spaceAbove');
        expect(results).toContain('endLeftValue: summary.playerScore');
        expect(results).toContain('endRightValue: summary.enemyScore');
        expect(results).toContain('bar.update(time, delta)');
        expect(html).toContain('js/ui/ResultBar.js');
        expect(results).toContain('mountUiSkin');
        expect(results).toContain('highlighters: false');
        expect(results).not.toContain('armMenuHighlights');
        expect(results).toContain('linkOkHighlight');
        expect(results).toContain('linkResultBarHighlight');
        expect(results).toContain('createResultBarHighlight');
        expect(results).not.toContain('createResultBarStone');
        expect(results).not.toContain('linkStonesComposite');
        expect(results).toContain('host.highlighters.push(mounted.highlight)');
        expect(results).toContain("name: 'OK'");
        expect(results).toContain('armHover');
        expect(results).toContain("btn.on('pointerover'");
        expect(results).toContain('styleUiSkinMenuButton');
        expect(results).toContain('isUiSkinOn()');
        expect(results).toContain("super({ key: 'AdvancedGameResultsScene' })");
        expect(html).toContain('js/scenes/AdvancedGameResultsScene.js');
        expect(game).toContain('AdvancedGameResultsScene');
    });
});
