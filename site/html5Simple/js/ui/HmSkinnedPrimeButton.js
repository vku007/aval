/**
 * HmSkinnedPrimeButton
 * A skinned button whose heat map holds a prime.
 * The circle matches the core button. A cycling round fills that circle.
 * One cycling round item shares that center.
 * The preset ring is 60 cells. Scaled, it matches the stone's 24-cell orbit on this face.
 */
function hmFitPrimeLengths(prime, scale) {
    hmFitCoreLengths(prime, scale);
    const item = prime.item ? prime.item.serialize() : null;
    if (!item) {
        return;
    }
    hmScaleCorePose(item.from, ['radius'], scale);
    hmScaleCorePose(item.to, ['radius'], scale);
    prime.item.applySerialized(item);
}

class HmSkinnedPrimeButton extends HmSkinnedButton {
    installComposite() {
        const field = this.heatMap.field;
        this.prime = new UiPrime(this.heatMap, {
            name: 'Prime',
            animate: false,
            center: {
                col: (field.cols - 1) / 2,
                row: (field.rows - 1) / 2
            }
        });
        hmFitPrimeLengths(this.prime, 40 * HM_SKINNED_LENGTH_SCALE / 60);
    }
}
