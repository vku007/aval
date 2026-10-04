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
                row: (field.rows - 1) / 2 + 20
            }
        });
        this.paper.distance = 14;
        this.paper.sheetInit.radFrom = 24;
        this.paper.sheetInit.radTo = 36;
        this.paper.sheetInit.ballRadius = 40;
        this.paper.sheetInit.ballSize = 3.2;
        const count = opts.sheetCount != null ? opts.sheetCount : 3;
        for (let i = 0; i < count; i += 1) {
            this.paper.addItem({ animate: false });
        }
    }
}
