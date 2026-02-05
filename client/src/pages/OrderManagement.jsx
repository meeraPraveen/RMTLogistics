import { useState, useEffect } from 'react';
import { ordersApi, usersApi, setAuthToken } from '../utils/api';
import { useAuth0 } from '@auth0/auth0-react';
import { usePermissions } from '../hooks/usePermissions';
import OrderModal from '../components/OrderModal';
import './ModulePage.css';

const OrderManagement = () => {
  const { getIdTokenClaims } = useAuth0();
  const { hasPermission, permissions } = usePermissions();
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    page: 1,
    limit: 25,
    status: '',
    order_type: '',
    search: '',
    date_from: '',
    date_to: '',
    sort: '',
    order: 'DESC'
  });
  const [showModal, setShowModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [viewingImages, setViewingImages] = useState(null); // Array of image URLs
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [currentUser, setCurrentUser] = useState(null);
  const [showMyAssignments, setShowMyAssignments] = useState(false);

  const isB2BUser = permissions?.role === 'B2B User';
  const isArtist = ['Artist', 'Lead Artist'].includes(permissions?.role);
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  // Helper to parse image paths (handles both JSON array and single path)
  const parseImagePaths = (imagePath) => {
    if (!imagePath) return [];
    try {
      if (typeof imagePath === 'string' && imagePath.startsWith('[')) {
        return JSON.parse(imagePath);
      }
      return [imagePath];
    } catch (e) {
      return [imagePath];
    }
  };

  const openImageViewer = (order) => {
    const paths = parseImagePaths(order.image_path);
    if (paths.length > 0) {
      setViewingImages(paths.map(p => `${apiUrl}${p}`));
      setCurrentImageIndex(0);
    }
  };

  const handleDownloadImage = async (imageUrl) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      // Extract filename from URL or use a default
      const filename = imageUrl.split('/').pop() || 'order-image.jpg';
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download image:', error);
      // Fallback to opening in new tab
      window.open(imageUrl, '_blank');
    }
  };

  // Fetch current user info when permissions load
  useEffect(() => {
    const fetchCurrentUser = async () => {
      if (['Artist', 'Lead Artist', 'Production Tech'].includes(permissions?.role) && !currentUser) {
        try {
          const idToken = await getIdTokenClaims();
          setAuthToken(idToken.__raw);
          const userResponse = await usersApi.getCurrentUser();
          setCurrentUser(userResponse.data.data);
        } catch (error) {
          console.error('Failed to fetch current user:', error);
        }
      }
    };
    fetchCurrentUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissions?.role]);

  const loadOrders = async () => {
    try {
      const idToken = await getIdTokenClaims();
      setAuthToken(idToken.__raw);

      // Build filter params
      const filterParams = { ...filters };

      // Apply "my assignments" filter if enabled
      if (showMyAssignments && currentUser) {
        filterParams.assigned_artist_id = currentUser.id;
      }

      // Fetch orders and stats
      const [ordersResponse, statsResponse] = await Promise.all([
        ordersApi.getAll(filterParams),
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
  }, [filters, showMyAssignments, currentUser]);

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

  const handleSaveOrder = async (orderData, orderId = null, imageFiles = [], existingImages = []) => {
    const idToken = await getIdTokenClaims();
    setAuthToken(idToken.__raw);

    // Use FormData if there are image files or existing images to track
    const hasNewImages = imageFiles && imageFiles.length > 0;
    const hasExistingImages = existingImages && existingImages.length > 0;

    if (hasNewImages || hasExistingImages) {
      const formData = new FormData();

      // Add new image files (field name 'images' for multiple)
      if (hasNewImages) {
        imageFiles.forEach(file => {
          formData.append('images', file);
        });
      }

      // Add existing images that should be kept (for updates)
      if (orderId && hasExistingImages) {
        formData.append('existing_images', JSON.stringify(existingImages));
      }

      // Add all order data fields to FormData
      Object.keys(orderData).forEach(key => {
        if (orderData[key] !== null && orderData[key] !== undefined) {
          if (key === 'shipping_address') {
            formData.append(key, JSON.stringify(orderData[key]));
          } else {
            formData.append(key, orderData[key]);
          }
        }
      });

      if (orderId) {
        await ordersApi.updateWithImage(orderId, formData);
      } else {
        await ordersApi.createWithImage(formData);
      }
    } else {
      if (orderId) {
        await ordersApi.update(orderId, orderData);
      } else {
        await ordersApi.create(orderData);
      }
    }
    loadOrders();
  };

  const handleEditOrder = (order) => {
    setEditingOrder(order);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingOrder(null);
  };

  const handleOpenCreateModal = () => {
    setEditingOrder(null);
    setShowModal(true);
  };

  const handleDeleteOrder = async (orderId) => {
    if (!confirm('Are you sure you want to delete this order?')) return;
    try {
      const idToken = await getIdTokenClaims();
      setAuthToken(idToken.__raw);
      await ordersApi.delete(orderId);
      loadOrders();
    } catch (err) {
      console.error('Failed to delete order:', err);
    }
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
          <p>{isArtist ? 'View orders and upload images' : 'Manage customer orders and track order status'}</p>
        </div>
        {canWrite && !isArtist && (
          <button className="primary-btn" onClick={handleOpenCreateModal}>+ Create New Order</button>
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
            <div className="stat-value" style={{ color: '#722F37' }}>{stats.processing}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">In Progress</div>
            <div className="stat-value" style={{ color: '#5C1E2A' }}>{stats.in_progress}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Completed</div>
            <div className="stat-value" style={{ color: '#10b981' }}>{stats.completed}</div>
          </div>
          {!isArtist && (
            <div className="stat-card">
              <div className="stat-label">Total Revenue</div>
              <div className="stat-value">${stats.total_revenue?.toFixed(2) || '0.00'}</div>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="filters-bar" style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          placeholder={isArtist ? "Search by order ID..." : "Search by order ID or customer..."}
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
        {!isB2BUser && (
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
        )}
        <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>From:</span>
          <input
            type="date"
            value={filters.date_from}
            onChange={(e) => handleFilterChange('date_from', e.target.value)}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>To:</span>
          <input
            type="date"
            value={filters.date_to}
            onChange={(e) => handleFilterChange('date_to', e.target.value)}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
          />
        </div>
        <select
          value={`${filters.sort || 'default'}::${filters.order}`}
          onChange={(e) => {
            const [sortField, sortOrder] = e.target.value.split('::');
            setFilters(prev => ({
              ...prev,
              sort: sortField === 'default' ? '' : sortField,
              order: sortOrder,
              page: 1
            }));
          }}
          style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
        >
          <option value="default::DESC">Sort: Default</option>
          <option value="date_submitted::DESC">Date (Newest First)</option>
          <option value="date_submitted::ASC">Date (Oldest First)</option>
          {!isArtist && (
            <>
              <option value="total_amount::DESC">Price (High to Low)</option>
              <option value="total_amount::ASC">Price (Low to High)</option>
            </>
          )}
        </select>
        {['Artist', 'Lead Artist', 'Production Tech'].includes(permissions?.role) && currentUser && (
          <button
            onClick={() => setShowMyAssignments(!showMyAssignments)}
            style={{
              padding: '8px 16px',
              borderRadius: '4px',
              border: '1px solid #ddd',
              background: showMyAssignments ? '#722F37' : 'white',
              color: showMyAssignments ? 'white' : '#722F37',
              cursor: 'pointer',
              fontWeight: showMyAssignments ? '600' : 'normal',
              transition: 'all 0.2s'
            }}
          >
            {showMyAssignments ? '✓ My Assignments' : 'Show My Assignments'}
          </button>
        )}
      </div>

      {/* Permissions Info */}
      <div className="permissions-info">
        <p>Your permissions:</p>
        <div className="permission-badges">
          <span className="badge">Read</span>
          {isArtist ? (
            <span className="badge">Upload Images</span>
          ) : (
            <>
              {canWrite && <span className="badge">Write</span>}
              {canUpdate && <span className="badge">Update</span>}
              {canDelete && <span className="badge danger">Delete</span>}
            </>
          )}
        </div>
      </div>

      {/* Orders Table */}
      <div className="data-table">
        <table>
          <thead>
            <tr>
              <th>Order ID</th>
              {!isB2BUser && <th>Type</th>}
              <th>Description</th>
              <th>SKU</th>
              <th>Status</th>
              <th>Qty</th>
              <th>Image</th>
              <th>Date</th>
              {!isArtist && <th>Assigned Artist</th>}
              {!isArtist && <th>Assigned QC</th>}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={isB2BUser ? 8 : (isArtist ? 9 : 11)} style={{ textAlign: 'center', padding: '40px' }}>
                  No orders found. {canWrite && 'Click "Create New Order" to add one.'}
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id}>
                  <td><strong>{order.internal_order_id}</strong></td>
                  {!isB2BUser && (
                    <td>
                      <span className="badge" style={{ fontSize: '0.85em' }}>
                        {order.order_type}
                      </span>
                    </td>
                  )}
                  <td>{order.description || '-'}</td>
                  <td><code style={{ fontSize: '0.85em' }}>{order.sku || '-'}</code></td>
                  <td>
                    <span className={`status-badge ${getStatusClass(order.status)}`}>
                      {order.status}
                    </span>
                  </td>
                  <td>{order.num_figures || 1}</td>
                  <td>
                    {order.image_path ? (
                      <button
                        className="btn-small"
                        title="View images"
                        onClick={() => openImageViewer(order)}
                        style={{ background: '#FDF2F4', color: '#722F37' }}
                      >
                        View ({parseImagePaths(order.image_path).length})
                      </button>
                    ) : (
                      <span style={{ color: '#9ca3af', fontSize: '0.85em' }}>-</span>
                    )}
                  </td>
                  <td>{formatDate(order.date_submitted)}</td>
                  {!isArtist && (
                    <td>
                      {order.artist_name ? (
                        <span style={{ fontSize: '0.85em', color: '#10b981' }}>
                          {order.artist_name}
                        </span>
                      ) : (
                        <span style={{ color: '#9ca3af', fontSize: '0.85em' }}>Unassigned</span>
                      )}
                    </td>
                  )}
                  {!isArtist && (
                    <td>
                      {order.qc_name ? (
                        <span style={{ fontSize: '0.85em', color: '#10b981' }}>
                          {order.qc_name}
                        </span>
                      ) : (
                        <span style={{ color: '#9ca3af', fontSize: '0.85em' }}>Unassigned</span>
                      )}
                    </td>
                  )}
                  <td>
                    <div className="action-buttons">
                      {isArtist ? (
                        <button className="btn-small" title="Upload images" onClick={() => handleEditOrder(order)} style={{ background: '#e0f2fe', color: '#0369a1' }}>
                          Upload
                        </button>
                      ) : (
                        <>
                          {canUpdate && (
                            <button className="btn-small" title="Edit order" onClick={() => handleEditOrder(order)}>✏️</button>
                          )}
                          {canDelete && (
                            <button className="btn-small danger" title="Delete order" onClick={() => handleDeleteOrder(order.id)}>🗑️</button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Order Modal (Create/Edit) */}
      <OrderModal
        isOpen={showModal}
        onClose={handleCloseModal}
        onSave={handleSaveOrder}
        order={editingOrder}
      />

      {/* Image Viewer Modal - Multiple Images with Navigation */}
      {viewingImages && viewingImages.length > 0 && (
        <div
          className="modal-overlay"
          onClick={() => setViewingImages(null)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              maxWidth: '90vw',
              maxHeight: '90vh',
              background: 'white',
              borderRadius: '8px',
              padding: '16px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
            }}
          >
            <button
              onClick={() => setViewingImages(null)}
              style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                background: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                cursor: 'pointer',
                fontSize: '18px',
                lineHeight: '1',
                zIndex: 10
              }}
            >
              &times;
            </button>

            {/* Navigation arrows for multiple images */}
            {viewingImages.length > 1 && (
              <>
                <button
                  onClick={() => setCurrentImageIndex(prev => (prev > 0 ? prev - 1 : viewingImages.length - 1))}
                  style={{
                    position: 'absolute',
                    left: '-50px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'rgba(0,0,0,0.5)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '50%',
                    width: '40px',
                    height: '40px',
                    cursor: 'pointer',
                    fontSize: '20px'
                  }}
                >
                  &#8249;
                </button>
                <button
                  onClick={() => setCurrentImageIndex(prev => (prev < viewingImages.length - 1 ? prev + 1 : 0))}
                  style={{
                    position: 'absolute',
                    right: '-50px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'rgba(0,0,0,0.5)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '50%',
                    width: '40px',
                    height: '40px',
                    cursor: 'pointer',
                    fontSize: '20px'
                  }}
                >
                  &#8250;
                </button>
              </>
            )}

            <img
              src={viewingImages[currentImageIndex]}
              alt={`Order image ${currentImageIndex + 1}`}
              style={{ maxWidth: '85vw', maxHeight: '70vh', objectFit: 'contain', borderRadius: '4px' }}
            />

            {/* Image counter and thumbnails for multiple images */}
            {viewingImages.length > 1 && (
              <div style={{ marginTop: '12px', textAlign: 'center' }}>
                <div style={{ marginBottom: '8px', color: '#6b7280', fontSize: '0.875rem' }}>
                  {currentImageIndex + 1} / {viewingImages.length}
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {viewingImages.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentImageIndex(idx)}
                      style={{
                        padding: 0,
                        border: idx === currentImageIndex ? '2px solid #722F37' : '2px solid transparent',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        background: 'none'
                      }}
                    >
                      <img
                        src={img}
                        alt={`Thumbnail ${idx + 1}`}
                        style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '2px' }}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginTop: '12px', textAlign: 'center' }}>
              <button
                onClick={() => handleDownloadImage(viewingImages[currentImageIndex])}
                style={{
                  display: 'inline-block',
                  padding: '8px 16px',
                  background: '#722F37',
                  color: 'white',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                Download Image
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderManagement;
