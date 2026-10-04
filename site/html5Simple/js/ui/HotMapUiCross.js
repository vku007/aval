/**
 * HotMapUiCross
 * Two back highlighters and two shards on one center.
 * The highlighters are a plus (HIGH TURN apart). The shards are an X
 * (SHARD TURN apart, plus SHARD OFF). Props are the values for that pair.
 */
class HotMapUiCross extends HotMapUiComposite {
    static PROP_TABS = [
        {
            id: 'place',
            label: 'PLACE',
            rows: [
                { key: 'centerX', label: 'CENTER X', decimals: 1 },
                { key: 'centerY', label: 'CENTER Y', decimals: 1 },
                { key: 'highlightTurn', label: 'HIGH TURN', decimals: 0 },
                { key: 'shardTurn', label: 'SHARD TURN', decimals: 0 },
                { key: 'shardOffset', label: 'SHARD OFF', decimals: 0 }
            ]
        },
        {
            id: 'field',
            label: 'FIELD',
            rows: [
                { key: 'hlVisible', label: 'HIGH VIS', type: 'bool' },
                { key: 'hlCycling', label: 'HIGH CYCLE', type: 'bool' },
                { key: 'hlSpeed', label: 'HIGH SPEED', decimals: 1 },
                { key: 'hlDelay', label: 'HIGH DELAY', decimals: 1 },
                { key: 'hlGap', label: 'HIGH GAP', decimals: 1 },
                { key: 'shVisible', label: 'SHARD VIS', type: 'bool' },
                { key: 'shCycling', label: 'SHARD CYCLE', type: 'bool' },
                { key: 'shSpeed', label: 'SHARD SPEED', decimals: 1 },
                { key: 'shDelay', label: 'SHARD DELAY', decimals: 1 },
                { key: 'shGap', label: 'SHARD GAP', decimals: 1 }
            ]
        },
        {
            id: 'from',
            label: 'FROM',
            rows: [
                { key: 'hlFromWidth', label: 'H WIDTH', decimals: 0 },
                { key: 'hlFromHeight', label: 'H HEIGHT', decimals: 0 },
                { key: 'hlFromAngle', label: 'H ANGLE', decimals: 0 },
                { key: 'hlFromHeat', label: 'H HEAT', decimals: 1 },
                { key: 'shFromWidth', label: 'S WIDTH', decimals: 0 },
                { key: 'shFromHeight', label: 'S HEIGHT', decimals: 0 },
                { key: 'shFromAngle', label: 'S ANGLE', decimals: 0 },
                { key: 'shFromSkew', label: 'S SKEW', decimals: 0 },
                { key: 'shFromShapeHeat', label: 'S SHAPE', decimals: 1 },
                { key: 'shFromHeat', label: 'S HEAT', decimals: 1 },
                { key: 'shFromGlisten', label: 'S GLISTEN', decimals: 0 }
            ]
        },
        {
            id: 'to',
            label: 'TO',
            rows: [
                { key: 'hlToWidth', label: 'H WIDTH', decimals: 0 },
                { key: 'hlToHeight', label: 'H HEIGHT', decimals: 0 },
                { key: 'hlToAngle', label: 'H ANGLE', decimals: 0 },
                { key: 'hlToHeat', label: 'H HEAT', decimals: 1 },
                { key: 'shToWidth', label: 'S WIDTH', decimals: 0 },
                { key: 'shToHeight', label: 'S HEIGHT', decimals: 0 },
                { key: 'shToAngle', label: 'S ANGLE', decimals: 0 },
                { key: 'shToSkew', label: 'S SKEW', decimals: 0 },
                { key: 'shToShapeHeat', label: 'S SHAPE', decimals: 1 },
                { key: 'shToHeat', label: 'S HEAT', decimals: 1 },
                { key: 'shToGlisten', label: 'S GLISTEN', decimals: 0 }
            ]
        }
    ];

    constructor(heatMap, options) {
        const opts = options || {};
        const preset = HOT_MAP_CROSS_PRESET;
        super(heatMap, {
            kind: 'hot-map-cross',
            name: opts.name || preset.name,
            center: opts.center || preset.center,
            spawn: opts.spawn || preset.spawn
        });
        this.highlightInit = defaultHotMapCrossInit(preset.highlightInit);
        this.shardInit = defaultHotMapCrossInit(preset.shardInit);
        this.highlightTurn = preset.highlightTurn;
        this.shardTurn = preset.shardTurn;
        this.shardOffset = preset.shardOffset;
        this.seed();
    }

    seed() {
        if (this.parts.length) {
            return this;
        }
        this.addHighlight();
        this.addHighlight();
        this.addShard();
        this.addShard();
        return this;
    }

    get params() {
        const values = this.placeParams();
        values.highlightTurn = this.highlightTurn;
        values.shardTurn = this.shardTurn;
        values.shardOffset = this.shardOffset;
        fillHotMapCrossKindParams(values, 'hl', this.highlightInit);
        fillHotMapCrossKindParams(values, 'sh', this.shardInit);
        return values;
    }

    nudgeParam(key, dir) {
        const placed = this.nudgePlace(key, dir);
        if (placed !== undefined) {
            return placed;
        }
        if (key === 'hlVisible' || key === 'shVisible' || key === 'hlCycling' || key === 'shCycling') {
            this.set(key, !this.params[key]);
            return this.params[key];
        }
        const layout = HOT_MAP_CROSS_LAYOUT[key];
        if (layout) {
            const next = this[key] + dir * layout.step;
            this.set(key, next);
            return this.params[key];
        }
        const route = hotMapCrossRoute(key);
        if (!route) {
            return this.params[key];
        }
        const init = route.kind === 'back-highlight' ? this.highlightInit : this.shardInit;
        if (route.field) {
            const spec = BACK_HIGHLIGHT_FIELD_SPECS[route.name];
            this.set(key, init[route.name] + dir * spec.step);
            return this.params[key];
        }
        const spec = BACK_HIGHLIGHT_POSE_SPECS[route.prop];
        this.set(key, (init[route.group][route.prop] || 0) + dir * spec.step);
        return this.params[key];
    }

    set(key, value) {
        this.keepTemplate(key, value);
        const route = hotMapCrossRoute(key);
        if ((route && route.angle) || HOT_MAP_CROSS_LAYOUT[key]) {
            this.layoutItems();
        } else if (route) {
            const stored = this.params[key];
            this.itemsOf(route.kind).forEach((item) => {
                HeatComposite.prototype.writeField.call(this, item, route.name, stored);
            });
        } else if (key === 'hlVisible' || key === 'shVisible') {
            const kind = key === 'hlVisible' ? 'back-highlight' : 'shard';
            const visible = this.params[key] !== false;
            this.itemsOf(kind).forEach((item) => {
                item.isVisible = visible;
            });
        }
        return this.params[key];
    }

    itemsOf(kind) {
        return this.items.filter((item) => item && item.kind === kind);
    }

    addHighlight() {
        return this.addRect('back-highlight', this.highlightInit, 'Highlight');
    }

    addShard() {
        return this.addRect('shard', this.shardInit, 'Shard');
    }

    addRect(kind, init, label) {
        const count = this.itemsOf(kind).length + 1;
        const landing = { col: this.center.col, row: this.center.row };
        const Ctor = kind === 'shard' ? UiShard : UiBackHighlighter;
        const item = new Ctor(this.heatMap, {
            name: label + ' ' + count,
            isVisible: init.visible !== false,
            cycling: init.cycling !== false,
            params: {
                speed: init.speed,
                delay: init.delay,
                gap: init.gap
            },
            from: copyBackHighlightPose(init.from),
            to: copyBackHighlightPose(init.to),
            center: landing,
            target: { col: landing.col, row: landing.row }
        });
        const lead = this.itemsOf(kind)[0];
        this.add(item);
        item.define('exit', crossExit());
        this.layoutItems();
        syncHotMapCrossCycle(item, lead);
        if (typeof this.onPartAdded === 'function') {
            this.onPartAdded(item);
        }
        this.emit('added', item);
        return item;
    }

    layoutItems() {
        layoutCrossItems(this);
    }

    keepTemplate(key, value) {
        const layout = HOT_MAP_CROSS_LAYOUT[key];
        if (layout) {
            const stepped = Math.round(value / layout.step) * layout.step;
            this[key] = Math.max(layout.min, Math.min(layout.max, stepped));
            return;
        }
        if (key === 'hlVisible') {
            this.highlightInit.visible = !!value;
            return;
        }
        if (key === 'shVisible') {
            this.shardInit.visible = !!value;
            return;
        }
        const route = hotMapCrossRoute(key);
        if (!route) {
            return;
        }
        const init = route.kind === 'back-highlight' ? this.highlightInit : this.shardInit;
        if (route.name === 'cycling') {
            init.cycling = !!value;
            return;
        }
        if (route.field) {
            init[route.name] = clampBackHighlightSpec(BACK_HIGHLIGHT_FIELD_SPECS, route.name, value);
            return;
        }
        if (init[route.group]) {
            init[route.group][route.prop] = clampBackHighlightSpec(
                BACK_HIGHLIGHT_POSE_SPECS,
                route.prop,
                value
            );
        }
    }

    extendSerialized(data) {
        data.highlightInit = copyHotMapCrossInit(this.highlightInit);
        data.shardInit = copyHotMapCrossInit(this.shardInit);
        data.highlightTurn = this.highlightTurn;
        data.shardTurn = this.shardTurn;
        data.shardOffset = this.shardOffset;
        return data;
    }

    applySerializedExtras(data) {
        if (data.highlightInit) {
            this.highlightInit = copyHotMapCrossInit(data.highlightInit);
        }
        if (data.shardInit) {
            this.shardInit = copyHotMapCrossInit(data.shardInit);
        }
        if (typeof data.highlightTurn === 'number') {
            this.highlightTurn = data.highlightTurn;
        }
        if (typeof data.shardTurn === 'number') {
            this.shardTurn = data.shardTurn;
        }
        if (typeof data.shardOffset === 'number') {
            this.shardOffset = data.shardOffset;
        }
    }
}

heatRegisterComposite('cross', {
    create(heatMap, overrides) {
        return new HotMapUiCross(heatMap, overrides);
    }
});
