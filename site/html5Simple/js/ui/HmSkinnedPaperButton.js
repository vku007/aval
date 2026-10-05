/**
 * HmSkinnedPaperButton
 * A skinned button whose heat map holds a New Paper stack of three disks.
 */
class HmSkinnedPaperButton extends HmSkinnedButton {
    installComposite(opts) {
        const field = this.heatMap.field;
        this.paper = createComposite('diskStack', this.heatMap, {
            name: 'New Paper',
            center: {
                col: (field.cols - 1) / 2,
                row: (field.rows - 1) / 2 + 20 * HM_SKINNED_LENGTH_SCALE
            }
        });
        const scale = HM_SKINNED_LENGTH_SCALE;
        this.paper.distance = 14 * scale;
        this.paper.sheetInit.radFrom = 24 * scale;
        this.paper.sheetInit.radTo = 36 * scale;
        this.paper.sheetInit.ballRadius = 40 * scale;
        this.paper.sheetInit.ballSize = 3.2 * scale;
        const count = opts.sheetCount != null ? opts.sheetCount : 3;
        for (let i = 0; i < count; i += 1) {
            this.paper.addItem({ animate: false });
        }
    }
}
