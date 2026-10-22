/**
 * HmSkinnedCoreButton
 * A skinned button whose heat map holds a core.
 * The round and the circle share the center. Four balls sit on the square's corners.
 * The preset ring is 60 cells. Scaled, it matches the stone's 24-cell orbit on this face.
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
    }
    const ball = core.ball ? core.ball.serialize() : null;
    if (ball) {
        hmScaleCorePose(ball.params, ['radius', 'orbitRadius'], scale);
        core.ball.applySerialized(ball);
    }
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
            center: {
                col: (field.cols - 1) / 2,
                row: (field.rows - 1) / 2
            }
        });
        hmFitCoreLengths(this.core, 40 * HM_SKINNED_LENGTH_SCALE / 60);
        while (this.core.balls().length < 4) {
            if (!this.core.addItem({ animate: false })) {
                break;
            }
        }
        hmSeatCoreBalls(this.core);
    }
}
