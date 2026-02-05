import { useState, useEffect } from 'react';
import './UserModal.css';

// B2B roles - excludes SuperAdmin
const COMPANY_ROLES = ['Admin', 'Lead Artist', 'Artist', 'Production Tech', 'B2B User'];

const CompanyUserModal = ({ isOpen, onClose, onSave, user, mode, companyName }) => {
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    role: '',
    is_active: true
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (user && mode === 'edit') {
      setFormData({
        email: user.email || '',
        name: user.name || '',
        role: user.role || '',
        is_active: user.is_active !== undefined ? user.is_active : true
      });
    } else {
      setFormData({
        email: '',
        name: '',
        role: '',
        is_active: true
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
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
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
          <h2>{mode === 'add' ? `Add User to ${companyName}` : 'Edit Company User'}</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label htmlFor="company-user-email">Email *</label>
            <input
              type="email"
              id="company-user-email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              disabled={mode === 'edit'}
              className={errors.email ? 'error' : ''}
              placeholder="user@example.com"
            />
            {errors.email && <span className="error-message">{errors.email}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="company-user-name">Name *</label>
            <input
              type="text"
              id="company-user-name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className={errors.name ? 'error' : ''}
              placeholder="Full name"
            />
            {errors.name && <span className="error-message">{errors.name}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="company-user-role">Role</label>
            <select
              id="company-user-role"
              name="role"
              value={formData.role}
              onChange={handleChange}
            >
              <option value="">-- No Role (cannot login) --</option>
              {COMPANY_ROLES.map(role => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
            {!formData.role && (
              <span className="form-hint">User will not be able to login until a role is assigned</span>
            )}
            {formData.role && (
              <small className="form-hint">Company users cannot have SuperAdmin role</small>
            )}
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
              {mode === 'add' ? 'Add User' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CompanyUserModal;
