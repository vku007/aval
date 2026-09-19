/**
 * SimpleGameSceneUtil
 * Shared API payload helpers for play screens (score, enemy name, finished, stage).
 */

class SimpleGameSceneUtil {
    static debugLog(...args) {
        if (typeof isUiDebug === 'function' && isUiDebug()) {
            console.log(...args);
        }
    }

    /**
     * Calculate score from game data
     * @param {object} gameData - The game data object
     * @param {string} currentUserId - The current user's ID
     * @returns {object} Object with playerScore and enemyScore
     */
    static calculateScore(gameData, currentUserId) {
        this.debugLog('[SimpleGameSceneUtil] calculateScore() called with userId:', currentUserId);

        let playerScore = 0;
        let enemyScore = 0;

        if (!gameData || !currentUserId) {
            return { playerScore, enemyScore };
        }

        if (gameData.payload?.playerContext?.roundStates) {
            const roundStates = gameData.payload.playerContext.roundStates;
            roundStates.forEach((round) => {
                const isFinished = round.status === 'done' ||
                    round.status === 'finished' ||
                    round.status === 'completed';

                if (isFinished && round.winnerId) {
                    if (String(round.winnerId) === String(currentUserId)) {
                        playerScore++;
                    } else {
                        enemyScore++;
                    }
                }
            });
            this.debugLog('[SimpleGameSceneUtil] Score calculated:', playerScore, '-', enemyScore);
        }

        return { playerScore, enemyScore };
    }

    /**
     * Get enemy name from game data
     * @param {object} gameData
     * @returns {string}
     */
    static getEnemyName(gameData) {
        if (gameData?.payload?.enemyContext?.name) {
            return gameData.payload.enemyContext.name;
        }
        return 'AI Opponent';
    }

    /**
     * Get game status from game data
     * @param {object} gameData
     * @returns {string}
     */
    static getGameStatus(gameData) {
        if (!gameData) {
            return 'Unknown';
        }
        return gameData.payload?.gameContext?.status || gameData.status || 'Unknown';
    }

    /**
     * Check if game is finished
     * @param {object} gameData
     * @returns {boolean}
     */
    static isGameFinished(gameData) {
        if (!gameData) {
            return false;
        }
        const gameContextStatus = gameData.payload?.gameContext?.status?.toLowerCase();
        return gameContextStatus === 'finished' ||
            gameContextStatus === 'completed' ||
            gameContextStatus === 'ended';
    }

    /**
     * Last completed subround in the match (draws open a new empty subround).
     * @param {object} gameData
     * @returns {object|null}
     */
    static getLastCompletedSubRound(gameData) {
        const roundStates = gameData?.payload?.playerContext?.roundStates || [];
        let last = null;
        for (const round of roundStates) {
            const subs = round.subRoundStates || [];
            for (const sub of subs) {
                const status = String(sub.status || '').toLowerCase();
                if (status === 'done' && Array.isArray(sub.moves) && sub.moves.length >= 2) {
                    last = sub;
                }
            }
        }
        return last;
    }

    /**
     * @param {object} move
     * @returns {string}
     */
    static formatMoveLabel(move) {
        if (!move) {
            return '—';
        }
        const type = move.context?.moveType || '—';
        const size = move.context?.size;
        let label = typeof size === 'number' && size > 0 ? `${type} ${size}` : String(type);
        const tags = this.formatEffectTags(move);
        return tags ? `${label} ${tags}` : label;
    }

    /**
     * @param {object} move
     * @returns {string}
     */
    static formatEffectTags(move) {
        const effects = move?.context?.effects;
        if (!Array.isArray(effects) || effects.length === 0) {
            return '';
        }
        const labels = {
            NegateSize: 'NEG',
            Overpower: 'OVER',
            Protection: 'PROT',
            SizeOnly: 'SIZE'
        };
        return effects.map((effect) => labels[effect.kind] || effect.kind).filter(Boolean).join(' ');
    }

    /**
     * Stage panel view of the last completed subround.
     * @param {object} gameData
     * @param {string} currentUserId
     * @returns {{ playerMove: string, enemyMove: string, result: string, resultKind: string }}
     */
    static getLastSubRoundStage(gameData, currentUserId) {
        const empty = { playerMove: '—', enemyMove: '—', result: 'WAIT', resultKind: 'wait' };
        if (!gameData || !currentUserId) {
            return empty;
        }

        const sub = this.getLastCompletedSubRound(gameData);
        if (!sub) {
            return empty;
        }

        const userIdStr = String(currentUserId);
        const moves = sub.moves || [];
        const playerMove = moves.find((m) => String(m.userId) === userIdStr);
        const enemyMove = moves.find((m) => String(m.userId) !== userIdStr);

        let result = 'DRAW';
        let resultKind = 'draw';
        if (sub.winnerId) {
            if (String(sub.winnerId) === userIdStr) {
                result = 'YOU WIN';
                resultKind = 'win';
            } else {
                result = 'ENEMY WINS';
                resultKind = 'lose';
            }
        }

        return {
            playerMove: this.formatMoveLabel(playerMove),
            enemyMove: this.formatMoveLabel(enemyMove),
            result,
            resultKind
        };
    }

    /**
     * Player move size from the last subround that has one (extended). Classic size 0 is ignored.
     * @param {object} roundData
     * @param {string} userId
     * @returns {number|null}
     */
    static getPlayerMoveSize(roundData, userId) {
        const subs = roundData?.subRoundStates || [];
        const userIdStr = String(userId);
        for (let i = subs.length - 1; i >= 0; i--) {
            const moves = subs[i].moves || [];
            const move = moves.find((m) => String(m.userId) === userIdStr);
            if (move && move.context && typeof move.context.size === 'number' && move.context.size > 0) {
                return move.context.size;
            }
        }
        return null;
    }
}
