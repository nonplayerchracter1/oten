// hooks/useSidebarState.js
import { useState, useEffect } from "react";

export const useSidebarState = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem("sidebarCollapsed");
    return saved ? JSON.parse(saved) : false;
  });



  useEffect(() => {
    localStorage.setItem(
      "sidebarCollapsed",
      JSON.stringify(isSidebarCollapsed)
    );
  }, [isSidebarCollapsed]);



  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };



  return {
    isSidebarCollapsed,
    toggleSidebar,
    setIsSidebarCollapsed,
  };
};
