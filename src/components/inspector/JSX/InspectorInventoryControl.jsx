// Inspection.jsx
import React, { useEffect, useState, useRef } from "react";
import styles from "../styles/InspectorInventoryControl.module.css";
import { Html5QrcodeScanner } from "html5-qrcode";
import InspectorSidebar from "../../InspectorSidebar.jsx";
import Hamburger from "../../Hamburger.jsx";
import { useSidebar } from "../../SidebarContext.jsx";
import Flatpickr from "react-flatpickr";
import "flatpickr/dist/flatpickr.css";
import { Title, Meta } from "react-head";
import { supabase } from "../../../lib/supabaseClient.js";

export default function InspectionControl() {
  // Status constants
  const STATUS_OPTIONS = [
    { value: "PENDING", label: "Pending" },
    { value: "IN_PROGRESS", label: "In Progress" },
    { value: "COMPLETED", label: "Completed" },
    { value: "FAILED", label: "Failed" },
    { value: "CANCELLED", label: "Cancelled" },
  ];

  // Helper function to get display label for status
  const getStatusDisplay = (status) => {
    switch (status) {
      case "PENDING":
        return "Pending";
      case "IN_PROGRESS":
        return "In Progress";
      case "COMPLETED":
        return "Completed";
      case "FAILED":
        return "Failed";
      case "CANCELLED":
        return "Cancelled";
      default:
        return status;
    }
  };

  // Helper function to get CSS class for status
  const getStatusClass = (status) => {
    switch (status) {
      case "COMPLETED":
        return "COMPLETED";
      case "FAILED":
        return "FAILED";
      case "CANCELLED":
        return "CANCELLED";
      case "IN_PROGRESS":
        return "IN_PROGRESS";
      case "PENDING":
        return "PENDING";
      default:
        return "";
    }
  };

  // Add new function for equipment status
  const getEquipmentStatusClass = (status) => {
    const formattedStatus = status?.replace(/ /g, "") || "";
    switch (formattedStatus) {
      case "Good":
        return "Good";
      case "NeedsMaintenance":
        return "NeedsMaintenance";
      case "Damaged":
        return "Damaged";
      case "UnderRepair":
        return "UnderRepair";
      case "Retired":
        return "Retired";
      case "Lost":
        return "Lost";
      default:
        return "";
    }
  };

  // data
  const [inspections, setInspections] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [personnel, setPersonnel] = useState([]);
  const { isSidebarCollapsed } = useSidebar();
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 5;

  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [currentFilterCard, setCurrentFilterCard] = useState("total");
  const [showScanner, setShowScanner] = useState(false);
  const qrScannerRef = useRef(null);

  // View Details Modal State
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState(null);

  // delete modal
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  // Summary numbers (computed)
  const totalInspections = inspections.length;
  const passedInspections = inspections.filter(
    (i) => i.status === "COMPLETED"
  ).length;
  const failedInspections = inspections.filter(
    (i) => i.status === "FAILED"
  ).length;
  const needsAttentionInspections = inspections.filter(
    (i) => i.status === "PENDING" || i.status === "IN_PROGRESS"
  ).length;

  // Load inspections with joined data from inventory and personnel
  async function loadInspections() {
    try {
      const { data: inspectionsData, error: inspectionsError } = await supabase
        .from("inspections")
        .select(
          `
          *,
          inventory:equipment_id (
            item_code,
            item_name,
            category,
            status,
            assigned_to,
            assigned_date,
            manufacturer,
            model_number,
            serial_number,
            purchase_date,
            last_checked,
            next_maintenance_date,
            current_location,
            storage_location
          ),
          inspector:inspector_id (
            first_name,
            last_name,
            badge_number,
            rank
          )
        `
        )
        .order("schedule_inspection_date", { ascending: false });

      if (inspectionsError) throw inspectionsError;

      // Transform the data to include the joined fields
      const transformedData = inspectionsData.map((inspection) => ({
        ...inspection,
        item_code: inspection.inventory?.item_code || "N/A",
        equipment_name: inspection.inventory?.item_name || "Unknown Equipment",
        category: inspection.inventory?.category || "Uncategorized",
        equipment_status: inspection.inventory?.status || "Unknown",
        assigned_to: inspection.inventory?.assigned_to || "Unassigned",
        assigned_date: inspection.inventory?.assigned_date || null,
        inspector_name: inspection.inspector
          ? `${inspection.inspector.first_name} ${inspection.inspector.last_name}`
          : "Unknown Inspector",
        inspector_badge: inspection.inspector?.badge_number || "N/A",
        inspector_rank: inspection.inspector?.rank || "N/A",
        // Additional equipment details
        manufacturer: inspection.inventory?.manufacturer || "N/A",
        model_number: inspection.inventory?.model_number || "N/A",
        serial_number: inspection.inventory?.serial_number || "N/A",
        purchase_date: inspection.inventory?.purchase_date || null,
        last_checked: inspection.inventory?.last_checked || null,
        next_maintenance_date:
          inspection.inventory?.next_maintenance_date || null,
        current_location: inspection.inventory?.current_location || "N/A",
        storage_location: inspection.inventory?.storage_location || "N/A",
        // For backward compatibility
        equipment_id: inspection.equipment_id,
        inspector_id: inspection.inspector_id,
      }));

      setInspections(transformedData || []);

      // reset page if necessary
      const totalPages = Math.max(
        1,
        Math.ceil((transformedData?.length || 0) / rowsPerPage)
      );
      if (currentPage > totalPages) setCurrentPage(totalPages);
    } catch (err) {
      console.error("loadInspections error", err);
    }
  }

  async function loadInventory() {
    try {
      const { data, error } = await supabase
        .from("inventory")
        .select(
          "id, item_name, item_code, category, status, assigned_to, assigned_date"
        )
        .order("item_name");

      if (error) throw error;
      setInventory(data || []);
    } catch (err) {
      console.error("loadInventory error", err);
    }
  }

  async function loadPersonnel() {
    try {
      const { data, error } = await supabase
        .from("personnel")
        .select("id, first_name, last_name, badge_number, rank")
        .order("last_name");

      if (error) throw error;
      setPersonnel(data || []);
    } catch (err) {
      console.error("loadPersonnel error", err);
    }
  }

  useEffect(() => {
    loadInspections();
    loadInventory();
    loadPersonnel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filtering & pagination logic
  function applyFilters(items) {
    // card filter
    let filtered = [...items];
    if (currentFilterCard === "passed") {
      filtered = filtered.filter((i) => i.status === "COMPLETED");
    } else if (currentFilterCard === "failed") {
      filtered = filtered.filter((i) => i.status === "FAILED");
    } else if (currentFilterCard === "needsAttention") {
      filtered = filtered.filter(
        (i) => i.status === "PENDING" || i.status === "IN_PROGRESS"
      );
    }

    // category & status filters + search
    const s = search.trim().toLowerCase();
    const cat = filterCategory.trim().toLowerCase();
    const stat = filterStatus.trim().toLowerCase();

    filtered = filtered.filter((i) => {
      const text =
        `${i.item_code} ${i.equipment_name} ${i.category} ${i.assigned_to} ${i.inspector_name} ${i.status} ${i.findings}`.toLowerCase();
      const catMatch = !cat || (i.category || "").toLowerCase().includes(cat);
      const statMatch = !stat || (i.status || "").toLowerCase().includes(stat);
      const searchMatch = !s || text.includes(s);
      return catMatch && statMatch && searchMatch;
    });

    return filtered;
  }

  const filteredInspections = applyFilters(inspections);
  const totalPages = Math.max(
    1,
    Math.ceil(filteredInspections.length / rowsPerPage)
  );
  const pageStart = (currentPage - 1) * rowsPerPage;
  const paginated = filteredInspections.slice(
    pageStart,
    pageStart + rowsPerPage
  );

  const renderPaginationButtons = () => {
    const pageCount = Math.max(
      1,
      Math.ceil(filteredInspections.length / rowsPerPage)
    );
    const hasNoData = filteredInspections.length === 0;

    const buttons = [];

    // Previous button
    buttons.push(
      <button
        key="prev"
        className={`${styles.inspectionPaginationBtn} ${
          hasNoData ? styles.inspectionDisabled : ""
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
        className={`${styles.inspectionPaginationBtn} ${
          1 === currentPage ? styles.inspectionActive : ""
        } ${hasNoData ? styles.inspectionDisabled : ""}`}
        onClick={() => setCurrentPage(1)}
        disabled={hasNoData}
      >
        1
      </button>
    );

    // Show ellipsis after first page if needed
    if (currentPage > 3) {
      buttons.push(
        <span key="ellipsis1" className={styles.inspectionPaginationEllipsis}>
          ...
        </span>
      );
    }

    // Show pages around current page (max 5 pages total including first and last)
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
            className={`${styles.inspectionPaginationBtn} ${
              i === currentPage ? styles.inspectionActive : ""
            } ${hasNoData ? styles.inspectionDisabled : ""}`}
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
        <span key="ellipsis2" className={styles.inspectionPaginationEllipsis}>
          ...
        </span>
      );
    }

    // Always show last page if there is more than 1 page
    if (pageCount > 1) {
      buttons.push(
        <button
          key={pageCount}
          className={`${styles.inspectionPaginationBtn} ${
            pageCount === currentPage ? styles.inspectionActive : ""
          } ${hasNoData ? styles.inspectionDisabled : ""}`}
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
        className={`${styles.inspectionPaginationBtn} ${
          hasNoData ? styles.inspectionDisabled : ""
        }`}
        disabled={currentPage === pageCount || hasNoData}
        onClick={() => setCurrentPage(Math.min(pageCount, currentPage + 1))}
      >
        Next
      </button>
    );

    return buttons;
  };

  // Open View Details Modal
  const openViewModal = (inspection) => {
    setSelectedInspection(inspection);
    setIsViewModalOpen(true);
  };

  // Close View Details Modal
  const closeViewModal = () => {
    setIsViewModalOpen(false);
    setSelectedInspection(null);
  };

  // Format findings text for display
  const formatFindings = (findings) => {
    if (!findings || findings.trim() === "") {
      return "No findings recorded";
    }
    return findings;
  };

  function confirmDelete(id) {
    setDeleteId(id);
    setIsDeleteOpen(true);
  }

  function cancelDelete() {
    setDeleteId(null);
    setIsDeleteOpen(false);
  }

  async function performDelete() {
    if (!deleteId) return;
    try {
      const { error } = await supabase
        .from("inspections")
        .delete()
        .eq("id", deleteId);

      if (error) throw error;

      await loadInspections();
      cancelDelete();
    } catch (err) {
      console.error("delete error", err);
      alert(`Failed to delete inspection: ${err.message}`);
    }
  }

  function handleCardClick(filter) {
    if (currentFilterCard === filter) {
      setCurrentFilterCard("total");
    } else {
      setCurrentFilterCard(filter);
    }
    setCurrentPage(1);
  }

  const formatDate = (dateString) => {
    if (!dateString || dateString.trim() === "") return "Not set";

    let date;
    if (dateString.includes("-")) {
      date = new Date(dateString);
    } else {
      date = new Date(dateString);
    }

    if (isNaN(date.getTime())) {
      console.warn("Invalid date:", dateString);
      return dateString;
    }

    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatDateTime = (dateString) => {
    if (!dateString || dateString.trim() === "") return "Not set";

    let date;
    if (dateString.includes("-")) {
      date = new Date(dateString);
    } else {
      date = new Date(dateString);
    }

    if (isNaN(date.getTime())) {
      console.warn("Invalid date:", dateString);
      return dateString;
    }

    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const stopScanner = () => {
    if (qrScannerRef.current?.html5QrcodeScanner) {
      try {
        qrScannerRef.current.html5QrcodeScanner.clear().catch((error) => {
          console.error("Failed to clear scanner:", error);
        });
        qrScannerRef.current.html5QrcodeScanner = null;
      } catch (error) {
        console.error("Error stopping scanner:", error);
      }
    }
    setShowScanner(false);
  };

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  return (
    <div className={styles.inspectionAppContainer}>
      <Title>Inspection Control | BFP Villanueva</Title>
      <Meta name="robots" content="noindex, nofollow" />
      <InspectorSidebar />
      <Hamburger />

      <div className={`main-content ${isSidebarCollapsed ? "collapsed" : ""}`}>
        <h1>Inspection Control</h1>

        {/* Removed Add Inspection Button */}

        <div className={styles.inspectionTopControls}>
          <div className={styles.inspectionTableHeader}>
            <select
              className={styles.inspectionFilterCategory}
              value={filterCategory}
              onChange={(e) => {
                setFilterCategory(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All Categories</option>
              {Array.from(new Set(inventory.map((item) => item.category))).map(
                (category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                )
              )}
            </select>

            <select
              className={styles.inspectionFilterStatus}
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All Status</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <input
              type="text"
              className={styles.inspectionSearchBar}
              placeholder="🔍 Search inspections..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>

        <div
          id={styles.inspectionSummary}
          style={{ display: "flex", gap: 20, margin: 20 }}
        >
          <button
            className={`${styles.inspectionSummaryCard} ${
              styles.inspectionTotal
            } ${currentFilterCard === "total" ? styles.inspectionActive : ""}`}
            onClick={() => handleCardClick("total")}
          >
            <h3>Total Inspections</h3>
            <p id={styles.inspectionTotalItems}>{totalInspections}</p>
          </button>
          <button
            className={`${styles.inspectionSummaryCard} ${
              styles.inspectionPassed
            } ${currentFilterCard === "passed" ? styles.inspectionActive : ""}`}
            onClick={() => handleCardClick("passed")}
          >
            <h3>Passed (Completed)</h3>
            <p id={styles.inspectionPassedItems}>{passedInspections}</p>
          </button>
          <button
            className={`${styles.inspectionSummaryCard} ${
              styles.inspectionFailed
            } ${currentFilterCard === "failed" ? styles.inspectionActive : ""}`}
            onClick={() => handleCardClick("failed")}
          >
            <h3>Failed</h3>
            <p id={styles.inspectionFailedItems}>{failedInspections}</p>
          </button>
          <button
            className={`${styles.inspectionSummaryCard} ${
              styles.inspectionNeedsAttention
            } ${
              currentFilterCard === "needsAttention"
                ? styles.inspectionActive
                : ""
            }`}
            onClick={() => handleCardClick("needsAttention")}
          >
            <h3>Needs Attention</h3>
            <p id={styles.inspectionNeedsAttentionItems}>
              {needsAttentionInspections}
            </p>
          </button>
        </div>

        {/* Table Header Section - Matching InspectorEquipmentInspection */}
        <div className={styles.inspectionTableHeaderSection}>
          <h2 className={styles.sheaders}>Inspection Records</h2>
        </div>
        <div
          className={`${styles.inspectionPaginationContainer} ${styles.inspectionTopPagination}`}
        >
          {renderPaginationButtons()}
        </div>

        {/* Scrollable Table Container - Matching InspectorEquipmentInspection */}
        <div className={styles.inspectionTableScrollContainer}>
          {/* Top Pagination */}

          {/* Table */}
          <table className={styles.inspectionTable}>
            <thead>
              <tr>
                <th>Item Code</th>
                <th>Equipment Name</th>
                <th>Category</th>
                <th>Equipment Status</th>
                <th>Assigned To</th>
                <th>Assigned Date</th>
                <th>Inspector Name</th>
                <th>Scheduled Date</th>
                <th>Inspection Result</th>
                <th>Findings</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id={styles.inspectionTableBody}>
              {paginated.length === 0 ? (
                <tr>
                  <td
                    colSpan="11"
                    style={{ textAlign: "center", padding: "40px" }}
                  >
                    <div style={{ fontSize: "48px", marginBottom: "16px" }}>
                      <span className={styles.animatedEmoji}>🔍</span>
                    </div>
                    <h3
                      style={{
                        fontSize: "18px",
                        fontWeight: "600",
                        color: "#2b2b2b",
                        marginBottom: "8px",
                      }}
                    >
                      No Inspections Found
                    </h3>
                    <p style={{ fontSize: "14px", color: "#999" }}>
                      No inspection records available
                    </p>
                  </td>
                </tr>
              ) : (
                paginated.map((inspection) => (
                  <tr key={inspection.id}>
                    <td>{inspection.item_code}</td>
                    <td>{inspection.equipment_name}</td>
                    <td>{inspection.category}</td>
                    <td>
                      <span
                        className={`${styles.equipmentStatusBadge} ${
                          styles[
                            getEquipmentStatusClass(inspection.equipment_status)
                          ]
                        }`}
                      >
                        {inspection.equipment_status}
                      </span>
                    </td>
                    <td>{inspection.assigned_to}</td>
                    <td>{formatDate(inspection.assigned_date)}</td>
                    <td>{inspection.inspector_name}</td>
                    <td>{formatDate(inspection.schedule_inspection_date)}</td>
                    <td>
                      <span
                        className={`${styles.inspectionStatusBadge} ${
                          styles[getStatusClass(inspection.status)]
                        }`}
                      >
                        {getStatusDisplay(inspection.status)}
                      </span>
                    </td>
                    <td>
                      {inspection.findings ? (
                        <button
                          className={styles.viewDetailsBtn}
                          onClick={() => openViewModal(inspection)}
                        >
                          View Details
                        </button>
                      ) : (
                        "No findings"
                      )}
                    </td>
                    <td>
                      <button
                        className={styles.inspectionDeleteBtn}
                        onClick={() => confirmDelete(inspection.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Bottom Pagination */}
        </div>
        <div
          className={`${styles.inspectionPaginationContainer} ${styles.inspectionBottomPagination}`}
        >
          {renderPaginationButtons()}
        </div>
        {/* View Details Modal */}
        {isViewModalOpen && selectedInspection && (
          <div
            className={styles.inspectionViewModalOverlay}
            style={{ display: "flex" }}
            onClick={closeViewModal}
          >
            <div
              className={styles.inspectionViewModalContent}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.inspectionViewModalHeader}>
                <h3 className={styles.inspectionViewModalTitle}>
                  Inspection Details
                </h3>
                <button
                  className={styles.inspectionViewModalCloseBtn}
                  onClick={closeViewModal}
                >
                  &times;
                </button>
              </div>

              <div className={styles.inspectionViewModalBody}>
                {/* Equipment Information Section */}
                <div className={styles.viewModalSection}>
                  <h4 className={styles.viewModalSectionTitle}>
                    Equipment Information
                  </h4>
                  <div className={styles.viewModalGrid}>
                    <div className={styles.viewModalField}>
                      <label>Item Code:</label>
                      <span>{selectedInspection.item_code}</span>
                    </div>
                    <div className={styles.viewModalField}>
                      <label>Equipment Name:</label>
                      <span>{selectedInspection.equipment_name}</span>
                    </div>
                    <div className={styles.viewModalField}>
                      <label>Category:</label>
                      <span>{selectedInspection.category}</span>
                    </div>
                    <div className={styles.viewModalField}>
                      <label>Equipment Status:</label>
                      <span
                        className={`${styles.equipmentStatusBadge} ${
                          styles[
                            getEquipmentStatusClass(
                              selectedInspection.equipment_status
                            )
                          ]
                        }`}
                      >
                        {selectedInspection.equipment_status}
                      </span>
                    </div>
                    <div className={styles.viewModalField}>
                      <label>Purchase Date:</label>
                      <span>
                        {formatDate(selectedInspection.purchase_date)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Assignment Information Section */}
                <div className={styles.viewModalSection}>
                  <h4 className={styles.viewModalSectionTitle}>
                    Assignment Information
                  </h4>
                  <div className={styles.viewModalGrid}>
                    <div className={styles.viewModalField}>
                      <label>Assigned To:</label>
                      <span>{selectedInspection.assigned_to}</span>
                    </div>
                    <div className={styles.viewModalField}>
                      <label>Assigned Date:</label>
                      <span>
                        {formatDate(selectedInspection.assigned_date)}
                      </span>
                    </div>
                    <div className={styles.viewModalField}>
                      <label>Last Checked:</label>
                      <span>{formatDate(selectedInspection.last_checked)}</span>
                    </div>
                    <div className={styles.viewModalField}>
                      <label>Next Maintenance:</label>
                      <span>
                        {formatDate(selectedInspection.next_maintenance_date)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Inspection Details Section */}
                <div className={styles.viewModalSection}>
                  <h4 className={styles.viewModalSectionTitle}>
                    Inspection Details
                  </h4>
                  <div className={styles.viewModalGrid}>
                    <div className={styles.viewModalField}>
                      <label>Inspector:</label>
                      <span>{selectedInspection.inspector_name}</span>
                    </div>
                    <div className={styles.viewModalField}>
                      <label>Inspector Badge:</label>
                      <span>{selectedInspection.inspector_badge}</span>
                    </div>
                    <div className={styles.viewModalField}>
                      <label>Inspector Rank:</label>
                      <span>{selectedInspection.inspector_rank}</span>
                    </div>
                    <div className={styles.viewModalField}>
                      <label>Scheduled Date:</label>
                      <span>
                        {formatDate(
                          selectedInspection.schedule_inspection_date
                        )}
                      </span>
                    </div>
                    <div className={styles.viewModalField}>
                      <label>Reschedule Date:</label>
                      <span>
                        {formatDate(
                          selectedInspection.reschedule_inspection_date
                        )}
                      </span>
                    </div>
                    <div className={styles.viewModalField}>
                      <label>Inspection Status:</label>
                      <span
                        className={`${styles.inspectionStatusBadge} ${
                          styles[getStatusClass(selectedInspection.status)]
                        }`}
                      >
                        {getStatusDisplay(selectedInspection.status)}
                      </span>
                    </div>
                    <div className={styles.viewModalField}>
                      <label>Schedule Status:</label>
                      <span>{selectedInspection.schedule_status}</span>
                    </div>
                  </div>
                </div>

                {/* Findings & Notes Section */}
                <div className={styles.viewModalSection}>
                  <h4 className={styles.viewModalSectionTitle}>
                    Findings & Notes
                  </h4>
                  <div className={styles.viewModalFullWidth}>
                    <div className={styles.viewModalField}>
                      <label>Findings:</label>
                      <div className={styles.viewModalTextContent}>
                        {formatFindings(selectedInspection.findings)}
                      </div>
                    </div>
                    <div className={styles.viewModalField}>
                      <label>Recommendations:</label>
                      <div className={styles.viewModalTextContent}>
                        {selectedInspection.recommendations ||
                          "No recommendations"}
                      </div>
                    </div>
                    <div className={styles.viewModalField}>
                      <label>Additional Notes:</label>
                      <div className={styles.viewModalTextContent}>
                        {selectedInspection.notes || "No additional notes"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* System Information Section */}
                <div className={styles.viewModalSection}>
                  <h4 className={styles.viewModalSectionTitle}>
                    System Information
                  </h4>
                  <div className={styles.viewModalGrid}>
                    <div className={styles.viewModalField}>
                      <label>Record Created:</label>
                      <span>
                        {formatDateTime(selectedInspection.created_at)}
                      </span>
                    </div>
                    <div className={styles.viewModalField}>
                      <label>Last Updated:</label>
                      <span>
                        {formatDateTime(selectedInspection.updated_at)}
                      </span>
                    </div>
                    <div className={styles.viewModalField}>
                      <label>Clearance Request ID:</label>
                      <span>
                        {selectedInspection.clearance_request_id || "N/A"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Modal */}
        {isDeleteOpen && (
          <div
            className={styles.inspectionModalDeleteOverlay}
            style={{ display: "flex" }}
          >
            <div
              className={styles.inspectionModalDeleteContent}
              style={{ maxWidth: "450px" }}
            >
              <div className={styles.inspectionModalDeleteHeader}>
                <h2 style={{ marginLeft: "30px" }}>Confirm Deletion</h2>
                <span
                  className={styles.inspectionModalDeleteCloseBtn}
                  onClick={cancelDelete}
                >
                  &times;
                </span>
              </div>

              <div className={styles.inspectionModalDeleteBody}>
                <div className={styles.inspectionDeleteConfirmationContent}>
                  <div className={styles.inspectionDeleteWarningIcon}>⚠️</div>
                  <p className={styles.inspectionDeleteConfirmationText}>
                    Are you sure you want to delete the inspection record for
                  </p>
                  <p className={styles.inspectionDocumentNameHighlight}>
                    "
                    {inspections.find((item) => item.id === deleteId)
                      ?.equipment_name || "this equipment"}
                    "?
                  </p>
                  <p className={styles.inspectionDeleteWarning}>
                    This action cannot be undone.
                  </p>
                </div>
              </div>

              <div className={styles.inspectionModalDeleteActions}>
                <button
                  className={`${styles.inspectionModalDeleteBtn} ${styles.inspectionModalCancelBtn}`}
                  onClick={cancelDelete}
                >
                  Cancel
                </button>
                <button
                  className={`${styles.inspectionModalDeleteBtn} ${styles.inspectionDeleteConfirmBtn}`}
                  onClick={performDelete}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
