/**
 * GameClient - Client for game-related backend communication
 * Handles game creation, retrieval, and updates
 */

console.log('[gameClient.js] Loading GameClient module...');

class GameClient {
  constructor(gameAPI) {
    this.gameAPI = gameAPI; // Reference to GameAPI for token access
    this.baseUrl = '/apiv2/external';
    console.log('[GameClient] Constructed with baseUrl:', this.baseUrl);
  }

  /**
   * Make an authenticated API request to game endpoints
   * @param {string} path - API path (e.g., '/games', '/games/:id')
   * @param {object} options - Fetch options
   * @returns {Promise<object>} Response data
   */
  async request(path, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    // Get token from gameAPI
    const token = this.gameAPI.token;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    } else {
      console.warn('[GameClient] No authentication token available');
    }

    const url = `${this.baseUrl}${path}`;
    console.log(`[GameClient] ${options.method || 'GET'} ${url}`);

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      console.log(`[GameClient] Response status: ${response.status}`);

      // Handle non-JSON responses
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        if (!response.ok) {
          throw new APIError(`HTTP ${response.status}: ${response.statusText}`, response.status);
        }
        return { success: true };
      }

      const data = await response.json();

      if (!response.ok) {
        const message = data.detail || data.message || `HTTP ${response.status}`;
        console.error('[GameClient] Error response data:', data);
        throw new APIError(message, response.status, data);
      }

      console.log('[GameClient] Response data:', data);
      return data;
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      console.error('[GameClient] Network error:', error);
      throw new APIError(`Network error: ${error.message}`, 0);
    }
  }

  // ============ GAME ENDPOINTS ============

  /**
   * POST /apiv2/external/games
   * Create a new game
   * @param {object} gameContext - Game initialization context
   * @returns {Promise<object>} Response with status and gameId
   */
  async createGame(gameContext = {}) {
    console.log('[GameClient] createGame() called with context:', gameContext);
    
    try {
      const response = await this.request('/games', {
        method: 'POST',
        body: JSON.stringify(gameContext)
      });

      console.log('[GameClient] Game created successfully:', response);
      return response;
    } catch (error) {
      console.error('[GameClient] Failed to create game:', error);
      throw error;
    }
  }

  /**
   * GET /apiv2/external/games/:gameId
   * Get game by ID
   * @param {string} gameId - The game ID
   * @returns {Promise<object>} Response with status and game payload
   */
  async getGame(gameId) {
    console.log('[GameClient] getGame() called with gameId:', gameId);
    
    if (!gameId) {
      throw new Error('Game ID is required');
    }

    try {
      const response = await this.request(`/games/${gameId}`, {
        method: 'GET'
      });

      console.log('[GameClient] Game retrieved successfully:', response);
      return response;
    } catch (error) {
      console.error('[GameClient] Failed to get game:', error);
      throw error;
    }
  }

  /**
   * PUT /apiv2/external/games/:gameId
   * Update game with player action
   * @param {string} gameId - The game ID
   * @param {object} actionContext - Player action context
   * @returns {Promise<object>} Response with updated game state
   */
  async updateGame(gameId, actionContext) {
    console.log('[GameClient] updateGame() called with gameId:', gameId, 'action:', actionContext);
    
    if (!gameId) {
      throw new Error('Game ID is required');
    }

    try {
      const response = await this.request(`/games/${gameId}`, {
        method: 'PUT',
        body: JSON.stringify(actionContext)
      });

      console.log('[GameClient] Game updated successfully:', response);
      return response;
    } catch (error) {
      console.error('[GameClient] Failed to update game:', error);
      throw error;
    }
  }
}

// Create global instance after gameAPI is available
console.log('[gameClient.js] Waiting for gameAPI...');
if (typeof gameAPI !== 'undefined') {
  window.gameClient = new GameClient(gameAPI);
  console.log('[gameClient.js] GameClient instance created and assigned to window.gameClient');
} else {
  console.error('[gameClient.js] gameAPI not found! Make sure api.js is loaded first.');
}
