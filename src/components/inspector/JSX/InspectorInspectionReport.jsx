// Inspection.jsx (Updated Version)
import React, { useState, useEffect } from "react";
import styles from "../styles/InspectorInspectionReport.module.css";
import { Title, Meta } from "react-head";
import InspectorSidebar from "../../InspectorSidebar";
import Hamburger from "../../Hamburger";
import { useSidebar } from "../../SidebarContext";
import { supabase } from "../../../lib/supabaseClient.js";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const InspectorInspectionReport = () => {
  const { isSidebarCollapsed } = useSidebar();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showMissingModal, setShowMissingModal] = useState(false);
  const [selectedPersonnel, setSelectedPersonnel] = useState(null);
  const [missingEquipmentList, setMissingEquipmentList] = useState({});
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [error, setError] = useState(null);

  const [showApproveModal, setShowApproveModal] = useState(false);
  const [selectedReportToApprove, setSelectedReportToApprove] = useState(null);
  const [approveModalDetails, setApproveModalDetails] = useState({
    title: "",
    message: "",
    routineAmount: 0,
    clearanceAmount: 0,
    totalAmount: 0,
    itemCount: 0,
  });

  // Filter states
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterClearanceType, setFilterClearanceType] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 5;

  // Card filter state
  const [currentFilterCard, setCurrentFilterCard] = useState("total");

  // Tab state
  const [activeTab, setActiveTab] = useState("unsettled"); // "unsettled" or "settled"

  // Load data based on active tab
  useEffect(() => {
    loadAccountabilityData();
  }, [activeTab]);

  // Helper function to get current user
  const getCurrentUser = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, first_name, last_name, role")
          .eq("id", user.id)
          .single();

        return {
          id: user.id,
          name:
            profile?.full_name ||
            `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim() ||
            user.email,
          email: user.email,
          role: profile?.role,
        };
      }
      return {
        id: null,
        name: "System",
        email: "system@bfp.gov.ph",
        role: "system",
      };
    } catch (error) {
      console.error("Error getting current user:", error);
      return {
        id: null,
        name: "System",
        email: "system@bfp.gov.ph",
        role: "system",
      };
    }
  };

  const loadAccountabilityData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Build the query based on active tab
      let query = supabase
        .from("accountability_records")
        .select(
          `
        id,
        personnel_id,
        inventory_id,
        inspection_id,
        record_type,
        record_date,
        amount_due,
        remarks,
        is_settled,
        source_type,
        clearance_request_id,
        settlement_date,
        settlement_method,
        created_at,
        updated_at,
        personnel:personnel_id (
          first_name,
          last_name,
          middle_name,
          suffix,
          rank,
          rank_image,
          badge_number
        ),
        inventory:inventory_id (
          id,
          item_name,
          item_code,
          category,
          status,
          current_value,
          price
        ),
        inspection:inspection_id (
          id,
          inspector_name,
          schedule_inspection_date,
          status
        ),
        clearance_requests!left (
          id,
          type,
          status,
          created_at
        )
      `
        )
        .in("record_type", ["LOST", "DAMAGED"])
        .order("record_date", { ascending: false });

      // Filter based on active tab
      if (activeTab === "unsettled") {
        query = query.eq("is_settled", false);
      } else if (activeTab === "settled") {
        query = query.eq("is_settled", true);
      }

      const { data: combinedData, error: combinedError } = await query;

      if (combinedError) throw combinedError;

      // Create a map to track unique equipment items per personnel
      const uniqueEquipmentMap = {};

      // First pass: Identify duplicates and keep only one record per equipment
      const deduplicatedRecords = [];

      (combinedData || []).forEach((item) => {
        const key = `${item.personnel_id}-${item.inventory_id}`;

        if (!uniqueEquipmentMap[key]) {
          uniqueEquipmentMap[key] = {
            count: 1,
            records: [item],
            selectedRecord: item,
          };
          deduplicatedRecords.push(item);
        } else {
          uniqueEquipmentMap[key].count++;
          uniqueEquipmentMap[key].records.push(item);

          const existingRecordDate = new Date(
            uniqueEquipmentMap[key].selectedRecord.record_date || 0
          );
          const newRecordDate = new Date(item.record_date || 0);

          if (
            item.source_type === "clearance-linked" &&
            uniqueEquipmentMap[key].selectedRecord.source_type === "routine"
          ) {
            uniqueEquipmentMap[key].selectedRecord = item;
            const index = deduplicatedRecords.findIndex(
              (r) => r.id === uniqueEquipmentMap[key].selectedRecord.id
            );
            if (index > -1) {
              deduplicatedRecords[index] = item;
            }
          } else if (newRecordDate > existingRecordDate) {
            uniqueEquipmentMap[key].selectedRecord = item;
            const index = deduplicatedRecords.findIndex(
              (r) => r.id === uniqueEquipmentMap[key].selectedRecord.id
            );
            if (index > -1) {
              deduplicatedRecords[index] = item;
            }
          }
        }
      });

      // Group equipment by personnel
      const personnelMap = {};

      deduplicatedRecords.forEach((item) => {
        const personnelId = item.personnel_id;

        if (!personnelMap[personnelId]) {
          // Build full name
          const firstName = item.personnel?.first_name || "";
          const middleName = item.personnel?.middle_name || "";
          const lastName = item.personnel?.last_name || "";
          const suffix = item.personnel?.suffix || "";

          let fullName = `${firstName} ${middleName} ${lastName}`.trim();
          if (suffix) {
            fullName = `${fullName} ${suffix}`;
          }

          // Format: LastName, FirstName MiddleInitial.
          let formattedName = `${lastName}, ${firstName}`;
          if (middleName) {
            formattedName = `${formattedName} ${middleName.charAt(0)}.`;
          }
          if (suffix) {
            formattedName = `${formattedName} ${suffix}`;
          }

          personnelMap[personnelId] = {
            personnel_id: personnelId,
            personnel_name: fullName,
            formatted_name: formattedName,
            rank: item.personnel?.rank || "N/A",
            rank_image: item.personnel?.rank_image || null,
            badge_number: item.personnel?.badge_number || "N/A",
            clearance_types: new Set(),
            clearance_request_ids: new Set(),
            clearance_statuses: new Set(),
            clearance_request_dates: new Set(),
            accountability_status: item.is_settled ? "SETTLED" : "UNSETTLED",
            total_equipment_count: 0,
            lost_equipment_count: 0,
            damaged_equipment_count: 0,
            total_equipment_value: 0,
            lost_equipment_value: 0,
            damaged_equipment_value: 0,
            total_outstanding_amount: 0,
            last_inspection_date: item.record_date,
            last_inspector_name: item.inspection?.inspector_name,
            last_inspection_findings: item.remarks,
            missingEquipment: [],
            routine_equipment_count: 0,
            clearance_equipment_count: 0,
            is_settled: item.is_settled,
            settlement_date: item.settlement_date,
            settlement_method: item.settlement_method,
            settlement_remarks: item.settlement_remarks,
          };
        }

        // Add clearance type if it exists
        if (item.clearance_requests?.type) {
          personnelMap[personnelId].clearance_types.add(
            item.clearance_requests.type
          );
          personnelMap[personnelId].clearance_request_ids.add(
            item.clearance_request_id
          );
          personnelMap[personnelId].clearance_statuses.add(
            item.clearance_requests.status
          );
          if (item.clearance_requests.created_at) {
            personnelMap[personnelId].clearance_request_dates.add(
              item.clearance_requests.created_at
            );
          }
        }

        // Add equipment to the personnel's list
        const equipmentValue =
          item.amount_due || item.inventory?.current_value || 0;
        const isLost = item.record_type === "LOST";
        const isDamaged = item.record_type === "DAMAGED";

        personnelMap[personnelId].total_equipment_count++;
        personnelMap[personnelId].total_equipment_value += equipmentValue;

        // Track routine vs clearance equipment
        if (item.source_type === "routine") {
          personnelMap[personnelId].routine_equipment_count++;
        } else if (item.source_type === "clearance-linked") {
          personnelMap[personnelId].clearance_equipment_count++;
        }

        if (isLost) {
          personnelMap[personnelId].lost_equipment_count++;
          personnelMap[personnelId].lost_equipment_value += equipmentValue;
          if (!item.is_settled) {
            personnelMap[personnelId].total_outstanding_amount +=
              equipmentValue;
          }
        } else if (isDamaged) {
          personnelMap[personnelId].damaged_equipment_count++;
          personnelMap[personnelId].damaged_equipment_value +=
            equipmentValue * 0.5;
          if (!item.is_settled) {
            personnelMap[personnelId].total_outstanding_amount +=
              equipmentValue * 0.5;
          }
        }

        personnelMap[personnelId].missingEquipment.push({
          source: item.source_type || "routine",
          accountability_id: item.id,
          inventory_id: item.inventory?.id,
          name: item.inventory?.item_name,
          item_code: item.inventory?.item_code,
          category: item.inventory?.category,
          status: item.record_type,
          price: equipmentValue,
          last_inspection_date: item.record_date,
          inspection_findings: item.remarks,
          inspector_name: item.inspection?.inspector_name,
          is_settled: item.is_settled,
          source_type: item.source_type,
          clearance_request_id: item.clearance_request_id,
          clearance_type: item.clearance_requests?.type,
          clearance_status: item.clearance_requests?.status,
          settlement_date: item.settlement_date,
          settlement_method: item.settlement_method,
        });

        // Update latest inspection info
        if (item.record_date) {
          const currentDate = new Date(
            personnelMap[personnelId].last_inspection_date || 0
          );
          const newDate = new Date(item.record_date);
          if (newDate > currentDate) {
            personnelMap[personnelId].last_inspection_date = item.record_date;
            personnelMap[personnelId].last_inspector_name =
              item.inspection?.inspector_name;
            personnelMap[personnelId].last_inspection_findings = item.remarks;
          }
        }
      });

      // Convert to array format
      const accountabilityReports = Object.values(personnelMap).map(
        (item, index) => {
          const clearanceTypesArray = Array.from(item.clearance_types);
          const clearanceRequestIdsArray = Array.from(
            item.clearance_request_ids
          );
          const clearanceStatusesArray = Array.from(item.clearance_statuses);
          const clearanceRequestDatesArray = Array.from(
            item.clearance_request_dates
          );

          const routineEquipment = item.missingEquipment.filter(
            (eq) => eq.source_type === "routine"
          );
          const clearanceEquipment = item.missingEquipment.filter(
            (eq) => eq.source_type === "clearance-linked"
          );

          const routineAmount = routineEquipment.reduce(
            (sum, eq) => sum + (eq.price || 0),
            0
          );
          const clearanceAmount = clearanceEquipment.reduce(
            (sum, eq) => sum + (eq.price || 0),
            0
          );

          // Determine clearance type display
          let clearanceTypeDisplay = "Routine Inspection Only";
          if (clearanceTypesArray.length === 1) {
            clearanceTypeDisplay = clearanceTypesArray[0];
          } else if (clearanceTypesArray.length > 1) {
            clearanceTypeDisplay = `Multiple: ${clearanceTypesArray.join(
              ", "
            )}`;
          }

          // Determine clearance status
          let overallClearanceStatus = "No Clearance";
          if (clearanceStatusesArray.length > 0) {
            if (clearanceStatusesArray.includes("In Progress")) {
              overallClearanceStatus = "In Progress";
            } else if (
              clearanceStatusesArray.includes("Pending for Approval")
            ) {
              overallClearanceStatus = "Pending for Approval";
            } else {
              overallClearanceStatus = clearanceStatusesArray[0];
            }
          }

          // Get earliest request date
          const earliestRequestDate =
            clearanceRequestDatesArray.length > 0
              ? clearanceRequestDatesArray.sort()[0]
              : null;

          return {
            id: `personnel-${item.personnel_id}-${index + 1}`,
            personnel_id: item.personnel_id,
            rank: item.rank,
            rank_image: item.rank_image,
            personnelName: item.personnel_name,
            formattedName: item.formatted_name || item.personnel_name,
            badge_number: item.badge_number,
            clearanceType: clearanceTypeDisplay,
            clearanceTypes: clearanceTypesArray,
            clearanceTypeCount: clearanceTypesArray.length,
            clearanceRequestIds: clearanceRequestIdsArray,
            clearanceRequestCount: clearanceRequestIdsArray.length,
            clearanceStatus: overallClearanceStatus,
            requestDate: earliestRequestDate || item.last_inspection_date,
            totalEquipment: item.total_equipment_count,
            lostEquipment: item.lost_equipment_count,
            damagedEquipment: item.damaged_equipment_count,
            totalValue: item.total_equipment_value,
            lostValue: item.lost_equipment_value,
            damagedValue: item.damaged_equipment_value,
            totalMissingAmount: item.total_outstanding_amount,
            findings: item.last_inspection_findings || "No findings recorded",
            lastInspectionDate: item.last_inspection_date,
            lastInspector: item.last_inspector_name,
            status: item.is_settled ? "Settled" : "Unsettled",
            missingEquipment: item.missingEquipment,
            hasCombinedAccountability:
              routineEquipment.length > 0 && clearanceEquipment.length > 0,
            hasMultipleClearances: clearanceRequestIdsArray.length > 1,
            routineEquipmentCount: item.routine_equipment_count,
            clearanceEquipmentCount: item.clearance_equipment_count,
            routineAmount: routineAmount,
            clearanceAmount: clearanceAmount,
            is_settled: item.is_settled,
            settlement_date: item.settlement_date,
            settlement_method: item.settlement_method,
            settlement_remarks: item.settlement_remarks,
          };
        }
      );

      setReports(accountabilityReports);
    } catch (error) {
      console.error("Error loading accountability data:", error);
      setError("Failed to load accountability data: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const approveSettlement = async (report) => {
    // Filter out already returned equipment and get unique inventory items
    const unsettledEquipment = report.missingEquipment.filter(
      (eq) => !eq.is_settled
    );

    if (unsettledEquipment.length === 0) {
      toast.info("All equipment has already been settled or returned.");
      return;
    }

    const hasRoutine = unsettledEquipment.some(
      (eq) => eq.source_type === "routine"
    );
    const hasClearance = unsettledEquipment.some(
      (eq) => eq.source_type === "clearance-linked"
    );

    const routineAmount = unsettledEquipment
      .filter((eq) => eq.source_type === "routine")
      .reduce((sum, eq) => sum + (eq.price || 0), 0);

    const clearanceAmount = unsettledEquipment
      .filter((eq) => eq.source_type === "clearance-linked")
      .reduce((sum, eq) => sum + (eq.price || 0), 0);

    const totalAmount = routineAmount + clearanceAmount;

    // Set up modal details
    const modalTitle = report.hasCombinedAccountability
      ? `⚡ Settle Combined Accountability`
      : `✅ Approve Settlement`;

    const modalMessage = report.hasCombinedAccountability
      ? `You are about to settle accountability for <strong>${
          report.personnelName
        }</strong>.<br/><br/>
         This includes:
         <div class="modal-breakdown">
           <div>🔵 <strong>Routine Inspection:</strong> ₱${formatCurrency(
             routineAmount
           )}</div>
           <div>🟣 <strong>Clearance Request:</strong> ₱${formatCurrency(
             clearanceAmount
           )}</div>
         </div>
         <br/>
         <div class="modal-total">
           ⚡ <strong>Total Amount:</strong> ₱${formatCurrency(totalAmount)}
         </div>`
      : `You are about to approve settlement for <strong>${
          report.personnelName
        }</strong>.<br/><br/>
         This will settle <strong>${
           unsettledEquipment.length
         }</strong> item(s) for a total of <strong>₱${formatCurrency(
          totalAmount
        )}</strong>.<br/><br/>
         🏷️ <strong>Clearance Type:</strong> ${report.clearanceType}`;

    // Store the report and show modal
    setSelectedReportToApprove(report);
    setApproveModalDetails({
      title: modalTitle,
      message: modalMessage,
      routineAmount: routineAmount,
      clearanceAmount: clearanceAmount,
      totalAmount: totalAmount,
      itemCount: unsettledEquipment.length,
      hasCombinedAccountability: report.hasCombinedAccountability,
    });
    setShowApproveModal(true);
  };

  const handleConfirmApproval = async () => {
    if (!selectedReportToApprove) return;

    try {
      // Get current user info
      const currentUser = await getCurrentUser();

      // Check if there are lost items that cannot be returned
      const hasLostItems = selectedReportToApprove.missingEquipment.some(
        (eq) => eq.status === "LOST" && !eq.is_settled
      );

      const settlementMethod = "Cash Payment";

      // Update accountability records
      const unsettledEquipment =
        selectedReportToApprove.missingEquipment.filter((eq) => !eq.is_settled);

      const inventoryIds = unsettledEquipment
        .map((eq) => eq.inventory_id)
        .filter(Boolean);

      if (inventoryIds.length > 0) {
        const { data: allAccountabilityRecords, error: fetchError } =
          await supabase
            .from("accountability_records")
            .select("*")
            .eq("personnel_id", selectedReportToApprove.personnel_id)
            .in("inventory_id", inventoryIds)
            .eq("is_settled", false);

        if (!fetchError && allAccountabilityRecords?.length > 0) {
          const accountabilityIds = allAccountabilityRecords.map((r) => r.id);
          await supabase
            .from("accountability_records")
            .update({
              is_settled: true,
              settlement_date: new Date().toISOString().split("T")[0],
              settlement_method: settlementMethod,
              settlement_remarks: `Settled by ${currentUser.name}`,
              updated_at: new Date().toISOString(),
            })
            .in("id", accountabilityIds);
        }
      }

      // Update personnel_equipment_accountability_table if needed
      // (This table should already exist with the data)

      // Update clearance requests status
      if (selectedReportToApprove.clearanceRequestIds?.length > 0) {
        for (const requestId of selectedReportToApprove.clearanceRequestIds) {
          await supabase
            .from("clearance_requests")
            .update({
              status: hasLostItems ? "In Progress" : "Pending for Approval",
              updated_at: new Date().toISOString(),
            })
            .eq("id", requestId);
        }
      }

      // Update local state
      setReports((prevReports) =>
        prevReports.map((r) => {
          if (r.personnel_id === selectedReportToApprove.personnel_id) {
            return {
              ...r,
              status: "Settled",
              is_settled: true,
              settlement_date: new Date().toISOString().split("T")[0],
              settlement_method: settlementMethod,
              clearance_status: hasLostItems
                ? "In Progress"
                : "Pending for Approval",
              missingEquipment: r.missingEquipment.map((eq) => ({
                ...eq,
                is_settled: true,
                settlement_date: new Date().toISOString().split("T")[0],
                settlement_method: settlementMethod,
              })),
            };
          }
          return r;
        })
      );

      // Close modal
      setShowApproveModal(false);
      setSelectedReportToApprove(null);

      toast.success(
        `✅ Accountability settled! ${
          hasLostItems
            ? "Clearance remains in progress."
            : "Ready for clearance approval."
        }`
      );

      // Reload data
      loadAccountabilityData();
    } catch (error) {
      console.error("Error approving settlement:", error);
      toast.error(`❌ Failed to approve settlement: ${error.message}`);
    }
  };

  // Format date for display
  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch (e) {
      return "Invalid Date";
    }
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount || 0);
  };

  // Get status badge class
  const getStatusBadgeClass = (status) => {
    switch (status?.toLowerCase()) {
      case "unsettled":
        return styles.IIRStatusUnsettled;
      case "settled":
        return styles.IIRStatusSettled;
      case "pending":
        return styles.IIRStatusPending;
      case "in progress":
        return styles.IIRStatusInProgress;
      case "completed":
        return styles.IIRStatusCompleted;
      case "rejected":
        return styles.IIRStatusRejected;
      default:
        return styles.IIRStatusDefault;
    }
  };

  // Show missing equipment modal
  const showMissingEquipment = async (personnel) => {
    setSelectedPersonnel(personnel);
    setShowMissingModal(true);

    // Group equipment by source
    const equipmentBySource = {
      routine: personnel.missingEquipment.filter(
        (eq) => eq.source_type === "routine"
      ),
      clearance: personnel.missingEquipment.filter(
        (eq) => eq.source_type === "clearance-linked"
      ),
    };

    setMissingEquipmentList({
      routine: equipmentBySource.routine,
      clearance: equipmentBySource.clearance,
      all: personnel.missingEquipment,
    });
  };

  // Show details modal
  const showDetails = (report) => {
    setSelectedReport(report);
    setShowDetailsModal(true);
  };

  // Filter reports based on active tab
  const filteredReports = reports.filter((report) => {
    const matchesType =
      filterClearanceType === "All" ||
      report.clearanceType === filterClearanceType;
    const matchesSearch =
      searchQuery === "" ||
      report.personnelName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.rank.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (report.badge_number &&
        report.badge_number.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesType && matchesSearch;
  });

  // Filter by card selection
  const applyFilters = (items) => {
    let filtered = [...items];
    if (currentFilterCard === "unsettled") {
      filtered = filtered.filter((i) => i.status === "Unsettled");
    } else if (currentFilterCard === "settled") {
      filtered = filtered.filter((i) => i.status === "Settled");
    }
    return filtered;
  };

  const cardFilteredReports = applyFilters(filteredReports);

  // Only show personnel who failed inspection or have accountability
  const accountabilityReports = cardFilteredReports.filter(
    (report) => report.missingEquipment.length > 0
  );

  // Pagination
  const totalPages = Math.max(
    1,
    Math.ceil(accountabilityReports.length / rowsPerPage)
  );
  const pageStart = (currentPage - 1) * rowsPerPage;
  const paginated = accountabilityReports.slice(
    pageStart,
    pageStart + rowsPerPage
  );

  // Pagination buttons
  const renderPaginationButtons = () => {
    const pageCount = Math.max(
      1,
      Math.ceil(accountabilityReports.length / rowsPerPage)
    );
    const hasNoData = accountabilityReports.length === 0;

    const buttons = [];

    // Previous button
    buttons.push(
      <button
        key="prev"
        className={`${styles.IIRPaginationBtn} ${
          hasNoData ? styles.IIRDisabled : ""
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
        className={`${styles.IIRPaginationBtn} ${
          1 === currentPage ? styles.IIRActive : ""
        } ${hasNoData ? styles.IIRDisabled : ""}`}
        onClick={() => setCurrentPage(1)}
        disabled={hasNoData}
      >
        1
      </button>
    );

    // Show ellipsis after first page if needed
    if (currentPage > 3) {
      buttons.push(
        <span key="ellipsis1" className={styles.IIRPaginationEllipsis}>
          ...
        </span>
      );
    }

    // Show pages around current page
    let startPage = Math.max(2, currentPage - 1);
    let endPage = Math.min(pageCount - 1, currentPage + 1);

    if (currentPage <= 3) {
      endPage = Math.min(pageCount - 1, 4);
    }

    if (currentPage >= pageCount - 2) {
      startPage = Math.max(2, pageCount - 3);
    }

    // Generate middle page buttons
    for (let i = startPage; i <= endPage; i++) {
      if (i > 1 && i < pageCount) {
        buttons.push(
          <button
            key={i}
            className={`${styles.IIRPaginationBtn} ${
              i === currentPage ? styles.IIRActive : ""
            } ${hasNoData ? styles.IIRDisabled : ""}`}
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
        <span key="ellipsis2" className={styles.IIRPaginationEllipsis}>
          ...
        </span>
      );
    }

    // Always show last page if there is more than 1 page
    if (pageCount > 1) {
      buttons.push(
        <button
          key={pageCount}
          className={`${styles.IIRPaginationBtn} ${
            pageCount === currentPage ? styles.IIRActive : ""
          } ${hasNoData ? styles.IIRDisabled : ""}`}
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
        className={`${styles.IIRPaginationBtn} ${
          hasNoData ? styles.IIRDisabled : ""
        }`}
        disabled={currentPage === pageCount || hasNoData}
        onClick={() => setCurrentPage(Math.min(pageCount, currentPage + 1))}
      >
        Next
      </button>
    );

    return buttons;
  };

  // Card click handler
  const handleCardClick = (filter) => {
    if (currentFilterCard === filter) {
      setCurrentFilterCard("total");
    } else {
      setCurrentFilterCard(filter);
    }
    setCurrentPage(1);
  };

  // Calculate statistics
  const stats = {
    total: reports.length,
    unsettled: reports.filter((r) => r.status === "Unsettled").length,
    settled: reports.filter((r) => r.status === "Settled").length,
    totalMissingAmount: reports.reduce(
      (sum, report) => sum + (report.totalMissingAmount || 0),
      0
    ),
    totalMissingItems: reports.reduce((sum, report) => {
      const lost = report.lostEquipment || 0;
      const damaged = report.damagedEquipment || 0;
      return sum + lost + damaged;
    }, 0),
  };

  const handleEquipmentReturn = async (report, equipmentItem) => {
    // Get return details
    const returnDetails = prompt(
      `Enter return details for "${equipmentItem.name}" (${equipmentItem.item_code}):\n\n` +
        `1. Equipment Condition:\n` +
        `   - [Good] Found in good condition\n` +
        `   - [Under Repair] Needs repair\n` +
        `   - [Scrapped] Beyond repair\n\n` +
        `2. Return Location:\n` +
        `   - [Storage] Returned to storage\n` +
        `   - [Personnel] Returned to ${report.personnelName}\n` +
        `   - [Other] Specify location\n\n` +
        `Enter details:`,
      `${
        equipmentItem.status === "LOST" ? "Found in storage" : "Repaired"
      } - Returned to inventory`
    );

    if (!returnDetails) return;

    const condition = prompt(
      "Select equipment condition after return:",
      equipmentItem.status === "LOST" ? "Good" : "Under Repair"
    );

    if (!condition) return;

    const confirmMessage = `
  Confirm Equipment Return:
  
  Equipment: ${equipmentItem.name} (${equipmentItem.item_code})
  Condition: ${condition}
  Details: ${returnDetails}
  
  This will:
  1. Update inventory status to "${condition}"
  2. Clear accountability record
  3. Update clearance status to "Returned"
  
  Proceed?`;

    if (!window.confirm(confirmMessage)) return;

    try {
      // 1. UPDATE INVENTORY STATUS
      if (equipmentItem.inventory_id) {
        const inventoryUpdate = {
          status: condition,
          last_checked: new Date().toISOString().split("T")[0],
          updated_at: new Date().toISOString(),
        };

        if (equipmentItem.status === "LOST" && condition === "Good") {
          inventoryUpdate.current_location = "Storage";
          inventoryUpdate.assigned_to = "Unassigned";
          inventoryUpdate.assigned_personnel_id = null;
          inventoryUpdate.unassigned_date = new Date()
            .toISOString()
            .split("T")[0];
        }

        const { error: inventoryError } = await supabase
          .from("inventory")
          .update(inventoryUpdate)
          .eq("id", equipmentItem.inventory_id);

        if (inventoryError) {
          console.error("Error updating inventory:", inventoryError);
          throw new Error(
            `Failed to update inventory: ${inventoryError.message}`
          );
        }
      }

      // 2. UPDATE ACCOUNTABILITY RECORD
      const { error: accountabilityError } = await supabase
        .from("accountability_records")
        .update({
          is_settled: true,
          equipment_returned: true,
          return_date: new Date().toISOString().split("T")[0],
          return_remarks: returnDetails,
          settlement_date: new Date().toISOString().split("T")[0],
          settlement_method: "Equipment Returned",
          amount_paid: 0,
          updated_at: new Date().toISOString(),
          record_type:
            equipmentItem.status === "LOST" ? "RETURNED" : "REPAIRED",
        })
        .eq("id", equipmentItem.accountability_id);

      if (accountabilityError) throw accountabilityError;

      // 3. UPDATE CLEARANCE INVENTORY
      if (report.clearance_request_id && equipmentItem.inventory_id) {
        const { error: clearanceError } = await supabase
          .from("clearance_inventory")
          .update({
            status: "Returned",
            returned: true,
            return_date: new Date().toISOString().split("T")[0],
            remarks: `Equipment returned: ${returnDetails}. Condition: ${condition}`,
            updated_at: new Date().toISOString(),
          })
          .eq("clearance_request_id", report.clearance_request_id)
          .eq("inventory_id", equipmentItem.inventory_id);

        if (clearanceError) {
          console.warn("Warning updating clearance inventory:", clearanceError);
        }
      }

      // Update local state
      setReports((prevReports) =>
        prevReports.map((r) => {
          if (
            r.personnel_id === report.personnel_id &&
            r.clearance_request_id === report.clearance_request_id
          ) {
            const updatedEquipment = r.missingEquipment.map((eq) =>
              eq.accountability_id === equipmentItem.accountability_id
                ? {
                    ...eq,
                    is_settled: true,
                    status: "RETURNED",
                    return_remarks: returnDetails,
                    return_date: new Date().toISOString().split("T")[0],
                    settlement_method: "Equipment Returned",
                  }
                : eq
            );

            const allSettled = updatedEquipment.every((eq) => eq.is_settled);

            const newOutstandingAmount = updatedEquipment.reduce(
              (sum, eq) => (eq.is_settled ? sum : sum + (eq.price || 0)),
              0
            );

            return {
              ...r,
              status: allSettled ? "Settled" : "Unsettled",
              is_settled: allSettled,
              missingEquipment: updatedEquipment,
              totalMissingAmount: newOutstandingAmount,
              lostEquipment: updatedEquipment.filter(
                (eq) => eq.status === "LOST" && !eq.is_settled
              ).length,
              damagedEquipment: updatedEquipment.filter(
                (eq) => eq.status === "DAMAGED" && !eq.is_settled
              ).length,
            };
          }
          return r;
        })
      );

      if (showMissingModal && selectedPersonnel) {
        setMissingEquipmentList((prev) => ({
          ...prev,
          all: prev.all.map((eq) =>
            eq.accountability_id === equipmentItem.accountability_id
              ? { ...eq, is_settled: true, status: "RETURNED" }
              : eq
          ),
        }));
      }

      toast.success(
        `✅ Equipment "${equipmentItem.name}" returned successfully!`
      );

      setTimeout(() => {
        loadAccountabilityData();
      }, 1500);
    } catch (error) {
      console.error("❌ Error returning equipment:", error);
      toast.error(`Failed to return equipment: ${error.message}`);
    }
  };

  const handleReturnAllEquipment = async (report) => {
    const unsettledEquipment = report.missingEquipment.filter(
      (eq) => !eq.is_settled
    );

    if (unsettledEquipment.length === 0) {
      toast.info("All equipment has already been settled or returned.");
      return;
    }

    const returnReason = prompt(
      `Enter reason for returning all ${unsettledEquipment.length} equipment items:\n` +
        `Example: "All equipment located", "Mass repair completed"`,
      "All equipment returned"
    );

    if (!returnReason) return;

    const confirmMessage = `Mark ALL ${unsettledEquipment.length} equipment items as RETURNED? This will clear all accountability.`;

    if (!window.confirm(confirmMessage)) return;

    try {
      // Update all unsettled accountability records
      const accountabilityIds = unsettledEquipment.map(
        (eq) => eq.accountability_id
      );

      const { error: accountabilityError } = await supabase
        .from("accountability_records")
        .update({
          is_settled: true,
          equipment_returned: true,
          return_date: new Date().toISOString().split("T")[0],
          return_remarks: returnReason,
          settlement_date: new Date().toISOString().split("T")[0],
          settlement_method: "Equipment Returned",
          updated_at: new Date().toISOString(),
        })
        .in("id", accountabilityIds);

      if (accountabilityError) throw accountabilityError;

      // Update inventory status for all items
      for (const equipment of unsettledEquipment) {
        if (equipment.inventory_id) {
          await supabase
            .from("inventory")
            .update({
              status: equipment.status === "LOST" ? "Good" : "Under Repair",
              last_checked: new Date().toISOString().split("T")[0],
              updated_at: new Date().toISOString(),
            })
            .eq("id", equipment.inventory_id);
        }
      }

      // Update local state
      setReports((prevReports) =>
        prevReports.map((r) => {
          if (
            r.personnel_id === report.personnel_id &&
            r.clearance_request_id === report.clearance_request_id
          ) {
            return {
              ...r,
              status: "Settled",
              is_settled: true,
              missingEquipment: r.missingEquipment.map((eq) => ({
                ...eq,
                is_settled: true,
                status: eq.status === "RETURNED" ? eq.status : "RETURNED",
                settlement_method: "Equipment Returned",
                settlement_date: new Date().toISOString().split("T")[0],
              })),
              totalMissingAmount: 0,
            };
          }
          return r;
        })
      );

      toast.success(
        `All ${unsettledEquipment.length} equipment items marked as returned!`
      );
      loadAccountabilityData();
    } catch (error) {
      console.error("Error returning all equipment:", error);
      toast.error(`Failed to return equipment: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <div className={styles.IIRAppContainer}>
        <InspectorSidebar />
        <Hamburger />
        <div
          className={`main-content ${isSidebarCollapsed ? "collapsed" : ""}`}
        >
          <div className={styles.IIRLoadingContainer}>
            <h2>Loading Accountability Reports...</h2>
            <p>
              Please wait while we load personnel equipment accountability data.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.IIRAppContainer}>
      <Title>Personnel Equipment Accountability | BFP Villanueva</Title>
      <Meta name="robots" content="noindex, nofollow" />
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
      <InspectorSidebar />
      <Hamburger />
      <div className={`main-content ${isSidebarCollapsed ? "collapsed" : ""}`}>
        {/* Page Header with Tabs */}
        <div className={styles.pageHeader}>
          <h1>Personnel Equipment Accountability</h1>

          {/* Tab Navigation */}
          <div className={styles.tabNavigation}>
            <button
              className={`${styles.tabBtn} ${
                activeTab === "unsettled" ? styles.activeTab : ""
              }`}
              onClick={() => setActiveTab("unsettled")}
            >
              🔴 Unsettled Accountability
            </button>
            <button
              className={`${styles.tabBtn} ${
                activeTab === "settled" ? styles.activeTab : ""
              }`}
              onClick={() => setActiveTab("settled")}
            >
              ✅ Settled Accountability
            </button>
          </div>
        </div>

        {/* Top Controls */}
        <div className={styles.IIRTopControls}>
          <div className={styles.IIRTableHeader}>
            <select
              className={styles.IIRFilterCategory}
              value={filterClearanceType}
              onChange={(e) => {
                setFilterClearanceType(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="All">All Clearance Types</option>
              {Array.from(
                new Set(
                  reports.map(
                    (item) => item.clearanceType || "Equipment Completion"
                  )
                )
              )
                .filter(Boolean)
                .map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
            </select>

            <input
              type="text"
              className={styles.IIRSearchBar}
              placeholder="🔍 Search personnel..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>

        {/* Summary Cards */}
        <div className={styles.IIRSummary}>
          <button
            className={`${styles.IIRSummaryCard} ${styles.IIRTotal} ${
              currentFilterCard === "total" ? styles.IIRActive : ""
            }`}
            onClick={() => handleCardClick("total")}
          >
            <h3>Total Personnel</h3>
            <p>{stats.total}</p>
          </button>
          <button
            className={`${styles.IIRSummaryCard} ${styles.IIRUnsettled} ${
              currentFilterCard === "unsettled" ? styles.IIRActive : ""
            }`}
            onClick={() => handleCardClick("unsettled")}
          >
            <h3>Unsettled</h3>
            <p>{stats.unsettled}</p>
          </button>
          <button
            className={`${styles.IIRSummaryCard} ${styles.IIRSettled} ${
              currentFilterCard === "settled" ? styles.IIRActive : ""
            }`}
            onClick={() => handleCardClick("settled")}
          >
            <h3>Settled</h3>
            <p>{stats.settled}</p>
          </button>
          <button className={`${styles.IIRSummaryCard} ${styles.IIRValue}`}>
            <h3>Total Outstanding</h3>
            <p>{formatCurrency(stats.totalMissingAmount)}</p>
          </button>
        </div>

        {/* Table Header Section */}
        <div className={styles.IIRTableHeaderSection}>
          <h2 className={styles.IIRSHeaders}>
            {activeTab === "unsettled"
              ? "Unsettled Accountability"
              : "Settled Accountability"}{" "}
            Records
          </h2>
          <div className={styles.combinedInfoHeader}>
            <span className={styles.routineIndicator}>
              🔵 Routine Inspection
            </span>
            <span className={styles.clearanceIndicator}>
              🟣 Clearance Request
            </span>
            <span className={styles.combinedIndicator}>
              ⚡ Combined Accountability
            </span>
          </div>
        </div>

        <div
          className={`${styles.IIRPaginationContainer} ${styles.IIRTopPagination}`}
        >
          {renderPaginationButtons()}
        </div>

        {/* Scrollable Table Container */}
        <div className={styles.IIRTableScrollContainer}>
          <table className={styles.IIRTable}>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Personnel Name</th>
                <th>Clearance Type</th>
                <th>Request Date</th>
                <th>Status</th>
                <th>Missing Equipment</th>
                <th>Total Value</th>
                <th>Findings</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td
                    colSpan="10"
                    style={{ textAlign: "center", padding: "40px" }}
                  >
                    <div style={{ fontSize: "48px", marginBottom: "16px" }}>
                      <span className={styles.IIRAnimatedEmoji}>
                        {activeTab === "unsettled" ? "✅" : "📊"}
                      </span>
                    </div>
                    <h3
                      style={{
                        fontSize: "18px",
                        fontWeight: "600",
                        color: "#2b2b2b",
                        marginBottom: "8px",
                      }}
                    >
                      {activeTab === "unsettled"
                        ? "No Unsettled Accountability Found"
                        : "No Settled Accountability Found"}
                    </h3>
                    <p style={{ fontSize: "14px", color: "#999" }}>
                      {activeTab === "unsettled"
                        ? "All personnel are settled with their equipment accountability."
                        : "No settlement records available yet."}
                    </p>
                  </td>
                </tr>
              ) : (
                paginated.map((report) => {
                  const routineEquipment = report.missingEquipment.filter(
                    (eq) => eq.source_type === "routine"
                  );
                  const clearanceEquipment = report.missingEquipment.filter(
                    (eq) => eq.source_type === "clearance-linked"
                  );

                  return (
                    <tr key={report.id || report.personnel_id}>
                      <td>
                        <div className={styles.rankCell}>
                          {report.rank || "N/A"}
                          {report.rank_image ? (
                            <img
                              src={report.rank_image}
                              alt={report.rank || "Rank"}
                              className={styles.rankImage}
                              onError={(e) => {
                                e.target.style.display = "none";
                                e.target.nextSibling.style.display =
                                  "inline-block";
                              }}
                            />
                          ) : null}
                          <span
                            className={
                              report.rank_image
                                ? styles.rankTextWithImage
                                : styles.rankText
                            }
                          ></span>
                        </div>
                      </td>
                      <td>
                        <div className={styles.personnelInfoCell}>
                          <div className={styles.personnelNameRow}>
                            <strong className={styles.personnelFullName}>
                              {report.formattedName}
                            </strong>
                            {report.badge_number && (
                              <div className={styles.IIRBadgeNumber}>
                                Badge: {report.badge_number}
                              </div>
                            )}
                          </div>

                          {report.hasCombinedAccountability && (
                            <div className={styles.combinedAccountabilityBadge}>
                              ⚡ Combined Accountability
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className={styles.clearanceTypesDisplay}>
                          {report.clearanceType}
                          {report.clearanceTypeCount > 1 && (
                            <span className={styles.multipleTypesBadge}>
                              ({report.clearanceTypeCount} types)
                            </span>
                          )}
                          {report.clearanceRequestCount > 1 && (
                            <span className={styles.multipleRequestsBadge}>
                              🔢 {report.clearanceRequestCount} requests
                            </span>
                          )}
                          {report.hasMultipleClearances && (
                            <div className={styles.multipleClearanceTooltip}>
                              <div className={styles.tooltipTitle}>
                                Multiple Clearance Requests:
                              </div>
                              {report.clearanceRequestIds.map((id, idx) => (
                                <div key={idx} className={styles.tooltipItem}>
                                  Request #{idx + 1}:{" "}
                                  {report.clearanceTypes[idx] || "Unknown"}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        {report.hasCombinedAccountability && (
                          <div className={styles.sourceBreakdown}>
                            <span className={styles.routineBadge}>
                              Routine: {routineEquipment.length} item(s)
                            </span>
                            <span className={styles.clearanceBadge}>
                              Clearance: {clearanceEquipment.length} item(s)
                            </span>
                          </div>
                        )}
                      </td>
                      <td>{formatDate(report.requestDate)}</td>
                      <td>
                        <span
                          className={`${
                            styles.IIRStatusBadge
                          } ${getStatusBadgeClass(report.status)}`}
                        >
                          {report.status}
                          {report.settlement_date && (
                            <div className={styles.settlementDate}>
                              {formatDate(report.settlement_date)}
                            </div>
                          )}
                        </span>
                      </td>
                      <td>
                        {report.missingEquipment.length > 0 ? (
                          <div className={styles.IIRMissingSection}>
                            <span className={styles.IIRMissingCount}>
                              {report.missingEquipment.length} item(s)
                            </span>
                            {report.hasCombinedAccountability && (
                              <div className={styles.equipmentSourceSummary}>
                                <span className={styles.routineDot}>🔵</span>
                                <span className={styles.sourceCount}>
                                  {routineEquipment.length} routine
                                </span>
                                <span className={styles.clearanceDot}>🟣</span>
                                <span className={styles.sourceCount}>
                                  {clearanceEquipment.length} clearance
                                </span>
                              </div>
                            )}
                            <button
                              className={`${styles.IIRBtn} ${styles.IIRShowMissingBtn}`}
                              onClick={() => showMissingEquipment(report)}
                            >
                              Show Details
                            </button>
                          </div>
                        ) : (
                          <span className={styles.IIRNoMissing}>
                            No missing equipment
                          </span>
                        )}
                      </td>
                      <td>
                        {report.totalMissingAmount > 0 ? (
                          <div className={styles.amountBreakdown}>
                            <span className={styles.IIRTotalPrice}>
                              {formatCurrency(report.totalMissingAmount)}
                            </span>
                            {report.hasCombinedAccountability && (
                              <div className={styles.amountDetails}>
                                <span className={styles.routineAmount}>
                                  Routine:{" "}
                                  {formatCurrency(report.routineAmount)}
                                </span>
                                <span className={styles.clearanceAmount}>
                                  Clearance:{" "}
                                  {formatCurrency(report.clearanceAmount)}
                                </span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className={styles.IIRNoPrice}>₱0.00</span>
                        )}
                      </td>
                      <td>
                        <div className={styles.IIRFindingsPreview}>
                          {report.findings && report.findings.length > 50
                            ? `${report.findings.substring(0, 50)}...`
                            : report.findings || "No findings"}
                        </div>
                      </td>
                      <td>
                        <div className={styles.IIRActionButtons}>
                          <button
                            className={styles.IIRViewDetailsBtn}
                            onClick={() => showDetails(report)}
                          >
                            View Details
                          </button>
                          {report.status === "Unsettled" && (
                            <button
                              className={styles.IIRApproveBtn}
                              onClick={() => approveSettlement(report)}
                            >
                              {report.hasCombinedAccountability
                                ? "⚡ Settle All"
                                : "✅ Approve"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div
          className={`${styles.IIRPaginationContainer} ${styles.IIRBottomPagination}`}
        >
          {renderPaginationButtons()}
        </div>

        {/* Summary Footer */}
        <div className={styles.IIRTableFooter}>
          <div className={styles.IIRResultsInfo}>
            Showing {accountabilityReports.length} personnel with{" "}
            {activeTab === "unsettled" ? "unsettled" : "settled"} accountability
            {stats.unsettled > 0 && activeTab === "unsettled" && (
              <span className={styles.combinedCount}>
                ({stats.unsettled} with combined accountability)
              </span>
            )}
          </div>
          {activeTab === "unsettled" && (
            <div className={styles.IIRTotalMissing}>
              <strong>Total Outstanding Value:</strong>{" "}
              {formatCurrency(
                accountabilityReports.reduce(
                  (sum, report) => sum + report.totalMissingAmount,
                  0
                )
              )}
            </div>
          )}
        </div>

        {/* Missing Equipment Modal */}
        {showMissingModal && selectedPersonnel && (
          <div className={styles.IIRViewModalOverlay}>
            <div className={styles.IIRViewModalContent}>
              <div className={styles.IIRViewModalHeader}>
                <h3 className={styles.IIRViewModalTitle}>
                  Missing/Damaged Equipment - {selectedPersonnel.personnelName}
                  {selectedPersonnel.hasCombinedAccountability && (
                    <span className={styles.combinedModalBadge}>
                      ⚡ Combined Accountability
                    </span>
                  )}
                </h3>
                <button
                  className={styles.IIRViewModalCloseBtn}
                  onClick={() => setShowMissingModal(false)}
                >
                  &times;
                </button>
              </div>

              <div className={styles.IIRViewModalBody}>
                <div className={styles.IIRViewModalSection}>
                  <h4 className={styles.IIRViewModalSectionTitle}>
                    Personnel Information
                  </h4>
                  <div className={styles.IIRViewModalGrid}>
                    <div className={styles.IIRViewModalField}>
                      <label>Rank:</label>
                      <span>{selectedPersonnel.rank}</span>
                    </div>
                    <div className={styles.IIRViewModalField}>
                      <label>Badge Number:</label>
                      <span>{selectedPersonnel.badge_number || "N/A"}</span>
                    </div>
                    <div className={styles.IIRViewModalField}>
                      <label>Clearance Type:</label>
                      <div className={styles.clearanceTypesDisplay}>
                        <span>{selectedPersonnel.clearanceType}</span>
                        {selectedPersonnel.clearanceTypeCount > 1 && (
                          <span className={styles.multipleTypesBadge}>
                            ({selectedPersonnel.clearanceTypeCount} types)
                          </span>
                        )}
                        {selectedPersonnel.clearanceRequestCount > 1 && (
                          <span className={styles.multipleRequestsBadge}>
                            🔢 {selectedPersonnel.clearanceRequestCount}{" "}
                            requests
                          </span>
                        )}
                        {selectedPersonnel.hasMultipleClearances && (
                          <div className={styles.multipleClearanceTooltip}>
                            <div className={styles.tooltipTitle}>
                              Multiple Clearance Requests:
                            </div>
                            {selectedPersonnel.clearanceRequestIds.map(
                              (id, idx) => (
                                <div key={idx} className={styles.tooltipItem}>
                                  Request #{idx + 1}:{" "}
                                  {selectedPersonnel.clearanceTypes[idx] ||
                                    "Unknown"}
                                </div>
                              )
                            )}
                          </div>
                        )}
                      </div>
                      {selectedPersonnel.clearanceTypes &&
                        selectedPersonnel.clearanceTypes.length > 0 && (
                          <div className={styles.clearanceTypesList}>
                            {selectedPersonnel.clearanceTypes.map(
                              (type, index) => (
                                <span
                                  key={index}
                                  className={styles.clearanceTypeTag}
                                >
                                  {type}
                                </span>
                              )
                            )}
                          </div>
                        )}
                    </div>
                    <div className={styles.IIRViewModalField}>
                      <label>Status:</label>
                      <span
                        className={`${
                          styles.IIRStatusBadge
                        } ${getStatusBadgeClass(selectedPersonnel.status)}`}
                      >
                        {selectedPersonnel.status}
                        {selectedPersonnel.settlement_date && (
                          <div className={styles.settlementDate}>
                            Settled:{" "}
                            {formatDate(selectedPersonnel.settlement_date)}
                          </div>
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Routine Equipment Section */}
                {missingEquipmentList.routine &&
                  missingEquipmentList.routine.length > 0 && (
                    <div className={styles.IIRViewModalSection}>
                      <h4 className={styles.IIRViewModalSectionTitle}>
                        <span className={styles.routineSectionHeader}>
                          🔵 From Routine Inspections (
                          {missingEquipmentList.routine.length} items)
                        </span>
                      </h4>
                      <div className={styles.IIRViewModalFullWidth}>
                        <table className={styles.IIRModalTable}>
                          <thead>
                            <tr>
                              <th>Item Name</th>
                              <th>Item Code</th>
                              <th>Category</th>
                              <th>Status</th>
                              <th>Value</th>
                              <th>Inspection Date</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {missingEquipmentList.routine.map(
                              (equipment, index) => (
                                <tr key={`routine-${index}`}>
                                  <td>{equipment.name}</td>
                                  <td>{equipment.item_code}</td>
                                  <td>{equipment.category}</td>
                                  <td>
                                    <span
                                      className={`${styles.IIRStatusBadge} ${
                                        equipment.status === "LOST"
                                          ? styles.IIRStatusMissing
                                          : styles.IIRStatusDamaged
                                      }`}
                                    >
                                      {equipment.status}
                                    </span>
                                  </td>
                                  <td>
                                    {formatCurrency(equipment.price || 0)}
                                  </td>
                                  <td>
                                    {formatDate(equipment.last_inspection_date)}
                                  </td>
                                  <td>
                                    {!equipment.is_settled && (
                                      <div className={styles.equipmentActions}>
                                        <button
                                          className={styles.returnBtn}
                                          onClick={() =>
                                            handleEquipmentReturn(
                                              selectedPersonnel,
                                              equipment
                                            )
                                          }
                                          title="Mark as returned/repaired"
                                        >
                                          ↩️ Return
                                        </button>
                                      </div>
                                    )}
                                    {equipment.is_settled && (
                                      <span className={styles.settledBadge}>
                                        {equipment.status === "RETURNED"
                                          ? "✅ Returned"
                                          : "✅ Settled"}
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              )
                            )}
                          </tbody>
                          <tfoot>
                            <tr>
                              <td colSpan="4" className={styles.sourceTotal}>
                                <strong>Routine Subtotal:</strong>
                              </td>
                              <td className={styles.sourceTotalAmount}>
                                <strong>
                                  {formatCurrency(
                                    missingEquipmentList.routine.reduce(
                                      (sum, eq) => sum + (eq.price || 0),
                                      0
                                    )
                                  )}
                                </strong>
                              </td>
                              <td colSpan="2"></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )}

                {/* Clearance Equipment Section */}
                {missingEquipmentList.clearance &&
                  missingEquipmentList.clearance.length > 0 && (
                    <div className={styles.IIRViewModalSection}>
                      <h4 className={styles.IIRViewModalSectionTitle}>
                        <span className={styles.clearanceSectionHeader}>
                          🟣 From Clearance Request (
                          {missingEquipmentList.clearance.length} items)
                        </span>
                      </h4>
                      <div className={styles.IIRViewModalFullWidth}>
                        <table className={styles.IIRModalTable}>
                          <thead>
                            <tr>
                              <th>Item Name</th>
                              <th>Item Code</th>
                              <th>Category</th>
                              <th>Status</th>
                              <th>Value</th>
                              <th>Inspection Date</th>
                              <th>Clearance Type</th>
                            </tr>
                          </thead>
                          <tbody>
                            {missingEquipmentList.clearance.map(
                              (equipment, index) => (
                                <tr key={`clearance-${index}`}>
                                  <td>{equipment.name}</td>
                                  <td>{equipment.item_code}</td>
                                  <td>{equipment.category}</td>
                                  <td>
                                    <span
                                      className={`${styles.IIRStatusBadge} ${
                                        equipment.status === "LOST"
                                          ? styles.IIRStatusMissing
                                          : styles.IIRStatusDamaged
                                      }`}
                                    >
                                      {equipment.status}
                                    </span>
                                  </td>
                                  <td>
                                    {formatCurrency(equipment.price || 0)}
                                  </td>
                                  <td>
                                    {formatDate(equipment.last_inspection_date)}
                                  </td>
                                  <td>{equipment.clearance_type || "N/A"}</td>
                                </tr>
                              )
                            )}
                          </tbody>
                          <tfoot>
                            <tr>
                              <td colSpan="4" className={styles.sourceTotal}>
                                <strong>Clearance Subtotal:</strong>
                              </td>
                              <td className={styles.sourceTotalAmount}>
                                <strong>
                                  {formatCurrency(
                                    missingEquipmentList.clearance.reduce(
                                      (sum, eq) => sum + (eq.price || 0),
                                      0
                                    )
                                  )}
                                </strong>
                              </td>
                              <td colSpan="2"></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )}

                <div className={styles.IIRViewModalSection}>
                  <h4 className={styles.IIRViewModalSectionTitle}>
                    Financial Summary
                  </h4>
                  <div className={styles.IIRViewModalGrid}>
                    <div className={styles.IIRViewModalField}>
                      <label>Total Items:</label>
                      <span>{missingEquipmentList.all?.length || 0}</span>
                    </div>
                    {missingEquipmentList.routine &&
                      missingEquipmentList.routine.length > 0 && (
                        <div className={styles.IIRViewModalField}>
                          <label>Routine Items:</label>
                          <span className={styles.routineValue}>
                            {missingEquipmentList.routine.length} item(s)
                          </span>
                        </div>
                      )}
                    {missingEquipmentList.clearance &&
                      missingEquipmentList.clearance.length > 0 && (
                        <div className={styles.IIRViewModalField}>
                          <label>Clearance Items:</label>
                          <span className={styles.clearanceValue}>
                            {missingEquipmentList.clearance.length} item(s)
                          </span>
                        </div>
                      )}
                    <div className={styles.IIRViewModalField}>
                      <label>Total Value:</label>
                      <span style={{ color: "#dc3545", fontWeight: "bold" }}>
                        {formatCurrency(selectedPersonnel.totalMissingAmount)}
                      </span>
                    </div>
                    {selectedPersonnel.is_settled && (
                      <div className={styles.IIRViewModalField}>
                        <label>Settlement Method:</label>
                        <span>
                          {selectedPersonnel.settlement_method ||
                            "Cash Payment"}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className={styles.IIRViewModalActions}>
                <button
                  className={styles.IIRCloseBtn}
                  onClick={() => setShowMissingModal(false)}
                >
                  Close
                </button>

                {selectedPersonnel.status === "Unsettled" && (
                  <>
                    <button
                      className={styles.returnAllBtn}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Return ALL equipment for ${selectedPersonnel.personnelName}?`
                          )
                        ) {
                          handleReturnAllEquipment(selectedPersonnel);
                          setShowMissingModal(false);
                        }
                      }}
                    >
                      ↩️ Return All
                    </button>
                    <button
                      className={styles.IIRApproveBtn}
                      onClick={() => {
                        setShowMissingModal(false);
                        approveSettlement(selectedPersonnel);
                      }}
                    >
                      {selectedPersonnel.hasCombinedAccountability
                        ? "⚡ Settle All Accountability"
                        : "✅ Approve"}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Approve Settlement Modal */}
        {showApproveModal && (
          <div className={styles.IIRViewModalOverlay}>
            <div
              className={styles.IIRViewModalContent}
              style={{ maxWidth: "500px" }}
            >
              <div className={styles.IIRViewModalHeader}>
                <h3 className={styles.IIRViewModalTitle}>
                  {approveModalDetails.title}
                </h3>
                <button
                  className={styles.IIRViewModalCloseBtn}
                  onClick={() => {
                    setShowApproveModal(false);
                    setSelectedReportToApprove(null);
                  }}
                >
                  &times;
                </button>
              </div>

              <div className={styles.IIRViewModalBody}>
                <div className={styles.approveModalIcon}>
                  {approveModalDetails.hasCombinedAccountability ? (
                    <div className={styles.combinedModalIcon}>⚡</div>
                  ) : (
                    <div className={styles.approveModalIcon}>✅</div>
                  )}
                </div>

                <div
                  className={styles.approveModalMessage}
                  dangerouslySetInnerHTML={{
                    __html: approveModalDetails.message,
                  }}
                />

                {approveModalDetails.hasCombinedAccountability && (
                  <div className={styles.approveModalBreakdown}>
                    <div className={styles.breakdownItem}>
                      <span className={styles.routineDot}>🔵</span>
                      <span>Routine Inspection:</span>
                      <strong>
                        {formatCurrency(approveModalDetails.routineAmount)}
                      </strong>
                    </div>
                    <div className={styles.breakdownItem}>
                      <span className={styles.clearanceDot}>🟣</span>
                      <span>Clearance Request:</span>
                      <strong>
                        {formatCurrency(approveModalDetails.clearanceAmount)}
                      </strong>
                    </div>
                    <div className={styles.breakdownTotal}>
                      <span className={styles.combinedDot}>⚡</span>
                      <span>Total Amount:</span>
                      <strong style={{ color: "#dc3545" }}>
                        {formatCurrency(approveModalDetails.totalAmount)}
                      </strong>
                    </div>
                  </div>
                )}

                <div className={styles.approveModalWarning}>
                  ⚠️ <strong>This action cannot be undone.</strong> Please
                  verify the details before proceeding.
                </div>
              </div>

              <div className={styles.IIRViewModalActions}>
                <button
                  className={styles.IIRCancelBtn}
                  onClick={() => {
                    setShowApproveModal(false);
                    setSelectedReportToApprove(null);
                  }}
                >
                  ❌ Cancel
                </button>
                <button
                  className={styles.IIRConfirmBtn}
                  onClick={handleConfirmApproval}
                >
                  ✅ Confirm Approval
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Details Modal */}
        {showDetailsModal && selectedReport && (
          <div className={styles.IIRViewModalOverlay}>
            <div
              className={styles.IIRViewModalContent}
              style={{ maxWidth: "800px" }}
            >
              <div className={styles.IIRViewModalHeader}>
                <h3 className={styles.IIRViewModalTitle}>
                  Complete Details - {selectedReport.personnelName}
                  {selectedReport.hasCombinedAccountability && (
                    <span className={styles.combinedModalBadge}>
                      ⚡ Combined Accountability
                    </span>
                  )}
                </h3>
                <button
                  className={styles.IIRViewModalCloseBtn}
                  onClick={() => setShowDetailsModal(false)}
                >
                  &times;
                </button>
              </div>

              <div className={styles.IIRViewModalBody}>
                <div className={styles.IIRViewModalSection}>
                  <h4 className={styles.IIRViewModalSectionTitle}>
                    Personnel Information
                  </h4>
                  <div className={styles.IIRViewModalGrid}>
                    <div className={styles.IIRViewModalField}>
                      <label>Name:</label>
                      <span>{selectedReport.personnelName}</span>
                    </div>
                    <div className={styles.IIRViewModalField}>
                      <label>Rank:</label>
                      <span>{selectedReport.rank}</span>
                    </div>
                    <div className={styles.IIRViewModalField}>
                      <label>Badge Number:</label>
                      <span>{selectedReport.badge_number || "N/A"}</span>
                    </div>
                    <div className={styles.IIRViewModalField}>
                      <label>Clearance Type:</label>
                      <div className={styles.clearanceTypesDisplay}>
                        <span>{selectedReport.clearanceType}</span>
                        {selectedReport.clearanceTypeCount > 1 && (
                          <span className={styles.multipleTypesBadge}>
                            ({selectedReport.clearanceTypeCount} types)
                          </span>
                        )}
                        {selectedReport.clearanceRequestCount > 1 && (
                          <span className={styles.multipleRequestsBadge}>
                            🔢 {selectedReport.clearanceRequestCount} requests
                          </span>
                        )}
                        {selectedReport.hasMultipleClearances && (
                          <div className={styles.multipleClearanceTooltip}>
                            <div className={styles.tooltipTitle}>
                              Multiple Clearance Requests:
                            </div>
                            {selectedReport.clearanceRequestIds.map(
                              (id, idx) => (
                                <div key={idx} className={styles.tooltipItem}>
                                  Request #{idx + 1}:{" "}
                                  {selectedReport.clearanceTypes[idx] ||
                                    "Unknown"}
                                </div>
                              )
                            )}
                          </div>
                        )}
                      </div>
                      {selectedReport.clearanceTypes &&
                        selectedReport.clearanceTypes.length > 0 && (
                          <div className={styles.clearanceTypesList}>
                            {selectedReport.clearanceTypes.map(
                              (type, index) => (
                                <span
                                  key={index}
                                  className={styles.clearanceTypeTag}
                                >
                                  {type}
                                </span>
                              )
                            )}
                          </div>
                        )}
                    </div>
                  </div>
                </div>

                <div className={styles.IIRViewModalSection}>
                  <h4 className={styles.IIRViewModalSectionTitle}>
                    Account Information
                  </h4>
                  <div className={styles.IIRViewModalGrid}>
                    <div className={styles.IIRViewModalField}>
                      <label>Request Date:</label>
                      <span>{formatDate(selectedReport.requestDate)}</span>
                    </div>
                    <div className={styles.IIRViewModalField}>
                      <label>Status:</label>
                      <span
                        className={`${
                          styles.IIRStatusBadge
                        } ${getStatusBadgeClass(selectedReport.status)}`}
                      >
                        {selectedReport.status}
                      </span>
                    </div>
                    <div className={styles.IIRViewModalField}>
                      <label>Clearance Status:</label>
                      <span>{selectedReport.clearance_status || "N/A"}</span>
                    </div>
                    {selectedReport.settlement_date && (
                      <div className={styles.IIRViewModalField}>
                        <label>Settlement Date:</label>
                        <span>
                          {formatDate(selectedReport.settlement_date)}
                        </span>
                      </div>
                    )}
                    {selectedReport.settlement_method && (
                      <div className={styles.IIRViewModalField}>
                        <label>Settlement Method:</label>
                        <span>{selectedReport.settlement_method}</span>
                      </div>
                    )}
                    {selectedReport.hasCombinedAccountability && (
                      <div className={styles.IIRViewModalField}>
                        <label>Accountability Type:</label>
                        <span className={styles.combinedType}>
                          ⚡ Combined (Routine + Clearance)
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className={styles.IIRViewModalSection}>
                  <h4 className={styles.IIRViewModalSectionTitle}>
                    Findings Report
                  </h4>
                  <div className={styles.IIRViewModalFullWidth}>
                    <div className={styles.IIRViewModalField}>
                      <div className={styles.IIRViewModalTextContent}>
                        {selectedReport.findings || "No findings recorded."}
                      </div>
                    </div>
                  </div>
                </div>

                {selectedReport.missingEquipment.length > 0 && (
                  <div className={styles.IIRViewModalSection}>
                    <h4 className={styles.IIRViewModalSectionTitle}>
                      Missing/Damaged Equipment Summary
                    </h4>
                    <div className={styles.IIRViewModalGrid}>
                      <div className={styles.IIRViewModalField}>
                        <label>Total Items:</label>
                        <span>{selectedReport.missingEquipment.length}</span>
                      </div>
                      {selectedReport.routineEquipmentCount > 0 && (
                        <div className={styles.IIRViewModalField}>
                          <label>Routine Items:</label>
                          <span className={styles.routineValue}>
                            {selectedReport.routineEquipmentCount} item(s)
                          </span>
                        </div>
                      )}
                      {selectedReport.clearanceEquipmentCount > 0 && (
                        <div className={styles.IIRViewModalField}>
                          <label>Clearance Items:</label>
                          <span className={styles.clearanceValue}>
                            {selectedReport.clearanceEquipmentCount} item(s)
                          </span>
                        </div>
                      )}
                      <div className={styles.IIRViewModalField}>
                        <label>Total Value:</label>
                        <span style={{ color: "#dc3545", fontWeight: "bold" }}>
                          {formatCurrency(selectedReport.totalMissingAmount)}
                        </span>
                      </div>
                      {selectedReport.hasCombinedAccountability && (
                        <>
                          <div className={styles.IIRViewModalField}>
                            <label>Routine Value:</label>
                            <span className={styles.routineAmount}>
                              {formatCurrency(selectedReport.routineAmount)}
                            </span>
                          </div>
                          <div className={styles.IIRViewModalField}>
                            <label>Clearance Value:</label>
                            <span className={styles.clearanceAmount}>
                              {formatCurrency(selectedReport.clearanceAmount)}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className={styles.IIRViewModalActions}>
                <button
                  className={styles.IIRCloseBtn}
                  onClick={() => setShowDetailsModal(false)}
                >
                  Close
                </button>
                {selectedReport.status === "Unsettled" && (
                  <button
                    className={styles.IIRApproveBtn}
                    onClick={() => {
                      setShowDetailsModal(false);
                      approveSettlement(selectedReport);
                    }}
                  >
                    {selectedReport.hasCombinedAccountability
                      ? "Settle All Accountability"
                      : "Approve Settlement"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InspectorInspectionReport;
