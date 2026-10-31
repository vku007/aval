/**
 * HmVerticalAmountIndicator
 * The same repository slots as HmHorisontalAmountIndicator, stacked in a column.
 * Width is the thickness of each slot. Height is split into maxAmount rectangles.
 * direction says where the set begins. `asc` starts at the top and continues
 * downward. `desc` starts at the bottom and continues upward.
 */
class HmVerticalAmountIndicator extends HmHorisontalAmountIndicator {
    static PROP_TABS = [
        {
            id: 'place',
            label: 'PLACE',
            rows: HmHorisontalAmountIndicator.PROP_TABS[0].rows.concat([
                { key: 'direction', label: 'DIRECTION', type: 'enum' }
            ])
        }
    ];

    constructor(heatMap, options) {
        super(heatMap, Object.assign({
            axis: 'vertical',
            width: 16,
            height: 100,
            direction: 'asc'
        }, options || {}));
    }

    get params() {
        const values = super.params;
        values.direction = this.direction;
        return values;
    }

    set(key, value) {
        if (key === 'direction') {
            this.direction = amountIndicatorDirection(value);
            this.layoutItems();
            return this.direction;
        }
        return super.set(key, value);
    }

    nudgeParam(key, dir) {
        if (key === 'direction') {
            return this.set('direction', this.direction === 'asc' ? 'desc' : 'asc');
        }
        return super.nudgeParam(key, dir);
    }

    extendSerialized(data) {
        const saved = super.extendSerialized(data);
        saved.direction = this.direction;
        return saved;
    }

    applySerialized(data) {
        if (data && typeof data.direction === 'string') {
            this.direction = amountIndicatorDirection(data.direction);
        }
        super.applySerialized(data);
    }
}

heatRegisterComposite('verticalAmountIndicator', {
    create(heatMap, overrides) {
        return new HmVerticalAmountIndicator(heatMap, overrides);
    }
});
