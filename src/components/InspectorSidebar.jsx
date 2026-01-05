// hooks/InspectorSidebar.jsx
import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useSidebar } from "./SidebarContext";

const InspectorSidebar = () => {
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
      <div className="theme-toggle"></div>
      <div className="sidebar-inner">
        <h2>Inspector</h2>
        <a
          href="/inspector"
          className="no-hover"
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: "10px",
          }}
          onClick={(e) => handleTabClick(e, "/inspector")}
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
        </a>

        {/* Inspector-specific tabs */}
        <a
          href="/inspectorDashboard"
          onClick={(e) => handleTabClick(e, "/inspectorDashboard")}
          className={`${isTabActive("/inspectorDashboard") ? "active" : ""}`}
        >
          📊 <span>Dashboard</span>
        </a>
        <a
          href="/inspector/inventory"
          onClick={(e) => handleTabClick(e, "/inspector/inventory")}
          className={`${isTabActive("/inspector/inventory") ? "active" : ""}`}
        >
          🔍 <span> Inventory Control</span>
        </a>
        <a
          href="/inspector/equipment"
          onClick={(e) => handleTabClick(e, "/inspector/equipment")}
          className={`${isTabActive("/inspector/equipment") ? "active" : ""}`}
        >
          🛠️ <span>Equipment Inspection</span>
        </a>
        <a
          href="/inspector/report"
          onClick={(e) => handleTabClick(e, "/inspector/report")}
          className={`${isTabActive("/inspector/report") ? "active" : ""}`}
        >
          📋 <span>Inspection Report</span>
        </a>

        {/* Additional inspector tools */}
        <a
          href="/inspector/history"
          onClick={(e) => handleTabClick(e, "/inspector/history")}
          className={`${isTabActive("/inspector/history") ? "active" : ""}`}
        >
          📅 <span>Inspection History</span>
        </a>


        <a href="/" onClick={(e) => handleTabClick(e, "/")}>
          🚪 <span>Logout</span>
        </a>
      </div>
    </div>
  );
};

export default InspectorSidebar;
