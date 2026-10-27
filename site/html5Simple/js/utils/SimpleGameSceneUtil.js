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
    static formatMoveLabel(move, options) {
        if (!move) {
            return '—';
        }
        const type = move.context?.moveType || '—';
        const size = move.context?.size;
        const showZero = !!(options && options.showZero);
        let label = typeof size === 'number' && (size > 0 || (showZero && size === 0))
            ? `${type} ${size}`
            : String(type);
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
    static getLastSubRoundStage(gameData, currentUserId, options) {
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
            playerMove: this.formatMoveLabel(playerMove, options),
            enemyMove: this.formatMoveLabel(enemyMove, options),
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

    /**
     * Largest throw of this type for the loaded extended game.
     * Falls back to the server defaults until gameContext is present.
     * @param {object} gameData
     * @param {string} moveType Stone | Paper | Scissors
     * @returns {number}
     */
    static turnCap(gameData, moveType) {
        const defaults = { Stone: 9, Scissors: 4, Paper: 7 };
        const fields = {
            Stone: 'max_stone_per_turn',
            Scissors: 'max_scissors_per_turn',
            Paper: 'max_paper_per_turn'
        };
        const field = fields[moveType];
        const raw = field && gameData && gameData.payload && gameData.payload.gameContext
            ? gameData.payload.gameContext[field]
            : undefined;
        if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 1) {
            return raw;
        }
        return defaults[moveType] || 9;
    }

    /**
     * Finished-match summary for the advanced results scene.
     * Rounds are finished rounds. Items and effects are what this player spent.
     * @param {object} gameData
     * @param {string} currentUserId
     * @returns {{ winner: string, playerScore: number, enemyScore: number, rounds: number, items: object, enemyItems: object, effects: object }}
     */
    static summarizeAdvancedResult(gameData, currentUserId) {
        const scores = this.calculateScore(gameData, currentUserId);
        let winner = 'draw';
        if (currentUserId && scores.playerScore !== scores.enemyScore) {
            winner = scores.playerScore > scores.enemyScore ? 'you' : 'enemy';
        }
        const spend = this.playerSpend(gameData, currentUserId);
        const enemy = this.enemySpend(gameData, currentUserId);
        return {
            winner,
            playerScore: scores.playerScore,
            enemyScore: scores.enemyScore,
            rounds: this.finishedRoundCount(gameData),
            items: spend.items,
            enemyItems: enemy.items,
            effects: spend.effects
        };
    }

    /**
     * @param {object} gameData
     * @returns {number}
     */
    static finishedRoundCount(gameData) {
        const rounds = gameData?.payload?.playerContext?.roundStates || [];
        return rounds.filter((round) => {
            const status = String((round && round.status) || '').toLowerCase();
            return status === 'finished' || status === 'done' || status === 'completed';
        }).length;
    }

    /**
     * Stones, scissors, papers, and effects removed from this player's inventory.
     * @param {object} gameData
     * @param {string} currentUserId
     * @returns {{ items: object, effects: object }}
     */
    static playerSpend(gameData, currentUserId) {
        return this.spendFor(gameData, currentUserId, 'player');
    }

    /**
     * Stones, scissors, and papers the other side spent.
     * @param {object} gameData
     * @param {string} currentUserId
     * @returns {{ items: object, effects: object }}
     */
    static enemySpend(gameData, currentUserId) {
        return this.spendFor(gameData, currentUserId, 'enemy');
    }

    /**
     * @param {object} gameData
     * @param {string} currentUserId
     * @param {'player'|'enemy'} side
     * @returns {{ items: object, effects: object }}
     */
    static spendFor(gameData, currentUserId, side) {
        const items = { stones: 0, scissors: 0, papers: 0, total: 0 };
        const effects = {
            NA_effect_stone: 0,
            NA_effect_scissors: 0,
            NA_effect_papers: 0,
            NT_effect: 0,
            total: 0
        };
        if (!gameData || currentUserId == null || currentUserId === '') {
            return { items, effects };
        }
        const itemKey = { Stone: 'stones', Scissors: 'scissors', Paper: 'papers' };
        const naKey = {
            Stone: 'NA_effect_stone',
            Scissors: 'NA_effect_scissors',
            Paper: 'NA_effect_papers'
        };
        const userId = String(currentUserId);
        const wantPlayer = side !== 'enemy';
        const rounds = gameData.payload?.playerContext?.roundStates || [];
        rounds.forEach((round) => {
            (round.subRoundStates || []).forEach((sub) => {
                (sub.moves || []).forEach((move) => {
                    if (!move || (String(move.userId) === userId) !== wantPlayer) {
                        return;
                    }
                    const context = move.context || {};
                    const key = itemKey[context.moveType];
                    const size = typeof context.size === 'number' && context.size > 0
                        ? Math.trunc(context.size)
                        : 0;
                    if (key && size > 0) {
                        items[key] += size;
                        items.total += size;
                    }
                    (context.effects || []).forEach((effect) => {
                        const kind = effect && effect.kind;
                        if (kind === 'NegateSize' || kind === 'Overpower') {
                            const na = naKey[context.moveType];
                            if (!na) {
                                return;
                            }
                            effects[na] += 1;
                            effects.total += 1;
                            return;
                        }
                        if (kind === 'Protection' || kind === 'SizeOnly') {
                            effects.NT_effect += 1;
                            effects.total += 1;
                        }
                    });
                });
            });
        });
        return { items, effects };
    }

    /**
     * Finished advanced match for the choose-game RESULTS button.
     * Scores, items, and effects follow the current player id.
     * @param {string} playerId
     * @returns {object}
     */
    static finishedAdvancedGameStub(playerId) {
        const you = playerId != null && playerId !== '' ? String(playerId) : 'you';
        const enemy = 'npc';
        const move = (userId, moveType, size, effects) => ({
            userId,
            context: { moveType, size, effects: effects || [] }
        });
        return {
            payload: {
                gameContext: { status: 'finished' },
                enemyContext: { name: 'Rival' },
                playerContext: {
                    roundStates: [
                        {
                            status: 'finished',
                            winnerId: you,
                            subRoundStates: [
                                {
                                    status: 'done',
                                    moves: [
                                        move(you, 'Stone', 2, [{ kind: 'NegateSize' }]),
                                        move(enemy, 'Stone', 2, [])
                                    ]
                                },
                                {
                                    status: 'done',
                                    winnerId: you,
                                    moves: [
                                        move(you, 'Scissors', 3, [{ kind: 'SizeOnly' }]),
                                        move(enemy, 'Paper', 4, [])
                                    ]
                                }
                            ]
                        },
                        {
                            status: 'finished',
                            winnerId: enemy,
                            subRoundStates: [
                                {
                                    status: 'done',
                                    winnerId: enemy,
                                    moves: [
                                        move(you, 'Paper', 1, [{ kind: 'Overpower' }]),
                                        move(enemy, 'Scissors', 1, [])
                                    ]
                                }
                            ]
                        },
                        {
                            status: 'finished',
                            winnerId: you,
                            subRoundStates: [
                                {
                                    status: 'done',
                                    winnerId: you,
                                    moves: [
                                        move(you, 'Stone', 4, []),
                                        move(enemy, 'Scissors', 2, [])
                                    ]
                                }
                            ]
                        }
                    ]
                }
            }
        };
    }
}
