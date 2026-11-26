/**
 * HmVerticalTableAmountIndicator
 * HmVerticalAmountIndicator split into columns. The ordered slots fill the
 * left column first, then the column to its right. `columns` is how many
 * columns the box is divided into (default 2). Width is shared across the
 * columns. Height is shared down each column. `direction` still chooses
 * where a column begins: `asc` at the top, `desc` at the bottom.
 * When `rows` is set, the slot cap is `columns * rows`. Callers that pass
 * only `maxAmount` keep that cap, and the row count is derived from it.
 * `fitGap` is a gap aim in heat cells. Omit it to keep the shared 10-cell aim.
 */
class HmVerticalTableAmountIndicator extends HmVerticalAmountIndicator {
    static PROP_TABS = [
        {
            id: 'place',
            label: 'PLACE',
            rows: HmVerticalAmountIndicator.PROP_TABS[0].rows.concat([
                { key: 'columns', label: 'COLUMNS', decimals: 0 },
                { key: 'rows', label: 'ROWS', decimals: 0 }
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
        const explicitRows = ownedTableRows(opts.rows);
        if (explicitRows) {
            opts.columns = amountIndicatorColumns(opts.columns, 2, AMOUNT_INDICATOR_CAP);
            opts.rows = explicitRows;
            opts.maxAmount = tableGridCap(opts.columns, explicitRows);
        }
        super(heatMap, opts);
        this.rows = explicitRows || null;
    }

    layoutItems() {
        layoutAmountTable(this);
    }

    rowCount() {
        if (this.rows != null) {
            return this.rows;
        }
        return Math.max(1, Math.ceil(this.maxAmount / Math.max(1, this.columns)));
    }

    get params() {
        const values = super.params;
        values.columns = this.columns;
        values.rows = this.rowCount();
        return values;
    }

    set(key, value) {
        if (key === 'columns') {
            if (this.rows != null) {
                this.columns = amountIndicatorColumns(value, this.columns, AMOUNT_INDICATOR_CAP);
                this.applyOwnedGrid();
                return this.columns;
            }
            this.columns = amountIndicatorColumns(value, this.columns, this.maxAmount);
            this.layoutItems();
            return this.columns;
        }
        if (key === 'rows') {
            this.rows = amountIndicatorColumns(value, this.rowCount(), AMOUNT_INDICATOR_CAP);
            this.applyOwnedGrid();
            return this.rows;
        }
        return super.set(key, value);
    }

    nudgeParam(key, dir) {
        if (key === 'columns') {
            return this.set('columns', this.columns + dir);
        }
        if (key === 'rows') {
            return this.set('rows', this.rowCount() + dir);
        }
        return super.nudgeParam(key, dir);
    }

    applyOwnedGrid() {
        this.setMaxAmount(tableGridCap(this.columns, this.rows));
    }

    setMaxAmount(value) {
        if (this.rows == null) {
            const next = super.setMaxAmount(value);
            this.columns = amountIndicatorColumns(this.columns, 1, this.maxAmount);
            this.layoutItems();
            return next;
        }
        const requested = Math.max(1, amountIndicatorCount(value, this.maxAmount, AMOUNT_INDICATOR_CAP));
        this.rows = Math.max(1, Math.ceil(requested / Math.max(1, this.columns)));
        const next = super.setMaxAmount(tableGridCap(this.columns, this.rows));
        this.layoutItems();
        return next;
    }

    extendSerialized(data) {
        const saved = super.extendSerialized(data);
        saved.columns = this.columns;
        if (this.rows != null) {
            saved.rows = this.rows;
        }
        if (this.fitGap != null) {
            saved.fitGap = this.fitGap;
        }
        return saved;
    }

    applySerialized(data) {
        const savedRows = data && typeof data.rows === 'number' ? data.rows : null;
        if (data && typeof data.fitGap === 'number' && Number.isFinite(data.fitGap) && data.fitGap >= 0) {
            this.fitGap = data.fitGap;
        }
        if (data && typeof data.columns === 'number') {
            this.columns = amountIndicatorColumns(data.columns, this.columns, AMOUNT_INDICATOR_CAP);
        }
        super.applySerialized(data);
        if (savedRows != null) {
            this.rows = amountIndicatorColumns(savedRows, 1, AMOUNT_INDICATOR_CAP);
            if (typeof data.columns === 'number') {
                this.columns = amountIndicatorColumns(data.columns, this.columns, AMOUNT_INDICATOR_CAP);
            }
            this.applyOwnedGrid();
            return;
        }
        this.rows = null;
        this.columns = amountIndicatorColumns(this.columns, 1, this.maxAmount);
        this.layoutItems();
    }
}

function ownedTableRows(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return null;
    }
    return amountIndicatorColumns(value, 1, AMOUNT_INDICATOR_CAP);
}

function tableGridCap(columns, rows) {
    return Math.max(1, Math.min(AMOUNT_INDICATOR_CAP, columns * rows));
}

heatRegisterComposite('verticalTableAmountIndicator', {
    create(heatMap, overrides) {
        return new HmVerticalTableAmountIndicator(heatMap, overrides);
    }
});
