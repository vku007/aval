/**
 * HmHorisontalAmountIndicator
 * How many of one repository item are left: stones, scissors, papers, and the rest.
 * One item per slot, filling width by height (heat cells). The width
 * is split into maxAmount slots with a gap between them.
 * shape is `rectangle` (the default) or `round`. A round is the disk that
 * fits inside that slot.
 * setAmount(stored, selected) keeps the first `stored` slots in the repository.
 * The last `selected` of those are selected. Every other slot is dispensed.
 * Stored is hot, selected is hottest, dispensed is cold.
 * A slot that changes role fades its heat over `duration` seconds (default 0.4).
 * The first paint, from the constructor, is immediate.
 */
class HmHorisontalAmountIndicator extends HotMapUiComposite {
    static PROP_TABS = [
        {
            id: 'place',
            label: 'PLACE',
            rows: [
                { key: 'centerX', label: 'CENTER X', decimals: 1 },
                { key: 'centerY', label: 'CENTER Y', decimals: 1 },
                { key: 'width', label: 'WIDTH', decimals: 1 },
                { key: 'height', label: 'HEIGHT', decimals: 1 },
                { key: 'maxAmount', label: 'MAX', decimals: 0 },
                { key: 'stored', label: 'STORED', decimals: 0 },
                { key: 'selected', label: 'SELECTED', decimals: 0 },
                { key: 'shape', label: 'SHAPE', type: 'enum' }
            ]
        }
    ];

    constructor(heatMap, options) {
        const opts = options || {};
        const vertical = opts.axis === 'vertical';
        super(heatMap, {
            kind: opts.kind || (vertical ? 'vertical-amount-indicator' : 'amount-indicator'),
            name: opts.name || (vertical ? 'Amount V' : 'Amount'),
            center: opts.center,
            spawn: opts.spawn
        });
        this.amountAxis = vertical ? 'vertical' : 'horizontal';
        this.direction = vertical ? amountIndicatorDirection(opts.direction) : 'asc';
        this.width = amountIndicatorSpan(opts.width, 48);
        this.height = amountIndicatorSpan(opts.height, 12);
        this.maxAmount = amountIndicatorCount(
            opts.maxAmount != null ? opts.maxAmount : 1,
            1,
            AMOUNT_INDICATOR_CAP
        );
        this.columns = amountIndicatorColumns(opts.columns, 1, this.maxAmount);
        this.shape = amountIndicatorShape(opts.shape);
        this.duration = Math.max(
            0,
            typeof opts.duration === 'number' && Number.isFinite(opts.duration)
                ? opts.duration
                : AMOUNT_INDICATOR_HEAT_DURATION
        );
        this.stored = 0;
        this.selected = 0;
        this._levels = [];
        this._roles = [];
        this.buildRects();
        this.applyAmounts(
            opts.stored != null ? opts.stored : 0,
            opts.selected != null ? opts.selected : 0,
            true
        );
    }

    buildRects() {
        const landing = { col: this.center.col, row: this.center.row };
        const round = this.shape === 'round';
        const pose = round
            ? { width: 0, height: 0, angle: 0, skew: 0, radius: 2, heat: 1 }
            : { width: 4, height: 4, angle: 0, skew: 0, heat: 1 };
        for (let index = 0; index < this.maxAmount; index += 1) {
            const options = {
                name: 'Amount ' + (index + 1),
                isVisible: true,
                cycling: false,
                params: { speed: 1, delay: 0, gap: 0 },
                from: pose,
                to: pose,
                center: landing,
                target: { col: landing.col, row: landing.row }
            };
            const item = round
                ? new UiRound(this.heatMap, options)
                : new UiBackHighlighter(this.heatMap, options);
            this.add(item);
        }
        this.layoutItems();
        return this;
    }

    layoutItems() {
        layoutAmountIndicator(this);
    }

    get params() {
        return Object.assign(this.placeParams(), {
            width: this.width,
            height: this.height,
            maxAmount: this.maxAmount,
            stored: this.stored,
            selected: this.selected,
            shape: this.shape
        });
    }

    set(key, value) {
        if (key === 'width' || key === 'height') {
            this[key] = amountIndicatorSpan(value, this[key]);
            this.layoutItems();
            return this[key];
        }
        if (key === 'centerX' || key === 'centerY') {
            const next = { col: this.center.col, row: this.center.row };
            next[key === 'centerX' ? 'col' : 'row'] = Number(value);
            this.setCenter(next);
            return this.params[key];
        }
        if (key === 'maxAmount') {
            return this.setMaxAmount(value);
        }
        if (key === 'stored') {
            this.setAmount(value, this.selected);
            return this.stored;
        }
        if (key === 'selected') {
            this.setAmount(this.stored, value);
            return this.selected;
        }
        if (key === 'shape') {
            return this.setShape(value);
        }
        return this.params[key];
    }

    nudgeParam(key, dir) {
        const placed = this.nudgePlace(key, dir);
        if (placed !== undefined) {
            return placed;
        }
        if (key === 'width' || key === 'height') {
            return this.set(key, this[key] + dir * 2);
        }
        if (key === 'maxAmount') {
            return this.set(key, this.maxAmount + dir);
        }
        if (key === 'stored') {
            return this.set(key, this.stored + dir);
        }
        if (key === 'selected') {
            return this.set(key, this.selected + dir);
        }
        if (key === 'shape') {
            return this.set('shape', this.shape === 'round' ? 'rectangle' : 'round');
        }
        return this.params[key];
    }

    roleAt(index) {
        if (this._roles[index]) {
            return this._roles[index];
        }
        return amountIndicatorRole(index, this.stored, this.selected);
    }

    setMaxAmount(value) {
        const next = Math.max(1, amountIndicatorCount(value, this.maxAmount, AMOUNT_INDICATOR_CAP));
        if (next === this.maxAmount) {
            return this.maxAmount;
        }
        this.maxAmount = next;
        this.rebuildSlots();
        return this.maxAmount;
    }

    setShape(value) {
        const next = amountIndicatorShape(value);
        if (next === this.shape) {
            return this.shape;
        }
        this.shape = next;
        this.rebuildSlots();
        return this.shape;
    }

    rebuildSlots() {
        const stored = this.stored;
        const selected = this.selected;
        this.items.slice().forEach((item) => this.dropItem(item));
        this._levels = [];
        this._roles = [];
        this.buildRects();
        this.applyAmounts(stored, selected, true);
        return this;
    }

    setAmount(stored, selected) {
        return this.applyAmounts(stored, selected, false);
    }

    applyAmounts(stored, selected, instant) {
        this.stored = amountIndicatorCount(stored, 0, this.maxAmount);
        this.selected = amountIndicatorCount(selected, 0, this.stored);
        this.paintAmounts(!!instant);
        return this;
    }

    paintAmounts(instant) {
        const held = this.stored;
        const picked = this.selected;
        this.items.forEach((item, index) => {
            const role = amountIndicatorRole(index, held, picked);
            const heat = amountIndicatorHeat(role);
            if (!instant && this._levels[index] === heat) {
                return;
            }
            this._levels[index] = heat;
            this._roles[index] = role;
            item.play(fade({
                from: instant ? heat : 'current',
                to: heat,
                duration: instant ? 0 : this.duration,
                ease: 'sine',
                slot: 'life',
                fill: 'hold',
                policy: 'replace'
            }));
        });
        return this;
    }

    reset() {
        heatCancelAll(this);
        this.items.forEach((item) => {
            if (item && typeof item.cancelAll === 'function') {
                item.cancelAll();
            }
            if (item && typeof item.reset === 'function') {
                item.reset();
            }
        });
        this.layoutItems();
        this._levels = [];
        this.paintAmounts(true);
        return this;
    }

    extendSerialized(data) {
        data.width = this.width;
        data.height = this.height;
        data.maxAmount = this.maxAmount;
        data.stored = this.stored;
        data.selected = this.selected;
        data.duration = this.duration;
        data.shape = this.shape;
        return data;
    }

    applySerialized(data) {
        if (!data) {
            return;
        }
        const nextShape = typeof data.shape === 'string' ? amountIndicatorShape(data.shape) : this.shape;
        const shapeChanged = nextShape !== this.shape;
        this.shape = nextShape;
        let rebuilt = false;
        if (typeof data.maxAmount === 'number') {
            const before = this.maxAmount;
            this.setMaxAmount(data.maxAmount);
            rebuilt = this.maxAmount !== before;
        }
        if (shapeChanged && !rebuilt) {
            this.rebuildSlots();
        }
        HotMapUiComposite.prototype.applySerialized.call(this, data);
        if (typeof data.width === 'number') {
            this.width = amountIndicatorSpan(data.width, this.width);
        }
        if (typeof data.height === 'number') {
            this.height = amountIndicatorSpan(data.height, this.height);
        }
        if (typeof data.duration === 'number' && Number.isFinite(data.duration)) {
            this.duration = Math.max(0, data.duration);
        }
        const stored = typeof data.stored === 'number' ? data.stored : this.stored;
        const selected = typeof data.selected === 'number' ? data.selected : this.selected;
        this.layoutItems();
        this._levels = [];
        this.applyAmounts(stored, selected, true);
    }
}

heatRegisterComposite('amountIndicator', {
    create(heatMap, overrides) {
        return new HmHorisontalAmountIndicator(heatMap, overrides);
    }
});
