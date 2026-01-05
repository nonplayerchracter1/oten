import { useState, useEffect, useRef, useMemo } from "react";
import styles from "../styles/InspectorEquipmentInspection.module.css";
import { Title, Meta } from "react-head";
import Flatpickr from "react-flatpickr";
import "flatpickr/dist/flatpickr.css";
import InspectorSidebar from "../../InspectorSidebar";
import Hamburger from "../../Hamburger";
import { useSidebar } from "../../SidebarContext";
import { supabase } from "../../../lib/supabaseClient.js";
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
  // Add these loading states with your other useState declarations:
  const [isInspecting, setIsInspecting] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [recentSearch, setRecentSearch] = useState("");
  const [recentFilterCategory, setRecentFilterCategory] = useState("");
  const [recentFilterStatus, setRecentFilterStatus] = useState("");
  const [recentFilterResult, setRecentFilterResult] = useState("");
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [showCheckupModal, setShowCheckupModal] = useState(false);
  const [showInspectModal, setShowInspectModal] = useState(false);
  const [showClearanceModal, setShowClearanceModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);
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
  
  // Add this helper function for name formatting
  const formatPersonnelName = (personnel) => {
    if (!personnel) return "Unknown";
    
    const { first_name, middle_name, last_name } = personnel;
    
    if (!first_name && !last_name) return "Unknown";
    
    // Format: FirstName + MiddleInitial + LastName
    if (middle_name && middle_name.trim()) {
      // Get first letter of middle name and capitalize it
      const middleInitial = middle_name.trim().charAt(0).toUpperCase();
      return `${first_name || ''} ${middleInitial}. ${last_name || ''}`.trim();
    } else {
      // No middle name, just use first and last
      return `${first_name || ''} ${last_name || ''}`.trim();
    }
  };

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
  
  // Real-time subscription for pending clearances
  useEffect(() => {
    let subscription;

    const setupRealtime = async () => {
      try {
        // Subscribe to clearance_inventory table changes
        subscription = supabase
          .channel("clearance_inventory_changes")
          .on(
            "postgres_changes",
            {
              event: "*", // Listen to INSERT, UPDATE, DELETE
              schema: "public",
              table: "clearance_inventory",
              filter: "status=eq.Pending",
            },
            (payload) => {
              console.log("Clearance inventory change detected:", payload);
              // Refresh pending clearances when any change occurs
              loadPendingClearances();

              // Also refresh other data that might be affected
              loadAllData();

              // Optional: Show notification for new clearances
              if (payload.eventType === "INSERT") {
                toast.info("New pending clearance added");
              }
            }
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "clearance_requests",
              filter: "status=eq.Pending",
            },
            (payload) => {
              console.log("Clearance request change detected:", payload);
              // Refresh when clearance request status changes
              loadPendingClearances();
            }
          )
          .subscribe((status) => {
            console.log("Realtime subscription status:", status);
            setIsRealtimeConnected(status === "SUBSCRIBED");

            if (status === "CHANNEL_ERROR") {
              console.error("Realtime channel error");
              // Fallback to polling
              startPollingFallback();
            }
          });
      } catch (error) {
        console.error("Error setting up realtime:", error);
        // Fallback to polling if realtime fails
        startPollingFallback();
      }
    };

    setupRealtime();

    // Cleanup function
    return () => {
      if (subscription) {
        supabase.removeChannel(subscription);
      }
      stopPollingFallback();
    };
  }, []); // Empty dependency array - only run once on mount

  // Polling fallback state and functions
  const [pollingInterval, setPollingInterval] = useState(null);

  const startPollingFallback = () => {
    console.log("Starting polling fallback for pending clearances");

    // Clear any existing interval
    if (pollingInterval) {
      clearInterval(pollingInterval);
    }

    // Poll every 30 seconds
    const interval = setInterval(() => {
      console.log("Polling for pending clearance updates...");
      loadPendingClearances();
      // Optional: refresh counter for UI indication
      setRefreshCounter((prev) => prev + 1);
    }, 30000); // 30 seconds

    setPollingInterval(interval);
  };

  const stopPollingFallback = () => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
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
  // Replace your existing date comparison functions with these simpler versions
  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Simple check for display purposes only
  const isScheduleToday = (scheduleDate) => {
    if (!scheduleDate) return false;
    const today = getTodayDate();
    const scheduleDateOnly = scheduleDate.split("T")[0];
    return scheduleDateOnly === today;
  };

  // Simple check for display purposes only
  const isScheduleFuture = (scheduleDate) => {
    if (!scheduleDate) return false;
    const today = getTodayDate();
    const scheduleDateOnly = scheduleDate.split("T")[0];
    return scheduleDateOnly > today;
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
        personnel:assigned_personnel_id(first_name, middle_name, last_name, badge_number)
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
          middle_name,
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

          // Format inspector name with middle initial
          const inspectorName = inspection.inspector
            ? formatPersonnelName(inspection.inspector)
            : "Unknown Inspector";

          return {
            ...inspection,
            equipment_name: inventoryItem?.item_name || "Unknown Equipment",
            equipment_id: inspection.equipment_id,
            item_code: inventoryItem?.item_code,
            inspector_name: inspectorName,
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
          middle_name,
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

            // Format inspector name with middle initial
            const inspectorName = insp.inspector
              ? formatPersonnelName(insp.inspector)
              : "Unknown";

            return {
              id: insp.id,
              item_code: inventoryItem?.item_code || "N/A",
              equipment_name: inventoryItem?.item_name || "Unknown Equipment",
              equipment_category: inventoryItem?.category || "Unknown",
              equipment_status: inventoryItem?.status || "Unknown",
              equipment_assigned_date: inventoryItem?.assigned_date || null,
              equipment_last_checked: inventoryItem?.last_checked || null,
              last_checked: formatDate(insp.schedule_inspection_date),
              inspector: inspectorName,
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
  
  // Add loading state for clearances
  const [isLoadingClearances, setIsLoadingClearances] = useState(false);

  // Update the loadPendingClearances function
  const loadPendingClearances = async () => {
    setIsLoadingClearances(true);
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
            middle_name,
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
            personnel_name: formatPersonnelName(request.personnel),
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

      // Store the last update time
      localStorage.setItem("lastClearanceUpdate", new Date().toISOString());
    } catch (error) {
      console.error("Error loading pending clearances:", error);
      setPendingClearances([]);
    } finally {
      setIsLoadingClearances(false);
    }
  };

  const loadPersonnel = async () => {
    try {
      const { data, error } = await supabase
        .from("personnel")
        .select("id, first_name, middle_name, last_name, badge_number")
        .order("last_name", { ascending: true });

      if (error) throw error;
      
      // Format names with middle initials for dropdown display
      const formattedPersonnel = (data || []).map(person => ({
        ...person,
        display_name: formatPersonnelName(person)
      }));
      
      setPersonnelList(formattedPersonnel || []);
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
            middle_name,
            last_name,
            badge_number,
            rank
          )
        `
        )
        .eq("id", clearanceRequestId)
        .single();

      if (requestError) throw requestError;

      const formattedName = formatPersonnelName(requestData.personnel);

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
        personnel_name: formattedName,
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

    if (selectedEquipmentForSchedule.length === 0) {
      toast.error("Please select at least one equipment");
      return;
    }

    if (!formData.scheduled_date || !formData.inspector_id) {
      toast.error("Please fill all required fields");
      return;
    }

    setIsScheduling(true); // Start loading
    try {
      const pendingMap = await checkEquipmentHasPendingInspection(
        selectedEquipmentForSchedule
      );

      const equipmentWithPendingInspections =
        selectedEquipmentForSchedule.filter((equipId) => pendingMap[equipId]);

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
        setIsScheduling(false);
        return;
      }

      const selectedInspector = personnelList.find(
        (person) => person.id === formData.inspector_id
      );

      if (!selectedInspector) {
        toast.error("Selected inspector not found");
        setIsScheduling(false);
        return;
      }

      const inspectorName = formatPersonnelName(selectedInspector);

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
    } finally {
      setIsScheduling(false); // Stop loading
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
          const lost = allItems.filter((item) => item.status === "Lost").length;

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

    setIsInspecting(true); // Start loading
    try {
      const inspectorName = selectedSchedule.inspector_name;
      const inspectorId = selectedSchedule.inspector_id;

      if (!inspectorId) {
        toast.error("No inspector assigned to this inspection");
        setIsInspecting(false);
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
      // The database trigger will automatically set schedule_status = 'DONE'
      // when status is set to 'COMPLETED' or 'FAILED'
      const inspectionStatus =
        inspectionData.status === "PASS" ? "COMPLETED" : "FAILED";

      console.log("📝 Updating inspection record to:", inspectionStatus);
      console.log("📝 Inspection ID:", selectedSchedule.id);

      const { error: inspectionError } = await supabase
        .from("inspections")
        .update({
          status: inspectionStatus,
          findings: inspectionData.findings,
          recommendations:
            inspectionData.status === "PASS"
              ? "Equipment cleared"
              : "Equipment requires attention",
          // Don't set schedule_status here - the trigger will handle it
          // Don't set inspection_date here - the trigger will handle it if needed
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedSchedule.id);

      if (inspectionError) {
        console.error("❌ Error updating inspection:", inspectionError);
        throw inspectionError;
      }

      console.log("✅ Inspection record updated");
      console.log(
        "✅ Database trigger will automatically set schedule_status = 'DONE'"
      );

      // 3. Check and update clearance status
      await checkAndUpdateClearanceStatus(
        selectedSchedule.equipment_id,
        clearanceStatus
      );

      // 4. Update inventory status
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

      // 5. Update clearance_inventory records if they exist
      if (clearanceRecords && clearanceRecords.length > 0) {
        console.log("📝 Updating clearance_inventory records...");

        const clearanceIds = clearanceRecords.map((record) => record.id);
        const updatePayload = {
          status: clearanceStatus,
          inspection_id: selectedSchedule.id,
          inspector_id: inspectorId,
          inspector_name: inspectorName,
          inspection_date: new Date().toISOString().split("T")[0],
          updated_at: new Date().toISOString(),
        };

        // Try to update all clearance records
        const { error: updateError } = await supabase
          .from("clearance_inventory")
          .update(updatePayload)
          .eq("inventory_id", selectedSchedule.equipment_id)
          .eq("status", "Pending");

        if (updateError) {
          console.error("❌ Error updating clearance records:", updateError);
        } else {
          console.log(
            `✅ Updated ${clearanceRecords.length} clearance records`
          );
        }

        // 6. Check each clearance request
        const clearanceRequestIds = [
          ...new Set(clearanceRecords.map((r) => r.clearance_request_id)),
        ];

        for (const requestId of clearanceRequestIds) {
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
      toast.success(
        `Inspection ${inspectionStatus.toLowerCase()} and marked as DONE`
      );

      setShowInspectModal(false);

      // 9. Reload data to see the updated schedule_status
      loadAllData();
      loadPendingClearances();
    } catch (error) {
      console.error("❌ Error submitting inspection:", error);
      toast.error("Failed to submit inspection: " + error.message);
    } finally {
      setIsInspecting(false); // Stop loading
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

  const checkAndCompletePersonnelClearance = async (
    personnelId,
    requestIds
  ) => {
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
          console.error(
            `Error checking clearance request ${requestId}:`,
            error
          );
          continue;
        }

        if (!allEquipment || allEquipment.length === 0) {
          console.log(
            `ℹ️ No equipment found for clearance request ${requestId}`
          );
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
        const lostCount = allEquipment.filter(
          (e) => e.status === "Lost"
        ).length;

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
        personnel:assigned_personnel_id(first_name, middle_name, last_name, badge_number)
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
        .select("first_name, middle_name, last_name")
        .eq("id", targetPersonnelId)
        .single();

      const personnelName = personnelData
        ? formatPersonnelName(personnelData)
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
        .select("first_name, middle_name, last_name, rank, badge_number")
        .eq("id", personnelId)
        .single();

      if (personnelError) throw personnelError;

      const personnel_name = formatPersonnelName(personnel);

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
  
  // UPDATED: Function to render inspector dropdown options
  const renderInspectorOptions = () => {
    return personnelList.map((person) => (
      <option key={person.id} value={person.id}>
        {person.display_name}
        {person.badge_number ? ` (${person.badge_number})` : ""}
      </option>
    ));
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
            {/* UPDATED: Schedule Form - Mobile Responsive */}
<div
  ref={scheduleFormRef}
  className={`${styles.scheduleForm} ${
    showScheduleForm ? styles.show : ""
  }`}
>
  <div className={styles.scheduleFormContent}>
    {/* Form Row - Responsive Grid */}
    <div className={styles.scheduleFormGrid}>
      {/* Date Field */}
      <div className={styles.scheduleFormGroup}>
        <div className={styles.floatingGroup}>
          <Flatpickr
            value={formData.scheduled_date}
            onChange={([date]) => {
              if (date) {
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, "0");
                const day = String(date.getDate()).padStart(2, "0");
                const dateStr = `${year}-${month}-${day}`;
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
              disableMobile: true,
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

      {/* Inspector Field */}
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
            {renderInspectorOptions()}
          </select>
          <label
            htmlFor="inspector"
            className={styles.floatingLabel}
          >
            Inspector *
          </label>
        </div>
      </div>

      {/* Personnel Filter Field */}
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
          >
            <option value="">All Personnel</option>
            <option value="Unassigned">Unassigned</option>
            {getAssignedPersonnel().map((personName, index) => (
              <option
                key={index}
                value={personName}
                title={personName}
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

    {/* Equipment Selection Section */}
    <div className={styles.equipmentSelectionSection}>
      <h4>
        Select Equipment to Inspect
        {formData.selected_personnel && (
          <span className={styles.filterNote}>
            (Filtered by: {formData.selected_personnel})
          </span>
        )}
      </h4>
      
      {/* UPDATED: Equipment Filters - Responsive Grid */}
      <div className={styles.equipmentFiltersGrid}>
        <div className={styles.equipmentFilterGroup}>
          <input
            type="text"
            placeholder="🔍 Search equipment..."
            value={equipmentSearch}
            onChange={(e) => setEquipmentSearch(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        <div className={styles.equipmentFilterGroup}>
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
        </div>

        <div className={styles.equipmentFilterGroup}>
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
      </div>

      {/* Selection Summary */}
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

      {/* Equipment Table Container */}
      <div className={styles.equipmentTableContainer}>
        <table className={styles.equipmentTable}>
          <thead>
            <tr>
              <th className={styles.selectColumn}>
                <input
                  type="checkbox"
                  checked={
                    selectableEquipment.length > 0 &&
                    selectedEquipmentForSchedule.length ===
                      selectableEquipment.length
                  }
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedEquipmentForSchedule(
                        selectableEquipment.map((item) => item.id)
                      );
                    } else {
                      setSelectedEquipmentForSchedule([]);
                    }
                  }}
                  disabled={selectableEquipment.length === 0}
                />
              </th>
              <th>Item Code</th>
              <th>Equipment Name</th>
              <th>Category</th>
              <th>Status</th>
              <th>Assigned To</th>
              <th>Clearance Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredEquipment.map((item) => {
              const hasClearance =
                equipmentClearanceMap[item.id]?.hasClearance || false;
              const clearanceType =
                equipmentClearanceMap[item.id]?.type || "";
              const hasPendingInspection =
                pendingInspectionsMap[item.id] || false;
              const isSelectable = !hasPendingInspection;

              return (
                <tr
                  key={item.id}
                  className={
                    !isSelectable ? styles.rowDisabled : ""
                  }
                >
                  <td className={styles.selectColumn}>
                    <input
                      type="checkbox"
                      checked={selectedEquipmentForSchedule.includes(
                        item.id
                      )}
                      onChange={() => {
                        if (isSelectable) {
                          toggleEquipmentSelection(item.id);
                        }
                      }}
                      disabled={!isSelectable}
                    />
                  </td>
                  <td>{item.item_code}</td>
                  <td>{item.item_name}</td>
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
                  <td>{item.assigned_to}</td>
                  <td>
                    {hasClearance ? (
                      <div className={styles.clearanceIndicator}>
                        <span className={styles.clearanceBadge}>
                          ⚠️ {clearanceType}
                        </span>
                      </div>
                    ) : hasPendingInspection ? (
                      <div className={styles.pendingInspection}>
                        <span className={styles.pendingBadge}>
                          ⏳ Pending Inspection
                        </span>
                      </div>
                    ) : (
                      <span className={styles.noClearance}>—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Bottom Summary */}
      <div className={styles.selectionSummary}>
        <p>
          Selected: {selectedEquipmentForSchedule.length} equipment
          items
        </p>
      </div>
    </div>

    {/* Form Actions - Updated for mobile */}
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
        disabled={
          selectedEquipmentForSchedule.length === 0 || isScheduling
        }
      >
        {isScheduling ? (
          <>
            <span className={styles.submissionSpinner}></span>
            Scheduling...
          </>
        ) : (
          `Schedule ${selectedEquipmentForSchedule.length} Inspection(s)`
        )}
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

                    // The schedule_status is now handled by the database trigger
                    // Just use what's in the database
                    const displayScheduleStatus =
                      inspection.schedule_status || "UPCOMING";

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
                          {/* Schedule Status Badge - now includes DONE */}
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
                            {/* Only show Inspect button if status is PENDING and schedule is not DONE */}
                            {inspection.status === "PENDING" &&
                              inspection.schedule_status !== "DONE" &&
                              isToday && (
                                <button
                                  className={`${styles.IEIBtn} ${styles.IEIInspect}`}
                                  onClick={() => handleInspect(inspection)}
                                >
                                  Inspect
                                </button>
                              )}

                            {/* Show Reschedule button only for pending inspections */}
                            {inspection.status === "PENDING" && (
                              <button
                                className={`${styles.IEIBtn} ${styles.IEIReschedule}`}
                                onClick={() =>
                                  rescheduleInspection(inspection.id)
                                }
                              >
                                Reschedule
                              </button>
                            )}

                            {/* Show status if inspection is completed/failed/cancelled */}
                            {inspection.status === "COMPLETED" && (
                              <span className={styles.completedText}>
                                ✓ Completed
                              </span>
                            )}
                            {inspection.status === "FAILED" && (
                              <span className={styles.failedText}>
                                ✗ Failed
                              </span>
                            )}
                            {inspection.status === "CANCELLED" && (
                              <span className={styles.cancelledText}>
                                Cancelled
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
          {/* UPDATED: Filter & Search Section - 2 Column Layout */}
<div className={styles.recentFiltersContainer}>
  <div className={styles.recentFiltersHeader}>
    <h3>Filter & Search</h3>
    <span className={styles.recentResultsInfo}>
      Showing {filteredRecentInspections.length} of{" "}
      {recentInspections.length} inspections
    </span>
  </div>

  {/* Search Bar - Full Width */}
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

  {/* UPDATED: Filter Grid - 2 Column Layout */}
  <div className={styles.recentFiltersGridTwoCol}>
    {/* Left Column */}
    <div className={styles.recentFilterColumn}>
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
    </div>

    {/* Right Column */}
    <div className={styles.recentFilterColumn}>
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

      {/* Optional: Add another filter here if needed */}
      <div className={styles.recentFilterGroup}>
        <label>Sort By</label>
        <select
          className={styles.recentFilterSelect}
          onChange={() => {}}
          defaultValue="date"
        >
          <option value="date">Inspection Date</option>
          <option value="equipment">Equipment Name</option>
          <option value="inspector">Inspector</option>
        </select>
      </div>
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
                    disabled={isInspecting} // Disable while loading
                  >
                    {isInspecting ? (
                      <>
                        <span className={styles.submissionSpinner}></span>
                        Processing...
                      </>
                    ) : (
                      "Complete Inspection"
                    )}
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