import React from 'react';
import { NavLink } from 'react-router-dom';

const Sidebar = ({ user, onLogout }) => {
  return (
    <nav className="admin-nav">
      <div className="admin-nav-header">
        MOMI Admin
      </div>
      
      <NavLink to="/" end>Dashboard</NavLink>
      
      <div className="nav-section-header">USERS</div>
      <NavLink to="/users">Registered Users</NavLink>
      <NavLink to="/conversations">Conversations</NavLink>

      <div className="nav-section-header">KNOWLEDGE</div>
      <NavLink to="/documents">Manage Documents</NavLink>
      <NavLink to="/kb-settings">KB Settings</NavLink>
      <NavLink to="/system-prompt">System Prompt</NavLink>
      
      {user && (
        <button onClick={onLogout} className="logout-button">
          Logout ({user.email?.substring(0,10)}...)
        </button>
      )}
    </nav>
  );
};

export default Sidebar;
