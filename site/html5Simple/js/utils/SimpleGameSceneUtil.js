/**
 * SimpleGameSceneUtil
 * Utility functions for SimpleGameScene
 */

class SimpleGameSceneUtil {
    /**
     * Calculate score from game data
     * @param {object} gameData - The game data object
     * @param {string} currentUserId - The current user's ID
     * @returns {object} Object with playerScore and enemyScore
     */
    static calculateScore(gameData, currentUserId) {
        console.log('[SimpleGameSceneUtil] calculateScore() called with userId:', currentUserId);
        
        let playerScore = 0;
        let enemyScore = 0;
        
        if (!gameData) {
            console.warn('[SimpleGameSceneUtil] No game data provided');
            return { playerScore, enemyScore };
        }
        
        if (!currentUserId) {
            console.warn('[SimpleGameSceneUtil] No userId provided');
            return { playerScore, enemyScore };
        }
        
        // Check if we have playerContext with roundStates
        if (gameData.payload?.playerContext?.roundStates) {
            const roundStates = gameData.payload.playerContext.roundStates;
            
            // Count wins based on winnerId in completed rounds
            console.log('[SimpleGameSceneUtil] Total rounds:', roundStates.length);
            console.log('[SimpleGameSceneUtil] Current userId:', currentUserId);
            
            roundStates.forEach((round, index) => {
                console.log(`[SimpleGameSceneUtil] Round ${index}:`, {
                    status: round.status,
                    winnerId: round.winnerId,
                    result: round.result,
                    fullRound: round
                });
                
                // Check if round is finished (status could be 'done', 'finished', or 'completed')
                const isFinished = round.status === 'done' || 
                                  round.status === 'finished' || 
                                  round.status === 'completed';
                
                // Only count rounds that are finished and have a winner
                if (isFinished && round.winnerId) {
                    console.log(`[SimpleGameSceneUtil] Round ${index} is finished with winnerId:`, round.winnerId);
                    console.log(`[SimpleGameSceneUtil] Comparing winnerId (${round.winnerId}) with currentUserId (${currentUserId})`);
                    console.log(`[SimpleGameSceneUtil] Types: winnerId is ${typeof round.winnerId}, userId is ${typeof currentUserId}`);
                    
                    // Convert both to strings for comparison to handle type mismatches
                    const winnerIdStr = String(round.winnerId);
                    const userIdStr = String(currentUserId);
                    
                    console.log(`[SimpleGameSceneUtil] String comparison: "${winnerIdStr}" === "${userIdStr}"?`, winnerIdStr === userIdStr);
                    
                    if (winnerIdStr === userIdStr) {
                        playerScore++;
                        console.log(`[SimpleGameSceneUtil] Round ${index}: Player wins! Score now: ${playerScore} - ${enemyScore}`);
                    } else {
                        enemyScore++;
                        console.log(`[SimpleGameSceneUtil] Round ${index}: Enemy wins! Score now: ${playerScore} - ${enemyScore}`);
                    }
                } else {
                    console.log(`[SimpleGameSceneUtil] Round ${index} skipped - status: ${round.status}, winnerId: ${round.winnerId}, isFinished: ${isFinished}`);
                }
            });
            
            console.log('[SimpleGameSceneUtil] Score calculated:', playerScore, '-', enemyScore);
        } else {
            console.warn('[SimpleGameSceneUtil] No roundStates found in game data');
        }
        
        return { playerScore, enemyScore };
    }
    
    /**
     * Get enemy name from game data
     * @param {object} gameData - The game data object
     * @returns {string} Enemy name or default
     */
    static getEnemyName(gameData) {
        if (!gameData) {
            return 'Enemy';
        }
        
        if (gameData.payload?.enemyContext?.name) {
            return gameData.payload.enemyContext.name;
        }
        
        // Default for AI opponent
        return 'AI Opponent';
    }
    
    /**
     * Get game status from game data
     * @param {object} gameData - The game data object
     * @returns {string} Game status
     */
    static getGameStatus(gameData) {
        if (!gameData) {
            return 'Unknown';
        }
        
        // Get status from gameContext
        return gameData.payload?.gameContext?.status || gameData.status || 'Unknown';
    }
    
    /**
     * Check if game is finished
     * @param {object} gameData - The game data object
     * @returns {boolean} True if game is finished
     */
    static isGameFinished(gameData) {
        if (!gameData) {
            return false;
        }
        
        // Check gameContext status
        const gameContextStatus = gameData.payload?.gameContext?.status?.toLowerCase();
        console.log('[SimpleGameSceneUtil] Checking if game is finished - gameContext.status:', gameContextStatus);
        
        const isFinished = gameContextStatus === 'finished' || 
                          gameContextStatus === 'completed' || 
                          gameContextStatus === 'ended';
        
        console.log('[SimpleGameSceneUtil] Game is finished?', isFinished);
        return isFinished;
    }
}
