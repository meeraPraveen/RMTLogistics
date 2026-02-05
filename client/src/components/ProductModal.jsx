import { useState, useEffect } from 'react';
import './UserModal.css';

const ProductModal = ({ isOpen, onClose, onSave, product = null }) => {
  const isEdit = !!product;

  const [formData, setFormData] = useState({
    sku: '',
    price: '',
    stock_quantity: '',
    low_stock_threshold: '50',
    is_active: true
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (product) {
      setFormData({
        sku: product.sku || '',
        price: product.price?.toString() || '',
        stock_quantity: product.stock_quantity?.toString() || '',
        low_stock_threshold: product.low_stock_threshold?.toString() || '50',
        is_active: product.is_active !== false
      });
    } else {
      setFormData({
        sku: '',
        price: '',
        stock_quantity: '0',
        low_stock_threshold: '50',
        is_active: true
      });
    }
    setErrors({});
  }, [product, isOpen]);

  const validateForm = () => {
    const newErrors = {};
    if (!isEdit && !formData.sku.trim()) {
      newErrors.sku = 'SKU is required';
    }
    if (!formData.price || parseFloat(formData.price) < 0) {
      newErrors.price = 'Valid price is required';
    }
    if (formData.stock_quantity === '' || parseInt(formData.stock_quantity) < 0) {
      newErrors.stock_quantity = 'Stock quantity must be 0 or greater';
    }
    if (formData.low_stock_threshold === '' || parseInt(formData.low_stock_threshold) < 0) {
      newErrors.low_stock_threshold = 'Threshold must be 0 or greater';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (name === 'sku' ? value.toUpperCase() : value)
    }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSaving(true);
    try {
      const data = {
        price: parseFloat(formData.price),
        stock_quantity: parseInt(formData.stock_quantity),
        low_stock_threshold: parseInt(formData.low_stock_threshold)
      };
      if (!isEdit) {
        data.sku = formData.sku.trim();
      }
      if (isEdit) {
        data.is_active = formData.is_active;
      }
      await onSave(data);
      onClose();
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to save product';
      setErrors({ submit: msg });
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? 'Edit Product' : 'Add Product'}</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="sku">SKU {!isEdit && '*'}</label>
            <input
              type="text"
              id="sku"
              name="sku"
              value={formData.sku}
              onChange={handleChange}
              disabled={isEdit}
              placeholder="e.g. CRYS-HRT-SM-N-P"
              className={errors.sku ? 'error' : ''}
            />
            {errors.sku && <span className="error-message">{errors.sku}</span>}
            {!isEdit && <span className="form-hint">Format: CRYS-SHAPE-SIZE-BASE-ORIENT</span>}
          </div>

          <div className="form-group">
            <label htmlFor="price">Price *</label>
            <input
              type="number"
              id="price"
              name="price"
              value={formData.price}
              onChange={handleChange}
              step="0.01"
              min="0"
              placeholder="0.00"
              className={errors.price ? 'error' : ''}
            />
            {errors.price && <span className="error-message">{errors.price}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="stock_quantity">Stock Quantity *</label>
            <input
              type="number"
              id="stock_quantity"
              name="stock_quantity"
              value={formData.stock_quantity}
              onChange={handleChange}
              min="0"
              placeholder="0"
              className={errors.stock_quantity ? 'error' : ''}
            />
            {errors.stock_quantity && <span className="error-message">{errors.stock_quantity}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="low_stock_threshold">Low Stock Threshold</label>
            <input
              type="number"
              id="low_stock_threshold"
              name="low_stock_threshold"
              value={formData.low_stock_threshold}
              onChange={handleChange}
              min="0"
              placeholder="50"
              className={errors.low_stock_threshold ? 'error' : ''}
            />
            {errors.low_stock_threshold && <span className="error-message">{errors.low_stock_threshold}</span>}
            <span className="form-hint">Alert when stock falls below this number</span>
          </div>

          {isEdit && (
            <div className="checkbox-group">
              <label>
                <input
                  type="checkbox"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={handleChange}
                />
                <span>Active</span>
              </label>
            </div>
          )}

          {errors.submit && (
            <div style={{ color: '#ef4444', fontSize: '0.875rem', marginTop: '10px' }}>
              {errors.submit}
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-save" disabled={saving}>
              {saving ? 'Saving...' : (isEdit ? 'Update Product' : 'Add Product')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProductModal;
