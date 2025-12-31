import React from "react";
import Hamburger from "../../Hamburger.jsx";
import Sidebar from "../../Sidebar.jsx";
import MainContent from "./MainContext.jsx";
import "../styles/AdminDashboard.css";
import "../../../components/Sidebar.css";
import "../../../components/SidebarFix.css"; // IMPORTANT: Add this new CSS file
import { useSidebar } from "../../SidebarContext.jsx";
import { Title, Meta } from "react-head";

const AdminDashboard = () => {
  const { isSidebarCollapsed } = useSidebar();

  return (
    <div className="admin-dashboard">
      <Title>Admin Dashboard | BFP Villanueva</Title>
      <Meta name="robots" content="noindex, nofollow" />
      
      <Hamburger />
      <Sidebar />
      
      {/* Add overlay for mobile */}
      <div className="overlay"></div>
      
      <MainContent isCollapsed={isSidebarCollapsed} />
    </div>
  );
};

export default AdminDashboard;