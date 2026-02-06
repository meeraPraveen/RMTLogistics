import React, { useState, useEffect } from 'react';
import { ordersApi, setAuthToken } from '../utils/api';
import { useAuth0 } from '@auth0/auth0-react';
import { usePermissions } from '../hooks/usePermissions';
import './ModulePage.css';

const Shipping = () => {
  const { getIdTokenClaims } = useAuth0();
  const { hasPermission } = usePermissions();
  const [completedOrders, setCompletedOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewingImages, setViewingImages] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const idToken = await getIdTokenClaims();
      setAuthToken(idToken.__raw);

      // Fetch 'Completed' orders
      const completedRes = await ordersApi.getAll({ status: 'Completed', limit: 100 });

      setCompletedOrders(completedRes.data.data || []);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load shipping data:', error);
      setLoading(false);
    }
  };

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

  // Helper to parse model paths (handles both JSON array and single path)
  const parseModelPaths = (modelPath) => {
    if (!modelPath) return [];
    try {
      if (typeof modelPath === 'string' && modelPath.startsWith('[')) {
        return JSON.parse(modelPath);
      }
      return [modelPath];
    } catch (e) {
      return [modelPath];
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
      const filename = imageUrl.split('/').pop() || 'order-image.jpg';
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download image:', error);
      window.open(imageUrl, '_blank');
    }
  };

  const handleDownloadModel = async (modelUrl) => {
    try {
      const fullUrl = `${apiUrl}${modelUrl}`;
      const response = await fetch(fullUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const filename = modelUrl.split('/').pop() || 'model.glb';
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download model:', error);
      alert('Failed to download model file');
    }
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
      'Ready For QC': 'ready-qc',
      'Completed': 'completed',
      'Shipped': 'shipped'
    };
    return statusMap[status] || 'default';
  };

  const handleShip = async (orderId, orderInternalId) => {
    if (!confirm(`Mark order ${orderInternalId} as shipped?`)) return;
    try {
      const idToken = await getIdTokenClaims();
      setAuthToken(idToken.__raw);
      await ordersApi.update(orderId, { status: 'Shipped' });
      loadData(); // Reload orders
    } catch (err) {
      console.error('Failed to update order status:', err);
      alert(err.response?.data?.message || 'Failed to update order status');
    }
  };

  const canWrite = hasPermission('shipping', 'write');

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading shipping module...</p>
      </div>
    );
  }

  return (
    <div className="module-page">
      <div className="page-header">
        <div>
          <h1>📦 Shipping</h1>
          <p>Manage shipments and track delivery status (Shippo Integration)</p>
        </div>
      </div>

      <div className="permissions-info">
        <p>Your permissions:</p>
        <div className="permission-badges">
          <span className="badge">Read</span>
          {canWrite && <span className="badge">Write</span>}
          {hasPermission('shipping', 'update') && <span className="badge">Update</span>}
        </div>
      </div>

      <div className="section">
        <h2>Completed Orders Ready to Ship</h2>
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Type</th>
                <th>Description</th>
                <th>SKU</th>
                <th>Status</th>
                <th>Qty</th>
                <th>Image</th>
                <th>3D Model</th>
                <th>Date</th>
                <th>Assigned Artist</th>
                <th>Assigned QC</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {completedOrders.length === 0 ? (
                <tr>
                  <td colSpan="12" style={{ textAlign: 'center', padding: '40px' }}>
                    No completed orders ready to ship
                  </td>
                </tr>
              ) : (
                completedOrders.map((order) => (
                  <tr key={order.id}>
                    <td><strong>{order.internal_order_id}</strong></td>
                    <td>
                      <span className="badge" style={{ fontSize: '0.85em' }}>
                        {order.order_type}
                      </span>
                    </td>
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
                    <td>
                      {order.model_path ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {parseModelPaths(order.model_path).map((modelPath, idx) => (
                            <button
                              key={idx}
                              className="btn-small"
                              title="Download model"
                              onClick={() => handleDownloadModel(modelPath)}
                              style={{ background: '#e0f2fe', color: '#0369a1', fontSize: '0.75em' }}
                            >
                              📦 {modelPath.split('/').pop()}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: '#9ca3af', fontSize: '0.85em' }}>-</span>
                      )}
                    </td>
                    <td>{formatDate(order.date_submitted)}</td>
                    <td>
                      {order.artist_name ? (
                        <span style={{ fontSize: '0.85em', color: '#10b981' }}>
                          {order.artist_name}
                        </span>
                      ) : (
                        <span style={{ color: '#9ca3af', fontSize: '0.85em' }}>Unassigned</span>
                      )}
                    </td>
                    <td>
                      {order.qc_name ? (
                        <span style={{ fontSize: '0.85em', color: '#10b981' }}>
                          {order.qc_name}
                        </span>
                      ) : (
                        <span style={{ color: '#9ca3af', fontSize: '0.85em' }}>Unassigned</span>
                      )}
                    </td>
                    <td>
                      <div className="action-buttons" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <button
                          className="btn-small"
                          style={{ background: '#3b82f6', color: 'white' }}
                          onClick={() => handleShip(order.id, order.internal_order_id)}
                          title="Ship Order (Shippo Integration)"
                        >
                          Ship
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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

export default Shipping;
