import React, { useState, useEffect, useCallback } from "react";
import EmployeeSidebar from "../../EmployeeSidebar.jsx";
import Hamburger from "../../Hamburger.jsx";
import styles from "../styles/EmployeeLeaveDashboard.module.css";
import { useSidebar } from "../../SidebarContext.jsx";
import { Title, Meta } from "react-head";
import { supabase } from "../../../lib/supabaseClient.js";

const EmployeeLeaveDashboard = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [leaveData, setLeaveData] = useState({
    leaveCounts: { vacation: 0, sick: 0, emergency: 0 },
    userRequests: [],
  });
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [loading, setLoading] = useState(true);
  const { isSidebarCollapsed } = useSidebar();

  // Table and pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");
  const [currentFilterCard, setCurrentFilterCard] = useState("total");
  const rowsPerPage = 5;

  // Date formatting helper
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch (error) {
      return "Invalid Date";
    }
  };

  // Calculate days between dates
  const calculateDays = (start, end) => {
    if (!start || !end) return 0;
    try {
      const startDate = new Date(start);
      const endDate = new Date(end);
      const diffTime = Math.abs(endDate - startDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays + 1; // Inclusive of both start and end dates
    } catch (error) {
      return 0;
    }
  };

  // Monthly leave accrual
  const accrueMonthlyLeave = useCallback(async (emp) => {
    if (!emp || !emp.id) return emp;

    const now = new Date();
    if (emp.last_accrual) {
      const last = new Date(emp.last_accrual);
      if (
        last.getFullYear() === now.getFullYear() &&
        last.getMonth() === now.getMonth()
      ) {
        return emp;
      }
    }

    const updatedEmployee = {
      ...emp,
      earned_vacation: Math.min((emp.earned_vacation || 0) + 1.25, 15),
      earned_sick: Math.min((emp.earned_sick || 0) + 1, 10),
      earned_emergency: Math.min((emp.earned_emergency || 0) + 0.5, 5),
      last_accrual: now.toISOString(),
      updated_at: now.toISOString(),
    };

    try {
      const { error } = await supabase
        .from("personnel")
        .update(updatedEmployee)
        .eq("id", emp.id);

      if (error) throw error;
      return updatedEmployee;
    } catch (error) {
      console.error("Error accruing monthly leave:", error);
      return emp;
    }
  }, []);

  // Fetch leave data
  const getLeaveData = useCallback(async (username) => {
    try {
      if (!username) {
        console.error("No username provided for getLeaveData");
        return { leaveCounts: { vacation: 0, sick: 0, emergency: 0 }, userRequests: [] };
      }

      // First, get the personnel record for this username
      const { data: personnelData, error: personnelError } = await supabase
        .from("personnel")
        .select("id, username")
        .eq("username", username)
        .single();

      if (personnelError) {
        console.error("Error fetching personnel data:", personnelError);
        return { leaveCounts: { vacation: 0, sick: 0, emergency: 0 }, userRequests: [] };
      }

      // Fetch leave requests for this personnel_id
      const { data: userRequests, error } = await supabase
        .from("leave_requests")
        .select("*")
        .eq("personnel_id", personnelData.id)
        .order("date_of_filing", { ascending: false });

      if (error) {
        console.error("Error fetching leave requests:", error);
        return { leaveCounts: { vacation: 0, sick: 0, emergency: 0 }, userRequests: [] };
      }

      // Calculate leave counts for APPROVED requests only
      const leaveCounts = { vacation: 0, sick: 0, emergency: 0 };
      (userRequests || []).forEach((req) => {
        if (req.status === "Approved") {
          const days = req.num_days || calculateDays(req.start_date, req.end_date);
          if (req.leave_type === "Vacation") leaveCounts.vacation += days;
          if (req.leave_type === "Sick") leaveCounts.sick += days;
          if (req.leave_type === "Emergency") leaveCounts.emergency += days;
        }
      });

      return {
        leaveCounts,
        userRequests: userRequests || [],
      };
    } catch (error) {
      console.error("Error in getLeaveData:", error);
      return { leaveCounts: { vacation: 0, sick: 0, emergency: 0 }, userRequests: [] };
    }
  }, []);

  // Get current user from session
  const getCurrentUserFromSession = async () => {
    try {
      // Try localStorage first
      const storedUser = localStorage.getItem("currentUser");
      if (storedUser) {
        const userData = JSON.parse(storedUser);
        return userData.username || userData.email || null;
      }

      // Try sessionStorage
      const sessionUser = sessionStorage.getItem("currentUser");
      if (sessionUser) {
        const userData = JSON.parse(sessionUser);
        return userData.username || userData.email || null;
      }

      // Try Supabase auth session
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // Get the username from personnel table using email
        const { data: personnel } = await supabase
          .from("personnel")
          .select("username")
          .eq("email", session.user.email)
          .single();
        
        return personnel?.username || session.user.email;
      }

      return null;
    } catch (error) {
      console.error("Error getting current user:", error);
      return null;
    }
  };

  // Fetch personnel data
  const getPersonnelData = useCallback(async (username) => {
    try {
      const { data, error } = await supabase
        .from("personnel")
        .select("*")
        .eq("username", username)
        .single();

      if (error) {
        console.error("Error fetching personnel data:", error);
        return null;
      }

      return data;
    } catch (error) {
      console.error("Error in getPersonnelData:", error);
      return null;
    }
  }, []);

  // Update leave cards
  const getLeaveCardData = (emp, lData) => {
    if (!emp || !lData) {
      return {
        vacation: { earned: "0", value: "0 / 0", progress: 0 },
        sick: { earned: "0", value: "0 / 0", progress: 0 },
        emergency: { earned: "0", value: "0 / 0", progress: 0 },
      };
    }

    // Calculate remaining leave days (earned minus approved days used)
    const remaining = {
      vacation: Math.max(0, (emp.earned_vacation || 0) - (lData.leaveCounts.vacation || 0)),
      sick: Math.max(0, (emp.earned_sick || 0) - (lData.leaveCounts.sick || 0)),
      emergency: Math.max(0, (emp.earned_emergency || 0) - (lData.leaveCounts.emergency || 0)),
    };

    const earned = { vacation: 1.25, sick: 1, emergency: 0.5 };

    return {
      vacation: {
        earned: earned.vacation.toFixed(2),
        value: `${remaining.vacation.toFixed(2)} / ${(emp.earned_vacation || 0).toFixed(2)}`,
        progress: (emp.earned_vacation || 0) > 0 ? 
          (remaining.vacation / (emp.earned_vacation || 1)) * 100 : 0,
      },
      sick: {
        earned: earned.sick.toFixed(2),
        value: `${remaining.sick.toFixed(2)} / ${(emp.earned_sick || 0).toFixed(2)}`,
        progress: (emp.earned_sick || 0) > 0 ? 
          (remaining.sick / (emp.earned_sick || 1)) * 100 : 0,
      },
      emergency: {
        earned: earned.emergency.toFixed(2),
        value: `${remaining.emergency.toFixed(2)} / ${(emp.earned_emergency || 0).toFixed(2)}`,
        progress: (emp.earned_emergency || 0) > 0 ? 
          (remaining.emergency / (emp.earned_emergency || 1)) * 100 : 0,
      },
    };
  };

  // Summary cards data - This calculates TOTALS from ALL requests
  const getSummaryCardsData = () => {
    const allRequests = leaveData.userRequests || [];
    
    // Count all requests by status
    const approvedRequests = allRequests.filter(req => req.status === "Approved").length;
    const pendingRequests = allRequests.filter(req => req.status === "Pending").length;
    const rejectedRequests = allRequests.filter(req => req.status === "Rejected").length;
    const totalRequests = allRequests.length;

    return {
      total: totalRequests,
      approved: approvedRequests,
      pending: pendingRequests,
      rejected: rejectedRequests,
    };
  };

  // Filtering logic
  const applyFilters = (requests) => {
    let filtered = [...requests];

    // First apply card filter (clicking on summary cards)
    if (currentFilterCard === "approved") {
      filtered = filtered.filter((req) => req.status === "Approved");
    } else if (currentFilterCard === "pending") {
      filtered = filtered.filter((req) => req.status === "Pending");
    } else if (currentFilterCard === "rejected") {
      filtered = filtered.filter((req) => req.status === "Rejected");
    }
    // "total" card shows all requests, so no filtering

    // Then apply search filter
    const searchTerm = search.trim().toLowerCase();
    if (searchTerm) {
      filtered = filtered.filter(
        (req) =>
          (req.leave_type?.toLowerCase() || "").includes(searchTerm) ||
          (req.status?.toLowerCase() || "").includes(searchTerm) ||
          formatDate(req.start_date).toLowerCase().includes(searchTerm) ||
          formatDate(req.end_date).toLowerCase().includes(searchTerm)
      );
    }

    // Then apply status filter from dropdown (if any)
    if (filterStatus) {
      filtered = filtered.filter(
        (req) => req.status?.toLowerCase() === filterStatus.toLowerCase()
      );
    }

    // Then apply type filter from dropdown (if any)
    if (filterType) {
      filtered = filtered.filter(
        (req) => req.leave_type?.toLowerCase() === filterType.toLowerCase()
      );
    }

    return filtered;
  };

  // Card click handler
  const handleCardClick = (filter) => {
    if (currentFilterCard === filter) {
      // If clicking the same card again, reset to show all
      setCurrentFilterCard("total");
    } else {
      // Otherwise, apply the filter
      setCurrentFilterCard(filter);
    }
    setCurrentPage(1);
  };

  // Update all stats
  const updateAllStats = useCallback(
    async (emp, lData) => {
      const updatedEmployee = await accrueMonthlyLeave(emp);
      if (updatedEmployee) {
        setEmployee(updatedEmployee);
      }
      setLeaveData(lData);
      setLoading(false);
    },
    [accrueMonthlyLeave]
  );

  // Event handlers
  const handleEdit = (request) => {
    setSelectedRequest(request);
    setEditModalOpen(true);
  };

  const handleDelete = (id) => {
    setDeleteId(id);
    setDeleteModalOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRequest || !selectedRequest.id) return;

    const formData = new FormData(e.target);
    const updatedRequest = {
      leave_type: formData.get("leaveType"),
      start_date: formData.get("startDate"),
      end_date: formData.get("endDate"),
      num_days: calculateDays(
        formData.get("startDate"),
        formData.get("endDate")
      ),
      updated_at: new Date().toISOString(),
    };

    try {
      const { error } = await supabase
        .from("leave_requests")
        .update(updatedRequest)
        .eq("id", selectedRequest.id)
        .eq("status", "Pending"); // Only allow editing if still pending

      if (error) throw error;

      // Refresh data
      const newLeaveData = await getLeaveData(currentUser);
      const updatedEmployee = await getPersonnelData(currentUser);
      
      setEditModalOpen(false);
      setSelectedRequest(null);
      updateAllStats(updatedEmployee, newLeaveData);
      
      alert("Leave request updated successfully!");
    } catch (error) {
      console.error("Error updating leave request:", error);
      alert("Error updating leave request. Only pending requests can be edited.");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteId) return;

    try {
      // Check if the request is still pending before deleting
      const { data: request, error: fetchError } = await supabase
        .from("leave_requests")
        .select("status")
        .eq("id", deleteId)
        .single();

      if (fetchError) throw fetchError;

      if (request.status !== "Pending") {
        alert("Only pending leave requests can be deleted.");
        setDeleteModalOpen(false);
        setDeleteId(null);
        return;
      }

      const { error } = await supabase
        .from("leave_requests")
        .delete()
        .eq("id", deleteId);

      if (error) throw error;

      // Refresh data
      const newLeaveData = await getLeaveData(currentUser);
      const updatedEmployee = await getPersonnelData(currentUser);
      
      setDeleteModalOpen(false);
      setDeleteId(null);
      updateAllStats(updatedEmployee, newLeaveData);
      
      alert("Leave request deleted successfully!");
    } catch (error) {
      console.error("Error deleting leave request:", error);
      alert("Error deleting leave request. Please try again.");
    }
  };

  // Initialize component
  useEffect(() => {
    const initialize = async () => {
      try {
        setLoading(true);

        // Get current user from session
        const user = await getCurrentUserFromSession();
        if (!user) {
          console.log("No user found in session, redirecting to login...");
          window.location.href = "/login";
          return;
        }

        setCurrentUser(user);

        // Get personnel data
        const emp = await getPersonnelData(user);
        if (!emp) {
          console.error("Employee not found for user:", user);
          alert("Employee record not found. Please contact administrator.");
          setLoading(false);
          return;
        }

        // Get leave data
        const lData = await getLeaveData(user);
        
        // Update stats with accrual
        await updateAllStats(emp, lData);
      } catch (error) {
        console.error("Initialization error:", error);
        setLoading(false);
      }
    };

    initialize();
  }, [getLeaveData, updateAllStats, getPersonnelData]);

  // Pagination logic
  const filteredRequests = applyFilters(leaveData.userRequests);
  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / rowsPerPage));
  const pageStart = (currentPage - 1) * rowsPerPage;
  const paginatedRequests = filteredRequests.slice(pageStart, pageStart + rowsPerPage);

  // Pagination buttons renderer
  const renderPaginationButtons = () => {
    const pageCount = Math.max(1, Math.ceil(filteredRequests.length / rowsPerPage));
    const hasNoData = filteredRequests.length === 0;

    const buttons = [];

    // Previous button
    buttons.push(
      <button
        key="prev"
        className={`${styles.EMPLDpaginationBtn} ${
          hasNoData ? styles.EMPLDdisabled : ""
        }`}
        disabled={currentPage === 1 || hasNoData}
        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
      >
        Previous
      </button>
    );

    // Always show first page
    buttons.push(
      <button
        key={1}
        className={`${styles.EMPLDpaginationBtn} ${
          1 === currentPage ? styles.EMPLDactive : ""
        } ${hasNoData ? styles.EMPLDdisabled : ""}`}
        onClick={() => setCurrentPage(1)}
        disabled={hasNoData}
      >
        1
      </button>
    );

    // Show ellipsis after first page if needed
    if (currentPage > 3) {
      buttons.push(
        <span key="ellipsis1" className={styles.EMPLDpaginationEllipsis}>
          ...
        </span>
      );
    }

    // Show pages around current page
    let startPage = Math.max(2, currentPage - 1);
    let endPage = Math.min(pageCount - 1, currentPage + 1);

    // Adjust if we're near the beginning
    if (currentPage <= 3) {
      endPage = Math.min(pageCount - 1, 4);
    }

    // Adjust if we're near the end
    if (currentPage >= pageCount - 2) {
      startPage = Math.max(2, pageCount - 3);
    }

    // Generate middle page buttons
    for (let i = startPage; i <= endPage; i++) {
      if (i > 1 && i < pageCount) {
        buttons.push(
          <button
            key={i}
            className={`${styles.EMPLDpaginationBtn} ${
              i === currentPage ? styles.EMPLDactive : ""
            } ${hasNoData ? styles.EMPLDdisabled : ""}`}
            onClick={() => setCurrentPage(i)}
            disabled={hasNoData}
          >
            {i}
          </button>
        );
      }
    }

    // Show ellipsis before last page if needed
    if (currentPage < pageCount - 2) {
      buttons.push(
        <span key="ellipsis2" className={styles.EMPLDpaginationEllipsis}>
          ...
        </span>
      );
    }

    // Always show last page if there is more than 1 page
    if (pageCount > 1) {
      buttons.push(
        <button
          key={pageCount}
          className={`${styles.EMPLDpaginationBtn} ${
            pageCount === currentPage ? styles.EMPLDactive : ""
          } ${hasNoData ? styles.EMPLDdisabled : ""}`}
          onClick={() => setCurrentPage(pageCount)}
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
        className={`${styles.EMPLDpaginationBtn} ${
          hasNoData ? styles.EMPLDdisabled : ""
        }`}
        disabled={currentPage === pageCount || hasNoData}
        onClick={() => setCurrentPage(Math.min(pageCount, currentPage + 1))}
      >
        Next
      </button>
    );

    return buttons;
  };

  const leaveCardData = getLeaveCardData(employee, leaveData);
  const summaryCardsData = getSummaryCardsData();

  if (loading) {
    return (
      <div className="appELD">
        <EmployeeSidebar />
        <Hamburger />
        <main className={`main-content ${isSidebarCollapsed ? "collapsed" : ""}`}>
          <div className={styles.loadingContainer}>
            <div className={styles.loadingSpinner}></div>
            <p>Loading dashboard...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="appELD">
      <Title>Employee Leave Dashboard | BFP Villanueva</Title>
      <Meta name="robots" content="noindex, nofollow" />
      <EmployeeSidebar />
      <Hamburger />

      <main className={`main-content ${isSidebarCollapsed ? "collapsed" : ""}`}>
        <div className={styles.EMPLDdashboardHeader}>
          <h1>Employee Leave Dashboard</h1>
          {employee && (
            <p className={styles.welcomeMessage}>
              Welcome, {employee.first_name} {employee.last_name}!
            </p>
          )}
        </div>

        {/* Summary Cards - These show TOTAL COUNTS */}
        <div className={styles.EMPLDsummaryCards}>
          <button
            className={`${styles.EMPLDsummaryCard} ${styles.EMPLDtotal} ${
              currentFilterCard === "total" ? styles.EMPLDactive : ""
            }`}
            onClick={() => handleCardClick("total")}
            title="Click to show all requests"
          >
            <h3>Total Requests</h3>
            <p>{summaryCardsData.total}</p>
            <small>All statuses combined</small>
          </button>
          <button
            className={`${styles.EMPLDsummaryCard} ${styles.EMPLDapproved} ${
              currentFilterCard === "approved" ? styles.EMPLDactive : ""
            }`}
            onClick={() => handleCardClick("approved")}
            title={`Click to filter: ${currentFilterCard === "approved" ? "Show all" : "Show approved only"}`}
          >
            <h3>Approved</h3>
            <p>{summaryCardsData.approved}</p>
            <small>{currentFilterCard === "approved" ? "Currently filtered" : "Click to filter"}</small>
          </button>
          <button
            className={`${styles.EMPLDsummaryCard} ${styles.EMPLDpending} ${
              currentFilterCard === "pending" ? styles.EMPLDactive : ""
            }`}
            onClick={() => handleCardClick("pending")}
            title={`Click to filter: ${currentFilterCard === "pending" ? "Show all" : "Show pending only"}`}
          >
            <h3>Pending</h3>
            <p>{summaryCardsData.pending}</p>
            <small>{currentFilterCard === "pending" ? "Currently filtered" : "Click to filter"}</small>
          </button>
          <button
            className={`${styles.EMPLDsummaryCard} ${styles.EMPLDrejected} ${
              currentFilterCard === "rejected" ? styles.EMPLDactive : ""
            }`}
            onClick={() => handleCardClick("rejected")}
            title={`Click to filter: ${currentFilterCard === "rejected" ? "Show all" : "Show rejected only"}`}
          >
            <h3>Rejected</h3>
            <p>{summaryCardsData.rejected}</p>
            <small>{currentFilterCard === "rejected" ? "Currently filtered" : "Click to filter"}</small>
          </button>
        </div>

        {/* Leave Cards */}
        <div className={styles.EMPLDleaveCards}>
          <div className={styles.EMPLDleaveCard}>
            <h4>Vacation Leave</h4>
            <p>
              Total Earned This Month:{" "}
              <span>{leaveCardData?.vacation.earned || "0"}</span> days
            </p>
            <div className={styles.EMPLDprogressBar}>
              <div
                className={styles.EMPLDleaveProgress}
                style={{ width: `${leaveCardData?.vacation.progress || 0}%` }}
              ></div>
            </div>
            <p>
              <span>{leaveCardData?.vacation.value || "0 / 0"}</span> days remaining
            </p>
          </div>

          <div className={styles.EMPLDleaveCard}>
            <h4>Sick Leave</h4>
            <p>
              Total Earned This Month:{" "}
              <span>{leaveCardData?.sick.earned || "0"}</span> days
            </p>
            <div className={styles.EMPLDprogressBar}>
              <div
                className={styles.EMPLDleaveProgress}
                style={{ width: `${leaveCardData?.sick.progress || 0}%` }}
              ></div>
            </div>
            <p>
              <span>{leaveCardData?.sick.value || "0 / 0"}</span> days remaining
            </p>
          </div>

          <div className={styles.EMPLDleaveCard}>
            <h4>Emergency Leave</h4>
            <p>
              Total Earned This Month:{" "}
              <span>{leaveCardData?.emergency.earned || "0"}</span> days
            </p>
            <div className={styles.EMPLDprogressBar}>
              <div
                className={styles.EMPLDleaveProgress}
                style={{ width: `${leaveCardData?.emergency.progress || 0}%` }}
              ></div>
            </div>
            <p>
              <span>{leaveCardData?.emergency.value || "0 / 0"}</span> days remaining
            </p>
          </div>
        </div>

        {/* Recent Leave Requests */}
        <div className={styles.EMPLDtableSectionHeader}>
          <h2>
            Recent Leave Requests
            {currentFilterCard !== "total" && (
              <span className={styles.activeFilterBadge}>
                Filtered by: {currentFilterCard.charAt(0).toUpperCase() + currentFilterCard.slice(1)}
              </span>
            )}
          </h2>
          <div className={styles.tableInfo}>
            Showing {filteredRequests.length} of {leaveData.userRequests.length} total requests
          </div>
        </div>

        {/* Filters and Search */}
        <div className={styles.EMPLDtopControls}>
          <div className={styles.EMPLDtableHeader}>
            <select
              className={styles.EMPLDfilterType}
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All Types</option>
              <option value="Vacation">Vacation</option>
              <option value="Sick">Sick</option>
              <option value="Emergency">Emergency</option>
            </select>

            <select
              className={styles.EMPLDfilterStatus}
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All Status</option>
              <option value="Approved">Approved</option>
              <option value="Pending">Pending</option>
              <option value="Rejected">Rejected</option>
            </select>

            <input
              type="text"
              className={styles.EMPLDsearchBar}
              placeholder="🔍 Search requests..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>

        {/* Top Pagination */}
        <div className={`${styles.EMPLDpaginationContainer} ${styles.EMPLDtopPagination}`}>
          {renderPaginationButtons()}
        </div>

        {/* Table */}
        <div className={styles.EMPLDtableContainer}>
          <table className={styles.EMPLDtable}>
            <thead>
              <tr>
                <th>Leave Type</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Days</th>
                <th>Status</th>
                <th>Manage</th>
              </tr>
            </thead>
            <tbody className={styles.EMPLDtbody}>
              {paginatedRequests.length > 0 ? (
                paginatedRequests.map((request) => (
                  <tr key={request.id}>
                    <td>{request.leave_type}</td>
                    <td>{formatDate(request.start_date)}</td>
                    <td>{formatDate(request.end_date)}</td>
                    <td>{request.num_days}</td>
                    <td
                      className={
                        request.status?.toLowerCase() === "approved"
                          ? styles.EMPLDstatusApproved
                          : request.status?.toLowerCase() === "pending"
                          ? styles.EMPLDstatusPending
                          : styles.EMPLDstatusRejected
                      }
                    >
                      {request.status}
                    </td>
                    <td>
                      <div className={styles.EMPLDmanageButtons}>
                        <button
                          className={styles.EMPLDbtnEdit}
                          onClick={() => handleEdit(request)}
                          disabled={request.status !== "Pending"}
                          title={request.status !== "Pending" ? "Only pending requests can be edited" : "Edit"}
                        >
                          Edit
                        </button>
                        <button
                          className={styles.EMPLDbtnDelete}
                          onClick={() => handleDelete(request.id)}
                          disabled={request.status !== "Pending"}
                          title={request.status !== "Pending" ? "Only pending requests can be deleted" : "Delete"}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className={styles.EMPLDNoRequestsTable}>
                    <div style={{ fontSize: "48px", marginBottom: "16px" }}>
                      📋
                    </div>
                    <h3
                      style={{
                        fontSize: "18px",
                        fontWeight: "600",
                        color: "#2b2b2b",
                        marginBottom: "8px",
                      }}
                    >
                      No Leave Requests Found
                    </h3>
                    <p style={{ fontSize: "14px", color: "#999" }}>
                      {search || filterStatus || filterType || currentFilterCard !== "total"
                        ? "Try adjusting your filters or search terms"
                        : "You haven't submitted any leave requests yet"}
                    </p>
                    <p style={{ fontSize: "12px", color: "#666", marginTop: "8px" }}>
                      Current filter: {currentFilterCard} | Status: {filterStatus || "Any"} | Type: {filterType || "Any"}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom Pagination */}
        <div className={styles.EMPLDpaginationContainer}>
          {renderPaginationButtons()}
        </div>

        {/* Edit Modal */}
        {editModalOpen && selectedRequest && (
          <div className={`${styles.EMPLDmodal} ${styles.EMPLDmodalOpen}`}>
            <div className={styles.EMPLDmodalContent}>
              <span
                className={styles.EMPLDclose}
                onClick={() => setEditModalOpen(false)}
              >
                &times;
              </span>
              <h2>Edit Leave Request</h2>
              <form onSubmit={handleEditSubmit}>
                <label>Leave Type</label>
                <select
                  name="leaveType"
                  defaultValue={selectedRequest.leave_type}
                  required
                >
                  <option value="Vacation">Vacation</option>
                  <option value="Sick">Sick</option>
                  <option value="Emergency">Emergency</option>
                </select>
                <label>Start Date</label>
                <input
                  type="date"
                  name="startDate"
                  defaultValue={selectedRequest.start_date}
                  required
                />
                <label>End Date</label>
                <input
                  type="date"
                  name="endDate"
                  defaultValue={selectedRequest.end_date}
                  required
                  min={selectedRequest.start_date}
                />
                <div className={styles.EMPLDmodalActions}>
                  <button
                    type="button"
                    className={styles.EMPLDmodalCancel}
                    onClick={() => setEditModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className={styles.EMPLDmodalSubmit}>
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Modal */}
        {deleteModalOpen && (
          <div className={`${styles.EMPLDmodal} ${styles.EMPLDmodalOpen}`}>
            <div className={styles.EMPLDmodalContent}>
              <span
                className={styles.EMPLDclose}
                onClick={() => setDeleteModalOpen(false)}
              >
                &times;
              </span>
              <h2>Confirm Delete</h2>
              <p>Are you sure you want to delete this leave request?</p>
              <p className={styles.warningText}>
                <strong>Note:</strong> Only pending leave requests can be deleted.
              </p>
              <div className={styles.EMPLDmodalActions}>
                <button
                  className={styles.EMPLDmodalCancel}
                  onClick={() => setDeleteModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  className={styles.EMPLDconfirmDelete}
                  onClick={handleDeleteConfirm}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default EmployeeLeaveDashboard;