import { useState, useEffect } from 'react';
import { inventoryApi, setAuthToken } from '../utils/api';
import { useAuth0 } from '@auth0/auth0-react';
import { usePermissions } from '../hooks/usePermissions';
import ProductModal from '../components/ProductModal';
import StockAdjustModal from '../components/StockAdjustModal';
import './ModulePage.css';

const InventoryManagement = () => {
  const { getIdTokenClaims } = useAuth0();
  const { hasPermission } = usePermissions();
  const [products, setProducts] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    page: 1,
    limit: 25,
    shape: '',
    size: '',
    base_type: '',
    search: '',
    low_stock: false
  });
  const [pagination, setPagination] = useState(null);

  // Modal state
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showStockModal, setShowStockModal] = useState(false);
  const [stockProduct, setStockProduct] = useState(null);

  const canWrite = hasPermission('inventory_management', 'write');
  const canUpdate = hasPermission('inventory_management', 'update');
  const canDelete = hasPermission('inventory_management', 'delete');

  const ensureAuth = async () => {
    const idToken = await getIdTokenClaims();
    setAuthToken(idToken.__raw);
  };

  const loadData = async () => {
    try {
      await ensureAuth();

      const params = { ...filters };
      if (!params.shape) delete params.shape;
      if (!params.size) delete params.size;
      if (!params.base_type) delete params.base_type;
      if (!params.search) delete params.search;
      if (!params.low_stock) delete params.low_stock;

      const [productsRes, statsRes] = await Promise.all([
        inventoryApi.getAll(params),
        inventoryApi.getStats()
      ]);

      setProducts(productsRes.data.data);
      setPagination(productsRes.data.pagination);
      setStats(statsRes.data.data);
      setLoading(false);
      setError(null);
    } catch (err) {
      console.error('Failed to load inventory:', err);
      setError(err.response?.data?.message || 'Failed to load inventory');
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  const handlePageChange = (newPage) => {
    setFilters(prev => ({ ...prev, page: newPage }));
  };

  const handleSaveProduct = async (data) => {
    await ensureAuth();
    if (editingProduct) {
      await inventoryApi.update(editingProduct.id, data);
    } else {
      await inventoryApi.create(data);
    }
    loadData();
  };

  const handleAdjustStock = async (productId, adjustment) => {
    await ensureAuth();
    await inventoryApi.adjustStock(productId, adjustment);
    loadData();
  };

  const handleDeactivate = async (product) => {
    if (!confirm(`Deactivate "${product.display_name}"?`)) return;
    await ensureAuth();
    await inventoryApi.delete(product.id);
    loadData();
  };

  const getStockStatus = (product) => {
    if (product.stock_quantity === 0) return { label: 'Out of Stock', className: 'out-of-stock', color: '#ef4444' };
    if (product.stock_quantity < product.low_stock_threshold) return { label: 'Low Stock', className: 'low-stock-badge', color: '#f59e0b' };
    return { label: 'In Stock', className: 'in-stock', color: '#10b981' };
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading inventory...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <p className="error-message">{error}</p>
        <button onClick={loadData} className="primary-btn">Retry</button>
      </div>
    );
  }

  return (
    <div className="module-page">
      <div className="page-header">
        <div>
          <h1>Inventory Management</h1>
          <p>Manage product catalog and stock levels</p>
        </div>
        {canWrite && (
          <button className="primary-btn" onClick={() => { setEditingProduct(null); setShowProductModal(true); }}>
            + Add Product
          </button>
        )}
      </div>

      {/* Stats */}
      {stats && (
        <div className="stats-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px', marginBottom: '20px' }}>
          <div className="stat-card">
            <div className="stat-label">Total Products</div>
            <div className="stat-value">{stats.total_products}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Active</div>
            <div className="stat-value" style={{ color: '#10b981' }}>{stats.active_products}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Low Stock</div>
            <div className="stat-value" style={{ color: '#f59e0b' }}>{stats.low_stock_count}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Out of Stock</div>
            <div className="stat-value" style={{ color: '#ef4444' }}>{stats.out_of_stock_count}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Stock</div>
            <div className="stat-value">{stats.total_stock?.toLocaleString()}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Inventory Value</div>
            <div className="stat-value">${stats.total_inventory_value?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Search SKU or product name..."
          value={filters.search}
          onChange={(e) => handleFilterChange('search', e.target.value)}
          style={{ flex: '1', minWidth: '200px', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
        />
        <select
          value={filters.shape}
          onChange={(e) => handleFilterChange('shape', e.target.value)}
          style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
        >
          <option value="">All Shapes</option>
          <option value="Heart">Heart</option>
          <option value="Rectangle">Rectangle</option>
          <option value="Square">Square</option>
          <option value="Iceberg">Iceberg</option>
          <option value="Diamond">Diamond</option>
        </select>
        <select
          value={filters.size}
          onChange={(e) => handleFilterChange('size', e.target.value)}
          style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
        >
          <option value="">All Sizes</option>
          <option value="XSmall">XSmall</option>
          <option value="Small">Small</option>
          <option value="Medium">Medium</option>
          <option value="Large">Large</option>
          <option value="XLarge">XLarge</option>
        </select>
        <select
          value={filters.base_type}
          onChange={(e) => handleFilterChange('base_type', e.target.value)}
          style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
        >
          <option value="">All Base Types</option>
          <option value="Standard">Standard</option>
          <option value="Premium">Premium</option>
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          <input
            type="checkbox"
            checked={filters.low_stock}
            onChange={(e) => handleFilterChange('low_stock', e.target.checked)}
          />
          Low Stock Only
        </label>
      </div>

      {/* Products Table */}
      <div className="data-table">
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Product Name</th>
              <th>Shape</th>
              <th>Size</th>
              <th>Base</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Threshold</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td colSpan="10" style={{ textAlign: 'center', padding: '40px' }}>
                  No products found.
                </td>
              </tr>
            ) : (
              products.map((product) => {
                const stockStatus = getStockStatus(product);
                return (
                  <tr key={product.id}>
                    <td><code style={{ fontSize: '0.85em' }}>{product.sku}</code></td>
                    <td><strong>{product.display_name}</strong></td>
                    <td>{product.shape || '-'}</td>
                    <td>{product.size || '-'}</td>
                    <td>{product.base_type || '-'}</td>
                    <td>${product.price?.toFixed(2)}</td>
                    <td>
                      <span style={{ fontWeight: 600, color: stockStatus.color }}>
                        {product.stock_quantity}
                      </span>
                    </td>
                    <td>{product.low_stock_threshold}</td>
                    <td>
                      <span className="status-badge" style={{ background: `${stockStatus.color}20`, color: stockStatus.color }}>
                        {stockStatus.label}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        {canUpdate && (
                          <>
                            <button
                              className="btn-small"
                              title="Edit product"
                              onClick={() => { setEditingProduct(product); setShowProductModal(true); }}
                            >
                              Edit
                            </button>
                            <button
                              className="btn-small"
                              title="Adjust stock"
                              onClick={() => { setStockProduct(product); setShowStockModal(true); }}
                              style={{ background: '#1f2937' }}
                            >
                              Stock
                            </button>
                          </>
                        )}
                        {canDelete && product.is_active && (
                          <button
                            className="btn-small danger"
                            title="Deactivate product"
                            onClick={() => handleDeactivate(product)}
                          >
                            Deactivate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', marginTop: '20px' }}>
          <button
            className="btn-small"
            disabled={pagination.page <= 1}
            onClick={() => handlePageChange(pagination.page - 1)}
          >
            Previous
          </button>
          <span style={{ fontSize: '0.9rem', color: '#6b7280' }}>
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} products)
          </span>
          <button
            className="btn-small"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => handlePageChange(pagination.page + 1)}
          >
            Next
          </button>
        </div>
      )}

      {/* Modals */}
      <ProductModal
        isOpen={showProductModal}
        onClose={() => { setShowProductModal(false); setEditingProduct(null); }}
        onSave={handleSaveProduct}
        product={editingProduct}
      />

      <StockAdjustModal
        isOpen={showStockModal}
        onClose={() => { setShowStockModal(false); setStockProduct(null); }}
        onSave={handleAdjustStock}
        product={stockProduct}
      />
    </div>
  );
};

export default InventoryManagement;
