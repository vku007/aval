import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createHeatMap, DT_MS, loadHeat, SITE_ROOT } from './harness.js';

function shownHeat(ctx, highlight) {
    const frame = ctx.heatFrame(highlight);
    return ctx.heatPresentPose(
        frame,
        highlight.emitter.current,
        highlight.emitter.from,
        highlight.emitter.to
    ).heat;
}

function mount(ctx, duration) {
    const heatMap = createHeatMap(ctx);
    const bounds = heatMap.bounds;
    const bar = {
        width: 320,
        height: 56,
        duration: duration == null ? 3 : duration,
        root: {
            x: bounds.x + bounds.width / 2,
            y: bounds.y + bounds.height / 2
        },
        progress() {
            return 0;
        }
    };
    const options = duration == null ? {} : { duration: duration };
    const mounted = ctx.createResultBarHighlight(heatMap, bar, options);
    return {
        heatMap: heatMap,
        highlight: mounted.highlight,
        run: mounted.run
    };
}

describe('result bar', () => {
    it('counts whole scores from the start text to the end text', () => {
        const ctx = loadHeat();

        expect(ctx.resultBarLabel(0, 2, 0)).toBe('0');
        expect(ctx.resultBarLabel(0, 2, 0.5)).toBe('1');
        expect(ctx.resultBarLabel(0, 2, 1)).toBe('2');
        expect(ctx.resultBarLabel(0, 4, ctx.resultBarProgress(null))).toBe('0');
    });

    it('starts at heat 0.1 and doubles it over the default 3 seconds', () => {
        const ctx = loadHeat();
        const bar = mount(ctx);
        const highlight = bar.highlight;

        expect(bar.highlight.heatMap).toBe(bar.heatMap);
        expect(bar.run.time).toBe(0);
        expect(bar.run.status).toBe('running');
        expect(bar.run.duration).toBe(3);
        expect(highlight.emitter.from.heat).toBe(0.1);
        expect(highlight.emitter.to.heat).toBe(0.1);
        expect(highlight.emitter.from.width).toBe(highlight.emitter.to.width);
        expect(highlight.emitter.from.height).toBe(highlight.emitter.to.height);
        expect(highlight.channels.combined().heat).toBe(1);
        expect(shownHeat(ctx, highlight)).toBeCloseTo(0.1, 5);
        expect(ctx.resultBarLabel(0, 2, ctx.resultBarProgress(bar.run))).toBe('0');

        bar.heatMap.field.update(0, DT_MS);
        const u = (DT_MS / 1000) / 3;
        expect(highlight.channels.combined().heat).toBeCloseTo(1 + u, 6);
        expect(shownHeat(ctx, highlight)).toBeCloseTo(0.1 * (1 + u), 5);
    });

    it('keeps the doubled heat after finish, and cancel restores the start', () => {
        const ctx = loadHeat();
        const finished = mount(ctx, 3);
        const sought = mount(ctx, 3);
        finished.run.finish();
        sought.run.seek(sought.run.duration);

        expect(finished.run.status).toBe('finished');
        expect(finished.highlight.channels.combined().heat).toBeCloseTo(
            sought.highlight.channels.combined().heat,
            8
        );
        expect(shownHeat(ctx, finished.highlight)).toBeCloseTo(0.2, 5);
        expect(ctx.resultBarProgress(finished.run)).toBe(1);
        finished.heatMap.field.update(1000, DT_MS);
        expect(shownHeat(ctx, finished.highlight)).toBeCloseTo(0.2, 5);

        const cancelled = mount(ctx, 3);
        cancelled.heatMap.field.update(0, 500);
        expect(cancelled.highlight.channels.combined().heat).toBeGreaterThan(1);
        cancelled.run.cancel();
        expect(cancelled.run.status).toBe('cancelled');
        expect(cancelled.highlight.channels.combined().heat).toBe(1);
        expect(shownHeat(ctx, cancelled.highlight)).toBeCloseTo(0.1, 5);
    });

    it('seek matches stepping the field clock', () => {
        const ctx = loadHeat();
        const stepped = mount(ctx, 3);
        stepped.heatMap.field.update(0, DT_MS);
        stepped.heatMap.field.update(DT_MS, DT_MS);
        const sought = mount(ctx, 3);
        sought.run.seek((2 * DT_MS) / 1000);

        expect(stepped.highlight.channels.combined().heat).toBeCloseTo(
            sought.highlight.channels.combined().heat,
            8
        );
        expect(shownHeat(ctx, stepped.highlight)).toBeCloseTo(shownHeat(ctx, sought.highlight), 5);
    });

    it('is the menu button size and does not take clicks', () => {
        const source = fs.readFileSync(path.join(SITE_ROOT, 'js/ui/ResultBar.js'), 'utf8');

        expect(source).toContain('UI.menuBtnW');
        expect(source).toContain('UI.menuBtnH');
        expect(source).not.toContain('setInteractive');
        expect(source).toContain('0xffffff');
        expect(source).toContain('panels.left.alpha');
        expect(source).toContain('panels.right.alpha');
        expect(source).toContain('edge.lineBetween(x, top, x, top + this.height)');
        expect(source).toContain('resultBarLeftShare');
        expect(source).toContain("fill: '#000000'");
        expect(source).toContain('setAlpha(1)');
        expect(source).toContain('this.cutLabel(rt, cutter)');
        expect(source).toContain('labelChanged');
        expect(source).not.toContain("this.cutLabel(rt, this.leftText, 'left')");
        expect(source).toContain('new UiHeatMap');
        expect(source).toContain('present: false');
        expect(source).toContain('createResultBarHighlight');
        expect(source).toContain('class RoundsResultBar');
        expect(source).toContain("caption: 'Rounds'");
        expect(source).toContain('class StonesResultBar');
        expect(source).toContain("caption: 'Stones'");
        expect(source).toContain("createComposite('stone'");
        expect(source).toContain('HM_SKINNED_LENGTH_SCALE');
        expect(source).toContain('this.stone.ballInit.orbitRadius *= scale');
        expect(source).toContain('this.stone.ballInit.radius *= scale');
        expect(source).toContain('UI.menuBtnW - icon - gap');
        expect(source).toContain('this.root.x += (icon + gap) / 2');
        expect(source).toContain('- this.iconGap - size / 2');
        expect(source).toContain('resultBarCaptionPoint');
    });

    it('keeps the caption empty unless one is given, above the upper left', () => {
        const ctx = loadHeat();

        expect(ctx.resultBarCaptionText(undefined)).toBe('');
        expect(ctx.resultBarCaptionText(null)).toBe('');
        expect(ctx.resultBarCaptionText('Rounds')).toBe('Rounds');
        expect(ctx.resultBarCaptionPoint(320, 56)).toEqual({ x: -160, y: -34 });
    });

    it('splits the face into two equal panels, with the left one transparent', () => {
        const ctx = loadHeat();
        const panels = ctx.resultBarPanels(320, 56);

        expect(panels.left).toEqual({ x: 0, y: 0, width: 160, height: 56, alpha: 0 });
        expect(panels.right).toEqual({ x: 160, y: 0, width: 160, height: 56, alpha: 1 });
        expect(ctx.resultBarLabelX(320, 40, 'left')).toBe(18);
        expect(ctx.resultBarLabelX(320, 40, 'right')).toBe(320 - 18 - 40);
    });

    it('moves the split from equal shares to the score ratio', () => {
        const ctx = loadHeat();
        const share = (u) => ctx.resultBarLeftShare(0, 0, 2, 1, u);

        expect(share(0)).toBe(0.5);
        expect(share(0.5)).toBeCloseTo(0.5 + (2 / 3 - 0.5) * 0.5, 8);
        expect(share(1)).toBeCloseTo(2 / 3, 8);

        const end = ctx.resultBarPanels(320, 56, share(1));
        expect(end.left.width).toBe(213);
        expect(end.right.width).toBe(107);
        expect(end.left.width / 320).toBeCloseTo(0.67, 2);
        expect(end.right.width / 320).toBeCloseTo(0.33, 2);
        expect(end.left.alpha).toBe(0);
        expect(end.right.alpha).toBe(1);
        expect(end.left.x).toBe(0);
        expect(end.right.x).toBe(213);
    });
});
