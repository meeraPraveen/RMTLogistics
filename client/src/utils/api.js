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
  create: (userData) => api.post('/users', userData),
  update: (id, userData) => api.put(`/users/${id}`, userData),
  delete: (id) => api.delete(`/users/${id}`),
  suspend: (auth0UserId) => api.post(`/users/${encodeURIComponent(auth0UserId)}/suspend`),
  reactivate: (auth0UserId) => api.post(`/users/${encodeURIComponent(auth0UserId)}/reactivate`)
};

// Orders API
export const ordersApi = {
  getAll: (params) => api.get('/orders', { params }),
  getById: (id) => api.get(`/orders/${id}`),
  getStats: () => api.get('/orders/stats'),
  create: (orderData) => api.post('/orders', orderData),
  update: (id, orderData) => api.put(`/orders/${id}`, orderData),
  delete: (id) => api.delete(`/orders/${id}`)
};

// Companies API
export const companiesApi = {
  getAll: (params) => api.get('/companies', { params }),
  getById: (id) => api.get(`/companies/${id}`),
  create: (companyData) => api.post('/companies', companyData),
  update: (id, companyData) => api.put(`/companies/${id}`, companyData),
  delete: (id) => api.delete(`/companies/${id}`),
  toggleStatus: (id) => api.post(`/companies/${id}/toggle-status`)
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
    updateSettings: (data) => api.put('/modules/system-config/settings', data)
  }
};

export default api;
