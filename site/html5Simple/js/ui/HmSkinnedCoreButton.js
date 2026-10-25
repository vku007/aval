/**
 * HmSkinnedCoreButton
 * A skinned button whose heat map holds a core.
 * The round and the circle share the center. Four balls sit on the square's corners.
 * The round stays at heat 0, so it does not flash when the button appears.
 * The preset ring is 48 cells. Scaled to half this face, it matches Go and Cancel.
 */
function hmScaleCorePose(pose, keys, scale) {
    if (!pose) {
        return;
    }
    keys.forEach((key) => {
        if (typeof pose[key] === 'number') {
            pose[key] *= scale;
        }
    });
}

function hmFitCoreLengths(core, scale) {
    const circle = core.circle ? core.circle.serialize() : null;
    if (circle) {
        hmScaleCorePose(circle.from, ['outer', 'inner'], scale);
        hmScaleCorePose(circle.to, ['outer', 'inner'], scale);
        core.circle.applySerialized(circle);
    }
    const round = core.round ? core.round.serialize() : null;
    if (round) {
        hmScaleCorePose(round.from, ['radius'], scale);
        hmScaleCorePose(round.to, ['radius'], scale);
        core.round.applySerialized(round);
        if (typeof core.fadeRound === 'function') {
            hmHoldRoundHeat(core.round, 0);
        }
    }
    const ball = core.ball ? core.ball.serialize() : null;
    if (ball) {
        hmScaleCorePose(ball.params, ['radius', 'orbitRadius'], scale);
        core.ball.applySerialized(ball);
    }
}

function hmHoldRoundHeat(round, heat) {
    if (!round || typeof round.play !== 'function') {
        return null;
    }
    round.define('quiet', set({ heat: heat }, {
        slot: 'life',
        fill: 'hold'
    }));
    const run = round.play('quiet');
    if (run && typeof run.finish === 'function') {
        run.finish();
    }
    return run;
}

function hmSeatCoreBalls(core) {
    const balls = core.balls();
    core.ballTargets(balls.length).forEach((to, index) => {
        const run = core.slideBall(balls[index], to);
        if (run && typeof run.finish === 'function') {
            run.finish();
        }
    });
}

class HmSkinnedCoreButton extends HmSkinnedButton {
    installComposite() {
        const field = this.heatMap.field;
        this.core = new UiCore(this.heatMap, {
            name: 'Core',
            animate: false,
            center: {
                col: (field.cols - 1) / 2,
                row: (field.rows - 1) / 2
            }
        });
        hmFitCoreLengths(this.core, (HM_SKINNED_HEAT_SIZE / 2) / 48);
        while (this.core.balls().length < 4) {
            if (!this.core.addItem({ animate: false })) {
                break;
            }
        }
        hmSeatCoreBalls(this.core);
    }
}
