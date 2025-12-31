import { useState, useEffect, useRef, useMemo } from "react";
import styles from "../styles/InspectorEquipmentInspection.module.css";
import { Title, Meta } from "react-head";
import Flatpickr from "react-flatpickr";
import "flatpickr/dist/flatpickr.css";
import InspectorSidebar from "../../InspectorSidebar";
import Hamburger from "../../Hamburger";
import { useSidebar } from "../../SidebarContext";
import { supabase } from "../../../lib/supabaseClient";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Html5QrcodeScanner } from "html5-qrcode";

const InspectorEquipmentInspection = () => {
  const { isSidebarCollapsed } = useSidebar();
  const [recentInspections, setRecentInspections] = useState([]);
  const [scheduledInspections, setScheduledInspections] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [pendingClearances, setPendingClearances] = useState([]);
  const [personnelList, setPersonnelList] = useState([]);
  const [pendingInspectionsMap, setPendingInspectionsMap] = useState({});

  const [recentSearch, setRecentSearch] = useState("");
  const [recentFilterCategory, setRecentFilterCategory] = useState("");
  const [recentFilterStatus, setRecentFilterStatus] = useState("");
  const [recentFilterResult, setRecentFilterResult] = useState("");
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [showCheckupModal, setShowCheckupModal] = useState(false);
  const [showInspectModal, setShowInspectModal] = useState(false);
  const [showClearanceModal, setShowClearanceModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);

  const [selectedClearance, setSelectedClearance] = useState(null);
  const [selectedEquipment, setSelectedEquipment] = useState([]);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  // View Details Modal State for Recent Inspections
  const [isRecentViewModalOpen, setIsRecentViewModalOpen] = useState(false);
  const [selectedRecentInspection, setSelectedRecentInspection] =
    useState(null);
  // Pagination states
  const [scheduledCurrentPage, setScheduledCurrentPage] = useState(1);
  const [recentCurrentPage, setRecentCurrentPage] = useState(1);
  const rowsPerPage = 5; // Or however many you want per page

  // Carousel state
  const [currentCarouselPage, setCurrentCarouselPage] = useState(0);
  const cardsPerPage = 5;

  const [editingId, setEditingId] = useState(null);
  const [highlightedRow, setHighlightedRow] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // QR Scanner state
  const [showScanner, setShowScanner] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const qrScannerRef = useRef(null);
  const [clearanceCache, setClearanceCache] = useState({});
  const [debounceTimer, setDebounceTimer] = useState(null);

  // Reschedule state
  const [rescheduleForm, setRescheduleForm] = useState({
    newDate: "",
    reason: "",
  });
  const [rescheduleId, setRescheduleId] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    scheduled_date: "",
    inspector_id: "",
    selected_personnel: "",
  });

  // Inspection state
  const [inspectionData, setInspectionData] = useState({
    findings: "",
    status: "PASS",
    documentFile: null,
    equipmentStatus: "Good",
  });
  // Open View Details Modal for Recent Inspections
  const openRecentViewModal = (inspection) => {
    setSelectedRecentInspection(inspection);
    setIsRecentViewModalOpen(true);
  };

  // Close View Details Modal for Recent Inspections
  const closeRecentViewModal = () => {
    setIsRecentViewModalOpen(false);
    setSelectedRecentInspection(null);
  };

  // Add this function to get unique categories from recent inspections
  const getRecentCategories = () => {
    const categories = new Set();
    recentInspections.forEach((inspection) => {
      if (inspection.equipment_category) {
        categories.add(inspection.equipment_category);
      }
    });
    return Array.from(categories).sort();
  };

  // Add this function to get unique equipment statuses from recent inspections
  const getRecentEquipmentStatuses = () => {
    const statuses = new Set();
    recentInspections.forEach((inspection) => {
      if (inspection.equipment_status) {
        statuses.add(inspection.equipment_status);
      }
    });
    return Array.from(statuses).sort();
  };

  // Add this function to filter recent inspections
  const filterRecentInspections = (inspections) => {
    const searchTerm = recentSearch.trim().toLowerCase();
    const categoryTerm = recentFilterCategory.trim().toLowerCase();
    const statusTerm = recentFilterStatus.trim().toLowerCase();
    const resultTerm = recentFilterResult.trim().toLowerCase();

    return inspections.filter((inspection) => {
      // Text search across multiple fields
      const textSearch =
        searchTerm === "" ||
        (inspection.equipment_name &&
          inspection.equipment_name.toLowerCase().includes(searchTerm)) ||
        (inspection.item_code &&
          inspection.item_code.toLowerCase().includes(searchTerm)) ||
        (inspection.assigned_to &&
          inspection.assigned_to.toLowerCase().includes(searchTerm)) ||
        (inspection.inspector &&
          inspection.inspector.toLowerCase().includes(searchTerm)) ||
        (inspection.findings &&
          inspection.findings.toLowerCase().includes(searchTerm));

      // Category filter
      const categoryMatch =
        categoryTerm === "" ||
        (inspection.equipment_category &&
          inspection.equipment_category.toLowerCase().includes(categoryTerm));

      // Equipment status filter
      const statusMatch =
        statusTerm === "" ||
        (inspection.equipment_status &&
          inspection.equipment_status.toLowerCase().includes(statusTerm));

      // Inspection result filter
      const resultMatch =
        resultTerm === "" ||
        (inspection.status &&
          inspection.status.toLowerCase().includes(resultTerm));

      return textSearch && categoryMatch && statusMatch && resultMatch;
    });
  };

  const filteredRecentInspections = useMemo(() => {
    return filterRecentInspections(recentInspections);
  }, [
    recentInspections,
    recentSearch,
    recentFilterCategory,
    recentFilterStatus,
    recentFilterResult,
  ]);
  /*
  const recentTotalPages = Math.max(
    1,
    Math.ceil(filteredRecentInspections.length / rowsPerPage)
  );
  const recentStart = (recentCurrentPage - 1) * rowsPerPage;
  const paginatedRecent = filteredRecentInspections.slice(
    recentStart,
    recentStart + rowsPerPage
  );
*/
  // Add a function to reset recent filters
  const resetRecentFilters = () => {
    setRecentSearch("");
    setRecentFilterCategory("");
    setRecentFilterStatus("");
    setRecentFilterResult("");
    setRecentCurrentPage(1);
  };

  // Add this function to format date for display
  const formatDateForDisplay = (dateString) => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch (error) {
      return dateString;
    }
  };

  // Checkup state
  const [checkupData, setCheckupData] = useState({
    findings: "",
    status: "Good",
  });

  // Equipment table for schedule creation
  const [selectedEquipmentForSchedule, setSelectedEquipmentForSchedule] =
    useState([]);
  const [equipmentSearch, setEquipmentSearch] = useState("");
  const [equipmentFilterCategory, setEquipmentFilterCategory] = useState("");
  const [equipmentFilterStatus, setEquipmentFilterStatus] = useState("");

  // State for equipment clearance status
  const [equipmentClearanceMap, setEquipmentClearanceMap] = useState({});

  // Add a ref for the form container
  const scheduleFormRef = useRef(null);

  // Helper function for PHP currency formatting
  const formatPHP = (amount) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(amount || 0);
  };

  // Carousel calculations - moved to useMemo hooks
  const chunkedClearances = useMemo(() => {
    const chunks = [];
    for (let i = 0; i < pendingClearances.length; i += cardsPerPage) {
      chunks.push(pendingClearances.slice(i, i + cardsPerPage));
    }
    return chunks;
  }, [pendingClearances, cardsPerPage]);

  const totalCarouselPages = Math.max(1, chunkedClearances.length);

  // Load data from Supabase
  useEffect(() => {
    loadAllData();
    loadPendingClearances();
    loadPersonnel();
  }, []);

  // Add this NEW useEffect here - after the main data loading useEffect
  useEffect(() => {
    const loadClearanceForScheduled = async () => {
      if (scheduledInspections.length > 0) {
        // Extract equipment IDs, filtering out any undefined/null values
        const equipmentIds = scheduledInspections
          .map((inspection) => inspection.equipment_id)
          .filter((id) => id !== undefined && id !== null);

        if (equipmentIds.length > 0) {
          try {
            const clearanceMap = await checkEquipmentClearanceStatus(
              equipmentIds
            );
            setEquipmentClearanceMap((prev) => ({ ...prev, ...clearanceMap }));
          } catch (error) {
            console.error("Error loading clearance for scheduled:", error);
          }
        }
      }
    };

    loadClearanceForScheduled();
  }, [scheduledInspections]);

  // Philippine Time functions
  const getTodayInPST = () => {
    const now = new Date();
    const pstTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    return pstTime.toISOString().split("T")[0];
  };

  const isScheduleToday = (scheduleDate) => {
    if (!scheduleDate) return false;
    const todayPST = getTodayInPST();
    return scheduleDate === todayPST;
  };

  const isScheduleFuture = (scheduleDate) => {
    if (!scheduleDate) return false;
    const todayPST = getTodayInPST();
    return scheduleDate > todayPST;
  };

  // Function to check if equipment is in pending clearance
  // Replace the existing checkEquipmentClearanceStatus function with this:
  const checkEquipmentClearanceStatus = async (inventoryIds) => {
    try {
      const cachedResults = {};
      const idsToFetch = [];

      inventoryIds.forEach((id) => {
        if (clearanceCache[id] !== undefined) {
          cachedResults[id] = clearanceCache[id];
        } else {
          idsToFetch.push(id);
        }
      });

      if (idsToFetch.length === 0) {
        return cachedResults;
      }

      console.log("Checking clearance status for inventory IDs:", idsToFetch);

      const { data, error } = await supabase
        .from("clearance_inventory")
        .select(
          `
        id,
        inventory_id,
        status,
        clearance_requests!inner (
          id,
          type,
          status,
          personnel_id
        )
      `
        )
        .in("inventory_id", idsToFetch)
        .eq("status", "Pending")
        .eq("clearance_requests.status", "Pending")
        .in("clearance_requests.type", [
          "Resignation",
          "Retirement",
          "Equipment Completion",
        ]);

      if (error) {
        console.error("Error checking clearance status:", error);
        return cachedResults;
      }

      // Group by inventory_id to handle multiple clearances for same equipment
      const inventoryClearanceMap = {};

      data?.forEach((item) => {
        const inventoryId = item.inventory_id;
        const request = item.clearance_requests;

        if (!inventoryClearanceMap[inventoryId]) {
          inventoryClearanceMap[inventoryId] = [];
        }

        inventoryClearanceMap[inventoryId].push({
          requestId: request.id,
          type: request.type,
          personnelId: request.personnel_id,
          clearanceInventoryId: item.id,
        });
      });

      const newResults = {};

      // Process each inventory item
      idsToFetch.forEach((id) => {
        const clearances = inventoryClearanceMap[id] || [];

        if (clearances.length > 0) {
          // Check if there are multiple clearance types
          const clearanceTypes = [...new Set(clearances.map((c) => c.type))];

          // Combine Retirement/Resignation with Equipment Completion
          let displayType = "";
          if (
            clearanceTypes.includes("Retirement") &&
            clearanceTypes.includes("Equipment Completion")
          ) {
            displayType = "Retirement & Equipment Completion";
          } else if (
            clearanceTypes.includes("Resignation") &&
            clearanceTypes.includes("Equipment Completion")
          ) {
            displayType = "Resignation & Equipment Completion";
          } else if (clearanceTypes.length === 1) {
            displayType = clearanceTypes[0];
          } else {
            displayType = clearanceTypes.join(", ");
          }

          // Get all request IDs
          const requestIds = clearances.map((c) => c.requestId);

          newResults[id] = {
            hasClearance: true,
            type: displayType,
            requestIds: requestIds, // Store multiple request IDs
            clearanceInventoryIds: clearances.map(
              (c) => c.clearanceInventoryId
            ),
            originalTypes: clearanceTypes, // Store original types
            personnelId: clearances[0].personnelId, // Assuming same personnel for all
          };
        } else {
          newResults[id] = { hasClearance: false };
        }
      });

      const updatedCache = { ...clearanceCache, ...newResults };
      setClearanceCache(updatedCache);

      const allResults = { ...cachedResults, ...newResults };
      console.log("Total results:", Object.keys(allResults).length, "items");
      return allResults;
    } catch (error) {
      console.error("Error in checkEquipmentClearanceStatus:", error);
      return {};
    }
  };

  // Function to load clearance status for filtered equipment
  const loadEquipmentClearanceStatus = async (equipmentList) => {
    if (equipmentList.length === 0) {
      setEquipmentClearanceMap({});
      return;
    }

    const inventoryIds = equipmentList.map((item) => item.id);
    const clearanceMap = await checkEquipmentClearanceStatus(inventoryIds);
    setEquipmentClearanceMap(clearanceMap);
  };

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      console.log("Loading inventory items...");
      const { data: inventoryData, error: inventoryError } = await supabase
        .from("inventory")
        .select(
          `
        id, 
        item_code, 
        item_name, 
        last_checked, 
        assigned_to, 
        status, 
        category, 
        assigned_personnel_id, 
        purchase_date, 
        serial_number, 
        price,
        assigned_date,   
        last_assigned,     
        unassigned_date,   
        personnel:assigned_personnel_id(first_name, last_name, badge_number)
      `
        )
        .order("item_name");

      if (inventoryError) {
        console.error("Inventory error:", inventoryError);
        throw inventoryError;
      }

      setInventoryItems(inventoryData || []);
      console.log("Inventory loaded:", inventoryData?.length || 0, "items");

      // Load scheduled inspections (status = 'PENDING') - REMOVED personnel_id
      const { data: scheduledData, error: scheduledError } = await supabase
        .from("inspections")
        .select(
          `
        id,
        equipment_id,
        schedule_inspection_date,
        reschedule_inspection_date,
        reschedule_reason,
        status,
        schedule_status,   
        findings,
        recommendations,
        clearance_request_id,
        inspector_id,
        inspector:inspector_id (
          first_name,
          last_name,
          badge_number
        )
      `
        )
        .eq("status", "PENDING")
        .order("schedule_inspection_date", { ascending: true });

      if (scheduledError) {
        console.error("Scheduled inspections error:", scheduledError);
        throw scheduledError;
      }

      // Now get inventory details separately and map personnel_id from inventory
      const scheduledInspectionsWithEquipment = await Promise.all(
        (scheduledData || []).map(async (inspection) => {
          // Get inventory details for this equipment
          const { data: inventoryItem, error: invError } = await supabase
            .from("inventory")
            .select(
              `
            item_name,
            item_code,
            assigned_to,
            status,
            category,
            assigned_date,
            last_checked,
            assigned_personnel_id
          `
            )
            .eq("id", inspection.equipment_id)
            .single();

          // Find the assigned personnel ID from inventory
          const assignedPersonnelId =
            inventoryItem?.assigned_personnel_id || null;

          return {
            ...inspection,
            equipment_name: inventoryItem?.item_name || "Unknown Equipment",
            equipment_id: inspection.equipment_id,
            item_code: inventoryItem?.item_code,
            inspector_name: inspection.inspector
              ? `${inspection.inspector.first_name} ${inspection.inspector.last_name}`
              : "Unknown Inspector",
            assigned_to: inventoryItem?.assigned_to || "Unassigned",
            scheduled_date: inspection.schedule_inspection_date,
            schedule_inspection_date: inspection.schedule_inspection_date,
            reschedule_inspection_date: inspection.reschedule_inspection_date,
            inspection_status: "Scheduled",
            // Get personnel_id from inventory's assigned_personnel_id
            personnel_id: assignedPersonnelId,
            equipment_status: inventoryItem?.status || "Unknown",
            equipment_category: inventoryItem?.category || "Unknown",
            equipment_assigned_date: inventoryItem?.assigned_date || null,
            equipment_last_checked: inventoryItem?.last_checked || null,
            schedule_status: inspection.schedule_status || "UPCOMING",
            // Pass through the clearance_request_id
            clearance_request_id: inspection.clearance_request_id,
          };
        })
      );

      setScheduledInspections(scheduledInspectionsWithEquipment);
      console.log("Scheduled inspections loaded:", scheduledData?.length || 0);

      // Load recent completed inspections - REMOVED personnel_id
      const { data: recentData, error: recentError } = await supabase
        .from("inspections")
        .select(
          `
        id,
        equipment_id,
        schedule_inspection_date,
        reschedule_inspection_date,
        status,
        schedule_status,
        findings,
        recommendations,
        inspector:inspector_id (
          first_name,
          last_name
        )
      `
        )
        .in("status", ["COMPLETED", "FAILED"])
        .order("schedule_inspection_date", { ascending: false })
        .limit(10);

      if (recentError) {
        console.error("Recent inspections error:", recentError);
        setRecentInspections([]);
      } else {
        // Get inventory details for recent inspections
        const recent = await Promise.all(
          (recentData || []).map(async (insp) => {
            const { data: inventoryItem, error: invError } = await supabase
              .from("inventory")
              .select(
                `
              item_name,
              item_code,
              assigned_to,
              status,
              category,
              assigned_date,
              last_checked,
              assigned_personnel_id
            `
              )
              .eq("id", insp.equipment_id)
              .single();

            return {
              id: insp.id,
              item_code: inventoryItem?.item_code || "N/A",
              equipment_name: inventoryItem?.item_name || "Unknown Equipment",
              equipment_category: inventoryItem?.category || "Unknown",
              equipment_status: inventoryItem?.status || "Unknown",
              equipment_assigned_date: inventoryItem?.assigned_date || null,
              equipment_last_checked: inventoryItem?.last_checked || null,
              last_checked: formatDate(insp.schedule_inspection_date),
              inspector: insp.inspector
                ? `${insp.inspector.first_name} ${insp.inspector.last_name}`
                : "Unknown",
              status: insp.status === "COMPLETED" ? "PASS" : "FAIL",
              schedule_status: insp.schedule_status || "UPCOMING",
              findings: insp.findings || "",
              assigned_to: inventoryItem?.assigned_to || "N/A",
              // Add personnel_id from inventory for recent inspections too
              personnel_id: inventoryItem?.assigned_personnel_id || null,
            };
          })
        );
        setRecentInspections(recent);
        console.log("Recent inspections loaded:", recent.length);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error(`Failed to load data: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };
  // Load pending clearances
  // Update the grouping logic in loadPendingClearances:
  const loadPendingClearances = async () => {
    try {
      console.log("Loading pending clearance inspections...");

      const { data, error } = await supabase
        .from("clearance_inventory")
        .select(
          `
        id,
        clearance_request_id,
        inventory_id,
        status,
        remarks,
        created_at,
        updated_at,
        clearance_requests!inner (
          id,
          personnel_id,
          type,
          status,        
          created_at, 
          personnel:personnel_id (
            first_name,
            last_name,
            badge_number
          )
        ),
        inventory!inner (
          id,
          item_name,
          item_code,
          category,
          status,
          assigned_to
        )
      `
        )
        .eq("status", "Pending")
        .eq("clearance_requests.status", "Pending")
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Clearance inventory query error:", error);
        setPendingClearances([]);
        return;
      }

      // Group by personnel_id AND type combination
      const groupedByPersonnelAndType = {};

      data.forEach((item) => {
        const request = item.clearance_requests;
        const personnelId = request.personnel_id;
        const type = request.type;

        // Create a key that combines personnel and type (but treat Equipment Completion differently)
        let groupKey = `${personnelId}`;

        // Combine Retirement/Resignation with Equipment Completion for same personnel
        if (type === "Equipment Completion") {
          groupKey = `${personnelId}_combined`;
        } else {
          groupKey = `${personnelId}_${type}`;
        }

        if (!groupedByPersonnelAndType[groupKey]) {
          groupedByPersonnelAndType[groupKey] = {
            id: request.id,
            personnel_id: personnelId,
            type: request.type,
            request_status: request.status,
            request_created_at: request.created_at,
            personnel_name: request.personnel
              ? `${request.personnel.first_name || ""} ${
                  request.personnel.last_name || ""
                }`.trim()
              : "Unknown",
            badge_number: request.personnel?.badge_number || "N/A",
            equipment_count: 0,
            equipment_items: [],
            originalTypes: new Set([request.type]),
          };
        }

        groupedByPersonnelAndType[groupKey].equipment_count++;
        groupedByPersonnelAndType[groupKey].equipment_items.push({
          inventory_id: item.inventory_id,
          item_name: item.inventory?.item_name,
          item_code: item.inventory?.item_code,
          category: item.inventory?.category,
          equipment_status: item.inventory?.status,
          assigned_to: item.inventory?.assigned_to,
          clearance_status: item.status,
          clearance_inventory_id: item.id,
          clearance_request_id: item.clearance_request_id,
        });

        // Add type to set
        groupedByPersonnelAndType[groupKey].originalTypes.add(request.type);
      });

      // Process grouped data to combine types where needed
      const equipmentClearances = Object.values(groupedByPersonnelAndType).map(
        (clearance) => {
          const typesArray = Array.from(clearance.originalTypes);

          // Combine Retirement/Resignation with Equipment Completion
          if (
            typesArray.includes("Retirement") &&
            typesArray.includes("Equipment Completion")
          ) {
            clearance.type = "Retirement & Equipment Completion";
          } else if (
            typesArray.includes("Resignation") &&
            typesArray.includes("Equipment Completion")
          ) {
            clearance.type = "Resignation & Equipment Completion";
          } else if (typesArray.length > 1) {
            clearance.type = typesArray.join(", ");
          }

          return clearance;
        }
      );

      setPendingClearances(equipmentClearances);
      console.log(
        "Pending clearance inspections loaded:",
        equipmentClearances.length
      );
    } catch (error) {
      console.error("Error loading pending clearances:", error);
      setPendingClearances([]);
    }
  };

  const loadPersonnel = async () => {
    try {
      const { data, error } = await supabase
        .from("personnel")
        .select("id, first_name, last_name, badge_number")
        .order("last_name", { ascending: true });

      if (error) throw error;
      setPersonnelList(data || []);
    } catch (error) {
      console.error("Error loading personnel:", error);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch (error) {
      return dateString;
    }
  };

  const rescheduleInspection = (inspectionId) => {
    const inspection = scheduledInspections.find((s) => s.id === inspectionId);
    if (inspection) {
      setRescheduleId(inspectionId);
      setRescheduleForm({
        newDate:
          inspection.schedule_inspection_date || inspection.scheduled_date,
        reason: inspection.reschedule_reason || "",
      });
      setShowRescheduleModal(true);
    }
  };

  const handleReschedule = async () => {
    if (!rescheduleForm.newDate || !rescheduleForm.reason) {
      toast.error("Please select a new date and provide a reason");
      return;
    }

    try {
      const { error } = await supabase
        .from("inspections")
        .update({
          schedule_inspection_date: rescheduleForm.newDate,
          reschedule_inspection_date: rescheduleForm.newDate,
          reschedule_reason: rescheduleForm.reason,
          updated_at: new Date().toISOString(),
        })
        .eq("id", rescheduleId);

      if (error) throw error;

      toast.success("Inspection rescheduled successfully");
      setShowRescheduleModal(false);
      setRescheduleForm({ newDate: "", reason: "" });
      setRescheduleId(null);
      loadAllData();
    } catch (error) {
      console.error("Error rescheduling inspection:", error);
      toast.error("Failed to reschedule: " + error.message);
    }
  };

  // View clearance details
  const viewClearanceDetails = async (clearanceRequestId) => {
    try {
      console.log("Viewing clearance details for request:", clearanceRequestId);

      const { data: requestData, error: requestError } = await supabase
        .from("clearance_requests")
        .select(
          `
          *,
          personnel:personnel_id (
            first_name,
            last_name,
            badge_number,
            rank
          )
        `
        )
        .eq("id", clearanceRequestId)
        .single();

      if (requestError) throw requestError;

      const { data: inventoryData, error: inventoryError } = await supabase
        .from("clearance_inventory")
        .select(
          `
          id,
          inventory_id,
          status,
          remarks,
          returned,
          return_date,
          inspection_date,
          inspector_name,
          findings,
          inventory:inventory_id (
            item_name,
            item_code,
            category,
            status,
            assigned_to,
            last_checked,
            current_value
          )
        `
        )
        .eq("clearance_request_id", clearanceRequestId)
        .order("created_at", { ascending: true });

      if (inventoryError) throw inventoryError;

      const equipmentList = (inventoryData || []).map((item) => ({
        id: item.id,
        inventory_id: item.inventory_id,
        name: item.inventory?.item_name,
        code: item.inventory?.item_code,
        category: item.inventory?.category,
        status: item.inventory?.status,
        assigned_to: item.inventory?.assigned_to,
        last_checked: item.inventory?.last_checked,
        current_value: item.inventory?.current_value,
        clearance_status: item.status,
        remarks: item.remarks,
        returned: item.returned,
        return_date: item.return_date,
        inspection_date: item.inspection_date,
        inspector_name: item.inspector_name,
        findings: item.findings,
      }));

      setSelectedClearance({
        ...requestData,
        personnel_name: requestData.personnel
          ? `${requestData.personnel.first_name} ${requestData.personnel.last_name}`.trim()
          : "Unknown",
        badge_number: requestData.personnel?.badge_number || "N/A",
        rank: requestData.personnel?.rank || "N/A",
      });

      setSelectedEquipment(equipmentList);
      setShowClearanceModal(true);
    } catch (error) {
      console.error("Error loading clearance details:", error);
      toast.error("Failed to load clearance details: " + error.message);
    }
  };

  // Filter equipment for schedule creation
  const filteredEquipment = useMemo(() => {
    return inventoryItems.filter((item) => {
      const matchesSearch =
        equipmentSearch === "" ||
        item.item_name.toLowerCase().includes(equipmentSearch.toLowerCase()) ||
        item.item_code.toLowerCase().includes(equipmentSearch.toLowerCase());

      const matchesCategory =
        equipmentFilterCategory === "" ||
        item.category === equipmentFilterCategory;

      const matchesStatus =
        equipmentFilterStatus === "" || item.status === equipmentFilterStatus;

      const matchesPersonnel =
        formData.selected_personnel === "" ||
        item.assigned_to === formData.selected_personnel;

      return (
        matchesSearch && matchesCategory && matchesStatus && matchesPersonnel
      );
    });
  }, [
    inventoryItems,
    equipmentSearch,
    equipmentFilterCategory,
    equipmentFilterStatus,
    formData.selected_personnel,
  ]);

  // Add this inside your component, after filteredEquipment calculation
  const selectableEquipment = useMemo(() => {
    return filteredEquipment.filter((item) => !pendingInspectionsMap[item.id]);
  }, [filteredEquipment, pendingInspectionsMap]);

  const selectableEquipmentCount = selectableEquipment.length;

  // Carousel navigation functions
  const handleNextClick = () => {
    setCurrentCarouselPage((prev) =>
      prev < totalCarouselPages - 1 ? prev + 1 : prev
    );
  };

  const handlePrevClick = () => {
    setCurrentCarouselPage((prev) => (prev > 0 ? prev - 1 : 0));
  };

  // NEW: Reset form when showing/hiding
  useEffect(() => {
    if (showScheduleForm && filteredEquipment.length > 0) {
      const equipmentIds = filteredEquipment
        .map((item) => item.id)
        .sort()
        .join(",");

      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      const timer = setTimeout(async () => {
        await loadEquipmentClearanceStatus(filteredEquipment);

        const pendingMap = await checkEquipmentHasPendingInspection(
          filteredEquipment.map((item) => item.id)
        );
        setPendingInspectionsMap(pendingMap);
      }, 500);

      setDebounceTimer(timer);
    } else if (!showScheduleForm) {
      // Reset form data when hiding
      setSelectedEquipmentForSchedule([]);
      setEquipmentClearanceMap({});
      setPendingInspectionsMap({});
      setEquipmentSearch("");
      setEquipmentFilterCategory("");
      setEquipmentFilterStatus("");
      setFormData({
        scheduled_date: "",
        inspector_id: "",
        selected_personnel: "",
      });
    }

    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [showScheduleForm, filteredEquipment.length]);

  // NEW: Form reset function
  const resetScheduleForm = () => {
    setSelectedEquipmentForSchedule([]);
    setEquipmentClearanceMap({});
    setPendingInspectionsMap({});
    setEquipmentSearch("");
    setEquipmentFilterCategory("");
    setEquipmentFilterStatus("");
    setFormData({
      scheduled_date: "",
      inspector_id: "",
      selected_personnel: "",
    });
  };

  // Toggle equipment selection for schedule
  const toggleEquipmentSelection = (equipmentId) => {
    setSelectedEquipmentForSchedule((prev) => {
      if (prev.includes(equipmentId)) {
        return prev.filter((id) => id !== equipmentId);
      } else {
        return [...prev, equipmentId];
      }
    });
  };

const getAssignedPersonnel = () => {
  const personnelSet = new Set();
  inventoryItems.forEach((item) => {
    if (item.assigned_to && item.assigned_to !== "Unassigned") {
      // Clean up names - remove extra spaces
      const cleanName = item.assigned_to.trim().replace(/\s+/g, " ");
      personnelSet.add(cleanName);
    }
  });

  // Sort by last name if possible
  return Array.from(personnelSet).sort((a, b) => {
    const aParts = a.split(" ");
    const bParts = b.split(" ");
    const aLastName = aParts[aParts.length - 1];
    const bLastName = bParts[bParts.length - 1];
    return aLastName.localeCompare(bLastName);
  });
};
  
const handleCreateSchedule = async () => {
  console.log("DEBUG: Selected equipment IDs:", selectedEquipmentForSchedule);
  console.log("DEBUG: Inventory items:", inventoryItems);

  const pendingMap = await checkEquipmentHasPendingInspection(
    selectedEquipmentForSchedule
  );

  console.log("DEBUG: Pending map returned:", pendingMap);

  const equipmentWithPendingInspections = selectedEquipmentForSchedule.filter(
    (equipId) => pendingMap[equipId]
  );

  console.log(
    "DEBUG: Equipment with pending inspections:",
    equipmentWithPendingInspections
  );
  if (selectedEquipmentForSchedule.length === 0) {
    toast.error("Please select at least one equipment");
    return;
  }

  if (!formData.scheduled_date || !formData.inspector_id) {
    toast.error("Please fill all required fields");
    return;
  }

  try {
    const pendingMap = await checkEquipmentHasPendingInspection(
      selectedEquipmentForSchedule
    );

    const equipmentWithPendingInspections = selectedEquipmentForSchedule.filter(
      (equipId) => pendingMap[equipId]
    );

    if (equipmentWithPendingInspections.length > 0) {
      const equipmentNames = equipmentWithPendingInspections
        .map((equipId) => {
          const item = inventoryItems.find((item) => item.id === equipId);
          return item?.item_name || `ID: ${equipId}`;
        })
        .join(", ");

      toast.error(
        `Cannot schedule inspection. The following equipment already have pending inspections: ${equipmentNames}`
      );
      return;
    }

    const selectedInspector = personnelList.find(
      (person) => person.id === formData.inspector_id
    );

    if (!selectedInspector) {
      toast.error("Selected inspector not found");
      return;
    }

    const inspectorName = `${selectedInspector.first_name} ${selectedInspector.last_name}`;

    // Get clearance request IDs for each equipment - GET ALL, NOT JUST FIRST ONE
    const schedules = await Promise.all(
      selectedEquipmentForSchedule.map(async (equipId) => {
        // Check for ALL pending clearance requests for this equipment
        const { data: clearanceData, error: clearanceError } = await supabase
          .from("clearance_inventory")
          .select("clearance_request_id")
          .eq("inventory_id", equipId)
          .eq("status", "Pending");

        let clearanceRequestId = null;

        // If there are multiple clearance requests, we need to handle them differently
        if (!clearanceError && clearanceData && clearanceData.length > 0) {
          // If there's only one clearance request, store it
          if (clearanceData.length === 1) {
            clearanceRequestId = clearanceData[0].clearance_request_id;
            console.log(
              `Found clearance request ${clearanceRequestId} for equipment ${equipId}`
            );
          } else {
            // If there are multiple clearance requests, store the first one
            // and log that there are multiple
            clearanceRequestId = clearanceData[0].clearance_request_id;
            console.log(
              `Found ${clearanceData.length} clearance requests for equipment ${equipId}. Using first one: ${clearanceRequestId}`
            );
            console.log(
              "All clearance request IDs:",
              clearanceData.map((c) => c.clearance_request_id)
            );
          }
        }

        return {
          equipment_id: equipId,
          inspector_id: formData.inspector_id,
          inspector_name: inspectorName,
          schedule_inspection_date: formData.scheduled_date,
          reschedule_inspection_date: formData.scheduled_date,
          status: "PENDING",
          clearance_request_id: clearanceRequestId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      })
    );

    console.log("Schedules to create:", schedules);

    const { data, error } = await supabase
      .from("inspections")
      .insert(schedules)
      .select();

    if (error) {
      console.error("Insert error:", error);
      throw error;
    }

    toast.success(`Successfully scheduled ${schedules.length} inspection(s)`);

    // Hide form on success
    setShowScheduleForm(false);
    resetScheduleForm();
    loadAllData();
  } catch (error) {
    console.error("Error creating schedule:", error);
    toast.error("Failed to create schedule: " + error.message);

    if (error.message.includes("foreign key")) {
      toast.error(
        "Database constraint error. Please check if the equipment or inspector exists."
      );
    }
  }
};

  const checkEquipmentHasPendingInspection = async (equipmentIds) => {
    try {
      if (!equipmentIds || equipmentIds.length === 0) {
        return {};
      }

      const { data, error } = await supabase
        .from("inspections")
        .select("id, equipment_id, status")
        .in("equipment_id", equipmentIds)
        .eq("status", "PENDING");

      if (error) {
        console.error("Error checking pending inspections:", error);
        return {};
      }

      const pendingMap = {};
      data?.forEach((inspection) => {
        pendingMap[inspection.equipment_id] = true;
      });

      return pendingMap;
    } catch (error) {
      console.error("Error in checkEquipmentHasPendingInspection:", error);
      return {};
    }
  };

  const handleCheckup = (inspection) => {
    setSelectedSchedule(inspection);
    setCheckupData({
      findings: "",
      status: "Good",
    });
    setShowCheckupModal(true);
  };

  const handleInspect = (inspection) => {
    setSelectedSchedule(inspection);
    setInspectionData({
      findings: "",
      status: "PASS",
      documentFile: null,
      equipmentStatus: "Good",
    });
    setShowInspectModal(true);
  };

  const submitCheckup = async () => {
    if (!checkupData.findings) {
      toast.error("Please enter findings");
      return;
    }

    try {
      const { error: inspectionError } = await supabase
        .from("inspections")
        .update({
          status: "COMPLETED",
          findings: checkupData.findings,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedSchedule.id);

      if (inspectionError) throw inspectionError;

      toast.success("Checkup completed successfully");
      setShowCheckupModal(false);
      loadAllData();
    } catch (error) {
      console.error("Error submitting checkup:", error);
      toast.error("Failed to submit checkup: " + error.message);
    }
  };
    const checkAndUpdateClearanceStatus = async (
      equipmentId,
      clearanceStatus
    ) => {
      try {
        // Get all clearance_inventory records for this equipment
        const { data: clearanceRecords, error } = await supabase
          .from("clearance_inventory")
          .select("clearance_request_id, personnel_id, status")
          .eq("inventory_id", equipmentId)
          .eq("status", "Pending");

        if (error) throw error;

        if (clearanceRecords && clearanceRecords.length > 0) {
          // Group by clearance request
          const requestsMap = {};
          clearanceRecords.forEach((record) => {
            if (!requestsMap[record.clearance_request_id]) {
              requestsMap[record.clearance_request_id] = {
                requestId: record.clearance_request_id,
                personnelId: record.personnel_id,
                items: [],
              };
            }
            requestsMap[record.clearance_request_id].items.push({
              originalStatus: record.status,
              newStatus: clearanceStatus,
            });
          });

          // Update each clearance request
          for (const requestId in requestsMap) {
            const request = requestsMap[requestId];

            // Get all items for this clearance request
            const { data: allItems, error: itemsError } = await supabase
              .from("clearance_inventory")
              .select("status")
              .eq("clearance_request_id", requestId);

            if (itemsError) continue;

            // Count statuses
            const total = allItems.length;
            const cleared = allItems.filter(
              (item) => item.status === "Cleared"
            ).length;
            const pending = allItems.filter(
              (item) => item.status === "Pending"
            ).length;
            const damaged = allItems.filter(
              (item) => item.status === "Damaged"
            ).length;
            const lost = allItems.filter(
              (item) => item.status === "Lost"
            ).length;

            let newRequestStatus = "In Progress";

            if (pending === 0 && damaged === 0 && lost === 0) {
              // All items cleared
              newRequestStatus = "Pending for Approval";
            } else if (damaged > 0 || lost > 0) {
              // Check if accountability is settled
              const { data: accountabilityData } = await supabase
                .from("personnel_equipment_accountability_table")
                .select("accountability_status")
                .eq("personnel_id", request.personnelId)
                .eq("clearance_request_id", requestId)
                .maybeSingle();

              if (accountabilityData?.accountability_status === "SETTLED") {
                newRequestStatus = "Pending for Approval";
              } else {
                newRequestStatus = "In Progress";
              }
            }

            // Update clearance request status
            const { error: updateError } = await supabase
              .from("clearance_requests")
              .update({
                status: newRequestStatus,
                updated_at: new Date().toISOString(),
              })
              .eq("id", requestId);

            if (!updateError) {
              console.log(
                `✅ Updated clearance request ${requestId} to ${newRequestStatus}`
              );
            }
          }
        }
      } catch (error) {
        console.error("Error updating clearance status:", error);
      }
    };
 const submitInspection = async () => {
   if (!inspectionData.findings) {
     toast.error("Please enter findings");
     return;
   }

   try {
     const inspectorName = selectedSchedule.inspector_name;
     const inspectorId = selectedSchedule.inspector_id;

     if (!inspectorId) {
       toast.error("No inspector assigned to this inspection");
       return;
     }

     console.log("=== STARTING INSPECTION ===");
     console.log("🔍 Equipment ID:", selectedSchedule.equipment_id);
     console.log("🔍 Inspector:", inspectorName, "ID:", inspectorId);

     // 1. FIRST: Find all clearance_inventory records for this equipment
     console.log("🔍 Searching for clearance_inventory records...");
     const { data: clearanceRecords, error: findError } = await supabase
       .from("clearance_inventory")
       .select("*")
       .eq("inventory_id", selectedSchedule.equipment_id)
       .eq("status", "Pending");

     if (findError) {
       console.error("❌ Error finding clearance records:", findError);
     } else {
       console.log(
         `🔍 Found ${clearanceRecords?.length || 0} pending clearance records`
       );
       if (clearanceRecords && clearanceRecords.length > 0) {
         clearanceRecords.forEach((record) => {
           console.log(
             `   - Record ${record.id}: request ${record.clearance_request_id}, status ${record.status}`
           );
         });
       }
     }

     // Determine clearance status based on equipment status
     let clearanceStatus;
     switch (inspectionData.equipmentStatus) {
       case "Good":
       case "Needs Maintenance":
       case "Under Repair":
         clearanceStatus = "Cleared";
         break;
       case "Damaged":
         clearanceStatus = "Damaged";
         break;
       case "Lost":
         clearanceStatus = "Lost";
         break;
       default:
         clearanceStatus =
           inspectionData.status === "PASS" ? "Cleared" : "Damaged";
     }

     console.log("🔍 Determined clearance status:", clearanceStatus);

     // 2. Update the inspection record
     const inspectionStatus =
       inspectionData.status === "PASS" ? "COMPLETED" : "FAILED";

     console.log("📝 Updating inspection record:", selectedSchedule.id);

     const { error: inspectionError } = await supabase
       .from("inspections")
       .update({
         status: inspectionStatus,
         findings: inspectionData.findings,
         recommendations:
           inspectionData.status === "PASS"
             ? "Equipment cleared"
             : "Equipment requires attention",
         updated_at: new Date().toISOString(),
       })
       .eq("id", selectedSchedule.id);

     if (inspectionError) {
       console.error("❌ Error updating inspection:", inspectionError);
       throw inspectionError;
     }

     console.log("✅ Inspection record updated");
     // After updating the inspection record in submitInspection:
     console.log("✅ Inspection record updated");

     // Check and update clearance status
     await checkAndUpdateClearanceStatus(
       selectedSchedule.equipment_id,
       clearanceStatus
     );

     // Add this helper function
 
     // 3. Update inventory status
     const { error: inventoryError } = await supabase
       .from("inventory")
       .update({
         last_checked: new Date().toISOString().split("T")[0],
         status: inspectionData.equipmentStatus,
         updated_at: new Date().toISOString(),
       })
       .eq("id", selectedSchedule.equipment_id);

     if (inventoryError) {
       console.error("❌ Error updating inventory:", inventoryError);
       throw inventoryError;
     }

     console.log("✅ Inventory record updated");

     // 4. CRITICAL: Update ALL clearance_inventory records for this equipment
     if (clearanceRecords && clearanceRecords.length > 0) {
       console.log("📝 Updating clearance_inventory records...");

       // Create an array of all clearance_inventory IDs
       const clearanceIds = clearanceRecords.map((record) => record.id);
       console.log("📝 Clearance inventory IDs to update:", clearanceIds);

       // Build update payload - SIMPLIFIED to ensure it works
       const updatePayload = {
         status: clearanceStatus,
         inspection_id: selectedSchedule.id,
         inspector_id: inspectorId,
         inspector_name: inspectorName,
         inspection_date: new Date().toISOString().split("T")[0],
         updated_at: new Date().toISOString(),
       };

       console.log("📝 Update payload:", updatePayload);

       // METHOD 1: Direct update by IDs
       console.log("🔄 METHOD 1: Updating by clearance_inventory IDs...");
       const { data: updateResult1, error: updateError1 } = await supabase
         .from("clearance_inventory")
         .update(updatePayload)
         .in("id", clearanceIds);

       if (updateError1) {
         console.error("❌ METHOD 1 failed:", updateError1);

         // METHOD 2: Update by equipment ID and status
         console.log("🔄 METHOD 2: Updating by equipment ID and status...");
         const { error: updateError2 } = await supabase
           .from("clearance_inventory")
           .update(updatePayload)
           .eq("inventory_id", selectedSchedule.equipment_id)
           .eq("status", "Pending");

         if (updateError2) {
           console.error("❌ METHOD 2 failed:", updateError2);

           // METHOD 3: Update one by one
           console.log("🔄 METHOD 3: Updating one by one...");
           let successCount = 0;
           for (const record of clearanceRecords) {
             try {
               const { error: singleError } = await supabase
                 .from("clearance_inventory")
                 .update({
                   status: clearanceStatus,
                   inspection_id: selectedSchedule.id,
                   inspector_id: inspectorId,
                   inspector_name: inspectorName,
                   updated_at: new Date().toISOString(),
                 })
                 .eq("id", record.id);

               if (!singleError) {
                 successCount++;
                 console.log(`   ✅ Updated record ${record.id}`);
               } else {
                 console.error(
                   `   ❌ Failed to update record ${record.id}:`,
                   singleError
                 );
               }
             } catch (err) {
               console.error(`   ❌ Error updating record ${record.id}:`, err);
             }
           }
           console.log(
             `✅ Updated ${successCount} out of ${clearanceRecords.length} records`
           );
         } else {
           console.log("✅ METHOD 2 succeeded");
         }
       } else {
         console.log(
           `✅ METHOD 1 succeeded - updated ${clearanceRecords.length} records`
         );
       }

       // 5. Verify the update
       console.log("🔍 Verifying update...");
       const { data: verifyData, error: verifyError } = await supabase
         .from("clearance_inventory")
         .select("id, status, inspection_id, inspector_name")
         .in("id", clearanceIds);

       if (!verifyError && verifyData) {
         console.log("🔍 Verification results:");
         verifyData.forEach((record) => {
           console.log(
             `   Record ${record.id}: status=${record.status}, inspection_id=${record.inspection_id}, inspector=${record.inspector_name}`
           );
         });

         const updatedCount = verifyData.filter(
           (r) => r.status === clearanceStatus
         ).length;
         console.log(
           `   ${updatedCount} out of ${verifyData.length} records updated to ${clearanceStatus}`
         );
       } else {
         console.error("❌ Verification error:", verifyError);
       }

       // 6. Check each clearance request separately
       const clearanceRequestIds = [
         ...new Set(clearanceRecords.map((r) => r.clearance_request_id)),
       ];

       console.log("🔍 Checking clearance requests:", clearanceRequestIds);

       for (const requestId of clearanceRequestIds) {
         // Get personnel ID for this specific request
         const requestRecord = clearanceRecords.find(
           (r) => r.clearance_request_id === requestId
         );
         if (requestRecord) {
           await checkAndCompletePersonnelClearance(
             requestRecord.personnel_id,
             [requestId]
           );
         }
       }
     } else {
       console.log("ℹ️ No pending clearance records found for this equipment");
     }

     // 7. Create accountability record if needed
     const isAccountabilityCase =
       inspectionData.equipmentStatus === "Lost" ||
       inspectionData.equipmentStatus === "Damaged";

     if (isAccountabilityCase && clearanceRecords) {
       const requestIds =
         clearanceRecords.map((r) => r.clearance_request_id) || [];
       await createAccountabilityRecord(
         selectedSchedule.id,
         selectedSchedule.equipment_id,
         selectedSchedule.personnel_id || null,
         inspectionData.equipmentStatus,
         inspectionData.findings,
         requestIds
       );
     }

     // 8. Show success message
     toast.success("Inspection completed successfully");

     setShowInspectModal(false);

     // Reload data
     loadAllData();
     loadPendingClearances();
   } catch (error) {
     console.error("❌ Error submitting inspection:", error);
     toast.error("Failed to submit inspection: " + error.message);
   }
 };
  // Add this test function temporarily
  const testClearanceUpdate = async () => {
    try {
      // Test updating one specific clearance_inventory record
      const { data, error } = await supabase
        .from("clearance_inventory")
        .update({
          status: "Cleared",
          inspector_name: "Test Inspector",
          inspector_id: selectedSchedule?.inspector_id,
          updated_at: new Date().toISOString(),
        })
        .eq("inventory_id", selectedSchedule.equipment_id)
        .eq("status", "Pending")
        .select();

      console.log("Test update result:", { data, error });
    } catch (err) {
      console.error("Test update error:", err);
    }
  };

const checkAndCompletePersonnelClearance = async (personnelId, requestIds) => {
  try {
    console.log(`🔍 Checking equipment status for personnel ${personnelId}`);
    console.log(`🔍 Checking clearance request IDs:`, requestIds);

    // Check EACH clearance request separately
    for (const requestId of requestIds) {
      console.log(`🔍 Checking clearance request ${requestId}...`);

      // Get ALL equipment statuses for this clearance request
      const { data: allEquipment, error } = await supabase
        .from("clearance_inventory")
        .select("id, status, clearance_request_id")
        .eq("personnel_id", personnelId)
        .eq("clearance_request_id", requestId);

      if (error) {
        console.error(`Error checking clearance request ${requestId}:`, error);
        continue;
      }

      if (!allEquipment || allEquipment.length === 0) {
        console.log(`ℹ️ No equipment found for clearance request ${requestId}`);
        continue;
      }

      // Count statuses
      const totalEquipment = allEquipment.length;
      const pendingCount = allEquipment.filter(
        (e) => e.status === "Pending"
      ).length;
      const clearedCount = allEquipment.filter(
        (e) => e.status === "Cleared"
      ).length;
      const damagedCount = allEquipment.filter(
        (e) => e.status === "Damaged"
      ).length;
      const lostCount = allEquipment.filter((e) => e.status === "Lost").length;

      console.log(`📊 Clearance request ${requestId} status summary:`);
      console.log(`   Total equipment: ${totalEquipment}`);
      console.log(`   Pending: ${pendingCount}`);
      console.log(`   Cleared: ${clearedCount}`);
      console.log(`   Damaged: ${damagedCount}`);
      console.log(`   Lost: ${lostCount}`);

      // Get current clearance request status
      const { data: clearanceRequest, error: requestError } = await supabase
        .from("clearance_requests")
        .select("type, status")
        .eq("id", requestId)
        .single();

      if (requestError) {
        console.error(
          `Error getting clearance request ${requestId}:`,
          requestError
        );
        continue;
      }

      // ====== IMPORTANT CHANGE ======
      // DO NOT automatically mark as "Completed"
      // Only update status to "In Progress" if there are no pending items
      // But keep it as "In Progress" - NOT "Completed"

      if (pendingCount === 0) {
        console.log(
          `✅ All equipment inspected for clearance request ${requestId}`
        );

        // Check current status
        if (clearanceRequest.status === "Pending") {
          // If it was Pending and now all equipment is inspected, mark as In Progress
          const { error: updateError } = await supabase
            .from("clearance_requests")
            .update({
              status: "In Progress",
              updated_at: new Date().toISOString(),
            })
            .eq("id", requestId);

          if (updateError) {
            console.error(
              `Error updating clearance request ${requestId} to In Progress:`,
              updateError
            );
          } else {
            console.log(
              `🔄 Updated clearance request ${requestId} to In Progress`
            );
          }
        } else if (clearanceRequest.status === "In Progress") {
          console.log(
            `ℹ️ Clearance request ${requestId} already In Progress - waiting for manual completion`
          );

          // ====== NEW: Check if there are any damaged/lost equipment ======
          if (damagedCount > 0 || lostCount > 0) {
            console.log(
              `⚠️ Clearance request ${requestId} has damaged/lost equipment - may require accountability`
            );
          }
        }
      } else {
        console.log(
          `⏳ Still ${pendingCount} pending equipment items for clearance request ${requestId}`
        );

        // If there are still pending items and status is Pending, update to In Progress
        if (clearanceRequest.status === "Pending" && clearedCount > 0) {
          // At least one equipment has been inspected
          const { error: updateError } = await supabase
            .from("clearance_requests")
            .update({
              status: "In Progress",
              updated_at: new Date().toISOString(),
            })
            .eq("id", requestId);

          if (updateError) {
            console.error(
              `Error updating clearance request ${requestId} to In Progress:`,
              updateError
            );
          } else {
            console.log(
              `🔄 Updated clearance request ${requestId} to In Progress (some equipment inspected)`
            );
          }
        }
      }
    }
  } catch (error) {
    console.error("Error in checkAndCompletePersonnelClearance:", error);
  }
};
  // Function to update schedule status based on dates
  const updateScheduleStatus = async (inspectionId, scheduledDate) => {
    const todayPST = getTodayInPST();
    let scheduleStatus = "UPCOMING";

    if (scheduledDate === todayPST) {
      scheduleStatus = "ONGOING";
    } else if (scheduledDate < todayPST) {
      scheduleStatus = "MISSED";
    }

    try {
      const { error } = await supabase
        .from("inspections")
        .update({
          schedule_status: scheduleStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", inspectionId);

      if (error) throw error;
      return scheduleStatus;
    } catch (error) {
      console.error("Error updating schedule status:", error);
      return scheduleStatus;
    }
  };

  // You can call this function when loading data or when dates change
  // QR Scanner functions
  const startScanner = async () => {
    setIsRequestingPermission(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
        },
      });

      stream.getTracks().forEach((track) => track.stop());

      if (!qrScannerRef.current?.html5QrcodeScanner) {
        qrScannerRef.current = {
          html5QrcodeScanner: new Html5QrcodeScanner(
            "qr-reader",
            {
              fps: 10,
              qrbox: { width: 250, height: 150 },
            },
            false
          ),
        };

        qrScannerRef.current.html5QrcodeScanner.render(
          async (decodedText) => {
            console.log("Scanned barcode:", decodedText);

            try {
              const { data, error } = await supabase
                .from("inventory")
                .select("*")
                .eq("item_code", decodedText)
                .single();

              if (error && error.code !== "PGRST116") throw error;

              if (data) {
                toast.success(`Scanned: ${data.item_name}`);

                if (showInspectModal && selectedSchedule) {
                  if (data.id === selectedSchedule.equipment_id) {
                    toast.success(
                      "Equipment matched! Proceed with inspection."
                    );
                  } else {
                    toast.warning(
                      "Scanned equipment does not match scheduled equipment"
                    );
                  }
                }
              } else {
                toast.info("No equipment found with this barcode");
              }
            } catch (err) {
              console.error("Error fetching equipment:", err);
              toast.info("Scanned barcode: " + decodedText);
            }

            stopScanner();
          },
          (errorMessage) => {
            if (
              !errorMessage.includes("NotFoundException") &&
              !errorMessage.includes("No MultiFormat Readers")
            ) {
              console.log("Scan status:", errorMessage);
            }
          }
        );
      }
    } catch (error) {
      console.error("Camera permission denied:", error);
      toast.error("Camera access denied. Please allow camera permissions.");
    } finally {
      setIsRequestingPermission(false);
    }
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

  if (isLoading) {
    return (
      <div className="AppInspectorInventoryControl">
        <InspectorSidebar />
        <Hamburger />
        <div
          className={`main-content ${isSidebarCollapsed ? "collapsed" : ""}`}
        >
          <div className={styles.loadingContainer}>
            <h2>Loading inspection data...</h2>
            <p>Initializing system...</p>
          </div>
        </div>
      </div>
    );
  }

  // Render pagination buttons function (similar to InspectionControl)
  const renderPaginationButtons = (
    currentPage,
    totalPages,
    setPage,
    hasNoData
  ) => {
    const buttons = [];

    // Previous button
    buttons.push(
      <button
        key="prev"
        className={`${styles.IEIPaginationBtn} ${
          hasNoData ? styles.IEIDisabled : ""
        }`}
        disabled={currentPage === 1 || hasNoData}
        onClick={() => setPage(Math.max(1, currentPage - 1))}
      >
        Previous
      </button>
    );

    // Always show first page
    buttons.push(
      <button
        key={1}
        className={`${styles.IEIPaginationBtn} ${
          1 === currentPage ? styles.IEIActive : ""
        } ${hasNoData ? styles.IEIDisabled : ""}`}
        onClick={() => setPage(1)}
        disabled={hasNoData}
      >
        1
      </button>
    );

    // Show ellipsis after first page if needed
    if (currentPage > 3) {
      buttons.push(
        <span key="ellipsis1" className={styles.IEIPaginationEllipsis}>
          ...
        </span>
      );
    }

    // Show pages around current page (max 5 pages total including first and last)
    let startPage = Math.max(2, currentPage - 1);
    let endPage = Math.min(totalPages - 1, currentPage + 1);

    // Adjust if we're near the beginning
    if (currentPage <= 3) {
      endPage = Math.min(totalPages - 1, 4);
    }

    // Adjust if we're near the end
    if (currentPage >= totalPages - 2) {
      startPage = Math.max(2, totalPages - 3);
    }

    // Generate middle page buttons
    for (let i = startPage; i <= endPage; i++) {
      if (i > 1 && i < totalPages) {
        buttons.push(
          <button
            key={i}
            className={`${styles.IEIPaginationBtn} ${
              i === currentPage ? styles.IEIActive : ""
            } ${hasNoData ? styles.IEIDisabled : ""}`}
            onClick={() => setPage(i)}
            disabled={hasNoData}
          >
            {i}
          </button>
        );
      }
    }

    // Show ellipsis before last page if needed
    if (currentPage < totalPages - 2) {
      buttons.push(
        <span key="ellipsis2" className={styles.IEIPaginationEllipsis}>
          ...
        </span>
      );
    }

    // Always show last page if there is more than 1 page
    if (totalPages > 1) {
      buttons.push(
        <button
          key={totalPages}
          className={`${styles.IEIPaginationBtn} ${
            totalPages === currentPage ? styles.IEIActive : ""
          } ${hasNoData ? styles.IEIDisabled : ""}`}
          onClick={() => setPage(totalPages)}
          disabled={hasNoData}
        >
          {totalPages}
        </button>
      );
    }

    // Next button
    buttons.push(
      <button
        key="next"
        className={`${styles.IEIPaginationBtn} ${
          hasNoData ? styles.IEIDisabled : ""
        }`}
        disabled={currentPage === totalPages || hasNoData}
        onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
      >
        Next
      </button>
    );

    return buttons;
  };

  // Pagination calculations
  const scheduledTotalPages = Math.max(
    1,
    Math.ceil(scheduledInspections.length / rowsPerPage)
  );
  const scheduledStart = (scheduledCurrentPage - 1) * rowsPerPage;
  const paginatedScheduled = scheduledInspections.slice(
    scheduledStart,
    scheduledStart + rowsPerPage
  );

  const recentTotalPages = Math.max(
    1,
    Math.ceil(recentInspections.length / rowsPerPage)
  );
  const recentStart = (recentCurrentPage - 1) * rowsPerPage;
  const paginatedRecent = recentInspections.slice(
    recentStart,
    recentStart + rowsPerPage
  );
  // Add this helper function near your other functions
  const createAccountabilityRecord = async (
    inspectionId,
    equipmentId,
    personnelId,
    status,
    findings,
    clearanceRequestIds = [] // Change to accept array
  ) => {
    try {
      // 1. Get equipment details
      const { data: equipment, error: equipmentError } = await supabase
        .from("inventory")
        .select(
          `
        assigned_personnel_id,
        current_value,
        price,
        item_name,
        assigned_to,
        personnel:assigned_personnel_id(first_name, last_name, badge_number)
      `
        )
        .eq("id", equipmentId)
        .single();

      if (equipmentError) throw equipmentError;

      // If equipment is unassigned, we need personnelId from inspection
      let targetPersonnelId = personnelId || equipment.assigned_personnel_id;

      if (!targetPersonnelId) {
        console.log("No personnel ID found for equipment");
        return false;
      }

      // 2. Get personnel name
      const { data: personnelData, error: personnelError } = await supabase
        .from("personnel")
        .select("first_name, last_name")
        .eq("id", targetPersonnelId)
        .single();

      const personnelName = personnelData
        ? `${personnelData.first_name || ""} ${
            personnelData.last_name || ""
          }`.trim()
        : equipment.assigned_to || "Unknown";

      // 3. Calculate amount due
      const baseValue = equipment.current_value || equipment.price || 0;
      const amountDue =
        status.toUpperCase() === "LOST" ? baseValue : baseValue * 0.5;

      // 4. Create accountability records for EACH clearance request
      const recordsData = clearanceRequestIds.map((clearanceRequestId) => ({
        personnel_id: targetPersonnelId,
        inventory_id: equipmentId,
        inspection_id: inspectionId,
        record_type: status.toUpperCase(),
        amount_due: amountDue,
        remarks: `Equipment "${
          equipment.item_name
        }" marked as ${status.toLowerCase()} during inspection. Findings: ${
          findings || "No findings specified"
        }`,
        is_settled: false,
        source_type: clearanceRequestId ? "clearance-linked" : "routine",
        record_date: new Date().toISOString().split("T")[0],
        clearance_request_id: clearanceRequestId,
      }));

      // Also create a non-clearance linked record for general accountability
      if (clearanceRequestIds.length === 0) {
        recordsData.push({
          personnel_id: targetPersonnelId,
          inventory_id: equipmentId,
          inspection_id: inspectionId,
          record_type: status.toUpperCase(),
          amount_due: amountDue,
          remarks: `Equipment "${
            equipment.item_name
          }" marked as ${status.toLowerCase()} during inspection. Findings: ${
            findings || "No findings specified"
          }`,
          is_settled: false,
          source_type: "routine",
          record_date: new Date().toISOString().split("T")[0],
        });
      }

      const { data: records, error: recordError } = await supabase
        .from("accountability_records")
        .insert(recordsData)
        .select();

      if (recordError) throw recordError;

      console.log(`Created ${records.length} accountability record(s)`);

      // 5. Update personnel accountability summary for ALL clearance requests
      await Promise.all(
        clearanceRequestIds.map(async (clearanceRequestId) => {
          await updatePersonnelAccountabilitySummary(
            targetPersonnelId,
            clearanceRequestId
          );
        })
      );

      // Also update summary for non-clearance records
      if (clearanceRequestIds.length === 0) {
        await updatePersonnelAccountabilitySummary(targetPersonnelId, null);
      }

      return true;
    } catch (error) {
      console.error("Error creating accountability record:", error);
      toast.error(`Failed to create accountability record: ${error.message}`);
      return false;
    }
  };

  // Helper function to update the summary table
  // Helper function to update the summary table
  const updatePersonnelAccountabilitySummary = async (
    personnelId,
    clearanceRequestId = null
  ) => {
    try {
      // Build query based on whether we're looking for clearance-linked or general records
      let query = supabase
        .from("accountability_records")
        .select(
          `
        amount_due,
        record_type,
        inventory:inventory_id(item_name, current_value)
      `
        )
        .eq("personnel_id", personnelId)
        .eq("is_settled", false)
        .in("record_type", ["LOST", "DAMAGED"]);

      // If clearanceRequestId is provided, get only records for that clearance
      // If null, get only non-clearance records
      if (clearanceRequestId !== null) {
        query = query.eq("clearance_request_id", clearanceRequestId);
      } else {
        query = query.is("clearance_request_id", null);
      }

      const { data: records, error } = await query;

      if (error) throw error;

      let total_outstanding_amount = 0;
      let lost_equipment_count = 0;
      let damaged_equipment_count = 0;
      let lost_equipment_value = 0;
      let damaged_equipment_value = 0;

      records?.forEach((record) => {
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

      // Get personnel info
      const { data: personnel, error: personnelError } = await supabase
        .from("personnel")
        .select("first_name, last_name, rank, badge_number")
        .eq("id", personnelId)
        .single();

      if (personnelError) throw personnelError;

      const personnel_name = `${personnel.first_name} ${personnel.last_name}`;

      // Update or insert into summary table
      const summaryData = {
        personnel_id: personnelId,
        personnel_name: personnel_name,
        rank: personnel.rank,
        badge_number: personnel.badge_number,
        total_equipment_count: lost_equipment_count + damaged_equipment_count,
        lost_equipment_count: lost_equipment_count,
        damaged_equipment_count: damaged_equipment_count,
        lost_equipment_value: lost_equipment_value,
        damaged_equipment_value: damaged_equipment_value,
        total_outstanding_amount: total_outstanding_amount,
        accountability_status:
          total_outstanding_amount > 0 ? "UNSETTLED" : "SETTLED",
        last_inspection_date: new Date().toISOString().split("T")[0],
        updated_at: new Date().toISOString(),
        calculated_at: new Date().toISOString(),
      };

      // Add clearance_request_id only if it exists
      if (clearanceRequestId !== null) {
        summaryData.clearance_request_id = clearanceRequestId;

        // Get clearance type for this specific request
        const { data: clearanceRequest, error: clearanceError } = await supabase
          .from("clearance_requests")
          .select("type, status")
          .eq("id", clearanceRequestId)
          .single();

        if (!clearanceError && clearanceRequest) {
          summaryData.clearance_type = clearanceRequest.type;
          summaryData.clearance_status = clearanceRequest.status;
        } else {
          summaryData.clearance_type =
            "Resignation/Retirement/Equipment Completion";
          summaryData.clearance_status = "Pending";
        }

        summaryData.clearance_request_date = new Date()
          .toISOString()
          .split("T")[0];
      }

      // Check if record exists
      let checkQuery = supabase
        .from("personnel_equipment_accountability_table")
        .select("id")
        .eq("personnel_id", personnelId);

      if (clearanceRequestId !== null) {
        checkQuery = checkQuery.eq("clearance_request_id", clearanceRequestId);
      } else {
        checkQuery = checkQuery.is("clearance_request_id", null);
      }

      const { data: existingRecord, error: checkError } =
        await checkQuery.maybeSingle();

      if (checkError) throw checkError;

      if (existingRecord) {
        // Update existing record
        const { error: updateError } = await supabase
          .from("personnel_equipment_accountability_table")
          .update(summaryData)
          .eq("id", existingRecord.id);

        if (updateError) throw updateError;
      } else {
        // Insert new record
        const { error: insertError } = await supabase
          .from("personnel_equipment_accountability_table")
          .insert([summaryData]);

        if (insertError) throw insertError;
      }

      console.log("Updated personnel accountability summary");
    } catch (error) {
      console.error("Error updating accountability summary:", error);
      throw error;
    }
  };
  return (
    <div className="AppInspectorInventoryControl">
      <Title>Inspector Equipment Inspection | BFP Villanueva</Title>
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
        {/* Pending Clearances Section */}
        <h1>Equipment Inspection</h1>

        {/* Updated Pending Clearances Section with Carousel */}
        <section className={styles.IEISection}>
          <div className={styles.IEISectionHeader}>
            <h2>Pending Clearance Inspections</h2>
          </div>

          <div className={styles.clearanceCarousel}>
            {pendingClearances.length > 0 ? (
              <>
                <button
                  className={`${styles.carouselBtn} ${styles.prevBtn}`}
                  onClick={handlePrevClick}
                  disabled={currentCarouselPage === 0}
                >
                  ‹
                </button>

                <div className={styles.carouselContainer}>
                  <div
                    className={styles.carouselTrack}
                    style={{
                      transform: `translateX(-${currentCarouselPage * 100}%)`,
                    }}
                  >
                    {chunkedClearances.map((chunk, chunkIndex) => (
                      <div key={chunkIndex} className={styles.carouselSlide}>
                        <div className={styles.clearanceGrid}>
                          {chunk.map((clearance) => (
                            <div
                              key={clearance.id}
                              className={styles.clearanceCard}
                            >
                              <div className={styles.clearanceCardHeader}>
                                <h3>{clearance.personnel_name}</h3>
                                <span className={styles.badgeNumber}>
                                  {clearance.badge_number}
                                </span>
                              </div>
                              <div className={styles.clearanceCardDetails}>
                                <p>
                                  <strong>Clearance Type:</strong>{" "}
                                  {clearance.type}
                                </p>
                                <p>
                                  <strong>Equipment Items:</strong>
                                  {clearance.equipment_count}
                                </p>
                                <p>
                                  <strong>Status:</strong>
                                  <span
                                    className={`${styles.statusBadge} ${
                                      styles[
                                        clearance.request_status?.replace(
                                          " ",
                                          ""
                                        )
                                      ]
                                    }`}
                                  >
                                    {clearance.request_status}
                                  </span>
                                </p>
                                <p>
                                  <strong>Request Date:</strong>
                                  {formatDate(clearance.request_created_at)}
                                </p>
                              </div>
                              <div className={styles.clearanceCardActions}>
                                <button
                                  className={styles.viewClearanceBtn}
                                  onClick={() =>
                                    viewClearanceDetails(clearance.id)
                                  }
                                >
                                  View Details
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  className={`${styles.carouselBtn} ${styles.nextBtn}`}
                  onClick={handleNextClick}
                  disabled={currentCarouselPage === totalCarouselPages - 1}
                >
                  ›
                </button>

                <div className={styles.carouselDots}>
                  {Array.from({ length: totalCarouselPages }).map(
                    (_, index) => (
                      <button
                        key={index}
                        className={`${styles.carouselDot} ${
                          currentCarouselPage === index ? styles.active : ""
                        }`}
                        onClick={() => setCurrentCarouselPage(index)}
                      />
                    )
                  )}
                </div>
              </>
            ) : (
              <div className={styles.noClearances}>
                <div style={{ fontSize: "48px", marginBottom: "16px" }}>
                  <span className={styles.animatedEmoji}>🪪</span>
                </div>
                <p>No pending clearance inspections</p>
              </div>
            )}
          </div>
        </section>

        {/* Rest of your component remains the same */}
        <section className={styles.IEISection}>
          <div className={styles.scheduleCard}>
            <div className={styles.scheduleCardHeader}>
              <h2>Schedule New Inspection</h2>
              <button
                className={`${styles.scheduleShowFormBtn} ${
                  styles.scheduleSubmit
                }${showScheduleForm ? styles.showing : ""}`}
                onClick={() => setShowScheduleForm(!showScheduleForm)}
                type="button"
              >
                {showScheduleForm ? "Hide Schedule Form" : "Schedule New"}
              </button>
            </div>

            {/* UPDATED: Show/hide form instead of modal */}
            <div
              ref={scheduleFormRef}
              className={`${styles.scheduleForm} ${
                showScheduleForm ? styles.show : ""
              }`}
            >
              <div className={styles.scheduleFormContent}>
                <div className={styles.scheduleFormRow}>
                  {/* UPDATED Schedule Date Field with Flatpickr */}
                  <div className={styles.scheduleFormGroup}>
                    <div className={styles.floatingGroup}>
                      <Flatpickr
                        value={formData.scheduled_date}
                        onChange={([date]) => {
                          if (date) {
                            // Option A: Use local date string (safer)
                            const year = date.getFullYear();
                            const month = String(date.getMonth() + 1).padStart(
                              2,
                              "0"
                            );
                            const day = String(date.getDate()).padStart(2, "0");
                            const dateStr = `${year}-${month}-${day}`;

                            // Option B: Use Date.toLocaleDateString
                            // const dateStr = date.toLocaleDateString('en-CA'); // YYYY-MM-DD format

                            setFormData({
                              ...formData,
                              scheduled_date: dateStr,
                            });
                          } else {
                            setFormData({
                              ...formData,
                              scheduled_date: "",
                            });
                          }
                        }}
                        options={{
                          dateFormat: "Y-m-d",
                          minDate: "today",
                          // Add timezone handling
                          time_24hr: false,
                          disableMobile: true, // Disable mobile native picker for consistency
                        }}
                        className={styles.floatingInput}
                        placeholder=" "
                      />
                      <label
                        htmlFor="scheduledDate"
                        className={styles.floatingLabel}
                      >
                        Scheduled Date
                      </label>
                    </div>
                  </div>

                  <div className={styles.scheduleFormGroup}>
                    <div className={styles.floatingGroup}>
                      <select
                        id="inspector"
                        className={styles.floatingSelect}
                        value={formData.inspector_id}
                        onChange={(e) => {
                          setFormData({
                            ...formData,
                            inspector_id: e.target.value,
                          });
                        }}
                        required
                      >
                        <option value=""></option>
                        {personnelList.map((person) => (
                          <option key={person.id} value={person.id}>
                            {person.first_name} {person.last_name}
                            {person.badge_number
                              ? ` (${person.badge_number})`
                              : ""}
                          </option>
                        ))}
                      </select>
                      <label
                        htmlFor="inspector"
                        className={styles.floatingLabel}
                      >
                        Inspector *
                      </label>
                    </div>
                  </div>

                  {/* In your schedule form - Update the personnel filter */}
                  <div className={styles.scheduleFormGroup}>
                    <div className={styles.floatingGroup}>
                      <select
                        id="selectedPersonnel"
                        className={styles.floatingSelect}
                        value={formData.selected_personnel}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            selected_personnel: e.target.value,
                          })
                        }
                        style={{
                          maxWidth: "100%",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        <option value="">All Personnel</option>
                        <option value="Unassigned">Unassigned</option>
                        {getAssignedPersonnel().map((personName, index) => (
                          <option
                            key={index}
                            value={personName}
                            title={personName} /* Add tooltip for full name */
                          >
                            {personName.length > 30
                              ? `${personName.substring(0, 30)}...`
                              : personName}
                          </option>
                        ))}
                      </select>
                      <label
                        htmlFor="selectedPersonnel"
                        className={styles.floatingLabel}
                      >
                        Filter by Personnel
                      </label>
                    </div>
                  </div>
                </div>

                <div className={styles.equipmentSelectionSection}>
                  <h4>
                    Select Equipment to Inspect
                    {formData.selected_personnel && (
                      <span className={styles.filterNote}>
                        (Filtered by: {formData.selected_personnel})
                      </span>
                    )}
                  </h4>
                  <div className={styles.equipmentFilters}>
                    <input
                      type="text"
                      placeholder="🔍 Search equipment..."
                      value={equipmentSearch}
                      onChange={(e) => setEquipmentSearch(e.target.value)}
                      className={styles.searchInput}
                    />

                    <select
                      value={equipmentFilterCategory}
                      onChange={(e) =>
                        setEquipmentFilterCategory(e.target.value)
                      }
                      className={styles.filterSelect}
                    >
                      <option value="">All Categories</option>
                      <option value="Firefighting Equipment">
                        Firefighting Equipment
                      </option>
                      <option value="Protective Gear">Protective Gear</option>
                      <option value="Vehicle Equipment">
                        Vehicle Equipment
                      </option>
                      <option value="Communication Equipment">
                        Communication Equipment
                      </option>
                      <option value="Medical Equipment">
                        Medical Equipment
                      </option>
                      <option value="Tools">Tools</option>
                      <option value="Other">Other</option>
                    </select>

                    <select
                      value={equipmentFilterStatus}
                      onChange={(e) => setEquipmentFilterStatus(e.target.value)}
                      className={styles.filterSelect}
                    >
                      <option value="">All Status</option>
                      <option value="Good">Good</option>
                      <option value="Needs Maintenance">
                        Needs Maintenance
                      </option>
                      <option value="Damaged">Damaged</option>
                      <option value="Under Repair">Under Repair</option>
                      <option value="Retired">Retired</option>
                      <option value="Lost">Lost</option>
                    </select>
                  </div>

                  <button
                    onClick={async () => {
                      const testEquipmentId =
                        "00cf0cd6-7e91-4fd5-9753-4cd6471d73ab";

                      const { data, error } = await supabase
                        .from("clearance_inventory")
                        .update({
                          status: "Cleared",
                          inspector_name: "TEST",
                          inspector_id: "f979e5dd-4227-4bb5-9f84-c444827a4196",
                          updated_at: new Date().toISOString(),
                        })
                        .eq("inventory_id", testEquipmentId)
                        .eq("status", "Pending")
                        .select();

                      console.log("Manual test result:", { data, error });
                    }}
                    style={{
                      margin: "10px",
                      padding: "10px",
                      background: "#ff9900",
                    }}
                  >
                    Test Clearance Update
                  </button>
                  <div className={styles.equipmentTableContainer}>
                    <div className={styles.selectionSummary}>
                      <p>
                        Selected: {selectedEquipmentForSchedule.length}
                        equipment items
                        {selectableEquipmentCount !==
                          filteredEquipment.length && (
                          <span className={styles.selectableNote}>
                            ({selectableEquipmentCount} of
                            {filteredEquipment.length} available for scheduling)
                          </span>
                        )}
                      </p>
                    </div>
                    <table className={styles.equipmentTable}>
                      <thead>
                        <tr>
                          <th style={{ width: "50px" }}>
                            <input
                              type="checkbox"
                              checked={
                                selectedEquipmentForSchedule.length ===
                                  selectableEquipmentCount &&
                                selectableEquipmentCount > 0
                              }
                              onChange={() => {
                                if (
                                  selectedEquipmentForSchedule.length ===
                                  selectableEquipmentCount
                                ) {
                                  // Deselect all
                                  setSelectedEquipmentForSchedule([]);
                                } else {
                                  // Select only equipment WITHOUT pending inspections
                                  const selectableIds = filteredEquipment
                                    .filter(
                                      (item) => !pendingInspectionsMap[item.id]
                                    )
                                    .map((item) => item.id);
                                  setSelectedEquipmentForSchedule(
                                    selectableIds
                                  );
                                }
                              }}
                              disabled={selectableEquipmentCount === 0}
                            />
                          </th>
                          <th>Equipment Name</th>
                          <th>Barcode/Serial Number</th>
                          <th>Category</th>
                          <th>Status</th>
                          <th>Assigned To</th>
                          <th>Assigned Date</th>
                          <th>Last Assigned</th>
                          <th>Unassigned Date</th>
                          <th>Clearance Request</th>
                          <th>Price</th>
                          <th>Purchase Date</th>
                          <th>Last Checked</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredEquipment.length > 0 ? (
                          filteredEquipment.map((item) => {
                            const clearanceInfo =
                              equipmentClearanceMap[item.id];
                            const hasClearance =
                              clearanceInfo?.hasClearance || false;
                            const clearanceType = clearanceInfo?.type || "";
                            const hasPendingInspection =
                              pendingInspectionsMap &&
                              pendingInspectionsMap[item.id];

                            return (
                              <tr
                                key={item.id}
                                style={
                                  hasClearance
                                    ? { backgroundColor: "#fff9e6" }
                                    : hasPendingInspection
                                    ? {
                                        backgroundColor: "#ffe6e6",
                                        opacity: 0.6,
                                      }
                                    : {}
                                }
                              >
                                <td>
                                  <input
                                    type="checkbox"
                                    checked={selectedEquipmentForSchedule.includes(
                                      item.id
                                    )}
                                    onChange={() =>
                                      toggleEquipmentSelection(item.id)
                                    }
                                    disabled={hasPendingInspection}
                                  />
                                </td>
                                <td>{item.item_name}</td>
                                <td>{item.item_code}</td>
                                <td>{item.category}</td>
                                <td>
                                  <span
                                    className={`${styles.statusBadge} ${
                                      styles[item.status?.replace(" ", "")]
                                    }`}
                                  >
                                    {item.status}
                                  </span>
                                </td>
                                <td
                                  className={styles.personnelCell}
                                  title={item.assigned_to}
                                >
                                  {item.assigned_to &&
                                  item.assigned_to.length > 20
                                    ? `${item.assigned_to.substring(0, 20)}...`
                                    : item.assigned_to}
                                </td>
                                <td>
                                  {item.assigned_date
                                    ? formatDate(item.assigned_date)
                                    : "N/A"}
                                </td>
                                <td>{item.last_assigned || "N/A"}</td>
                                <td>
                                  {item.unassigned_date
                                    ? formatDate(item.unassigned_date)
                                    : "N/A"}
                                </td>
                                <td>
                                  {hasClearance ? (
                                    <div className={styles.clearanceIndicator}>
                                      <span className={styles.clearanceBadge}>
                                        ⚠️ {clearanceInfo.type}
                                        {clearanceInfo.originalTypes?.length >
                                          1 && (
                                          <span
                                            className={styles.multipleBadge}
                                          >
                                            (
                                            {clearanceInfo.originalTypes.length}
                                            )
                                          </span>
                                        )}
                                      </span>
                                      {clearanceInfo.originalTypes?.length >
                                        1 && (
                                        <div
                                          className={
                                            styles.multipleClearanceTooltip
                                          }
                                        >
                                          <p>Multiple Clearance Types:</p>
                                          <ul>
                                            {clearanceInfo.originalTypes.map(
                                              (type, idx) => (
                                                <li key={idx}>{type}</li>
                                              )
                                            )}
                                          </ul>
                                        </div>
                                      )}
                                    </div>
                                  ) : hasPendingInspection ? (
                                    <div
                                      className={
                                        styles.pendingInspectionIndicator
                                      }
                                    >
                                      <span className={styles.pendingBadge}>
                                        ⚠️ Pending Inspection
                                      </span>
                                    </div>
                                  ) : (
                                    <span className={styles.noClearance}>
                                      —
                                    </span>
                                  )}
                                </td>
                                <td>
                                  {item.price ? formatPHP(item.price) : "₱0.00"}
                                </td>
                                <td>{formatDate(item.purchase_date)}</td>
                                <td>{formatDate(item.last_checked)}</td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan="100" className={styles.noEquipment}>
                              {formData.selected_personnel
                                ? `No equipment found assigned to ${formData.selected_personnel}`
                                : "No equipment found matching your criteria"}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className={styles.selectionSummary}>
                    <p>
                      Selected: {selectedEquipmentForSchedule.length} equipment
                      items
                    </p>
                  </div>
                </div>

                <div className={styles.scheduleFormActions}>
                  <button
                    type="button"
                    className={styles.scheduleCancel}
                    onClick={resetScheduleForm}
                  >
                    Clear Form
                  </button>
                  <button
                    type="button"
                    className={styles.scheduleSubmit}
                    onClick={handleCreateSchedule}
                    disabled={selectedEquipmentForSchedule.length === 0}
                  >
                    Schedule {selectedEquipmentForSchedule.length} Inspection(s)
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Scheduled Inspections Table */}
          <div className={styles.tableHeaderSection}>
            <h2>Scheduled Inspections</h2>
          </div>

          <div className={styles.IEITopPagination}>
            {renderPaginationButtons(
              scheduledCurrentPage,
              scheduledTotalPages,
              setScheduledCurrentPage,
              scheduledInspections.length === 0
            )}
          </div>

          {scheduledInspections.length > 0 ? (
            <div className={styles.tableBorder}>
              <table className={styles.IEITable}>
                <thead>
                  <tr>
                    <th>Item Code</th>
                    <th>Equipment</th>
                    <th>Category</th>
                    <th>Equipment Status</th>
                    <th>Assigned Date</th>
                    <th>Last Checked</th>
                    <th>Scheduled Date</th>
                    <th>Schedule Status</th>
                    <th>Assigned To</th>
                    <th>Clearance Type</th>
                    <th>Inspector</th>
                    <th>Reschedule Info</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {scheduledInspections.map((inspection, index) => {
                    const isToday = isScheduleToday(inspection.scheduled_date);
                    const isFuture = isScheduleFuture(
                      inspection.scheduled_date
                    );

                    // Calculate schedule status if not already set
                    let displayScheduleStatus = inspection.schedule_status;
                    if (!displayScheduleStatus) {
                      if (isToday) {
                        displayScheduleStatus = "ONGOING";
                      } else if (isFuture) {
                        displayScheduleStatus = "UPCOMING";
                      } else {
                        displayScheduleStatus = "MISSED";
                      }
                    }

                    // Get clearance type for this equipment
                    const clearanceInfo =
                      equipmentClearanceMap[inspection.equipment_id];
                    const hasClearance = clearanceInfo?.hasClearance || false;
                    const clearanceType = clearanceInfo?.type || "";

                    return (
                      <tr
                        key={inspection.id}
                        className={
                          highlightedRow === index ? styles.IEIHighlight : ""
                        }
                      >
                        <td>{inspection.item_code}</td>
                        <td>{inspection.equipment_name}</td>
                        <td>{inspection.equipment_category}</td>
                        <td>
                          <span
                            className={`${styles.statusBadge} ${
                              styles[
                                inspection.equipment_status?.replace(" ", "")
                              ]
                            }`}
                          >
                            {inspection.equipment_status}
                          </span>
                        </td>
                        <td>
                          {inspection.equipment_assigned_date
                            ? formatDate(inspection.equipment_assigned_date)
                            : "N/A"}
                        </td>
                        <td>
                          {inspection.equipment_last_checked
                            ? formatDate(inspection.equipment_last_checked)
                            : "N/A"}
                        </td>
                        <td>{formatDate(inspection.scheduled_date)}</td>
                        <td>
                          {/* Schedule Status Badge */}
                          <span
                            className={`${styles.scheduleStatusBadge} ${
                              styles[displayScheduleStatus?.toLowerCase()]
                            }`}
                          >
                            {displayScheduleStatus}
                          </span>
                        </td>
                        <td>{inspection.assigned_to}</td>
                        {/* Clearance Type Column */}
                        <td>
                          {hasClearance ? (
                            <div className={styles.clearanceIndicator}>
                              <span className={styles.clearanceBadge}>
                                ⚠️ {clearanceType}
                                {clearanceInfo.originalTypes?.length > 1 && (
                                  <span className={styles.multipleBadge}>
                                    ({clearanceInfo.originalTypes.length})
                                  </span>
                                )}
                              </span>
                            </div>
                          ) : (
                            <span className={styles.noClearance}>—</span>
                          )}
                        </td>
                        <td>{inspection.inspector_name}</td>
                        <td>
                          {inspection.reschedule_inspection_date &&
                            inspection.reschedule_inspection_date !==
                              inspection.schedule_inspection_date && (
                              <div className={styles.rescheduleInfo}>
                                <div>
                                  <strong>Originally Scheduled:</strong>
                                  {formatDate(
                                    inspection.schedule_inspection_date
                                  )}
                                </div>
                                <div>
                                  <strong>Rescheduled to:</strong>
                                  {formatDate(
                                    inspection.reschedule_inspection_date
                                  )}
                                </div>
                                {inspection.reschedule_reason && (
                                  <div className={styles.rescheduleReason}>
                                    <strong>Reason:</strong>
                                    {inspection.reschedule_reason}
                                  </div>
                                )}
                              </div>
                            )}
                          {(!inspection.reschedule_inspection_date ||
                            inspection.reschedule_inspection_date ===
                              inspection.schedule_inspection_date) && (
                            <span className={styles.noReschedule}>—</span>
                          )}
                        </td>
                        <td>
                          <div className={styles.actionButtons}>
                            {inspection.inspection_status === "Scheduled" &&
                              isFuture && (
                                <button
                                  className={`${styles.IEIBtn} ${styles.IEICheckup}`}
                                  onClick={() => handleCheckup(inspection)}
                                >
                                  Check Up
                                </button>
                              )}
                            {inspection.inspection_status === "Scheduled" &&
                              isToday && (
                                <button
                                  className={`${styles.IEIBtn} ${styles.IEIInspect}`}
                                  onClick={() => handleInspect(inspection)}
                                >
                                  Inspect
                                </button>
                              )}
                            {inspection.inspection_status === "Scheduled" && (
                              <button
                                className={`${styles.IEIBtn} ${styles.IEIReschedule}`}
                                onClick={() =>
                                  rescheduleInspection(inspection.id)
                                }
                              >
                                Reschedule
                              </button>
                            )}
                            {inspection.inspection_status === "Completed" && (
                              <span className={styles.completedText}>
                                Completed
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.noData}>
              <div style={{ fontSize: "48px", marginBottom: "16px" }}>
                <span className={styles.animatedEmoji}>📋</span>
              </div>
              <h3
                style={{
                  fontSize: "18px",
                  fontWeight: "600",
                  color: "#2b2b2b",
                  marginBottom: "8px",
                }}
              >
                No Scheduled Inspections
              </h3>
              <p style={{ fontSize: "14px", color: "#999" }}>
                Schedule your first equipment inspection to get started
              </p>
            </div>
          )}
          <div className={styles.IEIBottomPagination}>
            {renderPaginationButtons(
              scheduledCurrentPage,
              scheduledTotalPages,
              setScheduledCurrentPage,
              scheduledInspections.length === 0
            )}
          </div>
        </section>

        {/* Recent Inspections Section with Filters */}
        <section className={styles.IEISection}>
          <div className={styles.IEISectionHeader}>
            <h2>Recent Inspections</h2>
          </div>

          {/* Filters Container */}
          <div className={styles.recentFiltersContainer}>
            <div className={styles.recentFiltersHeader}>
              <h3>Filter & Search</h3>
              <span className={styles.recentResultsInfo}>
                Showing {filteredRecentInspections.length} of{" "}
                {recentInspections.length} inspections
              </span>
            </div>

            {/* Search Bar */}
            <div className={styles.recentFilterGroup}>
              <input
                type="text"
                className={styles.recentSearchInput}
                placeholder="Search equipment, inspector, findings..."
                value={recentSearch}
                onChange={(e) => {
                  setRecentSearch(e.target.value);
                  setRecentCurrentPage(1);
                }}
              />
            </div>

            {/* Filter Grid */}
            <div className={styles.recentFiltersGrid}>
              <div className={styles.recentFilterGroup}>
                <label>Category</label>
                <select
                  className={styles.recentFilterSelect}
                  value={recentFilterCategory}
                  onChange={(e) => {
                    setRecentFilterCategory(e.target.value);
                    setRecentCurrentPage(1);
                  }}
                >
                  <option value="">All Categories</option>
                  {getRecentCategories().map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.recentFilterGroup}>
                <label>Equipment Status</label>
                <select
                  className={styles.recentFilterSelect}
                  value={recentFilterStatus}
                  onChange={(e) => {
                    setRecentFilterStatus(e.target.value);
                    setRecentCurrentPage(1);
                  }}
                >
                  <option value="">All Status</option>
                  {getRecentEquipmentStatuses().map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.recentFilterGroup}>
                <label>Inspection Result</label>
                <select
                  className={styles.recentFilterSelect}
                  value={recentFilterResult}
                  onChange={(e) => {
                    setRecentFilterResult(e.target.value);
                    setRecentCurrentPage(1);
                  }}
                >
                  <option value="">All Results</option>
                  <option value="PASS">Pass</option>
                  <option value="FAIL">Fail</option>
                </select>
              </div>
            </div>

            {/* Active Filters Display */}
            {(recentFilterCategory ||
              recentFilterStatus ||
              recentFilterResult ||
              recentSearch) && (
              <div className={styles.recentActiveFilters}>
                {recentSearch && (
                  <span className={styles.recentFilterTag}>
                    Search: "{recentSearch}"
                    <button onClick={() => setRecentSearch("")}>×</button>
                  </span>
                )}
                {recentFilterCategory && (
                  <span className={styles.recentFilterTag}>
                    Category: {recentFilterCategory}
                    <button onClick={() => setRecentFilterCategory("")}>
                      ×
                    </button>
                  </span>
                )}
                {recentFilterStatus && (
                  <span className={styles.recentFilterTag}>
                    Status: {recentFilterStatus}
                    <button onClick={() => setRecentFilterStatus("")}>×</button>
                  </span>
                )}
                {recentFilterResult && (
                  <span className={styles.recentFilterTag}>
                    Result: {recentFilterResult}
                    <button onClick={() => setRecentFilterResult("")}>×</button>
                  </span>
                )}
              </div>
            )}

            {/* Filter Actions */}
            <div className={styles.recentFiltersActions}>
              <button
                className={`${styles.recentFilterBtn} ${styles.recentResetBtn}`}
                onClick={resetRecentFilters}
              >
                Reset Filters
              </button>
            </div>
          </div>

          {/* Pagination */}
          <div className={styles.IEITopPagination}>
            {renderPaginationButtons(
              recentCurrentPage,
              recentTotalPages,
              setRecentCurrentPage,
              filteredRecentInspections.length === 0
            )}
          </div>

          {/* Table */}
          {filteredRecentInspections.length > 0 ? (
            <div className={styles.tableBorder}>
              <table className={styles.IEITable}>
                <thead>
                  <tr>
                    <th>Equipment Name</th>
                    <th>Item Code</th>
                    <th>Category</th>
                    <th>Equipment Status</th>
                    <th>Assigned Date</th>
                    <th>Last Checked</th>
                    <th>Inspection Date</th>
                    <th>Inspector</th>
                    <th>Result</th>
                    <th>Assigned To</th>
                    <th>Findings</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRecent.map((inspection, index) => (
                    <tr key={inspection.id || index}>
                      <td>{inspection.equipment_name}</td>
                      <td>{inspection.item_code}</td>
                      <td>{inspection.equipment_category}</td>
                      <td>
                        <span
                          className={`${styles.statusBadge} ${
                            styles[
                              inspection.equipment_status?.replace(" ", "")
                            ]
                          }`}
                        >
                          {inspection.equipment_status}
                        </span>
                      </td>
                      <td>
                        {inspection.equipment_assigned_date
                          ? formatDateForDisplay(
                              inspection.equipment_assigned_date
                            )
                          : "N/A"}
                      </td>
                      <td>
                        {inspection.equipment_last_checked
                          ? formatDateForDisplay(
                              inspection.equipment_last_checked
                            )
                          : "N/A"}
                      </td>
                      <td>{formatDateForDisplay(inspection.last_checked)}</td>
                      <td>{inspection.inspector}</td>
                      <td>
                        <span
                          className={`${styles.statusBadge} ${
                            styles[inspection.status?.replace(" ", "")]
                          }`}
                        >
                          {inspection.status}
                        </span>
                      </td>
                      <td>{inspection.assigned_to}</td>
                      <td className={styles.findingsCell}>
                        {inspection.findings ? (
                          <button
                            className={styles.viewFindingsBtn}
                            onClick={() => openRecentViewModal(inspection)}
                          >
                            View Details
                          </button>
                        ) : (
                          <span className={styles.noFindings}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.noData}>
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
                No Recent Inspections Found
              </h3>
              <p style={{ fontSize: "14px", color: "#999" }}>
                {recentSearch ||
                recentFilterCategory ||
                recentFilterStatus ||
                recentFilterResult
                  ? "No inspections match your filters. Try adjusting your search criteria."
                  : "No recent inspections available"}
              </p>
              {(recentSearch ||
                recentFilterCategory ||
                recentFilterStatus ||
                recentFilterResult) && (
                <button
                  onClick={resetRecentFilters}
                  style={{
                    marginTop: "10px",
                    padding: "8px 16px",
                    background: "#529ae1",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  Clear All Filters
                </button>
              )}
            </div>
          )}

          <div className={styles.IEIBottomPagination}>
            {renderPaginationButtons(
              recentCurrentPage,
              recentTotalPages,
              setRecentCurrentPage,
              filteredRecentInspections.length === 0
            )}
          </div>
        </section>

        {/* Keep other modals as they were */}
        {/* Checkup Modal */}
        {showCheckupModal && selectedSchedule && (
          <div className={styles.IEIModal}>
            <div className={styles.IEIModalContent}>
              <div className={styles.IEIModalHeader}>
                <h3>Check Up Equipment</h3>
                <button
                  className={styles.IEIModalClose}
                  onClick={() => setShowCheckupModal(false)}
                >
                  ×
                </button>
              </div>

              <div className={styles.scheduleForm}>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label htmlFor="scheduledDate">Scheduled Date *</label>
                    <input
                      type="date"
                      id="scheduledDate"
                      value={formData.scheduled_date}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          scheduled_date: e.target.value,
                        })
                      }
                      required
                      min={new Date().toISOString().split("T")[0]}
                    />
                  </div>

                  {/* Inspector field as select dropdown */}
                  <div className={styles.formGroup}>
                    <label htmlFor="inspector">Inspector *</label>
                    <select
                      id="inspector"
                      value={formData.inspector_id}
                      onChange={(e) => {
                        setFormData({
                          ...formData,
                          inspector_id: e.target.value,
                        });
                      }}
                      required
                      className={styles.inspectorSelect}
                    >
                      <option value=""></option>
                      {personnelList.map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.first_name} {person.last_name}
                          {person.badge_number
                            ? ` (${person.badge_number})`
                            : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Personnel Filter */}
                  <div className={styles.formGroup}>
                    <label htmlFor="selectedPersonnel">
                      Filter by Personnel (Optional)
                    </label>
                    <select
                      id="selectedPersonnel"
                      value={formData.selected_personnel}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          selected_personnel: e.target.value,
                        })
                      }
                    >
                      <option value="">All Personnel</option>
                      <option value="Unassigned">Unassigned</option>
                      {getAssignedPersonnel().map((personName, index) => (
                        <option key={index} value={personName}>
                          {personName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className={styles.equipmentSelectionSection}>
                  <h4>
                    Select Equipment to Inspect
                    {formData.selected_personnel && (
                      <span className={styles.filterNote}>
                        (Filtered by: {formData.selected_personnel})
                      </span>
                    )}
                  </h4>

                  <div className={styles.equipmentFilters}>
                    <input
                      type="text"
                      placeholder="🔍 Search equipment..."
                      value={equipmentSearch}
                      onChange={(e) => setEquipmentSearch(e.target.value)}
                      className={styles.searchInput}
                    />

                    <select
                      value={equipmentFilterCategory}
                      onChange={(e) =>
                        setEquipmentFilterCategory(e.target.value)
                      }
                      className={styles.filterSelect}
                    >
                      <option value="">All Categories</option>
                      <option value="Firefighting Equipment">
                        Firefighting Equipment
                      </option>
                      <option value="Protective Gear">Protective Gear</option>
                      <option value="Vehicle Equipment">
                        Vehicle Equipment
                      </option>
                      <option value="Communication Equipment">
                        Communication Equipment
                      </option>
                      <option value="Medical Equipment">
                        Medical Equipment
                      </option>
                      <option value="Tools">Tools</option>
                      <option value="Other">Other</option>
                    </select>

                    <select
                      value={equipmentFilterStatus}
                      onChange={(e) => setEquipmentFilterStatus(e.target.value)}
                      className={styles.filterSelect}
                    >
                      <option value="">All Status</option>
                      <option value="Good">Good</option>
                      <option value="Needs Maintenance">
                        Needs Maintenance
                      </option>
                      <option value="Damaged">Damaged</option>
                      <option value="Under Repair">Under Repair</option>
                      <option value="Retired">Retired</option>
                      <option value="Lost">Lost</option>
                    </select>
                  </div>

                  <div className={styles.equipmentTableContainer}>
                    <table className={styles.equipmentTable}>
                      <thead>
                        <tr>
                          <th style={{ width: "50px" }}>
                            <input
                              type="checkbox"
                              checked={
                                selectedEquipmentForSchedule.length ===
                                  filteredEquipment.length &&
                                filteredEquipment.length > 0
                              }
                              onChange={() => {
                                if (
                                  selectedEquipmentForSchedule.length ===
                                  filteredEquipment.length
                                ) {
                                  setSelectedEquipmentForSchedule([]);
                                } else {
                                  setSelectedEquipmentForSchedule(
                                    filteredEquipment.map((item) => item.id)
                                  );
                                }
                              }}
                            />
                          </th>
                          <th>Equipment Name</th>
                          <th>Barcode/Serial Number</th>
                          <th>Category</th>
                          <th>Status</th>
                          <th>Assigned To</th>
                          <th>Assigned Date</th>
                          <th>Last Assigned</th>
                          <th>Unassigned Date</th>
                          <th>Clearance Request</th>
                          <th>Price</th>
                          <th>Purchase Date</th>
                          <th>Last Checked</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredEquipment.length > 0 ? (
                          filteredEquipment.map((item) => {
                            const clearanceInfo =
                              equipmentClearanceMap[item.id];
                            const hasClearance =
                              clearanceInfo?.hasClearance || false;
                            const clearanceType = clearanceInfo?.type || "";

                            // Check if this equipment already has pending inspection
                            const hasPendingInspection =
                              pendingInspectionsMap &&
                              pendingInspectionsMap[item.id];

                            return (
                              <tr
                                key={item.id}
                                style={
                                  hasClearance
                                    ? { backgroundColor: "#fff9e6" }
                                    : hasPendingInspection
                                    ? {
                                        backgroundColor: "#ffe6e6",
                                        opacity: 0.6,
                                      }
                                    : {}
                                }
                              >
                                <td>
                                  <input
                                    type="checkbox"
                                    checked={selectedEquipmentForSchedule.includes(
                                      item.id
                                    )}
                                    onChange={() =>
                                      toggleEquipmentSelection(item.id)
                                    }
                                    disabled={hasPendingInspection}
                                  />
                                </td>
                                <td>{item.item_name}</td>
                                <td>{item.item_code}</td>
                                <td>{item.category}</td>
                                <td>
                                  <span
                                    className={`${styles.statusBadge} ${
                                      styles[item.status?.replace(" ", "")]
                                    }`}
                                  >
                                    {item.status}
                                  </span>
                                </td>
                                <td>{item.assigned_to || "Unassigned"}</td>
                                {/* NEW: Assigned Date Column */}
                                <td>
                                  {item.assigned_date
                                    ? formatDate(item.assigned_date)
                                    : "N/A"}
                                </td>
                                {/* NEW: Last Assigned Column */}
                                <td>{item.last_assigned || "N/A"}</td>
                                {/* NEW: Unassigned Date Column */}
                                <td>
                                  {item.unassigned_date
                                    ? formatDate(item.unassigned_date)
                                    : "N/A"}
                                </td>
                                <td>
                                  {hasClearance ? (
                                    <div className={styles.clearanceIndicator}>
                                      <span className={styles.clearanceBadge}>
                                        ⚠️ {clearanceType}
                                      </span>
                                      <div className={styles.clearanceTooltip}>
                                        <p>
                                          Clearance Request ID:
                                          {clearanceInfo.requestId}
                                        </p>
                                        <p>Type: {clearanceType}</p>
                                      </div>
                                    </div>
                                  ) : hasPendingInspection ? (
                                    <div
                                      className={
                                        styles.pendingInspectionIndicator
                                      }
                                    >
                                      <span className={styles.pendingBadge}>
                                        ⚠️ Pending Inspection
                                      </span>
                                      <div className={styles.pendingTooltip}>
                                        <p>
                                          This equipment already has a pending
                                          inspection scheduled.
                                        </p>
                                        <p>
                                          Complete or cancel the existing
                                          inspection first.
                                        </p>
                                      </div>
                                    </div>
                                  ) : (
                                    <span className={styles.noClearance}>
                                      —
                                    </span>
                                  )}
                                </td>
                                <td>
                                  {item.price ? formatPHP(item.price) : "₱0.00"}
                                </td>
                                <td>{formatDate(item.purchase_date)}</td>
                                <td>{formatDate(item.last_checked)}</td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan="100" className={styles.noEquipment}>
                              {formData.selected_personnel
                                ? `No equipment found assigned to ${formData.selected_personnel}`
                                : "No equipment found matching your criteria"}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className={styles.selectionSummary}>
                    <p>
                      Selected: {selectedEquipmentForSchedule.length} equipment
                      items
                    </p>
                  </div>
                </div>

                <div className={styles.IEIModalButtons}>
                  <button
                    type="button"
                    className={styles.IEICancelBtn}
                    onClick={() => setShowScheduleModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={`${styles.IEIBtn} ${styles.IEISubmitBtn}`}
                    onClick={handleCreateSchedule}
                    disabled={selectedEquipmentForSchedule.length === 0}
                  >
                    Schedule {selectedEquipmentForSchedule.length} Inspection(s)
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Checkup Modal */}
        {showCheckupModal && selectedSchedule && (
          <div className={styles.IEIModal}>
            <div className={styles.IEIModalContent}>
              <div className={styles.IEIModalHeader}>
                <h3>Check Up Equipment</h3>
                <button
                  className={styles.IEIModalClose}
                  onClick={() => setShowCheckupModal(false)}
                >
                  ×
                </button>
              </div>

              <div className={styles.checkupForm}>
                <div className={styles.equipmentInfo}>
                  <h4>Equipment Details</h4>
                  <p>
                    <strong>Name:</strong> {selectedSchedule.equipment_name}
                  </p>
                  <p>
                    <strong>Barcode:</strong> {selectedSchedule.item_code}
                  </p>
                  <p>
                    <strong>Scheduled Date:</strong>
                    {formatDate(selectedSchedule.scheduled_date)}
                  </p>
                  <p>
                    <strong>Assigned To:</strong> {selectedSchedule.assigned_to}
                  </p>
                  <p>
                    <strong>Inspector:</strong>
                    {selectedSchedule.inspector_name}
                  </p>

                  {selectedSchedule.clearance_request_id && (
                    <div className={styles.clearanceNotice}>
                      <p>
                        <strong>⚠️ Clearance Request Detected</strong>
                      </p>
                      <p>This inspection is part of a clearance request</p>
                    </div>
                  )}
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="checkupFindings">Findings *</label>
                  <textarea
                    id="checkupFindings"
                    rows="4"
                    value={checkupData.findings}
                    onChange={(e) =>
                      setCheckupData({
                        ...checkupData,
                        findings: e.target.value,
                      })
                    }
                    placeholder="Enter checkup findings..."
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="checkupStatus">Equipment Status *</label>
                  <select
                    id="checkupStatus"
                    value={checkupData.status}
                    onChange={(e) =>
                      setCheckupData({ ...checkupData, status: e.target.value })
                    }
                    required
                  >
                    <option value="Good">Good</option>
                    <option value="Needs Maintenance">Needs Maintenance</option>
                    <option value="Damaged">Damaged</option>
                    <option value="Under Repair">Under Repair</option>
                  </select>
                </div>

                <div className={styles.IEIModalButtons}>
                  <button
                    type="button"
                    className={styles.IEICancelBtn}
                    onClick={() => setShowCheckupModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={`${styles.IEIBtn} ${styles.IEISubmitBtn}`}
                    onClick={submitCheckup}
                  >
                    Complete Checkup
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Inspection Modal */}
        {showInspectModal && selectedSchedule && (
          <div className={styles.IEIModal}>
            <div className={styles.IEIModalContent}>
              <div className={styles.IEIModalHeader}>
                <h3>Inspect Equipment</h3>
                <button
                  className={styles.IEIModalClose}
                  onClick={() => setShowInspectModal(false)}
                >
                  ×
                </button>
              </div>

              <div className={styles.inspectionForm}>
                <div className={styles.equipmentInfo}>
                  <h4>Equipment Details</h4>
                  <p>
                    <strong>Name:</strong> {selectedSchedule.equipment_name}
                  </p>
                  <p>
                    <strong>Barcode:</strong> {selectedSchedule.item_code}
                  </p>
                  <p>
                    <strong>Scheduled Date:</strong>
                    {formatDate(selectedSchedule.scheduled_date)}
                  </p>
                  <p>
                    <strong>Assigned To:</strong> {selectedSchedule.assigned_to}
                  </p>
                  <p>
                    <strong>Inspector:</strong>
                    {selectedSchedule.inspector_name}
                  </p>

                  {selectedSchedule.clearance_request_id && (
                    <div className={styles.clearanceNotice}>
                      <p>
                        <strong>⚠️ Clearance Request Detected</strong>
                      </p>
                      <p>This inspection is part of a clearance request</p>
                    </div>
                  )}
                </div>

                {/* Barcode Scanner Section */}
                <div className={styles.barcodeScannerSection}>
                  <h4>Scan Equipment Barcode</h4>
                  <button
                    type="button"
                    className={styles.scanBtn}
                    onClick={() => {
                      setShowScanner(true);
                      startScanner();
                    }}
                    disabled={isRequestingPermission}
                  >
                    {isRequestingPermission
                      ? "Requesting Camera..."
                      : "📷 Scan Barcode"}
                  </button>

                  {showScanner && (
                    <div className={styles.scannerContainer}>
                      <div id="qr-reader"></div>
                      <button
                        className={styles.stopScanBtn}
                        onClick={stopScanner}
                      >
                        Stop Scanner
                      </button>
                    </div>
                  )}
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="inspectionFindings">Findings *</label>
                  <textarea
                    id="inspectionFindings"
                    rows="4"
                    value={inspectionData.findings}
                    onChange={(e) =>
                      setInspectionData({
                        ...inspectionData,
                        findings: e.target.value,
                      })
                    }
                    placeholder="Enter inspection findings..."
                    required
                  />
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label htmlFor="inspectionStatus">
                      Inspection Result *
                    </label>
                    <select
                      id="inspectionStatus"
                      value={inspectionData.status}
                      onChange={(e) =>
                        setInspectionData({
                          ...inspectionData,
                          status: e.target.value,
                        })
                      }
                      required
                    >
                      <option value="PASS">Pass</option>
                      <option value="FAIL">Fail</option>
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="equipmentStatus">Equipment Status *</label>
                    <select
                      id="equipmentStatus"
                      value={inspectionData.equipmentStatus}
                      onChange={(e) =>
                        setInspectionData({
                          ...inspectionData,
                          equipmentStatus: e.target.value,
                        })
                      }
                      required
                    >
                      <option value="Good">Good</option>
                      <option value="Needs Maintenance">
                        Needs Maintenance
                      </option>
                      <option value="Damaged">Damaged</option>
                      <option value="Under Repair">Under Repair</option>
                      <option value="Lost">Lost</option>
                    </select>
                  </div>
                </div>

                <div className={styles.IEIModalButtons}>
                  <button
                    type="button"
                    className={styles.IEICancelBtn}
                    onClick={() => setShowInspectModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={`${styles.IEIBtn} ${styles.IEISubmitBtn}`}
                    onClick={submitInspection}
                  >
                    Complete Inspection
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Reschedule Modal */}
        {showRescheduleModal && (
          <div className={styles.IEIModal}>
            <div className={styles.IEIModalContent}>
              <div className={styles.IEIModalHeader}>
                <h3>Reschedule Inspection</h3>
                <button
                  className={styles.IEIModalClose}
                  onClick={() => {
                    setShowRescheduleModal(false);
                    setRescheduleForm({ newDate: "", reason: "" });
                    setRescheduleId(null);
                  }}
                >
                  ×
                </button>
              </div>

              <div className={styles.rescheduleForm}>
                <div className={styles.formGroup}>
                  <label htmlFor="rescheduleDate">New Inspection Date *</label>
                  <input
                    type="date"
                    id="rescheduleDate"
                    value={rescheduleForm.newDate}
                    onChange={(e) =>
                      setRescheduleForm({
                        ...rescheduleForm,
                        newDate: e.target.value,
                      })
                    }
                    min={new Date().toISOString().split("T")[0]}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="rescheduleReason">
                    Reason for Rescheduling *
                  </label>
                  <textarea
                    id="rescheduleReason"
                    rows="4"
                    value={rescheduleForm.reason}
                    onChange={(e) =>
                      setRescheduleForm({
                        ...rescheduleForm,
                        reason: e.target.value,
                      })
                    }
                    placeholder="Explain why this inspection needs to be rescheduled..."
                    required
                  />
                </div>

                <div className={styles.IEIModalButtons}>
                  <button
                    type="button"
                    className={styles.IEICancelBtn}
                    onClick={() => {
                      setShowRescheduleModal(false);
                      setRescheduleForm({ newDate: "", reason: "" });
                      setRescheduleId(null);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={`${styles.IEIBtn} ${styles.IEISubmitBtn}`}
                    onClick={handleReschedule}
                    disabled={!rescheduleForm.newDate || !rescheduleForm.reason}
                  >
                    Confirm Reschedule
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Clearance Inspection Modal */}
        {showClearanceModal && selectedClearance && (
          <div className={styles.clearanceModalOverlay}>
            <div className={styles.clearanceModal}>
              <div className={styles.clearanceModalHeader}>
                <h3>
                  Clearance Inspection - {selectedClearance.personnel_name}
                </h3>
                <button onClick={() => setShowClearanceModal(false)}>×</button>
              </div>
              <div className={styles.clearanceModalContent}>
                <div className={styles.clearanceInfo}>
                  <p>
                    <strong>Badge:</strong> {selectedClearance.badge_number}
                  </p>
                  <p>
                    <strong>Clearance Type:</strong> {selectedClearance.type}
                  </p>
                  <p>
                    <strong>Status:</strong>
                    <span
                      className={`${styles.statusBadge} ${
                        styles[selectedClearance.status?.replace(" ", "")]
                      }`}
                    >
                      {selectedClearance.status}
                    </span>
                  </p>
                  <p>
                    <strong>Request Date:</strong>
                    {formatDate(selectedClearance.created_at)}
                  </p>
                </div>

                <div className={styles.equipmentInspectionList}>
                  <h4>Equipment to Inspect ({selectedEquipment.length})</h4>
                  {selectedEquipment.length > 0 ? (
                    selectedEquipment.map((item) => (
                      <div key={item.id} className={styles.equipmentItem}>
                        <div className={styles.equipmentInfo}>
                          <h5>{item.name}</h5>
                          <p>
                            <strong>Code:</strong> {item.code}
                          </p>
                          <p>
                            <strong>Category:</strong> {item.category}
                          </p>
                          <p>
                            <strong>Current Status:</strong> {item.status}
                          </p>
                          <p>
                            <strong>Assigned To:</strong> {item.assigned_to}
                          </p>
                          <p>
                            <strong>Clearance Status:</strong>
                            <span
                              className={`${styles.statusBadge} ${
                                styles[item.clearance_status?.toLowerCase()] ||
                                ""
                              }`}
                            >
                              {item.clearance_status}
                            </span>
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className={styles.noEquipment}>
                      <p>No equipment assigned to this clearance</p>
                    </div>
                  )}
                </div>

                <div className={styles.clearanceActions}>
                  <button
                    className={styles.closeModalBtn}
                    onClick={() => setShowClearanceModal(false)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Recent Inspection View Details Modal */}
        {isRecentViewModalOpen && selectedRecentInspection && (
          <div
            className={styles.inspectionViewModalOverlay}
            style={{ display: "flex" }}
            onClick={closeRecentViewModal}
          >
            <div
              className={styles.inspectionViewModalContent}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.inspectionViewModalHeader}>
                <h3 className={styles.inspectionViewModalTitle}>
                  Inspection Details - {selectedRecentInspection.equipment_name}
                </h3>
                <button
                  className={styles.inspectionViewModalCloseBtn}
                  onClick={closeRecentViewModal}
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
                      <span>{selectedRecentInspection.item_code}</span>
                    </div>
                    <div className={styles.viewModalField}>
                      <label>Equipment Name:</label>
                      <span>{selectedRecentInspection.equipment_name}</span>
                    </div>
                    <div className={styles.viewModalField}>
                      <label>Category:</label>
                      <span>{selectedRecentInspection.equipment_category}</span>
                    </div>
                    <div className={styles.viewModalField}>
                      <label>Equipment Status:</label>
                      <span
                        className={`${styles.statusBadge} ${
                          styles[
                            selectedRecentInspection.equipment_status?.replace(
                              " ",
                              ""
                            )
                          ]
                        }`}
                      >
                        {selectedRecentInspection.equipment_status}
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
                      <span>{selectedRecentInspection.assigned_to}</span>
                    </div>
                    <div className={styles.viewModalField}>
                      <label>Assigned Date:</label>
                      <span>
                        {formatDate(
                          selectedRecentInspection.equipment_assigned_date
                        )}
                      </span>
                    </div>
                    <div className={styles.viewModalField}>
                      <label>Last Checked:</label>
                      <span>
                        {formatDate(
                          selectedRecentInspection.equipment_last_checked
                        )}
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
                      <span>{selectedRecentInspection.inspector}</span>
                    </div>
                    <div className={styles.viewModalField}>
                      <label>Inspection Date:</label>
                      <span>{selectedRecentInspection.last_checked}</span>
                    </div>
                    <div className={styles.viewModalField}>
                      <label>Inspection Result:</label>
                      <span
                        className={`${styles.statusBadge} ${
                          styles[
                            selectedRecentInspection.status?.replace(" ", "")
                          ]
                        }`}
                      >
                        {selectedRecentInspection.status}
                      </span>
                    </div>
                    <div className={styles.viewModalField}>
                      <label>Schedule Status:</label>
                      <span>{selectedRecentInspection.schedule_status}</span>
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
                        {selectedRecentInspection.findings ||
                          "No findings recorded"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.inspectionViewModalActions}>
                <button
                  className={styles.viewFindingsBtn}
                  onClick={closeRecentViewModal}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default InspectorEquipmentInspection;
