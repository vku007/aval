import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createHeatMap, hashGrid, loadHeat, SITE_ROOT } from './harness.js';

const DT = 1000 / 60;

function step(heatMap, frames) {
    for (let frame = 0; frame < frames; frame += 1) {
        heatMap.field.update(frame * DT, DT);
    }
}

function fill(ctx, name, heatMap) {
    const group = ctx.createComposite(name, heatMap);
    group.addItem({ animate: false });
    group.addItem({ animate: false });
    group.addItem({ animate: false });
    return group;
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
        heat: value.heat
    };
}

function snapItem(item) {
    if (item.kind === 'hot-ball') {
        const motion = item.motion;
        return {
            kind: item.kind,
            angle: motion.angle,
            phase: motion.params.phase,
            radius: motion.params.radius,
            center: point(motion.orbitCenter),
            target: point(motion.orbitTarget)
        };
    }
    if (item.kind === 'shard') {
        const emitter = item.emitter;
        return {
            kind: item.kind,
            phase: emitter.phase,
            waitLeft: emitter.waitLeft,
            speed: emitter.params.speed,
            fromAngle: emitter.from.angle,
            toAngle: emitter.to.angle,
            current: pose(emitter.current),
            center: point(emitter.center),
            target: point(emitter.target)
        };
    }
    if (item.kind === 'sheet') {
        const emitter = item.emitter;
        return {
            kind: item.kind,
            phase: emitter.phase,
            waitLeft: emitter.waitLeft,
            ball: emitter.ball,
            ballSpeed: emitter.params.ballSpeed,
            glisten: emitter.glisten,
            glistenPhase: emitter.glistenPhase,
            current: pose(emitter.current),
            center: point(emitter.center),
            target: point(emitter.target),
            travel: emitter.travel ? emitter.travel.stage : null
        };
    }
    return {
        kind: item.kind,
        angle: item.angle,
        ballSpin: item.ballSpin,
        ballSpeed: item.ballSpeed,
        loopAngle: item.loopAngle,
        depth: item.depth,
        radius: item.radius,
        heat: item.heat,
        visible: item.isVisible !== false,
        center: point({ col: item.pivotCol, row: item.pivotRow })
    };
}

function snap(group) {
    return {
        count: group.items.length,
        center: point(group.center),
        items: group.items.map(snapItem),
        channels: group.channels.combined()
    };
}

const configs = ['stone', 'scissor', 'paper', 'diskStack'];

describe('composites', () => {
    configs.forEach((name) => {
        it(`${name} reset equals a fresh composite`, () => {
            const ctx = loadHeat();
            const livedMap = createHeatMap(ctx);
            const freshMap = createHeatMap(ctx);
            const lived = fill(ctx, name, livedMap);
            step(livedMap, 40);
            expect(snap(lived)).not.toEqual(snap(fill(ctx, name, createHeatMap(ctx))));
            lived.reset();
            const fresh = fill(ctx, name, freshMap);
            expect(snap(lived)).toEqual(snap(fresh));
            livedMap.field.src.fill(0);
            livedMap.field.dst.fill(0);
            freshMap.field.src.fill(0);
            freshMap.field.dst.fill(0);
            step(livedMap, 1);
            step(freshMap, 1);
            expect(hashGrid(livedMap.field.src)).toBe(hashGrid(freshMap.field.src));
        });
    });

    it('keeps one sheet speed local and writes ballSpeed through the group', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const group = fill(ctx, 'paper', heatMap);
        const lead = group.items[0];
        const other = group.items[1];
        const diskGroup = fill(ctx, 'diskStack', heatMap);
        const diskA = diskGroup.items[0];
        const diskB = diskGroup.items[1];
        lead.emitter.setParam('ballSpeed', 0.2);
        expect(other.emitter.params.ballSpeed).toBe(0.5);
        expect(group.sheetInit.ballSpeed).toBe(0.5);
        group.set('ballSpeed', 0.9);
        expect(group.sheetInit.ballSpeed).toBe(0.9);
        expect(lead.emitter.params.ballSpeed).toBe(0.9);
        expect(other.emitter.params.ballSpeed).toBe(0.9);
        diskA.setParam('ballSpeed', 40);
        expect(diskB.ballSpeed).toBe(100);
        expect(diskGroup.sheetInit.ballSpeed).toBe(100);
        diskGroup.set('ballSpeed', 80);
        expect(diskGroup.sheetInit.ballSpeed).toBe(80);
        expect(diskA.ballSpeed).toBe(80);
        expect(diskB.ballSpeed).toBe(80);
    });

    it('keeps paper ball phases a fixed shift apart', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const group = fill(ctx, 'paper', heatMap);
        step(heatMap, 90);
        const balls = group.items.map((item) => item.emitter.ball);
        const gap = (balls[1] - balls[0] + 1) % 1;
        expect(gap).toBeCloseTo(0.08, 6);
        expect(((balls[2] - balls[0] + 1) % 1)).toBeCloseTo(0.16, 6);
    });

    it('shakes and flashes the group channels', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const group = fill(ctx, 'stone', heatMap);
        const hit = group.hit();
        expect(hit.slotName).toBe('react');
        hit.seek(0.25);
        expect(Math.abs(group.channels.combined().offset.col)).toBeGreaterThan(0);
        expect(group.items[0].parent).toBe(group);
        hit.finish();
        expect(group.channels.combined().offset).toEqual({ col: 0, row: 0 });
        const burst = group.break();
        burst.seek(burst.duration / 2);
        expect(group.channels.combined().heat).toBeGreaterThan(1);
    });

    it('reveals on a stagger and clears on a stagger', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const group = ctx.createComposite('stone', heatMap);
        const reveal = group.reveal(3);
        expect(group.items.length).toBe(1);
        reveal.finish();
        expect(group.items.length).toBe(3);
        const clearing = group.clear();
        expect(group.items.length).toBe(3);
        clearing.finish();
        group.items.slice().forEach((item) => {
            const exit = item._slots.life && item._slots.life.active;
            if (exit) {
                exit.finish();
            }
        });
        expect(group.items.length).toBe(0);
    });

    it('cancel of exit leaves the item in the group', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const group = ctx.createComposite('scissor', heatMap);
        const shard = group.addItem({ animate: false });
        const run = group.remove(shard);
        expect(run.status).toBe('running');
        expect(group.items).toContain(shard);
        expect(shard.attached).toBe(true);
        run.cancel();
        expect(group.items).toContain(shard);
        expect(shard.attached).toBe(true);
        const done = group.remove(shard);
        done.finish();
        expect(group.items).not.toContain(shard);
        expect(shard.attached).toBe(false);
    });

    it('reflows the paper stack when stackGap changes', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const group = fill(ctx, 'paper', heatMap);
        const before = group.items.map((item) => item.emitter.target.row);
        group.set('stackGap', before.length ? group.addMotion.stackGap + 8 : 18);
        const after = group.items.map((item) => item.emitter.target.row);
        expect(after[1] - after[0]).toBeCloseTo(group.addMotion.stackGap, 6);
        expect(after[1] - after[0]).not.toBeCloseTo(before[1] - before[0], 6);
    });

    it('round-trips a saved group onto a fresh one', () => {
        const ctx = loadHeat();
        const sourceMap = createHeatMap(ctx);
        const source = fill(ctx, 'stone', sourceMap);
        source.name = 'Saved stone';
        const data = source.serialize();
        const copyMap = createHeatMap(ctx);
        const copy = fill(ctx, 'stone', copyMap);
        copy.applySerialized(data);
        expect(copy.name).toBe('Saved stone');
        expect(copy.center).toEqual(source.center);
        expect(copy.spawnSpeed).toBe(source.spawnSpeed);
        expect(copy.ballInit).toEqual(source.ballInit);
        expect(snap(copy).items).toEqual(snap(source).items);
    });

    it('builds a cross from two highlights and two shards', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const group = ctx.createComposite('cross', heatMap);
        expect(group.kind).toBe('hot-map-cross');
        expect(group.items.map((item) => item.kind)).toEqual([
            'back-highlight',
            'back-highlight',
            'shard',
            'shard'
        ]);
        expect(group.items.map((item) => item.emitter.from.angle)).toEqual([0, 90, 45, 135]);
        expect(group.items.map((item) => item.emitter.to.angle)).toEqual([0, 90, 45, 135]);
        group.items.forEach((item) => {
            expect(item.emitter.center).toEqual({ col: group.center.col, row: group.center.row });
        });
        group.nudgeParam('hlFromWidth', 1);
        expect(group.items[0].emitter.from.width).toBe(74);
        expect(group.items[1].emitter.from.width).toBe(74);
        expect(group.items[2].emitter.from.width).toBe(64);
        group.nudgeParam('shFromSkew', 1);
        expect(group.items[2].emitter.from.skew).toBe(-35);
        expect(group.items[3].emitter.from.skew).toBe(-35);
        expect(group.items[0].emitter.from.skew || 0).toBe(0);
        group.nudgeParam('highlightTurn', -1);
        expect(group.items[0].emitter.from.angle).toBe(0);
        expect(group.items[1].emitter.from.angle).toBe(85);
        expect(group.items[2].emitter.from.angle).toBe(45);
        const data = group.serialize();
        const copy = ctx.createComposite('cross', createHeatMap(ctx));
        copy.applySerialized(data);
        expect(copy.highlightTurn).toBe(85);
        expect(copy.items.map((item) => item.emitter.from.angle)).toEqual([0, 85, 45, 135]);
        expect(copy.items[0].emitter.from.width).toBe(74);
        expect(copy.items[2].emitter.from.skew).toBe(-35);
    });

    it('applies cross.json params onto a centered cross', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const field = heatMap.field;
        const center = {
            col: (field.cols - 1) / 2,
            row: (field.rows - 1) / 2
        };
        const group = ctx.createComposite('cross', heatMap, {
            name: 'Cross',
            center: center
        });
        const raw = JSON.parse(fs.readFileSync(path.join(SITE_ROOT, 'resources/cross.json'), 'utf8'));
        group.applySerialized(Object.assign({}, raw.cross, { center: center }));
        group.layoutItems();
        expect(group.center).toEqual(center);
        expect(group.highlightTurn).toBe(90);
        expect(group.shardTurn).toBe(90);
        expect(group.shardOffset).toBe(45);
        expect(group.highlightInit.from).toMatchObject({ width: 90, height: 10, angle: 45, heat: 0.1 });
        expect(group.highlightInit.to).toMatchObject({ width: 90, height: 10, heat: 0.1 });
        expect(group.shardInit.from).toMatchObject({ width: 88, height: 6, angle: 0, skew: 0, heat: 0.8, glisten: 0 });
        expect(group.shardInit.to.glisten).toBe(100);
        expect(group.highlightInit.delay).toBe(0.4);
        expect(group.shardInit.delay).toBe(0.3);
        expect(group.items.map((item) => item.emitter.from.angle)).toEqual([45, 135, 45, 135]);
        expect(group.items.map((item) => item.emitter.from.width)).toEqual([90, 90, 88, 88]);
        expect(group.items[0].emitter.params.delay).toBe(0.4);
        expect(group.items[2].emitter.params.delay).toBe(0.3);
        group.items.forEach((item) => {
            expect(item.emitter.center).toEqual(center);
        });
    });
});
