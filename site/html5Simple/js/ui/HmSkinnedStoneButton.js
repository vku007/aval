/**
 * HmSkinnedStoneButton
 * A skinned button whose heat map holds a stone of three balls.
 */
class HmSkinnedStoneButton extends HmSkinnedButton {
    installComposite(opts) {
        const field = this.heatMap.field;
        this.stone = createComposite('stone', this.heatMap, {
            name: 'Stone',
            center: {
                col: (field.cols - 1) / 2,
                row: (field.rows - 1) / 2
            }
        });
        if (typeof opts.ballRadius === 'number') {
            this.stone.ballInit.radius = opts.ballRadius;
        }
        if (typeof opts.ballHeat === 'number') {
            this.stone.ballInit.energy = opts.ballHeat;
        }
        for (let i = 0; i < 3; i += 1) {
            this.stone.addItem({ animate: false });
        }
    }
}
