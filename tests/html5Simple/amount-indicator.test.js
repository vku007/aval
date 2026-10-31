import { describe, expect, it } from 'vitest';
import { createHeatMap, loadHeat } from './harness.js';

const DT = 1000 / 60;

function step(heatMap, frames) {
    for (let frame = 0; frame < frames; frame += 1) {
        heatMap.field.update(frame * DT, DT);
    }
}

function shownHeat(ctx, item) {
    const frame = ctx.heatFrame(item);
    const pose = ctx.heatPresentPose(
        frame,
        item.emitter.current,
        item.emitter.from,
        item.emitter.to
    );
    return pose.heat;
}

function make(ctx, options) {
    const heatMap = createHeatMap(ctx);
    const indicator = new ctx.HmHorisontalAmountIndicator(heatMap, Object.assign({
        width: 80,
        height: 14,
        maxAmount: 8,
        center: { col: 60, row: 120 }
    }, options || {}));
    return { heatMap, indicator };
}

describe('HmHorisontalAmountIndicator', () => {
    it('splits the width into separated rectangles that fill the box', () => {
        const ctx = loadHeat();
        const { indicator } = make(ctx, { width: 80, height: 14, maxAmount: 8 });
        expect(indicator.items).toHaveLength(8);
        const piece = indicator.items[0].emitter.current.width;
        const cols = indicator.items.map((item) => item.emitter.center.col);
        cols.forEach((col, index) => {
            if (index) {
                expect(col - cols[index - 1] - piece).toBeGreaterThan(1.5);
            }
            expect(indicator.items[index].emitter.center.row).toBeCloseTo(120, 6);
            expect(indicator.items[index].emitter.current.height).toBeCloseTo(14, 6);
        });
        expect(cols[0] - piece / 2).toBeCloseTo(indicator.center.col - 40, 6);
        expect(cols[7] + piece / 2).toBeCloseTo(indicator.center.col + 40, 6);
    });

    it('stays a row when the box is taller than it is wide', () => {
        const ctx = loadHeat();
        const { indicator } = make(ctx, { width: 40, height: 80, maxAmount: 4 });
        const rows = indicator.items.map((item) => item.emitter.center.row);
        const cols = indicator.items.map((item) => item.emitter.center.col);
        expect(indicator.amountAxis).toBe('horizontal');
        cols.forEach((col, index) => {
            if (index) {
                expect(col).toBeGreaterThan(cols[index - 1]);
            }
            expect(rows[index]).toBeCloseTo(rows[0], 6);
        });
    });

    it('stacks HmVerticalAmountIndicator from top to bottom', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const indicator = new ctx.HmVerticalAmountIndicator(heatMap, {
            width: 14,
            height: 80,
            maxAmount: 5,
            center: { col: 60, row: 120 }
        });
        const piece = indicator.items[0].emitter.current.height;
        const rows = indicator.items.map((item) => item.emitter.center.row);
        rows.forEach((row, index) => {
            if (index) {
                expect(row).toBeGreaterThan(rows[index - 1]);
                expect(row - rows[index - 1] - piece).toBeGreaterThan(1.5);
            }
            expect(indicator.items[index].emitter.center.col).toBeCloseTo(60, 6);
            expect(indicator.items[index].emitter.current.width).toBeCloseTo(14, 6);
        });
        expect(rows[0] - piece / 2).toBeCloseTo(indicator.center.row - 40, 6);
        expect(rows[4] + piece / 2).toBeCloseTo(indicator.center.row + 40, 6);
        expect(indicator.direction).toBe('asc');
    });

    it('begins at the bottom when direction is desc', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const indicator = new ctx.HmVerticalAmountIndicator(heatMap, {
            width: 14,
            height: 80,
            maxAmount: 5,
            direction: 'desc',
            stored: 3,
            selected: 1,
            center: { col: 60, row: 120 }
        });
        const piece = indicator.items[0].emitter.current.height;
        const rows = indicator.items.map((item) => item.emitter.center.row);
        expect(indicator.direction).toBe('desc');
        expect(indicator.roleAt(0)).toBe('stored');
        expect(indicator.roleAt(2)).toBe('selected');
        rows.forEach((row, index) => {
            if (index) {
                expect(row).toBeLessThan(rows[index - 1]);
            }
        });
        expect(rows[0] + piece / 2).toBeCloseTo(indicator.center.row + 40, 6);
        expect(rows[4] - piece / 2).toBeCloseTo(indicator.center.row - 40, 6);
        indicator.nudgeParam('direction', 1);
        expect(indicator.direction).toBe('asc');
        expect(indicator.items[0].emitter.center.row).toBeLessThan(indicator.items[4].emitter.center.row);
        indicator.set('direction', 'nope');
        expect(indicator.direction).toBe('asc');
        indicator.set('direction', 'desc');
        const data = indicator.serialize();
        expect(data.direction).toBe('desc');
        const copy = new ctx.HmVerticalAmountIndicator(heatMap, {
            width: 14,
            height: 80,
            maxAmount: 5,
            center: { col: 60, row: 120 }
        });
        copy.applySerialized(data);
        expect(copy.direction).toBe('desc');
        expect(copy.items[0].emitter.center.row).toBeGreaterThan(copy.items[4].emitter.center.row);
    });

    it('keeps a wide vertical indicator in a column', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const indicator = new ctx.HmVerticalAmountIndicator(heatMap, {
            width: 80,
            height: 40,
            maxAmount: 4,
            stored: 3,
            selected: 1,
            center: { col: 60, row: 120 }
        });
        expect(indicator.kind).toBe('vertical-amount-indicator');
        expect(indicator.amountAxis).toBe('vertical');
        expect(indicator.roleAt(1)).toBe('stored');
        expect(indicator.roleAt(2)).toBe('selected');
        expect(indicator.roleAt(3)).toBe('dispensed');
        const cols = indicator.items.map((item) => item.emitter.center.col);
        const rows = indicator.items.map((item) => item.emitter.center.row);
        rows.forEach((row, index) => {
            if (index) {
                expect(row).toBeGreaterThan(rows[index - 1]);
            }
            expect(cols[index]).toBeCloseTo(cols[0], 6);
        });
    });

    it('marks the stored prefix hot, its last slots hottest, and the rest cold', () => {
        const ctx = loadHeat();
        const { indicator } = make(ctx, { stored: 5, selected: 2 });
        expect(indicator.stored).toBe(5);
        expect(indicator.selected).toBe(2);
        const roles = ['stored', 'stored', 'stored', 'selected', 'selected', 'dispensed', 'dispensed', 'dispensed'];
        roles.forEach((role, index) => {
            expect(indicator.roleAt(index)).toBe(role);
            expect(shownHeat(ctx, indicator.items[index])).toBeCloseTo(ctx.amountIndicatorHeat(role), 6);
        });
    });

    it('clamps selected to the stored amount and stored to the slot count', () => {
        const ctx = loadHeat();
        const { indicator } = make(ctx, { maxAmount: 6, stored: 100, selected: 100 });
        expect(indicator.stored).toBe(6);
        expect(indicator.selected).toBe(6);
        indicator.items.forEach((item) => {
            expect(shownHeat(ctx, item)).toBeCloseTo(ctx.AMOUNT_INDICATOR_HOTTEST, 6);
        });
        indicator.setAmount(3, 9);
        indicator.items.forEach((item) => {
            const run = item._slots.life.active;
            if (run && run.status === 'running') {
                run.finish();
            }
        });
        expect(indicator.stored).toBe(3);
        expect(indicator.selected).toBe(3);
        expect(indicator.roleAt(0)).toBe('selected');
        expect(indicator.roleAt(3)).toBe('dispensed');
        indicator.setAmount(-4, -1);
        indicator.items.forEach((item) => {
            const run = item._slots.life.active;
            if (run && run.status === 'running') {
                run.finish();
            }
        });
        expect(indicator.stored).toBe(0);
        expect(indicator.selected).toBe(0);
        expect(indicator.roleAt(0)).toBe('dispensed');
    });

    it('fades a slot that changes role and leaves the others on their heat', () => {
        const ctx = loadHeat();
        const { heatMap, indicator } = make(ctx, { stored: 5, selected: 0, duration: 0.4 });
        const stay = indicator.items[0];
        const picked = indicator.items[4];
        const cold = indicator.items[5];
        const beforeStay = shownHeat(ctx, stay);
        const beforePicked = shownHeat(ctx, picked);
        indicator.setAmount(5, 2);
        expect(indicator.roleAt(3)).toBe('selected');
        expect(indicator.roleAt(4)).toBe('selected');
        expect(shownHeat(ctx, picked)).toBeCloseTo(beforePicked, 6);
        expect(stay._slots.life.active.status).toBe('finished');
        expect(picked._slots.life.active.status).toBe('running');
        expect(cold._slots.life.active.status).toBe('finished');
        step(heatMap, 12);
        const mid = (ctx.AMOUNT_INDICATOR_HOT + ctx.AMOUNT_INDICATOR_HOTTEST) / 2;
        expect(shownHeat(ctx, picked)).toBeCloseTo(mid, 4);
        expect(shownHeat(ctx, stay)).toBeCloseTo(beforeStay, 6);
        picked._slots.life.active.finish();
        expect(shownHeat(ctx, picked)).toBeCloseTo(ctx.AMOUNT_INDICATOR_HOTTEST, 6);
        expect(picked._slots.life.active.status).toBe('finished');
    });

    it('continues a fade from the heat already on screen', () => {
        const ctx = loadHeat();
        const { heatMap, indicator } = make(ctx, { stored: 4, selected: 0, duration: 0.4 });
        const item = indicator.items[3];
        indicator.setAmount(4, 1);
        step(heatMap, 12);
        const mid = shownHeat(ctx, item);
        expect(mid).toBeGreaterThan(ctx.AMOUNT_INDICATOR_HOT);
        expect(mid).toBeLessThan(ctx.AMOUNT_INDICATOR_HOTTEST);
        indicator.setAmount(4, 0);
        expect(shownHeat(ctx, item)).toBeCloseTo(mid, 5);
        step(heatMap, 12);
        expect(shownHeat(ctx, item)).toBeCloseTo((mid + ctx.AMOUNT_INDICATOR_HOT) / 2, 4);
    });

    it('reset paints the same roles again', () => {
        const ctx = loadHeat();
        const { indicator } = make(ctx, { stored: 4, selected: 1 });
        indicator.setAmount(2, 1);
        indicator.items.forEach((item) => {
            const run = item._slots.life && item._slots.life.active;
            if (run && run.status === 'running') {
                run.finish();
            }
        });
        indicator.reset();
        expect(indicator.stored).toBe(2);
        expect(indicator.selected).toBe(1);
        expect(shownHeat(ctx, indicator.items[0])).toBeCloseTo(ctx.AMOUNT_INDICATOR_HOT, 6);
        expect(shownHeat(ctx, indicator.items[1])).toBeCloseTo(ctx.AMOUNT_INDICATOR_HOTTEST, 6);
        expect(shownHeat(ctx, indicator.items[2])).toBeCloseTo(ctx.AMOUNT_INDICATOR_COLD, 6);
    });

    it('leaves a darker gap between neighboring stamps', () => {
        const ctx = loadHeat();
        const { heatMap, indicator } = make(ctx, {
            width: 90,
            height: 16,
            maxAmount: 6,
            stored: 6,
            selected: 0
        });
        step(heatMap, 120);
        const field = heatMap.field;
        const sample = (col, row) => field.src[Math.round(row) * field.cols + Math.round(col)];
        const a = indicator.items[2].emitter.center;
        const b = indicator.items[3].emitter.center;
        const center = sample(a.col, a.row);
        const gap = sample((a.col + b.col) / 2, a.row);
        expect(center).toBeGreaterThan(ctx.AMOUNT_INDICATOR_HOT * 0.6);
        expect(gap).toBeLessThan(center * 0.55);
    });

    it('rebuilds slots when max changes and reloads from a save', () => {
        const ctx = loadHeat();
        const { indicator } = make(ctx, { stored: 5, selected: 2, maxAmount: 8 });
        indicator.set('maxAmount', 4);
        expect(indicator.items).toHaveLength(4);
        expect(indicator.stored).toBe(4);
        expect(indicator.selected).toBe(2);
        expect(indicator.roleAt(1)).toBe('stored');
        expect(indicator.roleAt(2)).toBe('selected');
        expect(indicator.roleAt(3)).toBe('selected');
        const saved = indicator.serialize();
        const { indicator: copy } = make(ctx, { maxAmount: 1 });
        copy.applySerialized(saved);
        expect(copy.maxAmount).toBe(4);
        expect(copy.stored).toBe(4);
        expect(copy.selected).toBe(2);
        expect(copy.items).toHaveLength(4);
        expect(shownHeat(ctx, copy.items[3])).toBeCloseTo(ctx.AMOUNT_INDICATOR_HOTTEST, 6);
        expect(copy.center.col).toBeCloseTo(indicator.center.col, 6);
    });

    it('is created by name', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const indicator = ctx.createComposite('amountIndicator', heatMap, {
            width: 40,
            height: 10,
            maxAmount: 4,
            stored: 2,
            selected: 1
        });
        expect(indicator).toBeInstanceOf(ctx.HmHorisontalAmountIndicator);
        expect(indicator.items).toHaveLength(4);
        expect(indicator.roleAt(0)).toBe('stored');
        expect(indicator.roleAt(1)).toBe('selected');
        expect(indicator.roleAt(2)).toBe('dispensed');
        const vertical = ctx.createComposite('verticalAmountIndicator', heatMap, {
            width: 10,
            height: 40,
            maxAmount: 4,
            stored: 2,
            selected: 1
        });
        expect(vertical).toBeInstanceOf(ctx.HmVerticalAmountIndicator);
        expect(vertical.amountAxis).toBe('vertical');
        expect(vertical.items[0].emitter.center.row).toBeLessThan(vertical.items[3].emitter.center.row);
    });

    it('draws each slot as a round that fits inside the rectangle', () => {
        const ctx = loadHeat();
        const { indicator } = make(ctx, { width: 80, height: 14, maxAmount: 8, stored: 5, selected: 2 });
        expect(indicator.shape).toBe('rectangle');
        expect(indicator.items[0].kind).toBe('back-highlight');
        const piece = indicator.items[0].emitter.current.width;
        const thick = indicator.items[0].emitter.current.height;
        indicator.set('shape', 'round');
        expect(indicator.shape).toBe('round');
        expect(indicator.items).toHaveLength(8);
        expect(indicator.items[0]).toBeInstanceOf(ctx.UiRound);
        expect(indicator.items[0].emitter.current.radius).toBeCloseTo(Math.min(piece, thick) / 2, 5);
        const cols = indicator.items.map((item) => item.emitter.center.col);
        cols.forEach((col, index) => {
            if (index) {
                expect(col).toBeGreaterThan(cols[index - 1]);
            }
        });
        expect(shownHeat(ctx, indicator.items[0])).toBeCloseTo(ctx.AMOUNT_INDICATOR_HOT, 6);
        expect(shownHeat(ctx, indicator.items[4])).toBeCloseTo(ctx.AMOUNT_INDICATOR_HOTTEST, 6);
        expect(shownHeat(ctx, indicator.items[7])).toBeCloseTo(ctx.AMOUNT_INDICATOR_COLD, 6);
        indicator.nudgeParam('shape', 1);
        expect(indicator.shape).toBe('rectangle');
        expect(indicator.items[0].kind).toBe('back-highlight');
        indicator.set('shape', 'round');
        const saved = indicator.serialize();
        expect(saved.shape).toBe('round');
        const { indicator: copy } = make(ctx, { maxAmount: 8 });
        copy.applySerialized(saved);
        expect(copy.shape).toBe('round');
        expect(copy.items[0].kind).toBe('round');
        expect(copy.items[3].emitter.current.radius).toBeGreaterThan(0.5);
        expect(copy.roleAt(4)).toBe('selected');
    });
});

describe('HmVerticalTableAmountIndicator', () => {
    function makeTable(ctx, options) {
        const heatMap = createHeatMap(ctx);
        const indicator = new ctx.HmVerticalTableAmountIndicator(heatMap, Object.assign({
            width: 44,
            height: 80,
            maxAmount: 8,
            center: { col: 60, row: 120 }
        }, options || {}));
        return indicator;
    }

    it('splits the vertical line into columns added from left to right', () => {
        const ctx = loadHeat();
        const indicator = makeTable(ctx, { stored: 5, selected: 2 });
        expect(indicator).toBeInstanceOf(ctx.HmVerticalAmountIndicator);
        expect(indicator.kind).toBe('vertical-table-amount-indicator');
        expect(indicator.columns).toBe(2);
        expect(indicator.items).toHaveLength(8);
        const pieceW = indicator.items[0].emitter.current.width;
        const pieceH = indicator.items[0].emitter.current.height;
        const left = indicator.items.slice(0, 4);
        const right = indicator.items.slice(4);
        left.forEach((item, index) => {
            expect(item.emitter.center.col).toBeCloseTo(left[0].emitter.center.col, 6);
            if (index) {
                expect(item.emitter.center.row).toBeGreaterThan(left[index - 1].emitter.center.row);
                expect(item.emitter.center.row - left[index - 1].emitter.center.row - pieceH).toBeGreaterThan(1.5);
            }
        });
        right.forEach((item, index) => {
            expect(item.emitter.center.col).toBeCloseTo(right[0].emitter.center.col, 6);
            expect(item.emitter.center.row).toBeCloseTo(left[index].emitter.center.row, 6);
        });
        expect(right[0].emitter.center.col - left[0].emitter.center.col - pieceW).toBeGreaterThan(1.5);
        expect(left[0].emitter.center.col).toBeLessThan(right[0].emitter.center.col);
        expect(indicator.roleAt(0)).toBe('stored');
        expect(indicator.roleAt(3)).toBe('selected');
        expect(indicator.roleAt(4)).toBe('selected');
        expect(indicator.roleAt(5)).toBe('dispensed');
    });

    it('adds a third column to the right and keeps a short last column', () => {
        const ctx = loadHeat();
        const indicator = makeTable(ctx, { columns: 3, maxAmount: 8 });
        expect(indicator.columns).toBe(3);
        const colOf = (index) => indicator.items[index].emitter.center.col;
        const rowOf = (index) => indicator.items[index].emitter.center.row;
        expect(colOf(0)).toBeCloseTo(colOf(2), 6);
        expect(colOf(3)).toBeGreaterThan(colOf(0));
        expect(colOf(6)).toBeGreaterThan(colOf(3));
        expect(rowOf(2)).toBeCloseTo(rowOf(5), 6);
        expect(rowOf(6)).toBeCloseTo(rowOf(0), 6);
        expect(rowOf(7)).toBeCloseTo(rowOf(1), 6);
        indicator.nudgeParam('columns', -1);
        expect(indicator.columns).toBe(2);
        expect(indicator.items[4].emitter.center.col).toBeGreaterThan(indicator.items[0].emitter.center.col);
        expect(indicator.items[2].emitter.center.col).toBeCloseTo(indicator.items[0].emitter.center.col, 6);
    });

    it('begins each column at the bottom when direction is desc', () => {
        const ctx = loadHeat();
        const indicator = makeTable(ctx, { direction: 'desc' });
        expect(indicator.items[0].emitter.center.row).toBeGreaterThan(indicator.items[1].emitter.center.row);
        expect(indicator.items[0].emitter.center.col).toBeCloseTo(indicator.items[3].emitter.center.col, 6);
        expect(indicator.items[4].emitter.center.col).toBeGreaterThan(indicator.items[0].emitter.center.col);
        expect(indicator.items[4].emitter.center.row).toBeCloseTo(indicator.items[0].emitter.center.row, 6);
    });

    it('reloads columns from a save and is created by name', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const indicator = makeTable(ctx, { columns: 4, direction: 'desc', stored: 3, selected: 1 });
        indicator.set('columns', 4);
        const saved = indicator.serialize();
        expect(saved.columns).toBe(4);
        expect(saved.direction).toBe('desc');
        const copy = new ctx.HmVerticalTableAmountIndicator(heatMap, { maxAmount: 8 });
        copy.applySerialized(saved);
        expect(copy.columns).toBe(4);
        expect(copy.direction).toBe('desc');
        expect(copy.items[2].emitter.center.col).toBeGreaterThan(copy.items[0].emitter.center.col);
        const named = ctx.createComposite('verticalTableAmountIndicator', heatMap, {
            maxAmount: 6,
            columns: 2
        });
        expect(named).toBeInstanceOf(ctx.HmVerticalTableAmountIndicator);
        expect(named.columns).toBe(2);
        expect(named.items[0].emitter.center.col).toBeLessThan(named.items[3].emitter.center.col);
    });
});
