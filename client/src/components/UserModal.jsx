import React, { useState, useEffect } from 'react';
import './UserModal.css';

const ROLES = ['SuperAdmin', 'Admin', 'Lead Artist', 'Artist', 'Production Tech', 'B2B User'];

const UserModal = ({ isOpen, onClose, onSave, user, mode, companies = [] }) => {
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    role: '',
    is_active: true,
    company_id: ''
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (user && mode === 'edit') {
      setFormData({
        email: user.email || '',
        name: user.name || '',
        role: user.role || '',
        is_active: user.is_active !== undefined ? user.is_active : true,
        company_id: user.company_id || ''
      });
    } else {
      setFormData({
        email: '',
        name: '',
        role: '',
        is_active: true,
        company_id: ''
      });
    }
    setErrors({});
  }, [user, mode, isOpen]);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (mode === 'add') {
      if (!formData.email.trim()) {
        newErrors.email = 'Email is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        newErrors.email = 'Invalid email format';
      }
    }

    // Role is optional - user can be created without one

    // Company is required when role is B2B User
    if (formData.role === 'B2B User' && !formData.company_id) {
      newErrors.company_id = 'Company is required for B2B User role';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validateForm()) {
      const submitData = {
        ...formData,
        role: formData.role || null
      };
      onSave(submitData);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => {
      const updated = {
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      };
      // Clear company_id when switching away from B2B User role
      if (name === 'role' && value !== 'B2B User') {
        updated.company_id = '';
      }
      return updated;
    });
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{mode === 'add' ? 'Add New User' : 'Edit User'}</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label htmlFor="email">Email *</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              disabled={mode === 'edit'}
              className={errors.email ? 'error' : ''}
            />
            {errors.email && <span className="error-message">{errors.email}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="name">Name *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className={errors.name ? 'error' : ''}
            />
            {errors.name && <span className="error-message">{errors.name}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="role">Role</label>
            <select
              id="role"
              name="role"
              value={formData.role}
              onChange={handleChange}
            >
              <option value="">-- No Role (cannot login) --</option>
              {ROLES.map(role => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
            {!formData.role && (
              <span className="form-hint">User will not be able to login until a role is assigned</span>
            )}
          </div>

          {formData.role === 'B2B User' && (
            <div className="form-group">
              <label htmlFor="company_id">Company *</label>
              <select
                id="company_id"
                name="company_id"
                value={formData.company_id}
                onChange={handleChange}
                className={errors.company_id ? 'error' : ''}
              >
                <option value="">-- Select a Company --</option>
                {companies.filter(c => c.is_active).map(company => (
                  <option key={company.id} value={company.id}>{company.name}</option>
                ))}
              </select>
              {errors.company_id && <span className="error-message">{errors.company_id}</span>}
            </div>
          )}

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
              {mode === 'add' ? 'Add User' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserModal;
