import React, { useState, useEffect, useRef } from "react";
import {
  FaEye,
  FaEyeSlash,
  FaCopy,
  FaCheck,
  FaDownload,
  FaFilter,
} from "react-icons/fa";
import Flatpickr from "react-flatpickr";
import "flatpickr/dist/flatpickr.css";
import Sidebar from "../../Sidebar.jsx";
import Hamburger from "../../Hamburger.jsx";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useSidebar } from "../../SidebarContext.jsx";
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  arrow,
  inline,
} from "@floating-ui/react";
import { Title, Meta } from "react-head";
import { supabase } from "../../../lib/supabaseClient.js";
import styles from "../styles/PersonnelRegister.module.css";
import BFPPreloader from "../../BFPPreloader.jsx";

const PersonnelRegister = () => {
  const { isSidebarCollapsed } = useSidebar();
  const [isPhotoRemoved, setIsPhotoRemoved] = useState(false);
  const [personnel, setPersonnel] = useState([]);
  const [filteredPersonnel, setFilteredPersonnel] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showRankModal, setShowRankModal] = useState(false);
  const [showEditRankModal, setShowEditRankModal] = useState(false);
  const [editingPerson, setEditingPerson] = useState(null);
  const [selectedRank, setSelectedRank] = useState("");
  const [selectedRankImage, setSelectedRankImage] = useState("");
  const [editSelectedRank, setEditSelectedRank] = useState("");
  const [editSelectedRankImage, setEditSelectedRankImage] = useState("");
  const [photoPreview, setPhotoPreview] = useState(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState(null);
  const [fileChosen, setFileChosen] = useState("No Photo selected");
  const [EditFileChosen, setEditFileChosen] = useState("No new Photo selected");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const formRef = useRef(null);

  // ========== FILTER STATES (ADDED) ==========
  const [search, setSearch] = useState("");
  const [filterRank, setFilterRank] = useState("");
  const [filterStation, setFilterStation] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const [lockedPersonnel, setLockedPersonnel] = useState({}); // { personnelId: { isLocked: boolean, lockReason: string } }
  const [loadingLocks, setLoadingLocks] = useState(false);
  const photoInputRef = useRef(null);
  const editPhotoInputRef = useRef(null);
  const rankImageInputRef = useRef(null);
  const [deleteName, setDeleteName] = useState("");
  const [generatedUsername, setGeneratedUsername] = useState("");
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 5;
  const [isRegistering, setIsRegistering] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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
    if (personnel && personnel.length > 0) {
      console.log("Personnel data updated, checking lock status...");
      loadAllPersonnelLockStatus();
    } else {
      setLockedPersonnel({});
    }
  }, [personnel]);
  useEffect(() => {
    console.log("Locked personnel state:", lockedPersonnel);
    console.log("Total personnel:", personnel.length);
    console.log(
      "Locked count:",
      Object.values(lockedPersonnel).filter((l) => l.isLocked).length
    );
  }, [lockedPersonnel, personnel]);
  // Suffix options - ADDED
  const suffixOptions = ["", "Jr.", "Sr.", "II", "III", "IV", "V"];

  // Form state - ADDED suffix field
  const [formData, setFormData] = useState({
    badge_number: "",
    first_name: "",
    middle_name: "",
    last_name: "",
    suffix: "", // ADDED
    designation: "",
    station: "",
    birth_date: "",
    date_hired: "",
    retirement_date: "",
  });

  const applyFilters = (items) => {
    // Add null check
    if (!items || !Array.isArray(items)) {
      return [];
    }

    let filtered = [...items];

    // Search filter - only searches name, rank, station, and badge
    const searchTerm = search.trim().toLowerCase();
    if (searchTerm) {
      filtered = filtered.filter((person) => {
        // Add person null check
        if (!person) return false;

        // Create searchable text from only the fields we want
        const searchText = `
      ${person.first_name || ""} 
      ${person.middle_name || ""} 
      ${person.last_name || ""}
      ${person.rank || ""}
      ${person.station || ""}
      ${person.badge_number || ""}
    `.toLowerCase();

        return searchText.includes(searchTerm);
      });
    }

    // Rank filter
    if (filterRank) {
      filtered = filtered.filter(
        (person) => person && person.rank === filterRank
      );
    }

    // Station filter
    if (filterStation) {
      filtered = filtered.filter(
        (person) =>
          person &&
          person.station &&
          person.station.toLowerCase().includes(filterStation.toLowerCase())
      );
    }

    return filtered;
  };
  const clearFilters = () => {
    setSearch("");
    setFilterRank("");
    setFilterStation("");
    setCurrentPage(1);
  };

  const getUniqueStations = () => {
    const stations = new Set();

    // Add null check here
    if (!personnel || !Array.isArray(personnel)) {
      return [];
    }

    personnel.forEach((person) => {
      if (person && person.station) {
        stations.add(person.station);
      }
    });

    return Array.from(stations).sort();
  };
  // Add this component before your main component return statement
  const HighlightMatch = ({ text, searchTerm }) => {
    if (!searchTerm || !text) return text || "-";

    const lowerText = text.toLowerCase();
    const lowerSearchTerm = searchTerm.toLowerCase();
    const index = lowerText.indexOf(lowerSearchTerm);

    if (index === -1) return text;

    const before = text.substring(0, index);
    const match = text.substring(index, index + searchTerm.length);
    const after = text.substring(index + searchTerm.length);

    return (
      <>
        {before}
        <span
          style={{
            backgroundColor: "#FFEB3B",
            padding: "0 2px",
            borderRadius: "2px",
          }}
        >
          {match}
        </span>
        {after}
      </>
    );
  };
  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return "-";
    try {
      const date =
        dateString instanceof Date ? dateString : new Date(dateString);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch (error) {
      console.error("Error formatting date:", error);
      return "-";
    }
  };

  // Format date for input
  const formatDateForInput = (dateString) => {
    if (!dateString) return "";
    try {
      const date =
        dateString instanceof Date ? dateString : new Date(dateString);
      return date.toISOString().split("T")[0];
    } catch (error) {
      console.error("Error formatting date for input:", error);
      return "";
    }
  };

  // Edit form state - ADDED suffix field
  const [editFormData, setEditFormData] = useState({
    badge_number: "",
    first_name: "",
    middle_name: "",
    last_name: "",
    suffix: "", // ADDED
    designation: "",
    station: "",
    birth_date: "",
    date_hired: "",
    retirement_date: "",
  });

const loadAllPersonnelLockStatus = async () => {
  try {
    console.log("🔐 ULTIMATE LOCK CHECK STARTING");

    // Get current personnel data directly from state
    const currentPersonnel = personnel; // Use the state directly

    if (
      !currentPersonnel ||
      !Array.isArray(currentPersonnel) ||
      currentPersonnel.length === 0
    ) {
      console.log("No personnel data available yet - waiting...");
      setLockedPersonnel({});
      return;
    }

    const personnelIds = currentPersonnel.map((p) => p.id);
    console.log("Checking IDs for lock status:", personnelIds);

    if (personnelIds.length === 0) {
      console.log("No personnel IDs to check");
      setLockedPersonnel({});
      return;
    }

    // METHOD A: Direct clearance check (most reliable)
    console.log("🔄 Method A: Checking clearances directly...");
    const { data: directClearances, error: directError } = await supabase
      .from("clearance_requests")
      .select("personnel_id, type, status")
      .in("personnel_id", personnelIds)
      .in("type", ["Resignation", "Retirement", "Equipment Completion"])
      .in("status", ["Pending", "In Progress", "Pending for Approval"]);

    if (directError) {
      console.error("Error checking direct clearances:", directError);
    }

    console.log("Direct clearance results:", directClearances);

    // METHOD B: View check
    console.log("🔄 Method B: Checking view...");
    const { data: viewData, error: viewError } = await supabase
      .from("personnel_restrictions")
      .select("*")
      .in("personnel_id", personnelIds);

    if (viewError) {
      console.error("Error checking view data:", viewError);
    }

    console.log("View data results:", viewData);

    // Build lock map from BOTH methods
    const lockStatusMap = {};

    // Initialize all personnel as not locked first
    currentPersonnel.forEach((person) => {
      lockStatusMap[person.id] = {
        isLocked: false,
        lockReason: "",
        source: "none",
      };
    });

    // 1. Add from direct clearances
    if (directClearances && directClearances.length > 0) {
      directClearances.forEach((clearance) => {
        console.log(
          `🔒 Found clearance for ${clearance.personnel_id}: ${clearance.type} (${clearance.status})`
        );
        lockStatusMap[clearance.personnel_id] = {
          isLocked: true,
          lockReason: `${clearance.type} clearance (${clearance.status})`,
          source: "direct",
        };
      });
    }

    // 2. Add from view (if not already added)
    if (viewData && viewData.length > 0) {
      viewData.forEach((person) => {
        // Check if this personnel is in our current list
        if (!lockStatusMap[person.personnel_id]) {
          lockStatusMap[person.personnel_id] = {
            isLocked: false,
            lockReason: "",
            source: "none",
          };
        }

        // Check ALL lock conditions
        const shouldLock =
          person.active_clearance === true ||
          person.inspection_in_progress === true ||
          person.pending_accountability === true;

        if (shouldLock && !lockStatusMap[person.personnel_id].isLocked) {
          console.log(`🔒 View indicates lock for ${person.personnel_id}`);

          let reason = "";
          if (person.active_clearance) reason = "Active clearance request";
          if (person.inspection_in_progress) reason = "Inspection in progress";
          if (person.pending_accountability)
            reason = `Pending accountability (₱${person.pending_amount || 0})`;

          lockStatusMap[person.personnel_id] = {
            isLocked: true,
            lockReason: reason,
            source: "view",
          };
        }
      });
    }

    console.log("✅ FINAL LOCK MAP:", lockStatusMap);

    // Log each personnel's status
    currentPersonnel.forEach((p) => {
      const lock = lockStatusMap[p.id];
      console.log(
        lock?.isLocked
          ? `   🔐 ${p.first_name} ${p.last_name}: ${lock.lockReason}`
          : `   ✅ ${p.first_name} ${p.last_name}: Not locked`
      );
    });

    setLockedPersonnel(lockStatusMap);
  } catch (error) {
    console.error("❌ Lock check error:", error);
  }
};
const loadPersonnel = async (showLoading = true) => {
  try {
    if (showLoading) {
      setLoading(true);
    }
    setError("");

    const { data, error } = await supabase
      .from("personnel")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase error loading personnel:", error);
      throw error;
    }

    // Ensure data is always an array, even if null
    const personnelData = Array.isArray(data) ? data : [];

    console.log("Loaded personnel data:", personnelData);

    // IMPORTANT: Update personnel state FIRST
    setPersonnel(personnelData);
    setFilteredPersonnel(personnelData); // Initialize filtered personnel

    // Load lock status ONLY AFTER personnel state is updated
    // Use setTimeout to ensure React state update is complete
    if (personnelData.length > 0) {
      setTimeout(() => {
        loadAllPersonnelLockStatus();
      }, 100);
    } else {
      setLockedPersonnel({});
    }

    // Show success toast when data loads (only on initial load)
    if (showLoading && personnelData.length > 0) {
      toast.success(`Loaded ${personnelData.length} personnel records`);
    }
  } catch (error) {
    console.error("Error loading personnel:", error);
    setError("Failed to load personnel data");

    // Set empty arrays on error to prevent null values
    setPersonnel([]);
    setFilteredPersonnel([]);
    setLockedPersonnel({}); // Also clear lock status

    if (showLoading) {
      toast.error("Failed to load personnel data. Please check connection.");
    }
  } finally {
    if (showLoading) {
      setLoading(false);
    }
  }
};

  useEffect(() => {
    loadPersonnel();
  }, []);
useEffect(() => {
  // Subscribe to clearance_requests changes
  const clearanceSubscription = supabase
    .channel("clearance-changes")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "clearance_requests",
      },
      () => {
        console.log("Clearance request changed - refreshing locks");
        loadAllPersonnelLockStatus();
      }
    )
    .subscribe();

  // Subscribe to inspections changes
  const inspectionSubscription = supabase
    .channel("inspection-changes")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "inspections",
      },
      () => {
        console.log("Inspection changed - refreshing locks");
        loadAllPersonnelLockStatus();
      }
    )
    .subscribe();

  return () => {
    clearanceSubscription.unsubscribe();
    inspectionSubscription.unsubscribe();
  };
}, []);
  // ========== APPLY FILTERS WHEN FILTERS CHANGE ==========
  useEffect(() => {
    if (personnel.length > 0) {
      const filtered = applyFilters(personnel);
      setFilteredPersonnel(filtered);
      setCurrentPage(1); // Reset to first page when filters change
    }
  }, [search, filterRank, filterStation, personnel]);

  // ==================== LOCK STATUS ICON COMPONENT ====================
  // Add this function
  const debugLockSystem = async () => {
    console.log("=== DEBUGGING LOCK SYSTEM ===");

    // Check specific personnel
    const testPersonnelId = "154a27b1-ea03-4e61-9b85-77c203ad097c";

    // Check clearance requests directly
    const { data: clearances, error } = await supabase
      .from("clearance_requests")
      .select("id, status, type, personnel_id")
      .eq("personnel_id", testPersonnelId);

    console.log("Clearance requests:", clearances);

    // Check view data
    const { data: viewData } = await supabase
      .from("personnel_restrictions")
      .select("*")
      .eq("personnel_id", testPersonnelId);

    console.log("View data:", viewData);

    // Reload lock status
    await loadAllPersonnelLockStatus();
  };

  // Add this button somewhere in your UI
const LockStatusIcon = ({ personnelId }) => {
  const lockStatus = lockedPersonnel[personnelId];

  console.log(`🎯 LockStatusIcon for ${personnelId}:`, lockStatus);

  if (!lockStatus || !lockStatus.isLocked) {
    console.log(`✅ No lock for ${personnelId}`);
    return null;
  }

  return (
    <div
      className={styles.lockIconContainer}
      style={{
        display: "inline-flex",
        alignItems: "center",
        marginRight: "8px",
        padding: "2px 6px",
        background: "#ffebee",
        borderRadius: "4px",
        border: "1px solid #f44336",
      }}
    >
      <span style={{ color: "#f44336", fontSize: "14px", marginRight: "4px" }}>
        🔒
      </span>
      <span style={{ fontSize: "11px", color: "#d32f2f", fontWeight: "bold" }}>
        LOCKED
      </span>
      {lockStatus.lockReason && (
        <span
          style={{
            fontSize: "10px",
            color: "#666",
            marginLeft: "4px",
            fontStyle: "italic",
          }}
          title={lockStatus.lockReason}
        >
          (
          {lockStatus.lockReason.length > 20
            ? lockStatus.lockReason.substring(0, 20) + "..."
            : lockStatus.lockReason}
          )
        </span>
      )}
    </div>
  );
};

  // ==================== OTHER FUNCTIONS ====================

  // Upload image to Supabase Storage with RLS bypass
  const uploadImage = async (
    file,
    folder = "personnel",
    bucket = "personnel-images"
  ) => {
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 9)}.${fileExt}`;
      const filePath = `${folder}/${fileName}`;

      const { data, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        toast.error(`Upload failed: ${uploadError.message}`);
        return null;
      }

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from(bucket).getPublicUrl(filePath);
      return publicUrl;
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error("Failed to upload image. Please try again.");
      return null;
    }
  };

  // Pagination
  const paginate = (data, page, rows) => {
    const start = (page - 1) * rows;
    return data.slice(start, start + rows);
  };

  const renderPaginationButtons = () => {
    const pageCount = Math.max(
      1,
      Math.ceil(filteredPersonnel.length / rowsPerPage)
    );
    const hasNoData = filteredPersonnel.length === 0;

    const buttons = [];

    // Previous button
    buttons.push(
      <button
        key="prev"
        className={`${styles.paginationBtn} ${
          hasNoData ? styles.disabled : ""
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
        className={`${styles.paginationBtn} ${
          1 === currentPage ? styles.active : ""
        } ${hasNoData ? styles.disabled : ""}`}
        onClick={() => setCurrentPage(1)}
        disabled={hasNoData}
      >
        1
      </button>
    );

    // Show ellipsis after first page if needed
    if (currentPage > 3) {
      buttons.push(
        <span key="ellipsis1" className={styles.paginationEllipsis}>
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
            className={`${styles.paginationBtn} ${
              i === currentPage ? styles.active : ""
            } ${hasNoData ? styles.disabled : ""}`}
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
        <span key="ellipsis2" className={styles.paginationEllipsis}>
          ...
        </span>
      );
    }

    // Always show last page if there is more than 1 page
    if (pageCount > 1) {
      buttons.push(
        <button
          key={pageCount}
          className={`${styles.paginationBtn} ${
            pageCount === currentPage ? styles.active : ""
          } ${hasNoData ? styles.disabled : ""}`}
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
        className={`${styles.paginationBtn} ${
          hasNoData ? styles.disabled : ""
        }`}
        disabled={currentPage === pageCount || hasNoData}
        onClick={() => setCurrentPage(Math.min(pageCount, currentPage + 1))}
      >
        Next
      </button>
    );

    return (
      <div className={`${styles.paginationContainer} ${styles.topPagination}`}>
        {buttons}
      </div>
    );
  };

  const generatePassword = (length = 8) => {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$";
    return Array.from(
      { length },
      () => chars[Math.floor(Math.random() * chars.length)]
    ).join("");
  };

  // UPDATED generateUsername function to include suffix
  const generateUsername = (first, middle, last, suffix) => {
    const baseUsername = `${first}${middle ? middle[0] : ""}${last}${
      suffix ? suffix[0] : ""
    }`
      .toLowerCase()
      .replaceAll(/\s+/g, "");
    return `${baseUsername}${Date.now().toString().slice(-4)}`;
  };

  // UPDATED useEffect for username generation
  useEffect(() => {
    if (formData.first_name || formData.last_name) {
      const username = generateUsername(
        formData.first_name,
        formData.middle_name,
        formData.last_name,
        formData.suffix
      );
      setGeneratedUsername(username);
    } else {
      setGeneratedUsername("");
    }
  }, [
    formData.first_name,
    formData.middle_name,
    formData.last_name,
    formData.suffix,
  ]);

  // Generate password
  useEffect(() => {
    if (showForm) {
      setGeneratedPassword(generatePassword());
    }
  }, [showForm]);

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhotoPreview(e.target.result);
      };
      reader.readAsDataURL(file);
      setFileChosen(file.name);
    } else {
      setFileChosen("No Photo selected");
    }
  };

  const handleEditPhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setEditPhotoPreview(e.target.result);
      };
      reader.readAsDataURL(file);
      setEditFileChosen(file.name);
    } else {
      setEditFileChosen("No new Photo selected");
    }
  };

  const clearPhoto = () => {
    setPhotoPreview(null);
    setFileChosen("No Photo selected");
    if (photoInputRef.current) {
      photoInputRef.current.value = "";
    }
  };

  const clearEditPhoto = () => {
    setEditPhotoPreview(null);
    setEditFileChosen("No new Photo selected");
    setIsPhotoRemoved(true);
    if (editPhotoInputRef.current) {
      editPhotoInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsRegistering(true);
      setError("");

      // Validation
      if (!formData.first_name?.trim() || !formData.last_name?.trim()) {
        toast.error("First name and last name are required!");
        setIsRegistering(false);
        return;
      }

      if (!selectedRank) {
        toast.error("Please select a rank!");
        setIsRegistering(false);
        return;
      }

      // Validate dates
      const birthDate = formData.birth_date
        ? new Date(formData.birth_date)
        : null;
      const dateHired = formData.date_hired
        ? new Date(formData.date_hired)
        : null;
      const retirementDate = formData.retirement_date
        ? new Date(formData.retirement_date)
        : null;
      const now = new Date();

      if (birthDate && dateHired && birthDate > dateHired) {
        toast.error("Birth date cannot be after date hired!");
        setIsRegistering(false);
        return;
      }

      if (dateHired && retirementDate && dateHired > retirementDate) {
        toast.error("Date hired cannot be after retirement date!");
        setIsRegistering(false);
        return;
      }

      if (birthDate && birthDate > now) {
        toast.error("Birth date cannot be in the future!");
        setIsRegistering(false);
        return;
      }

      if (dateHired && dateHired > now) {
        toast.error("Date hired cannot be in the future!");
        setIsRegistering(false);
        return;
      }

      // Prepare data - ADDED suffix field
      const username = generatedUsername;
      const password = generatedPassword;

      const newPersonnel = {
        badge_number: formData.badge_number || null,
        first_name: formData.first_name.trim(),
        middle_name: formData.middle_name?.trim() || null,
        last_name: formData.last_name.trim(),
        suffix: formData.suffix?.trim() || null,
        username,
        password,
        designation: formData.designation?.trim() || null,
        station: formData.station?.trim() || null,
        rank: selectedRank,
        rank_image: selectedRankImage,
        documents: [],
        birth_date: formData.birth_date
          ? new Date(formData.birth_date).toISOString()
          : null,
        date_hired: formData.date_hired
          ? new Date(formData.date_hired).toISOString()
          : null,
        retirement_date: formData.retirement_date
          ? new Date(formData.retirement_date).toISOString()
          : null,
      };

      // Upload photo if exists
      let photoURL = null;
      if (photoPreview && photoInputRef.current?.files?.[0]) {
        photoURL = await uploadImage(photoInputRef.current.files[0]);
        if (photoURL) {
          newPersonnel.photo_url = photoURL;
          newPersonnel.photo_path = photoURL;
        }
      }

      // Show loading toast
      const loadingToastId = toast.loading("Registering personnel...", {
        position: "top-right",
        autoClose: false,
        closeOnClick: false,
        pauseOnHover: true,
      });

      try {
        // Insert into Supabase
        const { data, error: insertError } = await supabase
          .from("personnel")
          .insert([newPersonnel])
          .select()
          .single();

        if (insertError) {
          console.error("Supabase insert error:", insertError);
          toast.update(loadingToastId, {
            render:
              insertError.code === "23505"
                ? "Username or badge number already exists. Please use different values."
                : insertError.code === "23514"
                ? "Invalid date sequence. Please check: Birth Date ≤ Date Hired ≤ Retirement Date"
                : insertError.code === "42501"
                ? "Permission denied. Please check Row Level Security policies."
                : `Failed to add personnel: ${insertError.message}`,
            type: "error",
            isLoading: false,
            autoClose: 5000,
            closeButton: true,
          });
          throw insertError;
        }

        await loadPersonnel(false);
        resetForm();
        setShowForm(false);

        toast.update(loadingToastId, {
          render: (
            <div>
              <div style={{ fontWeight: "bold", marginBottom: "5px" }}>
                ✅ Personnel Registered Successfully!
              </div>
              <div style={{ fontSize: "14px", color: "#666" }}>
                {formData.first_name} {formData.last_name} has been added to the
                system.
              </div>
              <div
                style={{ fontSize: "12px", marginTop: "8px", color: "#888" }}
              >
                Username: <strong>{username}</strong>
              </div>
            </div>
          ),
          type: "success",
          isLoading: false,
          autoClose: 6000,
          closeButton: true,
          style: { borderLeft: "4px solid #2E7D32" },
        });
      } catch (error) {
        console.error("Error adding personnel:", error);
        if (!toast.isActive(loadingToastId)) {
          toast.error("Failed to add personnel. Please try again.");
        }
      }
    } catch (error) {
      console.error("Error in handleSubmit:", error);
    } finally {
      setIsRegistering(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsSavingEdit(true);
      setError("");

      if (!editingPerson || !editingPerson.id) {
        toast.error("Invalid personnel record. Cannot update.");
        setIsSavingEdit(false);
        return;
      }

      // Check if personnel is locked
      if (lockedPersonnel[editingPerson.id]?.isLocked) {
        toast.error(
          `Cannot edit: ${lockedPersonnel[editingPerson.id]?.lockReason}`
        );
        setIsSavingEdit(false);
        return;
      }

      // Validate dates
      const birthDate = editFormData.birth_date
        ? new Date(editFormData.birth_date)
        : null;
      const dateHired = editFormData.date_hired
        ? new Date(editFormData.date_hired)
        : null;
      const retirementDate = editFormData.retirement_date
        ? new Date(editFormData.retirement_date)
        : null;
      const now = new Date();

      if (birthDate && dateHired && birthDate > dateHired) {
        toast.error("Birth date cannot be after date hired!");
        setIsSavingEdit(false);
        return;
      }

      if (dateHired && retirementDate && dateHired > retirementDate) {
        toast.error("Date hired cannot be after retirement date!");
        setIsSavingEdit(false);
        return;
      }

      if (birthDate && birthDate > now) {
        toast.error("Birth date cannot be in the future!");
        setIsSavingEdit(false);
        return;
      }

      if (dateHired && dateHired > now) {
        toast.error("Date hired cannot be in the future!");
        setIsSavingEdit(false);
        return;
      }

      // Upload new photo
      let finalPhotoURL = editingPerson.photo_url;
      let finalPhotoPath = editingPerson.photo_path;
      if (editPhotoPreview && editPhotoInputRef.current?.files?.[0]) {
        finalPhotoURL = await uploadImage(editPhotoInputRef.current.files[0]);
        finalPhotoPath = finalPhotoURL;
      } else if (isPhotoRemoved) {
        finalPhotoURL = null;
        finalPhotoPath = null;
      }

      // UPDATED to include suffix
      const updatedPersonnel = {
        id: editingPerson.id,
        badge_number: editFormData.badge_number || null,
        first_name: editFormData.first_name.trim(),
        middle_name: editFormData.middle_name?.trim() || null,
        last_name: editFormData.last_name.trim(),
        suffix: editFormData.suffix?.trim() || null,
        designation: editFormData.designation?.trim() || null,
        station: editFormData.station?.trim() || null,
        rank: editSelectedRank,
        rank_image: editSelectedRankImage,
        photo_url: finalPhotoURL,
        photo_path: finalPhotoPath,
        birth_date: editFormData.birth_date
          ? new Date(editFormData.birth_date).toISOString()
          : null,
        date_hired: editFormData.date_hired
          ? new Date(editFormData.date_hired).toISOString()
          : null,
        retirement_date: editFormData.retirement_date
          ? new Date(editFormData.retirement_date).toISOString()
          : null,
        updated_at: new Date().toISOString(),
      };

      console.log("Updating personnel with data:", updatedPersonnel);

      // Update in Supabase
      const { data, error: updateError } = await supabase
        .from("personnel")
        .update(updatedPersonnel)
        .eq("id", editingPerson.id)
        .select()
        .single();

      if (updateError) {
        console.error("Supabase update error:", updateError);
        if (updateError.code === "42501") {
          toast.error(
            "Permission denied. Please check Row Level Security policies."
          );
        } else if (updateError.code === "23514") {
          toast.error(
            "Invalid date sequence. Please check: Birth Date ≤ Date Hired ≤ Retirement Date"
          );
        } else {
          toast.error(`Failed to update personnel: ${updateError.message}`);
        }
        throw updateError;
      }

      console.log("Update successful, received data:", data);

      // IMPORTANT FIX: Reload ALL personnel data to ensure consistency
      await loadPersonnel(false);

      // Close modal and reset states
      setShowEditModal(false);
      setEditingPerson(null);
      setEditPhotoPreview(null);
      setEditFileChosen("No new Photo selected");
      setIsPhotoRemoved(false);

      // Show success message
      toast.success("Personnel updated successfully!", {
        autoClose: 3000,
        position: "top-right",
      });
    } catch (error) {
      console.error("Error updating personnel:", error);
      if (!error.message) {
        toast.error("Failed to update personnel. Please try again.");
      }
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleCloseEditModal = () => {
    if (editingPerson) {
      toast.info("No changes made. Modal closed.");
    }
    setShowEditModal(false);
    setEditingPerson(null);
    setEditPhotoPreview(null);
    setEditFileChosen("No new Photo selected");
    setIsPhotoRemoved(false);
    setIsSavingEdit(false);
  };

  const openEdit = (person) => {
    try {
      setError("");
      if (!person || !person.id) {
        toast.error("Invalid personnel record selected.");
        return;
        
      }

      // Check if personnel is locked
      if (lockedPersonnel[person.id]?.isLocked) {
        
        toast.warning(`Cannot edit: ${lockedPersonnel[person.id]?.lockReason}`);
        return;
      }

      console.log("Opening edit for personnel:", person);

      setEditingPerson(person);
      setEditFormData({
        badge_number: person.badge_number || "",
        first_name: person.first_name || "",
        middle_name: person.middle_name || "",
        last_name: person.last_name || "",
        suffix: person.suffix || "",
        designation: person.designation || "",
        station: person.station || "",
        birth_date: formatDateForInput(person.birth_date),
        date_hired: formatDateForInput(person.date_hired),
        retirement_date: formatDateForInput(person.retirement_date),
      });
      setEditSelectedRank(person.rank || "");
      setEditSelectedRankImage(person.rank_image || "");
      setEditPhotoPreview(null);
      setIsPhotoRemoved(false);
      setShowEditModal(true);
    } catch (error) {
      console.error("Error opening edit:", error);
      setError("Failed to load personnel data for editing.");
    }
  };

  const resetForm = () => {
    setFormData({
      badge_number: "",
      first_name: "",
      middle_name: "",
      last_name: "",
      suffix: "",
      designation: "",
      station: "",
      birth_date: "",
      date_hired: "",
      retirement_date: "",
    });
    setSelectedRank("");
    setSelectedRankImage("");
    setPhotoPreview(null);
    setFileChosen("No Photo selected");
    setGeneratedUsername("");
    setGeneratedPassword(generatePassword());
    if (photoInputRef.current) {
      photoInputRef.current.value = "";
    }
  };

  const handleDeleteClick = (id, name) => {
    if (!id) {
      toast.error("Invalid ID — cannot delete.");
      return;
    }

    // Check if personnel is locked
    if (lockedPersonnel[id]?.isLocked) {
      toast.warning(`Cannot delete: ${lockedPersonnel[id]?.lockReason}`);
      return;
    }

    setDeleteId(id);
    setDeleteName(name);
    setShowDeleteConfirm(true);
  };

  const confirmDeletePersonnel = async () => {
    try {
      setIsDeleting(true);
      if (!deleteId) {
        toast.error("No personnel selected for deletion.");
        setIsDeleting(false);
        return;
      }

      // Double-check lock status before deleting
      if (lockedPersonnel[deleteId]?.isLocked) {
        toast.error(`Cannot delete: ${lockedPersonnel[deleteId]?.lockReason}`);
        setIsDeleting(false);
        return;
      }

      const { error } = await supabase
        .from("personnel")
        .delete()
        .eq("id", deleteId);

      if (error) {
        console.error("Supabase delete error:", error);
        if (error.code === "42501") {
          toast.error(
            "Permission denied. Please check Row Level Security policies."
          );
        } else {
          toast.error("Failed to delete personnel.");
        }
        throw error;
      }

      // IMPORTANT: Reload all personnel data after deletion
      await loadPersonnel(false);

      toast.warn("Personnel deleted successfully!");
      setShowDeleteConfirm(false);
      setDeleteId(null);
      setDeleteName("");
    } catch (error) {
      console.error("Error deleting personnel:", error);
      if (!error.message?.includes("Permission denied")) {
        toast.error("Failed to delete personnel.");
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setDeleteId(null);
    setDeleteName("");
    setIsDeleting(false);
  };

  const selectRank = (rank, image) => {
    setSelectedRank(rank);
    setSelectedRankImage(image);
    setShowRankModal(false);
  };

  const selectEditRank = (rank, image) => {
    setEditSelectedRank(rank);
    setEditSelectedRankImage(image);
    setShowEditRankModal(false);
  };

  const getRankDisplay = (person) => {
    if (!person) return "-";

    // Check if we have rank_image from Supabase
    if (person.rank_image) {
      return (
        <div className={styles.prRankDisplay}>
          <div className={`${styles.rankIcon} ${person.rank || ""}`}>
            <img
              src={person.rank_image}
              alt={person.rank || "Rank"}
              onError={(e) => {
                e.target.onerror = null;
                // Fallback to local image if Supabase image fails
                e.target.src = `/ranks/${person.rank}.png`;
              }}
            />
          </div>
          <span>{person.rank || "-"}</span>
        </div>
      );
    }

    // Check if we have rank from database
    if (person.rank) {
      return person.rank;
    }

    return "-";
  };
  const PasswordCell = ({ password }) => {
    const [showPassword, setShowPassword] = useState(false);
    const [copied, setCopied] = useState(false);

    const togglePassword = () => {
      setShowPassword(!showPassword);
    };

    const copyPassword = () => {
      navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    return (
      <td className={styles.prPasswordCell}>
        <div className={styles.prPasswordContainer}>
          <span className={styles.prPasswordMask}>
            {showPassword ? password : "••••••••"}
          </span>
          <div className={styles.prPasswordActions}>
            <button
              className={styles.prPasswordToggle}
              onClick={togglePassword}
              type="button"
              title={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <FaEyeSlash className={styles.prPasswordIcon} />
              ) : (
                <FaEye className={styles.prPasswordIcon} />
              )}
            </button>
            <button
              className={styles.prCopyBtn}
              onClick={copyPassword}
              type="button"
              title="Copy password"
            >
              {copied ? (
                <FaCheck className={styles.prCopyIcon} />
              ) : (
                <FaCopy className={styles.prCopyIcon} />
              )}
            </button>
          </div>
          {copied && <span className={styles.prCopiedText}>Copied!</span>}
        </div>
      </td>
    );
  };

  const PhotoCell = ({ photoUrl, alt = "Personnel Photo" }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [placement, setPlacement] = useState("bottom");
    const arrowRef = useRef(null);

    const {
      refs,
      floatingStyles,
      placement: floatingPlacement,
    } = useFloating({
      open: isOpen,
      onOpenChange: setIsOpen,
      placement: "top-start",
      middleware: [
        offset(15),
        inline(),
        flip({
          crossAxis: false,
          fallbackAxisSideDirection: "start",
          fallbackPlacements: ["top-start", "bottom-start"],
          padding: { top: 20, bottom: 15, left: 10, right: 20 },
        }),
        shift({ padding: 15, boundary: "viewport" }),
      ],
      whileElementsMounted: autoUpdate,
      strategy: "fixed",
    });

    useEffect(() => {
      if (floatingPlacement) {
        const placementType = floatingPlacement.includes("top")
          ? "top"
          : "bottom";
        setPlacement(placementType);
      }
    }, [floatingPlacement]);

    const handleImageError = (e) => {
      e.target.onerror = null;
      e.target.src = "/default-profile.png"; // Use a local fallback instead of placeholder.com
    };

    if (!photoUrl) {
      return <td className={styles.prPhotoCell}>No Photo</td>;
    }

    return (
      <td
        ref={refs.setReference}
        className={styles.prPhotoCell}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        role="button"
        tabIndex={0}
        aria-label={`View ${alt}'s photo`}
      >
        <div className={styles.prPhotoContainer}>
          <img
            src={photoUrl}
            className={styles.prPhotoThumb}
            alt={alt}
            onError={handleImageError}
            loading="lazy"
          />
          <div className={styles.prPhotoHoverIndicator}>🔍</div>
        </div>

        {isOpen && (
          <>
            <div
              ref={refs.setFloating}
              style={floatingStyles}
              className={styles.prHoverPreview}
              role="tooltip"
              aria-label={`${alt}'s photo preview`}
            >
              <div className={styles.prHoverPreviewContent}>
                <img
                  src={photoUrl}
                  alt={alt}
                  className={styles.prHoverPreviewImage}
                  onError={handleImageError}
                />
                <div
                  className={`${styles.prHoverArrow} ${
                    placement === "top" ? styles.arrowBottom : styles.arrowTop
                  }`}
                  ref={arrowRef}
                />
              </div>
            </div>
            {isOpen && <div className={styles.prHoverBackdrop} />}
          </>
        )}
      </td>
    );
  };

  // Handle click outside modals
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showEditModal && event.target.classList.contains(styles.modal)) {
        setShowEditModal(false);
      }
      if (showRankModal && event.target.classList.contains(styles.rankModal)) {
        setShowRankModal(false);
      }
      if (
        showEditRankModal &&
        event.target.classList.contains(styles.rankModal)
      ) {
        setShowEditRankModal(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [showEditModal, showRankModal, showEditRankModal]);
const debugClearanceStatus = async () => {
  const personnelId = "154a27b1-ea03-4e61-9b85-77c203ad097c";

  console.log("=== DEEP DEBUG ===");

  // 1. Check clearance_requests
  const { data: clearances } = await supabase
    .from("clearance_requests")
    .select("*")
    .eq("personnel_id", personnelId);
  console.log("1. Clearance requests:", clearances);

  // 2. Check inspections
  const { data: inspections } = await supabase
    .from("inspections")
    .select(
      `
      *,
      clearance_inventory!inner(
        personnel_id
      )
    `
    )
    .eq("clearance_inventory.personnel_id", personnelId);
  console.log("2. Inspections:", inspections);

  // 3. Check personnel_restrictions view
  const { data: viewData } = await supabase
    .from("personnel_restrictions")
    .select("*")
    .eq("personnel_id", personnelId);
  console.log("3. View data:", viewData);

  // 4. Run the view query manually
  const { data: manualQuery } = await supabase
    .from("clearance_requests")
    .select("id, personnel_id, status, type")
    .eq("personnel_id", personnelId)
    .in("status", ["Pending", "In Progress", "Pending for Approval"])
    .in("type", ["Resignation", "Retirement", "Equipment Completion"]);
  console.log("4. Manual query:", manualQuery);
};
  // In PersonnelRegister.jsx, update the BFPPreloader usage:
  if (loading) {
    return (
      <div className={styles.prContainer}>
        <Title>Personnel Register | BFP Villanueva</Title>
        <Meta name="robots" content="noindex, nofollow" />
        <Hamburger />
        <Sidebar />
        <BFPPreloader
          loading={loading}
          dataReady={personnel.length > 0 || !loading}
          moduleTitle="PERSONNEL REGISTER • Loading Personnel Data..."
          onRetry={loadPersonnel}
        />
      </div>
    );
  }

  // Get current personnel for display
  const currentPersonnel = paginate(
    filteredPersonnel,
    currentPage,
    rowsPerPage
  );

  return (
    <div className={styles.prContainer}>
      <Title>Personnel Register | BFP Villanueva</Title>
      <Meta name="robots" content="noindex, nofollow" />
      <Hamburger />
      <ToastContainer
        position="top-right"
        autoClose={2500}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
      <Sidebar />
      <div className={`main-content ${isSidebarCollapsed ? "collapsed" : ""}`}>
        <h1>Personnel Registration</h1>
        <button
          onClick={debugClearanceStatus}
          style={{ margin: "10px", padding: "5px" }}
        >
          🐛 Debug
        </button>
        {error && <div className={styles.prErrorMessage}>{error}</div>}

        <div className={styles.prCard}>
          <h2>Register New Personnel</h2>
          <button
            className={`${styles.prShowFormBtn} ${styles.prSubmit}${
              showForm ? styles.showing : ""
            }`}
            onClick={() => setShowForm(!showForm)}
            type="button"
          >
            {showForm ? "Hide Form" : "Add New Personnel"}
          </button>
          <form
            className={`${styles.prForm} ${styles.prLayout} ${
              showForm ? styles.show : ""
            }`}
            onSubmit={handleSubmit}
            ref={formRef}
          >
            {/* Form content remains the same as before */}
            <div className={styles.prPhotoSection}>
              <div className={styles.prPhotoPreview} id="photo-preview">
                {photoPreview ? (
                  <img src={photoPreview} alt="Preview" />
                ) : (
                  <span>No Photo</span>
                )}
              </div>
              <div className={styles.prFileUpload}>
                <label htmlFor="photo" className={styles.prFileUploadLabel}>
                  📂 Upload Photo
                </label>
                <input
                  type="file"
                  id="photo"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  ref={photoInputRef}
                />
                <span id="file-chosen">{fileChosen}</span>
              </div>
              {photoPreview && (
                <button
                  type="button"
                  id="clear-photo"
                  className={styles.prClearBtn}
                  onClick={clearPhoto}
                >
                  Clear Photo
                </button>
              )}
            </div>

            <div className={styles.prInfoSection}>
              {/* Form fields remain the same as before */}
              <div className={styles.prFormRow}>
                <div className={styles.prFormGroup}>
                  <div className={styles.floatingGroup}>
                    <input
                      type="text"
                      id="badge-number"
                      className={styles.floatingInput}
                      placeholder=" "
                      value={formData.badge_number}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          badge_number: e.target.value,
                        }))
                      }
                    />
                    <label
                      htmlFor="badge-number"
                      className={styles.floatingLabel}
                    >
                      Badge Number (Optional)
                    </label>
                  </div>
                </div>
                <div className={styles.prFormGroup}>
                  <div
                    className={styles.floatingGroup}
                    id="rank-floating-group"
                  >
                    <button
                      type="button"
                      id="rank-trigger"
                      className={styles.rankTrigger}
                      onClick={() => setShowRankModal(true)}
                    >
                      <div className={styles.selectedRank}>
                        {selectedRank ? (
                          <>
                            <div
                              className={`${styles.rankIcon} ${selectedRank}`}
                            >
                              <img src={selectedRankImage} alt={selectedRank} />
                            </div>
                            <span>
                              {
                                rankOptions.find((r) => r.rank === selectedRank)
                                  ?.name
                              }
                            </span>
                          </>
                        ) : (
                          <span className={styles.placeholder}>
                            Select Rank *
                          </span>
                        )}
                      </div>
                    </button>
                    <input
                      type="hidden"
                      id="rank"
                      value={selectedRank}
                      ref={rankImageInputRef}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className={styles.prFormRow}>
                <div className={styles.prFormGroup}>
                  <div className={styles.floatingGroup}>
                    <input
                      type="text"
                      id="first-name"
                      className={styles.floatingInput}
                      placeholder=" "
                      value={formData.first_name}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          first_name: e.target.value,
                        }))
                      }
                      required
                    />
                    <label
                      htmlFor="first-name"
                      className={styles.floatingLabel}
                    >
                      First Name *
                    </label>
                  </div>
                </div>
                <div className={styles.prFormGroup}>
                  <div className={styles.floatingGroup}>
                    <input
                      type="text"
                      id="middle-name"
                      className={styles.floatingInput}
                      placeholder=" "
                      value={formData.middle_name}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          middle_name: e.target.value,
                        }))
                      }
                    />
                    <label
                      htmlFor="middle-name"
                      className={styles.floatingLabel}
                    >
                      Middle Name
                    </label>
                  </div>
                </div>
                <div className={styles.prFormGroup}>
                  <div className={styles.floatingGroup}>
                    <input
                      type="text"
                      id="last-name"
                      className={styles.floatingInput}
                      placeholder=" "
                      value={formData.last_name}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          last_name: e.target.value,
                        }))
                      }
                      required
                    />
                    <label htmlFor="last-name" className={styles.floatingLabel}>
                      Last Name *
                    </label>
                  </div>
                </div>
                <div className={styles.prFormGroup}>
                  <div className={styles.floatingGroup}>
                    <select
                      id="suffix"
                      className={styles.floatingSelect}
                      value={formData.suffix}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          suffix: e.target.value,
                        }))
                      }
                    >
                      {suffixOptions.map((suffix) => (
                        <option key={suffix} value={suffix}>
                          {suffix || "Suffix (Optional)"}
                        </option>
                      ))}
                    </select>
                    <label htmlFor="suffix" className={styles.floatingLabel}>
                      Suffix
                    </label>
                  </div>
                </div>
              </div>

              <div className={styles.prFormRow}>
                <div className={styles.prFormGroup}>
                  <div className={styles.floatingGroup}>
                    <input
                      type="text"
                      id="designation"
                      className={styles.floatingInput}
                      placeholder=" "
                      value={formData.designation}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          designation: e.target.value,
                        }))
                      }
                    />
                    <label
                      htmlFor="designation"
                      className={styles.floatingLabel}
                    >
                      Designation
                    </label>
                  </div>
                </div>
                <div className={styles.prFormGroup}>
                  <div className={styles.floatingGroup}>
                    <input
                      type="text"
                      id="station"
                      className={styles.floatingInput}
                      placeholder=" "
                      value={formData.station}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          station: e.target.value,
                        }))
                      }
                    />
                    <label htmlFor="station" className={styles.floatingLabel}>
                      Station Assignment
                    </label>
                  </div>
                </div>
              </div>

              <div className={styles.prFormRow}>
                <div className={styles.prFormGroup}>
                  <div className={styles.floatingGroup}>
                    <input
                      type="text"
                      id="username-preview"
                      className={`${styles.floatingInput} ${styles.readOnlyField}`}
                      placeholder=" "
                      value={generatedUsername}
                      readOnly
                      disabled
                    />
                    <label
                      htmlFor="username-preview"
                      className={styles.floatingLabel}
                    >
                      Username (Auto-generated)
                    </label>
                  </div>
                </div>
                <div className={styles.prFormGroup}>
                  <div className={styles.floatingGroup}>
                    <input
                      type="text"
                      id="password-preview"
                      className={`${styles.floatingInput} ${styles.readOnlyField}`}
                      placeholder=" "
                      value={generatedPassword}
                      readOnly
                      disabled
                    />
                    <label
                      htmlFor="password-preview"
                      className={styles.floatingLabel}
                    >
                      Password (Auto-generated)
                    </label>
                  </div>
                  <button
                    type="button"
                    className={styles.regeneratePasswordBtn}
                    onClick={() => setGeneratedPassword(generatePassword())}
                  >
                    Regenerate
                  </button>
                </div>
              </div>

              <div className={styles.prFormRow}>
                <div className={styles.prFormGroup}>
                  <div className={styles.floatingGroup}>
                    <Flatpickr
                      value={formData.birth_date}
                      onChange={([date]) =>
                        setFormData((prev) => ({ ...prev, birth_date: date }))
                      }
                      options={{ dateFormat: "Y-m-d", maxDate: "today" }}
                      className={styles.floatingInput}
                      placeholder=" "
                    />
                    <label
                      htmlFor="birth-date"
                      className={styles.floatingLabel}
                    >
                      Birth Date
                    </label>
                  </div>
                </div>
                <div className={styles.prFormGroup}>
                  <div className={styles.floatingGroup}>
                    <Flatpickr
                      value={formData.date_hired}
                      onChange={([date]) =>
                        setFormData((prev) => ({ ...prev, date_hired: date }))
                      }
                      options={{ dateFormat: "Y-m-d", maxDate: "today" }}
                      className={styles.floatingInput}
                      placeholder=" "
                    />
                    <label
                      htmlFor="date-hired"
                      className={styles.floatingLabel}
                    >
                      Date Hired
                    </label>
                  </div>
                </div>
              </div>

              <div className={styles.prDateValidationNote}>
                <small>Note: Birth Date ≤ Date Hired ≤ Retirement Date</small>
              </div>

              <div className={styles.prFormActions}>
                <button
                  type="button"
                  className={styles.prCancel}
                  onClick={resetForm}
                  disabled={isRegistering}
                >
                  Clear Information
                </button>
                <button
                  type="submit"
                  className={`${styles.prSubmit} ${
                    isRegistering ? styles.prSubmitLoading : ""
                  }`}
                  disabled={isRegistering}
                >
                  {isRegistering ? (
                    <>
                      <span className={styles.prSubmitSpinner}></span>
                      Registering...
                    </>
                  ) : (
                    "Register Personnel"
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* ========== FILTER CONTROLS (ADDED) - Matching Inventory Control Style ========== */}
        <div className={styles.prTableHeaderSection}>
          <h2>All Registered Personnel</h2>
          <div className={styles.prTopControls}>
            <button
              className={styles.prShowFiltersBtn}
              onClick={() => setShowFilters(!showFilters)}
              type="button"
            >
              <FaFilter /> {showFilters ? "Hide Filters" : "Show Filters"}
            </button>
            {renderPaginationButtons()}
          </div>
        </div>

        {/* ========== FILTER PANEL (ADDED) - Matching Inventory Control Style ========== */}
        {showFilters && (
          <div className={styles.prFilterPanel}>
            <div className={styles.prFilterRow}>
              <div className={styles.prFilterGroup}>
                <input
                  type="text"
                  className={styles.prSearchBar}
                  placeholder="🔍 Search name, rank, station, badge..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className={styles.prFilterGroup}>
                <select
                  className={styles.prFilterSelect}
                  value={filterRank}
                  onChange={(e) => setFilterRank(e.target.value)}
                >
                  <option value="">All Ranks</option>
                  {rankOptions.map((rank) => (
                    <option key={rank.rank} value={rank.rank}>
                      {rank.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.prFilterGroup}>
                <select
                  className={styles.prFilterSelect}
                  value={filterStation}
                  onChange={(e) => setFilterStation(e.target.value)}
                >
                  <option value="">All Stations</option>
                  {getUniqueStations().map((station) => (
                    <option key={station} value={station}>
                      {station}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.prFilterGroup}>
                <button
                  className={styles.prClearFiltersBtn}
                  onClick={clearFilters}
                  type="button"
                >
                  Clear Filters
                </button>
              </div>
            </div>
            <div className={styles.prFilterInfo}>
              Showing {filteredPersonnel.length} of {personnel?.length || 0}{" "}
              personnel
              {search || filterRank || filterStation ? " (filtered)" : ""}
            </div>
          </div>
        )}

        <div className={styles.prTableBorder}>
          <table className={styles.prTable}>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Badge No.</th>
                <th>First</th>
                <th>Middle</th>
                <th>Last</th>
                <th>Suffix</th>
                <th>Designation</th>
                <th>Station</th>
                <th>Birth Date</th>
                <th>Date Hired</th>
                <th>Retirement</th>
                <th>Username</th>
                <th>Password</th>
                <th>Photo</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentPersonnel.length === 0 ? (
                <tr>
                  <td
                    colSpan="15"
                    style={{ textAlign: "center", padding: "40px" }}
                  >
                    <div style={{ fontSize: "48px", marginBottom: "16px" }}>
                      <span className={styles.animatedEmoji}>📇</span>
                    </div>
                    <h3
                      style={{
                        fontSize: "18px",
                        fontWeight: "600",
                        color: "#2b2b2b",
                        marginBottom: "8px",
                      }}
                    >
                      {search || filterRank || filterStation
                        ? "No Personnel Found Matching Filters"
                        : "No Personnel Registered"}
                    </h3>
                    <p style={{ fontSize: "14px", color: "#999" }}>
                      {search || filterRank || filterStation
                        ? "Try adjusting your search or filter criteria"
                        : "BFP personnel register is empty - add your first team member"}
                    </p>
                  </td>
                </tr>
              ) : (
                currentPersonnel.map((person) => {
                  if (!person) return null;
                  return (
                    <tr key={person.id}>
                      <td>{getRankDisplay(person)}</td>
                      <td>
                        {person.badge_number ? (
                          <HighlightMatch
                            text={person.badge_number}
                            searchTerm={search}
                          />
                        ) : (
                          "-"
                        )}
                      </td>
                      <td>
                        <HighlightMatch
                          text={person.first_name}
                          searchTerm={search}
                        />
                      </td>
                      <td>
                        {person.middle_name ? (
                          <HighlightMatch
                            text={person.middle_name}
                            searchTerm={search}
                          />
                        ) : (
                          "-"
                        )}
                      </td>
                      <td>
                        <HighlightMatch
                          text={person.last_name}
                          searchTerm={search}
                        />
                      </td>
                      <td>{person.suffix || "-"}</td>
                      <td>{person.designation || "-"}</td>
                      <td>
                        {person.station ? (
                          <HighlightMatch
                            text={person.station}
                            searchTerm={search}
                          />
                        ) : (
                          "-"
                        )}
                      </td>
                      <td>{formatDate(person.birth_date)}</td>
                      <td>{formatDate(person.date_hired)}</td>
                      <td>{formatDate(person.retirement_date)}</td>
                      <td>{person.username}</td>
                      <PasswordCell password={person.password} />
                      <PhotoCell
                        photoUrl={person.photo_url}
                        alt={`${person.first_name} ${person.last_name}`}
                      />

                      <td className={styles.prActionsCell}>
                        <div className={styles.prActionsContainer}>
                          {/* Show lock status prominently */}
                          {lockedPersonnel[person.id]?.isLocked ? (
                            <div
                              style={{
                                background: "#ffebee",
                                padding: "5px 10px",
                                borderRadius: "4px",
                                border: "1px solid #f44336",
                                marginRight: "10px",
                                display: "flex",
                                alignItems: "center",
                              }}
                            >
                              <span
                                style={{ color: "#f44336", marginRight: "5px" }}
                              >
                                🔒
                              </span>
                              <span
                                style={{ fontSize: "12px", color: "#d32f2f" }}
                              >
                                {lockedPersonnel[person.id].lockReason}
                              </span>
                            </div>
                          ) : (
                            <LockStatusIcon personnelId={person.id} />
                          )}

                          <button
                            className={`${styles.prEditBtn} ${
                              lockedPersonnel[person.id]?.isLocked
                                ? styles.disabled
                                : ""
                            }`}
                            onClick={() => {
                              if (lockedPersonnel[person.id]?.isLocked) {
                                toast.warning(
                                  `Cannot edit: ${
                                    lockedPersonnel[person.id]?.lockReason
                                  }`
                                );
                              } else {
                                openEdit(person);
                              }
                            }}
                            disabled={lockedPersonnel[person.id]?.isLocked}
                          >
                            Edit
                          </button>

                          <button
                            className={`${styles.prDeleteBtn} ${
                              lockedPersonnel[person.id]?.isLocked
                                ? styles.disabled
                                : ""
                            }`}
                            onClick={() => {
                              if (lockedPersonnel[person.id]?.isLocked) {
                                toast.warning(
                                  `Cannot delete: ${
                                    lockedPersonnel[person.id]?.lockReason
                                  }`
                                );
                              } else {
                                handleDeleteClick(
                                  person.id,
                                  `${person.first_name} ${person.last_name}`
                                );
                              }
                            }}
                            disabled={lockedPersonnel[person.id]?.isLocked}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ========== BOTTOM PAGINATION ========== */}
        <div className={styles.prBottomPagination}>
          {renderPaginationButtons()}
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <div
          id="editModal"
          className={`${styles.modal} ${styles.show} main-content ${
            isSidebarCollapsed ? styles.sidebarCollapsed : ""
          }`}
        >
          <div
            className={`${styles.modalContent} ${
              isSidebarCollapsed ? styles.modalContentCollapsed : ""
            }`}
          >
            <div className={styles.modalHeader}>
              <h2>Edit Personnel</h2>
              <button
                onClick={handleCloseEditModal}
                className={styles.ShowEditModalCloseBtn}
              >
                &times;
              </button>
            </div>

            <div className={styles.prEditModalLayout}>
              <div className={styles.prEditModalPhotoSection}>
                <div className={styles.prEditModalPhotoPreview}>
                  {editPhotoPreview ? (
                    <img src={editPhotoPreview} alt="New Preview" />
                  ) : editingPerson?.photo_url ? (
                    <img src={editingPerson.photo_url} alt="Current" />
                  ) : (
                    <span>No Photo</span>
                  )}
                </div>
                <div className={styles.prEditModalFileUpload}>
                  <label
                    htmlFor="edit-photo"
                    className={styles.prEditModalFileUploadLabel}
                  >
                    📂 Change Photo
                  </label>
                  <input
                    type="file"
                    id="edit-photo"
                    accept="image/*"
                    onChange={handleEditPhotoChange}
                    ref={editPhotoInputRef}
                  />
                  <span id="file-chosens">{EditFileChosen}</span>
                </div>
                {(editPhotoPreview || editingPerson?.photo_url) && (
                  <button
                    type="button"
                    className={styles.prEditModalClearBtn}
                    onClick={clearEditPhoto}
                  >
                    Remove Photo
                  </button>
                )}
              </div>

              <form id="edit-form" onSubmit={handleEditSubmit}>
                <input type="hidden" id="edit-id" value={editingPerson?.id} />

                <div className={styles.prFormRow}>
                  <div className={styles.prFormGroup}>
                    <label htmlFor="edit-badge">Badge Number</label>
                    <input
                      type="text"
                      id="edit-badge"
                      value={editFormData.badge_number}
                      onChange={(e) =>
                        setEditFormData((prev) => ({
                          ...prev,
                          badge_number: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className={styles.prFormGroup}>
                    <label htmlFor="edit-rank">Rank</label>
                    <div className={styles.prEditRankGroup}>
                      <button
                        type="button"
                        id="edit-rank-trigger"
                        className={styles.prEditRankTrigger}
                        onClick={() => setShowEditRankModal(true)}
                      >
                        <div className={styles.selectedRank}>
                          {editSelectedRank ? (
                            <>
                              <div
                                className={`${styles.rankIcon} ${editSelectedRank}`}
                              >
                                <img
                                  src={editSelectedRankImage}
                                  alt={editSelectedRank}
                                />
                              </div>
                              <span>
                                {
                                  rankOptions.find(
                                    (r) => r.rank === editSelectedRank
                                  )?.name
                                }
                              </span>
                            </>
                          ) : (
                            <span className={styles.placeholder}>
                              Select Rank
                            </span>
                          )}
                        </div>
                      </button>
                      <input
                        type="hidden"
                        id="edit-rank"
                        value={editSelectedRank}
                      />
                      <input
                        type="hidden"
                        id="edit-rank-image"
                        value={editSelectedRankImage}
                      />
                    </div>
                  </div>
                </div>

                <div className={styles.prFormRow}>
                  <div className={styles.prFormGroup}>
                    <label htmlFor="edit-first">First Name *</label>
                    <input
                      type="text"
                      id="edit-first"
                      value={editFormData.first_name}
                      onChange={(e) =>
                        setEditFormData((prev) => ({
                          ...prev,
                          first_name: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                  <div className={styles.prFormGroup}>
                    <label htmlFor="edit-middle">Middle Name</label>
                    <input
                      type="text"
                      id="edit-middle"
                      value={editFormData.middle_name}
                      onChange={(e) =>
                        setEditFormData((prev) => ({
                          ...prev,
                          middle_name: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className={styles.prFormGroup}>
                    <label htmlFor="edit-last">Last Name *</label>
                    <input
                      type="text"
                      id="edit-last"
                      value={editFormData.last_name}
                      onChange={(e) =>
                        setEditFormData((prev) => ({
                          ...prev,
                          last_name: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                  <div className={styles.prFormGroup}>
                    <label htmlFor="edit-suffix">Suffix</label>
                    <select
                      id="edit-suffix"
                      value={editFormData.suffix}
                      onChange={(e) =>
                        setEditFormData((prev) => ({
                          ...prev,
                          suffix: e.target.value,
                        }))
                      }
                    >
                      {suffixOptions.map((suffix) => (
                        <option key={suffix} value={suffix}>
                          {suffix || "None"}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className={styles.prFormRow}>
                  <div className={styles.prFormGroup}>
                    <label htmlFor="edit-designation">Designation</label>
                    <input
                      type="text"
                      id="edit-designation"
                      value={editFormData.designation}
                      onChange={(e) =>
                        setEditFormData((prev) => ({
                          ...prev,
                          designation: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className={styles.prFormGroup}>
                    <label htmlFor="edit-station">Station</label>
                    <input
                      type="text"
                      id="edit-station"
                      value={editFormData.station}
                      onChange={(e) =>
                        setEditFormData((prev) => ({
                          ...prev,
                          station: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className={styles.prFormGroup}>
                    <label htmlFor="edit-retirement">Retirement Date</label>
                    <Flatpickr
                      value={editFormData.retirement_date}
                      onChange={([date]) =>
                        setEditFormData((prev) => ({
                          ...prev,
                          retirement_date: date,
                        }))
                      }
                      options={{
                        dateFormat: "Y-m-d",
                        minDate: editFormData.date_hired || "today",
                      }}
                    />
                  </div>
                </div>

                <div className={styles.prFormRow}>
                  <div className={styles.prFormGroup}>
                    <label htmlFor="edit-birth">Birth Date</label>
                    <Flatpickr
                      value={editFormData.birth_date}
                      onChange={([date]) =>
                        setEditFormData((prev) => ({
                          ...prev,
                          birth_date: date,
                        }))
                      }
                      options={{
                        dateFormat: "Y-m-d",
                        maxDate: editFormData.date_hired || "today",
                      }}
                    />
                  </div>
                  <div className={styles.prFormGroup}>
                    <label htmlFor="edit-hired">Date Hired</label>
                    <Flatpickr
                      value={editFormData.date_hired}
                      onChange={([date]) =>
                        setEditFormData((prev) => ({
                          ...prev,
                          date_hired: date,
                        }))
                      }
                      options={{
                        dateFormat: "Y-m-d",
                        minDate: editFormData.birth_date || "1900-01-01",
                        maxDate: editFormData.retirement_date || "today",
                      }}
                    />
                  </div>
                </div>

                <div className={styles.prDateValidationNote}>
                  <small>Note: Birth Date ≤ Date Hired ≤ Retirement Date</small>
                </div>

                <div className={styles.prFormActions}>
                  <button
                    onClick={handleCloseEditModal}
                    type="button"
                    className={styles.prCancel}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={`${styles.prSubmit} ${
                      isSavingEdit ? styles.prSubmitLoading : ""
                    }`}
                    disabled={isSavingEdit}
                  >
                    {isSavingEdit ? (
                      <>
                        <span className={styles.editSaveSpinner}></span>
                        Saving...
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Rank Modal */}
      {showRankModal && (
        <div
          id="rankModal"
          className={`${styles.rankModal} ${styles.show} ${
            isSidebarCollapsed ? styles.sidebarCollapsed : ""
          }`}
        >
          <div
            className={`${styles.rankModalContent} ${
              isSidebarCollapsed ? styles.rankModalContentCollapsed : ""
            }`}
          >
            <div className={styles.rankModalHeader}>
              <h2>Select Rank</h2>
              <button
                className={styles.rankModalClose}
                onClick={() => setShowRankModal(false)}
              >
                &times;
              </button>
            </div>
            <div className={styles.rankOptions}>
              {rankOptions.map((option) => (
                <div
                  key={option.rank}
                  className={`${styles.rankOption} ${option.rank} ${
                    selectedRank === option.rank ? styles.selected : ""
                  }`}
                  onClick={() => selectRank(option.rank, option.image)}
                >
                  <div className={styles.rankIcon}>
                    <img src={option.image} alt={option.rank} />
                  </div>
                  <div className={styles.rankName}>{option.name}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Edit Rank Modal */}
      {showEditRankModal && (
        <div
          id="editRankModal"
          className={`${styles.rankModal} ${styles.show} ${
            isSidebarCollapsed ? styles.sidebarCollapsed : ""
          }`}
        >
          <div
            className={`${styles.rankModalContent} ${
              isSidebarCollapsed ? styles.rankModalContentCollapsed : ""
            }`}
          >
            <div className={styles.rankModalHeader}>
              <h2>Select Rank</h2>
              <button
                className={styles.rankModalClose}
                onClick={() => setShowEditRankModal(false)}
              >
                &times;
              </button>
            </div>
            <div className={styles.rankOptions}>
              {rankOptions.map((option) => (
                <div
                  key={option.rank}
                  className={`${styles.rankOption} ${option.rank} ${
                    editSelectedRank === option.rank ? styles.selected : ""
                  }`}
                  onClick={() => selectEditRank(option.rank, option.image)}
                >
                  <div className={styles.rankIcon}>
                    <img src={option.image} alt={option.rank} />
                  </div>
                  <div className={styles.rankName}>{option.name}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteConfirm && (
        <div
          className={`${styles.preModalDelete} ${
            isSidebarCollapsed ? styles.sidebarCollapsed : ""
          }`}
          style={{ display: "flex" }}
        >
          <div
            className={`${styles.preModalContentDelete} ${
              isSidebarCollapsed ? styles.deleteModalContentCollapsed : ""
            }`}
            style={{ maxWidth: "450px" }}
          >
            <div className={styles.preModalHeaderDelete}>
              <h2 style={{ marginLeft: "30px" }}>Confirm Deletion</h2>
              <span className={styles.preCloseBtn} onClick={cancelDelete}>
                &times;
              </span>
            </div>

            <div className={styles.preModalBody}>
              <div className={styles.deleteConfirmationContent}>
                <div className={styles.deleteWarningIcon}>⚠️</div>
                <p className={styles.deleteConfirmationText}>
                  Are you sure you want to delete the personnel record for
                </p>
                <p className={styles.documentNameHighlight}>"{deleteName}"?</p>
                <p className={styles.deleteWarning}>
                  This action cannot be undone.
                </p>
              </div>
            </div>

            <div className={styles.preModalActions}>
              <button
                className={`${styles.preBtn} ${styles.preCancelBtn}`}
                onClick={cancelDelete}
              >
                Cancel
              </button>
              <button
                className={`${styles.preBtn} ${styles.deleteConfirmBtn} ${
                  isDeleting ? styles.deleteConfirmBtnLoading : ""
                }`}
                onClick={confirmDeletePersonnel}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <span className={styles.deleteSpinner}></span>
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PersonnelRegister;
