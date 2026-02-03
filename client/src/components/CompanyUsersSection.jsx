import { useState, useEffect } from 'react';
import { companiesApi, setAuthToken } from '../utils/api';
import { useAuth0 } from '@auth0/auth0-react';
import CompanyUserModal from './CompanyUserModal';
import './CompanyUsersSection.css';

const CompanyUsersSection = ({ company, onClose }) => {
  const { getIdTokenClaims } = useAuth0();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [selectedUser, setSelectedUser] = useState(null);

  // Pagination
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  });

  // Filters
  const [filters, setFilters] = useState({
    search: '',
    is_active: ''
  });

  useEffect(() => {
    loadCompanyUsers();
  }, [company.id, pagination.page, filters]);

  const loadCompanyUsers = async () => {
    try {
      setLoading(true);
      const idToken = await getIdTokenClaims();
      setAuthToken(idToken.__raw);

      const params = {
        page: pagination.page,
        limit: pagination.limit,
        ...(filters.search && { search: filters.search }),
        ...(filters.is_active !== '' && { is_active: filters.is_active })
      };

      const response = await companiesApi.getUsers(company.id, params);
      setUsers(response.data.data);
      setPagination(response.data.pagination);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load company users:', error);
      setMessage({ type: 'error', text: 'Failed to load company users' });
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const clearFilters = () => {
    setFilters({ search: '', is_active: '' });
  };

  const handleAddUser = () => {
    setModalMode('add');
    setSelectedUser(null);
    setIsModalOpen(true);
  };

  const handleEditUser = (user) => {
    setModalMode('edit');
    setSelectedUser(user);
    setIsModalOpen(true);
  };

  const handleToggleStatus = async (user) => {
    const action = user.is_active ? 'disable' : 'enable';
    if (!window.confirm(`Are you sure you want to ${action} ${user.name || user.email}?`)) {
      return;
    }

    try {
      const idToken = await getIdTokenClaims();
      setAuthToken(idToken.__raw);
      await companiesApi.toggleUserStatus(company.id, user.id);
      setMessage({ type: 'success', text: `User ${action}d successfully` });
      loadCompanyUsers();
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error(`Failed to ${action} user:`, error);
      setMessage({ type: 'error', text: error.response?.data?.message || `Failed to ${action} user` });
    }
  };

  const handleDeleteUser = async (user) => {
    if (!window.confirm(`Are you sure you want to remove ${user.name || user.email} from this company? This will also block their Auth0 account.`)) {
      return;
    }

    try {
      const idToken = await getIdTokenClaims();
      setAuthToken(idToken.__raw);
      await companiesApi.deleteUser(company.id, user.id);
      setMessage({ type: 'success', text: 'User removed from company successfully' });
      loadCompanyUsers();
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Failed to remove user:', error);
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to remove user' });
    }
  };

  const handleModalSave = async (formData) => {
    try {
      const idToken = await getIdTokenClaims();
      setAuthToken(idToken.__raw);

      if (modalMode === 'add') {
        await companiesApi.createUser(company.id, formData);
        setMessage({ type: 'success', text: 'User added to company successfully' });
      } else {
        await companiesApi.updateUser(company.id, selectedUser.id, formData);
        setMessage({ type: 'success', text: 'User updated successfully' });
      }

      setIsModalOpen(false);
      await loadCompanyUsers();
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Failed to save user:', error);
      setMessage({
        type: 'error',
        text: error.response?.data?.message || `Failed to ${modalMode} user`
      });
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedUser(null);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="company-users-section">
      <div className="company-users-header">
        <div className="company-users-title">
          <h3>Users in {company.name}</h3>
          <span className="user-count">{pagination.total} user{pagination.total !== 1 ? 's' : ''}</span>
        </div>
        <div className="company-users-actions">
          <button className="add-user-btn" onClick={handleAddUser}>
            + Add User
          </button>
          <button className="close-section-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      {message && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}

      {/* Filters */}
      <div className="company-users-filters">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={filters.search}
          onChange={(e) => handleFilterChange('search', e.target.value)}
          className="search-input"
        />
        <select
          value={filters.is_active}
          onChange={(e) => handleFilterChange('is_active', e.target.value)}
        >
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
        {(filters.search || filters.is_active) && (
          <button onClick={clearFilters} className="clear-filters-btn">
            Clear
          </button>
        )}
      </div>

      {loading ? (
        <div className="loading-users">Loading users...</div>
      ) : users.length === 0 ? (
        <div className="no-users">
          <p>No users found in this company.</p>
          <button onClick={handleAddUser} className="add-first-user-btn">
            Add First User
          </button>
        </div>
      ) : (
        <>
          <table className="company-users-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id}>
                  <td>{user.name || '-'}</td>
                  <td>{user.email}</td>
                  <td>
                    <span className="role-badge">{user.role}</span>
                  </td>
                  <td>
                    <span
                      className="status-badge"
                      style={{ backgroundColor: user.is_active ? '#10b981' : '#ef4444' }}
                    >
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>{formatDate(user.created_at)}</td>
                  <td className="actions-cell">
                    <button
                      className="action-btn edit-btn"
                      onClick={() => handleEditUser(user)}
                      title="Edit User"
                    >
                      Edit
                    </button>
                    <button
                      className={`action-btn ${user.is_active ? 'disable-btn' : 'enable-btn'}`}
                      onClick={() => handleToggleStatus(user)}
                      title={user.is_active ? 'Disable User' : 'Enable User'}
                    >
                      {user.is_active ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      className="action-btn delete-btn"
                      onClick={() => handleDeleteUser(user)}
                      title="Remove User"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="company-users-pagination">
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page === 1}
                className="pagination-btn"
              >
                Previous
              </button>
              <span className="pagination-info">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page === pagination.totalPages}
                className="pagination-btn"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      <CompanyUserModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSave={handleModalSave}
        user={selectedUser}
        mode={modalMode}
        companyName={company.name}
      />
    </div>
  );
};

export default CompanyUsersSection;
