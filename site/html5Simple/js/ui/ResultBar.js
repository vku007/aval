/**
 * ResultBar
 * Menu-button sized score panel. It is not clickable.
 * The face is two panels. The scene heat map carries this bar's highlight,
 * the same way it carries the OK button highlight.
 * The left panel is transparent; the right panel is solid black.
 * A white edge frames both, with a line between them.
 * The line starts in the middle. As the scores count, it moves so each panel
 * takes its share of the total: 2 and 1 finish at 67% and 33%.
 * It stops before the right digit, so that digit stays on the black panel
 * even when its score is 0.
 * The left label is solid black on the left edge of the left panel.
 * The right label is knocked out of the right edge of the right panel, so the
 * highlight shows through it. Over `duration` seconds (default 3) the labels count
 * from startLeftValue / startRightValue (default 0) to endLeftValue /
 * endRightValue, and the highlight heat doubles.
 * A caption sits outside the panel, at its upper left. It is empty unless given.
 * The face is four fifths of a menu button's height.
 * RoundsResultBar is this bar with the caption "Rounds".
 * StonesResultBar has no caption. A small stone picture, scaled like the stone
 * on HmSkinnedStoneButton, sits outside the bar on the left. The bar is shorter
 * by that picture and the gap, so the pair matches the rounds bar.
 * StonePrimeResultBar is the same shape with no caption. Its picture is a stone
 * prime, counted from spent stone NEG effects.
 * ScissorsResultBar and PaperResultBar use the same shape. Their pictures match
 * HmSkinnedScissorsButton and HmSkinnedPaperButton.
 * ScissorsPrimeResultBar and PaperPrimeResultBar match StonePrimeResultBar.
 * Their pictures are a scissors prime and a paper prime, counted from spent
 * scissors NEG and paper NEG effects.
 * CoreResultBar is the same shape. Its picture is a core of four balls, scaled
 * like HmSkinnedCoreButton, counted from spent NT effects.
 */
const RESULT_BAR_HEAT = 0.1;
const RESULT_BAR_DURATION = 3;
const RESULT_BAR_PAD = 18;
const RESULT_BAR_CAPTION_GAP = 6;
const STONES_RESULT_ICON = 40;
const STONES_RESULT_ICON_GAP = 8;
let STONES_RESULT_SEQ = 0;

class ResultBar {
    constructor(scene, x, y, options) {
        const opts = options || {};
        this.scene = scene;
        this.width = resultBarNumber(opts.width, UI.menuBtnW);
        this.height = resultBarNumber(opts.height, Math.round(UI.menuBtnH * 0.8));
        this.startLeftValue = resultBarNumber(opts.startLeftValue, 0);
        this.startRightValue = resultBarNumber(opts.startRightValue, 0);
        this.endLeftValue = resultBarNumber(opts.endLeftValue, this.startLeftValue);
        this.endRightValue = resultBarNumber(opts.endRightValue, this.startRightValue);
        this.duration = Math.max(0, resultBarNumber(opts.duration, RESULT_BAR_DURATION));
        this.caption = resultBarCaptionText(opts.caption);
        this.elapsed = 0;
        this.highlight = null;
        this.run = null;
        this.root = scene.add.container(x, y);
        this.root.setDepth(1);
        this.face = null;
        this.leftText = '';
        this.rightText = '';
        this.split = null;
        this.edge = scene.add.graphics();
        this.leftLabel = scene.add.text(RESULT_BAR_PAD - this.width / 2, 0, '', {
            font: `${UI.heading}px monospace`,
            fill: '#000000',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0, 0.5).setAlpha(1);
        const captionAt = resultBarCaptionPoint(this.width, this.height);
        this.captionText = scene.add.text(captionAt.x, captionAt.y, this.caption, {
            font: `${UI.small}px monospace`,
            fill: '#666666'
        }).setOrigin(0, 1);
        this.root.add(this.edge);
        this.root.add(this.leftLabel);
        this.root.add(this.captionText);
        this.syncLabels();
    }

    spaceAbove() {
        if (!this.caption) {
            return 0;
        }
        const text = this.captionText;
        const height = text && text.height ? text.height : 0;
        return RESULT_BAR_CAPTION_GAP + height;
    }

    update(time, delta) {
        const step = Math.max(0, Number(delta) || 0) / 1000;
        if (this.duration > 0 && this.elapsed < this.duration) {
            this.elapsed = Math.min(this.duration, this.elapsed + step);
        }
        this.syncLabels();
    }

    progress() {
        if (!(this.duration > 0)) {
            return 1;
        }
        if (this.elapsed <= 0) {
            return 0;
        }
        if (this.elapsed >= this.duration) {
            return 1;
        }
        return this.elapsed / this.duration;
    }

    syncLabels() {
        const u = this.progress();
        const left = resultBarLabel(this.startLeftValue, this.endLeftValue, u);
        const right = resultBarLabel(this.startRightValue, this.endRightValue, u);
        const share = resultBarLeftShare(
            this.startLeftValue,
            this.startRightValue,
            this.endLeftValue,
            this.endRightValue,
            u
        );
        const labelChanged = left !== this.leftText || right !== this.rightText || !this.face;
        if (labelChanged) {
            this.leftText = left;
            this.rightText = right;
            this.leftLabel.setText(left);
            this.redrawLabel();
        }
        const labelWidth = this.labelBox && this.labelBox.w ? this.labelBox.w : 0;
        const split = resultBarSplitForLabel(this.width, share, labelWidth);
        if (!labelChanged && split === this.split) {
            return;
        }
        this.leftText = left;
        this.rightText = right;
        this.split = split;
        this.redrawEdge(split);
    }

    redrawEdge(split) {
        const edge = this.edge;
        if (!edge) {
            return;
        }
        const panels = resultBarPanels(this.width, this.height, split / this.width);
        const top = -this.height / 2;
        edge.clear();
        if (panels.left.alpha > 0) {
            edge.fillStyle(0x000000, panels.left.alpha);
            edge.fillRect(-this.width / 2, top, panels.left.width, panels.left.height);
        }
        edge.fillStyle(0x000000, panels.right.alpha);
        resultBarFillPanel(edge, panels.right.x - this.width / 2, top, panels.right.width, this.height, this.labelBox);
        const x = split - this.width / 2;
        edge.lineStyle(2, 0xffffff, 1);
        edge.strokeRect(-this.width / 2, top, this.width, this.height);
        edge.lineBetween(x, top, x, top + this.height);
    }

    redrawLabel() {
        const scene = this.scene;
        if (!scene) {
            return;
        }
        const cutter = scene.make.text({
            x: 0,
            y: 0,
            text: this.rightText,
            add: false,
            style: {
                font: `${UI.heading}px monospace`,
                fill: '#ffffff',
                stroke: '#ffffff',
                strokeThickness: 3
            }
        });
        const w = Math.max(1, Math.ceil(cutter.width));
        const h = Math.max(1, Math.ceil(cutter.height));
        let rt = this.face;
        if (!rt || rt.width !== w || rt.height !== h) {
            if (rt) {
                rt.destroy();
            }
            rt = scene.add.renderTexture(0, 0, w, h);
            rt.setOrigin(0, 0.5);
            this.root.add(rt);
            this.face = rt;
        }
        const x = resultBarLabelX(this.width, cutter.width, 'right') - this.width / 2;
        rt.setPosition(x, 0);
        this.labelBox = { x: x, y: -h / 2, w: w, h: h };
        rt.clear();
        rt.fill(0x000000, 1, 0, 0, w, h);
        this.cutLabel(rt, cutter);
        cutter.destroy();
    }

    cutLabel(rt, cutter) {
        rt.erase(cutter, 0, 0);
    }
}

class RoundsResultBar extends ResultBar {
    constructor(scene, x, y, options) {
        const opts = Object.assign({ caption: 'Rounds' }, options || {});
        super(scene, x, y, opts);
    }
}

class StonesResultBar extends ResultBar {
    constructor(scene, x, y, options) {
        const icon = STONES_RESULT_ICON;
        const gap = STONES_RESULT_ICON_GAP;
        const opts = Object.assign({
            width: UI.menuBtnW - icon - gap
        }, options || {});
        super(scene, x, y, opts);
        this.iconSize = icon;
        this.iconGap = gap;
        this.root.x += (icon + gap) / 2;
        this.stoneMap = null;
        this.stone = null;
        this.stoneImage = null;
        this.stoneCanvas = null;
        this.stoneKey = '';
        this.installStoneIcon();
        if (scene && scene.events) {
            scene.events.once('shutdown', () => this.destroyStoneIcon());
        }
    }

    update(time, delta) {
        super.update(time, delta);
        this.paintStoneIcon(time, delta);
    }

    composeMark(field) {
        const scale = HM_SKINNED_LENGTH_SCALE;
        this.stone = createComposite('stone', this.stoneMap, {
            name: 'Stones',
            center: {
                col: (field.cols - 1) / 2,
                row: (field.rows - 1) / 2
            }
        });
        this.stone.ballInit.orbitRadius *= scale;
        this.stone.ballInit.radius *= scale;
        for (let i = 0; i < 3; i += 1) {
            this.stone.addItem({ animate: false });
        }
    }

    installStoneIcon() {
        const scene = this.scene;
        const source = HM_SKINNED_HEAT_SIZE;
        STONES_RESULT_SEQ += 1;
        this.stoneMap = new UiHeatMap(scene, {
            x: 0,
            y: 0,
            width: source,
            height: source
        }, {
            interactive: false,
            cellPx: 1,
            present: false,
            minCols: 1,
            minRows: 1
        });
        if (typeof applyCompositeHeatMapDefault === 'function') {
            applyCompositeHeatMapDefault({
                heatMap: this.stoneMap,
                cache: scene.cache
            });
        }
        const field = this.stoneMap.field;
        if (field.view) {
            field.view.setVisible(false);
        }
        this.composeMark(field);
        const size = this.iconSize;
        this.stoneKey = `stones-result-${STONES_RESULT_SEQ}`;
        this.stoneCanvas = uiStageButtonFaceCanvas(scene, this.stoneKey, size, size);
        const iconX = -this.width / 2 - this.iconGap - size / 2;
        this.stoneImage = scene.add.image(iconX, 0, this.stoneKey);
        this.stoneImage.setDisplaySize(size, size);
        this.root.add(this.stoneImage);
        this.captionText.setX(iconX - size / 2);
        this.root.bringToTop(this.captionText);
        this.paintStoneIcon(0, 16);
    }

    paintStoneIcon(time, delta) {
        const map = this.stoneMap;
        if (!map) {
            return;
        }
        map.update(time, delta);
        const field = map.field;
        const src = field && field.painted !== false && field.ctx ? field.ctx.canvas : null;
        const canvas = this.stoneCanvas;
        if (!src || !canvas) {
            return;
        }
        const size = this.iconSize;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, size, size);
        ctx.save();
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(src, 0, 0, size, size);
        ctx.restore();
        const texture = this.scene.textures.get(this.stoneKey);
        if (texture && typeof texture.refresh === 'function') {
            texture.refresh();
        }
    }

    destroyStoneIcon() {
        const map = this.stoneMap;
        const scene = this.scene;
        const key = this.stoneKey;
        this.stoneMap = null;
        this.stone = null;
        this.stoneCanvas = null;
        if (map && map.field && typeof map.field.destroy === 'function') {
            map.field.destroy();
        }
        if (scene && scene.textures && key && scene.textures.exists(key)) {
            scene.textures.remove(key);
        }
    }
}

class StonePrimeResultBar extends StonesResultBar {
    constructor(scene, x, y, options) {
        super(scene, x, y, options);
    }

    composeMark(field) {
        const scale = (HM_SKINNED_HEAT_SIZE / 2) / 48;
        this.stone = createComposite('stonePrime', this.stoneMap, {
            name: 'Stone Prime',
            center: {
                col: (field.cols - 1) / 2,
                row: (field.rows - 1) / 2
            },
            animate: false
        });
        hmFitCoreLengths(this.stone, scale);
        const ball = (this.stone.items || []).find((item) => item && item.kind === 'hot-ball');
        const params = ball && ball.motion && ball.motion.params;
        if (params) {
            params.orbitRadius *= scale;
            params.radius *= scale;
        }
    }
}

class ScissorsResultBar extends StonesResultBar {
    composeMark(field) {
        const scale = HM_SKINNED_LENGTH_SCALE;
        this.stone = createComposite('scissor', this.stoneMap, {
            name: 'Scissors',
            center: {
                col: (field.cols - 1) / 2,
                row: (field.rows - 1) / 2
            }
        });
        this.stone.shardInit.from.width *= scale;
        this.stone.shardInit.from.height = 12 * scale;
        this.stone.shardInit.to.width *= scale;
        this.stone.shardInit.to.height = 8 * scale;
        for (let i = 0; i < 2; i += 1) {
            this.stone.addItem({ animate: false });
        }
    }
}

class ScissorsPrimeResultBar extends StonesResultBar {
    composeMark(field) {
        const scale = (HM_SKINNED_HEAT_SIZE / 2) / 48;
        this.stone = createComposite('scissorsPrime', this.stoneMap, {
            name: 'Scissors Prime',
            center: {
                col: (field.cols - 1) / 2,
                row: (field.rows - 1) / 2
            },
            animate: false
        });
        hmFitCoreLengths(this.stone, scale);
        const shard = (this.stone.items || []).find((item) => item && item.kind === 'shard');
        const emitter = shard && shard.emitter;
        if (emitter && typeof emitter.setParam === 'function' && emitter.from && emitter.to) {
            emitter.setParam('fromWidth', emitter.from.width * scale);
            emitter.setParam('fromHeight', emitter.from.height * scale);
            emitter.setParam('toWidth', emitter.to.width * scale);
            emitter.setParam('toHeight', emitter.to.height * scale);
        }
    }
}

class PaperResultBar extends StonesResultBar {
    composeMark(field) {
        const scale = HM_SKINNED_LENGTH_SCALE;
        this.stone = createComposite('diskStack', this.stoneMap, {
            name: 'Paper',
            center: {
                col: (field.cols - 1) / 2,
                row: (field.rows - 1) / 2 + 20 * scale
            }
        });
        this.stone.distance = 14 * scale;
        this.stone.sheetInit.radFrom = 24 * scale;
        this.stone.sheetInit.radTo = 36 * scale;
        this.stone.sheetInit.ballRadius = 40 * scale;
        this.stone.sheetInit.ballSize = 3.2 * scale;
        for (let i = 0; i < 3; i += 1) {
            this.stone.addItem({ animate: false });
        }
    }
}

class PaperPrimeResultBar extends StonesResultBar {
    composeMark(field) {
        const scale = (HM_SKINNED_HEAT_SIZE / 2) / 48;
        this.stone = createComposite('paperPrime', this.stoneMap, {
            name: 'Paper Prime',
            center: {
                col: (field.cols - 1) / 2,
                row: (field.rows - 1) / 2
            },
            animate: false
        });
        hmFitCoreLengths(this.stone, scale);
        const sheet = (this.stone.items || []).find((item) => item && item.kind === 'new-sheet');
        if (sheet && typeof sheet.setParam === 'function') {
            sheet.setParam('radFrom', sheet.radFrom * scale);
            sheet.setParam('radTo', sheet.radTo * scale);
            sheet.setParam('ballRadius', sheet.ballRadius * scale);
            sheet.setParam('ballSize', sheet.ballSize * scale);
        }
    }
}

class CoreResultBar extends StonesResultBar {
    composeMark(field) {
        this.stone = new UiCore(this.stoneMap, {
            name: 'Core',
            animate: false,
            center: {
                col: (field.cols - 1) / 2,
                row: (field.rows - 1) / 2
            }
        });
        hmFitCoreLengths(this.stone, (HM_SKINNED_HEAT_SIZE / 2) / 48);
        while (this.stone.balls().length < 4) {
            if (!this.stone.addItem({ animate: false })) {
                break;
            }
        }
        hmSeatCoreBalls(this.stone);
    }
}

function resultBarCaptionText(value) {
    if (value == null) {
        return '';
    }
    return String(value);
}

function resultBarCaptionPoint(width, height) {
    return {
        x: -width / 2,
        y: -height / 2 - RESULT_BAR_CAPTION_GAP
    };
}

function resultBarFillPanel(edge, x, y, w, h, hole) {
    if (!(w > 0) || !(h > 0)) {
        return;
    }
    if (!hole) {
        edge.fillRect(x, y, w, h);
        return;
    }
    const left = Math.max(x, hole.x);
    const right = Math.min(x + w, hole.x + hole.w);
    const top = Math.max(y, hole.y);
    const bottom = Math.min(y + h, hole.y + hole.h);
    if (left > x) {
        edge.fillRect(x, y, left - x, h);
    }
    if (right < x + w) {
        edge.fillRect(right, y, x + w - right, h);
    }
    if (right > left && top > y) {
        edge.fillRect(left, y, right - left, top - y);
    }
    if (right > left && bottom < y + h) {
        edge.fillRect(left, bottom, right - left, y + h - bottom);
    }
}

function createResultBarHighlight(heatMap, bar, options) {
    const opts = options || {};
    const duration = opts.duration != null ? opts.duration : (bar && bar.duration) || RESULT_BAR_DURATION;
    const cell = resultBarHeatCell(heatMap, bar.root.x, bar.root.y);
    const pose = resultBarHighlightPose(heatMap, bar);
    const highlight = new UiBackHighlighter(heatMap, {
        name: 'Result Bar',
        cycling: false,
        center: cell,
        target: { col: cell.col, row: cell.row },
        from: pose,
        to: pose
    });
    highlight.define('rise', fade({
        from: 1,
        to: 2,
        duration: duration,
        ease: 'linear',
        slot: 'life',
        fill: 'hold'
    }));
    const run = highlight.play('rise');
    bar.highlight = highlight;
    bar.run = run;
    resultBarSeekRise(bar);
    return {
        highlight: highlight,
        run: run
    };
}

function resultBarSeekRise(bar) {
    const run = bar && bar.run;
    if (!run || run.status !== 'running' || !(run.duration > 0) || typeof bar.progress !== 'function') {
        return;
    }
    const u = bar.progress();
    if (!(u > 0)) {
        return;
    }
    run.seek(Math.min(run.duration, u * run.duration));
}

function resultBarHeatCell(heatMap, x, y) {
    const field = heatMap.field;
    const bounds = heatMap.bounds;
    return {
        col: ((x - bounds.x) / Math.max(bounds.width, 1)) * (field.cols - 1),
        row: ((y - bounds.y) / Math.max(bounds.height, 1)) * (field.rows - 1)
    };
}

function resultBarHighlightPose(heatMap, bar) {
    const field = heatMap.field;
    const bounds = heatMap.bounds;
    const width = (bar.width / Math.max(bounds.width, 1)) * Math.max(1, field.cols - 1);
    const height = (bar.height / Math.max(bounds.height, 1)) * Math.max(1, field.rows - 1);
    return {
        width: resultBarEven(width),
        height: resultBarEven(height),
        angle: 0,
        skew: 0,
        heat: RESULT_BAR_HEAT
    };
}

function resultBarEven(value) {
    const size = Math.max(4, Math.round(value));
    return size - (size % 2);
}

function resultBarPanels(width, height, leftShare) {
    const leftWidth = resultBarSplit(width, leftShare);
    return {
        left: { x: 0, y: 0, width: leftWidth, height: height, alpha: 0 },
        right: { x: leftWidth, y: 0, width: width - leftWidth, height: height, alpha: 1 }
    };
}

function resultBarSplit(width, leftShare) {
    return Math.round(width * resultBarClampShare(leftShare));
}

function resultBarSplitForLabel(width, leftShare, labelWidth) {
    const split = resultBarSplit(width, leftShare);
    const reserve = Math.max(0, labelWidth || 0) + RESULT_BAR_PAD;
    const limit = Math.max(0, width - reserve);
    return Math.min(split, limit);
}

function resultBarClampShare(leftShare) {
    if (leftShare == null || !isFinite(leftShare)) {
        return 0.5;
    }
    if (leftShare < 0) {
        return 0;
    }
    if (leftShare > 1) {
        return 1;
    }
    return leftShare;
}

function resultBarProportion(left, right) {
    const sum = left + right;
    if (!(sum > 0) || !isFinite(sum)) {
        return 0.5;
    }
    const share = left / sum;
    if (!isFinite(share)) {
        return 0.5;
    }
    if (share < 0) {
        return 0;
    }
    if (share > 1) {
        return 1;
    }
    return share;
}

function resultBarLeftShare(startLeft, startRight, endLeft, endRight, u) {
    const t = u <= 0 ? 0 : (u >= 1 ? 1 : u);
    const from = resultBarProportion(startLeft, startRight);
    const to = resultBarProportion(endLeft, endRight);
    return from + (to - from) * t;
}

function resultBarLabelX(width, textWidth, side) {
    const panels = resultBarPanels(width, 0);
    const panel = side === 'right' ? panels.right : panels.left;
    if (side === 'right') {
        return Math.round(panel.x + panel.width - RESULT_BAR_PAD - textWidth);
    }
    return Math.round(panel.x + RESULT_BAR_PAD);
}

function resultBarNumber(value, fallback) {
    if (value == null || value === '') {
        return fallback;
    }
    const n = Number(value);
    return isFinite(n) ? n : fallback;
}

function resultBarWhole(value) {
    return typeof value === 'number' && isFinite(value) && Math.round(value) === value;
}

function resultBarText(value) {
    if (!resultBarWhole(value) && (typeof value !== 'number' || !isFinite(value))) {
        return '0';
    }
    if (resultBarWhole(value)) {
        return String(value);
    }
    return String(Math.round(value * 10) / 10);
}

function resultBarLabel(start, end, u) {
    const t = u <= 0 ? 0 : (u >= 1 ? 1 : u);
    if (t <= 0) {
        return resultBarText(start);
    }
    if (t >= 1) {
        return resultBarText(end);
    }
    const value = start + (end - start) * t;
    if (resultBarWhole(start) && resultBarWhole(end)) {
        return String(Math.round(value));
    }
    return resultBarText(value);
}

function resultBarProgress(run) {
    if (!run) {
        return 0;
    }
    if (run.status === 'finished' || !(run.duration > 0)) {
        return 1;
    }
    const ease = (run.block && run.block.ease) || 'linear';
    return heatEase(ease, run.time / run.duration);
}
