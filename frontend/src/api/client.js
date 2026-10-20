const apiBase = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function apiRequest(path, { token, method = 'GET', body, signal } = {}) {
  const headers = new Headers()
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData
  if (body !== undefined && !isFormData) headers.set('content-type', 'application/json')
  if (token) headers.set('authorization', `Bearer ${token}`)

  let response
  try {
    response = await fetch(`${apiBase}/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
      signal,
    })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new ApiError('Could not connect to HamsafarHub. Check that the API is running and try again.', 0)
  }

  const payload = response.status === 204 ? null : await response.json().catch(() => null)
  if (!response.ok) {
    throw new ApiError(payload?.error || `The server returned HTTP ${response.status}.`, response.status)
  }
  return payload
}

export const authApi = {
  register: (body) => apiRequest('/auth/register', { method: 'POST', body }),
  login: (body) => apiRequest('/auth/login', { method: 'POST', body }),
  me: (token) => apiRequest('/auth/me', { token }),
}

export const profileApi = {
  mine: (token) => apiRequest('/profiles/mine', { token }),
  list: (token, filters = {}) => {
    const query = new URLSearchParams(filters)
    return apiRequest(`/profiles?${query}`, { token })
  },
  create: (token, body) => apiRequest('/profiles', { token, method: 'POST', body }),
  update: (token, id, body) => apiRequest(`/profiles/${encodeURIComponent(id)}`, {
    token,
    method: 'PATCH',
    body,
  }),
  get: (token, id) => apiRequest(`/profiles/${encodeURIComponent(id)}`, { token }),
  photo: async (token, id) => {
    let response
    try {
      response = await fetch(`${apiBase}/api/profiles/${encodeURIComponent(id)}/photo`, {
        headers: Object.fromEntries([['authorization', ['Bearer', token].join(' ')]]),
      })
    } catch {
      throw new ApiError('Could not load this client photo. Check that the API is running and try again.', 0)
    }
    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      throw new ApiError(payload?.error || `The server returned HTTP ${response.status}.`, response.status)
    }
    return response.blob()
  },
  remove: (token, id) => apiRequest(`/profiles/${encodeURIComponent(id)}`, { token, method: 'DELETE' }),
}

export const matchingApi = {
  find: (token, profileId) => apiRequest(`/matching/${encodeURIComponent(profileId)}`, { token }),
  photo: async (token, sourceProfileId, candidateProfileId) => {
    let response
    try {
      response = await fetch(`${apiBase}/api/matching/${encodeURIComponent(sourceProfileId)}/${encodeURIComponent(candidateProfileId)}/photo`, {
        headers: Object.fromEntries([['authorization', ['Bearer', token].join(' ')]]),
      })
    } catch {
      throw new ApiError('Could not load this client photo. Check that the API is running and try again.', 0)
    }
    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      throw new ApiError(payload?.error || `The server returned HTTP ${response.status}.`, response.status)
    }
    return response.blob()
  },
}

export const coordinationApi = {
  list: (token) => apiRequest('/coordination', { token }),
  request: (token, targetProfileId) => apiRequest('/coordination/request', {
    token,
    method: 'POST',
    body: { targetProfileId },
  }),
  update: (token, id, status) => apiRequest(`/coordination/${encodeURIComponent(id)}`, {
    token,
    method: 'PATCH',
    body: { status },
  }),
}

export const subscriptionApi = {
  plans: () => apiRequest('/subscriptions/plans'),
  checkout: (token, tier) => apiRequest(`/subscriptions/checkout/${encodeURIComponent(tier)}`, {
    token,
    method: 'POST',
  }),
  testAccess: (token, tier) => apiRequest(`/subscriptions/test-access/${encodeURIComponent(tier)}`, {
    token,
    method: 'POST',
  }),
  get: (token, reference) => apiRequest(`/subscriptions/${encodeURIComponent(reference)}`, { token }),
  current: (token) => apiRequest('/subscriptions/current', { token }),
}

export const adminApi = {
  summary: (token) => apiRequest('/admin/summary', { token }),
  matchmakers: (token) => apiRequest('/admin/matchmakers', { token }),
  updateMatchmaker: (token, id, approvalStatus) => apiRequest(
    `/admin/matchmakers/${encodeURIComponent(id)}`,
    { token, method: 'PATCH', body: { approvalStatus } },
  ),
  profiles: (token) => apiRequest('/admin/profiles', { token }),
}
