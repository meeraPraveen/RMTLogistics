import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor to add auth token
export const setAuthToken = (token) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
};

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Unauthorized - token might be expired
      console.error('Unauthorized access');
    } else if (error.response?.status === 403) {
      // Forbidden - user doesn't have permission
      console.error('Access forbidden');
    }
    return Promise.reject(error);
  }
);

// Permissions API
export const permissionsApi = {
  getAll: () => api.get('/permissions'),
  getByRole: (role) => api.get(`/permissions/${role}`),
  updateRole: (role, permissions) => api.put(`/permissions/${role}`, { permissions }),
  reset: () => api.post('/permissions/reset'),
  getCurrentUser: () => api.get('/permissions/user/me'),

  // CRUD operations for role-module permissions
  createPermission: (role, module, permissions) =>
    api.post(`/permissions/${role}/${module}`, { permissions }),
  updatePermission: (role, module, permissions) =>
    api.put(`/permissions/${role}/${module}`, { permissions }),
  deletePermission: (role, module) =>
    api.delete(`/permissions/${role}/${module}`),
  deleteAllRolePermissions: (role) =>
    api.delete(`/permissions/${role}`)
};

// Users API
export const usersApi = {
  getAll: (params) => api.get('/users', { params }),
  getCurrentUser: () => api.get('/users/me'),
  create: (userData) => api.post('/users', userData),
  update: (id, userData) => api.put(`/users/${id}`, userData),
  delete: (id) => api.delete(`/users/${id}`),
  suspend: (auth0UserId) => api.post(`/users/${encodeURIComponent(auth0UserId)}/suspend`),
  reactivate: (auth0UserId) => api.post(`/users/${encodeURIComponent(auth0UserId)}/reactivate`)
};

// Assignments API
export const assignmentsApi = {
  getAvailableUsers: () => api.get('/assignments/available-users')
};

// Orders API
export const ordersApi = {
  getAll: (params) => api.get('/orders', { params }),
  getById: (id) => api.get(`/orders/${id}`),
  getStats: () => api.get('/orders/stats'),
  create: (orderData) => api.post('/orders', orderData),
  update: (id, orderData) => api.put(`/orders/${id}`, orderData),
  delete: (id) => api.delete(`/orders/${id}`),
  // Image upload variants (use FormData)
  createWithImage: (formData) => api.post('/orders', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  updateWithImage: (id, formData) => api.put(`/orders/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  // Extract metadata from image using AI
  extractMetadata: (imageUrl) => api.post('/orders/extract-metadata', { imageUrl })
};

// Companies API
export const companiesApi = {
  getAll: (params) => api.get('/companies', { params }),
  getById: (id) => api.get(`/companies/${id}`),
  create: (companyData) => api.post('/companies', companyData),
  update: (id, companyData) => api.put(`/companies/${id}`, companyData),
  delete: (id) => api.delete(`/companies/${id}`),
  toggleStatus: (id) => api.post(`/companies/${id}/toggle-status`),

  // Company Users (B2B)
  getUsers: (companyId, params) => api.get(`/companies/${companyId}/users`, { params }),
  createUser: (companyId, userData) => api.post(`/companies/${companyId}/users`, userData),
  updateUser: (companyId, userId, userData) => api.put(`/companies/${companyId}/users/${userId}`, userData),
  deleteUser: (companyId, userId) => api.delete(`/companies/${companyId}/users/${userId}`),
  toggleUserStatus: (companyId, userId) => api.post(`/companies/${companyId}/users/${userId}/toggle-status`)
};

// Inventory API
export const inventoryApi = {
  getAll: (params) => api.get('/inventory', { params }),
  getById: (id) => api.get(`/inventory/${id}`),
  getBySku: (sku) => api.get(`/inventory/sku/${encodeURIComponent(sku)}`),
  getStats: () => api.get('/inventory/stats'),
  getLowStock: () => api.get('/inventory/low-stock'),
  getCatalog: () => api.get('/inventory/catalog'),
  create: (data) => api.post('/inventory', data),
  update: (id, data) => api.put(`/inventory/${id}`, data),
  adjustStock: (id, adjustment) => api.post(`/inventory/${id}/adjust-stock`, { adjustment }),
  delete: (id) => api.delete(`/inventory/${id}`)
};

// Modules API
export const modulesApi = {
  userManagement: {
    getModule: () => api.get('/modules/user-management'),
    getUsers: () => api.get('/modules/user-management/users')
  },
  orderManagement: {
    getModule: () => api.get('/modules/order-management'),
    getOrders: () => api.get('/modules/order-management/orders'),
    createOrder: (data) => api.post('/modules/order-management/orders', data),
    updateOrder: (id, data) => api.put(`/modules/order-management/orders/${id}`, data),
    deleteOrder: (id) => api.delete(`/modules/order-management/orders/${id}`)
  },
  inventoryManagement: {
    getModule: () => api.get('/modules/inventory-management'),
    getItems: () => api.get('/modules/inventory-management/items'),
    createItem: (data) => api.post('/modules/inventory-management/items', data),
    updateItem: (id, data) => api.put(`/modules/inventory-management/items/${id}`, data)
  },
  printingSoftware: {
    getModule: () => api.get('/modules/printing-software'),
    getQueue: () => api.get('/modules/printing-software/queue'),
    addJob: (data) => api.post('/modules/printing-software/queue', data),
    getPrinters: () => api.get('/modules/printing-software/printers')
  },
  systemConfig: {
    getModule: () => api.get('/modules/system-config'),
    getSettings: () => api.get('/modules/system-config/settings'),
    updateSettings: (data) => api.put('/modules/system-config/settings', data),
    // Product/SKU Management
    getProducts: (params) => api.get('/modules/system-config/products', { params }),
    createProduct: (data) => api.post('/modules/system-config/products', data),
    updateProduct: (id, data) => api.put(`/modules/system-config/products/${id}`, data),
    deleteProduct: (id) => api.delete(`/modules/system-config/products/${id}`)
  }
};

export default api;
