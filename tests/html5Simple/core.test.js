import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { createHeatMap, loadHeat, SITE_ROOT } from './harness.js';

function samePoint(a, b) {
    expect(a.col).toBeCloseTo(b.col, 5);
    expect(a.row).toBeCloseTo(b.row, 5);
}

describe('UiCore', () => {
    it('puts one round, one circle, and one hot ball on the same center', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const core = new ctx.UiCore(heatMap, { name: 'Core', centerX: 40, centerY: 60 });
        expect(core.kind).toBe('core');
        expect(core.round.kind).toBe('round');
        expect(core.circle.kind).toBe('circle');
        expect(core.ball.kind).toBe('hot-ball');
        expect(core.balls()).toHaveLength(1);
        samePoint(core.round.emitter.center, core.center);
        samePoint(core.round.emitter.target, core.center);
        samePoint(core.circle.emitter.center, core.center);
        samePoint(core.circle.emitter.target, core.center);
        samePoint(core.ball.motion.orbitCenter, core.center);
        samePoint(core.ball.motion.orbitTarget, core.center);
        expect(ctx.createItem('core', heatMap).kind).toBe('core');
    });

    it('starts the round bright and fades it once', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const core = new ctx.UiCore(heatMap, { name: 'Core' });
        const emitter = core.round.emitter;
        expect(emitter.current.heat).toBeCloseTo(emitter.to.heat, 5);
        expect(emitter.current.radius).toBeCloseTo(emitter.to.radius, 5);
        expect(core.round.channels.combined().heat).toBeCloseTo(1, 5);

        for (let frame = 0; frame < 90; frame += 1) {
            heatMap.field.update(frame, 1000 / 60);
        }
        expect(emitter.current.heat).toBeCloseTo(emitter.to.heat, 5);
        expect(emitter.current.radius).toBeCloseTo(emitter.to.radius, 5);
        expect(core.round.channels.combined().heat).toBeCloseTo(0, 5);

        for (let frame = 0; frame < 90; frame += 1) {
            heatMap.field.update(90 + frame, 1000 / 60);
        }
        expect(emitter.current.heat).toBeCloseTo(emitter.to.heat, 5);
        expect(emitter.phase).toBe('wait');
        expect(core.round.channels.combined().heat).toBeCloseTo(0, 5);
    });

    it('holds a fitted core round at heat 0 and leaves a fitted prime round cycling', () => {
        const ctx = loadHeat();
        ctx.HmSkinnedButton = class HmSkinnedButton {};
        ['js/ui/HmSkinnedCoreButton.js', 'js/ui/HmSkinnedPrimeButton.js'].forEach((file) => {
            vm.runInContext(fs.readFileSync(path.join(SITE_ROOT, file), 'utf8'), ctx, { filename: file });
        });
        const heatMap = createHeatMap(ctx);
        const core = new ctx.UiCore(heatMap, { name: 'Core', animate: false });
        ctx.hmFitCoreLengths(core, 0.5);
        expect(core.round.channels.combined().heat).toBeCloseTo(0, 5);
        expect(core.round.emitter.phase).toBe('toEnd');

        const prime = new ctx.UiPrime(heatMap, { name: 'Prime', animate: false });
        expect(() => ctx.hmFitPrimeLengths(prime, 0.5)).not.toThrow();
        expect(prime.round.emitter.cycling).toBe(true);
        expect(prime.round.channels.combined().heat).toBeCloseTo(1, 5);
        expect(typeof prime.fadeRound).toBe('undefined');
    });

    it('keeps that center while the parts advance', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const core = new ctx.UiCore(heatMap, { centerX: 40, centerY: 60 });
        for (let frame = 0; frame < 30; frame += 1) {
            heatMap.field.update(frame, 1000 / 60);
        }
        samePoint(core.round.emitter.center, core.center);
        samePoint(core.circle.emitter.center, core.center);
        samePoint(core.ball.motion.orbitCenter, core.center);
    });

    it('moves every part when the core is retargeted', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const core = new ctx.UiCore(heatMap, { centerX: 40, centerY: 60 });
        core.retarget({ col: 20, row: 30 });
        samePoint(core.center, { col: 20, row: 30 });
        samePoint(core.round.emitter.center, core.center);
        samePoint(core.circle.emitter.center, core.center);
        samePoint(core.ball.motion.orbitCenter, core.center);
        samePoint(core.ball.motion.orbitTarget, core.center);
    });

    it('hides and restores every part together', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const core = new ctx.UiCore(heatMap);
        core.isVisible = false;
        expect(core.round.isVisible).toBe(false);
        expect(core.circle.isVisible).toBe(false);
        expect(core.ball.isVisible).toBe(false);
        core.isVisible = true;
        expect(core.round.isVisible).toBe(true);
        expect(core.circle.isVisible).toBe(true);
        expect(core.ball.isVisible).toBe(true);
    });

    it('round-trips the shared center and the circle', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const core = new ctx.UiCore(heatMap, { name: 'Core' });
        core.setCenter({ col: 18, row: 44 });
        core.nudgeParam('circle_fromOuter', 1);
        const loaded = new ctx.UiCore(heatMap, { name: 'Other' });
        loaded.applySerialized(core.serialize());
        expect(loaded.name).toBe('Core');
        samePoint(loaded.center, { col: 18, row: 44 });
        samePoint(loaded.round.emitter.center, loaded.center);
        samePoint(loaded.circle.emitter.center, loaded.center);
        samePoint(loaded.ball.motion.orbitCenter, loaded.center);
        expect(loaded.circle.emitter.from.outer).toBe(core.circle.emitter.from.outer);
    });

    it('adds a ball when parts exist, and rebuilds the set when empty', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const core = new ctx.UiCore(heatMap, { name: 'Core' });
        const first = core.ball;
        const added = core.addItem();
        expect(core.round).toBeTruthy();
        expect(core.circle).toBeTruthy();
        expect(core.balls()).toEqual([first, added]);
        expect(added).not.toBe(first);
        expect(added.kind).toBe('hot-ball');
        samePoint(added.motion.orbitCenter, core.center);

        expect(core.removeItem()).toBe(added);
        expect(core.balls()).toEqual([first]);
        expect(core.round).toBeTruthy();
        expect(core.circle).toBeTruthy();

        expect(core.removeItem()).toBe(first);
        expect(core.balls()).toHaveLength(0);
        expect(core.round).toBeNull();
        expect(core.circle).toBeNull();
        expect(core.ball).toBeNull();

        const rebuilt = core.addItem();
        expect(core.round.kind).toBe('round');
        expect(core.circle.kind).toBe('circle');
        expect(core.balls()).toEqual([rebuilt]);
        samePoint(core.circle.emitter.center, core.center);
        samePoint(rebuilt.motion.orbitCenter, core.center);
    });

    it('slides two balls to a smaller square, then lines three up through the center', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const core = new ctx.UiCore(heatMap, { name: 'Core' });
        const first = core.ball;
        const span = core.ballSpan();
        const inner = core.circle.emitter.current.inner;
        expect(span).toBeCloseTo(inner * 0.8 * 0.8 / Math.SQRT2, 5);
        const second = core.addItem();
        expect(second).toBeTruthy();
        for (let frame = 0; frame < 90; frame += 1) {
            heatMap.field.update(frame, 1000 / 60);
        }
        const firstCorner = first.channels.combined().offset;
        const secondCorner = second.channels.combined().offset;
        expect(firstCorner.col).toBeCloseTo(-span, 3);
        expect(firstCorner.row).toBeCloseTo(-span, 3);
        expect(secondCorner.col).toBeCloseTo(span, 3);
        expect(secondCorner.row).toBeCloseTo(span, 3);

        const lineSpan = core.ballSpan();
        const third = core.addItem();
        expect(third).toBeTruthy();
        expect(core.balls()).toHaveLength(3);
        for (let frame = 0; frame < 90; frame += 1) {
            heatMap.field.update(frame, 1000 / 60);
        }
        const firstLine = first.channels.combined().offset;
        const secondLine = second.channels.combined().offset;
        const thirdLine = third.channels.combined().offset;
        expect(firstLine.col).toBeCloseTo(-lineSpan, 3);
        expect(firstLine.row).toBeCloseTo(0, 3);
        expect(secondLine.col).toBeCloseTo(lineSpan, 3);
        expect(secondLine.row).toBeCloseTo(0, 3);
        expect(thirdLine.col).toBeCloseTo(0, 3);
        expect(thirdLine.row).toBeCloseTo(0, 3);

        const cornerSpan = core.ballSpan();
        const fourth = core.addItem();
        expect(fourth).toBeTruthy();
        expect(core.balls()).toHaveLength(4);
        for (let frame = 0; frame < 90; frame += 1) {
            heatMap.field.update(frame, 1000 / 60);
        }
        const placed = [first, second, third, fourth].map((ball) => ball.channels.combined().offset);
        expect(placed[0].col).toBeCloseTo(-cornerSpan, 3);
        expect(placed[0].row).toBeCloseTo(-cornerSpan, 3);
        expect(placed[1].col).toBeCloseTo(cornerSpan, 3);
        expect(placed[1].row).toBeCloseTo(-cornerSpan, 3);
        expect(placed[2].col).toBeCloseTo(-cornerSpan, 3);
        expect(placed[2].row).toBeCloseTo(cornerSpan, 3);
        expect(placed[3].col).toBeCloseTo(cornerSpan, 3);
        expect(placed[3].row).toBeCloseTo(cornerSpan, 3);
        samePoint(first.motion.orbitCenter, core.center);
        samePoint(second.motion.orbitCenter, core.center);
        samePoint(third.motion.orbitCenter, core.center);
        samePoint(fourth.motion.orbitCenter, core.center);

        const shiftSpan = core.ballSpan();
        const fifth = core.addItem();
        expect(fifth).toBeTruthy();
        expect(fifth.channels.combined().offset.col).toBeCloseTo(0, 3);
        expect(fifth.channels.combined().offset.row).toBeCloseTo(0, 3);
        expect(core.balls()).toHaveLength(5);
        for (let frame = 0; frame < 90; frame += 1) {
            heatMap.field.update(frame, 1000 / 60);
        }
        const shifted = [first, second, third, fourth, fifth].map((ball) => ball.channels.combined().offset);
        expect(shifted[0].col).toBeCloseTo(shiftSpan, 3);
        expect(shifted[0].row).toBeCloseTo(-shiftSpan, 3);
        expect(shifted[1].col).toBeCloseTo(-shiftSpan, 3);
        expect(shifted[1].row).toBeCloseTo(shiftSpan, 3);
        expect(shifted[2].col).toBeCloseTo(shiftSpan, 3);
        expect(shifted[2].row).toBeCloseTo(shiftSpan, 3);
        expect(shifted[3].col).toBeCloseTo(0, 3);
        expect(shifted[3].row).toBeCloseTo(0, 3);
        expect(shifted[4].col).toBeCloseTo(-shiftSpan, 3);
        expect(shifted[4].row).toBeCloseTo(-shiftSpan, 3);
        samePoint(fifth.motion.orbitCenter, core.center);

        const edgeSpan = core.ballSpan();
        const sixth = core.addItem();
        expect(sixth).toBeTruthy();
        expect(sixth.channels.combined().offset.col).toBeCloseTo(0, 3);
        expect(sixth.channels.combined().offset.row).toBeCloseTo(0, 3);
        expect(core.balls()).toHaveLength(6);
        for (let frame = 0; frame < 90; frame += 1) {
            heatMap.field.update(frame, 1000 / 60);
        }
        const edged = [first, second, third, fourth, fifth, sixth].map((ball) => ball.channels.combined().offset);
        expect(edged[0].col).toBeCloseTo(0, 3);
        expect(edged[0].row).toBeCloseTo(edgeSpan, 3);
        expect(edged[1].col).toBeCloseTo(0, 3);
        expect(edged[1].row).toBeCloseTo(-edgeSpan, 3);
        expect(edged[2].col).toBeCloseTo(edgeSpan, 3);
        expect(edged[2].row).toBeCloseTo(-edgeSpan, 3);
        expect(edged[3].col).toBeCloseTo(edgeSpan, 3);
        expect(edged[3].row).toBeCloseTo(edgeSpan, 3);
        expect(edged[4].col).toBeCloseTo(-edgeSpan, 3);
        expect(edged[4].row).toBeCloseTo(edgeSpan, 3);
        expect(edged[5].col).toBeCloseTo(-edgeSpan, 3);
        expect(edged[5].row).toBeCloseTo(-edgeSpan, 3);
        samePoint(sixth.motion.orbitCenter, core.center);

        const sevenSpan = core.ballSpan();
        const seventh = core.addItem();
        expect(seventh).toBeTruthy();
        expect(seventh.channels.combined().offset.col).toBeCloseTo(0, 3);
        expect(seventh.channels.combined().offset.row).toBeCloseTo(0, 3);
        expect(core.balls()).toHaveLength(7);
        for (let frame = 0; frame < 90; frame += 1) {
            heatMap.field.update(frame, 1000 / 60);
        }
        const seven = [first, second, third, fourth, fifth, sixth, seventh].map((ball) => ball.channels.combined().offset);
        expect(seven[0].col).toBeCloseTo(-sevenSpan, 3);
        expect(seven[0].row).toBeCloseTo(sevenSpan, 3);
        expect(seven[1].col).toBeCloseTo(sevenSpan, 3);
        expect(seven[1].row).toBeCloseTo(-sevenSpan, 3);
        expect(seven[2].col).toBeCloseTo(sevenSpan, 3);
        expect(seven[2].row).toBeCloseTo(sevenSpan, 3);
        expect(seven[3].col).toBeCloseTo(0, 3);
        expect(seven[3].row).toBeCloseTo(sevenSpan, 3);
        expect(seven[4].col).toBeCloseTo(-sevenSpan, 3);
        expect(seven[4].row).toBeCloseTo(-sevenSpan, 3);
        expect(seven[5].col).toBeCloseTo(0, 3);
        expect(seven[5].row).toBeCloseTo(-sevenSpan, 3);
        expect(seven[6].col).toBeCloseTo(0, 3);
        expect(seven[6].row).toBeCloseTo(0, 3);
        samePoint(seventh.motion.orbitCenter, core.center);

        const eightSpan = core.ballSpan();
        const eighth = core.addItem();
        expect(eighth).toBeTruthy();
        expect(eighth.channels.combined().offset.col).toBeCloseTo(0, 3);
        expect(eighth.channels.combined().offset.row).toBeCloseTo(0, 3);
        expect(core.balls()).toHaveLength(8);
        for (let frame = 0; frame < 90; frame += 1) {
            heatMap.field.update(frame, 1000 / 60);
        }
        const eight = [first, second, third, fourth, fifth, sixth, seventh, eighth].map((ball) => ball.channels.combined().offset);
        expect(eight[0].col).toBeCloseTo(eightSpan, 3);
        expect(eight[0].row).toBeCloseTo(-eightSpan, 3);
        expect(eight[1].col).toBeCloseTo(-eightSpan, 3);
        expect(eight[1].row).toBeCloseTo(eightSpan, 3);
        expect(eight[2].col).toBeCloseTo(-eightSpan, 3);
        expect(eight[2].row).toBeCloseTo(-eightSpan, 3);
        expect(eight[3].col).toBeCloseTo(0, 3);
        expect(eight[3].row).toBeCloseTo(-eightSpan, 3);
        expect(eight[4].col).toBeCloseTo(eightSpan, 3);
        expect(eight[4].row).toBeCloseTo(eightSpan, 3);
        expect(eight[5].col).toBeCloseTo(0, 3);
        expect(eight[5].row).toBeCloseTo(eightSpan, 3);
        expect(eight[6].col).toBeCloseTo(eightSpan, 3);
        expect(eight[6].row).toBeCloseTo(0, 3);
        expect(eight[7].col).toBeCloseTo(-eightSpan, 3);
        expect(eight[7].row).toBeCloseTo(0, 3);
        samePoint(eighth.motion.orbitCenter, core.center);

        const nineSpan = core.ballSpan();
        const ninth = core.addItem();
        expect(ninth).toBeTruthy();
        expect(ninth.channels.combined().offset.col).toBeCloseTo(0, 3);
        expect(ninth.channels.combined().offset.row).toBeCloseTo(0, 3);
        expect(core.addItem()).toBeNull();
        expect(core.balls()).toHaveLength(9);
        for (let frame = 0; frame < 90; frame += 1) {
            heatMap.field.update(frame, 1000 / 60);
        }
        const nine = [first, second, third, fourth, fifth, sixth, seventh, eighth, ninth].map((ball) => ball.channels.combined().offset);
        expect(nine[0].col).toBeCloseTo(nineSpan, 3);
        expect(nine[0].row).toBeCloseTo(0, 3);
        expect(nine[1].col).toBeCloseTo(-nineSpan, 3);
        expect(nine[1].row).toBeCloseTo(0, 3);
        expect(nine[2].col).toBeCloseTo(0, 3);
        expect(nine[2].row).toBeCloseTo(-nineSpan, 3);
        expect(nine[3].col).toBeCloseTo(nineSpan, 3);
        expect(nine[3].row).toBeCloseTo(-nineSpan, 3);
        expect(nine[4].col).toBeCloseTo(0, 3);
        expect(nine[4].row).toBeCloseTo(nineSpan, 3);
        expect(nine[5].col).toBeCloseTo(-nineSpan, 3);
        expect(nine[5].row).toBeCloseTo(nineSpan, 3);
        expect(nine[6].col).toBeCloseTo(nineSpan, 3);
        expect(nine[6].row).toBeCloseTo(nineSpan, 3);
        expect(nine[7].col).toBeCloseTo(0, 3);
        expect(nine[7].row).toBeCloseTo(0, 3);
        expect(nine[8].col).toBeCloseTo(-nineSpan, 3);
        expect(nine[8].row).toBeCloseTo(-nineSpan, 3);
        samePoint(ninth.motion.orbitCenter, core.center);
    }, 40000);

    it('uses the core2 preset, fades the round, and keeps the ball orbit', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const core = new ctx.UiCore(heatMap, { name: 'Core' });
        expect(core.round.emitter.from.radius).toBe(core.circle.emitter.from.inner);
        expect(core.round.emitter.to.radius).toBe(core.circle.emitter.to.inner);
        expect(core.circle.emitter.from.outer).toBe(48);
        expect(core.circle.emitter.from.inner).toBe(44);
        expect(core.ball.motion.params.orbitRadius).toBe(3);
        expect(core.ball.motion.params.angleSpeed).toBe(8);
        expect(core.ball.motion.params.radius).toBe(4);
        expect(core.round.isVisible).toBe(true);
        const angle = core.ball.motion.angle;
        for (let frame = 0; frame < 90; frame += 1) {
            heatMap.field.update(frame, 1000 / 60);
        }
        expect(core.round.channels.combined().heat).toBeCloseTo(0, 3);
        expect(core.ball.motion.params.orbitRadius).toBe(3);
        expect(core.ball.motion.angle).toBeGreaterThan(angle);
    });

    it('edits circle, round, and ball props from the core', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const core = new ctx.UiCore(heatMap);
        const outer = core.circle.emitter.from.outer;
        const radius = core.round.emitter.from.radius;
        const dot = core.ball.motion.params.radius;
        expect(core.params.circle_fromOuter).toBe(outer);
        expect(core.params.round_fromRadius).toBe(radius);
        expect(core.params.ball_radius).toBe(dot);
        core.nudgeParam('circle_fromOuter', 1);
        core.nudgeParam('round_fromRadius', 1);
        core.nudgeParam('ball_radius', 1);
        expect(core.circle.emitter.from.outer).toBeGreaterThan(outer);
        expect(core.round.emitter.from.radius).toBeGreaterThan(radius);
        expect(core.ball.motion.params.radius).toBeGreaterThan(dot);
        const keys = ctx.UiCore.PROP_TABS.reduce((all, tab) => all.concat(tab.rows.map((row) => row.key)), []);
        expect(keys).toContain('circle_fromOuter');
        expect(keys).toContain('round_fromRadius');
        expect(keys).toContain('ball_radius');
        expect(keys).toContain('addItem');
        expect(keys).toContain('removeItem');
    });
});
