// hooks/Sidebar.jsx - Updated for tooltip approach
import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useSidebar } from "./SidebarContext";

const Sidebar = () => {
  const { isSidebarCollapsed, expandSidebar, currentTheme, toggleTheme } =
    useSidebar();
  const [activeTab, setActiveTab] = useState("");
  const [tooltipContent, setTooltipContent] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const location = useLocation();
  const [hoverTimeout, setHoverTimeout] = useState(null);
  const dropdownSections = [
    {
      id: "personnel",
      title: "Personnel Records",
      icon: "👥",
      items: [
        {
          href: "/personnelProfile",
          icon: "📁",
          text: "Personnel Profile (201 Files)",
        },
        { href: "/leaveRecords", icon: "🗄️", text: "Leave Records" },
        { href: "/clearanceRecords", icon: "💾", text: "Clearance Records" },
      ],
    },
    {
      id: "morale",
      title: "Morale & Welfare",
      icon: "❤️",
      items: [
        {
          href: "/medicalRecords",
          icon: "🩺",
          text: "Medical Records of Employees",
        },
        {
          href: "/awardsCommendations",
          icon: "🏅",
          text: "Awards & Commendations",
        },
      ],
    },
    {
      id: "hr",
      title: "HR Management",
      icon: "🧑‍🤝‍🧑",
      items: [
        { href: "/promotion", icon: "📈", text: "Qualified for Promotion" },
        {
          href: "/recruitmentPersonnel",
          icon: "👥",
          text: "Recruited Personnel",
        },
        { href: "/trainings", icon: "🎓", text: "Trainings" },
        { href: "/placement", icon: "📍", text: "Placement (≥ 2 Years)" },
        { href: "/history", icon: "⏳", text: "History" },
      ],
    },
  ];

  useEffect(() => {
    const currentPath = location.pathname;
    setActiveTab(currentPath);
  }, [location.pathname]);

  const handleDropdownHover = (section, e) => {
    if (isSidebarCollapsed) {
      const rect = e.currentTarget.getBoundingClientRect();
      setTooltipPosition({
        x: rect.right + 10,
        y: rect.top,
      });
      setTooltipContent(section);

      // Clear any existing timeout
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
        setHoverTimeout(null);
      }
    }
  };
  const handleTooltipEnter = () => {
    // Clear the hide timeout when entering the tooltip
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      setHoverTimeout(null);
    }
  };
  const handleTooltipLeave = () => {
    // Hide tooltip after a short delay
    const timeout = setTimeout(() => {
      setTooltipContent(null);
    }, 150);
    setHoverTimeout(timeout);
  };
  const handleDropdownLeave = (e) => {
    // Only hide if not hovering over the tooltip itself
    if (!e.relatedTarget || !e.relatedTarget.closest(".dropdown-tooltip")) {
      // Add a small delay to allow moving to the tooltip
      const timeout = setTimeout(() => {
        setTooltipContent(null);
      }, 250);
      setHoverTimeout(timeout);
    }
  };

  const handleTooltipItemClick = (href) => {
    setTooltipContent(null);
    if (isSidebarCollapsed) {
      expandSidebar();
    }
  };

  const isTabActive = (href) => activeTab === href;
  const isDropdownItemActive = (href) => activeTab === href;

  const handleTabClick = (e, href) => {
    if (isSidebarCollapsed) {
      expandSidebar();
    }
  };
  // Add click handler for mobile overlay
useEffect(() => {
  const overlay = document.querySelector('.overlay');
  const sidebar = document.querySelector('.sidebar');
  const hamburger = document.querySelector('.hamburger');
  
  const closeSidebar = () => {
    if (sidebar && !sidebar.classList.contains('collapsed')) {
      sidebar.classList.add('collapsed');
      // Update your sidebar context state here
    }
  };
  
  if (overlay) {
    overlay.addEventListener('click', closeSidebar);
  }
  
  return () => {
    if (overlay) {
      overlay.removeEventListener('click', closeSidebar);
    }
  };
}, []);

  return (
    <div className={`sidebar ${isSidebarCollapsed ? "collapsed" : ""}`}>
      {/*   <div className="theme-toggle">
        <button onClick={toggleTheme}>
          {currentTheme === "light" ? "🌙" : "☀️"}
        </button>
      </div>*/}
      <div className="sidebar-inner">
        <h2>Admin</h2>
        <a
          href="/admin"
          className="no-hover"
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: "10px",
            cursor: "default",
          }}
          onClick={(e) => handleTabClick(e, "/admin")}
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
          <span style={{ fontWeight: "800" }}>Villanueva FireStation</span>
        </a>
        <a
          href="/admin"
          onClick={(e) => handleTabClick(e, "/admin")}
          className={`${isTabActive("/admin") ? "active" : ""}`}
        >
          🖥️ <span>Admin Dashboard</span>
        </a>
        {/* Regular tabs */}
        <a
          href="/leaveManagement"
          onClick={(e) => handleTabClick(e, "/leaveManagement")}
          className={`${isTabActive("/leaveManagement") ? "active" : ""}`}
        >
          🗓️ <span>Leave Management</span>
        </a>
        <a
          href="/inventoryControl"
          onClick={(e) => handleTabClick(e, "/inventoryControl")}
          className={`${isTabActive("/inventoryControl") ? "active" : ""}`}
        >
          📦 <span>Inventory Control</span>
        </a>
        <a
          href="/clearanceSystem"
          onClick={(e) => handleTabClick(e, "/clearanceSystem")}
          className={`${isTabActive("/clearanceSystem") ? "active" : ""}`}
        >
          🪪 <span>Clearance System</span>
        </a>
        <a
          href="/personnelRegister"
          onClick={(e) => handleTabClick(e, "/personnelRegister")}
          className={`${isTabActive("/personnelRegister") ? "active" : ""}`}
        >
          🧑‍💼 <span>Personnel Register</span>
        </a>
        <a
          href="/personnelRecentActivity"
          onClick={(e) => handleTabClick(e, "/personnelRecentActivity")}
        >
          🕓 <span>Personnel Recent Activity</span>
        </a>
        {/* Dropdown sections - simplified */}
        {dropdownSections.map((section) => (
          <div
            key={section.id}
            className={`dropdown-section ${section.id}-records`}
            onMouseEnter={(e) => handleDropdownHover(section, e)}
            onMouseLeave={handleDropdownLeave}
          >
            <div className="dropdown-toggle">
              {section.icon} <span>{section.title}</span>{" "}
              <span className="arrow">▼</span>
            </div>

            {/* Only show dropdown content when expanded */}
            {!isSidebarCollapsed && (
              <div className="dropdown-content">
                {section.items.map((item, index) => (
                  <a
                    key={index}
                    href={item.href}
                    className={isDropdownItemActive(item.href) ? "active" : ""}
                  >
                    {item.icon} <span>{item.text}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}

        <a href="/logout" onClick={(e) => handleTabClick(e, "/logout")}>
          🚪 <span>Logout</span>
        </a>
      </div>
      {/*   {isSidebarCollapsed && tooltipContent && (
        <div
          className="dropdown-tooltip"
          style={{
            left: tooltipPosition.x,
            top: tooltipPosition.y,
          }}
          onMouseEnter={handleTooltipEnter}
          onMouseLeave={handleTooltipLeave}
        >
          <div className="tooltip-header">
            <span>
              {tooltipContent.icon} {tooltipContent.title}
            </span>
          </div>
          <div className="tooltip-items">
            {tooltipContent.items.map((item, index) => (
              <a
                key={index}
                href={item.href}
                className={isDropdownItemActive(item.href) ? "active" : ""}
                onClick={() => handleTooltipItemClick(item.href)}
              >
                {item.icon} {item.text}
              </a>
            ))}
          </div>
        </div>
      )}
      Tooltip for collapsed state */}

      {isSidebarCollapsed && tooltipContent && (
        <div
          className={`dropdown-tooltip ${tooltipContent.id}-records`}
          style={{
            left: tooltipPosition.x,
            top: tooltipPosition.y,
          }}
          onMouseEnter={handleTooltipEnter}
          onMouseLeave={handleTooltipLeave}
        >
          <div className="tooltip-header">
            <span>
              {tooltipContent.icon} {tooltipContent.title}
            </span>
          </div>
          <div className="tooltip-items">
            {tooltipContent.items.map((item, index) => (
              <a
                key={index}
                href={item.href}
                className={isDropdownItemActive(item.href) ? "active" : ""}
                onClick={() => handleTooltipItemClick(item.href)}
              >
                {item.icon} {item.text}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
