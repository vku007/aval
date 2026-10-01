import { describe, expect, it, vi } from 'vitest';
import { createHeatMap, hashGrid, loadHeat } from './harness.js';

const DT = 1000 / 60;

function attach(ctx, kind) {
    const heatMap = createHeatMap(ctx);
    const node = new ctx.HeatNode({ kind: kind || 'back-highlight' });
    node.attach(heatMap.field);
    return { heatMap, node };
}

function stepNode(node, frames) {
    for (let frame = 0; frame < frames; frame += 1) {
        node.tick(DT);
    }
}

function stepField(heatMap, frames) {
    for (let frame = 0; frame < frames; frame += 1) {
        heatMap.field.update(frame * DT, DT);
    }
}

describe('easing', () => {
    it('lands on 0 and 1 for linear, sine, and expOut', () => {
        const ctx = loadHeat();
        ['linear', 'sine', 'expOut'].forEach((name) => {
            expect(ctx.heatEase(name, 0)).toBe(0);
            expect(ctx.heatEase(name, 1)).toBe(1);
        });
        expect(ctx.heatEase('linear', 0.25)).toBe(0.25);
        expect(ctx.heatEase('sine', 0.5)).toBeCloseTo(0.5, 12);
        expect(ctx.heatEase('expOut', 0.5)).toBeGreaterThan(0.5);
        expect(ctx.heatEase('expOut', 0.5)).toBeLessThan(1);
    });
});

describe('run lifecycle', () => {
    it('applies the first frame in the same tick as play', () => {
        const ctx = loadHeat();
        const { node } = attach(ctx);
        node.define('hover', ctx.pose({
            from: 0.25,
            to: 1,
            duration: 1,
            ease: 'linear',
            slot: 'hover'
        }));
        const run = node.play('hover');
        expect(run.time).toBe(0);
        expect(run.status).toBe('running');
        expect(node.channels.combined().pose).toBeCloseTo(0.25, 12);
        node.tick(DT);
        expect(run.time).toBeCloseTo(1 / 60, 12);
        expect(node.channels.combined().pose).toBeGreaterThan(0.25);
    });

    it('cancel restores that slot and leaves another slot running', async () => {
        const ctx = loadHeat();
        const { node } = attach(ctx);
        node.define('hover', ctx.pose({
            from: 0,
            to: 1,
            duration: 1,
            ease: 'linear',
            slot: 'hover'
        }));
        node.define('shift', ctx.move({
            from: { col: 6, row: -2 },
            to: { col: 0, row: 0 },
            duration: 1,
            ease: 'linear',
            slot: 'move'
        }));
        const hover = node.play('hover');
        const shift = node.play('shift');
        node.tick(DT);
        const kept = node.channels.combined().offset.col;
        const result = hover.cancel();
        expect(result).toBe(hover);
        expect(hover.status).toBe('cancelled');
        await expect(hover.finished).resolves.toEqual({ status: 'cancelled' });
        expect(node.channels.combined().pose).toBe(0);
        expect(node.channels.held('pose')).toBe(false);
        expect(shift.status).toBe('running');
        expect(node.channels.combined().offset.col).toBeCloseTo(kept, 12);
    });

    it('finish seeks to the end and then applies the fill', async () => {
        const ctx = loadHeat();
        function play(fill) {
            const { node } = attach(ctx);
            node.define('bar', ctx.transition(ctx.tracks({
                duration: 1,
                ease: 'linear',
                channels: { pose: { from: 0, to: 1 } }
            }), { slot: 'life', fill: fill }));
            return { node, run: node.play('bar') };
        }

        const sought = play('none');
        sought.run.seek(1);
        expect(sought.run.status).toBe('running');
        expect(sought.node.channels.combined().pose).toBeCloseTo(1, 12);
        sought.run.finish();
        expect(sought.node.channels.combined().pose).toBe(0);

        const finished = play('none');
        const pending = finished.run.finished;
        finished.run.finish();
        finished.run.finish();
        expect(finished.run.status).toBe('finished');
        expect(finished.run.finished).toBe(pending);
        expect(finished.node.channels.combined().pose).toBe(0);
        await expect(pending).resolves.toEqual({ status: 'finished' });

        const held = play('hold');
        held.run.seek(1);
        held.run.finish();
        held.run.finish();
        expect(held.node.channels.combined().pose).toBeCloseTo(1, 12);
        expect(held.run.status).toBe('finished');
    });

    it('seek matches stepping for linear, sine, and expOut', () => {
        const ctx = loadHeat();
        const frames = 20;
        const at = frames / 60;
        ['linear', 'sine', 'expOut'].forEach((ease) => {
            const stepped = attach(ctx);
            const sought = attach(ctx);
            const definition = ctx.move({
                from: { col: 30, row: -12 },
                to: { col: 0, row: 0 },
                duration: 1,
                ease: ease,
                slot: 'move'
            });
            stepped.node.define('enter', definition);
            sought.node.define('enter', definition);
            stepped.node.play('enter');
            const run = sought.node.play('enter');
            stepNode(stepped.node, frames);
            run.seek(at);
            const a = stepped.node.channels.combined().offset;
            const b = sought.node.channels.combined().offset;
            expect(Math.abs(a.col - b.col)).toBeLessThan(1e-9);
            expect(Math.abs(a.row - b.row)).toBeLessThan(1e-9);
            expect(Math.abs(run.time - stepped.node._runs[0].time)).toBeLessThan(1e-9);
        });
    });

    it('pause holds time, and field stop and step own the clock', () => {
        const ctx = loadHeat();
        const { node } = attach(ctx);
        node.define('hover', ctx.pose({
            from: 0,
            to: 1,
            duration: 1,
            ease: 'linear',
            slot: 'hover'
        }));
        const run = node.play('hover');
        node.tick(DT);
        const pose = node.channels.combined().pose;
        run.pause();
        node.tick(DT);
        expect(run.time).toBeCloseTo(1 / 60, 12);
        expect(node.channels.combined().pose).toBeCloseTo(pose, 12);
        run.resume();
        node.tick(DT);
        expect(run.time).toBeCloseTo(2 / 60, 12);

        const heatMap = createHeatMap(ctx);
        const ball = new ctx.UiHotBall(heatMap);
        ball.define('enter', ctx.move({
            from: { col: 20, row: 0 },
            to: { col: 0, row: 0 },
            duration: 2,
            ease: 'linear',
            slot: 'life'
        }));
        const flight = ball.play('enter');
        heatMap.stop();
        const motionT = ball.motion.t;
        heatMap.update(0, DT);
        expect(flight.time).toBe(0);
        expect(ball.motion.t).toBe(motionT);
        heatMap.step();
        heatMap.update(0, 9999);
        expect(flight.time).toBeCloseTo(1 / 60, 12);
        expect(ball.motion.t).toBeCloseTo(motionT + 1 / 60, 12);
        heatMap.update(0, DT);
        expect(flight.time).toBeCloseTo(1 / 60, 12);
        expect(ball.motion.t).toBeCloseTo(motionT + 1 / 60, 12);
    });

    it('replace continues from the current value, queue waits, ignore keeps the run', () => {
        const ctx = loadHeat();
        const replaced = attach(ctx);
        replaced.node.define('hover', ctx.pose({
            from: 'current',
            to: 1,
            duration: 1,
            ease: 'linear',
            slot: 'hover',
            policy: 'replace'
        }));
        const first = replaced.node.play('hover', {});
        stepNode(replaced.node, 10);
        const seen = replaced.node.channels.combined().pose;
        expect(seen).toBeCloseTo(10 / 60, 9);
        const second = replaced.node.play('hover');
        expect(first.status).toBe('cancelled');
        expect(second.status).toBe('running');
        expect(second.time).toBe(0);
        expect(replaced.node.channels.combined().pose).toBeCloseTo(seen, 9);

        const queued = attach(ctx);
        queued.node.define('hover', ctx.pose({
            from: 0,
            to: 1,
            duration: 0.5,
            ease: 'linear',
            slot: 'hover',
            policy: 'queue'
        }));
        const lead = queued.node.play('hover');
        const follower = queued.node.play('hover');
        expect(follower.status).toBe('queued');
        stepNode(queued.node, 29);
        expect(lead.status).toBe('running');
        expect(follower.status).toBe('queued');
        const before = queued.node.channels.combined().pose;
        expect(before).toBeGreaterThan(0.9);
        stepNode(queued.node, 1);
        expect(lead.status).toBe('finished');
        expect(follower.status).toBe('running');
        expect(follower.time).toBe(0);
        expect(queued.node.channels.combined().pose).toBeCloseTo(0, 12);

        const ignored = attach(ctx);
        ignored.node.define('hover', ctx.pose({
            from: 0,
            to: 1,
            duration: 1,
            ease: 'linear',
            slot: 'hover',
            policy: 'ignore'
        }));
        const kept = ignored.node.play('hover');
        ignored.node.tick(DT);
        const again = ignored.node.play('hover');
        expect(again).toBe(kept);
        expect(kept.status).toBe('running');
        expect(ignored.node._runs.filter((run) => run.status === 'running')).toHaveLength(1);
    });

    it('clears on none, keeps the end on hold, and commits fields', () => {
        const ctx = loadHeat();
        function play(fill) {
            const { node } = attach(ctx);
            node.define('bar', ctx.pose({
                from: 0.2,
                to: 1,
                duration: 1,
                ease: 'linear',
                slot: 'life',
                fill: fill
            }));
            const run = node.play('bar');
            run.finish();
            return node;
        }
        expect(play('none').channels.combined().pose).toBe(0);
        expect(play('none').channels.held('pose')).toBe(false);
        expect(play('hold').channels.combined().pose).toBeCloseTo(1, 12);
        const committed = play('commit');
        expect(committed.fields.pose).toBeCloseTo(1, 12);
        expect(committed.channels.combined().pose).toBe(0);
        expect(committed.channels.held('pose')).toBe(false);
    });

    it('destroy resolves every run as cancelled and later ticks do nothing', async () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const ball = new ctx.UiHotBall(heatMap);
        let hooks = 0;
        ball.define('exit', ctx.sequence([
            ctx.wait(1),
            ctx.call('ping')
        ], { slot: 'life' }));
        const run = ball.play('exit', {
            hooks: {
                ping() {
                    hooks += 1;
                }
            }
        });
        const pending = run.finished;
        heatMap.field.update(0, DT);
        const snapshot = Array.from(heatMap.field.src);
        const motionT = ball.motion.t;
        heatMap.field.destroy();
        expect(ball.attached).toBe(false);
        expect(run.status).toBe('cancelled');
        expect(hooks).toBe(0);
        heatMap.field.update(0, DT);
        expect(Array.from(heatMap.field.src)).toEqual(snapshot);
        expect(ball.motion.t).toBe(motionT);
        await expect(pending).resolves.toEqual({ status: 'cancelled' });
    });

    it('plays the same frames from the same fields and dt', async () => {
        async function hashed() {
            const ctx = loadHeat();
            const heatMap = createHeatMap(ctx);
            const ball = new ctx.UiHotBall(heatMap);
            ball.define('enter', ctx.move({
                from: { col: 14, row: -6 },
                to: { col: 0, row: 0 },
                duration: 1,
                ease: 'expOut',
                slot: 'life'
            }));
            ball.play('enter');
            stepField(heatMap, 30);
            return hashGrid(heatMap.field.src);
        }
        const first = await hashed();
        const second = await hashed();
        expect(first).toBe(second);
    });

    it('reset drops runs and matches a fresh item', () => {
        const ctx = loadHeat();
        const livedMap = createHeatMap(ctx);
        const freshMap = createHeatMap(ctx);
        const lived = new ctx.UiHotBall(livedMap);
        const fresh = new ctx.UiHotBall(freshMap);
        lived.define('enter', ctx.move({
            from: { col: 10, row: 4 },
            duration: 1,
            ease: 'linear',
            slot: 'life',
            fill: 'hold'
        }));
        lived.play('enter');
        stepField(livedMap, 10);
        expect(lived.channels.combined().offset.col).not.toBe(0);
        lived.reset();
        expect(lived.channels.combined()).toEqual(fresh.channels.combined());
        expect(lived.motion.t).toBe(fresh.motion.t);
        expect(lived.motion.angle).toBe(fresh.motion.angle);
        expect(lived._runs.every((run) => run.status === 'cancelled' || run.status === 'finished')).toBe(true);
        livedMap.field.src.fill(0);
        livedMap.field.dst.fill(0);
        freshMap.field.src.fill(0);
        freshMap.field.dst.fill(0);
        stepField(livedMap, 1);
        stepField(freshMap, 1);
        expect(hashGrid(livedMap.field.src)).toBe(hashGrid(freshMap.field.src));
    });

    it('keeps two enter definitions and two speed fields independent', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const a = new ctx.HeatNode({ kind: 'hot-ball' });
        const b = new ctx.HeatNode({ kind: 'hot-ball' });
        a.attach(heatMap.field);
        b.attach(heatMap.field);
        a.define('enter', ctx.move({
            from: { col: 12, row: 0 },
            to: { col: 0, row: 0 },
            duration: 1,
            ease: 'linear',
            slot: 'life'
        }));
        b.define('enter', ctx.move({
            from: { col: -3, row: 2 },
            to: { col: 0, row: 0 },
            duration: 1,
            ease: 'linear',
            slot: 'life'
        }));
        a.play('enter');
        b.play('enter');
        heatMap.field.update(0, DT);
        expect(a.channels.combined().offset.col).toBeCloseTo(12 * (1 - 1 / 60), 9);
        expect(b.channels.combined().offset.col).toBeCloseTo(-3 * (1 - 1 / 60), 9);
        expect(a.channels.combined().offset.row).toBeCloseTo(0, 9);
        expect(b.channels.combined().offset.row).not.toBe(0);
        a.fields.ballSpeed = 2;
        b.fields.ballSpeed = 2;
        a.fields.ballSpeed = 9;
        expect(b.fields.ballSpeed).toBe(2);
    });

    it('cancel of exit leaves the item attached, and finish detaches after stamp', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const ball = new ctx.UiHotBall(heatMap);
        ball.define('exit', ctx.sequence([
            ctx.move({
                from: { col: 5, row: 0 },
                to: { col: 0, row: 0 },
                duration: 1,
                ease: 'linear'
            }),
            ctx.call('detach')
        ], { slot: 'life', fill: 'none' }));
        const cancelled = ball.play('exit');
        cancelled.cancel();
        expect(cancelled.status).toBe('cancelled');
        expect(ball.attached).toBe(true);
        expect(heatMap.field.balls).toContain(ball.motion);
        expect(ball.channels.combined().offset).toEqual({ col: 0, row: 0 });

        const leaving = ball.play('exit');
        let listedAtStamp = null;
        const stamp = ball.stampNow.bind(ball);
        ball.stampNow = () => {
            listedAtStamp = heatMap.field.balls.includes(ball.motion);
            stamp();
        };
        const advance = ball.motion.advance.bind(ball.motion);
        ball.motion.advance = (delta) => {
            const pos = advance(delta);
            leaving.finish();
            return pos;
        };
        heatMap.field.update(0, DT);
        expect(listedAtStamp).toBe(true);
        expect(ball.attached).toBe(false);
        expect(heatMap.field.balls).not.toContain(ball.motion);
        expect(heatMap.field.roots).not.toContain(ball);
    });

    it('play on a detached node resolves cancelled', async () => {
        const ctx = loadHeat();
        const { node } = attach(ctx);
        node.define('enter', ctx.wait(1));
        node.detach();
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        try {
            const run = node.play('enter');
            expect(run.status).toBe('cancelled');
            await expect(run.finished).resolves.toEqual({ status: 'cancelled' });
            expect(warn).toHaveBeenCalled();
            expect(String(warn.mock.calls[0][0])).toContain('detached');
        } finally {
            warn.mockRestore();
        }
    });
});

describe('transition blocks', () => {
    it('resolves $spawn and runs move, grow, and spin together', () => {
        const ctx = loadHeat();
        const { node } = attach(ctx);
        node.define('enter', ctx.parallel([
            ctx.move({
                from: '$spawn',
                to: { col: 0, row: 0 },
                duration: 1,
                ease: 'linear'
            }),
            ctx.grow({ from: 0.25, to: 1, duration: 1, ease: 'linear' }),
            ctx.spin({ from: -90, to: 0, duration: 1, ease: 'linear' })
        ], { slot: 'life' }));
        const run = node.play('enter', { spawn: { col: 15, row: -4 } });
        expect(node.channels.combined().offset).toEqual({ col: 15, row: -4 });
        expect(node.channels.combined().scale).toBeCloseTo(0.25, 12);
        expect(node.channels.combined().rotate).toBeCloseTo(-90, 12);
        run.seek(0.5);
        expect(node.channels.combined().offset.col).toBeCloseTo(7.5, 12);
        expect(node.channels.combined().scale).toBeCloseTo(0.625, 12);
        expect(node.channels.combined().rotate).toBeCloseTo(-45, 12);
    });

    it('sets a field at the start and calls a hook when the playhead reaches it', () => {
        const ctx = loadHeat();
        const { node } = attach(ctx);
        let hooks = 0;
        node.define('mark', ctx.sequence([
            ctx.set({ fields: { ballSpeed: 4 }, channels: { pose: 0.7 } }),
            ctx.wait(0.5),
            ctx.call('ping')
        ], { slot: 'life', fill: 'hold' }));
        const run = node.play('mark', {
            hooks: {
                ping() {
                    hooks += 1;
                }
            }
        });
        expect(node.fields.ballSpeed).toBe(4);
        expect(node.channels.combined().pose).toBeCloseTo(0.7, 12);
        expect(hooks).toBe(0);
        run.seek(0.5);
        expect(hooks).toBe(1);
        run.seek(0.5);
        expect(hooks).toBe(1);
        run.finish();
        expect(node.channels.combined().pose).toBeCloseTo(0.7, 12);
    });

    it('shakes back to identity and gathers toward a point', () => {
        const ctx = loadHeat();
        const shaken = attach(ctx);
        shaken.node.define('hit', ctx.shake({
            amp: 4,
            cycles: 1,
            duration: 1,
            slot: 'react'
        }));
        const hit = shaken.node.play('hit');
        expect(shaken.node.channels.combined().offset).toEqual({ col: 0, row: 0 });
        hit.seek(0.25);
        expect(shaken.node.channels.combined().offset.col).toBeCloseTo(3, 12);
        hit.seek(1);
        expect(shaken.node.channels.combined().offset.col).toBeCloseTo(0, 12);

        const { node } = attach(ctx, 'sheet');
        node.define('enter', ctx.gather({
            from: 1,
            to: 0,
            at: { col: 5, row: 6 },
            duration: 1,
            ease: 'linear',
            slot: 'life'
        }));
        const run = node.play('enter');
        expect(node.channels.combined()['balls.gather']).toBeCloseTo(1, 12);
        expect(node.channels.combined()['balls.gatherAt']).toEqual({ col: 5, row: 6 });
        run.seek(0.5);
        expect(node.channels.combined()['balls.gather']).toBeCloseTo(0.5, 12);
    });

    it('flashes heat up and back', () => {
        const ctx = loadHeat();
        const { node } = attach(ctx);
        node.define('break', ctx.flash({
            from: 1,
            peak: 3,
            to: 1,
            duration: 0.4,
            ease: 'linear',
            slot: 'react'
        }));
        const run = node.play('break');
        expect(node.channels.combined().heat).toBeCloseTo(1, 12);
        run.seek(0.2);
        expect(node.channels.combined().heat).toBeCloseTo(3, 12);
        run.seek(0.4);
        expect(node.channels.combined().heat).toBeCloseTo(1, 12);
    });

    it('staggers the same move across targets', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const host = new ctx.HeatNode({ kind: 'back-highlight' });
        const first = new ctx.HeatNode({ kind: 'back-highlight' });
        const second = new ctx.HeatNode({ kind: 'back-highlight' });
        host.attach(heatMap.field);
        first.attach(heatMap.field);
        second.attach(heatMap.field);
        host.define('reveal', ctx.stagger(ctx.move({
            from: { col: 10, row: 0 },
            to: { col: 0, row: 0 },
            duration: 1,
            ease: 'linear',
            slot: 'life'
        }), { each: 0.5, slot: 'life' }));
        host.play('reveal', { targets: [first, second] });
        expect(first.channels.combined().offset.col).toBeCloseTo(10, 9);
        expect(second.channels.combined().offset.col).toBe(0);
        stepField(heatMap, 30);
        expect(second.channels.combined().offset.col).toBeCloseTo(10, 9);
        expect(first.channels.combined().offset.col).toBeCloseTo(5, 6);
    });
});
