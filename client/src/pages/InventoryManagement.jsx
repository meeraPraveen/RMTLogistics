import React, { useState, useEffect } from 'react';
import { modulesApi, setAuthToken } from '../utils/api';
import { useAuth0 } from '@auth0/auth0-react';
import { usePermissions } from '../hooks/usePermissions';
import './ModulePage.css';

const InventoryManagement = () => {
  const { getIdTokenClaims } = useAuth0();
  const { hasPermission } = usePermissions();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      const idToken = await getIdTokenClaims();
      setAuthToken(idToken.__raw);

      const response = await modulesApi.inventoryManagement.getItems();
      setItems(response.data.data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load inventory:', error);
      setLoading(false);
    }
  };

  const canWrite = hasPermission('inventory_management', 'write');
  const canUpdate = hasPermission('inventory_management', 'update');

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading inventory...</p>
      </div>
    );
  }

  return (
    <div className="module-page">
      <div className="page-header">
        <div>
          <h1>📊 Inventory Management</h1>
          <p>Track and manage inventory items and stock levels</p>
        </div>
        {canWrite && (
          <button className="primary-btn">Add New Item</button>
        )}
      </div>

      <div className="permissions-info">
        <p>Your permissions:</p>
        <div className="permission-badges">
          <span className="badge">Read</span>
          {canWrite && <span className="badge">Write</span>}
          {canUpdate && <span className="badge">Update</span>}
        </div>
      </div>

      <div className="data-table">
        <table>
          <thead>
            <tr>
              <th>Item Name</th>
              <th>SKU</th>
              <th>Quantity</th>
              <th>Location</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td><strong>{item.name}</strong></td>
                <td>{item.sku}</td>
                <td>
                  <span className={item.quantity < 100 ? 'low-stock' : ''}>
                    {item.quantity}
                  </span>
                </td>
                <td>{item.location}</td>
                <td>
                  <div className="action-buttons">
                    <button className="btn-small">View</button>
                    {canUpdate && <button className="btn-small">Adjust Stock</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default InventoryManagement;
