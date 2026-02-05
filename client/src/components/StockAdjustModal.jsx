import { useState, useEffect } from 'react';
import './UserModal.css';

const StockAdjustModal = ({ isOpen, onClose, onSave, product }) => {
  const [mode, setMode] = useState('add');
  const [quantity, setQuantity] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMode('add');
    setQuantity('');
    setError('');
  }, [product, isOpen]);

  const currentStock = product?.stock_quantity ?? 0;
  const adjustment = parseInt(quantity) || 0;
  const newStock = mode === 'add' ? currentStock + adjustment : currentStock - adjustment;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!quantity || adjustment <= 0) {
      setError('Enter a quantity greater than 0');
      return;
    }
    if (mode === 'deduct' && adjustment > currentStock) {
      setError(`Cannot deduct more than current stock (${currentStock})`);
      return;
    }

    setSaving(true);
    try {
      const finalAdjustment = mode === 'add' ? adjustment : -adjustment;
      await onSave(product.id, finalAdjustment);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to adjust stock');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !product) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
        <div className="modal-header">
          <h2>Adjust Stock</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form className="modal-form" onSubmit={handleSubmit}>
          <div style={{ background: '#f9fafb', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px' }}>
            <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '4px' }}>Product</div>
            <div style={{ fontWeight: 600, color: '#1f2937' }}>{product.display_name}</div>
            <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>{product.sku}</div>
            <div style={{ marginTop: '8px', fontSize: '0.9rem' }}>
              Current Stock: <strong style={{ color: currentStock < (product.low_stock_threshold || 50) ? '#ef4444' : '#10b981' }}>{currentStock}</strong>
            </div>
          </div>

          <div className="form-group">
            <label>Adjustment Type</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '8px 16px', border: `2px solid ${mode === 'add' ? '#10b981' : '#d1d5db'}`, borderRadius: '6px', flex: 1, justifyContent: 'center', background: mode === 'add' ? '#f0fdf4' : 'white' }}>
                <input type="radio" name="mode" value="add" checked={mode === 'add'} onChange={() => { setMode('add'); setError(''); }} style={{ display: 'none' }} />
                <span style={{ fontWeight: 600, color: mode === 'add' ? '#10b981' : '#6b7280' }}>+ Add</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '8px 16px', border: `2px solid ${mode === 'deduct' ? '#ef4444' : '#d1d5db'}`, borderRadius: '6px', flex: 1, justifyContent: 'center', background: mode === 'deduct' ? '#FDF2F4' : 'white' }}>
                <input type="radio" name="mode" value="deduct" checked={mode === 'deduct'} onChange={() => { setMode('deduct'); setError(''); }} style={{ display: 'none' }} />
                <span style={{ fontWeight: 600, color: mode === 'deduct' ? '#ef4444' : '#6b7280' }}>- Deduct</span>
              </label>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="quantity">Quantity</label>
            <input
              type="number"
              id="quantity"
              value={quantity}
              onChange={(e) => { setQuantity(e.target.value); setError(''); }}
              min="1"
              max={mode === 'deduct' ? currentStock : undefined}
              placeholder="Enter quantity"
              autoFocus
            />
          </div>

          {quantity && adjustment > 0 && (
            <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', padding: '12px', marginBottom: '16px', textAlign: 'center' }}>
              <span style={{ color: '#6b7280' }}>New stock: </span>
              <strong style={{ fontSize: '1.1rem', color: newStock < (product.low_stock_threshold || 50) ? '#ef4444' : '#10b981' }}>
                {newStock}
              </strong>
            </div>
          )}

          {error && (
            <div style={{ color: '#ef4444', fontSize: '0.875rem', marginBottom: '10px' }}>{error}</div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-save" disabled={saving} style={{ background: mode === 'add' ? '#10b981' : '#ef4444' }}>
              {saving ? 'Adjusting...' : (mode === 'add' ? 'Add Stock' : 'Deduct Stock')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StockAdjustModal;
