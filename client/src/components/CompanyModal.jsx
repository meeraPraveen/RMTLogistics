import React, { useState, useEffect } from 'react';
import './UserModal.css';

const AVAILABLE_MODULES = [
  { id: 'order_management', name: 'Order Management' },
  { id: 'inventory_management', name: 'Inventory Management' },
  { id: 'printing_software', name: 'Printing Software' },
  { id: 'user_management', name: 'User Management' },
  { id: 'system_config', name: 'System Configuration' }
];

const CompanyModal = ({ isOpen, onClose, onSave, company, mode }) => {
  const [formData, setFormData] = useState({
    name: '',
    enabled_modules: ['order_management'],
    is_active: true
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (company && mode === 'edit') {
      setFormData({
        name: company.name || '',
        enabled_modules: company.enabled_modules || ['order_management'],
        is_active: company.is_active !== undefined ? company.is_active : true
      });
    } else {
      setFormData({
        name: '',
        enabled_modules: ['order_management'],
        is_active: true
      });
    }
    setErrors({});
  }, [company, mode, isOpen]);

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name.trim()) {
      newErrors.name = 'Company name is required';
    }
    if (formData.enabled_modules.length === 0) {
      newErrors.enabled_modules = 'At least one module must be enabled';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validateForm()) {
      onSave(formData);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const handleModuleToggle = (moduleId) => {
    setFormData(prev => {
      const modules = prev.enabled_modules.includes(moduleId)
        ? prev.enabled_modules.filter(m => m !== moduleId)
        : [...prev.enabled_modules, moduleId];
      return { ...prev, enabled_modules: modules };
    });
    if (errors.enabled_modules) {
      setErrors(prev => ({ ...prev, enabled_modules: undefined }));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{mode === 'add' ? 'Add New Company' : 'Edit Company'}</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label htmlFor="name">Company Name *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className={errors.name ? 'error' : ''}
              placeholder="Enter company name"
            />
            {errors.name && <span className="error-message">{errors.name}</span>}
          </div>

          <div className="form-group">
            <label>Enabled Modules *</label>
            <div className="modules-grid">
              {AVAILABLE_MODULES.map(module => (
                <label key={module.id} className="module-checkbox">
                  <input
                    type="checkbox"
                    checked={formData.enabled_modules.includes(module.id)}
                    onChange={() => handleModuleToggle(module.id)}
                  />
                  <span>{module.name}</span>
                </label>
              ))}
            </div>
            {errors.enabled_modules && <span className="error-message">{errors.enabled_modules}</span>}
          </div>

          {mode === 'edit' && (
            <div className="form-group checkbox-group">
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

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn-cancel">
              Cancel
            </button>
            <button type="submit" className="btn-save">
              {mode === 'add' ? 'Create Company' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CompanyModal;
