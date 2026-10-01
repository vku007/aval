/**
 * createItem / createComposite
 * Names match the step-1 configs. Constructors stay the editor classes.
 */
const HEAT_COMPOSITE_SPECS = {};

function heatRegisterComposite(name, spec) {
    HEAT_COMPOSITE_SPECS[name] = spec;
    return spec;
}

function resolveHeatMap(fieldOrMap) {
    if (!fieldOrMap) {
        return null;
    }
    if (fieldOrMap.field && typeof fieldOrMap.addBall === 'function') {
        return fieldOrMap;
    }
    if (fieldOrMap.heatMap) {
        return fieldOrMap.heatMap;
    }
    if (typeof fieldOrMap.addBall === 'function' && typeof fieldOrMap.cols === 'number') {
        const field = fieldOrMap;
        return {
            field: field,
            scene: field.scene || null,
            addBall: (item) => field.addBall(item),
            removeBall: (item) => field.removeBall(item),
            addRod: (item) => field.addRod(item),
            removeRod: (item) => field.removeRod(item),
            addHighlighter: (item) => field.addHighlighter(item),
            removeHighlighter: (item) => field.removeHighlighter(item)
        };
    }
    return null;
}

function createItem(name, fieldOrMap, fields) {
    const heatMap = resolveHeatMap(fieldOrMap);
    const values = fields || {};
    if (!heatMap) {
        return null;
    }
    if (name === 'hot-ball') {
        return new UiHotBall(heatMap, { params: values });
    }
    if (name === 'hot-rod') {
        return new UiHotRod(heatMap, { params: values });
    }
    if (name === 'heat-rect' || name === 'back-highlight') {
        return new UiBackHighlighter(heatMap, values);
    }
    if (name === 'shard') {
        return new UiShard(heatMap, values);
    }
    if (name === 'sheet' || name === 'heat-sheet') {
        return new UiSheet(heatMap, values);
    }
    if (name === 'disk' || name === 'new-sheet' || name === 'heat-disk') {
        return new UiNewSheet(heatMap, Object.assign({ ownField: false }, values));
    }
    return null;
}

function createComposite(name, fieldOrMap, overrides) {
    const spec = HEAT_COMPOSITE_SPECS[name];
    const heatMap = resolveHeatMap(fieldOrMap);
    if (!spec || typeof spec.create !== 'function' || !heatMap) {
        return null;
    }
    return spec.create(heatMap, overrides || {});
}
