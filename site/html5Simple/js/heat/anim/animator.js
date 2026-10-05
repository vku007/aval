/**
 * Plays named transitions on a node. The field tick calls heatAdvanceRuns
 * after behaviours and before stamp. List edits stay deferred until the stamp loop ends.
 */
var HEAT_TICK_GEN = 0;
var HEAT_TICK_DEPTH = 0;

function heatEnterTick() {
    if (HEAT_TICK_DEPTH === 0) {
        HEAT_TICK_GEN += 1;
    }
    HEAT_TICK_DEPTH += 1;
}

function heatLeaveTick() {
    HEAT_TICK_DEPTH = Math.max(0, HEAT_TICK_DEPTH - 1);
}

function heatDt(delta) {
    const ms = typeof delta === 'number' ? delta : 0;
    return Math.min(Math.max(0, ms) / 1000, 0.05);
}

function heatSettledRun(status) {
    const run = {
        status: status,
        time: 0,
        duration: 0,
        finished: Promise.resolve({ status: status }),
        _settled: true
    };
    run.pause = function pause() { return run; };
    run.resume = function resume() { return run; };
    run.seek = function seek() { return run; };
    run.finish = function finish() { return run; };
    run.cancel = function cancel() { return run; };
    return run;
}

function heatDeadRun() {
    return heatSettledRun('cancelled');
}

function heatDoneRun() {
    return heatSettledRun('finished');
}

/**
 * Resolves finished when every run has. One cancelled child cancels the join.
 * `extras` may be filled before `lead` resolves, as a shatter hook does.
 */
function heatFollowRuns(lead, extras) {
    if (!lead || !lead.finished) {
        return heatDeadRun();
    }
    const finished = lead.finished.then((result) => {
        if (!result || result.status !== 'finished') {
            return result || { status: 'cancelled' };
        }
        const rest = (extras || []).filter((run) => run && run.finished);
        if (!rest.length) {
            return result;
        }
        return Promise.all(rest.map((run) => run.finished)).then((results) => ({
            status: results.every((item) => item && item.status === 'finished')
                ? 'finished'
                : 'cancelled'
        }));
    });
    return { finished: finished };
}

function heatJoinRuns(runs) {
    const list = (runs || []).filter((run) => run && run.finished);
    if (!list.length) {
        const empty = heatDoneRun();
        empty.removed = 0;
        return empty;
    }
    const finished = Promise.all(list.map((run) => run.finished)).then((results) => ({
        status: results.every((result) => result && result.status === 'finished')
            ? 'finished'
            : 'cancelled'
    }));
    return { finished: finished, removed: list.length };
}

function heatDramaGap() {
    return 0.33;
}

/**
 * Starts each function 0.33 s after the previous one, on the field clock.
 * The returned run finishes when the stagger and every returned drama run finish.
 */
function heatStaggerDramas(node, starts) {
    const list = starts || [];
    if (!node || node.detached || !node.attached) {
        const dead = heatDeadRun();
        dead.removed = 0;
        return dead;
    }
    if (!list.length) {
        return heatJoinRuns([]);
    }
    const dramas = [];
    const parts = [];
    list.forEach((_, index) => {
        if (index) {
            parts.push(wait(heatDramaGap()));
        }
        parts.push(call('drama-one'));
    });
    node.define('drama-stagger', sequence(parts, {
        slot: 'life',
        policy: 'replace',
        fill: 'none'
    }));
    let cursor = 0;
    const run = node.play('drama-stagger', {
        hooks: {
            'drama-one': () => {
                const start = list[cursor];
                cursor += 1;
                const drama = typeof start === 'function' ? start() : null;
                if (drama && drama.finished) {
                    dramas.push(drama);
                }
            }
        }
    });
    const followed = heatFollowRuns(run, dramas);
    followed.removed = list.length;
    return followed;
}

/**
 * A wait on the field clock. Scene shutdown destroys the field, which
 * cancels this run. Nothing here uses scene timers.
 */
function heatFieldWait(field, seconds) {
    if (!field || field.destroyed || typeof field.addRoot !== 'function') {
        return heatDeadRun();
    }
    const node = new HeatNode({ kind: 'wait', name: 'wait', field: field });
    field.addRoot(node);
    if (!node.attached) {
        return heatDeadRun();
    }
    node.define('hold', wait(seconds, { slot: 'life', policy: 'replace', fill: 'none' }));
    const run = node.play('hold');
    run.finished.then(() => {
        if (!node.detached) {
            node.detach();
        }
    });
    return run;
}

function heatSlot(node, name) {
    if (!node._slots[name]) {
        node._slots[name] = { active: null, queue: [] };
    }
    return node._slots[name];
}

function heatSlotBusy(slot) {
    if (!slot || !slot.active) {
        return false;
    }
    return slot.active.status === 'running' || slot.active.status === 'paused';
}

function cloneRunValues(values) {
    const out = {};
    if (!values) {
        return out;
    }
    Object.keys(values).forEach((name) => {
        out[name] = cloneHeatValue(name, values[name]);
    });
    return out;
}

function heatCommit(node, values) {
    if (!node.fields) {
        node.fields = {};
    }
    Object.keys(values || {}).forEach((name) => {
        node.fields[name] = cloneHeatValue(name, values[name]);
    });
    if (typeof node.applyCommitted === 'function') {
        node.applyCommitted(values || {});
    }
}

function heatInvoke(node, name, ctx) {
    if (name === 'detach') {
        if (node && typeof node.detach === 'function') {
            node.detach();
        }
        return;
    }
    const hooks = ctx && ctx.hooks;
    const fn = hooks && hooks[name];
    if (typeof fn === 'function') {
        fn(node, ctx);
    }
}

function heatPromote(node, run, endValues) {
    const slot = node && node._slots[run.slotName];
    if (!slot || slot.active !== run) {
        return;
    }
    const next = slot.queue.shift();
    if (!next) {
        slot.active = run.fill === 'hold' ? run : null;
        return;
    }
    if (node.channels) {
        node.channels.clear(run.id);
    }
    slot.active = next;
    next._begin(endValues || {});
}

function heatClearSlot(node, slotName) {
    const slot = node._slots[slotName];
    if (!slot) {
        return null;
    }
    const current = slot.active && slot.active.lastValues
        ? cloneRunValues(slot.active.lastValues)
        : null;
    if (slot.active) {
        slot.active._drop();
    }
    slot.queue.slice().forEach((run) => run._drop());
    slot.queue = [];
    slot.active = null;
    return current;
}

function heatDefine(node, name, definition) {
    node.definitions[name] = definition;
    return node;
}

function heatPlay(node, nameOrDef, ctx) {
    const label = typeof nameOrDef === 'string' ? nameOrDef : (nameOrDef && nameOrDef.slot) || 'transition';
    if (!node || node.detached || !node.attached) {
        console.warn('Heat play on a detached node', label);
        return heatDeadRun();
    }
    const definition = typeof nameOrDef === 'string' ? node.definitions[nameOrDef] : nameOrDef;
    if (!definition || !definition.block) {
        console.warn('Heat play missing transition', label);
        return heatDeadRun();
    }
    const slotName = definition.slot || 'life';
    const policy = definition.policy || 'replace';
    const slot = heatSlot(node, slotName);
    if (heatSlotBusy(slot) && policy === 'ignore') {
        return slot.active;
    }
    const run = new HeatRun(node, definition, ctx || {});
    node._runs.push(run);
    if (heatSlotBusy(slot) && policy === 'queue') {
        slot.queue.push(run);
        return run;
    }
    let current = null;
    if (slot.active && slot.active.lastValues) {
        current = cloneRunValues(slot.active.lastValues);
    }
    if (heatSlotBusy(slot)) {
        heatClearSlot(node, slotName);
    } else if (slot.active && slot.active.status === 'finished') {
        if (node.channels) {
            node.channels.clear(slot.active.id);
        }
        slot.active = null;
    }
    heatSlot(node, slotName).active = run;
    run._begin(current);
    return run;
}

function heatCancelAll(node) {
    const runs = (node._runs || []).slice();
    node._slots = {};
    node._runs = [];
    runs.forEach((run) => {
        (run._children || []).forEach((child) => {
            if (child && typeof child._drop === 'function') {
                child._drop();
            }
        });
        if (typeof run._drop === 'function') {
            run._drop();
        }
    });
    if (node.channels) {
        node.channels.clear();
    }
    return node;
}

function heatAdvanceRuns(node, delta) {
    const dt = heatDt(delta);
    const live = (node._runs || []).filter((run) => run.status === 'running');
    live.forEach((run) => run._step(dt));
    const done = (node._runs || []).filter((run) => run._pendingDone);
    done.forEach((run) => run._complete());
}
