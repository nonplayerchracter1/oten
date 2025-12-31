import React, { useState, useEffect, useRef, useMemo } from "react";
import styles from "../styles/LeaveManagement.module.css";
import Sidebar from "../../Sidebar.jsx";
import Hamburger from "../../Hamburger.jsx";
import { useSidebar } from "../../SidebarContext.jsx";
import { Title, Meta } from "react-head";
import { supabase } from "../../../lib/supabaseClient.js";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import BFPPreloader from "../../BFPPreloader.jsx"; // UNCOMMENT THIS
import { useAuth } from "../../AuthContext.jsx";
import {
  uploadLeaveDocumentToStorage,
  createPersonnelFolderName,
  createLeavePdfFileName,
  saveLeaveDocumentMetadata,
} from "../../utils/leaveDocumentUpload.js";
import { fillLeaveFormEnhanced } from "../../utils/pdfLeaveFormFiller.js";
const LeaveManagement = () => {
  const { isSidebarCollapsed } = useSidebar();
  const { user: authUser, hasSupabaseAuth } = useAuth();

  // UNCOMMENT AND ACTIVATE THESE PRELOADER STATES
  const [isInitializing, setIsInitializing] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [showContent, setShowContent] = useState(false);

  // Add this state to track if data is fully loaded
  const [isDataFullyLoaded, setIsDataFullyLoaded] = useState(false);

  const [leaveRequests, setLeaveRequests] = useState([]);
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [currentView, setCurrentView] = useState("table");
  const [currentPage, setCurrentPage] = useState(1);
  const [currentPageCards, setCurrentPageCards] = useState(1);
  const [searchValue, setSearchValue] = useState("");
  const [filterValue, setFilterValue] = useState("All");
  const [modalData, setModalData] = useState(null);
  const [processingAction, setProcessingAction] = useState(null);

  // New states for confirmation modals
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");

  // PDF generation states
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfDownloadProgress, setPdfDownloadProgress] = useState(0);
  const [pdfDownloadForRequest, setPdfDownloadForRequest] = useState(null);

  const [isAdmin, setIsAdmin] = useState(false);
  const [adminUsername, setAdminUsername] = useState("");
  const [currentUser, setCurrentUser] = useState(null);

  // Dynamic card count based on sidebar state
  const rowsPerPage = 5;
  const rowsPerPageCards = isSidebarCollapsed ? 8 : 6; // Dynamic card count

  // Recalculate pagination when sidebar state changes
  useEffect(() => {
    // When sidebar state changes, reset to first page and recalculate
    setCurrentPageCards(1);
  }, [isSidebarCollapsed]);

  // UNCOMMENT AND ACTIVATE loading phases
  const loadingPhasesRef = useRef([
    { name: "Checking Authentication", progress: 20, completed: false },
    { name: "Loading User Data", progress: 40, completed: false },
    { name: "Fetching Leave Requests", progress: 70, completed: false },
    { name: "Setting Up Real-time Updates", progress: 90, completed: false },
    { name: "Finalizing", progress: 100, completed: false },
  ]);

  // UNCOMMENT AND ACTIVATE loading phase helper
  const updateLoadingPhase = async (phaseIndex, phaseName) => {
    return new Promise((resolve) => {
      // Update progress based on phase
      setLoadingProgress(loadingPhasesRef.current[phaseIndex].progress);

      // Small delay for smooth progress animation
      setTimeout(resolve, 150);
    });
  };

  useEffect(() => {
    // ENHANCED INITIALIZATION WITH PRELOADER SYNC
    const initializeData = async () => {
      try {
        // Phase 1: Check authentication
        await updateLoadingPhase(0, "Checking Authentication");

        // Phase 2: Load user data
        await updateLoadingPhase(1, "Loading User Data");
        await checkIfAdmin();

        // Phase 3: Fetch leave requests (WAIT FOR THIS TO COMPLETELY FINISH)
        await updateLoadingPhase(2, "Fetching Leave Requests");
        await loadLeaveRequests(); // This will set isDataFullyLoaded when done

        // Phase 4: Setup real-time updates
        await updateLoadingPhase(3, "Setting Up Real-time Updates");
        setupRealtimeUpdates();

        // Phase 5: Finalize - Wait for data to be fully loaded
        await updateLoadingPhase(4, "Finalizing");

        // Add a small delay to ensure all data is processed
        await new Promise((resolve) => setTimeout(resolve, 300));

        // Mark data as fully loaded
        setIsDataFullyLoaded(true);

        // Now we can safely hide the preloader
        setTimeout(() => {
          setIsInitializing(false);
          setTimeout(() => setShowContent(true), 300);
        }, 500);
      } catch (error) {
        console.error("Data loading error:", error);
        toast.error("Some data failed to load. Please refresh if needed.");
        // Still show content even on error, but mark as loaded
        setIsDataFullyLoaded(true);
        setIsInitializing(false);
        setTimeout(() => setShowContent(true), 300);
      }
    };

    initializeData();

    return () => {
      // Cleanup real-time subscription
      const channel = supabase.channel("leave-requests-changes");
      supabase.removeChannel(channel);
    };
  }, []); // Empty dependency array - runs once on mount

  const setupRealtimeUpdates = () => {
    const channel = supabase
      .channel("leave-requests-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leave_requests" },
        () => {
          // Debounced reload
          setTimeout(() => {
            loadLeaveRequests();
          }, 1000);
        }
      )
      .subscribe();
  };

  useEffect(() => {
    applyFilterAndSearch();
  }, [searchValue, filterValue, leaveRequests]);

  const checkIfAdmin = async () => {
    try {
      const currentUserData = localStorage.getItem("adminUser");

      if (currentUserData) {
        const user = JSON.parse(currentUserData);
        setCurrentUser(user);

        const userIsAdmin = user.role === "admin" || user.isAdmin === true;
        setIsAdmin(userIsAdmin);
        setAdminUsername(user.username || "Admin");

        console.log("Admin check result:", {
          isAdmin: userIsAdmin,
          username: user.username,
          role: user.role,
        });
      } else {
        setIsAdmin(false);
        console.log("No admin user found in localStorage");
      }
    } catch (error) {
      console.error("Error in checkIfAdmin:", error);
      setIsAdmin(false);
      throw error; // Re-throw to be caught in initialization
    }
  };

  const loadLeaveRequests = async () => {
    try {
      let query = supabase
        .from("leave_requests")
        .select(
          `
        *,
        personnel:personnel_id (
          first_name,
          last_name,
          middle_name,
          rank,
          rank_image,
          station,
          username,
          email,
          is_admin,
          can_approve_leaves
        ),
        leave_documents (
          id,
          document_name,
          file_url,
          file_path,
          uploaded_at,
          document_type
        )
      `
        )
        .order("created_at", { ascending: false });

      if (!isAdmin) {
        if (currentUser && currentUser.username) {
          query = query.eq("username", currentUser.username);
        }
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error loading leave requests:", error);
        toast.error("Failed to load leave requests");
        throw error;
      }

      const transformedData = await Promise.all(
        data.map(async (item) => {
          const personnel = item.personnel || {};

          // Build full name with separate components
          const firstName = personnel.first_name || "";
          const lastName = personnel.last_name || "";
          const middleName = personnel.middle_name || "";

          const employeeName =
            item.employee_name ||
            `${firstName} ${lastName}`.trim() ||
            item.username ||
            "Unknown Employee";

          // Get rank image URL
          let rankImageUrl = "";
          if (personnel.rank_image) {
            try {
              // Check if it's already a full URL
              if (personnel.rank_image.startsWith("http")) {
                rankImageUrl = personnel.rank_image;
              } else {
                // Get public URL from rank_images bucket
                const { data: imageData } = supabase.storage
                  .from("rank_images")
                  .getPublicUrl(personnel.rank_image);
                rankImageUrl = imageData?.publicUrl || "";
              }
            } catch (imgError) {
              console.warn("Error loading rank image:", imgError);
              rankImageUrl = "";
            }
          }

          // Check if LEAVE_FORM PDF already exists
          const leaveFormDocuments =
            item.leave_documents?.filter(
              (doc) => doc.document_type === "LEAVE_FORM"
            ) || [];

          const hasExistingPdf = leaveFormDocuments.length > 0;
          const existingPdfUrl = hasExistingPdf
            ? leaveFormDocuments[0].file_url
            : null;

          return {
            id: item.id,
            personnel_id: item.personnel_id,
            username: item.username || personnel.username || "Unknown",
            employeeName: employeeName,
            firstName: firstName,
            lastName: lastName,
            middleName: middleName,
            leaveType: item.leave_type,
            startDate: item.start_date
              ? new Date(item.start_date).toISOString().split("T")[0]
              : "N/A",
            endDate: item.end_date
              ? new Date(item.end_date).toISOString().split("T")[0]
              : "N/A",
            numDays: item.num_days,
            location: item.location || personnel.station || "-",
            status: item.status || "Pending",
            dateOfFiling: item.date_of_filing
              ? new Date(item.date_of_filing).toISOString().split("T")[0]
              : "N/A",
            submittedAt: item.submitted_at,
            createdAt: item.created_at,
            updated_at: item.updated_at,
            approved_by: item.approved_by || null,
            reason: item.reason || null,
            balance_before: item.balance_before,
            balance_after: item.balance_after,
            leave_balance_id: item.leave_balance_id,
            rank: personnel.rank || "",
            rankImage: rankImageUrl, // ADD THIS
            station: personnel.station || "",
            hasExistingPdf: hasExistingPdf,
            existingPdfUrl: existingPdfUrl,
            vacation_location_type: item.vacation_location_type || null,
            illness_type: item.illness_type || null,
            illness_details: item.illness_details || null,
          };
        })
      );

      setLeaveRequests(transformedData);
      setFilteredRequests(transformedData);

      return transformedData;
    } catch (err) {
      console.error("Error loading leave requests:", err);
      toast.error("Error loading leave requests");
      throw err;
    }
  };
  const applyFilterAndSearch = () => {
    const filtered = leaveRequests.filter((req) => {
      const statusMatch =
        filterValue.toLowerCase() === "all" ||
        (req.status &&
          req.status.toLowerCase().trim() === filterValue.toLowerCase());
      const searchMatch =
        req.employeeName?.toLowerCase().includes(searchValue.toLowerCase()) ||
        req.leaveType?.toLowerCase().includes(searchValue.toLowerCase()) ||
        (req.location &&
          req.location.toLowerCase().includes(searchValue.toLowerCase()));
      return statusMatch && searchMatch;
    });
    setFilteredRequests(filtered);
    setCurrentPage(1);
    setCurrentPageCards(1);
  };

  const toggleView = () => {
    setCurrentView(currentView === "table" ? "cards" : "table");
  };

  // PDF Generation Functions
  const loadPdfTemplate = async () => {
    try {
      // Try multiple paths for the template
      const templatePaths = [
        "/forms/BFP_Leave_Form.pdf", // Public folder
        "./forms/BFP_Leave_Form.pdf", // Relative path
        `${window.location.origin}/forms/BFP_Leave_Form.pdf`, // Absolute URL
      ];

      let response = null;
      let lastError = null;

      for (const path of templatePaths) {
        try {
          console.log("Trying to load template from:", path);
          response = await fetch(path);
          if (response.ok) {
            console.log("Template loaded successfully from:", path);
            break;
          }
        } catch (error) {
          lastError = error;
          console.warn(`Failed to load from ${path}:`, error.message);
        }
      }

      if (!response || !response.ok) {
        throw new Error(
          `Failed to load PDF template from any path. Last error: ${
            lastError?.message || "Unknown error"
          }`
        );
      }

      const pdfBytes = await response.arrayBuffer();
      return pdfBytes;
    } catch (error) {
      console.error("Error loading PDF template:", error);
      throw error;
    }
  };

  // Helper function to format dates for PDF
  const formatDateForPDF = (dateString) => {
    if (!dateString || dateString === "N/A") return "";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch (error) {
      return dateString;
    }
  };

  // Helper function to split long text into multiple lines
  const splitTextIntoLines = (text, maxLength) => {
    if (!text) return [];
    const words = text.split(" ");
    const lines = [];
    let currentLine = "";

    for (const word of words) {
      if ((currentLine + word).length > maxLength) {
        lines.push(currentLine.trim());
        currentLine = word + " ";
      } else {
        currentLine += word + " ";
      }
    }

    if (currentLine.trim()) {
      lines.push(currentLine.trim());
    }

    return lines;
  };

  const downloadPdf = (pdfBytes, fileName) => {
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };



  const generatePDF = async (leaveData) => {
    try {
      // Load PDF template
      const pdfBytes = await loadPdfTemplate();

      // Use the imported enhanced function
      const filledPdf = await fillLeaveFormEnhanced(
        pdfBytes,
        {
          ...leaveData,
          // Ensure proper field names
          lastName: leaveData.lastName || "",
          firstName: leaveData.firstName || "",
          middleName: leaveData.middleName || "",
          rank: leaveData.rank || "",
          station: leaveData.station || "",
          leaveType: leaveData.leaveType || "",
          location: leaveData.location || "",
          dateOfFiling: leaveData.dateOfFiling || leaveData.createdAt,
          balance_before: leaveData.balance_before || 0,
          balance_after: leaveData.balance_after || 0,
          numDays: leaveData.numDays || 0,
          vacationLocationType:
            leaveData.vacation_location_type || "philippines",
          illnessType: leaveData.illness_type || "",
          illnessDetails: leaveData.illness_details || "",
        },
        {
          isYearly: false,
          generationDate: new Date().toISOString(),
          adminUsername: adminUsername,
        }
      );

      return filledPdf;
    } catch (error) {
      console.error("Error generating PDF:", error);
      throw error;
    }
  };
  // Helper function to update UI without database updates
  const updateUIWithPdf = (requestId, pdfUrl, documentData = null) => {
    setLeaveRequests((prev) =>
      prev.map((req) =>
        req.id === requestId
          ? {
              ...req,
              hasExistingPdf: true,
              existingPdfUrl: pdfUrl,
              // Add document data if available
              ...(documentData && {
                documentId: documentData.id,
                documentUploadedAt: documentData.uploaded_at,
              }),
            }
          : req
      )
    );

    setFilteredRequests((prev) =>
      prev.map((req) =>
        req.id === requestId
          ? {
              ...req,
              hasExistingPdf: true,
              existingPdfUrl: pdfUrl,
              ...(documentData && {
                documentId: documentData.id,
                documentUploadedAt: documentData.uploaded_at,
              }),
            }
          : req
      )
    );
  };
const generateAndUploadLeaveForm = async (leaveRequest) => {
  if (!leaveRequest || !leaveRequest.id) {
    toast.error("Invalid leave request data");
    return;
  }

  // Check if already approved
  if (leaveRequest.status?.toLowerCase() !== "approved") {
    toast.warning("PDF form is only available for approved leave requests");
    return;
  }

  setGeneratingPdf(true);
  setPdfDownloadForRequest(leaveRequest.id);
  setPdfDownloadProgress(10);

  try {
    setPdfDownloadProgress(40);

    // Generate PDF
    const filledPdfBytes = await generatePDF(leaveRequest);

    // Get personnel data
    let personnelData = null;
    if (leaveRequest.personnel_id) {
      const { data, error } = await supabase
        .from("personnel")
        .select("*")
        .eq("id", leaveRequest.personnel_id)
        .single();

      if (!error) {
        personnelData = data;
      }
    }

    // Create record object
    const record = {
      ...leaveRequest,
      fullName: leaveRequest.employeeName,
      rank: leaveRequest.rank,
      badgeNumber: leaveRequest.badge_number,
      dateRequested: leaveRequest.created_at,
      approvedBy: adminUsername,
    };

    // Create filename
    const fileName = createLeavePdfFileName(record, personnelData);

    setPdfDownloadProgress(80);

    // Download locally
    downloadPdf(filledPdfBytes, fileName);

    setPdfDownloadProgress(85);

    try {
      // Use shared upload function
      const uploadResult = await uploadLeaveDocumentToStorage({
        record,
        pdfBytes: filledPdfBytes,
        fileName,
        isYearly: false,
        generatedBy: adminUsername,
      });

      // Save metadata using shared function
      const savedDocument = await saveLeaveDocumentMetadata({
        leaveRequestId: leaveRequest.id,
        documentName: fileName,
        fileUrl: uploadResult.fileUrl,
        filePath: uploadResult.filePath,
        fileSize: uploadResult.fileSize,
        uploadedBy: adminUsername,
      });

      // Update UI with saved document info
      if (savedDocument) {
        updateUIWithPdf(leaveRequest.id, uploadResult.fileUrl, savedDocument);
      } else {
        updateUIWithPdf(leaveRequest.id, uploadResult.fileUrl);
      }

      toast.success("✅ PDF uploaded and saved successfully!");
      setPdfDownloadProgress(100);
    } catch (uploadError) {
      console.warn("Upload process error:", uploadError);
      toast.warn("PDF downloaded locally. Cloud upload skipped.", {
        position: "top-right",
        autoClose: 3000,
      });
    }
  } catch (error) {
    console.error("Error in generateAndUploadLeaveForm:", error);
    toast.error(`Upload failed: ${error.message}`);
    toast.info("✅ PDF downloaded locally.");
  } finally {
    setTimeout(() => {
      setGeneratingPdf(false);
      setPdfDownloadForRequest(null);
      setPdfDownloadProgress(0);
    }, 1000);
  }
};

  const downloadExistingPdf = async (pdfUrl, leaveRequest) => {
    if (!pdfUrl) {
      toast.error("PDF URL not found");
      return;
    }

    try {
      // First try direct download
      const response = await fetch(pdfUrl);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();

      // Get personnel data for filename
      let personnelData = null;
      if (leaveRequest.personnel_id) {
        const { data, error } = await supabase
          .from("personnel")
          .select("*")
          .eq("id", leaveRequest.personnel_id)
          .single();

        if (!error) {
          personnelData = data;
        }
      }

      // Create filename with personnel details
      const fileName = createLeavePdfFileName(leaveRequest, personnelData);

      // Download the blob
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      toast.success("PDF downloaded successfully!");
    } catch (error) {
      console.error("Error downloading PDF:", error);

      // Fallback: Direct link opening
      toast.info("Opening PDF in new tab...");
      window.open(pdfUrl, "_blank");
    }
  };

  const updateLeaveBalanceForApproval = async (
    leaveBalanceId,
    leaveType,
    days
  ) => {
    try {
      const fieldMap = {
        Vacation: "vacation_balance",
        Sick: "sick_balance",
        Emergency: "emergency_balance",
      };

      const fieldName = fieldMap[leaveType];
      if (!fieldName) {
        console.error("Invalid leave type:", leaveType);
        return;
      }

      const { data: currentBalance, error: fetchError } = await supabase
        .from("leave_balances")
        .select(fieldName)
        .eq("id", leaveBalanceId)
        .single();

      if (fetchError) {
        console.error("Error fetching current balance:", fetchError);
        return;
      }

      const currentValue = parseFloat(currentBalance[fieldName] || 0);
      const newValue = Math.max(0, currentValue - days);

      const { error: updateError } = await supabase
        .from("leave_balances")
        .update({
          [fieldName]: newValue,
          updated_at: new Date().toISOString(),
        })
        .eq("id", leaveBalanceId);

      if (updateError) {
        console.error("Error updating leave balance:", updateError);
      }
    } catch (error) {
      console.error("Error in updateLeaveBalanceForApproval:", error);
    }
  };

  const updateLeaveBalanceForRejection = async (
    leaveBalanceId,
    leaveType,
    days
  ) => {
    try {
      const fieldMap = {
        Vacation: "vacation_balance",
        Sick: "sick_balance",
        Emergency: "emergency_balance",
      };

      const fieldName = fieldMap[leaveType];
      if (!fieldName) {
        console.error("Invalid leave type:", leaveType);
        return;
      }

      const { data: currentBalance, error: fetchError } = await supabase
        .from("leave_balances")
        .select(fieldName)
        .eq("id", leaveBalanceId)
        .single();

      if (fetchError) {
        console.error("Error fetching current balance:", fetchError);
        return;
      }

      const currentValue = parseFloat(currentBalance[fieldName] || 0);
      const newValue = currentValue + days;

      const { error: updateError } = await supabase
        .from("leave_balances")
        .update({
          [fieldName]: newValue,
          updated_at: new Date().toISOString(),
        })
        .eq("id", leaveBalanceId);

      if (updateError) {
        console.error("Error updating leave balance:", updateError);
      }
    } catch (error) {
      console.error("Error in updateLeaveBalanceForRejection:", error);
    }
  };

  const updatePersonnelLeaveBalance = async (
    personnelId,
    leaveType,
    days,
    isReturn = false
  ) => {
    try {
      const { data: employee, error: employeeError } = await supabase
        .from("personnel")
        .select("earned_vacation, earned_sick, earned_emergency")
        .eq("id", personnelId)
        .single();

      if (employeeError) {
        console.error("Error fetching employee:", employeeError);
        throw employeeError;
      }

      const balanceUpdateData = {};
      const leaveTypeLower = leaveType?.toLowerCase();

      if (leaveTypeLower === "vacation" && employee.earned_vacation != null) {
        const current = parseFloat(employee.earned_vacation) || 0;
        balanceUpdateData.earned_vacation = isReturn
          ? current + parseFloat(days || 0)
          : Math.max(0, current - parseFloat(days || 0));
      } else if (leaveTypeLower === "sick" && employee.earned_sick != null) {
        const current = parseFloat(employee.earned_sick) || 0;
        balanceUpdateData.earned_sick = isReturn
          ? current + parseFloat(days || 0)
          : Math.max(0, current - parseFloat(days || 0));
      } else if (
        leaveTypeLower === "emergency" &&
        employee.earned_emergency != null
      ) {
        const current = parseFloat(employee.earned_emergency) || 0;
        balanceUpdateData.earned_emergency = isReturn
          ? current + parseFloat(days || 0)
          : Math.max(0, current - parseFloat(days || 0));
      }

      if (Object.keys(balanceUpdateData).length > 0) {
        const { error: balanceError } = await supabase
          .from("personnel")
          .update(balanceUpdateData)
          .eq("id", personnelId);

        if (balanceError) {
          console.error("Error updating leave balance:", balanceError);
          throw balanceError;
        }
      }
    } catch (error) {
      console.error("Error in updatePersonnelLeaveBalance:", error);
      throw error;
    }
  };

  const returnLeaveCreditsForRejection = async (requestId, requestData) => {
    try {
      if (
        requestData.balance_before !== null &&
        requestData.balance_after !== null
      ) {
        const deductedAmount =
          requestData.balance_before - requestData.balance_after;

        if (deductedAmount > 0) {
          if (requestData.leave_balance_id) {
            await updateLeaveBalanceForRejection(
              requestData.leave_balance_id,
              requestData.leave_type,
              deductedAmount
            );
          } else {
            await updatePersonnelLeaveBalance(
              requestData.personnel_id,
              requestData.leave_type,
              deductedAmount,
              true
            );
          }
        }
      } else {
        const { data: previousStatus, error } = await supabase
          .from("leave_requests")
          .select("status")
          .eq("id", requestId)
          .single();

        if (!error && previousStatus?.status?.toLowerCase() === "approved") {
          await updatePersonnelLeaveBalance(
            requestData.personnel_id,
            requestData.leave_type,
            requestData.num_days,
            true
          );
        }
      }
    } catch (error) {
      console.error("Error returning leave credits:", error);
      throw error;
    }
  };

  const updateStatus = async (id, newStatus, reason = "") => {
    if (!isAdmin) {
      toast.error("Only administrators can update leave request status.");
      return;
    }

    setProcessingAction(id);

    try {
      const { data: currentRequest, error: fetchError } = await supabase
        .from("leave_requests")
        .select(
          "status, personnel_id, leave_type, num_days, username, employee_name, balance_before, balance_after, leave_balance_id"
        )
        .eq("id", id)
        .single();

      if (fetchError) {
        console.error("Error fetching request:", fetchError);
        toast.error("Error fetching leave request details");
        throw fetchError;
      }

      if (currentRequest.status?.toLowerCase() !== "pending") {
        toast.warn(
          `⚠️ This leave request has already been ${
            currentRequest.status?.toLowerCase() || "processed"
          }.`
        );
        setProcessingAction(null);
        // Don't reload immediately - just return
        return;
      }

      const updateData = {
        status: newStatus,
        updated_at: new Date().toISOString(),
        approved_by: adminUsername || "Admin",
      };

      if (newStatus === "Rejected") {
        if (reason.trim() !== "") {
          updateData.reason = reason.trim();
          updateData.rejection_reason = reason.trim();
        }
      } else if (newStatus === "Approved") {
        updateData.approval_remarks = `Approved by ${adminUsername || "Admin"}`;
      }

      // OPTIMISTIC UPDATE: Update local state immediately for instant UI feedback
      setLeaveRequests((prevRequests) =>
        prevRequests.map((request) =>
          request.id === id
            ? {
                ...request,
                status: newStatus,
                approved_by: adminUsername || "Admin",
                reason:
                  newStatus === "Rejected" ? reason.trim() : request.reason,
                updated_at: new Date().toISOString(),
              }
            : request
        )
      );

      setFilteredRequests((prevRequests) =>
        prevRequests.map((request) =>
          request.id === id
            ? {
                ...request,
                status: newStatus,
                approved_by: adminUsername || "Admin",
                reason:
                  newStatus === "Rejected" ? reason.trim() : request.reason,
                updated_at: new Date().toISOString(),
              }
            : request
        )
      );

      // Then make the API call to update the database
      const { error: updateError } = await supabase
        .from("leave_requests")
        .update(updateData)
        .eq("id", id);

      if (updateError) {
        console.error("Error updating request:", updateError);
        toast.error("Failed to update leave request");

        // Revert optimistic update on error
        await loadLeaveRequests();
        throw updateError;
      }

      // Update leave balances if needed
      if (newStatus === "Approved") {
        if (
          currentRequest.balance_before !== null &&
          currentRequest.balance_after !== null
        ) {
          if (currentRequest.leave_balance_id) {
            await updateLeaveBalanceForApproval(
              currentRequest.leave_balance_id,
              currentRequest.leave_type,
              currentRequest.num_days
            );
          } else {
            await updatePersonnelLeaveBalance(
              currentRequest.personnel_id,
              currentRequest.leave_type,
              currentRequest.num_days,
              false
            );
          }
        } else {
          await updatePersonnelLeaveBalance(
            currentRequest.personnel_id,
            currentRequest.leave_type,
            currentRequest.num_days,
            false
          );
        }
      } else if (newStatus === "Rejected") {
        await returnLeaveCreditsForRejection(id, currentRequest);
      }

      // Show success toast
      toast.info(
        `Leave request has been ${newStatus.toLowerCase()} successfully!`
      );

      // Instead of reloading immediately, wait a bit for the toast to show
      // Then refresh data in the background
      setTimeout(() => {
        loadLeaveRequests();
      }, 2000);
    } catch (err) {
      console.error("Error updating status:", err);

      let errorMessage =
        "Error updating leave request status. Please try again.";

      if (err.code === "23505") {
        errorMessage =
          "Duplicate entry error. This request may have already been processed.";
      } else if (err.code === "23503") {
        errorMessage =
          "Foreign key violation. The personnel record may not exist.";
      } else if (err.message?.includes("network")) {
        errorMessage = "Network error. Please check your internet connection.";
      }

      toast.error(errorMessage);
    } finally {
      setProcessingAction(null);
      // Close modals
      setShowApproveModal(false);
      setShowRejectModal(false);
      setSelectedRequest(null);
      setRejectionReason("");
    }
  };

  // New functions for modal handling
  const handleApproveClick = (id, employeeName) => {
    setSelectedRequest({ id, employeeName });
    setShowApproveModal(true);
  };

  const handleRejectClick = (id, employeeName) => {
    setSelectedRequest({ id, employeeName });
    setRejectionReason("");
    setShowRejectModal(true);
  };

  const confirmApprove = async () => {
    if (selectedRequest) {
      await updateStatus(selectedRequest.id, "Approved");
    }
  };

  const confirmReject = async () => {
    if (selectedRequest) {
      await updateStatus(selectedRequest.id, "Rejected", rejectionReason);
    }
  };

  const cancelAction = () => {
    setShowApproveModal(false);
    setShowRejectModal(false);
    setSelectedRequest(null);
    setRejectionReason("");
  };

  const paginate = (data, page, rows) => {
    const start = (page - 1) * rows;
    return data.slice(start, start + rows);
  };

  const renderPaginationButtons = (page, setPage, rows) => {
    const pageCount = Math.max(1, Math.ceil(filteredRequests.length / rows));
    const hasNoRequests = filteredRequests.length === 0;

    const buttons = [];

    // Previous button
    buttons.push(
      <button
        key="prev"
        className={`${styles.leavePaginationBtn} ${
          hasNoRequests ? styles.leaveDisabled : ""
        }`}
        disabled={page === 1 || hasNoRequests}
        onClick={() => setPage(Math.max(1, page - 1))}
      >
        Previous
      </button>
    );

    // Show page 1
    buttons.push(
      <button
        key={1}
        className={`${styles.leavePaginationBtn} ${
          1 === page ? styles.leaveActive : ""
        } ${hasNoRequests ? styles.leaveDisabled : ""}`}
        onClick={() => setPage(1)}
        disabled={hasNoRequests}
      >
        1
      </button>
    );

    // If pageCount is 5 or less, show all pages
    if (pageCount <= 4) {
      for (let i = 2; i <= pageCount; i++) {
        buttons.push(
          <button
            key={i}
            className={`${styles.leavePaginationBtn} ${
              i === page ? styles.leaveActive : ""
            } ${hasNoRequests ? styles.leaveDisabled : ""}`}
            onClick={() => setPage(i)}
            disabled={hasNoRequests}
          >
            {i}
          </button>
        );
      }
    } else {
      // If pageCount is more than 5, show ellipses and selective pages
      let startPage, endPage;

      if (page <= 3) {
        // When current page is 1, 2, or 3
        startPage = 2;
        endPage = 4;
      } else if (page >= pageCount - 2) {
        // When current page is near the end
        startPage = pageCount - 3;
        endPage = pageCount - 1;
      } else {
        // When current page is in the middle
        startPage = page - 1;
        endPage = page + 1;
      }

      // Show ellipsis after page 1 if needed
      if (startPage > 2) {
        buttons.push(
          <span key="ellipsis1" className={styles.leavePaginationEllipsis}>
            ...
          </span>
        );
      }

      // Show middle pages
      for (let i = startPage; i <= endPage; i++) {
        if (i > 1 && i < pageCount) {
          buttons.push(
            <button
              key={i}
              className={`${styles.leavePaginationBtn} ${
                i === page ? styles.leaveActive : ""
              } ${hasNoRequests ? styles.leaveDisabled : ""}`}
              onClick={() => setPage(i)}
              disabled={hasNoRequests}
            >
              {i}
            </button>
          );
        }
      }

      // Show ellipsis before last page if needed
      if (endPage < pageCount - 1) {
        buttons.push(
          <span key="ellipsis2" className={styles.leavePaginationEllipsis}>
            ...
          </span>
        );
      }

      // Always show last page
      buttons.push(
        <button
          key={pageCount}
          className={`${styles.leavePaginationBtn} ${
            pageCount === page ? styles.leaveActive : ""
          } ${hasNoRequests ? styles.leaveDisabled : ""}`}
          onClick={() => setPage(pageCount)}
          disabled={hasNoRequests}
        >
          {pageCount}
        </button>
      );
    }

    // Next button
    buttons.push(
      <button
        key="next"
        className={`${styles.leavePaginationBtn} ${
          hasNoRequests ? styles.leaveDisabled : ""
        }`}
        disabled={page === pageCount || hasNoRequests}
        onClick={() => setPage(Math.min(pageCount, page + 1))}
      >
        Next
      </button>
    );

    return buttons;
  };

  const getStatusClass = (status) => {
    const statusLower = status?.toLowerCase() || "";

    if (statusLower === "pending") return styles.leavePending;
    if (statusLower === "approved" || statusLower === "completed")
      return styles.leaveApproved;
    if (statusLower === "rejected") return styles.leaveRejected;

    return styles[
      `leave${statusLower.charAt(0).toUpperCase() + statusLower.slice(1)}`
    ];
  };

  const formatDate = (dateString) => {
    if (!dateString || dateString === "N/A") return "N/A";
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

  // Calculate current paginated cards
  const currentCards = useMemo(() => {
    return paginate(filteredRequests, currentPageCards, rowsPerPageCards);
  }, [filteredRequests, currentPageCards, rowsPerPageCards]);

  // COMMENTED OUT PRELOADER CONDITIONAL RENDERING - not needed anymore
  if (!showContent) {
    return (
      <BFPPreloader
        loading={isInitializing}
        progress={loadingProgress}
        moduleTitle="LEAVE MANAGEMENT SYSTEM • Loading Leave Requests..."
        onRetry={() => {
          // Retry logic
          setIsInitializing(true);
          setShowContent(false);
          setLoadingProgress(0);
          setIsDataFullyLoaded(false);

          setTimeout(async () => {
            try {
              // Reset phases
              await updateLoadingPhase(0, "Checking Authentication");
              await checkIfAdmin();

              await updateLoadingPhase(1, "Loading User Data");
              await updateLoadingPhase(2, "Fetching Leave Requests");
              await loadLeaveRequests();

              await updateLoadingPhase(3, "Setting Up Real-time Updates");
              setupRealtimeUpdates();

              await updateLoadingPhase(4, "Finalizing");
              setIsDataFullyLoaded(true);

              setIsInitializing(false);
              setTimeout(() => setShowContent(true), 300);
            } catch (error) {
              console.error("Retry failed:", error);
              setIsInitializing(false);
              setShowContent(true);
            }
          }, 1000);
        }}
      />
    );
  }

  return (
    <div className="app-container">
      <Title>Leave Management | BFP Villanueva</Title>
      <Meta name="robots" content="noindex, nofollow" />
      <Hamburger />
      <Sidebar />

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

      <div className={`main-content ${isSidebarCollapsed ? "collapsed" : ""}`}>
        <h1>Leave Management</h1>

        <div className={styles.leaveFilterSearchWrapper}>
          <div className={styles.leaveFilterGroup}>
            <label htmlFor="leaveStatusFilter">Filter by Status:</label>
            <select
              id={styles.leaveStatusFilter}
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
            >
              <option value="All">All</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          <div className={styles.leaveSearchGroup}>
            <label
              htmlFor="leaveSearchInput"
              style={{ fontWeight: "500", fontSize: "14px" }}
            >
              Search:
            </label>
            <input
              id={styles.leaveSearchInput}
              type="text"
              placeholder="Search by employee, type, location..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
            />
          </div>
        </div>
        <button
          onClick={async () => {
            toast.info("Testing storage configuration...");

            try {
              // Test authentication
              const {
                data: { user },
              } = await supabase.auth.getUser();
              console.log("User:", user?.email, "Role:", user?.role);

              // Test bucket access
              const { data: bucket } = await supabase.storage.getBucket(
                "leave-documents"
              );
              console.log("Bucket:", bucket);

              // Test upload with small file
              const testFile = new File(["test"], "diagnostic-test.txt");
              const { error } = await supabase.storage
                .from("leave-documents")
                .upload(`diagnostic/test-${Date.now()}.txt`, testFile);

              if (error) {
                toast.error(`❌ Upload failed: ${error.message}`);

                // Try with clearance-documents (has public policy)
                const { error: clearanceError } = await supabase.storage
                  .from("clearance-documents")
                  .upload(`diagnostic/test-${Date.now()}.txt`, testFile);

                if (clearanceError) {
                  toast.error(
                    `Clearance bucket also failed: ${clearanceError.message}`
                  );
                } else {
                  toast.success("✅ Clearance-documents bucket works!");
                  toast.info("The issue is with leave-documents RLS policies");
                }
              } else {
                toast.success("✅ Everything works! Upload successful.");
              }
            } catch (error) {
              toast.error(`Diagnostic failed: ${error.message}`);
            }
          }}
          style={{
            margin: "10px",
            padding: "10px",
            background: "#6c757d",
            color: "white",
            fontSize: "12px",
          }}
        >
          🔧 Test Storage Config
        </button>
        <button className={styles.leaveViewToggle} onClick={toggleView}>
          🔄 Switch to {currentView === "table" ? "Card" : "Table"} View
        </button>

        {/* Optional: Show loading indicator while data is being fetched after initial load */}
        {!isDataFullyLoaded && showContent && (
          <div className={styles.dataLoadingIndicator}>
            <div className={styles.loadingSpinner}></div>
            <p>Loading leave requests...</p>
          </div>
        )}

        {currentView === "table" && isDataFullyLoaded && (
          <>
            <div className={styles.tableTopPagination}>
              {renderPaginationButtons(
                currentPage,
                setCurrentPage,
                rowsPerPage
              )}
            </div>

            <div className={styles.tableWrapper}>
              <table className={styles.leaveTable}>
                <thead>
                  <tr>
                    <th>Rank & Name</th>
                    <th>Type</th>
                    <th>Location</th>
                    <th>Date of Filing</th>
                    <th>Start Date</th>
                    <th>End Date</th>
                    <th>Number of Days</th>
                    <th>Status</th>
                    <th>Actions</th>
                    <th>Download</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.length > 0 ? (
                    paginate(filteredRequests, currentPage, rowsPerPage).map(
                      (req) => {
                        const statusClass = getStatusClass(req.status);
                        const isProcessing = processingAction === req.id;
                        const isPending =
                          req.status?.toLowerCase() === "pending";
                        const isApproved =
                          req.status?.toLowerCase() === "approved";
                        const isDownloadingPdf =
                          pdfDownloadForRequest === req.id;

                        return (
                          <tr key={req.id}>
                            <td className={styles.rankCellColumn}>
                              <div className={styles.rankCell}>
                                {req.rankImage ? (
                                  <img
                                    src={req.rankImage}
                                    alt={req.rank || "Rank"}
                                    className={styles.rankImage}
                                    onError={(e) => {
                                      e.target.onerror = null;
                                      e.target.style.display = "none";
                                    }}
                                  />
                                ) : null}
                                <div className={styles.nameContainer}>
                                  <span className={styles.employeeName}>
                                    {req.employeeName || "Unknown"}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td>{req.leaveType || "N/A"}</td>
                            <td>{req.location || "-"}</td>
                            <td>{formatDate(req.dateOfFiling)}</td>
                            <td>{formatDate(req.startDate)}</td>
                            <td>{formatDate(req.endDate)}</td>
                            <td>{req.numDays || 0}</td>
                            <td>
                              <span className={statusClass}>
                                {req.status || "Pending"}
                              </span>
                            </td>
                            <td className={styles.leaveActions}>
                              {isAdmin && isPending ? (
                                <div className={styles.actionButtons}>
                                  <button
                                    className={`${styles.leaveApprove} ${
                                      isProcessing ? styles.processing : ""
                                    }`}
                                    onClick={() =>
                                      handleApproveClick(
                                        req.id,
                                        req.employeeName
                                      )
                                    }
                                    disabled={isProcessing}
                                    title="Approve this leave request"
                                  >
                                    {isProcessing ? "Processing..." : "Approve"}
                                  </button>
                                  <button
                                    className={`${styles.leaveReject} ${
                                      isProcessing ? styles.processing : ""
                                    }`}
                                    onClick={() =>
                                      handleRejectClick(
                                        req.id,
                                        req.employeeName
                                      )
                                    }
                                    disabled={isProcessing}
                                    title="Reject this leave request"
                                  >
                                    {isProcessing ? "Processing..." : "Reject"}
                                  </button>
                                  <button
                                    className={styles.viewBtn}
                                    onClick={() => setModalData(req)}
                                    title="View details"
                                  >
                                    View
                                  </button>
                                </div>
                              ) : !isPending ? (
                                <div className={styles.statusInfo}>
                                  <button
                                    className={styles.viewBtn}
                                    onClick={() => setModalData(req)}
                                  >
                                    View
                                  </button>
                                </div>
                              ) : (
                                <div className={styles.actionButtons}>
                                  <button
                                    className={styles.viewBtn}
                                    onClick={() => setModalData(req)}
                                  >
                                    View
                                  </button>
                                </div>
                              )}
                            </td>
                            {/* NEW DOWNLOAD COLUMN */}
                            <td className={styles.downloadColumn}>
                              {isApproved ? (
                                <div className={styles.downloadActions}>
                                  {req.hasExistingPdf ? (
                                    <button
                                      className={styles.downloadExistingBtn}
                                      onClick={() =>
                                        downloadExistingPdf(
                                          req.existingPdfUrl,
                                          `Leave_Form_${req.employeeName.replace(
                                            /[^a-zA-Z0-9]/g,
                                            "_"
                                          )}_${req.id}.pdf`
                                        )
                                      }
                                      title="Download existing PDF"
                                    >
                                      📥 Download
                                    </button>
                                  ) : (
                                    <button
                                      className={styles.generatePdfBtn}
                                      onClick={() =>
                                        generateAndUploadLeaveForm(req)
                                      }
                                      disabled={
                                        isDownloadingPdf || generatingPdf
                                      }
                                      title="Generate and download PDF form"
                                    >
                                      {isDownloadingPdf ? (
                                        <>
                                          <span
                                            className={styles.spinner}
                                          ></span>
                                          Generating...
                                        </>
                                      ) : (
                                        "📄 Generate PDF"
                                      )}
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span className={styles.notAvailable}>
                                  {req.status === "Pending"
                                    ? "Pending Approval"
                                    : "Not Available"}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      }
                    )
                  ) : (
                    <tr
                      className={
                        filteredRequests.length === 0
                          ? styles.leaveNoRequestsRow
                          : ""
                      }
                    >
                      <td colSpan="10" className={styles.leaveNoRequestsTable}>
                        <div style={{ fontSize: "48px", marginBottom: "16px" }}>
                          <span className={styles.animatedEmoji}>📭</span>
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
                        <p
                          style={{
                            fontSize: "14px",
                            color: "#999",
                          }}
                        >
                          Try adjusting your search or filter criteria
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className={styles.tableBottomPagination}>
              {renderPaginationButtons(
                currentPage,
                setCurrentPage,
                rowsPerPage
              )}
            </div>
          </>
        )}

        {currentView === "cards" && (
          <>
            <div className={styles.cardsTopPagination}>
              {renderPaginationButtons(
                currentPageCards,
                setCurrentPageCards,
                rowsPerPageCards
              )}
            </div>

            <div id={styles.leaveCards} className={styles.leaveCards}>
              {filteredRequests.length === 0 ? (
                <div className={styles.leaveNoRequests}>
                  <div style={{ fontSize: "48px", marginBottom: "1px" }}>
                    <span className={styles.animatedEmoji}>📭</span>
                  </div>
                  <h3>No Leave Requests Found</h3>
                  <p>Try adjusting your search or filter criteria</p>
                </div>
              ) : (
                currentCards.map((req) => {
                  const statusClass = getStatusClass(req.status);
                  const isProcessing = processingAction === req.id;
                  const isPending = req.status?.toLowerCase() === "pending";
                  const isApproved = req.status?.toLowerCase() === "approved";
                  const isDownloadingPdf = pdfDownloadForRequest === req.id;

                  return (
                    <div key={req.id} className={styles.leaveCard}>
                      <div className={styles.leaveCardHeader}>
                        <div className={styles.cardRankName}>
                          {req.rankImage && (
                            <img
                              src={req.rankImage}
                              alt={req.rank || "Rank"}
                              className={styles.cardRankImage}
                            />
                          )}
                          <div className={styles.cardNameInfo}>
                            <h3>{req.employeeName || "Unknown Employee"}</h3>
                          </div>
                        </div>
                        <span className={statusClass}>
                          {req.status || "Pending"}
                        </span>
                      </div>
                      <div className={styles.leaveCardBody}>
                        <p>
                          <strong>Type:</strong> {req.leaveType || "N/A"}
                        </p>
                        <p>
                          <strong>Location:</strong> {req.location || "-"}
                        </p>
                        <p>
                          <strong>Duration:</strong> {formatDate(req.startDate)}
                          to {formatDate(req.endDate)}
                        </p>
                        <p>
                          <strong>Days:</strong> {req.numDays || 0}
                        </p>
                        <p>
                          <strong>Filed:</strong>
                          {formatDate(req.dateOfFiling) || "Unknown"}
                        </p>
                        {req.approved_by && req.status !== "Pending" && (
                          <p>
                            <strong>Processed by:</strong> {req.approved_by}
                          </p>
                        )}
                      </div>
                      <div className={styles.leaveCardActions}>
                        {isAdmin && isPending ? (
                          <div className={styles.cardActionButtons}>
                            <button
                              className={`${styles.leaveApprove} ${
                                isProcessing ? styles.processing : ""
                              }`}
                              onClick={() =>
                                handleApproveClick(req.id, req.employeeName)
                              }
                              disabled={isProcessing}
                            >
                              {isProcessing ? "Processing..." : "Approve"}
                            </button>
                            <button
                              className={`${styles.leaveReject} ${
                                isProcessing ? styles.processing : ""
                              }`}
                              onClick={() =>
                                handleRejectClick(req.id, req.employeeName)
                              }
                              disabled={isProcessing}
                            >
                              {isProcessing ? "Processing..." : "Reject"}
                            </button>
                            <button
                              className={styles.viewBtn}
                              onClick={() => setModalData(req)}
                            >
                              Details
                            </button>
                            {/* PDF Button in Card View */}
                            {isApproved && (
                              <button
                                className={styles.pdfCardBtn}
                                onClick={() => generateAndUploadLeaveForm(req)}
                                disabled={isDownloadingPdf || generatingPdf}
                                title="Download PDF Form"
                              >
                                {isDownloadingPdf ? "⏳" : "📄"}
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className={styles.cardActionButtons}>
                            <button
                              className={styles.viewBtn}
                              onClick={() => setModalData(req)}
                            >
                              Details
                            </button>
                            {/* PDF Button in Card View */}
                            {isApproved && (
                              <button
                                className={styles.pdfCardBtn}
                                onClick={() =>
                                  generateAndDownloadLeaveForm(req)
                                }
                                disabled={isDownloadingPdf || generatingPdf}
                                title="Download PDF Form"
                              >
                                {isDownloadingPdf ? "⏳" : "📄"}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className={styles.cardsBottomPagination}>
              {renderPaginationButtons(
                currentPageCards,
                setCurrentPageCards,
                rowsPerPageCards
              )}
            </div>
          </>
        )}
        {modalData && (
          <div
            className={`${styles.leaveModal} ${styles.leaveActive}`}
            onClick={() => setModalData(null)}
          >
            <div
              className={styles.leaveModalContent}
              onClick={(e) => e.stopPropagation()}
            >
              <span
                className={styles.leaveCloseBtn}
                onClick={() => setModalData(null)}
              >
                &times;
              </span>
              <h2>Leave Request Details</h2>

              <div className={styles.modalContentGrid}>
                {/* Row 1: Basic Info */}
                <div className={styles.modalRow}>
                  <div className={styles.modalField}>
                    <label>Employee:</label>
                    <span>{modalData.employeeName || "Unknown"}</span>
                  </div>
                  <div className={styles.modalField}>
                    <label>Leave Type:</label>
                    <span>{modalData.leaveType || "N/A"}</span>
                  </div>
                </div>

                {/* Row 2: Location */}
                <div className={styles.modalRow}>
                  <div className={styles.modalFieldFull}>
                    <label>Location:</label>
                    <span>{modalData.location || "-"}</span>
                  </div>
                </div>

                {/* Row 3: Dates */}
                <div className={styles.modalRow}>
                  <div className={styles.modalField}>
                    <label>Start Date:</label>
                    <span>{formatDate(modalData.startDate) || "N/A"}</span>
                  </div>
                  <div className={styles.modalField}>
                    <label>End Date:</label>
                    <span>{formatDate(modalData.endDate) || "N/A"}</span>
                  </div>
                </div>

                {/* Row 4: Duration & Filing */}
                <div className={styles.modalRow}>
                  <div className={styles.modalField}>
                    <label>Duration:</label>
                    <span>{modalData.numDays || 0} day(s)</span>
                  </div>
                  <div className={styles.modalField}>
                    <label>Date Filed:</label>
                    <span>
                      {formatDate(modalData.dateOfFiling) || "Unknown"}
                    </span>
                  </div>
                </div>

                {/* Row 5: Status & Processed */}
                <div className={styles.modalRow}>
                  <div className={styles.modalField}>
                    <label>Status:</label>
                    <span className={getStatusClass(modalData.status)}>
                      {modalData.status || "Pending"}
                    </span>
                  </div>
                  {modalData.approved_by && (
                    <div className={styles.modalField}>
                      <label>Processed by:</label>
                      <span>{modalData.approved_by}</span>
                    </div>
                  )}
                </div>

                {/* Row 6: Rank & Station */}
                <div className={styles.modalRow}>
                  {modalData.rank && (
                    <div className={styles.modalField}>
                      <label>Rank:</label>
                      <span>{modalData.rank}</span>
                    </div>
                  )}
                  {modalData.station && (
                    <div className={styles.modalField}>
                      <label>Station:</label>
                      <span>{modalData.station}</span>
                    </div>
                  )}
                </div>

                {/* Row 7: Reason/Appropriate */}
                {modalData.reason && (
                  <div className={styles.modalRow}>
                    <div className={styles.modalFieldFull}>
                      <label>Reason:</label>
                      <span className={styles.reasonText}>
                        {modalData.reason}
                      </span>
                    </div>
                  </div>
                )}

                {/* Row 8: Last Updated */}
                {modalData.updated_at && (
                  <div className={styles.modalRow}>
                    <div className={styles.modalFieldFull}>
                      <label>Last Updated:</label>
                      <span>
                        {new Date(modalData.updated_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* PDF Download Section */}
              {modalData.status?.toLowerCase() === "approved" && (
                <div className={styles.modalPdfSection}>
                  <hr />
                  <h3>PDF Form</h3>
                  {modalData.hasExistingPdf ? (
                    <div className={styles.existingPdfInfo}>
                      <p>✅ PDF form has been generated</p>
                      <button
                        className={styles.modalDownloadBtn}
                        onClick={() =>
                          downloadExistingPdf(
                            modalData.existingPdfUrl,
                            modalData
                          )
                        }
                      >
                        📥 Download PDF
                      </button>
                    </div>
                  ) : (
                    <div className={styles.generatePdfInfo}>
                      <p>📄 PDF form is available for download</p>
                      <button
                        className={styles.modalGenerateBtn}
                        onClick={() => {
                          generateAndUploadLeaveForm(modalData);
                          setModalData(null);
                        }}
                        disabled={generatingPdf}
                      >
                        {generatingPdf
                          ? "Generating..."
                          : "Generate & Download PDF"}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Admin Actions */}
              {isAdmin && modalData.status?.toLowerCase() === "pending" && (
                <div className={styles.modalActions}>
                  <button
                    className={styles.leaveApprove}
                    onClick={() => {
                      handleApproveClick(modalData.id, modalData.employeeName);
                      setModalData(null);
                    }}
                  >
                    ✓ Approve This Request
                  </button>
                  <button
                    className={styles.leaveReject}
                    onClick={() => {
                      handleRejectClick(modalData.id, modalData.employeeName);
                      setModalData(null);
                    }}
                  >
                    ✗ Reject This Request
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
        {showApproveModal && selectedRequest && (
          <div
            className={styles.confirmationModalOverlay}
            onClick={cancelAction}
          >
            <div
              className={styles.confirmationModal}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.confirmationHeader}>
                <h2>Confirm Approval</h2>
                <button
                  className={styles.confirmationCloseBtn}
                  onClick={cancelAction}
                >
                  &times;
                </button>
              </div>

              <div className={styles.confirmationBody}>
                <div className={styles.confirmationIcon}>✅</div>
                <p className={styles.confirmationText}>
                  Are you sure you want to APPROVE the leave request for
                </p>
                <p className={styles.employeeNameHighlight}>
                  "{selectedRequest.employeeName}"?
                </p>
                <p className={styles.confirmationNote}>
                  This action will deduct the leave credits from the personnel's
                  balance. PDF form will be available for download after
                  approval.
                </p>
              </div>

              <div className={styles.confirmationActions}>
                <button
                  className={styles.confirmationCancelBtn}
                  onClick={cancelAction}
                >
                  Cancel
                </button>
                <button
                  className={styles.confirmationApproveBtn}
                  onClick={confirmApprove}
                  disabled={processingAction === selectedRequest.id}
                >
                  {processingAction === selectedRequest.id
                    ? "Processing..."
                    : "Approve"}
                </button>
              </div>
            </div>
          </div>
        )}
        {showRejectModal && selectedRequest && (
          <div
            className={styles.confirmationModalOverlay}
            onClick={cancelAction}
          >
            <div
              className={styles.confirmationModal}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.confirmationHeader}>
                <h2>Confirm Rejection</h2>
                <button
                  className={styles.confirmationCloseBtn}
                  onClick={cancelAction}
                >
                  &times;
                </button>
              </div>

              <div className={styles.confirmationBody}>
                <div className={styles.confirmationIcon}>❌</div>
                <p className={styles.confirmationText}>
                  Are you sure you want to REJECT the leave request for
                </p>
                <p className={styles.employeeNameHighlight}>
                  "{selectedRequest.employeeName}"?
                </p>

                <div className={styles.rejectionReasonContainer}>
                  <label htmlFor="rejectionReason">
                    Reason for rejection (optional):
                  </label>
                  <textarea
                    id="rejectionReason"
                    className={styles.rejectionReasonInput}
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Enter reason for rejection..."
                    rows="3"
                  />
                </div>

                <p className={styles.confirmationNote}>
                  This action will return any deducted leave credits to the
                  personnel's balance.
                </p>
              </div>

              <div className={styles.confirmationActions}>
                <button
                  className={styles.confirmationCancelBtn}
                  onClick={cancelAction}
                >
                  Cancel
                </button>
                <button
                  className={styles.confirmationRejectBtn}
                  onClick={confirmReject}
                  disabled={processingAction === selectedRequest.id}
                >
                  {processingAction === selectedRequest.id
                    ? "Processing..."
                    : "Reject"}
                </button>
              </div>
            </div>
          </div>
        )}
        {/* PDF Progress Overlay */}
        {generatingPdf && (
          <div className={styles.pdfProgressOverlay}>
            <div className={styles.pdfProgressModal}>
              <h3>Generating Leave Form PDF</h3>
              <div className={styles.pdfProgressBar}>
                <div
                  className={styles.pdfProgressFill}
                  style={{ width: `${pdfDownloadProgress}%` }}
                ></div>
              </div>
              <p>{pdfDownloadProgress}% Complete</p>
              <p className={styles.pdfProgressNote}>
                Please wait while we generate your leave form...
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LeaveManagement;
