import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import UserManagement from './pages/UserManagement';
import OrderManagement from './pages/OrderManagement';
import InventoryManagement from './pages/InventoryManagement';
import PrintingSoftware from './pages/PrintingSoftware';
import SystemConfig from './pages/SystemConfig';
import Unauthorized from './pages/Unauthorized';
import ProtectedRoute from './components/ProtectedRoute';
import './App.css';

function App() {
  const { isLoading, error } = useAuth0();

  if (error) {
    return <div className="error-container">Authentication Error: {error.message}</div>;
  }

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/unauthorized" element={<Unauthorized />} />

        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />

          <Route
            path="/user-management"
            element={
              <ProtectedRoute module="user_management">
                <UserManagement />
              </ProtectedRoute>
            }
          />

          <Route
            path="/order-management"
            element={
              <ProtectedRoute module="order_management">
                <OrderManagement />
              </ProtectedRoute>
            }
          />

          <Route
            path="/inventory-management"
            element={
              <ProtectedRoute module="inventory_management">
                <InventoryManagement />
              </ProtectedRoute>
            }
          />

          <Route
            path="/printing-software"
            element={
              <ProtectedRoute module="printing_software">
                <PrintingSoftware />
              </ProtectedRoute>
            }
          />

          <Route
            path="/system-config"
            element={
              <ProtectedRoute module="system_config">
                <SystemConfig />
              </ProtectedRoute>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
