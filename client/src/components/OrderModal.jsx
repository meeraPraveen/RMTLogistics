import { useState, useEffect } from 'react';
import { inventoryApi, companiesApi, assignmentsApi, ordersApi, setAuthToken } from '../utils/api';
import { useAuth0 } from '@auth0/auth0-react';
import { usePermissions } from '../hooks/usePermissions';
import './UserModal.css';

const OrderModal = ({ isOpen, onClose, onSave, order = null }) => {
  const { getIdTokenClaims } = useAuth0();
  const { permissions } = usePermissions();
  const isEditMode = !!order;
  const isArtist = ['Artist', 'Lead Artist'].includes(permissions?.role);
  const isLimitedRole = ['Artist', 'Lead Artist', 'Production Tech'].includes(permissions?.role);

  const [formData, setFormData] = useState({
    order_type: 'Amazon',
    platform_order_id: '',
    order_item_id: '',
    company_id: '',
    customer_email: '',
    shipping_name: '',
    shipping_line1: '',
    shipping_line2: '',
    shipping_city: '',
    shipping_state: '',
    shipping_zip: '',
    shipping_country: 'US',
    description: '',
    num_figures: '1',
    sku: '',
    shape: '',
    size: '',
    orientation: '',
    base_type: '',
    has_background: false,
    has_text: false,
    unit_rate: '',
    total_amount: '',
    comments: '',
    internal_notes: '',
    status: 'Pending',
    assigned_artist_id: '',
    assigned_qc_id: ''
  });

  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [catalog, setCatalog] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [imageFiles, setImageFiles] = useState([]); // New files to upload
  const [imagePreviews, setImagePreviews] = useState([]); // Preview URLs (both new and existing)
  const [existingImages, setExistingImages] = useState([]); // Existing image paths from server
  const [assignableUsers, setAssignableUsers] = useState([]); // Users that can be assigned to orders
  const [selectedImageForMetadata, setSelectedImageForMetadata] = useState(null); // Selected image for metadata extraction
  const [extractingMetadata, setExtractingMetadata] = useState(false); // Loading state for metadata extraction
  const MAX_IMAGES = 5;

  useEffect(() => {
    if (isOpen && permissions) {
      loadCatalogAndCompanies();
      if (order) {
        populateFormFromOrder(order);
      } else {
        resetForm();
      }
    }
  }, [isOpen, order, permissions]);

  const populateFormFromOrder = (orderData) => {
    const shippingAddress = orderData.shipping_address || {};
    setFormData({
      order_type: orderData.order_type || 'Amazon',
      platform_order_id: orderData.platform_order_id || '',
      order_item_id: orderData.order_item_id || '',
      company_id: orderData.company_id || '',
      customer_email: orderData.customer_email || '',
      shipping_name: shippingAddress.name || '',
      shipping_line1: shippingAddress.line1 || '',
      shipping_line2: shippingAddress.line2 || '',
      shipping_city: shippingAddress.city || '',
      shipping_state: shippingAddress.state || '',
      shipping_zip: shippingAddress.zip || '',
      shipping_country: shippingAddress.country || 'US',
      description: orderData.description || '',
      num_figures: orderData.num_figures?.toString() || '1',
      sku: orderData.sku || '',
      shape: orderData.shape || '',
      size: orderData.size || '',
      orientation: orderData.orientation || '',
      base_type: orderData.base_type || '',
      has_background: orderData.has_background || false,
      has_text: orderData.has_text || false,
      unit_rate: orderData.unit_rate?.toString() || '',
      total_amount: orderData.total_amount?.toString() || '',
      comments: orderData.comments || '',
      internal_notes: orderData.internal_notes || '',
      status: orderData.status || 'Pending',
      assigned_artist_id: orderData.assigned_artist_id?.toString() || '',
      assigned_qc_id: orderData.assigned_qc_id?.toString() || ''
    });
    setErrors({});
    setImageFiles([]);
    // Set existing image previews if order has images
    if (orderData.image_path) {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      try {
        // Handle both JSON array and single path formats
        const paths = typeof orderData.image_path === 'string' && orderData.image_path.startsWith('[')
          ? JSON.parse(orderData.image_path)
          : [orderData.image_path];
        setExistingImages(paths);
        setImagePreviews(paths.map(p => `${apiUrl}${p}`));
      } catch (e) {
        // Fallback for single image path
        setExistingImages([orderData.image_path]);
        setImagePreviews([`${apiUrl}${orderData.image_path}`]);
      }
    } else {
      setExistingImages([]);
      setImagePreviews([]);
    }
    // Find and set the selected product if SKU exists
    if (orderData.sku && catalog.length > 0) {
      const product = catalog.find(p => p.sku === orderData.sku);
      setSelectedProduct(product || null);
    }
  };

  const resetForm = () => {
    setFormData({
      order_type: 'Amazon',
      platform_order_id: '',
      order_item_id: '',
      company_id: '',
      customer_email: '',
      shipping_name: '',
      shipping_line1: '',
      shipping_line2: '',
      shipping_city: '',
      shipping_state: '',
      shipping_zip: '',
      shipping_country: 'US',
      description: '',
      num_figures: '1',
      sku: '',
      shape: '',
      size: '',
      orientation: '',
      base_type: '',
      has_background: false,
      has_text: false,
      unit_rate: '',
      total_amount: '',
      comments: '',
      internal_notes: '',
      assigned_artist_id: '',
      assigned_qc_id: ''
    });
    setErrors({});
    setSelectedProduct(null);
    setImageFiles([]);
    setImagePreviews([]);
    setExistingImages([]);
  };

  const loadCatalogAndCompanies = async () => {
    try {
      const idToken = await getIdTokenClaims();
      setAuthToken(idToken.__raw);

      const requests = [inventoryApi.getCatalog()];
      let companiesIndex = -1;
      let assignmentsIndex = -1;

      // Only Admin/SuperAdmin need companies data
      const isAdmin = ['Admin', 'SuperAdmin'].includes(permissions?.role);
      if (isAdmin) {
        companiesIndex = requests.length;
        requests.push(companiesApi.getAll({ limit: 100 }));
      }

      // Load assignable users if user can assign orders
      const canAssign = ['Admin', 'SuperAdmin', 'Lead Artist'].includes(permissions?.role);
      console.log('🔍 User role:', permissions?.role, '| Can assign:', canAssign);

      if (canAssign) {
        console.log('📞 Calling assignmentsApi.getAvailableUsers()...');
        assignmentsIndex = requests.length;
        requests.push(assignmentsApi.getAvailableUsers());
      }

      const results = await Promise.all(requests);

      // Set catalog (always at index 0)
      setCatalog(results[0].data.data || []);

      // Set companies if fetched
      if (companiesIndex >= 0) {
        setCompanies(results[companiesIndex].data.data || []);
      }

      // Set assignable users if fetched
      if (assignmentsIndex >= 0) {
        console.log('📦 Assignment API response:', results[assignmentsIndex]);
        const users = results[assignmentsIndex].data.data || [];
        console.log('✅ Setting assignable users:', users);
        setAssignableUsers(users);
      } else {
        console.log('⚠️ No assignable users requested');
      }
    } catch (err) {
      console.error('❌ Failed to load catalog/companies/users:', err);
      console.error('Error details:', err.response?.data);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const updated = { ...formData, [name]: type === 'checkbox' ? checked : value };

    // When SKU is selected, auto-fill product details
    if (name === 'sku' && value) {
      const product = catalog.find(p => p.sku === value);
      if (product) {
        setSelectedProduct(product);
        updated.unit_rate = product.price.toString();
        updated.shape = product.shape || '';
        updated.size = product.size || '';
        updated.orientation = product.orientation || '';
        updated.base_type = product.base_type || '';
        // Auto-calculate total
        const numFigs = parseInt(updated.num_figures) || 1;
        updated.total_amount = (product.price * numFigs).toFixed(2);
      }
    } else if (name === 'sku' && !value) {
      setSelectedProduct(null);
    }

    // Recalculate total when num_figures or unit_rate changes
    if (name === 'num_figures' || name === 'unit_rate') {
      const rate = parseFloat(name === 'unit_rate' ? value : updated.unit_rate) || 0;
      const numFigs = parseInt(name === 'num_figures' ? value : updated.num_figures) || 1;
      updated.total_amount = (rate * numFigs).toFixed(2);
    }

    // Clear company if not B2B
    if (name === 'order_type' && value !== 'B2B') {
      updated.company_id = '';
    }

    setFormData(updated);
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const currentTotal = imagePreviews.length;
    const availableSlots = MAX_IMAGES - currentTotal;

    if (files.length > availableSlots) {
      setErrors(prev => ({ ...prev, image: `You can only add ${availableSlots} more image(s). Maximum is ${MAX_IMAGES}.` }));
      return;
    }

    const validFiles = [];
    const newPreviews = [];

    for (const file of files) {
      if (!allowedTypes.includes(file.type)) {
        setErrors(prev => ({ ...prev, image: 'Only JPEG, PNG, GIF, and WebP images are allowed' }));
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setErrors(prev => ({ ...prev, image: 'Each file size cannot exceed 10MB' }));
        return;
      }
      validFiles.push(file);
      newPreviews.push(URL.createObjectURL(file));
    }

    setImageFiles(prev => [...prev, ...validFiles]);
    setImagePreviews(prev => [...prev, ...newPreviews]);
    setErrors(prev => ({ ...prev, image: undefined }));
    // Reset the input so the same file can be selected again if needed
    e.target.value = '';
  };

  const removeImage = (index) => {
    const existingCount = existingImages.length;

    if (index < existingCount) {
      // Removing an existing image (from server)
      setExistingImages(prev => prev.filter((_, i) => i !== index));
    } else {
      // Removing a newly added image
      const newFileIndex = index - existingCount;
      setImageFiles(prev => prev.filter((_, i) => i !== newFileIndex));
    }
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
    // Clear selection if the removed image was selected
    if (selectedImageForMetadata === index) {
      setSelectedImageForMetadata(null);
    }
  };

  const handleExtractMetadata = async () => {
    if (selectedImageForMetadata === null) {
      setErrors(prev => ({ ...prev, metadata: 'Please select an image to extract metadata from' }));
      return;
    }

    setExtractingMetadata(true);
    setErrors(prev => ({ ...prev, metadata: undefined }));

    try {
      const idToken = await getIdTokenClaims();
      setAuthToken(idToken.__raw);

      // Get the image URL - use existing image path for uploaded images
      const existingCount = existingImages.length;
      let imageUrl;

      if (selectedImageForMetadata < existingCount) {
        // Use existing image path from server
        imageUrl = existingImages[selectedImageForMetadata];
      } else {
        // For newly uploaded images, we need to alert the user they must save first
        setErrors(prev => ({
          ...prev,
          metadata: 'Please save the order first to extract metadata from newly uploaded images'
        }));
        setExtractingMetadata(false);
        return;
      }

      const response = await ordersApi.extractMetadata(imageUrl);
      const metadata = response.data.data.metadata;

      // For limited roles (Artist, Lead Artist, Production Tech), append to internal_notes
      // For other roles, append to description field
      if (isLimitedRole) {
        setFormData(prev => ({
          ...prev,
          internal_notes: prev.internal_notes
            ? `${prev.internal_notes}\n\nAI Metadata:\n${metadata}`
            : `AI Metadata:\n${metadata}`
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          description: prev.description
            ? `${prev.description}\n\n${metadata}`
            : metadata
        }));
      }

      setSelectedImageForMetadata(null); // Clear selection after extraction
    } catch (error) {
      console.error('Failed to extract metadata:', error);
      setErrors(prev => ({
        ...prev,
        metadata: error.response?.data?.message || 'Failed to extract metadata from image'
      }));
    } finally {
      setExtractingMetadata(false);
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.order_type) newErrors.order_type = 'Order type is required';
    if (!formData.customer_email.trim()) newErrors.customer_email = 'Customer email is required';
    if (formData.order_type === 'B2B' && !formData.company_id) newErrors.company_id = 'Company is required for B2B orders';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Artists/Lead Artists/Production Tech only upload images and add notes, skip validation for them
    if (!isLimitedRole && !validateForm()) return;

    setSaving(true);
    try {
      const orderData = {
        order_type: formData.order_type,
        platform_order_id: formData.platform_order_id || null,
        order_item_id: formData.order_item_id || null,
        company_id: formData.company_id || null,
        customer_email: formData.customer_email,
        shipping_address: {
          name: formData.shipping_name,
          line1: formData.shipping_line1,
          line2: formData.shipping_line2,
          city: formData.shipping_city,
          state: formData.shipping_state,
          zip: formData.shipping_zip,
          country: formData.shipping_country
        },
        description: formData.description || null,
        num_figures: formData.num_figures ? parseInt(formData.num_figures) : null,
        sku: formData.sku || null,
        product_id: selectedProduct?.id || null,
        shape: formData.shape || null,
        size: formData.size || null,
        orientation: formData.orientation || null,
        base_type: formData.base_type || null,
        has_background: formData.has_background,
        has_text: formData.has_text,
        unit_rate: formData.unit_rate ? parseFloat(formData.unit_rate) : null,
        total_amount: formData.total_amount ? parseFloat(formData.total_amount) : null,
        comments: formData.comments || null,
        internal_notes: formData.internal_notes || null,
        status: formData.status,
        assigned_artist_id: formData.assigned_artist_id ? parseInt(formData.assigned_artist_id) : null,
        assigned_qc_id: formData.assigned_qc_id ? parseInt(formData.assigned_qc_id) : null
      };

      await onSave(orderData, isEditMode ? order.id : null, imageFiles, existingImages);
      onClose();
    } catch (err) {
      setErrors({ submit: err.response?.data?.message || (isEditMode ? 'Failed to update order' : 'Failed to create order') });
    } finally {
      setSaving(false);
    }
  };

  const getStockBadge = () => {
    if (!selectedProduct) return null;
    const qty = selectedProduct.stock_quantity;
    const threshold = selectedProduct.low_stock_threshold || 50;
    if (qty === 0) return <span style={{ color: '#ef4444', fontWeight: 600, fontSize: '0.8rem' }}>Out of Stock</span>;
    if (qty < threshold) return <span style={{ color: '#f59e0b', fontWeight: 600, fontSize: '0.8rem' }}>Low Stock ({qty})</span>;
    return <span style={{ color: '#10b981', fontWeight: 600, fontSize: '0.8rem' }}>In Stock ({qty})</span>;
  };

  if (!isOpen) return null;

  // For Artists/Lead Artists/Production Tech: Show simplified view with just order info, image upload, and comments
  if (isLimitedRole && isEditMode) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '550px' }}>
          <div className="modal-header">
            <h2>Upload Images - {order?.internal_order_id}</h2>
            <button className="modal-close" onClick={onClose}>&times;</button>
          </div>
          <form className="modal-form" onSubmit={handleSubmit}>
            {/* Order Info - Read Only */}
            <div style={{ background: '#f9fafb', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.9rem' }}>
                <div><strong>Order ID:</strong> {order?.internal_order_id}</div>
                <div><strong>Type:</strong> {order?.order_type}</div>
                <div><strong>Status:</strong> {order?.status}</div>
                <div><strong>SKU:</strong> {order?.sku || '-'}</div>
                {order?.description && <div style={{ gridColumn: '1 / -1' }}><strong>Description:</strong> {order.description}</div>}
              </div>
            </div>

            {/* Image Upload - Multiple Images (up to 5) */}
            <div className="form-group">
              <label>Order Images <span style={{ color: '#6b7280', fontWeight: 'normal' }}>({imagePreviews.length}/{MAX_IMAGES})</span></label>
              <div style={{ border: '2px dashed #d1d5db', borderRadius: '8px', padding: '16px', background: '#f9fafb' }}>
                {imagePreviews.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: imagePreviews.length < MAX_IMAGES ? '16px' : '0' }}>
                    {imagePreviews.map((preview, index) => {
                      const isExistingImage = index < existingImages.length;
                      const canRemove = !isLimitedRole || !isExistingImage;
                      const isSelected = selectedImageForMetadata === index;
                      return (
                        <div key={index} style={{ position: 'relative', display: 'inline-block' }}>
                          <img
                            src={preview}
                            alt={`Order preview ${index + 1}`}
                            onClick={() => setSelectedImageForMetadata(isSelected ? null : index)}
                            style={{
                              width: '100px',
                              height: '100px',
                              borderRadius: '6px',
                              objectFit: 'cover',
                              border: isSelected ? '3px solid #722F37' : '1px solid #e5e7eb',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                            title="Click to select for metadata extraction"
                          />
                          {isSelected && (
                            <div
                              style={{
                                position: 'absolute',
                                top: '4px',
                                left: '4px',
                                background: '#722F37',
                                color: 'white',
                                borderRadius: '50%',
                                width: '20px',
                                height: '20px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '12px',
                                fontWeight: 'bold'
                              }}
                            >
                              ✓
                            </div>
                          )}
                          {canRemove && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeImage(index);
                              }}
                              style={{
                                position: 'absolute',
                                top: '-8px',
                                right: '-8px',
                                background: '#ef4444',
                                color: 'white',
                                border: 'none',
                                borderRadius: '50%',
                                width: '22px',
                                height: '22px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                lineHeight: '1',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                zIndex: 10
                              }}
                            >
                              &times;
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {imagePreviews.length < MAX_IMAGES && (
                  <div style={{ textAlign: 'center' }}>
                    <input
                      type="file"
                      id="images-artist"
                      accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                      onChange={handleImageChange}
                      multiple
                      style={{ display: 'none' }}
                    />
                    <label
                      htmlFor="images-artist"
                      style={{
                        cursor: 'pointer',
                        color: '#6b7280',
                        display: 'inline-block',
                        padding: '12px 20px',
                        border: '1px dashed #9ca3af',
                        borderRadius: '6px',
                        background: 'white'
                      }}
                    >
                      <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>+</div>
                      <div style={{ fontSize: '0.875rem' }}>Add Images</div>
                      <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '2px' }}>
                        JPEG, PNG, GIF, WebP (max 10MB each)
                      </div>
                    </label>
                  </div>
                )}
              </div>
              {errors.image && <span className="error-message">{errors.image}</span>}

              {/* Metadata Extraction Section for Artists */}
              {imagePreviews.length > 0 && existingImages.length > 0 && (
                <div style={{ marginTop: '12px', padding: '12px', background: '#FDF2F4', borderRadius: '6px', border: '1px solid #F4C2CC' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                    <div style={{ fontSize: '0.85rem', color: '#722F37' }}>
                      {selectedImageForMetadata !== null
                        ? `Image ${selectedImageForMetadata + 1} selected`
                        : 'Click image to extract metadata'}
                    </div>
                    <button
                      type="button"
                      onClick={handleExtractMetadata}
                      disabled={extractingMetadata || selectedImageForMetadata === null || selectedImageForMetadata >= existingImages.length}
                      style={{
                        padding: '8px 16px',
                        background: selectedImageForMetadata !== null && selectedImageForMetadata < existingImages.length ? '#722F37' : '#d1d5db',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: selectedImageForMetadata !== null && selectedImageForMetadata < existingImages.length ? 'pointer' : 'not-allowed',
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {extractingMetadata ? 'Extracting...' : 'Extract Metadata'}
                    </button>
                  </div>
                  {errors.metadata && (
                    <div style={{ marginTop: '8px', fontSize: '0.85rem', color: '#dc2626' }}>
                      {errors.metadata}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Internal Notes - For team communication */}
            <div className="form-group">
              <label htmlFor="internal_notes">Internal Notes <span style={{ color: '#6b7280', fontWeight: 'normal' }}>(Team Communication)</span></label>
              <textarea
                id="internal_notes"
                name="internal_notes"
                value={formData.internal_notes}
                onChange={handleChange}
                placeholder="Add notes for the team..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid #d1d5db',
                  fontSize: '0.9rem',
                  resize: 'vertical'
                }}
              />
            </div>

            {/* Assignment Dropdown - For Lead Artists only */}
            {permissions?.role === 'Lead Artist' && (
              <div className="form-group">
                <label htmlFor="assigned_artist_id">Assign to Artist</label>
                {console.log('🎨 Rendering dropdown - assignableUsers:', assignableUsers)}
                <select
                  id="assigned_artist_id"
                  name="assigned_artist_id"
                  value={formData.assigned_artist_id}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '4px',
                    border: '1px solid #d1d5db',
                    fontSize: '0.9rem'
                  }}
                >
                  <option value="">-- Not Assigned --</option>
                  {assignableUsers.length === 0 && console.log('⚠️ assignableUsers is EMPTY at render time!')}
                  {assignableUsers.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {errors.submit && (
              <div style={{ color: '#ef4444', fontSize: '0.875rem', marginBottom: '10px' }}>{errors.submit}</div>
            )}

            <div className="modal-actions">
              <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn-save" disabled={saving}>
                {saving ? 'Uploading...' : 'Save Images'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '650px' }}>
        <div className="modal-header">
          <h2>{isEditMode ? 'Edit Order' : 'Create New Order'}</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form className="modal-form" onSubmit={handleSubmit}>
          {/* Order Type & Status (Status only in edit mode) */}
          <div style={{ display: 'grid', gridTemplateColumns: isEditMode ? '1fr 1fr 1fr' : '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label htmlFor="order_type">Order Type *</label>
              <select id="order_type" name="order_type" value={formData.order_type} onChange={handleChange} className={errors.order_type ? 'error' : ''}>
                <option value="Amazon">Amazon</option>
                <option value="Shopify">Shopify</option>
                <option value="Etsy">Etsy</option>
                <option value="B2B">B2B</option>
                <option value="Personal">Personal</option>
              </select>
              {errors.order_type && <span className="error-message">{errors.order_type}</span>}
            </div>
            {isEditMode && (
              <div className="form-group">
                <label htmlFor="status">Status</label>
                <select id="status" name="status" value={formData.status} onChange={handleChange}>
                  <option value="Pending">Pending</option>
                  <option value="Processing">Processing</option>
                  <option value="Ready to Print">Ready to Print</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                  <option value="Shipped">Shipped</option>
                </select>
              </div>
            )}
            <div className="form-group">
              <label htmlFor="platform_order_id">Platform Order ID</label>
              <input type="text" id="platform_order_id" name="platform_order_id" value={formData.platform_order_id} onChange={handleChange} placeholder="e.g. 114-1234567-1234567" />
            </div>
          </div>

          {/* Assignment Dropdowns (Admin/SuperAdmin/Lead Artist, Edit mode only) */}
          {isEditMode && (permissions?.role === 'Admin' || permissions?.role === 'SuperAdmin' || permissions?.role === 'Lead Artist') && (
            <div style={{ display: 'grid', gridTemplateColumns: permissions?.role === 'Lead Artist' ? '1fr' : '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label htmlFor="assigned_artist_id">
                  {permissions?.role === 'Lead Artist' ? 'Assign to Artist' : 'Assigned Artist'}
                </label>
                <select
                  id="assigned_artist_id"
                  name="assigned_artist_id"
                  value={formData.assigned_artist_id}
                  onChange={handleChange}
                >
                  <option value="">-- Not Assigned --</option>
                  {assignableUsers.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.role})
                    </option>
                  ))}
                </select>
              </div>
              {(permissions?.role === 'Admin' || permissions?.role === 'SuperAdmin') && (
                <div className="form-group">
                  <label htmlFor="assigned_qc_id">Assigned QC</label>
                  <select
                    id="assigned_qc_id"
                    name="assigned_qc_id"
                    value={formData.assigned_qc_id}
                    onChange={handleChange}
                  >
                    <option value="">-- Not Assigned --</option>
                    {assignableUsers.map(user => (
                      <option key={user.id} value={user.id}>
                        {user.name} ({user.role})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Company (B2B only) */}
          {formData.order_type === 'B2B' && (
            <div className="form-group">
              <label htmlFor="company_id">Company *</label>
              <select id="company_id" name="company_id" value={formData.company_id} onChange={handleChange} className={errors.company_id ? 'error' : ''}>
                <option value="">-- Select a Company --</option>
                {companies.filter(c => c.is_active).map(company => (
                  <option key={company.id} value={company.id}>{company.name}</option>
                ))}
              </select>
              {errors.company_id && <span className="error-message">{errors.company_id}</span>}
            </div>
          )}

          {/* Customer */}
          <div className="form-group">
            <label htmlFor="customer_email">Customer Email *</label>
            <input type="email" id="customer_email" name="customer_email" value={formData.customer_email} onChange={handleChange} placeholder="customer@example.com" className={errors.customer_email ? 'error' : ''} />
            {errors.customer_email && <span className="error-message">{errors.customer_email}</span>}
          </div>

          {/* Product / SKU Selection */}
          <div className="form-group">
            <label htmlFor="sku">Product SKU</label>
            <select id="sku" name="sku" value={formData.sku} onChange={handleChange}>
              <option value="">-- Select Product (optional) --</option>
              {catalog.map(p => (
                <option key={p.id} value={p.sku}>
                  {p.sku} - {p.display_name} (${p.price.toFixed(2)})
                </option>
              ))}
            </select>
            {selectedProduct && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
                {getStockBadge()}
                <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                  ${selectedProduct.price.toFixed(2)} per unit
                </span>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="form-group">
            <label htmlFor="description">Description</label>
            <input type="text" id="description" name="description" value={formData.description} onChange={handleChange} placeholder="Order description" />
          </div>

          {/* Image Upload - Multiple Images (up to 5) */}
          <div className="form-group">
            <label>Order Images <span style={{ color: '#6b7280', fontWeight: 'normal' }}>({imagePreviews.length}/{MAX_IMAGES})</span></label>
            <div style={{ border: '2px dashed #d1d5db', borderRadius: '8px', padding: '16px', background: '#f9fafb' }}>
              {imagePreviews.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: imagePreviews.length < MAX_IMAGES ? '16px' : '0' }}>
                  {imagePreviews.map((preview, index) => {
                    const isExistingImage = index < existingImages.length;
                    const canRemove = !isLimitedRole || !isExistingImage;
                    const isSelected = selectedImageForMetadata === index;
                    return (
                      <div key={index} style={{ position: 'relative', display: 'inline-block' }}>
                        <img
                          src={preview}
                          alt={`Order preview ${index + 1}`}
                          onClick={() => setSelectedImageForMetadata(isSelected ? null : index)}
                          style={{
                            width: '100px',
                            height: '100px',
                            borderRadius: '6px',
                            objectFit: 'cover',
                            border: isSelected ? '3px solid #722F37' : '1px solid #e5e7eb',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                          title="Click to select for metadata extraction"
                        />
                        {isSelected && (
                          <div
                            style={{
                              position: 'absolute',
                              top: '4px',
                              left: '4px',
                              background: '#722F37',
                              color: 'white',
                              borderRadius: '50%',
                              width: '20px',
                              height: '20px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '12px',
                              fontWeight: 'bold'
                            }}
                          >
                            ✓
                          </div>
                        )}
                        {canRemove && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeImage(index);
                            }}
                            style={{
                              position: 'absolute',
                              top: '-8px',
                              right: '-8px',
                              background: '#ef4444',
                              color: 'white',
                              border: 'none',
                              borderRadius: '50%',
                              width: '22px',
                              height: '22px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              lineHeight: '1',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              zIndex: 10
                            }}
                          >
                            &times;
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {imagePreviews.length < MAX_IMAGES && (
                <div style={{ textAlign: 'center' }}>
                  <input
                    type="file"
                    id="images"
                    accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                    onChange={handleImageChange}
                    multiple
                    style={{ display: 'none' }}
                  />
                  <label
                    htmlFor="images"
                    style={{
                      cursor: 'pointer',
                      color: '#6b7280',
                      display: 'inline-block',
                      padding: '12px 20px',
                      border: '1px dashed #9ca3af',
                      borderRadius: '6px',
                      background: 'white'
                    }}
                  >
                    <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>+</div>
                    <div style={{ fontSize: '0.875rem' }}>Add Images</div>
                    <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '2px' }}>
                      JPEG, PNG, GIF, WebP (max 10MB each)
                    </div>
                  </label>
                </div>
              )}
            </div>
            {errors.image && <span className="error-message">{errors.image}</span>}

            {/* Metadata Extraction Section */}
            {imagePreviews.length > 0 && existingImages.length > 0 && (
              <div style={{ marginTop: '12px', padding: '12px', background: '#FDF2F4', borderRadius: '6px', border: '1px solid #F4C2CC' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                  <div style={{ fontSize: '0.85rem', color: '#722F37' }}>
                    {selectedImageForMetadata !== null
                      ? `Image ${selectedImageForMetadata + 1} selected for metadata extraction`
                      : 'Click on an image to select it for AI metadata extraction'}
                  </div>
                  <button
                    type="button"
                    onClick={handleExtractMetadata}
                    disabled={extractingMetadata || selectedImageForMetadata === null || selectedImageForMetadata >= existingImages.length}
                    style={{
                      padding: '8px 16px',
                      background: selectedImageForMetadata !== null && selectedImageForMetadata < existingImages.length ? '#722F37' : '#d1d5db',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: selectedImageForMetadata !== null && selectedImageForMetadata < existingImages.length ? 'pointer' : 'not-allowed',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {extractingMetadata ? 'Extracting...' : 'Extract Metadata'}
                  </button>
                </div>
                {errors.metadata && (
                  <div style={{ marginTop: '8px', fontSize: '0.85rem', color: '#dc2626' }}>
                    {errors.metadata}
                  </div>
                )}
                {selectedImageForMetadata !== null && selectedImageForMetadata >= existingImages.length && (
                  <div style={{ marginTop: '8px', fontSize: '0.85rem', color: '#d97706' }}>
                    Note: Save the order first to extract metadata from newly uploaded images
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Figures and Pricing */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label htmlFor="num_figures">Figures</label>
              <input type="number" id="num_figures" name="num_figures" value={formData.num_figures} onChange={handleChange} min="1" />
            </div>
            <div className="form-group">
              <label htmlFor="unit_rate">Unit Rate ($)</label>
              <input type="number" id="unit_rate" name="unit_rate" value={formData.unit_rate} onChange={handleChange} step="0.01" min="0" placeholder="0.00" />
            </div>
            <div className="form-group">
              <label htmlFor="total_amount">Total ($)</label>
              <input type="number" id="total_amount" name="total_amount" value={formData.total_amount} onChange={handleChange} step="0.01" min="0" placeholder="0.00" />
            </div>
          </div>

          {/* Options */}
          <div style={{ display: 'flex', gap: '20px', marginBottom: '16px' }}>
            <div className="checkbox-group">
              <label>
                <input type="checkbox" name="has_background" checked={formData.has_background} onChange={handleChange} />
                <span>Has Background</span>
              </label>
            </div>
            <div className="checkbox-group">
              <label>
                <input type="checkbox" name="has_text" checked={formData.has_text} onChange={handleChange} />
                <span>Has Text</span>
              </label>
            </div>
          </div>

          {/* Shipping Address */}
          <div style={{ background: '#f9fafb', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
            <label style={{ fontWeight: 600, marginBottom: '12px', display: 'block', color: '#374151' }}>Shipping Address</label>
            <div className="form-group" style={{ marginBottom: '12px' }}>
              <input type="text" name="shipping_name" value={formData.shipping_name} onChange={handleChange} placeholder="Recipient name" />
            </div>
            <div className="form-group" style={{ marginBottom: '12px' }}>
              <input type="text" name="shipping_line1" value={formData.shipping_line1} onChange={handleChange} placeholder="Address line 1" />
            </div>
            <div className="form-group" style={{ marginBottom: '12px' }}>
              <input type="text" name="shipping_line2" value={formData.shipping_line2} onChange={handleChange} placeholder="Address line 2 (optional)" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px' }}>
              <input type="text" name="shipping_city" value={formData.shipping_city} onChange={handleChange} placeholder="City" style={{ padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px' }} />
              <input type="text" name="shipping_state" value={formData.shipping_state} onChange={handleChange} placeholder="State" style={{ padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px' }} />
              <input type="text" name="shipping_zip" value={formData.shipping_zip} onChange={handleChange} placeholder="ZIP" style={{ padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px' }} />
            </div>
          </div>

          {/* Comments */}
          <div className="form-group">
            <label htmlFor="comments">Comments</label>
            <input type="text" id="comments" name="comments" value={formData.comments} onChange={handleChange} placeholder="Additional notes" />
          </div>

          {/* Internal Notes - Editable by Artists/Lead Artists/Production Tech */}
          <div className="form-group">
            <label htmlFor="internal_notes">Internal Notes <span style={{ color: '#6b7280', fontWeight: 'normal' }}>(Team Communication)</span></label>
            <textarea
              id="internal_notes"
              name="internal_notes"
              value={formData.internal_notes}
              onChange={handleChange}
              placeholder="Add notes for the team..."
              rows={3}
            />
          </div>

          {errors.submit && (
            <div style={{ color: '#ef4444', fontSize: '0.875rem', marginBottom: '10px' }}>{errors.submit}</div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-save" disabled={saving}>
              {saving ? (isEditMode ? 'Updating...' : 'Creating...') : (isEditMode ? 'Update Order' : 'Create Order')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OrderModal;
