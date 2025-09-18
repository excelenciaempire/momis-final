import React from 'react';
import { NavLink } from 'react-router-dom';
import './Sidebar.css'; // We'll create this file for styles

const Sidebar = ({ user, onLogout }) => {
  return (
    <nav className="sidebar">
      <div className="sidebar-header">
        <h2>MOMI Admin</h2>
      </div>
      <div className="sidebar-links">
        <NavLink to="/" end>Dashboard</NavLink>
        
        <div className="nav-section-header">USERS</div>
        <NavLink to="/users">Registered Users</NavLink>
        <NavLink to="/conversations">Conversations</NavLink>

        <div className="nav-section-header">KNOWLEDGE</div>
        <NavLink to="/documents">Manage Documents</NavLink>
        <NavLink to="/kb-settings">KB Settings</NavLink>
        <NavLink to="/system-prompt">System Prompt</NavLink>
      </div>
      <div className="sidebar-footer">
        {user && (
          <div className="user-info">
            <span>{user.email}</span>
            <button onClick={onLogout} className="logout-button">
              Logout
            </button>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Sidebar;
