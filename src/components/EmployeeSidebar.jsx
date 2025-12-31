// hooks/EmployeeSidebar.jsx - Updated with CSS Modules and React Router
import React, { useState, useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import { useSidebar } from "./SidebarContext";
import styles from "./EmployeeSidebar.module.css";

const EmployeeSidebar = ({ isMobileOpen, onClose }) => {
  const { isSidebarCollapsed, expandSidebar, currentTheme, toggleTheme } =
    useSidebar();
  const [activeTab, setActiveTab] = useState("");
  const location = useLocation();

  useEffect(() => {
    const currentPath = location.pathname;
    setActiveTab(currentPath);
  }, [location.pathname]);

  const isTabActive = (href) => activeTab === href;

  const handleTabClick = (e, href) => {
    if (isSidebarCollapsed) {
      expandSidebar();
    }
    // Close mobile sidebar when a link is clicked
    if (window.innerWidth <= 768 && onClose) {
      onClose();
    }
  };

  // Handle mobile close
  const handleMobileClose = () => {
    if (onClose) {
      onClose();
    }
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className={styles.mobileOverlay} 
          onClick={handleMobileClose}
        />
      )}

      <div className={`
        ${styles.sidebar} 
        ${isSidebarCollapsed ? styles.collapsed : ""}
        ${isMobileOpen ? styles.mobileOpen : ""}
      `}>
        {/* Mobile Close Button */}
        {isMobileOpen && (
          <button 
            className={styles.mobileCloseBtn}
            onClick={handleMobileClose}
            aria-label="Close menu"
          >
            <i className="fas fa-times"></i>
          </button>
        )}

        <div className={styles.sidebarInner}>
          <h2 className={styles.sidebarTitle}>Employee</h2>
          <Link
            to="/employee"
            className={styles.logoLink}
            onClick={(e) => handleTabClick(e, "/employee")}
          >
            <img
              src="/src/assets/logo-bfp.jpg"
              alt="Logo"
              className={styles.logoImage}
            />
            <span className={styles.logoText}>
              Villanueva FireStation
            </span>
          </Link>

          {/* Navigation Links */}
          <nav className={styles.navLinks}>
            <Link
              to="/employee"
              onClick={(e) => handleTabClick(e, "/employee")}
              className={`${styles.navLink} ${isTabActive("/employee") ? styles.active : ""}`}
            >
              <span className={styles.linkIcon}>👤</span>
              <span className={styles.linkText}>Profile</span>
            </Link>
            <Link
              to="/employeeLeaveDashboard"
              onClick={(e) => handleTabClick(e, "/employeeLeaveDashboard")}
              className={`${styles.navLink} ${isTabActive("/employeeLeaveDashboard") ? styles.active : ""}`}
            >
              <span className={styles.linkIcon}>📊</span>
              <span className={styles.linkText}>Leave Dashboard</span>
            </Link>
            <Link
              to="/employeeLeaveRequest"
              onClick={(e) => handleTabClick(e, "/employeeLeaveRequest")}
              className={`${styles.navLink} ${isTabActive("/employeeLeaveRequest") ? styles.active : ""}`}
            >
              <span className={styles.linkIcon}>📝</span>
              <span className={styles.linkText}>Leave Request</span>
            </Link>
            
            {/* Add other employee links here */}
            
            <Link
              to="/"
              onClick={(e) => handleTabClick(e, "/")}
              className={`${styles.navLink} ${styles.logoutLink} ${isTabActive("/") ? styles.active : ""}`}
            >
              <span className={styles.linkIcon}>🚪</span>
              <span className={styles.linkText}>Logout</span>
            </Link>
          </nav>

          {/* Theme Toggle - Facebook Style */}
          <div className={styles.themeToggle}>
            <button 
              onClick={toggleTheme}
              className={styles.themeToggleBtn}
              aria-label="Toggle theme"
            >
              <i className={`fas ${currentTheme === 'dark' ? 'fa-sun' : 'fa-moon'}`}></i>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default EmployeeSidebar;