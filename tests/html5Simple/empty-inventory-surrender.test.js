import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { loadHeat, SITE_ROOT } from './harness.js';

function loadScene(ctx) {
    ctx.Phaser = ctx.Phaser || {};
    ctx.Phaser.Scene = class Scene {};
    const util = fs.readFileSync(path.join(SITE_ROOT, 'js/utils/SimpleGameSceneUtil.js'), 'utf8');
    const source = fs.readFileSync(path.join(SITE_ROOT, 'js/scenes/BlitzGameScene.js'), 'utf8');
    vm.runInContext(
        `${util}\n${source}\n;globalThis.BlitzGameScene = BlitzGameScene;`,
        ctx,
        { filename: 'BlitzGameScene.js' }
    );
}

function doneRun() {
    return { finished: Promise.resolve({ status: 'finished' }) };
}

function bar(x, faded) {
    return {
        _x: x,
        _faded: !!faded,
        hovered: false,
        setHovered(on) {
            this.hovered = on;
        }
    };
}

function sceneFor(ctx) {
    const scene = Object.create(ctx.BlitzGameScene.prototype);
    scene.heatMap = { field: { destroyed: false } };
    scene.fieldLive = () => true;
    scene.healthBars = [bar(10), bar(20), bar(30, true)];
    scene.enemyHealthBars = [bar(70), bar(80), bar(90)];
    return scene;
}

function match(loser) {
    const empty = { stones: 0, scissors: 0, papers: 0 };
    const full = { stones: 3, scissors: 3, papers: 3 };
    const winnerId = loser === 'player' ? 'NPC_1' : 'user-1';
    return {
        payload: {
            gameContext: {
                status: 'finished',
                max_stone_per_turn: 9,
                max_scissors_per_turn: 4,
                max_paper_per_turn: 7
            },
            playerContext: {
                inventory: { items: loser === 'player' ? empty : full },
                roundStates: [{
                    status: 'finished',
                    winnerId,
                    subRoundStates: [{ status: 'surrendered', winnerId, moves: [] }]
                }]
            },
            enemyContext: {
                inventory: { items: loser === 'enemy' ? empty : full }
            }
        }
    };
}

describe('empty inventory surrender strikes', () => {
    it('plays one lose strike for each health bar the empty loser still has', async () => {
        const ctx = loadHeat();
        loadScene(ctx);
        const scene = sceneFor(ctx);
        scene.gameData = match('player');
        let pulses = 0;
        scene.playEnemyVictoryPulse = () => {
            pulses += 1;
            return doneRun();
        };
        scene.playPlayerVictoryPulse = () => doneRun();

        await scene.playSurrenderStrikes('user-1');

        expect(pulses).toBe(2);
        expect(scene.healthBars.every((bar) => bar._faded)).toBe(true);
        expect(scene.enemyHealthBars.every((bar) => bar._faded)).toBe(false);
    });

    it('plays one lose strike for each remaining bar when the opponent is empty', async () => {
        const ctx = loadHeat();
        loadScene(ctx);
        const scene = sceneFor(ctx);
        scene.gameData = match('enemy');
        let pulses = 0;
        scene.playPlayerVictoryPulse = () => {
            pulses += 1;
            return doneRun();
        };
        scene.playEnemyVictoryPulse = () => doneRun();

        await scene.playSurrenderStrikes('user-1');

        expect(pulses).toBe(3);
        expect(scene.enemyHealthBars.every((bar) => bar._faded)).toBe(true);
    });

    it('asks for one victory pulse on a one-round loss', async () => {
        const ctx = loadHeat();
        loadScene(ctx);
        const scene = sceneFor(ctx);
        scene.gameData = {
            payload: {
                gameContext: { status: 'started' },
                playerContext: {
                    inventory: { items: { stones: 4, scissors: 4, papers: 4 } },
                    roundStates: []
                }
            }
        };
        scene.holdNtCoreForTurn = () => {};
        scene.latestExchange = () => ({
            playerType: 'Stone',
            enemyType: 'Paper',
            enemySize: 1,
            winnerId: 'NPC_1'
        });
        scene.playerByType = { Stone: { reset() {} } };
        scene.enemyByType = {
            Paper: {
                reveal() {
                    return doneRun();
                },
                reset() {}
            }
        };
        scene.resetEnemyBoards = () => {};
        scene.turnCap = () => 9;
        scene.fieldWait = () => doneRun();
        scene.playHorisontalPulse = () => doneRun();
        scene.playUserFightPulse = () => doneRun();
        scene.dramaticClear = () => doneRun();
        scene.playUserPostMortemPulse = () => doneRun();
        scene.fadeLeadingHealthBar = () => {};
        let roundPulses = 0;
        let surrenderPulses = 0;
        scene.playEnemyVictoryPulse = () => {
            roundPulses += 1;
            return doneRun();
        };
        scene.playPlayerVictoryPulse = () => doneRun();
        scene.playSurrenderStrikes = async () => {
            surrenderPulses += 1;
            return true;
        };

        await scene.playMoveResult('user-1');

        expect(roundPulses).toBe(1);
        expect(surrenderPulses).toBe(1);
        const quiet = sceneFor(ctx);
        quiet.gameData = match('player');
        quiet.gameData.payload.playerContext.inventory.items = { stones: 1, scissors: 0, papers: 0 };
        quiet.playEnemyVictoryPulse = () => {
            surrenderPulses += 1;
            return doneRun();
        };
        await quiet.playSurrenderStrikes('user-1');
        expect(surrenderPulses).toBe(1);
    });
});
