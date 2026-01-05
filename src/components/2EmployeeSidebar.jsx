// hooks/EmployeeSidebar.jsx - Modern Clean Design
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
          {/* Logo Section */}
          <div className={styles.logoSection}>
            <Link
              to="/employee"
              className={styles.logoLink}
              onClick={(e) => handleTabClick(e, "/employee")}
            >
              <div className={styles.logoContainer}>
                <img
                  src="/src/assets/logo-bfp.jpg"
                  alt="BFP Logo"
                  className={styles.logoImage}
                  onError={(e) => {
                    e.target.src = "https://via.placeholder.com/40x40/3B82F6/ffffff?text=BFP";
                  }}
                />
                <div className={styles.logoTextContainer}>
                  <span className={styles.logoMainText}>BFP</span>
                  <span className={styles.logoSubText}>Villanueva</span>
                </div>
              </div>
            </Link>
            <div className={styles.sidebarTitle}>Employee Portal</div>
          </div>

          {/* Navigation Links */}
          <nav className={styles.navLinks}>
            <div className={styles.navSection}>
              <span className={styles.navSectionLabel}>Dashboard</span>
              <Link
                to="/employee"
                onClick={(e) => handleTabClick(e, "/employee")}
                className={`${styles.navLink} ${isTabActive("/employee") ? styles.active : ""}`}
              >
                <div className={styles.linkIconContainer}>
                  <i className="fas fa-user"></i>
                </div>
                <span className={styles.linkText}>Profile</span>
                {isTabActive("/employee") && <div className={styles.activeIndicator}></div>}
              </Link>
            </div>

            <div className={styles.navSection}>
              <span className={styles.navSectionLabel}>Leave Management</span>
              <Link
                to="/employeeLeaveDashboard"
                onClick={(e) => handleTabClick(e, "/employeeLeaveDashboard")}
                className={`${styles.navLink} ${isTabActive("/employeeLeaveDashboard") ? styles.active : ""}`}
              >
                <div className={styles.linkIconContainer}>
                  <i className="fas fa-chart-bar"></i>
                </div>
                <span className={styles.linkText}>Leave Dashboard</span>
                {isTabActive("/employeeLeaveDashboard") && <div className={styles.activeIndicator}></div>}
              </Link>
              <Link
                to="/employeeLeaveRequest"
                onClick={(e) => handleTabClick(e, "/employeeLeaveRequest")}
                className={`${styles.navLink} ${isTabActive("/employeeLeaveRequest") ? styles.active : ""}`}
              >
                <div className={styles.linkIconContainer}>
                  <i className="fas fa-file-signature"></i>
                </div>
                <span className={styles.linkText}>Leave Request</span>
                {isTabActive("/employeeLeaveRequest") && <div className={styles.activeIndicator}></div>}
              </Link>
            </div>

            {/* Add other sections as needed */}
            
            <div className={styles.navSection}>
              <Link
                to="/"
                onClick={(e) => handleTabClick(e, "/")}
                className={`${styles.navLink} ${styles.logoutLink}`}
              >
                <div className={styles.linkIconContainer}>
                  <i className="fas fa-sign-out-alt"></i>
                </div>
                <span className={styles.linkText}>Logout</span>
              </Link>
            </div>
          </nav>

          {/* Theme Toggle & Settings */}
          <div className={styles.bottomSection}>
            <div className={styles.themeToggle}>
              <button 
                onClick={toggleTheme}
                className={styles.themeToggleBtn}
                aria-label="Toggle theme"
              >
                <div className={styles.themeIconContainer}>
                  <i className={`fas ${currentTheme === 'dark' ? 'fa-sun' : 'fa-moon'}`}></i>
                </div>
                <span className={styles.themeText}>
                  {currentTheme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                </span>
              </button>
            </div>
            
            {/* Collapse Toggle */}
            <button 
              className={styles.collapseToggle}
              onClick={expandSidebar}
              aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <i className={`fas ${isSidebarCollapsed ? 'fa-chevron-right' : 'fa-chevron-left'}`}></i>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default EmployeeSidebar;