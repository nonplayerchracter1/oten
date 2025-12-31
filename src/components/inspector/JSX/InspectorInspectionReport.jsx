// Inspection.jsx (Updated to match inspectorinventorycontrol style)
import React, { useState, useEffect } from "react";
import styles from "../styles/InspectorInspectionReport.module.css";
import { Title, Meta } from "react-head";
import InspectorSidebar from "../../InspectorSidebar";
import Hamburger from "../../Hamburger";
import { useSidebar } from "../../SidebarContext";
import { supabase } from "../../../lib/supabaseClient";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const InspectorInspectionReport = () => {
  const { isSidebarCollapsed } = useSidebar();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState([]);
  const [showMissingModal, setShowMissingModal] = useState(false);
  const [selectedPersonnel, setSelectedPersonnel] = useState(null);
  const [missingEquipmentList, setMissingEquipmentList] = useState({});
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [error, setError] = useState(null);

  // Filter states
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterClearanceType, setFilterClearanceType] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 5;

  // Card filter state (like inspectorinventorycontrol)
  const [currentFilterCard, setCurrentFilterCard] = useState("total");

  // Load data from personnel_equipment_accountability view
  useEffect(() => {
    loadAccountabilityData();
  }, []);

const loadAccountabilityData = async () => {
  setLoading(true);
  setError(null);

  try {
    // Load accountability records
    const { data: combinedData, error: combinedError } = await supabase
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
      .eq("is_settled", false)
      .in("record_type", ["LOST", "DAMAGED"])
      .order("record_date", { ascending: false });

    if (combinedError) throw combinedError;

    // Create a map to track unique equipment items per personnel
    const uniqueEquipmentMap = {}; // Key: personnelId-inventoryId

    // First pass: Identify duplicates and keep only one record per equipment
    const deduplicatedRecords = [];

    (combinedData || []).forEach((item) => {
      const key = `${item.personnel_id}-${item.inventory_id}`;

      // Check if we've already seen this equipment for this personnel
      if (!uniqueEquipmentMap[key]) {
        // First time seeing this equipment for this personnel
        uniqueEquipmentMap[key] = {
          count: 1,
          records: [item],
          // Keep the most recent record by default
          selectedRecord: item,
        };
        deduplicatedRecords.push(item);
      } else {
        // Duplicate found - track it
        uniqueEquipmentMap[key].count++;
        uniqueEquipmentMap[key].records.push(item);

        // Check if we should replace with a different record
        const existingRecordDate = new Date(
          uniqueEquipmentMap[key].selectedRecord.record_date || 0
        );
        const newRecordDate = new Date(item.record_date || 0);

        // Prefer clearance-linked records over routine
        if (
          item.source_type === "clearance-linked" &&
          uniqueEquipmentMap[key].selectedRecord.source_type === "routine"
        ) {
          uniqueEquipmentMap[key].selectedRecord = item;
          // Update in deduplicatedRecords
          const index = deduplicatedRecords.findIndex(
            (r) => r.id === uniqueEquipmentMap[key].selectedRecord.id
          );
          if (index > -1) {
            deduplicatedRecords[index] = item;
          }
        }
        // If both are same type, keep the most recent
        else if (newRecordDate > existingRecordDate) {
          uniqueEquipmentMap[key].selectedRecord = item;
          // Update in deduplicatedRecords
          const index = deduplicatedRecords.findIndex(
            (r) => r.id === uniqueEquipmentMap[key].selectedRecord.id
          );
          if (index > -1) {
            deduplicatedRecords[index] = item;
          }
        }
      }
    });

    // Log duplicates for debugging
    const duplicates = Object.entries(uniqueEquipmentMap).filter(
      ([key, data]) => data.count > 1
    );

    if (duplicates.length > 0) {
      console.log(`Found ${duplicates.length} duplicate equipment items:`);
      duplicates.forEach(([key, data]) => {
        console.log(`Equipment ${key}: ${data.count} records`);
        console.log(
          "Records:",
          data.records.map((r) => ({
            id: r.id,
            source_type: r.source_type,
            clearance_request_id: r.clearance_request_id,
            clearance_type: r.clearance_requests?.type,
            record_date: r.record_date,
          }))
        );
      });
    }

    // Group by personnel and collect ALL clearance types
    const personnelMap = {};

    deduplicatedRecords.forEach((item) => {
      const key = item.clearance_request_id
        ? `${item.personnel_id}-${item.clearance_request_id}`
        : `routine-${item.personnel_id}`;

      if (!personnelMap[key]) {
        const clearanceType = item.clearance_requests
          ? item.clearance_requests.type
          : "Routine Inspection";

        // Build full name with middle name and suffix
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

        personnelMap[key] = {
          personnel_id: item.personnel_id,
          personnel_name: fullName,
          formatted_name: formattedName,
          rank: item.personnel?.rank || "N/A",
          rank_image: item.personnel?.rank_image || null,
          badge_number: item.personnel?.badge_number || "N/A",
          clearance_type: clearanceType,
          clearance_types: new Set([clearanceType]), // Store as Set for multiple types
          clearance_status: item.clearance_requests?.status || "N/A",
          clearance_request_id: item.clearance_request_id,
          clearance_request_date:
            item.clearance_requests?.created_at || item.record_date,
          accountability_status: "UNSETTLED",
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
          isRoutine: !item.clearance_request_id,
          source_type: item.source_type || "routine",
        };
      }

      // Add clearance type to the set if it exists
      if (item.clearance_requests?.type) {
        personnelMap[key].clearance_types.add(item.clearance_requests.type);
      }

      // Add equipment to the personnel's list (deduplicated)
      const equipmentValue =
        item.amount_due || item.inventory?.current_value || 0;
      const isLost = item.record_type === "LOST";
      const isDamaged = item.record_type === "DAMAGED";

      personnelMap[key].total_equipment_count++;
      personnelMap[key].total_equipment_value += equipmentValue;

      if (isLost) {
        personnelMap[key].lost_equipment_count++;
        personnelMap[key].lost_equipment_value += equipmentValue;
        personnelMap[key].total_outstanding_amount += equipmentValue;
      } else if (isDamaged) {
        personnelMap[key].damaged_equipment_count++;
        personnelMap[key].damaged_equipment_value += equipmentValue * 0.5;
        personnelMap[key].total_outstanding_amount += equipmentValue * 0.5;
      }

      personnelMap[key].missingEquipment.push({
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
      });

      // Update latest inspection info
      if (item.record_date) {
        const currentDate = new Date(
          personnelMap[key].last_inspection_date || 0
        );
        const newDate = new Date(item.record_date);
        if (newDate > currentDate) {
          personnelMap[key].last_inspection_date = item.record_date;
          personnelMap[key].last_inspector_name =
            item.inspection?.inspector_name;
          personnelMap[key].last_inspection_findings = item.remarks;
        }
      }
    });

    // Convert to array format
    const accountabilityReports = Object.values(personnelMap).map(
      (item, index) => {
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

        // Convert Set to array and create display text
        const clearanceTypesArray = Array.from(item.clearance_types);
        const clearanceTypeText =
          clearanceTypesArray.length > 1
            ? clearanceTypesArray.join(", ")
            : clearanceTypesArray[0] || "Routine Inspection";

        return {
          id: item.clearance_request_id || `routine-${index + 1}`,
          personnel_id: item.personnel_id,
          rank: item.rank,
          rank_image: item.rank_image,
          personnelName: item.personnel_name,
          formattedName: item.formatted_name || item.personnel_name,
          badge_number: item.badge_number,
          clearanceType: clearanceTypeText, // Combined types
          clearanceTypes: clearanceTypesArray, // Array of all types
          clearanceTypeCount: clearanceTypesArray.length,
          requestDate: item.clearance_request_date,
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
          clearance_request_id: item.clearance_request_id,
          clearance_status: item.clearance_status,
          status: "Unsettled",
          missingEquipment: item.missingEquipment,
          isRoutine: item.isRoutine,
          source_type: item.source_type,
          // Combined accountability flags
          hasCombinedAccountability:
            routineEquipment.length > 0 && clearanceEquipment.length > 0,
          routineEquipmentCount: routineEquipment.length,
          clearanceEquipmentCount: clearanceEquipment.length,
          routineAmount: routineAmount,
          clearanceAmount: clearanceAmount,
        };
      }
    );

    setReports(accountabilityReports);

    // Sync with summary table (using deduplicated data)
    await syncAccountabilityTable(personnelMap);
  } catch (error) {
    console.error("Error loading accountability data:", error);
    setError("Failed to load accountability data: " + error.message);
  } finally {
    setLoading(false);
  }
};
  const syncAccountabilityTable = async (personnelMap) => {
    try {
      // Prepare records for insertion/update
      const accountabilityRecords = Object.values(personnelMap).map((item) => {
        const record = {
          personnel_id: item.personnel_id,
          personnel_name: item.personnel_name,
          rank: item.rank,
          badge_number: item.badge_number,
          clearance_type: item.clearance_type,
          clearance_status: item.clearance_status,
          clearance_request_date:
            item.clearance_request_date?.split("T")[0] ||
            new Date().toISOString().split("T")[0],

          total_equipment_count: item.total_equipment_count,
          lost_equipment_count: item.lost_equipment_count,
          damaged_equipment_count: item.damaged_equipment_count,
          total_equipment_value: item.total_equipment_value,
          lost_equipment_value: item.lost_equipment_value,
          damaged_equipment_value: item.damaged_equipment_value,
          total_outstanding_amount: item.total_outstanding_amount,

          last_inspection_date: item.last_inspection_date?.split("T")[0],
          last_inspector_name: item.last_inspector_name,
          last_inspection_findings: item.last_inspection_findings,

          accountability_status: "UNSETTLED",
          calculated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        // Only include clearance_request_id if it exists
        if (item.clearance_request_id) {
          record.clearance_request_id = item.clearance_request_id;
        }

        return record;
      });

      // Use upsert with onConflict - only works with the unique constraint
      const { error: upsertError } = await supabase
        .from("personnel_equipment_accountability_table")
        .upsert(accountabilityRecords, {
          onConflict: "personnel_id,clearance_request_id",
          ignoreDuplicates: false,
        });

      if (upsertError) {
        console.error("Error upserting accountability records:", upsertError);
        // Fallback to manual upsert
        await manualUpsertRecords(accountabilityRecords);
      }
    } catch (error) {
      console.error("Error in syncAccountabilityTable:", error);
    }
  };

  // Manual upsert function as fallback
  const manualUpsertRecords = async (records) => {
    try {
      for (const record of records) {
        // Build the conflict condition based on whether clearance_request_id exists
        let conflictColumns = ["personnel_id"];
        if (record.clearance_request_id) {
          conflictColumns.push("clearance_request_id");
        }

        // Use upsert with the correct conflict target
        const { error } = await supabase
          .from("personnel_equipment_accountability_table")
          .upsert(record, {
            onConflict: conflictColumns.join(","),
            ignoreDuplicates: false,
          });

        if (error) {
          console.error(
            `Error upserting record for ${record.personnel_name}:`,
            error
          );
        }
      }
    } catch (error) {
      console.error("Error in manualUpsertRecords:", error);
    }
  };

  // Helper function to update existing records
  const updateExistingRecords = async (records) => {
    try {
      for (const record of records) {
        // Check if record exists
        let query = supabase
          .from("personnel_equipment_accountability_table")
          .select("id")
          .eq("personnel_id", record.personnel_id);

        if (record.clearance_request_id) {
          query = query.eq("clearance_request_id", record.clearance_request_id);
        } else {
          query = query.is("clearance_request_id", null);
        }

        const { data: existingRecord } = await query.maybeSingle();

        if (existingRecord) {
          // Update existing record
          await supabase
            .from("personnel_equipment_accountability_table")
            .update(record)
            .eq("id", existingRecord.id);
        } else {
          // Insert new record
          await supabase
            .from("personnel_equipment_accountability_table")
            .insert([record]);
        }
      }
    } catch (error) {
      console.error("Error in updateExistingRecords:", error);
    }
  };

  const approveSettlement = async (report) => {
    // Filter out already returned equipment and get unique inventory items
    const unsettledEquipment = [];
    const processedInventoryIds = new Set();

    report.missingEquipment.forEach((eq) => {
      if (!eq.is_settled && !processedInventoryIds.has(eq.inventory_id)) {
        unsettledEquipment.push(eq);
        processedInventoryIds.add(eq.inventory_id);
      }
    });

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

    const message = report.hasCombinedAccountability
      ? `Approve settlement for ${
          report.personnelName
        }? This will settle BOTH routine (₱${formatCurrency(
          routineAmount
        )}) and clearance accountability (₱${formatCurrency(
          clearanceAmount
        )}). Total: ₱${formatCurrency(totalAmount)}`
      : `Approve settlement for ${report.personnelName}? This will settle ${
          unsettledEquipment.length
        } items for ₱${formatCurrency(totalAmount)}`;

    if (!window.confirm(message)) return;

    try {
      // Get ALL accountability records for these inventory items (including duplicates)
      const inventoryIds = unsettledEquipment
        .map((eq) => eq.inventory_id)
        .filter(Boolean);

      const { data: allAccountabilityRecords, error: fetchError } =
        await supabase
          .from("accountability_records")
          .select("*")
          .eq("personnel_id", report.personnel_id)
          .in("inventory_id", inventoryIds)
          .eq("is_settled", false);

      if (fetchError) throw fetchError;

      // Settle ALL duplicate records for these inventory items
      const allAccountabilityIds =
        allAccountabilityRecords?.map((record) => record.id) || [];

      const { error: accountabilityError } = await supabase
        .from("accountability_records")
        .update({
          is_settled: true,
          settlement_date: new Date().toISOString().split("T")[0],
          settlement_method: "Cash Payment",
          updated_at: new Date().toISOString(),
        })
        .in("id", allAccountabilityIds);

      if (accountabilityError) throw accountabilityError;

      // 2. If this is linked to a clearance, update clearance_inventory too
      if (report.clearance_request_id) {
        // Get all clearance inventory items for this request
        const { data: clearanceItems, error: clearanceItemsError } =
          await supabase
            .from("clearance_inventory")
            .select("id, inventory_id, status")
            .eq("clearance_request_id", report.clearance_request_id)
            .eq("status", "Pending");

        if (clearanceItemsError) {
          console.error("Error fetching clearance items:", clearanceItemsError);
        }

        // Update clearance_inventory status to "Cleared" for settled accountability
        if (clearanceItems && clearanceItems.length > 0) {
          // Get inventory IDs from accountability
          const accountableInventoryIds = report.missingEquipment
            .filter(
              (eq) => eq.source_type === "clearance-linked" && eq.inventory_id
            )
            .map((eq) => eq.inventory_id);

          if (accountableInventoryIds.length > 0) {
            const { error: clearanceInventoryError } = await supabase
              .from("clearance_inventory")
              .update({
                status: "Cleared",
                remarks: "Accountability settled - Equipment cleared",
                updated_at: new Date().toISOString(),
              })
              .eq("clearance_request_id", report.clearance_request_id)
              .in("inventory_id", accountableInventoryIds)
              .eq("status", "Pending");

            if (clearanceInventoryError) {
              console.error(
                "Error updating clearance inventory:",
                clearanceInventoryError
              );
              // Don't throw, continue with other updates
            }
          }

          // Also update the clearance request itself
          const { error: clearanceError } = await supabase
            .from("clearance_requests")
            .update({
              status: "Completed",
              completed_at: new Date().toISOString(),
              missing_amount: report.totalMissingAmount,
              updated_at: new Date().toISOString(),
              // Mark that accountability has been settled
              has_pending_accountability: false,
              pending_accountability_amount: 0,
            })
            .eq("id", report.clearance_request_id);

          if (clearanceError) {
            console.error("Clearance update error:", clearanceError);
          }
        }
      }

      // 3. Update summary table
      let summaryQuery = supabase
        .from("personnel_equipment_accountability_table")
        .update({
          accountability_status: "SETTLED",
          settlement_date: new Date().toISOString().split("T")[0],
          settlement_method: "Cash Payment",
          updated_at: new Date().toISOString(),
        })
        .eq("personnel_id", report.personnel_id);

      // Handle null clearance_request_id properly
      if (report.clearance_request_id) {
        summaryQuery = summaryQuery.eq(
          "clearance_request_id",
          report.clearance_request_id
        );
      } else {
        summaryQuery = summaryQuery.is("clearance_request_id", null);
      }

      const { error: summaryError } = await summaryQuery;

      if (summaryError) throw summaryError;

      // 4. Update local state
      setReports((prevReports) =>
        prevReports.map((r) => {
          if (
            r.personnel_id === report.personnel_id &&
            r.clearance_request_id === report.clearance_request_id
          ) {
            return {
              ...r,
              status: "Settled",
              missingEquipment: r.missingEquipment.map((eq) => ({
                ...eq,
                is_settled: true,
              })),
            };
          }
          return r;
        })
      );

      toast.success("Settlement approved successfully!");
    } catch (error) {
      console.error("Error approving settlement:", error);
      toast.error(`Failed to approve settlement: ${error.message}`);
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

  // Filter reports
  const filteredReports = reports.filter((report) => {
    const matchesStatus =
      filterStatus === "All" || report.status === filterStatus;
    const matchesType =
      filterClearanceType === "All" ||
      report.clearanceType === filterClearanceType;
    const matchesSearch =
      searchQuery === "" ||
      report.personnelName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.rank.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (report.badge_number &&
        report.badge_number.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesStatus && matchesType && matchesSearch;
  });

  // Filter by card selection (like inspectorinventorycontrol)
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

  // Only show personnel who failed inspection
  const failedInspections = cardFilteredReports.filter(
    (report) =>
      report.missingEquipment.length > 0 ||
      report.status === "Unsettled" ||
      (report.clearance_status && report.clearance_status !== "Completed")
  );

  // Pagination
  const totalPages = Math.max(
    1,
    Math.ceil(failedInspections.length / rowsPerPage)
  );
  const pageStart = (currentPage - 1) * rowsPerPage;
  const paginated = failedInspections.slice(pageStart, pageStart + rowsPerPage);

  // Pagination buttons
  const renderPaginationButtons = () => {
    const pageCount = Math.max(
      1,
      Math.ceil(failedInspections.length / rowsPerPage)
    );
    const hasNoData = failedInspections.length === 0;

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
      // 1. UPDATE INVENTORY STATUS (Physical equipment)
      if (equipmentItem.inventory_id) {
        const inventoryUpdate = {
          status: condition,
          last_checked: new Date().toISOString().split("T")[0],
          updated_at: new Date().toISOString(),
        };

        // If equipment was lost and found, update location
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

        console.log(
          `✅ Inventory updated: ${equipmentItem.name} → ${condition}`
        );
      }

      // 2. UPDATE ACCOUNTABILITY RECORD (Financial responsibility)
      const { error: accountabilityError } = await supabase
        .from("accountability_records")
        .update({
          is_settled: true,
          equipment_returned: true,
          return_date: new Date().toISOString().split("T")[0],
          return_remarks: returnDetails,
          settlement_date: new Date().toISOString().split("T")[0],
          settlement_method: "Equipment Returned",
          amount_paid: 0, // No payment for returns
          updated_at: new Date().toISOString(),
          record_type:
            equipmentItem.status === "LOST" ? "RETURNED" : "REPAIRED",
        })
        .eq("id", equipmentItem.accountability_id);

      if (accountabilityError) throw accountabilityError;

      console.log(`✅ Accountability record marked as returned`);

      // 3. UPDATE CLEARANCE INVENTORY (If part of clearance)
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
          // Don't throw, just log warning
        }
      }

      // 4. CREATE NEW INSPECTION RECORD FOR THE RETURN (Optional but good for audit)
      if (equipmentItem.inspection_id) {
        const { data: originalInspection, error: inspectionError } =
          await supabase
            .from("inspections")
            .select("*")
            .eq("id", equipmentItem.inspection_id)
            .single();

        if (!inspectionError && originalInspection) {
          const returnInspection = {
            equipment_id: equipmentItem.inventory_id,
            inspector_id: originalInspection.inspector_id || null,
            inspector_name: originalInspection.inspector_name || "System",
            schedule_inspection_date: new Date().toISOString().split("T")[0],
            reschedule_inspection_date: new Date().toISOString().split("T")[0],
            status: "COMPLETED",
            findings: `Equipment return: ${returnDetails}. Condition after return: ${condition}`,
            recommendations: `Equipment accountability cleared.`,
            inspection_date: new Date().toISOString().split("T")[0],
            assigned_to:
              condition === "Good" ? "Unassigned" : report.personnelName,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          await supabase.from("inspections").insert([returnInspection]);
        }
      }

      // 5. RECALCULATE ACCOUNTABILITY SUMMARY
      await recalculateAccountabilitySummary(
        report.personnel_id,
        report.clearance_request_id
      );

      // 6. UPDATE LOCAL STATE IMMEDIATELY
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
                  }
                : eq
            );

            // Check if all equipment is now settled
            const allSettled = updatedEquipment.every((eq) => eq.is_settled);

            // Recalculate outstanding amount
            const newOutstandingAmount = updatedEquipment.reduce(
              (sum, eq) => (eq.is_settled ? sum : sum + (eq.price || 0)),
              0
            );

            return {
              ...r,
              status: allSettled ? "Settled" : "Unsettled",
              missingEquipment: updatedEquipment,
              totalMissingAmount: newOutstandingAmount,
              // Update counts
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

      // Also update the modal if it's open
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

      // Optional: Reload data for complete refresh
      setTimeout(() => {
        loadAccountabilityData();
      }, 1500);
    } catch (error) {
      console.error("❌ Error returning equipment:", error);
      toast.error(`Failed to return equipment: ${error.message}`);
    }
  };

  // Add this helper function to recalculate accountability summary
  const recalculateAccountabilitySummary = async (
    personnelId,
    clearanceRequestId = null
  ) => {
    try {
      // Get all unsettled accountability records for this personnel
      const { data: records, error } = await supabase
        .from("accountability_records")
        .select(
          `
        id,
        amount_due,
        record_type,
        is_settled,
        equipment_returned,
        inventory:inventory_id(item_name, current_value)
      `
        )
        .eq("personnel_id", personnelId)
        .eq("is_settled", false)
        .in("record_type", ["LOST", "DAMAGED"]);

      if (error) throw error;

      let total_outstanding_amount = 0;
      let lost_equipment_count = 0;
      let damaged_equipment_count = 0;
      let lost_equipment_value = 0;
      let damaged_equipment_value = 0;

      records?.forEach((record) => {
        // Skip returned equipment
        if (record.equipment_returned) return;

        const amount =
          record.amount_due || record.inventory?.current_value || 0;
        total_outstanding_amount += amount;

        if (record.record_type === "LOST") {
          lost_equipment_count++;
          lost_equipment_value += amount;
        } else if (record.record_type === "DAMAGED") {
          damaged_equipment_count++;
          damaged_equipment_value += amount;
        }
      });

      // Update summary table
      const updateData = {
        total_outstanding_amount: total_outstanding_amount,
        lost_equipment_count: lost_equipment_count,
        damaged_equipment_count: damaged_equipment_count,
        lost_equipment_value: lost_equipment_value,
        damaged_equipment_value: damaged_equipment_value,
        accountability_status:
          total_outstanding_amount > 0 ? "UNSETTLED" : "SETTLED",
        updated_at: new Date().toISOString(),
      };

      let query = supabase
        .from("personnel_equipment_accountability_table")
        .update(updateData)
        .eq("personnel_id", personnelId);

      if (clearanceRequestId) {
        query = query.eq("clearance_request_id", clearanceRequestId);
      } else {
        query = query.is("clearance_request_id", null);
      }

      const { error: updateError } = await query;
      if (updateError) throw updateError;
    } catch (error) {
      console.error("Error recalculating accountability summary:", error);
      throw error;
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
              missingEquipment: r.missingEquipment.map((eq) => ({
                ...eq,
                is_settled: true,
                status: eq.status === "RETURNED" ? eq.status : "RETURNED",
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
        <h1>Personnel Equipment Accountability</h1>

        {/* Top Controls - Matching inspectorinventorycontrol */}
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

            <select
              className={styles.IIRFilterStatus}
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="All">All Status</option>
              <option value="Unsettled">Unsettled</option>
              <option value="Settled">Settled</option>
              <option value="In Progress">In Progress</option>
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

        {/* Summary Cards - Matching inspectorinventorycontrol */}
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
            <h3>Total Value</h3>
            <p>{formatCurrency(stats.totalMissingAmount)}</p>
          </button>
        </div>

        {/* Table Header Section - Matching inspectorinventorycontrol */}
        <div className={styles.IIRTableHeaderSection}>
          <h2 className={styles.IIRSHeaders}>Accountability Records</h2>
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

        {/* Scrollable Table Container - Matching inspectorinventorycontrol */}
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
                      <span className={styles.IIRAnimatedEmoji}>🔍</span>
                    </div>
                    <h3
                      style={{
                        fontSize: "18px",
                        fontWeight: "600",
                        color: "#2b2b2b",
                        marginBottom: "8px",
                      }}
                    >
                      No Accountability Records Found
                    </h3>
                    <p style={{ fontSize: "14px", color: "#999" }}>
                      No personnel with accountability issues available
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
                          >
                        
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className={styles.personnelInfoCell}>
                          <div className={styles.personnelNameRow}>
                            <strong className={styles.personnelFullName}>
                              {report.formattedName}
                            </strong>
                          </div>
                          {report.badge_number && (
                            <div className={styles.IIRBadgeNumber}>
                              Badge: {report.badge_number}
                            </div>
                          )}
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
                                ? "Settle All"
                                : "Approve"}
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
            Showing {failedInspections.length} personnel with accountability
            issues
            {stats.unsettled > 0 && (
              <span className={styles.combinedCount}>
                ({stats.unsettled} with combined accountability)
              </span>
            )}
          </div>
          <div className={styles.IIRTotalMissing}>
            <strong>Total Outstanding Value:</strong>{" "}
            {formatCurrency(
              failedInspections.reduce(
                (sum, report) => sum + report.totalMissingAmount,
                0
              )
            )}
          </div>
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
                      </div>
                      {selectedPersonnel.clearanceTypes &&
                        selectedPersonnel.clearanceTypes.length > 1 && (
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
                            </tr>
                          </thead>
                          {/* In the routine equipment section table body */}
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
                              <td></td>
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
                              <td></td>
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

                {/* Add Return All button */}
                {selectedPersonnel.status === "Unsettled" && (
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
                )}

                {selectedPersonnel.status === "Unsettled" && (
                  <button
                    className={styles.IIRApproveBtn}
                    onClick={() => {
                      setShowMissingModal(false);
                      approveSettlement(selectedPersonnel);
                    }}
                  >
                    {selectedPersonnel.hasCombinedAccountability
                      ? "Settle All"
                      : "Approve Settlement"}
                  </button>
                )}
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
                      <span>{selectedReport.clearanceType}</span>
                    </div>
                  </div>
                </div>

                <div className={styles.IIRViewModalSection}>
                  <h4 className={styles.IIRViewModalSectionTitle}>
                    Clearance Information
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
                      \
                      {selectedReport.clearanceTypes &&
                        selectedReport.clearanceTypes.length > 1 && (
                          <div className={styles.IIRViewModalField}>
                            <label>Clearance Types:</label>
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
