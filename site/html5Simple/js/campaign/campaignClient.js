/**
 * Campaign HTTP client. Returns { body, etag }. The etag is the raw header value.
 * Classic global: campaignClient, constructed with gameAPI.
 */

class CampaignClient {
  constructor(gameAPI) {
    this.gameAPI = gameAPI;
    this.baseUrl = gameAPI.baseUrl;
  }

  async request(path, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };
    const token = this.gameAPI.token;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const url = `${this.baseUrl}${path}`;
    let response;
    try {
      response = await fetch(url, {
        ...options,
        headers
      });
    } catch (error) {
      throw new APIError(`Network error: ${error.message}`, 0);
    }

    const contentType = response.headers.get('content-type') || '';
    let data = null;
    if (contentType.includes('application/json')) {
      data = await response.json();
    }

    if (!response.ok) {
      const message = (data && (data.detail || data.message)) || `HTTP ${response.status}`;
      throw new APIError(message, response.status, data);
    }

    const etag = response.headers.get('etag');
    if (!etag) {
      throw new APIError('Could not read the campaign', 0);
    }
    return { body: data, etag };
  }

  catalog() {
    return this.request('/campaigns', { method: 'GET' });
  }

  start(definitionId, etag) {
    return this.request('/campaigns', {
      method: 'POST',
      headers: { 'If-Match': etag },
      body: JSON.stringify({ definitionId })
    });
  }

  startFromFile(settings, etag) {
    return this.request('/campaigns', {
      method: 'POST',
      headers: { 'If-Match': etag },
      body: JSON.stringify({ settings })
    });
  }

  get(id) {
    return this.request(`/campaigns/${encodeURIComponent(id)}`, { method: 'GET' });
  }

  act(id, body, etag) {
    return this.request(`/campaigns/${encodeURIComponent(id)}/actions`, {
      method: 'POST',
      headers: { 'If-Match': etag },
      body: JSON.stringify(body)
    });
  }
}

this.CampaignClient = CampaignClient;
if (typeof gameAPI !== 'undefined') {
  this.campaignClient = new CampaignClient(gameAPI);
}
