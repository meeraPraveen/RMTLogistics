import { useState, useEffect } from 'react';
import { companiesApi, setAuthToken } from '../utils/api';
import { useAuth0 } from '@auth0/auth0-react';
import CompanyModal from '../components/CompanyModal';

const CompaniesTab = () => {
  const { getIdTokenClaims } = useAuth0();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [selectedCompany, setSelectedCompany] = useState(null);

  // Pagination
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 0
  });

  // Filters
  const [filters, setFilters] = useState({
    search: '',
    is_active: ''
  });

  useEffect(() => {
    loadCompanies();
  }, [pagination.page, filters]);

  const loadCompanies = async () => {
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

      const response = await companiesApi.getAll(params);
      setCompanies(response.data.data);
      setPagination(response.data.pagination);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load companies:', error);
      setMessage({ type: 'error', text: 'Failed to load companies' });
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

  const handleAddCompany = () => {
    setModalMode('add');
    setSelectedCompany(null);
    setIsModalOpen(true);
  };

  const handleEditCompany = (company) => {
    setModalMode('edit');
    setSelectedCompany(company);
    setIsModalOpen(true);
  };

  const handleDeleteCompany = async (companyId) => {
    if (!window.confirm('Are you sure you want to delete this company? This will also delete the Auth0 Organization.')) {
      return;
    }

    try {
      const idToken = await getIdTokenClaims();
      setAuthToken(idToken.__raw);
      await companiesApi.delete(companyId);
      setMessage({ type: 'success', text: 'Company deleted successfully' });
      loadCompanies();
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Failed to delete company:', error);
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to delete company' });
    }
  };

  const handleToggleStatus = async (company) => {
    const action = company.is_active ? 'disable' : 'enable';
    if (!window.confirm(`Are you sure you want to ${action} ${company.name}?`)) {
      return;
    }

    try {
      const idToken = await getIdTokenClaims();
      setAuthToken(idToken.__raw);
      await companiesApi.toggleStatus(company.id);
      setMessage({ type: 'success', text: `Company ${action}d successfully` });
      loadCompanies();
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error(`Failed to ${action} company:`, error);
      setMessage({ type: 'error', text: error.response?.data?.message || `Failed to ${action} company` });
    }
  };

  const handleModalSave = async (formData) => {
    try {
      const idToken = await getIdTokenClaims();
      setAuthToken(idToken.__raw);

      if (modalMode === 'add') {
        await companiesApi.create(formData);
        setMessage({ type: 'success', text: 'Company created successfully' });
      } else {
        await companiesApi.update(selectedCompany.id, formData);
        setMessage({ type: 'success', text: 'Company updated successfully' });
      }

      setIsModalOpen(false);
      await loadCompanies();
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Failed to save company:', error);
      setMessage({
        type: 'error',
        text: error.response?.data?.message || `Failed to ${modalMode} company`
      });
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedCompany(null);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatModules = (modules) => {
    if (!modules || modules.length === 0) return 'None';
    return modules.map(m => m.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())).join(', ');
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading companies...</p>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Company Management</h1>
          <p>Manage companies and their Auth0 Organizations</p>
        </div>
        <button className="add-btn" onClick={handleAddCompany}>
          + Add Company
        </button>
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
            placeholder="Search by name..."
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            className="search-input"
          />
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

        {(filters.search || filters.is_active) && (
          <button onClick={clearFilters} className="clear-filters-btn">
            Clear Filters
          </button>
        )}
      </div>

      {/* Companies Table */}
      <div className="users-table-container">
        <table className="users-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Auth0 Org ID</th>
              <th>Enabled Modules</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {companies.length === 0 ? (
              <tr>
                <td colSpan="6" className="no-data">
                  No companies found
                </td>
              </tr>
            ) : (
              companies.map(company => (
                <tr key={company.id}>
                  <td><strong>{company.name}</strong></td>
                  <td>
                    {company.org_id ? (
                      <code style={{ fontSize: '0.85em', background: '#f0f0f0', padding: '2px 6px', borderRadius: '4px' }}>
                        {company.org_id}
                      </code>
                    ) : (
                      <em style={{ color: '#999' }}>Not synced</em>
                    )}
                  </td>
                  <td style={{ maxWidth: '200px' }}>
                    <span style={{ fontSize: '0.9em' }}>
                      {formatModules(company.enabled_modules)}
                    </span>
                  </td>
                  <td>
                    <span
                      className="status-badge"
                      style={{ backgroundColor: company.is_active ? '#10b981' : '#ef4444' }}
                    >
                      {company.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>{formatDate(company.created_at)}</td>
                  <td className="actions-cell">
                    <button
                      className="action-btn edit-btn"
                      onClick={() => handleEditCompany(company)}
                      title="Edit Company"
                    >
                      Edit
                    </button>
                    <button
                      className={`action-btn ${company.is_active ? 'disable-btn' : 'enable-btn'}`}
                      onClick={() => handleToggleStatus(company)}
                      title={company.is_active ? 'Disable Company' : 'Enable Company'}
                    >
                      {company.is_active ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      className="action-btn delete-btn"
                      onClick={() => handleDeleteCompany(company.id)}
                      title="Delete Company"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
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
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
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

      <CompanyModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSave={handleModalSave}
        company={selectedCompany}
        mode={modalMode}
      />
    </>
  );
};

export default CompaniesTab;
