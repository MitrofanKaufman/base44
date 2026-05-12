const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '');
const TOKEN_STORAGE_KEYS = ['base44_access_token', 'token'];

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

function getStoredToken() {
  if (typeof window === 'undefined') return null;
  for (const key of TOKEN_STORAGE_KEYS) {
    const value = window.localStorage.getItem(key);
    if (value) return value;
  }
  return null;
}

function storeToken(token) {
  if (typeof window === 'undefined' || !token) return;
  for (const key of TOKEN_STORAGE_KEYS) {
    window.localStorage.setItem(key, token);
  }
}

function clearToken() {
  if (typeof window === 'undefined') return;
  for (const key of TOKEN_STORAGE_KEYS) {
    window.localStorage.removeItem(key);
  }
}

function toQueryString(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : '';
}

async function request(path, options = {}) {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});
  const isFormData = options.body instanceof FormData;

  if (!isFormData && options.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (response.status === 204) return null;

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message = data?.error || data?.message || response.statusText || 'Request failed';
    throw new ApiError(message, response.status, data);
  }

  return data;
}

export const apiRequest = request;

function createEntityHandler(entityName) {
  const basePath = `/entities/${entityName}`;

  return {
    list(sort, limit, skip, fields) {
      return request(`${basePath}${toQueryString({ sort_by: sort, limit, skip, fields })}`);
    },
    filter(query = {}, sort, limit, skip, fields) {
      return request(`${basePath}${toQueryString({
        q: JSON.stringify(query),
        sort_by: sort,
        limit,
        skip,
        fields,
      })}`);
    },
    get(id) {
      return request(`${basePath}/${encodeURIComponent(id)}`);
    },
    read(id) {
      return this.get(id);
    },
    create(data) {
      return request(basePath, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    update(id, data) {
      return request(`${basePath}/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    delete(id) {
      return request(`${basePath}/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
    },
    deleteMany(query) {
      return request(basePath, {
        method: 'DELETE',
        body: JSON.stringify(query),
      });
    },
    bulkCreate(data) {
      return request(`${basePath}/bulk`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    bulkUpdate(data) {
      return request(`${basePath}/bulk`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    updateMany(query, data) {
      return request(`${basePath}/update-many`, {
        method: 'PATCH',
        body: JSON.stringify({ query, data }),
      });
    },
    importEntities(file) {
      const formData = new FormData();
      formData.append('file', file, file.name);
      return request(`${basePath}/import`, {
        method: 'POST',
        body: formData,
      });
    },
    subscribe() {
      return () => {};
    },
  };
}

/** @type {any} */
const entities = new Proxy({}, {
  get(_target, entityName) {
    if (typeof entityName !== 'string' || entityName === 'then' || entityName.startsWith('_')) {
      return undefined;
    }
    return createEntityHandler(entityName);
  },
});

const auth = {
  async me() {
    return request('/auth/me');
  },
  async updateMe(data) {
    return request('/auth/me', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  async loginViaEmailPassword(email, password) {
    const response = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (response?.token) storeToken(response.token);
    return {
      access_token: response?.token,
      user: response?.user,
    };
  },
  async register(payload) {
    const response = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (response?.token) storeToken(response.token);
    return {
      access_token: response?.token,
      user: response?.user,
    };
  },
  async logout() {
    try {
      await request('/auth/logout', { method: 'POST' });
    } finally {
      clearToken();
    }
  },
  async isAuthenticated() {
    try {
      await this.me();
      return true;
    } catch (_error) {
      return false;
    }
  },
  setToken(token) {
    storeToken(token);
  },
  redirectToLogin(fromUrl = window.location.href) {
    const url = new URL('/login', window.location.origin);
    url.searchParams.set('from_url', fromUrl);
    window.history.replaceState({}, document.title, url.toString());
    window.dispatchEvent(new Event('popstate'));
  },
};

/** @type {any} */
export const base44 = {
  auth,
  entities,
  setToken: storeToken,
  getConfig() {
    return {
      serverUrl: API_BASE_URL,
      requiresAuth: true,
    };
  },
};
