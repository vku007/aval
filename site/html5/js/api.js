/**
 * API Client for ExternalController endpoints
 * Handles authentication and game state management
 */

console.log('[api.js] Loading API module...');

class GameAPI {
  constructor(baseUrl = '/apiv2/external') {
    this.baseUrl = baseUrl;
    this.token = null;
    this.user = null;
    this.onAuthChange = null;
    console.log('[GameAPI] Constructed with baseUrl:', baseUrl);
  }

  /**
   * Set the JWT token for authenticated requests
   * @param {string} token - JWT token from Cognito
   */
  setToken(token) {
    console.log('[GameAPI] setToken() called');
    this.token = token;
    localStorage.setItem('aval_auth_token', token);
  }

  /**
   * Get stored token from localStorage
   * @returns {string|null}
   */
  getStoredToken() {
    const token = localStorage.getItem('aval_auth_token');
    console.log('[GameAPI] getStoredToken():', token ? 'found' : 'not found');
    return token;
  }

  /**
   * Clear authentication
   */
  clearAuth() {
    console.log('[GameAPI] clearAuth()');
    this.token = null;
    this.user = null;
    localStorage.removeItem('aval_auth_token');
    if (this.onAuthChange) this.onAuthChange(null);
  }

  /**
   * Initialize authentication from stored token
   * @returns {Promise<object|null>} User object if authenticated
   */
  async initAuth() {
    console.log('[GameAPI] initAuth() started');
    const storedToken = this.getStoredToken();
    
    if (storedToken) {
      console.log('[GameAPI] Found stored token, attempting to validate...');
      this.token = storedToken;
      try {
        const user = await this.getMe();
        console.log('[GameAPI] Token valid, user:', user);
        this.user = user;
        if (this.onAuthChange) this.onAuthChange(user);
        return user;
      } catch (error) {
        console.warn('[GameAPI] Stored token invalid:', error.message);
        this.clearAuth();
      }
    } else {
      console.log('[GameAPI] No stored token found');
    }
    
    return null;
  }

  /**
   * Make an authenticated API request
   * @param {string} path - API path (e.g., '/me', '/games')
   * @param {object} options - Fetch options
   * @returns {Promise<object>} Response data
   */
  async request(path, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const url = `${this.baseUrl}${path}`;
    console.log(`[GameAPI] ${options.method || 'GET'} ${url}`);

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      console.log(`[GameAPI] Response status: ${response.status}`);

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
        throw new APIError(message, response.status, data);
      }

      return data;
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      console.error('[GameAPI] Network error:', error);
      throw new APIError(`Network error: ${error.message}`, 0);
    }
  }

  // ============ USER ENDPOINTS ============

  /**
   * GET /apiv2/external/me
   * Get current user's profile (auto-creates if not exists)
   * @returns {Promise<object>} User profile
   */
  async getMe() {
    console.log('[GameAPI] getMe() called');
    const data = await this.request('/me');
    this.user = data;
    return data;
  }

  // ============ GAME ENDPOINTS ============

  /**
   * POST /apiv2/external/games
   * Create a new game
   * @param {object} gameContext - Game creation context
   * @returns {Promise<object>} { status, gameId }
   */
  async createGame(gameContext = {}) {
    console.log('[GameAPI] createGame() called with:', gameContext);
    return this.request('/games', {
      method: 'POST',
      body: JSON.stringify(gameContext)
    });
  }

  /**
   * GET /apiv2/external/games/:gameId
   * Get a game by ID
   * @param {string} gameId - Game ID
   * @returns {Promise<object>} Game state with payload
   */
  async getGame(gameId) {
    console.log('[GameAPI] getGame() called for:', gameId);
    return this.request(`/games/${gameId}`);
  }

  /**
   * PUT /apiv2/external/games/:gameId
   * Update a game with an action
   * @param {string} gameId - Game ID
   * @param {object} action - Action to perform
   * @returns {Promise<object>} Updated game state
   */
  async updateGame(gameId, action) {
    console.log('[GameAPI] updateGame() called for:', gameId, 'action:', action);
    return this.request(`/games/${gameId}`, {
      method: 'PUT',
      body: JSON.stringify(action)
    });
  }

  /**
   * List all games for current user
   * Note: This endpoint may need to be added to ExternalController
   * @returns {Promise<Array>} List of games
   */
  async listGames() {
    console.log('[GameAPI] listGames() called');
    return this.request('/games');
  }
}

/**
 * Custom API Error class
 */
class APIError extends Error {
  constructor(message, statusCode, data = null) {
    super(message);
    this.name = 'APIError';
    this.statusCode = statusCode;
    this.data = data;
  }

  isUnauthorized() {
    return this.statusCode === 401;
  }

  isForbidden() {
    return this.statusCode === 403;
  }

  isNotFound() {
    return this.statusCode === 404;
  }

  isValidation() {
    return this.statusCode === 400 || this.statusCode === 422;
  }
}

// Global API instance
const gameAPI = new GameAPI();

console.log('[api.js] API module loaded, gameAPI instance created');

// Export for module systems (optional)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GameAPI, APIError, gameAPI };
}
