import React, { useState, useEffect } from "react";
import styles from "../styles/PersonnelRecentActivity.module.css";
import { supabase } from "../../../lib/supabaseClient.js";
import { useAuth } from "../../AuthContext.jsx";
import Sidebar from "../../Sidebar.jsx";
import Hamburger from "../../Hamburger.jsx";
import { useSidebar } from "../../SidebarContext.jsx";
import { Title, Meta } from "react-head";

const PersonnelRecentActivity = () => {
  const [recentActivities, setRecentActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [activityFilter, setActivityFilter] = useState("all");
  const { user } = useAuth();
  const { isSidebarCollapsed } = useSidebar();

  // Helper function to format names properly
  const formatName = (name) => {
    if (!name || typeof name !== "string") return name || "Unknown";

    // Convert "admin" to "Admin"
    if (name.toLowerCase() === "admin") return "Admin";

    // Convert "inspector" to "Inspector"
    if (name.toLowerCase() === "inspector") return "Inspector";

    // Handle names with spaces (like "john doe" to "John Doe")
    return name
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  };

  // Format leave type for display
  const formatLeaveType = (leaveType) => {
    if (!leaveType) return "Leave";

    const typeMap = {
      vacation: "Vacation",
      sick: "Sick",
      emergency: "Emergency",
      maternity: "Maternity",
      paternity: "Paternity",
    };

    return typeMap[leaveType.toLowerCase()] || leaveType;
  };

  // Format description for different activity types
  const formatDescription = (activity) => {
    if (activity.activityType === "leave_request") {
      return `${formatLeaveType(activity.details.leaveType)} Leave Request`;
    } else if (activity.activityType === "admin_action") {
      const actionText =
        activity.details.action === "approved" ? "Approved" : "Rejected";
      const leaveType = formatLeaveType(activity.details.leaveType);
      return `${actionText} ${activity.details.employeeName}'s ${leaveType} Leave`;
    }
    return activity.description;
  };

  // Format status for display
  const formatStatus = (activity) => {
    if (activity.activityType === "admin_action") {
      return activity.details.action === "approved" ? "Approved" : "Rejected";
    }
    return activity.status || "Pending";
  };

  // Check if user is admin
  const checkAdminStatus = () => {
    if (!user) return false;

    const adminCheck =
      user.username === "admin" ||
      user.username === "inspector" ||
      user.role === "admin" ||
      (user.personnelData && user.personnelData.is_admin === true) ||
      localStorage.getItem("isAdmin") === "true";

    setIsAdmin(adminCheck);
    return adminCheck;
  };

  // Fetch ALL recent activities (leave requests + admin actions)
  const fetchAllRecentActivities = async () => {
    try {
      setLoading(true);
      setError("");

      if (!user) {
        setError("User not authenticated");
        setLoading(false);
        return;
      }

      // Check admin status
      const userIsAdmin = checkAdminStatus();

      // We'll fetch multiple types of activities
      const activities = [];

      // 1. Fetch leave requests (for personnel or all for admin)
      let leaveQuery = supabase
        .from("leave_requests")
        .select(
          `
          *,
          personnel:personnel_id (
            id,
            first_name,
            last_name,
            username,
            rank,
            station
          )
        `
        )
        .order("created_at", { ascending: false })
        .limit(15);

      // If not admin, filter by user's personnel record
      if (!userIsAdmin) {
        const { data: personnelData, error: personnelError } = await supabase
          .from("personnel")
          .select("id")
          .eq("username", user.username)
          .single();

        if (!personnelError && personnelData) {
          leaveQuery = leaveQuery.eq("personnel_id", personnelData.id);
        }
      }

      const { data: leaveRequests, error: leaveError } = await leaveQuery;

      if (!leaveError && leaveRequests) {
        leaveRequests.forEach((request) => {
          const personnel = request.personnel || {};

          // Get raw employee name from various sources
          const rawEmployeeName =
            request.employee_name ||
            `${personnel.first_name || ""} ${
              personnel.last_name || ""
            }`.trim() ||
            personnel.username ||
            "Unknown Employee";

          // Format the employee name properly
          const employeeName = formatName(rawEmployeeName);

          // Format leave type
          const formattedLeaveType = formatLeaveType(request.leave_type);

          // Create activity entry for the leave request submission
          activities.push({
            id: `leave-${request.id}`,
            type: "Leave Request",
            activityType: "leave_request",
            description: `${formattedLeaveType} Leave Request`,
            status: request.status || "Pending",
            timestamp:
              request.created_at ||
              request.submitted_at ||
              request.date_of_filing,
            date:
              request.created_at ||
              request.submitted_at ||
              request.date_of_filing,
            startDate: request.start_date,
            endDate: request.end_date,
            numDays: request.num_days || request.working_days || 0,
            personnelId: request.personnel_id,
            details: {
              leaveType: request.leave_type,
              formattedLeaveType: formattedLeaveType,
              location: request.location,
              reason: request.reason,
              status: request.status,
              recommendedBy: request.recommended_by,
              approvedBy: request.approved_by,
              rejectedBy: request.rejected_by,
              employeeName: employeeName,
              personnelName: employeeName,
              personnelRank: personnel.rank,
              personnelStation: personnel.station,
              personnelUsername: personnel.username,
              isPersonnelAdmin: personnel.is_admin || false,
            },
            actionBy: employeeName,
            actionType: "submitted",
          });

          // If request was approved/rejected, create another activity entry
          if (request.approved_by || request.rejected_by) {
            const actionType = request.approved_by ? "approved" : "rejected";
            const rawActionBy = request.approved_by || request.rejected_by;
            const actionTime =
              request.approved_at || request.rejected_at || request.updated_at;

            // Format the actionBy to show proper capitalization
            const actionBy = formatName(rawActionBy);

            // Format description for admin action
            const actionText =
              actionType === "approved" ? "Approved" : "Rejected";
            const description = `${actionText} ${employeeName}'s ${formattedLeaveType} Leave`;

            activities.push({
              id: `action-${request.id}`,
              type: "Admin Action",
              activityType: "admin_action",
              description: description,
              status: actionText, // Use "Approved" or "Rejected" as status
              timestamp: actionTime,
              date: actionTime,
              details: {
                action: actionType,
                actionBy: actionBy,
                leaveType: request.leave_type,
                formattedLeaveType: formattedLeaveType,
                employeeName: employeeName,
                reason: request.reason,
                remarks: request.approval_remarks || request.rejection_reason,
              },
              actionBy: actionBy,
              actionType: actionType,
              relatedRequestId: request.id,
            });
          }
        });
      }

      // Sort all activities by timestamp (newest first)
      activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      // Limit to 10 most recent activities
      const recentActivities = activities.slice(0, 10);

      console.log("All activities:", recentActivities);
      setRecentActivities(recentActivities);
    } catch (err) {
      console.error("Fetch error:", err);
      setError(`Error loading activities: ${err.message}`);
      setRecentActivities([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch activities when component mounts
  useEffect(() => {
    if (user) {
      fetchAllRecentActivities();

      // Set up real-time subscription for new activities
      const channel = supabase
        .channel("recent-activities-changes")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "leave_requests" },
          () => {
            fetchAllRecentActivities();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      setLoading(false);
      setError("Please log in to view activities");
    }
  }, [user]);

  // Filter activities based on selected filter
  const filteredActivities = recentActivities.filter((activity) => {
    if (activityFilter === "all") return true;
    if (activityFilter === "leave")
      return activity.activityType === "leave_request";
    if (activityFilter === "admin_actions")
      return activity.activityType === "admin_action";
    return activity.activityType === activityFilter;
  });

  // Format functions
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "Invalid Date";
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch (err) {
      return "Invalid Date";
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "Invalid Date";
      return date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (err) {
      return "Invalid Date";
    }
  };

  const getStatusClass = (status) => {
    const statusLower = (status || "").toLowerCase();
    switch (statusLower) {
      case "approved":
        return styles.statusApproved;
      case "pending":
        return styles.statusPending;
      case "rejected":
        return styles.statusRejected;
      case "cancelled":
        return styles.statusCancelled;
      default:
        return styles.statusDefault;
    }
  };

  const getStatusText = (status) => {
    if (!status) return "Pending";
    return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  };

  const getActivityIcon = (activityType, actionType) => {
    switch (activityType) {
      case "leave_request":
        return "📋";
      case "admin_action":
        if (actionType === "approved") return "✅";
        if (actionType === "rejected") return "❌";
        return "⚡";
      case "inventory":
        return "📦";
      case "clearance":
        return "📄";
      default:
        return "📝";
    }
  };

  const getActionColor = (actionType) => {
    switch (actionType) {
      case "submitted":
        return "#3498db";
      case "approved":
        return "#2ecc71";
      case "rejected":
        return "#e74c3c";
      default:
        return "#95a5a6";
    }
  };

  const handleRefresh = () => {
    fetchAllRecentActivities();
  };

  const handleViewDetails = (activity) => {
    let details = "";

    if (activity.activityType === "leave_request") {
      details =
        `Leave Request Details:\n` +
        `Submitted by: ${activity.actionBy}\n` +
        `Type: ${activity.details.formattedLeaveType || "N/A"}\n` +
        `Status: ${activity.details.status || "Pending"}\n` +
        `Dates: ${formatDate(activity.startDate)} to ${formatDate(
          activity.endDate
        )}\n` +
        `Days: ${activity.numDays}\n` +
        (activity.details.location
          ? `Location: ${activity.details.location}\n`
          : "") +
        (activity.details.reason ? `Reason: ${activity.details.reason}` : "");
    } else if (activity.activityType === "admin_action") {
      const actionText =
        activity.details.action === "approved" ? "Approved" : "Rejected";
      details =
        `Admin Action Details:\n` +
        `Action: ${actionText}\n` +
        `Performed by: ${activity.actionBy}\n` +
        `On: ${activity.details.employeeName}'s ${activity.details.formattedLeaveType} Leave\n` +
        (activity.details.remarks
          ? `Remarks: ${activity.details.remarks}`
          : "");
    }

    alert(details);
  };

  if (loading) {
    return (
      <div className="app-container">
        <Hamburger />
        <Sidebar />
        <div
          className={`main-content ${isSidebarCollapsed ? "collapsed" : ""}`}
        >
          <div className={styles.recentActivityContainer}>
            <div className={styles.header}>
              <h3>Recent Activities</h3>
              <button
                className={styles.refreshBtn}
                onClick={handleRefresh}
                disabled
              >
                ↻
              </button>
            </div>
            <div className={styles.loading}>
              <div className={styles.loadingSpinner}></div>
              <p>Loading activities...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <Title>Recent Activities | BFP Villanueva</Title>
      <Meta name="robots" content="noindex, nofollow" />
      <Hamburger />
      <Sidebar />
      <div className={`main-content ${isSidebarCollapsed ? "collapsed" : ""}`}>
        <div className={styles.recentActivityContainer}>
          <div className={styles.header}>
            <div className={styles.headerTitle}>
              <h3>Recent Activities</h3>
              <div className={styles.userInfo}>
                <span className={styles.username}>User: {user?.username}</span>
                {isAdmin && <span className={styles.adminBadge}>ADMIN</span>}
              </div>
            </div>
            <button
              className={styles.refreshBtn}
              onClick={handleRefresh}
              title="Refresh"
            >
              ↻
            </button>
          </div>

          {error && (
            <div className={styles.errorMessage}>
              <span className={styles.errorIcon}>⚠️</span>
              {error}
            </div>
          )}

          {/* Admin Info Banner */}
          {isAdmin && (
            <div className={styles.adminBanner}>
              <span className={styles.adminIcon}>👁️</span>
              <span>Admin View: Tracking all system activities</span>
            </div>
          )}

          {/* Filter Controls */}
          <div className={styles.filterControls}>
            <div className={styles.filterGroup}>
              <label>Filter by Activity Type:</label>
              <select
                value={activityFilter}
                onChange={(e) => setActivityFilter(e.target.value)}
                className={styles.filterSelect}
              >
                <option value="all">All Activities</option>
                <option value="leave">Leave Requests</option>
                <option value="admin_actions">Admin Actions</option>
                <option value="inventory" disabled>
                  Inventory
                </option>
                <option value="clearance" disabled>
                  Clearance
                </option>
              </select>
            </div>
            <div className={styles.activitiesCount}>
              Showing <strong>{filteredActivities.length}</strong> of{" "}
              {recentActivities.length} activities
            </div>
          </div>

          {filteredActivities.length === 0 ? (
            <div className={styles.noActivities}>
              <div className={styles.noActivitiesIcon}>📭</div>
              <h3>No Activities Found</h3>
              <p>
                {activityFilter === "all"
                  ? "No activities have been recorded yet."
                  : `No ${activityFilter.replace("_", " ")} activities found.`}
              </p>
            </div>
          ) : (
            <>
              {/* TABLE VIEW */}
              <div className={styles.tableContainer}>
                <table className={styles.activityTable}>
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Description</th>
                      <th>Action By</th>
                      <th>Status</th>
                      <th>Date & Time</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredActivities.map((activity) => (
                      <tr key={activity.id} className={styles.tableRow}>
                        <td>
                          <div className={styles.activityTypeCell}>
                            <span
                              className={styles.activityIcon}
                              style={{
                                color: getActionColor(activity.actionType),
                              }}
                            >
                              {getActivityIcon(
                                activity.activityType,
                                activity.actionType
                              )}
                            </span>
                            <span>{activity.type}</span>
                          </div>
                        </td>
                        <td>
                          <div className={styles.descriptionCell}>
                            <strong>{formatDescription(activity)}</strong>
                            {activity.activityType === "leave_request" && (
                              <small>
                                {formatDate(activity.startDate)} to{" "}
                                {formatDate(activity.endDate)} •{" "}
                                {activity.numDays} day
                                {activity.numDays !== 1 ? "s" : ""}
                              </small>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className={styles.actionByCell}>
                            <strong>{activity.actionBy}</strong>
                          </div>
                        </td>
                        <td>
                          <span
                            className={`${styles.statusBadge} ${getStatusClass(
                              formatStatus(activity)
                            )}`}
                          >
                            {getStatusText(formatStatus(activity))}
                          </span>
                        </td>
                        <td>
                          <div className={styles.timestampCell}>
                            <strong>{formatDate(activity.timestamp)}</strong>
                            <small>
                              {
                                formatDateTime(activity.timestamp).split(
                                  ", "
                                )[1]
                              }
                            </small>
                          </div>
                        </td>
                        <td>
                          <button
                            className={styles.viewDetailsBtn}
                            onClick={() => handleViewDetails(activity)}
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* CARD VIEW (for mobile) */}
              <div className={styles.activitiesList}>
                {filteredActivities.map((activity) => (
                  <div
                    key={activity.id}
                    className={styles.activityCard}
                    style={{
                      borderLeftColor: getActionColor(activity.actionType),
                    }}
                  >
                    <div className={styles.activityHeader}>
                      <div className={styles.activityType}>
                        <span
                          className={styles.activityIcon}
                          style={{ color: getActionColor(activity.actionType) }}
                        >
                          {getActivityIcon(
                            activity.activityType,
                            activity.actionType
                          )}
                        </span>
                        <div>
                          <span className={styles.activityTypeLabel}>
                            {activity.type}
                          </span>
                          {activity.actionType !== "submitted" && (
                            <span
                              className={styles.actionBadge}
                              style={{
                                backgroundColor: getActionColor(
                                  activity.actionType
                                ),
                                color: "white",
                              }}
                            >
                              {activity.actionType === "approved"
                                ? "APPROVED"
                                : "REJECTED"}
                            </span>
                          )}
                        </div>
                      </div>
                      <span
                        className={`${styles.statusBadge} ${getStatusClass(
                          formatStatus(activity)
                        )}`}
                      >
                        {getStatusText(formatStatus(activity))}
                      </span>
                    </div>

                    <div className={styles.activityBody}>
                      <h4 className={styles.activityTitle}>
                        {formatDescription(activity)}
                      </h4>

                      <div className={styles.activityMeta}>
                        <div className={styles.metaItem}>
                          <span className={styles.metaLabel}>By:</span>
                          <span className={styles.metaValue}>
                            {activity.actionBy}
                          </span>
                        </div>

                        <div className={styles.metaItem}>
                          <span className={styles.metaLabel}>Date:</span>
                          <span className={styles.metaValue}>
                            {formatDateTime(activity.timestamp)}
                          </span>
                        </div>

                        {activity.activityType === "leave_request" && (
                          <>
                            <div className={styles.metaItem}>
                              <span className={styles.metaLabel}>Period:</span>
                              <span className={styles.metaValue}>
                                {formatDate(activity.startDate)} to{" "}
                                {formatDate(activity.endDate)}
                              </span>
                            </div>
                            <div className={styles.metaItem}>
                              <span className={styles.metaLabel}>Days:</span>
                              <span className={styles.metaValue}>
                                {activity.numDays}
                              </span>
                            </div>
                          </>
                        )}
                      </div>

                      {activity.details.location && (
                        <div className={styles.activityLocation}>
                          <span className={styles.metaLabel}>Location:</span>
                          <span>{activity.details.location}</span>
                        </div>
                      )}
                    </div>

                    <div className={styles.activityFooter}>
                      <button
                        className={styles.viewDetailsBtn}
                        onClick={() => handleViewDetails(activity)}
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {filteredActivities.length > 0 && (
                <div className={styles.viewMoreContainer}>
                  <button className={styles.viewMoreBtn}>
                    View All Activities →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PersonnelRecentActivity;
