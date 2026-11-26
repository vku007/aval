const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { runInNewContext } = require('node:vm');

function load() {
    const context = { console };
    const source = readFileSync(path.join(__dirname, 'authFields.js'), 'utf8');
    runInNewContext(source, context, { filename: 'authFields.js' });
    return context;
}

test('gameRectToCss maps a centered field onto the canvas', () => {
    const { gameRectToCss } = load();
    const css = gameRectToCss(
        { left: 10, top: 20, width: 390, height: 844 },
        390,
        844,
        195,
        422,
        100,
        54
    );
    assert.deepEqual({ ...css }, {
        left: 10 + (195 - 50),
        top: 20 + (422 - 27),
        width: 100,
        height: 54,
        radius: 12,
        pad: 16
    });
});

test('gameRectToCss scales when the canvas is half the game size', () => {
    const { gameRectToCss } = load();
    const css = gameRectToCss(
        { left: 0, top: 0, width: 195, height: 422 },
        390,
        844,
        195,
        100,
        310,
        54
    );
    assert.equal(css.left, (195 - 155) * 0.5);
    assert.equal(css.top, (100 - 27) * 0.5);
    assert.equal(css.width, 155);
    assert.equal(css.height, 27);
    assert.equal(css.radius, 6);
    assert.equal(css.pad, 8);
});
