/**
 * HmVerticalTableAmountIndicator
 * HmVerticalAmountIndicator split into columns. The ordered slots fill the
 * left column first, then the column to its right. `columns` is how many
 * columns the box is divided into (default 2). Width is shared across the
 * columns. Height is shared down each column. `direction` still chooses
 * where a column begins: `asc` at the top, `desc` at the bottom.
 */
class HmVerticalTableAmountIndicator extends HmVerticalAmountIndicator {
    static PROP_TABS = [
        {
            id: 'place',
            label: 'PLACE',
            rows: HmVerticalAmountIndicator.PROP_TABS[0].rows.concat([
                { key: 'columns', label: 'COLUMNS', decimals: 0 }
            ])
        }
    ];

    constructor(heatMap, options) {
        const opts = Object.assign({
            axis: 'vertical',
            kind: 'vertical-table-amount-indicator',
            name: 'Amount Table',
            width: 40,
            height: 72,
            columns: 2,
            direction: 'asc'
        }, options || {});
        if (opts.columns == null) {
            opts.columns = 2;
        }
        if (!opts.name) {
            opts.name = 'Amount Table';
        }
        opts.kind = 'vertical-table-amount-indicator';
        super(heatMap, opts);
    }

    layoutItems() {
        layoutAmountTable(this);
    }

    get params() {
        const values = super.params;
        values.columns = this.columns;
        return values;
    }

    set(key, value) {
        if (key === 'columns') {
            this.columns = amountIndicatorColumns(value, this.columns, this.maxAmount);
            this.layoutItems();
            return this.columns;
        }
        return super.set(key, value);
    }

    nudgeParam(key, dir) {
        if (key === 'columns') {
            return this.set('columns', this.columns + dir);
        }
        return super.nudgeParam(key, dir);
    }

    setMaxAmount(value) {
        const next = super.setMaxAmount(value);
        this.columns = amountIndicatorColumns(this.columns, 1, this.maxAmount);
        this.layoutItems();
        return next;
    }

    extendSerialized(data) {
        const saved = super.extendSerialized(data);
        saved.columns = this.columns;
        return saved;
    }

    applySerialized(data) {
        if (data && typeof data.columns === 'number') {
            this.columns = amountIndicatorColumns(data.columns, this.columns, AMOUNT_INDICATOR_CAP);
        }
        super.applySerialized(data);
        this.columns = amountIndicatorColumns(this.columns, 1, this.maxAmount);
        this.layoutItems();
    }
}

heatRegisterComposite('verticalTableAmountIndicator', {
    create(heatMap, overrides) {
        return new HmVerticalTableAmountIndicator(heatMap, overrides);
    }
});
