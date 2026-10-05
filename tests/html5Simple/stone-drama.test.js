import { describe, expect, it } from 'vitest';
import { createHeatMap, loadHeat } from './harness.js';

const DT = 1000 / 60;

function parkedBall(ctx) {
    const heatMap = createHeatMap(ctx);
    const group = new ctx.HotMapUiStone(heatMap);
    group._shardRandom = function random() {
        return 0.5;
    };
    const ball = group.addItem({ animate: false });
    group.writeField(ball, 'tiltX', 0);
    group.writeField(ball, 'tiltY', 0);
    group.writeField(ball, 'tiltZ', 0);
    group.writeField(ball, 'orbitRadius', 40);
    group.writeField(ball, 'angleSpeed', 1.6);
    ball.motion.angle = 0;
    return { heatMap, group, ball };
}

function shardsOf(group) {
    return group.parts
        .map((part) => part.object)
        .filter((object) => object && object._stoneShard);
}

describe('stone drama remove', () => {
    it('stops the ball at double size and triple heat, then drops three hot shards', () => {
        const ctx = loadHeat();
        const { group, ball } = parkedBall(ctx);
        const radius = ball.motion.params.radius;
        const energy = ball.motion.params.energy;

        const removed = group.removeItemWithDrama();
        const run = ball._slots.life.active;
        expect(removed).toBe(ball);
        expect(ball.motion.params.angleSpeed).toBe(0);
        expect(ball.attached).toBe(true);
        expect(shardsOf(group)).toHaveLength(0);

        const frame = ball.channels.combined();
        expect(frame.scale).toBeCloseTo(2, 8);
        expect(frame.heat).toBeCloseTo(3, 8);
        expect(frame.offset).toEqual({ col: 0, row: 0 });

        run.finish();
        expect(run.status).toBe('finished');
        expect(ball.attached).toBe(false);
        expect(group.items).not.toContain(ball);

        const shards = shardsOf(group);
        expect(shards).toHaveLength(3);
        const tangent = ball._stoneTangent;
        const flights = ctx.stoneShardFlights(tangent, () => 0.5);
        const ends = [];
        shards.forEach((shard, index) => {
            expect(shard.motion.params.radius).toBeCloseTo(radius * 0.33, 8);
            expect(shard.motion.params.energy).toBeCloseTo(energy, 8);
            expect(shard.motion.params.angleSpeed).toBe(0);
            const shardRun = shard._slots.life.active;
            expect(shardRun.ctx.flight.col).toBeCloseTo(flights[index].flight.col, 8);
            expect(shardRun.ctx.flight.row).toBeCloseTo(flights[index].flight.row, 8);
            expect(shardRun.ctx.drop).toBeGreaterThan(50);
            const carried = shardRun.ctx.flight.col * tangent.col + shardRun.ctx.flight.row * tangent.row;
            expect(carried).toBeLessThan(-10);

            const early = ctx.heatSample(shardRun.block, shardRun.duration * 0.08).values.offset;
            const mid = ctx.heatSample(shardRun.block, shardRun.duration * 0.5).values.offset;
            const landed = ctx.heatSample(shardRun.block, shardRun.duration).values.offset;
            const earlyAlong = early.col * tangent.col + early.row * tangent.row;
            expect(earlyAlong).toBeLessThan(0);
            const firstHalf = mid.row - 0;
            const secondHalf = landed.row - mid.row;
            expect(secondHalf).toBeGreaterThan(firstHalf);
            expect(landed.row).toBeGreaterThan(Math.abs(landed.col));
            ends.push(landed.col);
        });
        expect(Math.max.apply(null, ends) - Math.min.apply(null, ends)).toBeGreaterThan(10);
    });

    it('matches seek with stepping, and cancel restores the ball without shards', () => {
        const ctx = loadHeat();
        const stepped = parkedBall(ctx);
        stepped.group.removeItemWithDrama();
        stepped.ball._slots.life.active.finish();
        const frames = 18;
        for (let frame = 0; frame < frames; frame += 1) {
            stepped.heatMap.field.update(frame * DT, DT);
        }
        const sought = parkedBall(ctx);
        sought.group.removeItemWithDrama();
        sought.ball._slots.life.active.finish();
        const run = shardsOf(sought.group)[0]._slots.life.active;
        run.seek(frames * DT / 1000);
        const a = shardsOf(stepped.group)[0].channels.combined();
        const b = shardsOf(sought.group)[0].channels.combined();
        expect(b.offset.col).toBeCloseTo(a.offset.col, 5);
        expect(b.offset.row).toBeCloseTo(a.offset.row, 5);
        expect(b.heat).toBeCloseTo(a.heat, 5);

        const cancelled = parkedBall(ctx);
        cancelled.group.removeItemWithDrama();
        const hit = cancelled.ball._slots.life.active;
        hit.cancel();
        expect(cancelled.ball.channels.combined().scale).toBe(1);
        expect(cancelled.ball.channels.combined().heat).toBe(1);
        expect(cancelled.ball.attached).toBe(true);
        expect(shardsOf(cancelled.group)).toHaveLength(0);
        expect(cancelled.group.items).toContain(cancelled.ball);
    });

    it('lands on the sampled end pose, and finish of a shard detaches it', () => {
        const ctx = loadHeat();
        const { group, ball } = parkedBall(ctx);
        group.removeItemWithDrama();
        ball._slots.life.active.finish();
        const shard = shardsOf(group)[0];
        const run = shard._slots.life.active;
        const at = Math.max(0, run.duration - 1e-3);
        run.seek(at);
        const posed = shard.channels.combined();
        const end = ctx.heatSample(run.block, at).values;
        expect(posed.offset.col).toBeCloseTo(end.offset.col, 5);
        expect(posed.offset.row).toBeCloseTo(end.offset.row, 5);
        expect(shard.attached).toBe(true);
        run.finish();
        expect(run.status).toBe('finished');
        expect(shard.attached).toBe(false);
        expect(group.items).not.toContain(shard);
    });

    it('destroy resolves the hit as cancelled', async () => {
        const ctx = loadHeat();
        const { heatMap, ball, group } = parkedBall(ctx);
        group.removeItemWithDrama();
        const run = ball._slots.life.active;
        const pending = run.finished;
        heatMap.field.update(0, DT);
        heatMap.field.destroy();
        expect(run.status).toBe('cancelled');
        expect(ball.attached).toBe(false);
        await expect(pending).resolves.toEqual({ status: 'cancelled' });
    });

    it('spreads the balls that remain once the shards appear', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const group = new ctx.HotMapUiStone(heatMap);
        group._shardRandom = function random() {
            return 0.5;
        };
        const first = group.addItem({ animate: false });
        const second = group.addItem({ animate: false });
        const third = group.addItem({ animate: false });
        first.motion.angle = 0;
        second.motion.angle = 0.3;
        third.motion.angle = 1.2;

        expect(group.removeItemWithDrama()).toBe(third);
        expect(first._slots.layout && first._slots.layout.active).toBeFalsy();
        expect(second._slots.layout && second._slots.layout.active).toBeFalsy();
        third._slots.life.active.finish();

        const runs = [first, second].map((ball) => ball._slots.layout.active);
        runs.forEach((run) => {
            expect(run).toBeTruthy();
            expect(run.ctx.duration).toBeCloseTo(3 / group.spawnSpeed, 5);
        });
        const goals = [first, second].map((ball, index) => {
            return ball.motion.angle + runs[index].ctx.phase * Math.PI / 180;
        });
        const gap = Math.atan2(Math.sin(goals[1] - goals[0]), Math.cos(goals[1] - goals[0]));
        expect(Math.abs(gap)).toBeCloseTo(Math.PI, 5);
        expect(third._slots.layout && third._slots.layout.active).toBeFalsy();
    });

    it('pops every ball 0.33 s apart, or only the requested count', async () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const group = new ctx.HotMapUiStone(heatMap);
        group._shardRandom = function random() {
            return 0.5;
        };
        const balls = [0, 1, 2].map(() => group.addItem({ animate: false }));
        const run = group.removeWithDrama();
        expect(run.removed).toBe(3);
        expect(balls[2]._stoneLeaving).toBe(true);
        expect(balls[1]._stoneLeaving).toBeFalsy();
        expect(balls[0]._stoneLeaving).toBeFalsy();

        for (let frame = 0; frame < 19; frame += 1) {
            heatMap.field.update(frame * DT, DT);
        }
        expect(balls[1]._stoneLeaving).toBeFalsy();
        heatMap.field.update(19 * DT, DT);
        expect(balls[1]._stoneLeaving).toBe(true);
        expect(balls[0]._stoneLeaving).toBeFalsy();
        for (let frame = 20; frame < 39; frame += 1) {
            heatMap.field.update(frame * DT, DT);
        }
        expect(balls[0]._stoneLeaving).toBeFalsy();
        heatMap.field.update(39 * DT, DT);
        expect(balls[0]._stoneLeaving).toBe(true);

        const partialMap = createHeatMap(ctx);
        const partial = new ctx.HotMapUiStone(partialMap);
        partial._shardRandom = function random() {
            return 0.5;
        };
        const kept = partial.addItem({ animate: false });
        const dropped = partial.addItem({ animate: false });
        const one = partial.removeWithDrama(1);
        expect(one.removed).toBe(1);
        expect(dropped._stoneLeaving).toBe(true);
        expect(kept._stoneLeaving).toBeFalsy();

        const pending = run.finished;
        for (let frame = 40; frame < 150; frame += 1) {
            heatMap.field.update(frame * DT, DT);
        }
        await expect(pending).resolves.toEqual({ status: 'finished' });
        balls.forEach((ball) => expect(ball.attached).toBe(false));
        expect(group.items).toHaveLength(0);
    });

    it('drops the last real ball at once and ignores a second POP', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const group = new ctx.HotMapUiStone(heatMap);
        const first = group.addItem({ animate: false });
        const second = group.addItem({ animate: false });
        expect(group.removeItem()).toBe(second);
        expect(group.items).not.toContain(second);
        expect(group.removeItemWithDrama()).toBe(first);
        expect(first._stoneLeaving).toBe(true);
        expect(group.removeItemWithDrama()).toBe(null);
    });
});
