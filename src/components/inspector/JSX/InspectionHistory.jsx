// InspectionHistory.jsx
import React, { useState, useEffect, useMemo } from "react";
import styles from "../styles/InspectionHistory.module.css";
import { Title, Meta } from "react-head";
import InspectorSidebar from "../../InspectorSidebar";
import Hamburger from "../../Hamburger";
import { useSidebar } from "../../SidebarContext";
import { supabase } from "../../../lib/supabaseClient.js";
import {
  Search,
  Filter,
  Download,
  Calendar,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  FileText,
  User,
  Package,
  RefreshCw,
  UserX,
  CheckSquare,
  Trash2,
  Eye,
  AlertTriangle,
} from "lucide-react";

const InspectionHistory = () => {
  const { isSidebarCollapsed } = useSidebar();
  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Enhanced filter states
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedInspectionType, setSelectedInspectionType] = useState("all");
  const [selectedClearanceType, setSelectedClearanceType] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedPersonnel, setSelectedPersonnel] = useState("");
  const [showUnassignedOnly, setShowUnassignedOnly] = useState(false);

  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [exportLoading, setExportLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [personnelList, setPersonnelList] = useState([]);
  const [months, setMonths] = useState([]);
  const [years, setYears] = useState([]);
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [inspectionToDelete, setInspectionToDelete] = useState(null);

  const itemsPerPage = 20;

  // Initialize months and years
  useEffect(() => {
    // Initialize months
    const monthsArray = Array.from({ length: 12 }, (_, i) => ({
      value: String(i + 1).padStart(2, "0"),
      label: new Date(0, i).toLocaleString("en-US", { month: "long" }),
    }));
    setMonths(monthsArray);

    // Initialize years (current year and past 5 years)
    const currentYear = new Date().getFullYear();
    const yearOptions = [];
    for (let i = currentYear; i >= currentYear - 5; i--) {
      yearOptions.push(i.toString());
    }
    setYears(yearOptions);

    loadData();
    fetchPersonnel();
  }, []);

  const fetchPersonnel = async () => {
    try {
      // Check what columns exist in personnel table
      const { data, error } = await supabase
        .from("personnel")
        .select("id, first_name, last_name, badge_number, rank")
        .order("first_name");

      if (error) {
        console.error("Error fetching personnel:", error);
        // Try alternative column names
        const { data: altData, error: altError } = await supabase
          .from("personnel")
          .select("*")
          .limit(1);

        if (altError) {
          console.error("Cannot fetch personnel table:", altError);
          return;
        }

        console.log("Personnel table columns:", Object.keys(altData[0]));
        // Based on the columns, adjust the query
        const columnNames = Object.keys(altData[0]);
        const nameColumn = columnNames.find((col) => col.includes("name"));

        const { data: finalData, error: finalError } = await supabase
          .from("personnel")
          .select("id, badge_number, rank")
          .order(nameColumn || "id");

        if (finalError) throw finalError;

        // Create display names from available columns
        const formattedData = finalData.map((p) => ({
          ...p,
          display_name: nameColumn
            ? p[nameColumn]
            : `Personnel ${p.id.substring(0, 8)}`,
        }));

        setPersonnelList(formattedData || []);
        return;
      }

      // Format data with display name
      const formattedData = (data || []).map((person) => ({
        ...person,
        display_name:
          `${person.first_name || ""} ${person.last_name || ""}`.trim() ||
          `Personnel ${person.id.substring(0, 8)}`,
      }));

      setPersonnelList(formattedData);
    } catch (error) {
      console.error("Error fetching personnel:", error);
    }
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      console.log("Loading inspection history data...");

      // Try to get from monthly history first
      const { data: historyData, error: historyError } = await supabase
        .from("inspection_history_monthly")
        .select("*")
        .order("inspection_date", { ascending: false });

      if (!historyError && historyData && historyData.length > 0) {
        console.log(
          `Loaded ${historyData.length} records from monthly history`
        );
        setInspections(historyData);
      } else {
        // Fallback to real-time inspection data
        await fetchRealTimeInspections();
      }
    } catch (error) {
      console.error("Error in loadData:", error);
      setError(`Failed to load data: ${error.message}`);
    } finally {
      setLoading(false);
      // Clear any selections
      setSelectedRows(new Set());
    }
  };

  const fetchRealTimeInspections = async () => {
    try {
      console.log("Fetching real-time inspection data...");

      // Since there are foreign key relationship issues, let's fetch data separately
      // and combine it manually

      // 1. Fetch inspections
      const { data: inspectionData, error: inspectionError } = await supabase
        .from("inspections")
        .select("*")
        .order("created_at", { ascending: false });

      if (inspectionError) throw inspectionError;

      // 2. Fetch equipment data for inspections
      const equipmentIds = [
        ...new Set(inspectionData?.map((i) => i.equipment_id).filter(Boolean)),
      ];
      let equipmentMap = {};

      if (equipmentIds.length > 0) {
        const { data: equipmentData, error: equipmentError } = await supabase
          .from("inventory")
          .select("*")
          .in("id", equipmentIds);

        if (!equipmentError) {
          equipmentData?.forEach((item) => {
            equipmentMap[item.id] = item;
          });
        }
      }

      // 3. Fetch personnel data for inspectors
      const inspectorIds = [
        ...new Set(inspectionData?.map((i) => i.inspector_id).filter(Boolean)),
      ];
      let inspectorMap = {};

      if (inspectorIds.length > 0) {
        const { data: personnelData, error: personnelError } = await supabase
          .from("personnel")
          .select(
            "id, first_name, last_name, middle_name, suffix, badge_number, rank"
          )
          .in("id", inspectorIds);

        if (!personnelError) {
          personnelData?.forEach((person) => {
            // Build full name
            const firstName = person.first_name || "";
            const middleName = person.middle_name || "";
            const lastName = person.last_name || "";
            const suffix = person.suffix || "";

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

            inspectorMap[person.id] = {
              ...person,
              full_name: fullName,
              formatted_name: formattedName,
            };
          });
        }
      }

      // 4. Fetch clearance requests
      const clearanceRequestIds = [
        ...new Set(
          inspectionData?.map((i) => i.clearance_request_id).filter(Boolean)
        ),
      ];
      let clearanceMap = {};

      if (clearanceRequestIds.length > 0) {
        const { data: clearanceData, error: clearanceError } = await supabase
          .from("clearance_requests")
          .select("*")
          .in("id", clearanceRequestIds);

        if (!clearanceError) {
          clearanceData?.forEach((req) => {
            clearanceMap[req.id] = req;
          });
        }
      }

      // 5. Fetch ALL personnel to map assigned personnel
      const { data: allPersonnelData, error: allPersonnelError } =
        await supabase
          .from("personnel")
          .select(
            "id, first_name, last_name, middle_name, suffix, badge_number, rank"
          );

      let personnelMap = {};
      if (!allPersonnelError && allPersonnelData) {
        allPersonnelData.forEach((person) => {
          // Build full name for each personnel
          const firstName = person.first_name || "";
          const middleName = person.middle_name || "";
          const lastName = person.last_name || "";
          const suffix = person.suffix || "";

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

          personnelMap[person.id] = {
            ...person,
            full_name: fullName,
            formatted_name: formattedName,
          };
        });
      }

      // Transform inspection data
      const transformedInspections = (inspectionData || []).map(
        (inspection) => {
          const equipment = equipmentMap[inspection.equipment_id];
          const inspector = inspectorMap[inspection.inspector_id];
          const clearanceRequest =
            clearanceMap[inspection.clearance_request_id];

          // Get inspector name
          let inspectorName = inspection.inspector_name;
          if (!inspectorName && inspector) {
            inspectorName =
              inspector.formatted_name ||
              inspector.full_name ||
              `Inspector ${inspector.id.substring(0, 8)}`;
          }

          // Get assigned personnel info from equipment
          let assignedPersonnel = null;
          let personnelName = "Unassigned";
          let formattedPersonnelName = "Unassigned";

          if (equipment?.assigned_personnel_id) {
            assignedPersonnel = personnelMap[equipment.assigned_personnel_id];
            if (assignedPersonnel) {
              personnelName = assignedPersonnel.full_name;
              formattedPersonnelName = assignedPersonnel.formatted_name;
            } else {
              // If personnel not found in map, show generic
              personnelName = `Personnel ${equipment.assigned_personnel_id.substring(
                0,
                8
              )}`;
              formattedPersonnelName = personnelName;
            }
          }

          return {
            id: inspection.id,
            inspection_date:
              inspection.inspection_date || inspection.schedule_inspection_date,
            equipment_id: inspection.equipment_id,
            item_name: equipment?.item_name,
            item_code: equipment?.item_code,
            inspector_name: inspectorName,
            assigned_to: inspection.assigned_to || equipment?.assigned_to,
            assigned_personnel_id: equipment?.assigned_personnel_id,
            personnel_name: personnelName,
            formatted_personnel_name: formattedPersonnelName,
            personnel_rank: assignedPersonnel?.rank,
            personnel_badge:
              assignedPersonnel?.badge_number || equipment?.badge_number,
            clearance_type: clearanceRequest?.type,
            clearance_request_id: inspection.clearance_request_id,
            inspection_type: inspection.clearance_request_id
              ? "CLEARANCE"
              : "ROUTINE",
            status: inspection.status,
            findings: inspection.findings,
            recommendations: inspection.recommendations,
            notes: inspection.notes,
            equipment_status: equipment?.status,
            is_unassigned:
              inspection.assigned_to === "Unassigned" ||
              !equipment?.assigned_personnel_id ||
              equipment.assigned_to === "Unassigned",
            has_clearance: !!inspection.clearance_request_id,
            record_type: "INSPECTION",
            source: "inspections",
            created_at: inspection.created_at,
          };
        }
      );

      // 6. Fetch clearance_inventory records
      const { data: clearanceData, error: clearanceError } = await supabase
        .from("clearance_inventory")
        .select(
          `
        *,
        inventory(*),
        clearance_request:clearance_requests(*)
      `
        )
        .not("inspection_date", "is", null)
        .order("inspection_date", { ascending: false });

      if (clearanceError) {
        console.error("Error fetching clearance inventory:", clearanceError);
      }

      // Transform clearance inventory data
      const transformedClearances = (clearanceData || []).map((ci) => {
        // Get personnel name from personnel_id using personnelMap
        let personnelName = "Unassigned";
        let formattedPersonnelName = "Unassigned";

        if (ci.personnel_id && personnelMap[ci.personnel_id]) {
          const personnel = personnelMap[ci.personnel_id];
          personnelName = personnel.full_name;
          formattedPersonnelName = personnel.formatted_name;
        } else if (ci.personnel_id) {
          personnelName = `Personnel ${ci.personnel_id.substring(0, 8)}`;
          formattedPersonnelName = personnelName;
        }

        return {
          id: ci.id,
          inspection_date: ci.inspection_date,
          equipment_id: ci.inventory_id,
          item_name: ci.inventory?.item_name,
          item_code: ci.inventory?.item_code,
          inspector_name: ci.inspector_name || "Unknown Inspector",
          assigned_to: ci.inventory?.assigned_to,
          assigned_personnel_id: ci.personnel_id,
          personnel_name: personnelName,
          formatted_personnel_name: formattedPersonnelName,
          personnel_rank: personnelMap[ci.personnel_id]?.rank,
          personnel_badge:
            personnelMap[ci.personnel_id]?.badge_number ||
            ci.inventory?.badge_number,
          clearance_type: ci.clearance_request?.type,
          clearance_request_id: ci.clearance_request_id,
          inspection_type: "CLEARANCE",
          status: ci.status,
          findings: ci.findings,
          notes: ci.remarks,
          equipment_status: ci.inventory?.status,
          is_unassigned: false,
          has_clearance: true,
          record_type: "CLEARANCE",
          source: "clearance_inventory",
          created_at: ci.created_at,
        };
      });

      // Combine and sort by date
      const combinedData = [...transformedInspections, ...transformedClearances]
        .filter((item) => item.inspection_date) // Filter out items without dates
        .sort(
          (a, b) => new Date(b.inspection_date) - new Date(a.inspection_date)
        );

      console.log(`Total records loaded: ${combinedData.length}`);
      setInspections(combinedData);
    } catch (error) {
      console.error("Error fetching real-time inspections:", error);
      setError(`Error fetching inspections: ${error.message}`);
    }
  };
  // Handle row selection
  const toggleRowSelection = (id) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedRows(newSelected);
  };

  // Select all rows on current page
  const selectAllRows = () => {
    const newSelected = new Set(selectedRows);
    const currentPageIds = paginatedInspections.map((item) => item.id);

    // If all current page items are already selected, deselect them
    const allSelected = currentPageIds.every((id) => newSelected.has(id));

    if (allSelected) {
      currentPageIds.forEach((id) => newSelected.delete(id));
    } else {
      currentPageIds.forEach((id) => newSelected.add(id));
    }

    setSelectedRows(newSelected);
  };

  // Delete selected records
  const deleteSelectedRecords = async () => {
    if (selectedRows.size === 0) {
      setError("Please select at least one record to delete");
      return;
    }

    if (
      !window.confirm(
        `Are you sure you want to delete ${selectedRows.size} record(s)? This action cannot be undone.`
      )
    ) {
      return;
    }

    setDeleteLoading(true);
    setError(null);

    try {
      const recordsToDelete = Array.from(selectedRows);
      let deletedCount = 0;
      let errors = [];

      // Delete records from their respective source tables
      for (const recordId of recordsToDelete) {
        const record = inspections.find((r) => r.id === recordId);
        if (!record) continue;

        try {
          // Determine which table to delete from based on source
          if (record.source === "inspections") {
            const { error } = await supabase
              .from("inspections")
              .delete()
              .eq("id", recordId);

            if (error) throw error;
          } else if (record.source === "clearance_inventory") {
            const { error } = await supabase
              .from("clearance_inventory")
              .delete()
              .eq("id", recordId);

            if (error) throw error;
          }
          deletedCount++;
        } catch (error) {
          errors.push(
            `Failed to delete record ${recordId.substring(0, 8)}: ${
              error.message
            }`
          );
        }
      }

      if (errors.length > 0) {
        setError(
          `Deleted ${deletedCount} records, but encountered errors: ${errors.join(
            ", "
          )}`
        );
      } else {
        setSuccessMessage(`Successfully deleted ${deletedCount} record(s)`);
      }

      // Refresh data
      await loadData();
    } catch (error) {
      console.error("Error deleting records:", error);
      setError(`Failed to delete records: ${error.message}`);
    } finally {
      setDeleteLoading(false);
      setSelectedRows(new Set());
    }
  };

  // Delete single record
  const deleteSingleRecord = async (recordId, recordName = "record") => {
    if (
      !window.confirm(
        `Are you sure you want to delete this ${recordName}? This action cannot be undone.`
      )
    ) {
      return;
    }

    setDeleteLoading(true);
    setError(null);

    try {
      const record = inspections.find((r) => r.id === recordId);
      if (!record) {
        throw new Error("Record not found");
      }

      // Determine which table to delete from based on source
      let deleteError;
      if (record.source === "inspections") {
        const { error } = await supabase
          .from("inspections")
          .delete()
          .eq("id", recordId);
        deleteError = error;
      } else if (record.source === "clearance_inventory") {
        const { error } = await supabase
          .from("clearance_inventory")
          .delete()
          .eq("id", recordId);
        deleteError = error;
      }

      if (deleteError) throw deleteError;

      setSuccessMessage(`Successfully deleted ${recordName}`);

      // Refresh data
      await loadData();
    } catch (error) {
      console.error("Error deleting record:", error);
      setError(`Failed to delete record: ${error.message}`);
    } finally {
      setDeleteLoading(false);
      setShowDeleteConfirm(false);
      setInspectionToDelete(null);
    }
  };

  const filteredInspections = useMemo(() => {
    return inspections.filter((inspection) => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        searchTerm === "" ||
        (inspection.item_name?.toLowerCase() || "").includes(searchLower) ||
        (inspection.item_code?.toLowerCase() || "").includes(searchLower) ||
        (inspection.personnel_name?.toLowerCase() || "").includes(
          searchLower
        ) ||
        (inspection.badge_number?.toLowerCase() || "").includes(searchLower) ||
        (inspection.inspector_name?.toLowerCase() || "").includes(
          searchLower
        ) ||
        (inspection.findings?.toLowerCase() || "").includes(searchLower);

      const matchesStatus =
        selectedStatus === "all" || inspection.status === selectedStatus;

      const matchesInspectionType =
        selectedInspectionType === "all" ||
        (selectedInspectionType === "clearance"
          ? inspection.has_clearance
          : !inspection.has_clearance);

      const matchesClearanceType =
        selectedClearanceType === "all" ||
        inspection.clearance_type === selectedClearanceType;

      const inspectionDate = inspection.inspection_date
        ? new Date(inspection.inspection_date)
        : null;
      let matchesDate = true;

      // Apply month filter
      if (selectedMonth && inspectionDate) {
        const month = (inspectionDate.getMonth() + 1)
          .toString()
          .padStart(2, "0");
        if (month !== selectedMonth) {
          matchesDate = false;
        }
      }

      // Apply year filter
      if (selectedYear && inspectionDate) {
        const year = inspectionDate.getFullYear().toString();
        if (year !== selectedYear) {
          matchesDate = false;
        }
      }

      // Apply date range filter
      if (dateRange.start || dateRange.end) {
        if (!inspectionDate) {
          matchesDate = false;
        } else {
          const startDate = dateRange.start ? new Date(dateRange.start) : null;
          const endDate = dateRange.end ? new Date(dateRange.end) : null;

          if (startDate) startDate.setHours(0, 0, 0, 0);
          if (endDate) endDate.setHours(23, 59, 59, 999);

          if (startDate && endDate) {
            matchesDate =
              inspectionDate >= startDate && inspectionDate <= endDate;
          } else if (startDate) {
            matchesDate = inspectionDate >= startDate;
          } else if (endDate) {
            matchesDate = inspectionDate <= endDate;
          }
        }
      }

      // Apply personnel filter
      const matchesPersonnel =
        !selectedPersonnel ||
        inspection.assigned_personnel_id === selectedPersonnel ||
        inspection.personnel_name
          ?.toLowerCase()
          .includes(selectedPersonnel.toLowerCase());

      // Apply unassigned filter
      const matchesUnassigned = !showUnassignedOnly || inspection.is_unassigned;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesInspectionType &&
        matchesClearanceType &&
        matchesDate &&
        matchesPersonnel &&
        matchesUnassigned
      );
    });
  }, [
    inspections,
    searchTerm,
    selectedStatus,
    selectedInspectionType,
    selectedClearanceType,
    selectedMonth,
    selectedYear,
    dateRange,
    selectedPersonnel,
    showUnassignedOnly,
  ]);

  // Paginated data
  const paginatedInspections = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredInspections.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredInspections, currentPage]);

  const totalPages = Math.ceil(filteredInspections.length / itemsPerPage);

  const getStatusBadgeClass = (status) => {
    if (!status) return styles.statusDefault;

    const statusUpper = status.toUpperCase();
    if (statusUpper.includes("PENDING")) return styles.statusPending;
    if (statusUpper.includes("PROGRESS")) return styles.statusInProgress;
    if (statusUpper.includes("COMPLETED") || statusUpper.includes("CLEARED"))
      return styles.statusCompleted;
    if (statusUpper.includes("FAILED")) return styles.statusRejected;
    if (statusUpper.includes("CANCELLED")) return styles.statusCancelled;
    return styles.statusDefault;
  };

  const getStatusIcon = (status) => {
    const statusUpper = status?.toUpperCase() || "";
    if (statusUpper.includes("COMPLETED") || statusUpper.includes("CLEARED")) {
      return <CheckCircle size={16} />;
    }
    if (statusUpper.includes("FAILED") || statusUpper.includes("CANCELLED")) {
      return <XCircle size={16} />;
    }
    if (statusUpper.includes("PENDING")) {
      return <Clock size={16} />;
    }
    if (statusUpper.includes("PROGRESS")) {
      return <AlertCircle size={16} />;
    }
    return <FileText size={16} />;
  };

  const getClearanceIcon = (clearanceType) => {
    if (!clearanceType) return <FileText size={16} />;

    switch (clearanceType.toUpperCase()) {
      case "RESIGNATION":
        return <UserX size={16} />;
      case "RETIREMENT":
        return <User size={16} />;
      case "EQUIPMENT COMPLETION":
        return <CheckSquare size={16} />;
      default:
        return <FileText size={16} />;
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return "";
      return d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch (e) {
      return "";
    }
  };

  const exportToCSV = async () => {
    setExportLoading(true);
    try {
      const data = filteredInspections;

      if (data.length === 0) {
        alert("No data to export!");
        return;
      }

      const headers = [
        "Inspection Date",
        "Item Code",
        "Item Name",
        "Personnel Name",
        "Rank",
        "Badge Number",
        "Inspector",
        "Inspection Type",
        "Clearance Type",
        "Status",
        "Findings",
        "Equipment Status",
        "Is Unassigned",
      ];

      let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
      csvContent += headers.join(",") + "\n";

      data.forEach((item) => {
        const row = [
          formatDate(item.inspection_date).replace(/"/g, '""'),
          item.item_code?.replace(/"/g, '""') || "",
          item.item_name?.replace(/"/g, '""') || "",
          item.formatted_personnel_name?.replace(/"/g, '""') ||
            item.personnel_name?.replace(/"/g, '""') ||
            "Unassigned",
          item.personnel_rank?.replace(/"/g, '""') || "",
          item.personnel_badge?.replace(/"/g, '""') || "",
          item.inspector_name?.replace(/"/g, '""') || "",
          item.inspection_type?.replace(/"/g, '""') || "",
          item.clearance_type?.replace(/"/g, '""') || "",
          item.status?.replace(/"/g, '""') || "",
          item.findings?.replace(/"/g, '""') || "",
          item.equipment_status?.replace(/"/g, '""') || "",
          item.is_unassigned ? "Yes" : "No",
        ]
          .map((field) => `"${field}"`)
          .join(",");

        csvContent += row + "\n";
      });

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute(
        "download",
        `inspection_history_${new Date().toISOString().split("T")[0]}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      alert(`Exported ${data.length} records to CSV successfully!`);
    } catch (error) {
      console.error("Error exporting data:", error);
      alert(`Failed to export data: ${error.message}`);
    } finally {
      setExportLoading(false);
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedStatus("all");
    setSelectedInspectionType("all");
    setSelectedClearanceType("all");
    setSelectedMonth("");
    setSelectedYear("");
    setSelectedPersonnel("");
    setShowUnassignedOnly(false);
    setDateRange({ start: "", end: "" });
    setCurrentPage(1);
    setSelectedRows(new Set());
  };

  const getUniqueStatuses = () => {
    return [...new Set(inspections.map((item) => item.status).filter(Boolean))];
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  // Calculate statistics
  const stats = useMemo(() => {
    const total = inspections.length;
    const routine = inspections.filter((i) => !i.has_clearance).length;
    const clearance = inspections.filter((i) => i.has_clearance).length;
    const unassigned = inspections.filter((i) => i.is_unassigned).length;
    const completed = inspections.filter(
      (i) =>
        i.status &&
        (i.status.toUpperCase().includes("COMPLETED") ||
          i.status.toUpperCase().includes("CLEARED"))
    ).length;

    return { total, routine, clearance, unassigned, completed };
  }, [inspections]);

  if (loading) {
    return (
      <div className="AppInspectorInventoryControl">
        <InspectorSidebar />
        <Hamburger />
        <div
          className={`main-content ${isSidebarCollapsed ? "collapsed" : ""}`}
        >
          <div className={styles.loadingContainer}>
            <RefreshCw size={48} className={styles.spinningIcon} />
            <h2>Loading Inspection History...</h2>
            <p>Please wait while we load the historical data.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="AppInspectorInventoryControl">
      <Title>Inspection History | BFP Villanueva</Title>
      <Meta name="robots" content="noindex, nofollow" />
      <InspectorSidebar />
      <Hamburger />
      <div className={`main-content ${isSidebarCollapsed ? "collapsed" : ""}`}>
        <section className={styles.IHSection}>
          <div className={styles.IHSectionHeader}>
            <h2>
              <FileText size={28} className={styles.headerIcon} />
              Inspection History & Audit Logs
            </h2>
            <div className={styles.headerActions}>
              <button
                className={`${styles.IHBtn} ${styles.IHRefresh}`}
                onClick={loadData}
                disabled={loading || deleteLoading}
              >
                <RefreshCw
                  size={16}
                  className={loading ? styles.spinningIcon : ""}
                />
                Refresh Data
              </button>
              {selectedRows.size > 0 && (
                <button
                  className={`${styles.IHBtn} ${styles.IHDelete}`}
                  onClick={deleteSelectedRecords}
                  disabled={deleteLoading}
                >
                  <Trash2 size={16} />
                  {deleteLoading
                    ? "Deleting..."
                    : `Delete (${selectedRows.size})`}
                </button>
              )}
              <button
                className={`${styles.IHBtn} ${styles.IHExport}`}
                onClick={exportToCSV}
                disabled={exportLoading || filteredInspections.length === 0}
              >
                <Download size={16} />
                {exportLoading ? "Exporting..." : "Export CSV"}
              </button>
            </div>
          </div>

          {error && (
            <div className={styles.errorAlert}>
              <AlertCircle size={20} />
              <span>{error}</span>
              <button onClick={() => setError(null)}>×</button>
            </div>
          )}

          {successMessage && (
            <div className={styles.successAlert}>
              <CheckCircle size={20} />
              <span>{successMessage}</span>
              <button onClick={() => setSuccessMessage(null)}>×</button>
            </div>
          )}

          <div className={styles.statsSummary}>
            <div className={styles.statCard}>
              <div className={styles.statIcon}>
                <FileText size={24} />
              </div>
              <span className={styles.statNumber}>{stats.total}</span>
              <span className={styles.statLabel}>Total Inspections</span>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statIcon}>
                <CheckCircle size={24} />
              </div>
              <span className={styles.statNumber}>{stats.completed}</span>
              <span className={styles.statLabel}>Completed</span>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statIcon}>
                <Package size={24} />
              </div>
              <span className={styles.statNumber}>{stats.routine}</span>
              <span className={styles.statLabel}>Routine Inspections</span>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statIcon}>
                <User size={24} />
              </div>
              <span className={styles.statNumber}>{stats.clearance}</span>
              <span className={styles.statLabel}>Clearance Inspections</span>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statIcon}>
                <UserX size={24} />
              </div>
              <span className={styles.statNumber}>{stats.unassigned}</span>
              <span className={styles.statLabel}>Unassigned</span>
            </div>
          </div>

          <div className={styles.filtersContainer}>
            {/* Search */}
            <div className={styles.searchBox}>
              <Search size={18} className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Search equipment, personnel, inspector..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className={styles.searchInput}
              />
            </div>

            {/* Status Filter */}
            <div className={styles.filterGroup}>
              <Filter size={16} />
              <select
                className={styles.filterSelect}
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="all">All Status</option>
                {getUniqueStatuses().map((status, index) => (
                  <option key={index} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            {/* Inspection Type Filter */}
            <div className={styles.filterGroup}>
              <select
                className={styles.filterSelect}
                value={selectedInspectionType}
                onChange={(e) => {
                  setSelectedInspectionType(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="all">All Inspection Types</option>
                <option value="routine">Routine Only</option>
                <option value="clearance">Clearance Only</option>
              </select>
            </div>

            {/* Clearance Type Filter */}
            <div className={styles.filterGroup}>
              <select
                className={styles.filterSelect}
                value={selectedClearanceType}
                onChange={(e) => {
                  setSelectedClearanceType(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="all">All Clearance Types</option>
                <option value="Resignation">Resignation</option>
                <option value="Retirement">Retirement</option>
                <option value="Equipment Completion">
                  Equipment Completion
                </option>
              </select>
            </div>

            {/* Month Filter */}
            <div className={styles.filterGroup}>
              <select
                className={styles.filterSelect}
                value={selectedMonth}
                onChange={(e) => {
                  setSelectedMonth(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="">All Months</option>
                {months.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Year Filter */}
            <div className={styles.filterGroup}>
              <select
                className={styles.filterSelect}
                value={selectedYear}
                onChange={(e) => {
                  setSelectedYear(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="">All Years</option>
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            {/* Personnel Filter */}
            <div className={styles.filterGroup}>
              <User size={16} />
              <select
                className={styles.filterSelect}
                value={selectedPersonnel}
                onChange={(e) => {
                  setSelectedPersonnel(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="">All Personnel</option>
                {personnelList.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.display_name}{" "}
                    {person.badge_number ? `(${person.badge_number})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range Filter */}
            <div className={styles.filterGroup}>
              <Calendar size={16} />
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => {
                  setDateRange((prev) => ({ ...prev, start: e.target.value }));
                  setCurrentPage(1);
                }}
                className={styles.dateInput}
                max={dateRange.end || new Date().toISOString().split("T")[0]}
              />
              <span className={styles.dateSeparator}>to</span>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => {
                  setDateRange((prev) => ({ ...prev, end: e.target.value }));
                  setCurrentPage(1);
                }}
                className={styles.dateInput}
                min={dateRange.start}
                max={new Date().toISOString().split("T")[0]}
              />
            </div>

            {/* Unassigned Toggle */}
            <div className={styles.filterToggle}>
              <label className={styles.toggleLabel}>
                <input
                  type="checkbox"
                  checked={showUnassignedOnly}
                  onChange={(e) => {
                    setShowUnassignedOnly(e.target.checked);
                    setCurrentPage(1);
                  }}
                  className={styles.toggleInput}
                />
                <span className={styles.toggleSlider}></span>
                <span className={styles.toggleText}>Show Unassigned Only</span>
              </label>
            </div>

            {/* Clear Filters Button */}
            <button
              className={`${styles.IHBtn} ${styles.IHClear}`}
              onClick={clearFilters}
              disabled={deleteLoading}
            >
              Clear Filters
            </button>
          </div>

          <div className={styles.resultsCount}>
            Showing {filteredInspections.length} of {inspections.length} records
            {selectedMonth &&
              ` for ${months.find((m) => m.value === selectedMonth)?.label}`}
            {selectedYear && ` ${selectedYear}`}
            {selectedRows.size > 0 && (
              <span className={styles.selectedCount}>
                • {selectedRows.size} selected
              </span>
            )}
          </div>

          <div className={styles.tableContainer}>
            {filteredInspections.length === 0 ? (
              <div className={styles.noDataMessage}>
                <FileText size={48} className={styles.noDataIcon} />
                <h3>No inspection records found</h3>
                <p>Try adjusting your filters or search terms.</p>
              </div>
            ) : (
              <>
                <table className={styles.IHTable}>
                  <thead>
                    <tr>
                      <th style={{ width: "40px" }}>
                        <input
                          type="checkbox"
                          checked={
                            paginatedInspections.length > 0 &&
                            paginatedInspections.every((item) =>
                              selectedRows.has(item.id)
                            )
                          }
                          onChange={selectAllRows}
                          className={styles.selectAllCheckbox}
                        />
                      </th>
                      <th>Date</th>
                      <th>Item Details</th>
                      <th>Personnel</th>
                      <th>Inspector</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Clearance Type</th>
                      <th>Findings</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedInspections.map((inspection, index) => (
                      <tr
                        key={`${inspection.id}-${inspection.source}-${index}`}
                      >
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedRows.has(inspection.id)}
                            onChange={() => toggleRowSelection(inspection.id)}
                            className={styles.rowCheckbox}
                          />
                        </td>
                        <td>
                          <div className={styles.dateCell}>
                            <Calendar size={12} />
                            {formatDate(inspection.inspection_date)}
                          </div>
                        </td>
                        <td>
                          <div className={styles.itemCell}>
                            <strong>
                              {inspection.item_name || "Unknown Item"}
                            </strong>
                            <div className={styles.itemCode}>
                              <code>{inspection.item_code || "No Code"}</code>
                            </div>
                          </div>
                        </td>
                        <td>
                          {inspection.is_unassigned ? (
                            <span className={styles.unassignedBadge}>
                              <UserX size={14} />
                              Unassigned
                            </span>
                          ) : (
                            <div className={styles.personnelCell}>
                              <User size={14} className={styles.cellIcon} />
                              <div>
                                <strong>
                                  {inspection.formatted_personnel_name ||
                                    inspection.personnel_name ||
                                    "Unknown"}
                                </strong>
                                <div className={styles.personnelDetails}>
                                  {inspection.personnel_rank && (
                                    <span className={styles.rankBadge}>
                                      {inspection.personnel_rank}
                                    </span>
                                  )}
                                  {inspection.personnel_badge && (
                                    <>
                                      <span className={styles.badgeSeparator}>
                                        •
                                      </span>
                                      <span>
                                        Badge: {inspection.personnel_badge}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </td>
                        <td>
                          <div className={styles.inspectorCell}>
                            <User size={14} className={styles.cellIcon} />
                            {inspection.inspector_name || "Unknown"}
                          </div>
                        </td>
                        <td>
                          <span
                            className={`${styles.typeBadge} ${
                              inspection.has_clearance
                                ? styles.clearanceBadge
                                : styles.routineBadge
                            }`}
                          >
                            {inspection.has_clearance ? "CLEARANCE" : "ROUTINE"}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`${
                              styles.statusBadge
                            } ${getStatusBadgeClass(inspection.status)}`}
                          >
                            {getStatusIcon(inspection.status)}
                            {inspection.status || "PENDING"}
                          </span>
                        </td>
                        <td>
                          {inspection.clearance_type ? (
                            <div className={styles.clearanceCell}>
                              {getClearanceIcon(inspection.clearance_type)}
                              <span>{inspection.clearance_type}</span>
                            </div>
                          ) : (
                            <span className={styles.naText}>N/A</span>
                          )}
                        </td>
                        <td className={styles.findingsCell}>
                          {inspection.findings || "No findings"}
                        </td>
                        <td>
                          <div className={styles.actionButtons}>
                            <button
                              className={`${styles.IHBtn} ${styles.IHView}`}
                              onClick={() => {
                                const details = `
Inspection Details:
────────────────────
Date: ${formatDate(inspection.inspection_date)}
Item: ${inspection.item_name} (${inspection.item_code})
Personnel: ${inspection.personnel_name || "Unassigned"}
Badge: ${inspection.badge_number || "N/A"}
Inspector: ${inspection.inspector_name}
Type: ${inspection.has_clearance ? "Clearance" : "Routine"}
Clearance Type: ${inspection.clearance_type || "N/A"}
Status: ${inspection.status}
Equipment Status: ${inspection.equipment_status}
Findings: ${inspection.findings || "None"}
Notes: ${inspection.notes || "None"}
────────────────────
Record Type: ${inspection.record_type}
Source: ${inspection.source}
                                `.trim();
                                alert(details);
                              }}
                              title="View Details"
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              className={`${styles.IHBtn} ${styles.IHDeleteSingle}`}
                              onClick={() =>
                                deleteSingleRecord(
                                  inspection.id,
                                  `inspection of ${
                                    inspection.item_name || "unknown item"
                                  }`
                                )
                              }
                              disabled={deleteLoading}
                              title="Delete Record"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {totalPages > 1 && (
                  <div className={styles.pagination}>
                    <div className={styles.paginationInfo}>
                      Showing{" "}
                      {Math.min(
                        (currentPage - 1) * itemsPerPage + 1,
                        filteredInspections.length
                      )}{" "}
                      to{" "}
                      {Math.min(
                        currentPage * itemsPerPage,
                        filteredInspections.length
                      )}{" "}
                      of {filteredInspections.length} entries
                      {selectedRows.size > 0 && (
                        <span className={styles.selectedInfo}>
                          • {selectedRows.size} selected
                        </span>
                      )}
                    </div>
                    <div className={styles.paginationControls}>
                      <button
                        className={styles.paginationButton}
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1 || deleteLoading}
                      >
                        Previous
                      </button>
                      {Array.from(
                        { length: Math.min(5, totalPages) },
                        (_, i) => {
                          let pageNum;
                          if (totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i;
                          } else {
                            pageNum = currentPage - 2 + i;
                          }
                          return (
                            <button
                              key={pageNum}
                              className={`${styles.paginationButton} ${
                                currentPage === pageNum ? styles.active : ""
                              }`}
                              onClick={() => handlePageChange(pageNum)}
                              disabled={deleteLoading}
                            >
                              {pageNum}
                            </button>
                          );
                        }
                      )}
                      <button
                        className={styles.paginationButton}
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages || deleteLoading}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default InspectionHistory;
