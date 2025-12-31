import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "../../../lib/supabaseClient.js";

const MainContent = ({ isCollapsed }) => {
  // Add utility functions at the top (before state declarations)
  const convertToPHTime = (utcDate) => {
    const date = new Date(utcDate);
    const phTime = new Date(date.getTime() + 8 * 60 * 60 * 1000); // UTC+8
    return phTime;
  };
  // Function to format time difference (e.g., "5 minutes ago")
  const formatTimeAgo = (date) => {
    const now = new Date();

    // Get current time in PH timezone
    const nowPH = new Date(
      now.toLocaleString("en-US", { timeZone: "Asia/Manila" })
    );
    const datePH = new Date(
      date.toLocaleString("en-US", { timeZone: "Asia/Manila" })
    );

    const diffInSeconds = Math.floor((nowPH - datePH) / 1000);

    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600)
      return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400)
      return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800)
      return `${Math.floor(diffInSeconds / 86400)} days ago`;

    return datePH.toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatPHTimestamp = (utcDate) => {
    if (!utcDate) return "No timestamp";

    try {
      const date = new Date(utcDate);

      // Manually format to ensure correct AM/PM
      const options = {
        timeZone: "Asia/Manila", // Philippine timezone
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      };

      return date.toLocaleString("en-PH", options);
    } catch (error) {
      console.error("Error formatting PH timestamp:", error);

      // Fallback: use regular date formatting
      try {
        const date = new Date(utcDate);
        const hours = date.getHours();
        const minutes = date.getMinutes();
        const ampm = hours >= 12 ? "PM" : "AM";
        const hours12 = hours % 12 || 12;
        const minutesFormatted = minutes.toString().padStart(2, "0");

        return (
          date.toLocaleDateString("en-PH", {
            year: "numeric",
            month: "short",
            day: "numeric",
          }) + `, ${hours12}:${minutesFormatted} ${ampm}`
        );
      } catch (fallbackError) {
        return "Invalid date";
      }
    }
  };

  // Function to check if date is within the last week
  const isWithinLastWeek = (date) => {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    return date >= oneWeekAgo;
  };

  // Function to format numbers with commas
  const formatNumber = (num) => {
    return num.toLocaleString();
  };

  // Function to render loading/error states
  const renderStatValue = (loading, error, value) => {
    if (loading) return <span className="loading-dots">Loading</span>;
    if (error) return <span className="error-text">Error</span>;
    return formatNumber(value);
  };

  // Pagination helper function (similar to leave management)
  const paginate = (data, page, rows) => {
    const start = (page - 1) * rows;
    return data.slice(start, start + rows);
  };

  // Pagination buttons render function (similar to leave management)
  const renderPaginationButtons = (page, setPage, rows, filteredData) => {
    const pageCount = Math.max(1, Math.ceil(filteredData.length / rows));
    const hasNoData = filteredData.length === 0;

    const buttons = [];

    // Previous button
    buttons.push(
      <button
        key="prev"
        className={`activity-pagination-btn ${
          hasNoData ? "activity-disabled" : ""
        }`}
        disabled={page === 1 || hasNoData}
        onClick={() => setPage(Math.max(1, page - 1))}
      >
        Previous
      </button>
    );

    // Show page 1
    buttons.push(
      <button
        key={1}
        className={`activity-pagination-btn ${
          1 === page ? "activity-active" : ""
        } ${hasNoData ? "activity-disabled" : ""}`}
        onClick={() => setPage(1)}
        disabled={hasNoData}
      >
        1
      </button>
    );

    // If pageCount is 4 or less, show all pages
    if (pageCount <= 4) {
      for (let i = 2; i <= pageCount; i++) {
        buttons.push(
          <button
            key={i}
            className={`activity-pagination-btn ${
              i === page ? "activity-active" : ""
            } ${hasNoData ? "activity-disabled" : ""}`}
            onClick={() => setPage(i)}
            disabled={hasNoData}
          >
            {i}
          </button>
        );
      }
    } else {
      // If pageCount is more than 4, show ellipses and selective pages
      let startPage, endPage;

      if (page <= 3) {
        // When current page is 1, 2, or 3
        startPage = 2;
        endPage = 4;
      } else if (page >= pageCount - 2) {
        // When current page is near the end
        startPage = pageCount - 3;
        endPage = pageCount - 1;
      } else {
        // When current page is in the middle
        startPage = page - 1;
        endPage = page + 1;
      }

      // Show ellipsis after page 1 if needed
      if (startPage > 2) {
        buttons.push(
          <span key="ellipsis1" className="activity-pagination-ellipsis">
            ...
          </span>
        );
      }

      // Show middle pages
      for (let i = startPage; i <= endPage; i++) {
        if (i > 1 && i < pageCount) {
          buttons.push(
            <button
              key={i}
              className={`activity-pagination-btn ${
                i === page ? "activity-active" : ""
              } ${hasNoData ? "activity-disabled" : ""}`}
              onClick={() => setPage(i)}
              disabled={hasNoData}
            >
              {i}
            </button>
          );
        }
      }

      // Show ellipsis before last page if needed
      if (endPage < pageCount - 1) {
        buttons.push(
          <span key="ellipsis2" className="activity-pagination-ellipsis">
            ...
          </span>
        );
      }

      // Always show last page
      buttons.push(
        <button
          key={pageCount}
          className={`activity-pagination-btn ${
            pageCount === page ? "activity-active" : ""
          } ${hasNoData ? "activity-disabled" : ""}`}
          onClick={() => setPage(pageCount)}
          disabled={hasNoData}
        >
          {pageCount}
        </button>
      );
    }

    // Next button
    buttons.push(
      <button
        key="next"
        className={`activity-pagination-btn ${
          hasNoData ? "activity-disabled" : ""
        }`}
        disabled={page === pageCount || hasNoData}
        onClick={() => setPage(Math.min(pageCount, page + 1))}
      >
        Next
      </button>
    );

    return buttons;
  };

  // State for personnel
  const [totalPersonnel, setTotalPersonnel] = useState(0);
  const [personnelLoading, setPersonnelLoading] = useState(true);
  const [personnelError, setPersonnelError] = useState(null);

  // State for upcoming inspections
  const [upcomingInspectionDate, setUpcomingInspectionDate] = useState(null);
  const [upcomingInspectionCount, setUpcomingInspectionCount] = useState(0);
  const [inspectionLoading, setInspectionLoading] = useState(true);
  const [inspectionError, setInspectionError] = useState(null);

  // State for inventory
  const [totalInventory, setTotalInventory] = useState(0);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [inventoryError, setInventoryError] = useState(null);

  // State for recent activities
  const [recentActivities, setRecentActivities] = useState([]);
  const [activitiesLoading, setActivitiesLoading] = useState(true);
  const [activitiesError, setActivitiesError] = useState(null);

  // State for pending leave requests
  const [pendingLeaveRequests, setPendingLeaveRequests] = useState(0);
  const [leaveLoading, setLeaveLoading] = useState(true);
  const [leaveError, setLeaveError] = useState(null);

  // State for pending clearance requests
  const [pendingClearanceRequests, setPendingClearanceRequests] = useState(0);
  const [clearanceLoading, setClearanceLoading] = useState(true);
  const [clearanceError, setClearanceError] = useState(null);

  // Overall loading state
  const [overallLoading, setOverallLoading] = useState(true);

  // State for live timestamp
  const [currentTime, setCurrentTime] = useState(new Date());

  // Pagination state for recent activities
  const [activityCurrentPage, setActivityCurrentPage] = useState(1);
  const activityRowsPerPage = 5; // 5 items per page like leave management

  // Calculate current activities for the current page
  const currentActivities = useMemo(() => {
    return paginate(recentActivities, activityCurrentPage, activityRowsPerPage);
  }, [recentActivities, activityCurrentPage, activityRowsPerPage]);

  // Function to fetch total personnel count
  const fetchTotalPersonnel = async () => {
    try {
      const { count, error } = await supabase
        .from("personnel")
        .select("*", { count: "exact", head: true });

      if (error) throw error;
      setTotalPersonnel(count || 0);
    } catch (error) {
      console.error("Error fetching personnel count:", error);
      setPersonnelError("Failed to load personnel count");
    } finally {
      setPersonnelLoading(false);
    }
  };

  // Function to fetch total inventory count
  const fetchTotalInventory = async () => {
    try {
      const { count, error } = await supabase
        .from("inventory")
        .select("*", { count: "exact", head: true });

      if (error) throw error;
      setTotalInventory(count || 0);
    } catch (error) {
      console.error("Error fetching inventory count:", error);
      setInventoryError("Failed to load inventory count");
    } finally {
      setInventoryLoading(false);
    }
  };

  // Function to fetch pending leave requests count
  const fetchPendingLeaveRequests = async () => {
    try {
      // Count leave requests with status 'Pending' or 'For Review'
      const { count, error } = await supabase
        .from("leave_requests")
        .select("*", { count: "exact", head: true })
        .in("status", ["Pending", "For Review"]);

      if (error) throw error;
      setPendingLeaveRequests(count || 0);
    } catch (error) {
      console.error("Error fetching leave requests count:", error);
      setLeaveError("Failed to load leave requests");
    } finally {
      setLeaveLoading(false);
    }
  };

  // Function to fetch pending clearance requests count
  const fetchPendingClearanceRequests = async () => {
    try {
      // Count clearance requests with status 'Pending' or 'In Progress'
      const { count, error } = await supabase
        .from("clearance_requests")
        .select("*", { count: "exact", head: true })
        .in("status", ["Pending", "In Progress"]);

      if (error) throw error;
      setPendingClearanceRequests(count || 0);
    } catch (error) {
      console.error("Error fetching clearance requests count:", error);
      setClearanceError("Failed to load clearance requests");
    } finally {
      setClearanceLoading(false);
    }
  };

  // Function to fetch upcoming inspections
  const fetchUpcomingInspections = async () => {
    try {
      // Get current date in PST (Philippine Standard Time)
      const today = new Date();
      const pstToday = new Date(today.getTime() + 8 * 60 * 60 * 1000);
      const todayString = pstToday.toISOString().split("T")[0];

      // Get the nearest upcoming inspection
      const { data, error, count } = await supabase
        .from("inspections")
        .select("schedule_inspection_date", { count: "exact" })
        .eq("status", "PENDING")
        .gte("schedule_inspection_date", todayString)
        .order("schedule_inspection_date", { ascending: true })
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        // Format the date for display
        const inspectionDate = new Date(data[0].schedule_inspection_date);
        const formattedDate = inspectionDate.toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });
        setUpcomingInspectionDate(formattedDate);
      } else {
        setUpcomingInspectionDate("No upcoming inspections");
      }

      // Count total upcoming inspections
      if (count !== undefined) {
        setUpcomingInspectionCount(count);
      }
    } catch (error) {
      console.error("Error fetching upcoming inspections:", error);
      setInspectionError("Failed to load inspection schedule");
    } finally {
      setInspectionLoading(false);
    }
  };

  // Function to fetch recent activities (with 1-week filter)
  const fetchRecentActivities = async () => {
    try {
      // Calculate date for 1 week ago
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const oneWeekAgoString = oneWeekAgo.toISOString();

      // Fetch activities from multiple sources with date filter
      const [inspections, leaves, clearances] = await Promise.all([
        supabase
          .from("inspections")
          .select(
            `
          id,
          schedule_inspection_date,
          inspector_name,
          status,
          created_at,
          updated_at,
          inventory:equipment_id(item_name)
        `
          )
          .gte("created_at", oneWeekAgoString) // Only get activities from last week
          .order("created_at", { ascending: false }) // Most recent first
          .limit(15), // Get more to allow for filtering

        supabase
          .from("leave_requests")
          .select(
            `
          id,
          personnel_id,
          status,
          created_at,
          personnel:personnel_id(first_name, last_name)
        `
          )
          .gte("created_at", oneWeekAgoString) // Only get activities from last week
          .order("created_at", { ascending: false }) // Most recent first
          .limit(15),

        supabase
          .from("clearance_requests")
          .select(
            `
          id,
          personnel_id,
          status,
          type,
          created_at,
          personnel:personnel_id(first_name, last_name)
        `
          )
          .gte("created_at", oneWeekAgoString) // Only get activities from last week
          .order("created_at", { ascending: false }) // Most recent first
          .limit(15),
      ]);

      let allActivities = [];

      // Process inspection activities
      if (inspections.data) {
        inspections.data.forEach((inspection) => {
          const phTime = convertToPHTime(inspection.created_at);

          // Skip if not within last week (extra safety check)
          if (!isWithinLastWeek(phTime)) return;

          const timeAgo = formatTimeAgo(phTime);
          const timestamp = formatPHTimestamp(inspection.created_at);

          let activityText = "";
          let activityIcon = "📅";

          if (inspection.status === "PENDING") {
            const scheduledDate = new Date(inspection.schedule_inspection_date);
            const formattedDate = scheduledDate.toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            });

            activityText = `${
              inspection.inspector_name || "An inspector"
            } scheduled inspection for ${
              inspection.inventory?.item_name || "equipment"
            } on ${formattedDate}`;
            activityIcon = "📅";
          } else if (inspection.status === "COMPLETED") {
            activityText = `${
              inspection.inspector_name || "An inspector"
            } completed inspection for ${
              inspection.inventory?.item_name || "equipment"
            }`;
            activityIcon = "✅";
          } else if (inspection.status === "FAILED") {
            activityText = `${
              inspection.inspector_name || "An inspector"
            } marked inspection as failed for ${
              inspection.inventory?.item_name || "equipment"
            }`;
            activityIcon = "❌";
          } else if (inspection.status === "CANCELLED") {
            activityText = `${
              inspection.inspector_name || "An inspector"
            } cancelled inspection for ${
              inspection.inventory?.item_name || "equipment"
            }`;
            activityIcon = "🚫";
          }

          allActivities.push({
            id: `inspection-${inspection.id}`,
            time: timeAgo,
            timestamp: timestamp,
            text: activityText,
            icon: activityIcon,
            phTime: phTime,
            type: "inspection",
            rawTime: phTime.getTime(), // For sorting
          });
        });
      }

      // Process leave request activities
      if (leaves.data) {
        leaves.data.forEach((leave) => {
          const phTime = convertToPHTime(leave.created_at);

          // Skip if not within last week (extra safety check)
          if (!isWithinLastWeek(phTime)) return;

          const timeAgo = formatTimeAgo(phTime);
          const timestamp = formatPHTimestamp(leave.created_at);

          const personnelName = leave.personnel
            ? `${leave.personnel.first_name} ${leave.personnel.last_name}`
            : "Unknown personnel";

          let statusText = leave.status.toLowerCase();
          let activityIcon = "📋";

          if (leave.status === "Approved") {
            activityIcon = "✅";
          } else if (leave.status === "Rejected") {
            activityIcon = "❌";
          } else if (leave.status === "For Review") {
            activityIcon = "👀";
          }

          allActivities.push({
            id: `leave-${leave.id}`,
            time: timeAgo,
            timestamp: timestamp,
            text: `${personnelName} submitted a ${statusText} leave request`,
            icon: activityIcon,
            phTime: phTime,
            type: "leave",
            rawTime: phTime.getTime(), // For sorting
          });
        });
      }

      // Process clearance request activities
      if (clearances.data) {
        clearances.data.forEach((clearance) => {
          const phTime = convertToPHTime(clearance.created_at);

          // Skip if not within last week (extra safety check)
          if (!isWithinLastWeek(phTime)) return;

          const timeAgo = formatTimeAgo(phTime);
          const timestamp = formatPHTimestamp(clearance.created_at);

          const personnelName = clearance.personnel
            ? `${clearance.personnel.first_name} ${clearance.personnel.last_name}`
            : "Unknown personnel";

          let activityIcon = "📄";

          if (clearance.status === "Approved") {
            activityIcon = "✅";
          } else if (clearance.status === "Rejected") {
            activityIcon = "❌";
          } else if (clearance.status === "In Progress") {
            activityIcon = "⚡";
          }

          allActivities.push({
            id: `clearance-${clearance.id}`,
            time: timeAgo,
            timestamp: timestamp,
            text: `${personnelName} submitted a ${clearance.type.toLowerCase()} clearance request`,
            icon: activityIcon,
            phTime: phTime,
            type: "clearance",
            rawTime: phTime.getTime(), // For sorting
          });
        });
      }

      // Sort all activities by time (most recent first - descending)
      allActivities.sort((a, b) => b.rawTime - a.rawTime);

      // Reset to first page when new activities are loaded
      setActivityCurrentPage(1);

      // Set all activities (pagination will handle displaying only 5 per page)
      setRecentActivities(allActivities);

      console.log(`Found ${allActivities.length} activities from last week`);
    } catch (error) {
      console.error("Error fetching recent activities:", error);
      setActivitiesError("Failed to load recent activities");
    } finally {
      setActivitiesLoading(false);
    }
  };

  // Function to fetch all dashboard data
  const fetchDashboardData = async () => {
    setOverallLoading(true);
    try {
      await Promise.all([
        fetchTotalPersonnel(),
        fetchTotalInventory(),
        fetchPendingLeaveRequests(),
        fetchPendingClearanceRequests(),
        fetchUpcomingInspections(),
        fetchRecentActivities(),
      ]);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setOverallLoading(false);
    }
  };

  useEffect(() => {
    // Live timestamp interval
    const timeIntervalId = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    // Fetch initial data
    fetchDashboardData();

    // Optional: Set up real-time subscriptions
    const setupRealtimeSubscriptions = () => {
      // Subscribe to personnel changes
      const personnelChannel = supabase
        .channel("personnel-changes")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "personnel" },
          () => fetchTotalPersonnel()
        )
        .subscribe();

      // Subscribe to inventory changes
      const inventoryChannel = supabase
        .channel("inventory-changes")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "inventory" },
          () => fetchTotalInventory()
        )
        .subscribe();

      // Subscribe to leave request changes
      const leaveChannel = supabase
        .channel("leave-requests-changes")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "leave_requests" },
          () => {
            fetchPendingLeaveRequests();
            fetchRecentActivities(); // Refresh activities when leave requests change
          }
        )
        .subscribe();

      // Subscribe to clearance request changes
      const clearanceChannel = supabase
        .channel("clearance-requests-changes")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "clearance_requests" },
          () => {
            fetchPendingClearanceRequests();
            fetchRecentActivities(); // Refresh activities when clearance requests change
          }
        )
        .subscribe();

      const inspectionChannel = supabase
        .channel("inspections-changes")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "inspections" },
          () => {
            fetchUpcomingInspections();
            fetchRecentActivities(); // Refresh activities when new inspection is created
          }
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "inspections" },
          () => {
            fetchUpcomingInspections();
            fetchRecentActivities(); // Refresh activities when inspection is updated
          }
        )
        .on(
          "postgres_changes",
          { event: "DELETE", schema: "public", table: "inspections" },
          () => {
            fetchUpcomingInspections();
            fetchRecentActivities(); // Refresh activities when inspection is deleted
          }
        )
        .subscribe();

      return () => {
        personnelChannel.unsubscribe();
        inventoryChannel.unsubscribe();
        leaveChannel.unsubscribe();
        clearanceChannel.unsubscribe();
        inspectionChannel.unsubscribe();
      };
    };

    // Uncomment to enable real-time updates
    // const cleanup = setupRealtimeSubscriptions();
    // return () => {
    //   cleanup();
    //   clearInterval(timeIntervalId);
    // };

    return () => {
      clearInterval(timeIntervalId);
    };
  }, []);

  return (
    <div className={`main-content ${isCollapsed ? "collapsed" : ""}`}>
      <div className="header">
        <h1>Admin Dashboard</h1>
        <p className="pp">Welcome, Admin User</p>
      </div>

      <div className="dashboard-content">
        {/* Dashboard stats cards */}
        <div className="dashboard-stats">
          {/* Total Personnel Card */}
          <div className="stat-card">
            <div className="stat-icon personnel-icon">👥</div>
            <div className="stat-content">
              <h3>Total Personnel</h3>
              <p className="stat-number">
                {renderStatValue(
                  personnelLoading,
                  personnelError,
                  totalPersonnel
                )}
              </p>
              <div className="stat-subtitle">
                {!personnelLoading && !personnelError && (
                  <span className="stat-info">Active personnel</span>
                )}
              </div>
            </div>
          </div>

          {/* Pending Leave Requests Card */}
          <div className="stat-card">
            <div className="stat-icon leave-icon">📋</div>
            <div className="stat-content">
              <h3>Pending Leave Requests</h3>
              <p className="stat-number">
                {renderStatValue(
                  leaveLoading,
                  leaveError,
                  pendingLeaveRequests
                )}
              </p>
              <div className="stat-subtitle">
                {!leaveLoading && !leaveError && (
                  <span className="stat-info">Awaiting review/approval</span>
                )}
              </div>
            </div>
            {!leaveLoading && !leaveError && pendingLeaveRequests > 0 && (
              <div className="stat-alert">!</div>
            )}
          </div>

          {/* Pending Clearance Requests Card */}
          <div className="stat-card">
            <div className="stat-icon clearance-icon">📄</div>
            <div className="stat-content">
              <h3>Pending Clearance Requests</h3>
              <p className="stat-number">
                {renderStatValue(
                  clearanceLoading,
                  clearanceError,
                  pendingClearanceRequests
                )}
              </p>
              <div className="stat-subtitle">
                {!clearanceLoading && !clearanceError && (
                  <span className="stat-info">Require attention</span>
                )}
              </div>
            </div>
            {!clearanceLoading &&
              !clearanceError &&
              pendingClearanceRequests > 0 && (
                <div className="stat-alert">!</div>
              )}
          </div>

          {/* Inventory Items Card */}
          <div className="stat-card">
            <div className="stat-icon inventory-icon">📦</div>
            <div className="stat-content">
              <h3>Inventory Items</h3>
              <p className="stat-number">
                {renderStatValue(
                  inventoryLoading,
                  inventoryError,
                  totalInventory
                )}
              </p>
              <div className="stat-subtitle">
                {!inventoryLoading && !inventoryError && (
                  <span className="stat-info">Total equipment/assets</span>
                )}
              </div>
            </div>
          </div>

          {/* Upcoming Schedule Inspection Card */}
          <div className="stat-card">
            <div className="stat-icon schedule-icon">📅</div>
            <div className="stat-content">
              <h3>Upcoming Schedule Inspection</h3>
              <p className="stat-schedule-date">
                {inspectionLoading ? (
                  <span className="loading-dots">Loading</span>
                ) : inspectionError ? (
                  <span className="error-text">Error</span>
                ) : upcomingInspectionDate ? (
                  upcomingInspectionDate
                ) : (
                  "No upcoming"
                )}
              </p>
              <div className="stat-subtitle">
                {!inspectionLoading && !inspectionError && (
                  <span className="stat-info">
                    {upcomingInspectionCount > 0
                      ? `${upcomingInspectionCount} upcoming inspection(s)`
                      : "No inspections scheduled"}
                  </span>
                )}
              </div>
            </div>
            {!inspectionLoading &&
              !inspectionError &&
              upcomingInspectionCount > 0 && (
                <div className="stat-alert">📅</div>
              )}
          </div>

          {/* Recruitment module */}
          <div className="stat-card">
            <div className="stat-icon leave-icon">📋</div>
            <div className="stat-content">
              <h3>Total Recruited Applicants </h3>
              <p className="stat-number">
                {renderStatValue(
                  leaveLoading,
                  leaveError,
                  pendingLeaveRequests
                )}
              </p>
              <div className="stat-subtitle">
                {!leaveLoading && !leaveError && (
                  <span className="stat-info">Awaiting review/approval</span>
                )}
              </div>
            </div>
            {!leaveLoading && !leaveError && pendingLeaveRequests > 0 && (
              <div className="stat-alert">!</div>
            )}
          </div>
        </div>

        {/* Detailed Stats Section */}
        <div className="detailed-stats">
          <div className="stat-detail">
            <h4>Leave Requests Breakdown</h4>
            {leaveLoading ? (
              <p className="loading-text">Loading leave data...</p>
            ) : leaveError ? (
              <p className="error-text">Failed to load leave data</p>
            ) : (
              <div className="stat-breakdown">
                <div className="breakdown-item">
                  <span className="breakdown-label">Pending:</span>
                  <span className="breakdown-value">
                    {pendingLeaveRequests}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="stat-detail">
            <h4>Clearance Requests Breakdown</h4>
            {clearanceLoading ? (
              <p className="loading-text">Loading clearance data...</p>
            ) : clearanceError ? (
              <p className="error-text">Failed to load clearance data</p>
            ) : (
              <div className="stat-breakdown">
                <div className="breakdown-item">
                  <span className="breakdown-label">Pending/In Progress:</span>
                  <span className="breakdown-value">
                    {pendingClearanceRequests}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity Section with Pagination */}
        <div className="recent-activity">
          <div className="activity-header">
            <h2>Recent Activity</h2>
            <div className="activity-subheader">
              <span className="activity-info">
                Showing activities from the last 7 days
              </span>
              <span className="activity-timestamp">
                PH Time:{" "}
                {currentTime.toLocaleTimeString("en-PH", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: true,
                })}
              </span>
            </div>
          </div>

          {/* Top Pagination (optional - can be removed if you only want bottom pagination) */}
          <div className="activity-top-pagination">
            {renderPaginationButtons(
              activityCurrentPage,
              setActivityCurrentPage,
              activityRowsPerPage,
              recentActivities
            )}
          </div>

          {activitiesLoading ? (
            <div className="activity-loading">
              <span className="loading-dots">Loading activities...</span>
            </div>
          ) : activitiesError ? (
            <div className="activity-error">
              <span className="error-text">Failed to load activities</span>
            </div>
          ) : (
            <div className="activity-list">
              {currentActivities.length > 0 ? (
                currentActivities.map((activity) => (
                  <div
                    key={activity.id}
                    className="activity-item"
                    title={`PH Time: ${activity.timestamp}`}
                  >
                    <div className="activity-item-header">
                      <span className="activity-icon">{activity.icon}</span>
                      <div className="activity-time-container">
                        <span className="activity-time">{activity.time}</span>
                        <span className="activity-type">{activity.type}</span>
                      </div>
                    </div>
                    <div className="activity-text">{activity.text}</div>
                    <div className="activity-timestamp">
                      {activity.timestamp}
                    </div>
                  </div>
                ))
              ) : (
                <div className="activity-item no-activity">
                  <span className="activity-text">
                    No recent activities in the last 7 days
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Bottom Pagination */}
          {recentActivities.length > activityRowsPerPage && (
            <div className="activity-bottom-pagination">
              {renderPaginationButtons(
                activityCurrentPage,
                setActivityCurrentPage,
                activityRowsPerPage,
                recentActivities
              )}
            </div>
          )}

          {/* Activity counter */}
          {!activitiesLoading &&
            !activitiesError &&
            recentActivities.length > 0 && (
              <div className="activity-counter">
                <span className="activity-counter-text">
                  Showing {(activityCurrentPage - 1) * activityRowsPerPage + 1}-
                  {Math.min(
                    activityCurrentPage * activityRowsPerPage,
                    recentActivities.length
                  )}{" "}
                  of {recentActivities.length} activities
                </span>
              </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default MainContent;
