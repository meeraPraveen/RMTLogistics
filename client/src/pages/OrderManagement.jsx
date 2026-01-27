import { useState, useEffect } from 'react';
import { ordersApi, setAuthToken } from '../utils/api';
import { useAuth0 } from '@auth0/auth0-react';
import { usePermissions } from '../hooks/usePermissions';
import './ModulePage.css';

const OrderManagement = () => {
  const { getIdTokenClaims } = useAuth0();
  const { hasPermission } = usePermissions();
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    page: 1,
    limit: 25,
    status: '',
    order_type: '',
    search: ''
  });
  const [showCreateModal, setShowCreateModal] = useState(false);

  const loadOrders = async () => {
    try {
      const idToken = await getIdTokenClaims();
      setAuthToken(idToken.__raw);

      // Fetch orders and stats
      const [ordersResponse, statsResponse] = await Promise.all([
        ordersApi.getAll(filters),
        ordersApi.getStats()
      ]);

      setOrders(ordersResponse.data.data);
      setStats(statsResponse.data.data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load orders:', error);
      setError(error.response?.data?.message || 'Failed to load orders');
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: 1 // Reset to first page when filter changes
    }));
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusClass = (status) => {
    const statusMap = {
      'Pending': 'pending',
      'Processing': 'processing',
      'Ready to Print': 'ready',
      'In Progress': 'in-progress',
      'Completed': 'completed',
      'Shipped': 'shipped'
    };
    return statusMap[status] || 'default';
  };

  const canWrite = hasPermission('order_management', 'write');
  const canUpdate = hasPermission('order_management', 'update');
  const canDelete = hasPermission('order_management', 'delete');

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading orders...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <p className="error-message">❌ {error}</p>
        <button onClick={loadOrders} className="primary-btn">Retry</button>
      </div>
    );
  }

  return (
    <div className="module-page">
      <div className="page-header">
        <div>
          <h1>📦 Order Management</h1>
          <p>Manage customer orders and track order status</p>
        </div>
        {canWrite && (
          <button className="primary-btn" onClick={() => setShowCreateModal(true)}>+ Create New Order</button>
        )}
      </div>

      {/* Statistics */}
      {stats && (
        <div className="stats-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px', marginBottom: '20px' }}>
          <div className="stat-card">
            <div className="stat-label">Total Orders</div>
            <div className="stat-value">{stats.total}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Pending</div>
            <div className="stat-value" style={{ color: '#f59e0b' }}>{stats.pending}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Processing</div>
            <div className="stat-value" style={{ color: '#3b82f6' }}>{stats.processing}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">In Progress</div>
            <div className="stat-value" style={{ color: '#8b5cf6' }}>{stats.in_progress}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Completed</div>
            <div className="stat-value" style={{ color: '#10b981' }}>{stats.completed}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Revenue</div>
            <div className="stat-value">${stats.total_revenue?.toFixed(2) || '0.00'}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="filters-bar" style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search by order ID or customer..."
          value={filters.search}
          onChange={(e) => handleFilterChange('search', e.target.value)}
          style={{ flex: '1', minWidth: '200px', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
        />
        <select
          value={filters.status}
          onChange={(e) => handleFilterChange('status', e.target.value)}
          style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
        >
          <option value="">All Statuses</option>
          <option value="Pending">Pending</option>
          <option value="Processing">Processing</option>
          <option value="Ready to Print">Ready to Print</option>
          <option value="In Progress">In Progress</option>
          <option value="Completed">Completed</option>
          <option value="Shipped">Shipped</option>
        </select>
        <select
          value={filters.order_type}
          onChange={(e) => handleFilterChange('order_type', e.target.value)}
          style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
        >
          <option value="">All Types</option>
          <option value="Amazon">Amazon</option>
          <option value="Shopify">Shopify</option>
          <option value="Etsy">Etsy</option>
          <option value="B2B">B2B</option>
          <option value="Personal">Personal</option>
        </select>
      </div>

      {/* Permissions Info */}
      <div className="permissions-info">
        <p>Your permissions:</p>
        <div className="permission-badges">
          <span className="badge">Read</span>
          {canWrite && <span className="badge">Write</span>}
          {canUpdate && <span className="badge">Update</span>}
          {canDelete && <span className="badge danger">Delete</span>}
        </div>
      </div>

      {/* Orders Table */}
      <div className="data-table">
        <table>
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Type</th>
              <th>Customer</th>
              <th>Description</th>
              <th>SKU</th>
              <th>Status</th>
              <th>Amount</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '40px' }}>
                  No orders found. {canWrite && 'Click "Create New Order" to add one.'}
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id}>
                  <td><strong>{order.internal_order_id}</strong></td>
                  <td>
                    <span className="badge" style={{ fontSize: '0.85em' }}>
                      {order.order_type}
                    </span>
                  </td>
                  <td>{order.customer_email}</td>
                  <td>{order.description || '-'}</td>
                  <td><code style={{ fontSize: '0.85em' }}>{order.sku || '-'}</code></td>
                  <td>
                    <span className={`status-badge ${getStatusClass(order.status)}`}>
                      {order.status}
                    </span>
                  </td>
                  <td>${order.total_amount?.toFixed(2) || '0.00'}</td>
                  <td>{formatDate(order.date_submitted)}</td>
                  <td>
                    <div className="action-buttons">
                      <button className="btn-small" title="View details">👁️</button>
                      {canUpdate && (
                        <button className="btn-small" title="Edit order">✏️</button>
                      )}
                      {canDelete && (
                        <button className="btn-small danger" title="Delete order">🗑️</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Order Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create New Order</h2>
              <button className="close-btn" onClick={() => setShowCreateModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                📋 Order creation form coming soon!
                <br /><br />
                This will include fields for:
                <br />
                • Order type (Amazon, Shopify, Etsy, etc.)
                <br />
                • Customer information
                <br />
                • Product details
                <br />
                • Pricing and status
              </p>
            </div>
            <div className="modal-footer">
              <button className="secondary-btn" onClick={() => setShowCreateModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderManagement;
