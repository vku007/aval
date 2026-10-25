/**
 * ExtendedGameScene
 * Tap a move for size 1; tap again to increment up to that type's turn cap.
 * Cancel is inactive until a type is selected. At size 1 it clears the type;
 * at size 2+ it shows MINUS and decrements size.
 */

class ExtendedGameScene extends GamePlayScene {
    constructor() {
        super({ key: 'ExtendedGameScene' });
    }

    getEffects() {
        return [
            { kind: 'NegateSize', label: 'NEG', category: 'size' },
            { kind: 'Overpower', label: 'OVER', category: 'size' },
            { kind: 'Protection', label: 'PROT', category: 'type' },
            { kind: 'SizeOnly', label: 'SIZE', category: 'type' }
        ];
    }

    formatReadyStatus(action) {
        const moveType = action?.context?.move?.context?.moveType || 'Unknown';
        const size = action?.context?.move?.context?.size;
        return `${moveType} ${size} ready — tap GO`;
    }

    formatSendingStatus(action) {
        const moveType = action?.context?.move?.context?.moveType || 'Unknown';
        const size = action?.context?.move?.context?.size;
        return `Sending ${moveType} ${size}...`;
    }

    getCancelButtonLabel() {
        const size = this.sceneState.currentAction?.context?.move?.context?.size || 0;
        return size > 1 ? 'MINUS' : 'CANCEL';
    }

    updateMoveSelection() {
        if (!this.actionButtons) return;
        const moveType = this.sceneState.currentAction?.context?.move?.context?.moveType;
        const size = this.sceneState.currentAction?.context?.move?.context?.size;
        this.actionButtons.forEach((btn) => {
            if (btn.moveType) {
                const selected = !!moveType && btn.moveType === moveType;
                fxSelectMove(btn, selected);
                if (btn.buttonText) {
                    btn.buttonText.setText(selected ? `${btn.baseLabel} ${size}` : btn.baseLabel);
                }
            }
        });
    }

    onPrepareMove(moveType) {
        const user = this.requirePlayContext();
        if (!user) return;

        const cap = SimpleGameSceneUtil.turnCap(this.gameData, moveType);
        if (cap < 1) {
            this.showErrorModal('Move not allowed', `${moveType} is not available this match.`);
            return;
        }
        const currentMove = this.sceneState.currentAction?.context?.move?.context;
        const sameType = currentMove?.moveType === moveType;
        if (sameType && (currentMove.size || 1) >= cap) {
            return;
        }
        const size = sameType
            ? Math.min((currentMove.size || 1) + 1, cap)
            : 1;

        this.setCurrentAction(this.buildMoveAction(user.id, moveType, size));
    }

    onCancelAction() {
        const currentMove = this.sceneState.currentAction?.context?.move?.context;
        if (!currentMove) {
            return;
        }
        if ((currentMove.size || 1) > 1) {
            currentMove.size -= 1;
            this.setCurrentAction(this.sceneState.currentAction);
            return;
        }
        this.clearCurrentAction();
    }
}
