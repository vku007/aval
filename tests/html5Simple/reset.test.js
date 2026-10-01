import { describe, expect, it } from 'vitest';
import { createHeatMap, hashGrid, loadHeat } from './harness.js';

const DT = 1000 / 60;

function step(heatMap, frames) {
    for (let frame = 0; frame < frames; frame += 1) {
        heatMap.field.update(frame * DT, DT);
    }
}

function point(value) {
    if (!value) {
        return null;
    }
    return { col: value.col, row: value.row };
}

function pose(value) {
    if (!value) {
        return null;
    }
    return {
        width: value.width,
        height: value.height,
        angle: value.angle,
        skew: value.skew || 0,
        heat: value.heat,
        bend: value.bend || 0,
        cosine: value.cosine || 0
    };
}

function dump(item) {
    if (item.kind === 'hot-ball') {
        const motion = item.motion;
        return {
            t: motion.t,
            angle: motion.angle,
            phase: motion.params.phase,
            center: point(motion.orbitCenter),
            target: point(motion.orbitTarget),
            centerFollow: motion.centerFollow ?? null,
            phaseGoal: motion.phaseGoal ?? null
        };
    }
    if (item.kind === 'hot-rod') {
        const emitter = item.emitter;
        return {
            t: emitter.t,
            phase: emitter.phase,
            waitLeft: emitter.waitLeft,
            angle: emitter.params.angle,
            center: point(emitter.center),
            target: point(emitter.target)
        };
    }
    if (item.kind === 'back-highlight' || item.kind === 'shard') {
        const emitter = item.emitter;
        return {
            phase: emitter.phase,
            waitLeft: emitter.waitLeft,
            current: pose(emitter.current),
            center: point(emitter.center)
        };
    }
    if (item.kind === 'sheet') {
        const emitter = item.emitter;
        return {
            phase: emitter.phase,
            waitLeft: emitter.waitLeft,
            current: pose(emitter.current),
            center: point(emitter.center),
            glisten: emitter.glisten,
            glistenPhase: emitter.glistenPhase,
            glistenWait: emitter.glistenWait,
            ball: emitter.ball
        };
    }
    return {
        angle: item.angle,
        ballSpin: item.ballSpin,
        loopAngle: item.loopAngle,
        radius: item.radius,
        heat: item.heat,
        drama: item.drama ?? null,
        ballTravel: item.ballTravel ?? null
    };
}

function pair(ctx, build) {
    const lived = createHeatMap(ctx);
    const freshMap = createHeatMap(ctx);
    const livedItem = build(lived);
    const freshItem = build(freshMap);
    return { lived, freshMap, livedItem, freshItem };
}

function clearGrid(heatMap) {
    heatMap.field.src.fill(0);
    heatMap.field.dst.fill(0);
}

const builders = {
    'hot-ball': (ctx, heatMap) => new ctx.UiHotBall(heatMap),
    'hot-rod': (ctx, heatMap) => new ctx.UiHotRod(heatMap),
    'back-highlight': (ctx, heatMap) => new ctx.UiBackHighlighter(heatMap),
    shard: (ctx, heatMap) => new ctx.UiShard(heatMap, {
        from: { width: 56, height: 8, skew: -60, shapeHeat: 0.2, heat: 0.45 },
        to: { width: 70, height: 10, skew: -30, shapeHeat: 0.6, heat: 1.2 }
    }),
    sheet: (ctx, heatMap) => new ctx.UiSheet(heatMap),
    'new-sheet': (ctx, heatMap) => new ctx.UiNewSheet(heatMap)
};

describe('behaviour reset', () => {
    Object.keys(builders).forEach((kind) => {
        it(`${kind} reset equals a fresh item`, () => {
            const ctx = loadHeat();
            const { lived, freshMap, livedItem, freshItem } = pair(ctx, (heatMap) => builders[kind](ctx, heatMap));
            step(lived, 40);
            expect(dump(livedItem)).not.toEqual(dump(freshItem));
            livedItem.reset();
            expect(dump(livedItem)).toEqual(dump(freshItem));
            clearGrid(lived);
            clearGrid(freshMap);
            step(lived, 1);
            step(freshMap, 1);
            expect(hashGrid(lived.field.src)).toBe(hashGrid(freshMap.field.src));
        });
    });

    it('copies ball behaviour state with a phase shift', () => {
        const ctx = loadHeat();
        const leadMap = createHeatMap(ctx);
        const copyMap = createHeatMap(ctx);
        const lead = new ctx.UiHotBall(leadMap);
        const copy = new ctx.UiHotBall(copyMap);
        step(leadMap, 30);
        copy.copyBehaviourState(lead, { shift: 0.25 });
        expect(copy.motion.t).toBe(lead.motion.t);
        expect(copy.motion.angle).toBeCloseTo(lead.motion.angle + 0.25, 12);
        expect(copy.motion.orbitCenter).toEqual(lead.motion.orbitCenter);
    });
});
