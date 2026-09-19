/**
 * ClassicGameScene
 * Classic RPS. Size is unused; GO sends size 0.
 */
class ClassicGameScene extends GamePlayScene {
    constructor() {
        super({ key: 'ClassicGameScene' });
    }

    onPrepareMove(moveType) {
        const user = this.requirePlayContext();
        if (!user) return;
        this.setCurrentAction(this.buildMoveAction(user.id, moveType, 0));
    }
}
