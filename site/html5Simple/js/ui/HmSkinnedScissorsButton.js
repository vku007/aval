/**
 * HmSkinnedScissorsButton
 * A skinned button whose heat map holds a scissor of two shards.
 */
class HmSkinnedScissorsButton extends HmSkinnedButton {
    installComposite(opts) {
        const field = this.heatMap.field;
        this.scissor = createComposite('scissor', this.heatMap, {
            name: 'Scissor',
            center: {
                col: (field.cols - 1) / 2,
                row: (field.rows - 1) / 2
            }
        });
        const scale = HM_SKINNED_LENGTH_SCALE;
        this.scissor.shardInit.from.width *= scale;
        this.scissor.shardInit.from.height = 12 * scale;
        this.scissor.shardInit.to.width *= scale;
        this.scissor.shardInit.to.height = 8 * scale;
        const count = opts.shardCount != null ? opts.shardCount : 2;
        for (let i = 0; i < count; i += 1) {
            this.scissor.addItem({ animate: false });
        }
    }
}
