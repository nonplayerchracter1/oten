// components/EmployeeDashboard.jsx - COMPLETE with enhanced clearance stats panel
import React, { useState, useEffect } from "react";
import { useAuth } from "../../AuthContext.jsx";
//import { openDB, STORE_PERSONNEL, STORE_INVENTORY, STORE_CLEARANCE } from "./db";
import EmployeeSidebar from "../../EmployeeSidebar.jsx";
import Hamburger from "../../Hamburger.jsx";
import styles from "../styles/EmployeeDashboard.module.css";
import { useSidebar } from "../../SidebarContext.jsx";
import { Title, Meta } from "react-head";
import { supabase } from "../../../lib/supabaseClient.js";
import jsbarcode from "jsbarcode";

const EmployeeDashboard = () => {
  const { user } = useAuth();
  const [employee, setEmployee] = useState(null);
  const [assignedEquipment, setAssignedEquipment] = useState([]);
  const [clearanceRequests, setClearanceRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const { isSidebarCollapsed } = useSidebar();
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [selectedBarcode, setSelectedBarcode] = useState(null);
  const [clearanceLoading, setClearanceLoading] = useState(false);

  // Add rank options array from your PersonnelRegister - UPDATED
  const rankOptions = [
    {
      rank: "FO1",
      name: "Fire Officer 1",
      image: `${
        import.meta.env.VITE_SUPABASE_URL
      }/storage/v1/object/public/rank_images/FO1.png`,
    },
    {
      rank: "FO2",
      name: "Fire Officer 2",
      image: `${
        import.meta.env.VITE_SUPABASE_URL
      }/storage/v1/object/public/rank_images/FO2.png`,
    },
    {
      rank: "FO3",
      name: "Fire Officer 3",
      image: `${
        import.meta.env.VITE_SUPABASE_URL
      }/storage/v1/object/public/rank_images/FO3.png`,
    },
    {
      rank: "SFO1",
      name: "Senior Fire Officer 1",
      image: `${
        import.meta.env.VITE_SUPABASE_URL
      }/storage/v1/object/public/rank_images/SFO1.png`,
    },
    {
      rank: "SFO2",
      name: "Senior Fire Officer 2",
      image: `${
        import.meta.env.VITE_SUPABASE_URL
      }/storage/v1/object/public/rank_images/SFO2.png`,
    },
    {
      rank: "SFO3",
      name: "Senior Fire Officer 3",
      image: `${
        import.meta.env.VITE_SUPABASE_URL
      }/storage/v1/object/public/rank_images/SFO3.png`,
    },
    {
      rank: "SFO4",
      name: "Senior Fire Officer 4",
      image: `${
        import.meta.env.VITE_SUPABASE_URL
      }/storage/v1/object/public/rank_images/SFO4.png`,
    },
  ];

  useEffect(() => {
    if (user && user.role === "employee") {
      loadEmployeeData();
    } else {
      setLoading(false);
    }
  }, [user]);

  const loadEmployeeData = async () => {
    try {
      setLoading(true);

      if (user.username) {
        // Load employee from Supabase
        const { data: employeeData, error } = await supabase
          .from("personnel")
          .select("*")
          .eq("username", user.username)
          .single();

        if (error) {
          console.error("Error loading employee from Supabase:", error);
          // await loadEmployeeFromIndexedDB(); // Commented out for now
        } else if (employeeData) {
          setEmployee(employeeData);

          // Load both equipment and clearance in parallel
          await Promise.all([
            loadAssignedEquipment(employeeData),
            loadClearanceRequests(employeeData),
          ]);
        } else {
          // await loadEmployeeFromIndexedDB(); // Commented out for now
        }
      }
    } catch (error) {
      console.error("Error loading employee data:", error);
      // await loadEmployeeFromIndexedDB(); // Commented out for now
    } finally {
      setLoading(false);
    }
  };

  const loadAssignedEquipment = async (emp) => {
    try {
      const { data: inventoryData, error } = await supabase
        .from("inventory")
        .select("*");

      if (!error && inventoryData) {
        const fullName = `${emp.first_name} ${emp.last_name}`
          .toLowerCase()
          .trim();

        const assignedItems = inventoryData.filter((item) => {
          if (!item.assigned_to) return false;

          const assignedToName = item.assigned_to.toLowerCase().trim();
          return (
            assignedToName.includes(fullName) ||
            assignedToName.includes(emp.first_name.toLowerCase()) ||
            assignedToName.includes(emp.last_name.toLowerCase())
          );
        });

        console.log("Assigned items:", assignedItems);
        setAssignedEquipment(assignedItems);
      } else {
        // await loadAssignedEquipmentFromDB(emp); // Commented out for now
      }
    } catch (error) {
      console.error("Error loading assigned equipment:", error);
      // await loadAssignedEquipmentFromDB(emp); // Commented out for now
    }
  };

  const loadClearanceRequests = async (emp) => {
    try {
      setClearanceLoading(true);
      console.log("Loading clearance for employee ID:", emp.id);

      // Use the correct table name and filter by personnel_id
      const { data: clearanceData, error } = await supabase
        .from("clearance_requests")
        .select(
          `
          *,
          personnel:personnel_id (
            first_name,
            middle_name,
            last_name
          )
        `
        )
        .eq("personnel_id", emp.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading clearance requests:", error);
        // await loadClearanceRequestsFromDB(emp); // Commented out for now
      } else if (clearanceData) {
        console.log("Clearance data loaded:", clearanceData);

        // Format the clearance data
        const formattedClearances = clearanceData.map((clearance) => ({
          id: clearance.id,
          type: clearance.type,
          status: clearance.status,
          date: clearance.created_at
            ? new Date(clearance.created_at).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })
            : "",
          reason: clearance.reason,
          remarks: clearance.remarks,
          approved_by: clearance.approved_by,
          approved_at: clearance.approved_at,
          created_at: clearance.created_at,
          // Get employee name from the joined personnel data
          employee_name: clearance.personnel
            ? `${clearance.personnel.first_name || ""} ${
                clearance.personnel.middle_name || ""
              } ${clearance.personnel.last_name || ""}`
                .replace(/\s+/g, " ")
                .trim()
            : "Unknown",
        }));

        setClearanceRequests(formattedClearances);
      } else {
        // await loadClearanceRequestsFromDB(emp); // Commented out for now
      }
    } catch (error) {
      console.error("Error loading clearance requests:", error);
      // await loadClearanceRequestsFromDB(emp); // Commented out for now
    } finally {
      setClearanceLoading(false);
    }
  };

  const getEmployeePhoto = () => {
    if (!employee) return "/default-profile.png";

    if (employee.photo_url) {
      return employee.photo_url;
    }

    if (employee.photoURL) {
      if (employee.photoURL.startsWith("data:image")) {
        return employee.photoURL;
      }
      return employee.photoURL;
    }

    if (employee.photo_base64) {
      return employee.photo_base64;
    }

    return "/default-profile.png";
  };

  // Add helper function to get rank image
  const getRankImage = (rankCode) => {
    if (!rankCode) return null;
    
    const rank = rankOptions.find(r => r.rank === rankCode);
    return rank ? rank.image : null;
  };

  // Generate barcode image for display
  const generateBarcodeImage = (itemCode, itemName) => {
    return new Promise((resolve, reject) => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 200;
        canvas.height = 80;

        jsbarcode(canvas, itemCode, {
          format: "CODE128",
          displayValue: true,
          fontSize: 12,
          textMargin: 5,
          margin: 5,
          width: 1.5,
          height: 40,
        });

        const dataUrl = canvas.toDataURL("image/png");
        resolve(dataUrl);
      } catch (error) {
        console.error("Error generating barcode:", error);
        reject(error);
      }
    });
  };

  // Show barcode modal
  const showBarcode = (itemCode, itemName) => {
    setSelectedBarcode({
      code: itemCode,
      name: itemName,
    });
    setShowBarcodeModal(true);
  };

  // Download barcode
  const downloadBarcode = async (itemCode, itemName) => {
    try {
      const barcodeImage = await generateBarcodeImage(itemCode, itemName);

      if (barcodeImage) {
        const link = document.createElement("a");
        link.href = barcodeImage;
        link.download = `Barcode_${itemCode}_${itemName.replace(
          /[^a-z0-9]/gi,
          "_"
        )}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error("Error downloading barcode:", error);
      alert("Error downloading barcode");
    }
  };

  // Initialize barcode canvas when modal opens
  useEffect(() => {
    if (showBarcodeModal && selectedBarcode) {
      setTimeout(() => {
        const canvas = document.getElementById("employee-barcode-canvas");
        if (canvas) {
          const ctx = canvas.getContext("2d");
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          jsbarcode(canvas, selectedBarcode.code, {
            format: "CODE128",
            displayValue: true,
            fontSize: 14,
            textMargin: 8,
            margin: 10,
            width: 2,
            height: 50,
          });
        }
      }, 100);
    }
  }, [showBarcodeModal, selectedBarcode]);

  const getStatusColor = (status) => {
    const statusLower = (status || "").toLowerCase();
    switch (statusLower) {
      case "approved":
      case "completed":
      case "active":
      case "good":
        return "#10b981";
      case "pending":
      case "in progress":
      case "needs maintenance":
        return "#f59e0b";
      case "rejected":
      case "cancelled":
      case "inactive":
      case "damaged":
        return "#ef4444";
      default:
        return "#6b7280";
    }
  };

  // Format date function
  const formatDate = (dateString) => {
    if (!dateString || dateString.trim() === "") return "-";

    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return dateString;
      }
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch (error) {
      console.warn("Date formatting error:", error);
      return dateString;
    }
  };

  // Format datetime for clearance
  const formatDateTime = (dateString) => {
    if (!dateString || dateString.trim() === "") return "-";

    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return dateString;
      }
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (error) {
      console.warn("Date formatting error:", error);
      return dateString;
    }
  };

  // View clearance details
  const viewClearanceDetails = (clearance) => {
    const details = `
      Clearance ID: ${clearance.id}
      Type: ${clearance.type}
      Status: ${clearance.status}
      Request Date: ${clearance.date}
      ${clearance.reason ? `Reason: ${clearance.reason}\n` : ""}
      ${clearance.remarks ? `Remarks: ${clearance.remarks}\n` : ""}
      ${clearance.approved_by ? `Approved By: ${clearance.approved_by}\n` : ""}
      ${
        clearance.approved_at
          ? `Approved At: ${formatDateTime(clearance.approved_at)}\n`
          : ""
      }
    `;

    alert("Clearance Details:\n\n" + details);
  };

  // Refresh clearance data
  const refreshClearanceData = async () => {
    if (employee) {
      setClearanceLoading(true);
      await loadClearanceRequests(employee);
    }
  };

  // Helper function to calculate average processing time (placeholder)
  const calculateAverageProcessingTime = (requests) => {
    if (requests.length === 0) return "N/A";
    
    // Simplified calculation - in a real app, you'd calculate actual durations
    const completedRequests = requests.filter(r => r.status === "Completed");
    if (completedRequests.length === 0) return "N/A";
    
    return "3 days"; // Placeholder
  };

  // Helper function to get this month's requests
  const getThisMonthRequests = (requests) => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const thisMonthRequests = requests.filter(request => {
      if (!request.created_at) return false;
      const requestDate = new Date(request.created_at);
      return requestDate.getMonth() === currentMonth && 
             requestDate.getFullYear() === currentYear;
    });
    
    return `${thisMonthRequests.length} req`;
  };

  // Helper function to get appropriate equipment emoji
  const getEquipmentEmoji = (equipment) => {
    const count = equipment.length;
    
    if (count === 0) return "📭"; // Empty
    if (equipment.some(e => e.status === "Damaged")) return "⚠️"; // Damaged
    if (equipment.some(e => e.status === "Needs Maintenance")) return "🔧"; // Maintenance needed
    
    // Emoji based on count
    if (count === 1) return "💻"; // Single laptop
    if (count >= 2 && count <= 3) return "🖥️"; // Few computers
    if (count >= 4 && count <= 5) return "📱"; // Multiple devices
    if (count >= 6) return "🚚"; // Many items
    return "💻"; // Default
  };

  if (loading) {
    return (
      <div className={styles.modernLoading}>
        <div className={styles.loadingSpinner}></div>
        <p>Loading your dashboard...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={styles.modernLoading}>
        <p>Please log in to access the dashboard.</p>
      </div>
    );
  }

  return (
    <div className="app">
      <Title>Employee Dashboard | BFP Villanueva</Title>
      <Meta name="robots" content="noindex, nofollow" />
      <EmployeeSidebar />
      <Hamburger />

      <div className={`main-content ${isSidebarCollapsed ? "collapsed" : ""}`}>
        <div className={styles.modernHeader}>
          <div className={styles.headerContent}>
            <h1>Employee Dashboard</h1>
            <p>Welcome back, {employee?.first_name || "Employee"}!</p>
          </div>
        </div>

        <main className={styles.modernMain}>
          {/* Quick Stats - UPDATED WITH RANK IMAGES */}
          {/* FIXED: Added missing container div for quickStats */}
          <div className={styles.quickStats}>
            {/* Equipment Stat Card - CENTERED EMOJI VERSION */}
            <div 
              className={`${styles.statCard} ${styles.equipmentStat}`}
              data-count={assignedEquipment.length}
              data-has-damaged={assignedEquipment.some(e => e.status === "Damaged")}
              data-needs-maintenance={assignedEquipment.some(e => e.status === "Needs Maintenance")}
            >
              <div className={styles.statIcon}>
                <i className="fas fa-laptop"></i>
                {/* FIXED: Using correct className from CSS */}
                <span className={styles.emojiInsideIcon}>
                  {getEquipmentEmoji(assignedEquipment)}
                </span>
              </div>
              <div className={styles.statInfo}>
                <h3>{assignedEquipment.length}</h3>
                <p>Assigned Equipment</p>
              </div>
            </div>

            {/* Clearance Stat Card - CENTERED EMOJI VERSION */}
            <div 
              className={`${styles.statCard} ${styles.clearanceStat}`}
              data-count={clearanceRequests.length}
              data-pending={clearanceRequests.some(c => c.status === "Pending")}
            >
              <div className={styles.statIcon}>
                <i className="fas fa-file-contract"></i>
                {/* FIXED: Using correct className from CSS */}
                <span className={styles.emojiInsideIcon}>
                  {clearanceRequests.length === 0 ? "✅" : 
                   clearanceRequests.length > 5 ? "⚠️" : "📄"}
                </span>
              </div>
              <div className={styles.statInfo}>
                <h3>{clearanceRequests.length}</h3>
                <p>Clearance Requests</p>
              </div>
            </div>

            <div className={`${styles.statCard} ${styles.rankStat}`}>
              <div className={styles.statIcon}>
                {employee?.rank && (employee?.rank_image || getRankImage(employee.rank)) ? (
                  <img 
                    src={employee.rank_image || getRankImage(employee.rank)} 
                    alt={employee.rank}
                    className={styles.rankImageIcon}
                    onError={(e) => {
                      e.target.onerror = null;
                      // Fallback to local image if Supabase image fails
                      const rankCode = employee?.rank || "";
                      e.target.src = `/ranks/${rankCode}.png`;
                    }}
                  />
                ) : (
                  <i className="fas fa-user-shield"></i>
                )}
              </div>
              <div className={styles.statInfo}>
                <h3>{employee?.rank || "N/A"}</h3>
                <p>Current Rank</p>
              </div>
            </div>
          </div>

          <div className={styles.dashboardGrid}>
            {/* Profile Card */}
            <div className={styles.profileCard}>
              <div className={styles.cardHeader}>
                <h2>Profile Information</h2>
                <div className={styles.statusBadge}>
                  <span className={styles.statusDot}></span>
                  Active
                </div>
              </div>

              <div className={styles.profileContent}>
                <div className={styles.avatarSection}>
                  <div className={styles.avatarWrapper}>
                    <img
                      src={getEmployeePhoto()}
                      alt={`${employee?.rank || ""} ${
                        employee?.first_name || ""
                      } ${employee?.last_name || ""}'s photo`}
                      className={styles.profilePhoto}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = "/default-profile.png";
                      }}
                    />
                    <div className={styles.avatarOverlay}>
                      <i className="fas fa-camera"></i>
                    </div>
                  </div>
                  <h3>{`${employee?.rank || ""} ${employee?.first_name || ""} ${
                    employee?.middle_name || ""
                  } ${employee?.last_name || ""}`}</h3>
                  <p>{employee?.designation || "Employee"}</p>
                </div>

                <div className={styles.profileDetails}>
                  <div className={styles.detailGrid}>
                    <div className={styles.detailItem}>
                      <i className="fas fa-id-badge"></i>
                      <div>
                        <label>Badge Number</label>
                        <span>{employee?.badge_number || "-"}</span>
                      </div>
                    </div>

                    <div className={styles.detailItem}>
                      <i className="fas fa-map-marker-alt"></i>
                      <div>
                        <label>Station</label>
                        <span>{employee?.station || "-"}</span>
                      </div>
                    </div>

                    <div className={styles.detailItem}>
                      <i className="fas fa-birthday-cake"></i>
                      <div>
                        <label>Birth Date</label>
                        <span>{formatDate(employee?.birth_date)}</span>
                      </div>
                    </div>

                    <div className={styles.detailItem}>
                      <i className="fas fa-calendar-alt"></i>
                      <div>
                        <label>Date Hired</label>
                        <span>{formatDate(employee?.date_hired)}</span>
                      </div>
                    </div>

                    <div className={styles.detailItem}>
                      <i className="fas fa-user"></i>
                      <div>
                        <label>Username</label>
                        <span>{employee?.username || "-"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Content Area */}
            <div className={styles.contentArea}>
              {/* Navigation Tabs */}
              <div className={styles.tabNavigation}>
                <button
                  className={`${styles.tabButton} ${
                    activeTab === "overview" ? styles.active : ""
                  }`}
                  onClick={() => setActiveTab("overview")}
                >
                  <i className="fas fa-chart-pie"></i>
                  Overview
                </button>
                <button
                  className={`${styles.tabButton} ${
                    activeTab === "equipment" ? styles.active : ""
                  }`}
                  onClick={() => setActiveTab("equipment")}
                >
                  <i className="fas fa-laptop"></i>
                  Equipment
                </button>
                <button
                  className={`${styles.tabButton} ${
                    activeTab === "clearance" ? styles.active : ""
                  }`}
                  onClick={() => setActiveTab("clearance")}
                >
                  <i className="fas fa-file-contract"></i>
                  Clearance
                </button>
              </div>

              {/* Tab Content */}
              <div className={styles.tabContent}>
                {activeTab === "overview" && (
                  <div className={styles.overviewGrid}>
                    <div className={styles.overviewCard}>
                      <div className={styles.cardHeader}>
                        <h3>Recent Equipment</h3>
                        <span className={styles.badge}>
                          {assignedEquipment.length} items
                        </span>
                      </div>
                      <div className={styles.equipmentList}>
                        {assignedEquipment.slice(0, 6).map((item, index) => (
                          <div key={index} className={styles.equipmentItem}>
                            <div className={styles.equipmentIcon}>
                              <i className="fas fa-laptop"></i>
                            </div>
                            <div className={styles.equipmentInfo}>
                              <h4>
                                {item.item_name ||
                                  item.itemName ||
                                  "Unnamed Equipment"}
                              </h4>
                              <p>{item.category || "No Category"}</p>
                              <small>
                                Barcode:{" "}
                                {item.item_code || item.itemCode || "N/A"}
                              </small>
                            </div>
                            <div 
                              className={styles.equipmentStatus}
                              style={{
                                backgroundColor: getStatusColor(item.status),
                              }}
                            ></div>
                          </div>
                        ))}
                        {assignedEquipment.length === 0 && (
                          <p className={styles.noData}>No equipment assigned</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "equipment" && (
                  <div className={styles.tableCard}>
                    <div className={styles.cardHeader}>
                      <h3>Assigned Equipment</h3>
                      <span className={styles.badge}>
                        {assignedEquipment.length} items
                      </span>
                    </div>
                    <div className={styles.tableContainer}>
                      <table className={styles.modernTable}>
                        <thead>
                          <tr>
                            <th>Equipment Name</th>
                            <th>Barcode</th>
                            <th>Category</th>
                            <th>Purchase Date</th>
                            <th>Last Checked</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {assignedEquipment.map((item, index) => (
                            <tr key={index}>
                              <td>
                                <div className={styles.itemWithIcon}>
                                  <i className="fas fa-laptop"></i>
                                  {item.item_name || item.itemName || "-"}
                                </div>
                              </td>
                              <td>
                                <div className={styles.barcodeCell}>
                                  <span className={styles.barcodeText}>
                                    {item.item_code || item.itemCode || "-"}
                                  </span>
                                </div>
                              </td>
                              <td>
                                <span className={styles.categoryTag}>
                                  {item.category || "-"}
                                </span>
                              </td>
                              <td>
                                {formatDate(
                                  item.purchase_date || item.purchaseDate
                                )}
                              </td>
                              <td>
                                {formatDate(
                                  item.last_checked || item.lastChecked
                                )}
                              </td>
                              <td>
                                <span
                                  className={styles.statusBadge}
                                  style={{
                                    backgroundColor: getStatusColor(
                                      item.status
                                    ),
                                    color: "white",
                                  }}
                                >
                                  {item.status || "-"}
                                </span>
                              </td>
                            </tr>
                          ))}
                          {assignedEquipment.length === 0 && (
                            <tr>
                              <td colSpan="6" className={styles.noData}>
                                No equipment assigned.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {activeTab === "clearance" && (
                  <div className={styles.tableCard}>
                    <div className={styles.cardHeader}>
                      <h3>My Clearance Requests</h3>
                      <div className={styles.headerActions}>
                        <span className={styles.badge}>
                          {clearanceRequests.length} requests
                        </span>
                        <button
                          className={styles.refreshBtn}
                          onClick={refreshClearanceData}
                          disabled={clearanceLoading}
                        >
                          <i
                            className={`fas fa-sync ${
                              clearanceLoading ? "fa-spin" : ""
                            }`}
                          ></i>
                          Refresh
                        </button>
                      </div>
                    </div>

                    {clearanceLoading ? (
                      <div className={styles.loadingContainer}>
                        <div className={styles.loadingSpinnerSmall}></div>
                        <p>Loading clearance requests...</p>
                      </div>
                    ) : (
                      <div className={styles.tableContainer}>
                        <table className={styles.modernTable}>
                          <thead>
                            <tr>
                              <th>Request Date</th>
                              <th>Clearance Type</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {clearanceRequests.map((clearance, index) => (
                              <tr key={clearance.id || index}>
                                <td>
                                  <div className={styles.dateCell}>
                                    <div className={styles.dateText}>
                                      {clearance.date}
                                    </div>
                                    {clearance.created_at && (
                                      <div className={styles.timeText}>
                                        {new Date(
                                          clearance.created_at
                                        ).toLocaleTimeString([], {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })}
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td>
                                  <div className={styles.typeCell}>
                                    <div
                                      className={`${styles.typeBadge} ${
                                        styles[
                                          "type-" +
                                            (clearance.type?.toLowerCase() ||
                                              "other")
                                        ]
                                      }`}
                                    >
                                      <i className="fas fa-file-alt"></i>
                                      {clearance.type || "Unknown"}
                                    </div>
                                    {clearance.reason && (
                                      <div className={styles.reasonText}>
                                        {clearance.reason.length > 50
                                          ? clearance.reason.substring(0, 50) +
                                            "..."
                                          : clearance.reason}
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td>
                                  <div className={styles.statusCell}>
                                    <span
                                      className={styles.statusBadge}
                                      style={{
                                        backgroundColor: getStatusColor(
                                          clearance.status
                                        ),
                                        color: "white",
                                      }}
                                    >
                                      {clearance.status || "Unknown"}
                                    </span>
                                    {clearance.approved_by && (
                                      <div className={styles.approvedBy}>
                                        <small>
                                          <i className="fas fa-user-check"></i>
                                          {clearance.approved_by}
                                        </small>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                            {clearanceRequests.length === 0 && (
                              <tr>
                                <td colSpan="3" className={styles.noData}>
                                  <div className={styles.emptyState}>
                                    <i className="fas fa-file-alt"></i>
                                    <h4>No Clearance Requests</h4>
                                    <p>
                                      You haven't submitted any clearance
                                      requests yet.
                                    </p>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Clearance Information Panel - ENHANCED */}
                    {clearanceRequests.length > 0 && (
                      <div className={styles.clearanceStatsPanel}>
                        <div className={styles.panelHeader}>
                          <i className="fas fa-chart-bar"></i>
                          <h4>Clearance Overview</h4>
                        </div>
                        <div className={styles.statsGrid}>
                          {/* Pending Requests */}
                          <div className={`${styles.statBox} ${styles.pendingStat}`}>
                            <div className={styles.statIconBox}>
                              <div className={styles.iconWrapper}>
                                <i className="fas fa-clock"></i>
                              </div>
                              <div className={styles.statNumber}>
                                {clearanceRequests.filter(c => c.status === "Pending").length}
                              </div>
                            </div>
                            <div className={styles.statLabel}>Pending Requests</div>
                            <div className={styles.statProgress}>
                              <div 
                                className={styles.progressBar}
                                style={{
                                  width: `${(clearanceRequests.filter(c => c.status === "Pending").length / clearanceRequests.length) * 100}%`
                                }}
                              ></div>
                            </div>
                          </div>

                          {/* Completed Requests */}
                          <div className={`${styles.statBox} ${styles.completedStat}`}>
                            <div className={styles.statIconBox}>
                              <div className={styles.iconWrapper}>
                                <i className="fas fa-check-circle"></i>
                              </div>
                              <div className={styles.statNumber}>
                                {clearanceRequests.filter(c => c.status === "Completed").length}
                              </div>
                            </div>
                            <div className={styles.statLabel}>Completed Requests</div>
                            <div className={styles.statProgress}>
                              <div 
                                className={styles.progressBar}
                                style={{
                                  width: `${(clearanceRequests.filter(c => c.status === "Completed").length / clearanceRequests.length) * 100}%`
                                }}
                              ></div>
                            </div>
                          </div>

                          {/* Latest Request */}
                          <div className={`${styles.statBox} ${styles.latestStat}`}>
                            <div className={styles.statIconBox}>
                              <div className={styles.iconWrapper}>
                                <i className="fas fa-calendar-star"></i>
                              </div>
                              <div className={styles.statDate}>
                                {clearanceRequests.length > 0 ? clearanceRequests[0].date : "None"}
                              </div>
                            </div>
                            <div className={styles.statLabel}>Latest Request</div>
                            <div className={styles.statMeta}>
                              <span className={styles.requestCount}>
                                <i className="fas fa-file-alt"></i>
                                {clearanceRequests.length} total requests
                              </span>
                              {clearanceRequests[0]?.status && (
                                <span 
                                  className={styles.latestStatus}
                                  style={{ backgroundColor: getStatusColor(clearanceRequests[0].status) }}
                                >
                                  {clearanceRequests[0].status}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Summary Bar */}
                        <div className={styles.summaryBar}>
                          <div className={styles.summaryItem}>
                            <i className="fas fa-percentage"></i>
                            <span>Completion Rate:</span>
                            <strong>
                              {clearanceRequests.length > 0 
                                ? Math.round((clearanceRequests.filter(c => c.status === "Completed").length / clearanceRequests.length) * 100) 
                                : 0}%
                            </strong>
                          </div>
                          <div className={styles.summaryItem}>
                            <i className="fas fa-hourglass-half"></i>
                            <span>Avg Processing:</span>
                            <strong>{calculateAverageProcessingTime(clearanceRequests)}</strong>
                          </div>
                          <div className={styles.summaryItem}>
                            <i className="fas fa-trend-up"></i>
                            <span>This Month:</span>
                            <strong>{getThisMonthRequests(clearanceRequests)}</strong>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Barcode Modal */}
      {showBarcodeModal && selectedBarcode && (
        <div
          className={styles.barcodeModalOverlay}
          onClick={() => setShowBarcodeModal(false)}
        >
          <div
            className={styles.barcodeModal}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.barcodeModalHeader}>
              <h3>Equipment Barcode</h3>
              <button
                className={styles.barcodeModalClose}
                onClick={() => setShowBarcodeModal(false)}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className={styles.barcodeModalContent}>
              <div className={styles.barcodeInfo}>
                <h4>{selectedBarcode.name}</h4>
                <p>
                  <strong>Code:</strong> {selectedBarcode.code}
                </p>
              </div>
              <canvas
                id="employee-barcode-canvas"
                width="300"
                height="120"
                className={styles.barcodeCanvas}
              />
              <div className={styles.barcodeModalActions}>
                <button
                  className={styles.barcodeDownloadBtn}
                  onClick={() =>
                    downloadBarcode(selectedBarcode.code, selectedBarcode.name)
                  }
                >
                  <i className="fas fa-download"></i> Download Barcode
                </button>
                <button
                  className={styles.barcodeCloseBtn}
                  onClick={() => setShowBarcodeModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeDashboard;