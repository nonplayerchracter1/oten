// hooks/EmployeeSidebar.jsx - Updated with React Router
import React, { useState, useEffect } from "react";
import { useLocation, Link } from "react-router-dom"; // Import Link
import { useSidebar } from "./SidebarContext";

const EmployeeSidebar = () => {
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
  };

  return (
    <div className={`sidebar ${isSidebarCollapsed ? "collapsed" : ""}`}>
     
      <div className="sidebar-inner">
        <h2>Employee</h2>
        <Link
          to="/"
          className="no-hover"
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: "10px",
          }}
          onClick={(e) => handleTabClick(e, "/")}
        >
          <img
            src="/src/assets/logo-bfp.jpg"
            alt="Logo"
            style={{
              height: "30px",
              width: "30px",
              objectFit: "cover",
              borderRadius: "50%",
              marginRight: "10px",
            }}
          />
          <span style={{ color: "var(--text-primary)", fontWeight: "bold" }}>
            Villanueva FireStation
          </span>
        </Link>

        {/* Use React Router Link instead of regular anchor tags */}
        <Link
          to="/employee/dashboard"
          onClick={(e) => handleTabClick(e, "/employee/dashboard")}
          className={`${isTabActive("/employee/dashboard") ? "active" : ""}`}
        >
          👤 <span>Profile</span>
        </Link>
        <Link
          to="/employee/leave-dashboard"
          onClick={(e) => handleTabClick(e, "/employee/leave-dashboard")}
          className={`${
            isTabActive("/employee/leave-dashboard") ? "active" : ""
          }`}
        >
          📊 <span>Leave Dashboard</span>
        </Link>
        <Link
          to="/employee/leave-request"
          onClick={(e) => handleTabClick(e, "/employee/leave-request")}
          className={`${isTabActive("/employee/leave-request") ? "active" : ""}`}
        >
          📝 <span>Leave Request</span>
        </Link>

        {/* Additional employee tabs */}
   
    
        {/* ... other links */}

        <Link
          to="/"
          onClick={(e) => {
            handleTabClick(e, "/");
            // You might want to add logout logic here
          }}
          className={`${isTabActive("/") ? "active" : ""}`}
        >
          🚪 <span>Logout</span>
        </Link>
      </div>
    </div>
  );
};

export default EmployeeSidebar;
