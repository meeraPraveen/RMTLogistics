import React, { useState, useEffect } from 'react';
import { modulesApi, ordersApi, setAuthToken } from '../utils/api';
import { useAuth0 } from '@auth0/auth0-react';
import { usePermissions } from '../hooks/usePermissions';
import './ModulePage.css';

const PrintingSoftware = () => {
  const { getIdTokenClaims } = useAuth0();
  const { hasPermission } = usePermissions();
  const [readyToPrintOrders, setReadyToPrintOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const idToken = await getIdTokenClaims();
      setAuthToken(idToken.__raw);

      const ordersRes = await ordersApi.getAll({ status: 'Ready to Print', limit: 100 });

      setReadyToPrintOrders(ordersRes.data.data || []);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load printing data:', error);
      setLoading(false);
    }
  };

  const canWrite = hasPermission('printing_software', 'write');

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading printing software...</p>
      </div>
    );
  }

  return (
    <div className="module-page">
      <div className="page-header">
        <div>
          <h1>🖨️ Printing Software</h1>
          <p>Manage print jobs and monitor printer status</p>
        </div>
        {canWrite && (
          <button className="primary-btn">Add Print Job</button>
        )}
      </div>

      <div className="permissions-info">
        <p>Your permissions:</p>
        <div className="permission-badges">
          <span className="badge">Read</span>
          {canWrite && <span className="badge">Write</span>}
          {hasPermission('printing_software', 'update') && <span className="badge">Update</span>}
        </div>
      </div>

      <div className="section">
        <h2>Ready to Print Orders</h2>
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Customer</th>
                <th>Company</th>
                <th>Order Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {readyToPrintOrders.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '40px' }}>
                    No orders ready to print
                  </td>
                </tr>
              ) : (
                readyToPrintOrders.map((order) => (
                  <tr key={order.id}>
                    <td><strong>{order.internal_order_id}</strong></td>
                    <td>{order.customer_name || '-'}</td>
                    <td>{order.company_name || '-'}</td>
                    <td>{order.date_submitted ? new Date(order.date_submitted).toLocaleDateString() : '-'}</td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="btn-small"
                          style={{ background: '#722F37' }}
                          onClick={() => alert('Point Cloud Generation will be linked here')}
                        >
                          Point Cloud Generation
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PrintingSoftware;
