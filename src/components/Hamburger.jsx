// hooks/Hamburger.jsx
import React from "react";
import { useSidebar } from "./SidebarContext";

const Hamburger = () => {
  const { isSidebarCollapsed, toggleSidebar } = useSidebar();

  return (
    <button
      className={`hamburger ${isSidebarCollapsed ? "active" : ""}`}
      onClick={toggleSidebar}
    >
      <span className="bar top"></span>
      <span className="bar middle"></span>
      <span className="bar bottom"></span>
    </button>
  );
};

export default Hamburger;
