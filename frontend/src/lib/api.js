// API wrapper for backend communication

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000/api'

class APIError extends Error {
  constructor(message, status, response) {
    super(message)
    this.name = 'APIError'
    this.status = status
    this.response = response
  }
}

// Generic API request helper
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`

  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
    },
  }
    // Let the browser set the correct Content-Type for FormData
  if (options.body instanceof FormData) {
    delete defaultOptions.headers['Content-Type']
  }

  const finalOptions = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers,
    },
  }

  try {
    const response = await fetch(url, finalOptions)

    let data = null
    const contentType = response.headers.get('content-type')

    if (contentType?.includes('application/json')) {
      data = await response.json()
    } else {
      data = await response.text()
    }

    if (!response.ok) {
      throw new APIError(
        data?.error || data?.message || `HTTP ${response.status}`,
        response.status,
        data
      )
    }

    return data
  } catch (error) {
    if (error instanceof APIError) {
      throw error
    }

    console.error(`API request failed for ${url}:`, error)
    throw new APIError(`Network error: ${error.message}`, 0, null)
  }
}

// Invoice API methods
export const invoiceApi = {
  async getAll() {
    const response = await apiRequest('/invoices')
    return Array.isArray(response) ? response : response?.data || []
  },

  async uploadFile(file) {
    const formData = new FormData()
    formData.append('invoice', file)

    const response = await apiRequest('/invoices/upload', {
      method: 'POST',
      body: formData,
    })

    return response?.data
  },

  async uploadUrl(url) {
    const response = await apiRequest('/invoices/upload', {
      method: 'POST',
      body: JSON.stringify({ url }),
    })

    return response?.data
  },

  async delete(id) {
    return await apiRequest(`/invoices/${id}`, {
      method: 'DELETE',
    })
  },

  async loadSampleData() {
    const response = await apiRequest('/invoices/sample', {
      method: 'POST',
    })

    return response?.data || []
  },
}

// Chat API methods
export const chatApi = {
  async askQuestion(question) {
    const response = await apiRequest('/chat', {
      method: 'POST',
      body: JSON.stringify({ question }),
    })

    return response?.data
  },
}

// Health check
export const healthApi = {
  async check() {
    return await apiRequest('/health')
  },
}

export { APIError }
