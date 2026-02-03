import { useState, useEffect } from 'react';
import { usersApi, permissionsApi, setAuthToken } from '../utils/api';
import { useAuth0 } from '@auth0/auth0-react';
import RolePermissions from './RolePermissions';
import CompaniesTab from './CompaniesTab';
import UserModal from '../components/UserModal';
import './UserManagement.css';

const ROLES = ['SuperAdmin', 'Admin', 'Lead Artist', 'Artist', 'Production Tech'];

const UserManagement = () => {
  const { getIdTokenClaims, user } = useAuth0();
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' or 'edit'
  const [selectedUser, setSelectedUser] = useState(null);

  // Pagination
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 0
  });

  // Filters
  const [filters, setFilters] = useState({
    role: '',
    is_active: '',
    search: ''
  });

  useEffect(() => {
    loadCurrentUser();
    loadUsers();
  }, [pagination.page, filters]);

  const loadCurrentUser = async () => {
    try {
      const idToken = await getIdTokenClaims();
      setAuthToken(idToken.__raw);

      // Fetch role from backend (database is source of truth)
      const response = await permissionsApi.getCurrentUser();
      const role = response.data.data.role;

      setCurrentUser({ ...user, role });
    } catch (error) {
      console.error('Failed to load current user:', error);
    }
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      const idToken = await getIdTokenClaims();
      setAuthToken(idToken.__raw);

      const params = {
        page: pagination.page,
        limit: pagination.limit,
        ...(filters.role && { role: filters.role }),
        ...(filters.is_active !== '' && { is_active: filters.is_active }),
        ...(filters.search && { search: filters.search })
      };

      const response = await usersApi.getAll(params);
      console.log('Loaded users:', response.data.data);
      setUsers(response.data.data);
      setPagination(response.data.pagination);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load users:', error);
      setMessage({ type: 'error', text: 'Failed to load users' });
      setLoading(false);
    }
  };

  const getUserStatus = (user) => {
    if (!user.is_active || user.status === 'suspended') return 'Inactive';
    return 'Active';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Active': return '#10b981';
      case 'Inactive': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page
  };

  const clearFilters = () => {
    setFilters({ role: '', is_active: '', search: '' });
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

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      const idToken = await getIdTokenClaims();
      setAuthToken(idToken.__raw);

      await usersApi.delete(userId);
      setMessage({ type: 'success', text: 'User deleted successfully' });
      loadUsers();

      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Failed to delete user:', error);
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to delete user' });
    }
  };

  const handleToggleUserStatus = async (user) => {
    const isActive = user.is_active;
    const action = isActive ? 'disable' : 'enable';

    if (!window.confirm(`Are you sure you want to ${action} user ${user.email}?`)) {
      return;
    }

    try {
      const idToken = await getIdTokenClaims();
      setAuthToken(idToken.__raw);

      if (isActive) {
        await usersApi.suspend(user.auth0_user_id);
        setMessage({ type: 'success', text: `User ${user.email} has been disabled` });
      } else {
        await usersApi.reactivate(user.auth0_user_id);
        setMessage({ type: 'success', text: `User ${user.email} has been enabled` });
      }

      loadUsers();
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error(`Failed to ${action} user:`, error);
      setMessage({ type: 'error', text: error.response?.data?.message || `Failed to ${action} user` });
    }
  };

  const handleModalSave = async (formData) => {
    try {
      const idToken = await getIdTokenClaims();
      setAuthToken(idToken.__raw);

      if (modalMode === 'add') {
        console.log('Creating user:', formData);
        await usersApi.create(formData);
        setMessage({ type: 'success', text: 'User added successfully' });
      } else {
        console.log('Updating user:', selectedUser.id, formData);
        const response = await usersApi.update(selectedUser.id, formData);
        console.log('Update response:', response.data);
        setMessage({ type: 'success', text: 'User updated successfully' });
      }

      setIsModalOpen(false);
      await loadUsers();

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

  const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'SuperAdmin';
  const isSuperAdmin = currentUser?.role === 'SuperAdmin';

  if (loading && activeTab === 'users') {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading users...</p>
      </div>
    );
  }

  return (
    <div className="user-management">
      <div className="tabs-container">
        <button
          className={`tab ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          Users
        </button>
        <button
          className={`tab ${activeTab === 'roles' ? 'active' : ''}`}
          onClick={() => setActiveTab('roles')}
        >
          Role Permissions
        </button>
        {isSuperAdmin && (
          <button
            className={`tab ${activeTab === 'companies' ? 'active' : ''}`}
            onClick={() => setActiveTab('companies')}
          >
            Companies
          </button>
        )}
      </div>

      {activeTab === 'users' ? (
        <>
          <div className="page-header">
            <div>
              <h1>User Management</h1>
              <p>Manage users and their roles in the system</p>
            </div>
            {isAdmin && (
              <button className="add-btn" onClick={handleAddUser}>
                + Add User
              </button>
            )}
          </div>

          {message && (
        <div className={`message ${message.type}`}>
          {message.text}
            </div>
          )}

          {/* Filters */}
          <div className="filters-section">
            <div className="filter-group">
              <input
                type="text"
                placeholder="Search by email or name..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="search-input"
              />
            </div>

            <div className="filter-group">
              <label>Role:</label>
              <select
                value={filters.role}
                onChange={(e) => handleFilterChange('role', e.target.value)}
              >
                <option value="">All Roles</option>
                {ROLES.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Status:</label>
              <select
                value={filters.is_active}
                onChange={(e) => handleFilterChange('is_active', e.target.value)}
              >
                <option value="">All Status</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>

            {(filters.role || filters.is_active || filters.search) && (
              <button onClick={clearFilters} className="clear-filters-btn">
                Clear Filters
              </button>
            )}
          </div>

          {/* Users Table */}
          <div className="users-table-container">
            <table className="users-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Last Login</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="no-data">
                      No users found
                    </td>
                  </tr>
                ) : (
                  users.map(user => {
                    const status = getUserStatus(user);
                    return (
                      <tr key={user.id}>
                        <td>{user.name || <em>Not set</em>}</td>
                        <td>{user.email}</td>
                        <td>
                          <span className="role-badge">{user.role}</span>
                        </td>
                        <td>
                          <span
                            className="status-badge"
                            style={{ backgroundColor: getStatusColor(status) }}
                          >
                            {status}
                          </span>
                        </td>
                        <td>{formatDate(user.created_at)}</td>
                        <td>{formatDate(user.last_login)}</td>
                        <td className="actions-cell">
                          {isAdmin && (
                            <button
                              className="action-btn edit-btn"
                              onClick={() => handleEditUser(user)}
                              title="Edit User"
                            >
                              Edit
                            </button>
                          )}
                          {isSuperAdmin && user.role !== 'SuperAdmin' && (
                            <button
                              className={`action-btn ${user.is_active ? 'disable-btn' : 'enable-btn'}`}
                              onClick={() => handleToggleUserStatus(user)}
                              title={user.is_active ? 'Disable User' : 'Enable User'}
                            >
                              {user.is_active ? 'Disable' : 'Enable'}
                            </button>
                          )}
                          {isSuperAdmin && user.role !== 'SuperAdmin' && (
                            <button
                              className="action-btn delete-btn"
                              onClick={() => handleDeleteUser(user.id)}
                              title="Delete User"
                            >
                              Delete
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="pagination">
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page === 1}
                className="pagination-btn"
              >
                Previous
              </button>
              <span className="pagination-info">
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} total users)
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
      ) : activeTab === 'roles' ? (
        <RolePermissions />
      ) : activeTab === 'companies' && isSuperAdmin ? (
        <CompaniesTab />
      ) : null}

      <UserModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSave={handleModalSave}
        user={selectedUser}
        mode={modalMode}
      />
    </div>
  );
};

export default UserManagement;
