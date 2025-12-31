import React, { useState, useEffect } from "react";
import styles from "../styles/LeaveRecords.module.css";
import Sidebar from "../../Sidebar.jsx";
import Hamburger from "../../Hamburger.jsx";
import { useSidebar } from "../../SidebarContext.jsx";
import { Title, Meta } from "react-head";
import { supabase } from "../../../lib/supabaseClient.js";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  uploadLeaveDocumentToStorage,
  createPersonnelFolderName,
  createLeavePdfFileName,
  saveLeaveDocumentMetadata,
} from "../../utils/leaveDocumentUpload.js";
import { fillLeaveFormEnhanced } from "../../utils/pdfLeaveFormFiller.js";
const LeaveRecords = () => {
  const [leaveData, setLeaveData] = useState([]);
  const [yearlyRecords, setYearlyRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [noData, setNoData] = useState(false);
  const [viewMode, setViewMode] = useState("current");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState([]);
  const [generatingYearlyRecord, setGeneratingYearlyRecord] = useState(false);
  const { isSidebarCollapsed } = useSidebar();
  const [archivingRecordId, setArchivingRecordId] = useState(null);
  const [deletingRecordId, setDeletingRecordId] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedRecordDetails, setSelectedRecordDetails] = useState(null);
const [showArchiveConfirmModal, setShowArchiveConfirmModal] = useState(false);
const [leaveToArchive, setLeaveToArchive] = useState(null);
  // Bulk delete states
  const [selectedRecords, setSelectedRecords] = useState([]);
  const [isBulkDeleteMode, setIsBulkDeleteMode] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [deleteRecord, setDeleteRecord] = useState(null);
  const [deleteReason, setDeleteReason] = useState("");

  // PDF generation states
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfDownloadProgress, setPdfDownloadProgress] = useState(0);
  const [pdfDownloadForRequest, setPdfDownloadForRequest] = useState(null);
  const [existingPdfs, setExistingPdfs] = useState({});

  // Manual archive modal states
  const [showManualArchiveModal, setShowManualArchiveModal] = useState(false);
  const [archiveYear, setArchiveYear] = useState(
    new Date().getFullYear().toString()
  );
  const [archiveConfirmText, setArchiveConfirmText] = useState("");

  // State variables for table functionality
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 5;
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterLeaveType, setFilterLeaveType] = useState("");
  const [currentFilterCard, setCurrentFilterCard] = useState("total");

  useEffect(() => {
    loadLeaveData();
    loadAvailableYears();
  }, [viewMode, selectedYear]);

  useEffect(() => {
    // Load existing PDFs when leave data changes
    if (leaveData.length > 0) {
      loadExistingPdfs();
    }
  }, [leaveData]);

  const loadLeaveData = async () => {
    setLoading(true);
    try {
      if (viewMode === "current") {
        await loadCurrentLeaveRequests();
      } else {
        await loadYearlyLeaveRecords();
      }
    } catch (err) {
      console.error("[LeaveRecords] error loading", err);
      toast.error("An unexpected error occurred");
      setNoData(true);
    } finally {
      setLoading(false);
    }
  };

  const loadExistingPdfs = async () => {
    try {
      console.log("=== LOADING EXISTING PDFS ===");

      // For current requests
      if (viewMode === "current") {
        const requestIds = leaveData
          .filter((item) => item.recordType === "current" && item.dbId)
          .map((item) => item.dbId);

        console.log("Checking PDFs for current request IDs:", requestIds);

        if (requestIds.length > 0) {
          // Use .or() instead of .in() - it's more reliable
          const { data, error } = await supabase
            .from("leave_documents")
            .select(
              "id, leave_request_id, document_name, file_url, file_path, document_type, uploaded_at"
            )
            .or(`leave_request_id.in.(${requestIds.join(",")})`)
            .eq("document_type", "LEAVE_FORM");

          if (error) {
            console.error("Error fetching leave documents:", error);
            return;
          }

          console.log("Found PDF documents:", data?.length || 0);

          const pdfsMap = {};
          if (data) {
            data.forEach((doc) => {
              if (!pdfsMap[doc.leave_request_id]) {
                pdfsMap[doc.leave_request_id] = [];
              }
              pdfsMap[doc.leave_request_id].push(doc);
            });
          }
          setExistingPdfs(pdfsMap);
        }
      }
      // For yearly records
      else {
        const recordIds = leaveData
          .filter((item) => item.recordType === "yearly" && item.id)
          .map((item) => item.id);

        console.log("Checking PDFs for yearly record IDs:", recordIds);

        if (recordIds.length > 0) {
          // Use .or() instead of .in()
          const { data, error } = await supabase
            .from("leave_documents")
            .select(
              "id, leave_record_id, document_name, file_url, file_path, document_type, uploaded_at"
            )
            .or(`leave_record_id.in.(${recordIds.join(",")})`)
            .eq("document_type", "LEAVE_FORM");

          if (error) {
            console.error("Error fetching yearly documents:", error);
            return;
          }

          console.log("Found yearly PDF documents:", data?.length || 0);

          const pdfsMap = {};
          if (data) {
            data.forEach((doc) => {
              if (!pdfsMap[doc.leave_record_id]) {
                pdfsMap[doc.leave_record_id] = [];
              }
              pdfsMap[doc.leave_record_id].push(doc);
            });
            setExistingPdfs(pdfsMap);
          }
        }
      }
    } catch (err) {
      console.error("Error loading existing PDFs:", err);
    }
  };
  const loadCurrentLeaveRequests = async () => {
    console.log("=== LOADING CURRENT LEAVE REQUESTS ===");

    const { data: leaveRequests, error } = await supabase
      .from("leave_requests")
      .select(
        `
      *,
      personnel:personnel_id (
        id,
        first_name,
        last_name,
        middle_name,
        rank,
        username,
        badge_number,
        station,
        designation
      )
    `
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching leave records:", error);
      toast.error("Failed to load leave records");
      setNoData(true);
      return;
    }

    console.log("Total Current Leave Requests:", leaveRequests?.length || 0);

    if (!leaveRequests || leaveRequests.length === 0) {
      console.log("No leave requests found in database");
      setNoData(true);
      return;
    }

    // Get all leave request IDs
    const requestIds = leaveRequests.map((request) => request.id);

    console.log("Checking archive status for IDs:", requestIds);

    // Batch check archive status for all requests
    const { data: archivedRecords, error: archiveError } = await supabase
      .from("leave_records")
      .select("leave_request_id")
      .in("leave_request_id", requestIds);

    if (archiveError) {
      console.warn("Error checking archived leave records:", archiveError);
      // Continue with empty archived records
    }

    // Create a Set of archived leave request IDs for faster lookup
    const archivedIds = new Set();
    if (archivedRecords && archivedRecords.length > 0) {
      archivedRecords.forEach((record) => {
        if (record.leave_request_id) {
          archivedIds.add(record.leave_request_id);
        }
      });
    }

    console.log(`Found ${archivedIds.size} archived leave records`);

    const processedData = leaveRequests.map((request, index) => {
      const personnel = request.personnel;
      const uniqueId = `current-${index}-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      const dateRequested = request.created_at
        ? new Date(request.created_at).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })
        : "N/A";

      // Check if archived using the Set
      const isArchived = archivedIds.has(request.id);

      // Build full name
      const fullName = personnel
        ? `${personnel.first_name || ""} ${personnel.middle_name || ""} ${
            personnel.last_name || ""
          }`
            .replace(/\s+/g, " ")
            .trim()
        : "Unknown Personnel";

      return {
        id: uniqueId,
        dbId: request.id,
        fullName: fullName,
        rank: personnel?.rank || "N/A",
        badgeNumber: personnel?.badge_number || "N/A",
        station: personnel?.station || "N/A",
        designation: personnel?.designation || "N/A",
        leaveType: request.leave_type || "N/A",
        dateRequested: dateRequested,
        startDate: request.start_date,
        endDate: request.end_date,
        numDays: request.num_days || 0,
        status: request.status || "Pending",
        username: personnel?.username || "N/A",
        personnelId: request.personnel_id,
        recordType: "current",
        approvedDate: request.approved_at,
        completedDate: request.completed_at,
        approvedBy: request.approved_by,
        originalRequest: request,
        isArchived: isArchived, // From batch check
        documentUrl: request.document_url,
        documentPath: request.document_path,
        vacationLocationType: request.vacation_location_type,
        illnessType: request.illness_type,
        illnessDetails: request.illness_details,
        balanceBefore: request.balance_before,
        balanceAfter: request.balance_after,
      };
    });

    console.log("Processed current records:", processedData.length);
    setLeaveData(processedData);
    setNoData(processedData.length === 0);
  };
  const loadYearlyLeaveRecords = async () => {
    console.log("=== LOADING YEARLY RECORDS ===");

    const { data: yearlyRecords, error } = await supabase
      .from("leave_records")
      .select(
        `
      *,
      leave_requests:leave_request_id (
        id,
        personnel_id,
        leave_type,
        status
      )
    `
      )
      .eq("year", selectedYear)
      .order("record_generated_date", { ascending: false });

    if (error) {
      console.error("Error loading yearly leave records:", error);
      toast.error("Failed to load yearly leave records");
      setNoData(true);
      return;
    }

    console.log("Yearly records fetched:", yearlyRecords?.length || 0);

    const processedData = (yearlyRecords || []).map((record) => {
      const status =
        record.leave_status ||
        record.status ||
        record.leave_requests?.status ||
        "UNKNOWN";

      const approvedDate = record.leave_approved_date
        ? new Date(record.leave_approved_date).toLocaleDateString()
        : "N/A";

      const initiatedDate = record.leave_initiated_date
        ? new Date(record.leave_initiated_date).toLocaleDateString()
        : "N/A";

      return {
        id: record.id,
        fullName: record.personnel_name || "Unknown",
        rank: record.rank || "N/A",
        badgeNumber: record.badge_number || "N/A",
        station: record.station || "N/A",
        designation: record.designation || "N/A",
        leaveType:
          record.leave_type || record.leave_requests?.leave_type || "N/A",
        dateRequested: initiatedDate,
        recordDate: record.record_generated_date
          ? new Date(record.record_generated_date).toLocaleDateString()
          : "N/A",
        startDate: record.start_date,
        endDate: record.end_date,
        numDays: record.num_days || 0,
        year: record.year,
        status: status.toUpperCase(),
        source: "Manually Generated",
        personnelId: record.personnel_id,
        leaveRequestId: record.leave_request_id,
        recordType: "yearly",
        totalVacationDays: record.total_vacation_days || 0,
        totalSickDays: record.total_sick_days || 0,
        totalEmergencyDays: record.total_emergency_days || 0,
        approvedDate: approvedDate,
        approvedBy: record.approved_by || "System",
        generatedBy: record.generated_by || "System",
        autoArchived: false,
        originalRecord: record,
        documentUrl: record.document_url,
        documentPath: record.document_path,
      };
    });

    console.log("Processed yearly records:", processedData);
    setLeaveData(processedData);
    setNoData(processedData.length === 0);
  };

  const loadAvailableYears = async () => {
    try {
      const { data, error } = await supabase
        .from("leave_records")
        .select("year")
        .order("year", { ascending: false });

      if (error) {
        console.error("Error loading available years:", error);
        return;
      }

      const years = [...new Set(data.map((item) => item.year))].sort(
        (a, b) => b - a
      );
      setAvailableYears(years);

      const currentYear = new Date().getFullYear();
      if (!years.includes(currentYear)) {
        setSelectedYear(currentYear);
      }
    } catch (err) {
      console.error("Error in loadAvailableYears:", err);
    }
  };

  // ========== PDF GENERATION FUNCTIONS ==========

  const loadPdfTemplate = async () => {
    try {
      const templatePaths = [
        "/forms/BFP_Leave_Form.pdf",
        "./forms/BFP_Leave_Form.pdf",
        `${window.location.origin}/forms/BFP_Leave_Form.pdf`,
      ];

      let response = null;
      let lastError = null;

      for (const path of templatePaths) {
        try {
          console.log("Trying to load leave template from:", path);
          response = await fetch(path);
          if (response.ok) {
            console.log("Leave template loaded successfully from:", path);
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

  const generateLeavePDF = async (
    record,
    isYearly = false,
    generationDate = null
  ) => {
    try {
      const pdfBytes = await loadPdfTemplate();

      let personnelData = {};
      if (record.personnelId && !isYearly) {
        const { data, error } = await supabase
          .from("personnel")
          .select("*")
          .eq("id", record.personnelId)
          .single();

        if (!error) {
          personnelData = data;
        }
      }

      // Use the imported enhanced function
      const filledPdf = await fillLeaveFormEnhanced(
        pdfBytes,
        {
          ...record,
          ...personnelData,
          station: record.station || personnelData?.station || "N/A",
          location: record.location, 
          vacation_location_type: record.vacationLocationType, 
        },
        {
          isYearly,
          generationDate,
          adminUsername: record.approvedBy || "System",
        }
      );

      return filledPdf;
    } catch (error) {
      console.error("Error generating leave PDF:", error);
      throw error;
    }
  };

  const saveLeaveDocument = async (documentData, isYearly = false) => {
    try {
      const documentToInsert = {
        document_type: "LEAVE_FORM",
        document_category: "Leave Form",
        document_name: documentData.documentName,
        file_url: documentData.fileUrl,
        file_path: documentData.filePath,
        file_type: "application/pdf",
        file_size: documentData.fileSize,
        description: isYearly
          ? "Archived yearly leave record"
          : "Leave certificate",
        uploaded_by: documentData.uploadedBy || "System",
        uploaded_at: new Date().toISOString(),
      };

      if (isYearly && documentData.leaveRecordId) {
        documentToInsert.leave_record_id = documentData.leaveRecordId;
      } else if (documentData.leaveRequestId) {
        documentToInsert.leave_request_id = documentData.leaveRequestId;
      }

      const { data, error } = await supabase
        .from("leave_documents")
        .insert([documentToInsert])
        .select()
        .single();

      if (error) {
        console.error("Error saving leave document metadata:", error);
        throw error;
      }

      // Update the leave request or record with document info
      if (isYearly && documentData.leaveRecordId) {
        await supabase
          .from("leave_records")
          .update({
            document_url: documentData.fileUrl,
            document_path: documentData.filePath,
            updated_at: new Date().toISOString(),
          })
          .eq("id", documentData.leaveRecordId);
      } else if (documentData.leaveRequestId) {
        await supabase
          .from("leave_requests")
          .update({
            document_url: documentData.fileUrl,
            document_path: documentData.filePath,
            updated_at: new Date().toISOString(),
          })
          .eq("id", documentData.leaveRequestId);
      }

      const key = isYearly
        ? documentData.leaveRecordId
        : documentData.leaveRequestId;
      if (key) {
        setExistingPdfs((prev) => ({
          ...prev,
          [key]: [...(prev[key] || []), data],
        }));
      }

      return data;
    } catch (error) {
      console.error("Error in saveLeaveDocument:", error);
      throw error;
    }
  };

  // In LeaveRecords.jsx - FIXED checkExistingPdfMetadata function
  const checkExistingPdfMetadata = async (record) => {
    try {
      if (record.recordType === "current") {
        // Check leave_documents table only
        const { data: documents, error } = await supabase
          .from("leave_documents")
          .select("uploaded_at, file_path, file_url")
          .eq("leave_request_id", record.dbId)
          .eq("document_type", "LEAVE_FORM")
          .order("uploaded_at", { ascending: false })
          .limit(1);

        if (!error && documents && documents.length > 0) {
          return {
            hasExisting: true,
            uploadedAt: documents[0].uploaded_at,
            filePath: documents[0].file_path,
            fileUrl: documents[0].file_url,
          };
        }

        // REMOVE THIS SECTION - leave_requests table doesn't have document_url
        // const { data: requestData } = await supabase
        //   .from("leave_requests")
        //   .select("document_url, updated_at")
        //   .eq("id", record.dbId)
        //   .single();

        return { hasExisting: false };
      } else if (record.recordType === "yearly") {
        // Check leave_documents table for yearly records
        const { data: documents, error } = await supabase
          .from("leave_documents")
          .select("uploaded_at, file_path, file_url")
          .eq("leave_record_id", record.id)
          .eq("document_type", "LEAVE_FORM")
          .order("uploaded_at", { ascending: false })
          .limit(1);

        if (!error && documents && documents.length > 0) {
          return {
            hasExisting: true,
            uploadedAt: documents[0].uploaded_at,
            filePath: documents[0].file_path,
            fileUrl: documents[0].file_url,
          };
        }

        // Check leave_records table (it HAS document_url)
        const { data: recordData } = await supabase
          .from("leave_records")
          .select("document_url, updated_at")
          .eq("id", record.id)
          .single();

        if (recordData?.document_url) {
          return {
            hasExisting: true,
            uploadedAt: recordData.updated_at,
            documentUrl: recordData.document_url,
          };
        }

        return { hasExisting: false };
      }

      return { hasExisting: false };
    } catch (error) {
      console.error("Error checking PDF metadata:", error);
      return { hasExisting: false };
    }
  };

  const generateAndUploadLeaveForm = async (record) => {
    const isYearly = record.recordType === "yearly";

    const validStatus = isYearly
      ? record.status?.toUpperCase() === "APPROVED" ||
        record.status?.toUpperCase() === "COMPLETED"
      : record.status?.toLowerCase() === "approved";

    if (!validStatus) {
      toast.info(
        isYearly
          ? "PDF form is only available for APPROVED yearly records"
          : "PDF form is only available for approved leave requests",
        {
          position: "top-right",
          autoClose: 3000,
        }
      );
      return;
    }

    const recordKey = isYearly ? record.id : record.dbId;
    const existingPdfsForRecord = existingPdfs[recordKey] || [];

    // Check if PDF already exists and get its metadata
    const existingPdfMetadata = await checkExistingPdfMetadata(record);

    if (existingPdfMetadata.hasExisting) {
      const shouldRegenerate = window.confirm(
        `A PDF already exists for this record (generated on ${new Date(
          existingPdfMetadata.uploadedAt
        ).toLocaleDateString()}).\n\nDo you want to generate a new one?`
      );

      if (!shouldRegenerate) {
        // Download existing PDF
        if (existingPdfsForRecord.length > 0) {
          await downloadExistingPdf(existingPdfsForRecord[0].file_url, record);
        } else if (record.documentUrl) {
          await downloadExistingPdf(record.documentUrl, record);
        }
        return;
      }
    }

    setGeneratingPdf(true);
    setPdfDownloadForRequest(recordKey);
    setPdfDownloadProgress(10);

    try {
      setPdfDownloadProgress(40);

      // Generate PDF
      const generationDate = new Date().toISOString();
      const filledPdfBytes = await generateLeavePDF(
        record,
        isYearly,
        generationDate
      );

      // Get personnel data for filename
      let personnelData = {};
      if (record.personnelId && !isYearly) {
        const { data, error } = await supabase
          .from("personnel")
          .select("*")
          .eq("id", record.personnelId)
          .single();

        if (!error) {
          personnelData = data;
        }
      }

      // Create filename using shared function
      const fileName = createLeavePdfFileName(record, personnelData);

      setPdfDownloadProgress(80);

      // Download locally first
      downloadPdf(filledPdfBytes, fileName);

      setPdfDownloadProgress(85);

      try {
        // Use shared upload function
        const uploadResult = await uploadLeaveDocumentToStorage({
          record,
          pdfBytes: filledPdfBytes,
          fileName,
          isYearly,
          generatedBy: record.approvedBy || "System",
        });

        // Save metadata using shared function
        await saveLeaveDocumentMetadata({
          leaveRequestId: isYearly ? null : record.dbId,
          leaveRecordId: isYearly ? record.id : null,
          documentName: fileName,
          fileUrl: uploadResult.fileUrl,
          filePath: uploadResult.filePath,
          fileSize: uploadResult.fileSize,
          uploadedBy: record.approvedBy || "System",
        });

        // Update local state
        const key = isYearly ? record.id : record.dbId;
        if (key) {
          setExistingPdfs((prev) => ({
            ...prev,
            [key]: [
              ...(prev[key] || []),
              {
                id: Date.now(),
                file_url: uploadResult.fileUrl,
                file_path: uploadResult.filePath,
                uploaded_at: new Date().toISOString(),
                document_type: "LEAVE_FORM",
              },
            ],
          }));
        }

        setPdfDownloadProgress(100);

        toast.success(
          `PDF ${
            isYearly ? "yearly record " : ""
          }generated and uploaded successfully!`,
          {
            position: "top-right",
            autoClose: 3000,
          }
        );
      } catch (uploadError) {
        console.warn("Upload process error:", uploadError);
        toast.warn("PDF downloaded locally. Cloud upload skipped.", {
          position: "top-right",
          autoClose: 3000,
        });
      }
    } catch (error) {
      console.error("Error generating leave form:", error);
      toast.error(`Failed to generate PDF: ${error.message}`, {
        position: "top-right",
        autoClose: 3000,
      });
    } finally {
      setTimeout(() => {
        setGeneratingPdf(false);
        setPdfDownloadForRequest(null);
        setPdfDownloadProgress(0);
      }, 1000);
    }
  };

  const downloadExistingPdf = async (pdfUrl, record) => {
    if (!pdfUrl) {
      toast.warning("PDF URL not found", {
        position: "top-right",
        autoClose: 3000,
      });
      return;
    }

    try {
      const response = await fetch(pdfUrl);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();

      const employeeName = record.fullName
        .replace(/[^a-zA-Z0-9\s]/g, "")
        .replace(/\s+/g, "_");
      const leaveType = record.leaveType.replace(/\s+/g, "_");
      const datePart =
        record.recordType === "yearly"
          ? record.year || new Date().getFullYear()
          : new Date().toISOString().split("T")[0];

      const fileName = `${employeeName}_${leaveType}_${
        record.recordType === "yearly" ? "Yearly_" : ""
      }Leave_${datePart}.pdf`;

      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      toast.success("PDF downloaded successfully!", {
        position: "top-right",
        autoClose: 3000,
      });
    } catch (error) {
      console.error("Error downloading PDF:", error);
      toast.info("Opening PDF in new tab...", {
        position: "top-right",
        autoClose: 3000,
      });
      window.open(pdfUrl, "_blank");
    }
  };

  const getPdfButton = (record) => {
    const recordKey = record.recordType === "yearly" ? record.id : record.dbId;
    const existingPdfsForRecord = existingPdfs[recordKey] || [];

    const hasExistingPdf = existingPdfsForRecord.length > 0;
    const isGenerating = pdfDownloadForRequest === recordKey && generatingPdf;

    const isPdfAvailable =
      record.recordType === "yearly"
        ? record.status?.toUpperCase() === "APPROVED" ||
          record.status?.toUpperCase() === "COMPLETED"
        : record.status?.toLowerCase() === "approved";

    if (!isPdfAvailable) {
      return (
        <button
          className={styles.pdfBtn}
          disabled
          title={
            record.recordType === "yearly"
              ? "PDF only available for APPROVED yearly records"
              : "PDF only available for approved leaves"
          }
        >
          📄 PDF
        </button>
      );
    }

    if (hasExistingPdf) {
      return (
        <button
          className={styles.pdfBtn}
          onClick={() =>
            downloadExistingPdf(existingPdfsForRecord[0].file_url, record)
          }
          title={`Download existing PDF (Generated: ${new Date(
            existingPdfsForRecord[0].uploaded_at
          ).toLocaleDateString()})`}
        >
          📥 DOWNLOAD PDF
        </button>
      );
    } else {
      return (
        <button
          className={styles.pdfBtn}
          onClick={() => generateAndUploadLeaveForm(record)}
          disabled={isGenerating}
          title="Generate new PDF"
        >
          {isGenerating ? (
            <>
              <span className={styles.spinner}></span> Generating...
            </>
          ) : (
            "📄 Generate"
          )}
        </button>
      );
    }
  };

  const generateYearlyLeaveRecord = async () => {
    // Use the same modal approach for generating yearly records
    const year = prompt(
      "Enter year for leave record generation:",
      new Date().getFullYear().toString()
    );

    if (
      !year ||
      isNaN(year) ||
      year < 2000 ||
      year > new Date().getFullYear() + 1
    ) {
      toast.error("Please enter a valid year (2000 to next year)");
      return;
    }

    setGeneratingYearlyRecord(true);

    try {
      const { data, error } = await supabase.rpc(
        "generate_yearly_leave_records",
        {
          target_year: parseInt(year),
        }
      );

      if (error) {
        console.error("Error generating yearly records:", error);
        toast.error(`Failed to generate yearly records: ${error.message}`);
      } else {
        toast.success(`Generated ${data} yearly leave records for ${year}`);
        loadAvailableYears();

        setViewMode("yearly");
        setSelectedYear(parseInt(year));
        loadLeaveData();
      }
    } catch (err) {
      console.error("Error in generateYearlyLeaveRecord:", err);
      toast.error("Failed to generate yearly records");
    } finally {
      setGeneratingYearlyRecord(false);
    }
  };

  // Filtering & pagination logic
  function applyFilters(items) {
    let filtered = [...items];

    if (currentFilterCard === "pending") {
      filtered = filtered.filter((i) => i.status.toLowerCase() === "pending");
    } else if (currentFilterCard === "approved") {
      filtered = filtered.filter((i) => i.status.toLowerCase() === "approved");
    } else if (currentFilterCard === "rejected") {
      filtered = filtered.filter((i) => i.status.toLowerCase() === "rejected");
    }

    const s = search.trim().toLowerCase();
    const statusFilter = filterStatus.trim().toLowerCase();
    const typeFilter = filterLeaveType.trim().toLowerCase();

    filtered = filtered.filter((i) => {
      const text =
        `${i.fullName} ${i.rank} ${i.dateRequested} ${i.leaveType} ${i.status}`.toLowerCase();
      const statusMatch =
        !statusFilter || (i.status || "").toLowerCase().includes(statusFilter);
      const typeMatch =
        !typeFilter || (i.leaveType || "").toLowerCase().includes(typeFilter);
      const searchMatch = !s || text.includes(s);
      return statusMatch && typeMatch && searchMatch;
    });

    return filtered;
  }

  const filteredLeaveData = applyFilters(leaveData);
  const totalPages = Math.max(
    1,
    Math.ceil(filteredLeaveData.length / rowsPerPage)
  );
  const pageStart = (currentPage - 1) * rowsPerPage;
  const paginated = filteredLeaveData.slice(pageStart, pageStart + rowsPerPage);

  const renderPaginationButtons = () => {
    const pageCount = Math.max(
      1,
      Math.ceil(filteredLeaveData.length / rowsPerPage)
    );
    const hasNoData = filteredLeaveData.length === 0;

    const buttons = [];

    buttons.push(
      <button
        key="prev"
        className={`${styles.leavePaginationBtn} ${
          hasNoData ? styles.leaveDisabled : ""
        }`}
        disabled={currentPage === 1 || hasNoData}
        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
      >
        Previous
      </button>
    );

    buttons.push(
      <button
        key={1}
        className={`${styles.leavePaginationBtn} ${
          1 === currentPage ? styles.leaveActive : ""
        } ${hasNoData ? styles.leaveDisabled : ""}`}
        onClick={() => setCurrentPage(1)}
        disabled={hasNoData}
      >
        1
      </button>
    );

    if (currentPage > 3) {
      buttons.push(
        <span key="ellipsis1" className={styles.paginationEllipsis}>
          ...
        </span>
      );
    }

    let startPage = Math.max(2, currentPage - 1);
    let endPage = Math.min(pageCount - 1, currentPage + 1);

    if (currentPage <= 3) {
      endPage = Math.min(pageCount - 1, 4);
    }

    if (currentPage >= pageCount - 2) {
      startPage = Math.max(2, pageCount - 3);
    }

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

    if (currentPage < pageCount - 2) {
      buttons.push(
        <span key="ellipsis2" className={styles.paginationEllipsis}>
          ...
        </span>
      );
    }

    if (pageCount > 1) {
      buttons.push(
        <button
          key={pageCount}
          className={`${styles.leavePaginationBtn} ${
            pageCount === currentPage ? styles.active : ""
          } ${hasNoData ? styles.disabled : ""}`}
          onClick={() => setCurrentPage(pageCount)}
          disabled={hasNoData}
        >
          {pageCount}
        </button>
      );
    }

    buttons.push(
      <button
        key="next"
        className={`${styles.leavePaginationBtn} ${
          hasNoData ? styles.disabled : ""
        }`}
        disabled={currentPage === pageCount || hasNoData}
        onClick={() => setCurrentPage(Math.min(pageCount, currentPage + 1))}
      >
        Next
      </button>
    );

    return buttons;
  };

  const totalItems = leaveData.length;
  const pendingItems = leaveData.filter(
    (i) => i.status.toLowerCase() === "pending"
  ).length;
  const approvedItems = leaveData.filter(
    (i) => i.status.toLowerCase() === "approved"
  ).length;
  const rejectedItems = leaveData.filter(
    (i) => i.status.toLowerCase() === "rejected"
  ).length;

  function handleCardClick(filter) {
    if (currentFilterCard === filter) {
      setCurrentFilterCard("total");
    } else {
      setCurrentFilterCard(filter);
    }
    setCurrentPage(1);
  }

  const manuallyArchiveAllForYear = () => {
    setArchiveYear(new Date().getFullYear().toString());
    setArchiveConfirmText("");
    setShowManualArchiveModal(true);
  };

  const performManualArchive = async () => {
    const year = parseInt(archiveYear);

    if (
      !year ||
      isNaN(year) ||
      year < 2000 ||
      year > new Date().getFullYear()
    ) {
      toast.error("Please enter a valid year (2000 to current year)");
      return;
    }

    if (archiveConfirmText !== `ARCHIVE${year}`) {
      toast.error(`Please type "ARCHIVE${year}" to confirm`);
      return;
    }

    setShowManualArchiveModal(false);
    setGeneratingYearlyRecord(true);

    try {
      // Get all approved/rejected/cancelled leaves for the year
      const { data: leavesToArchive, error: fetchError } = await supabase
        .from("leave_requests")
        .select("*, personnel:personnel_id (*)")
        .or(`created_at.gte.${year}-01-01,created_at.lte.${year}-12-31`)
        .in("status", ["Approved", "Rejected", "Cancelled"]);

      if (fetchError) {
        throw fetchError;
      }

      if (!leavesToArchive || leavesToArchive.length === 0) {
        toast.info(`No leaves found to archive for year ${year}`);
        setGeneratingYearlyRecord(false);
        return;
      }

      const results = {
        total: leavesToArchive.length,
        archived: 0,
        failed: 0,
      };

      // Process each leave
      for (const leave of leavesToArchive) {
        try {
          const personnel = leave.personnel;
          let leaveStatus;
          switch (leave.status.toUpperCase()) {
            case "APPROVED":
              leaveStatus = "APPROVED";
              break;
            case "REJECTED":
              leaveStatus = "REJECTED";
              break;
            case "CANCELLED":
              leaveStatus = "CANCELLED";
              break;
            default:
              continue; // Skip any unexpected status
          }

          const fullName = `${personnel.first_name || ""} ${
            personnel.middle_name || ""
          } ${personnel.last_name || ""}`
            .replace(/\s+/g, " ")
            .trim();

          // Check if already archived
          const { data: existingArchive } = await supabase
            .from("leave_records")
            .select("id")
            .eq("leave_request_id", leave.id)
            .single();

          if (existingArchive) {
            results.archived++; // Already counted
            continue;
          }

          // Create yearly record
          await supabase.from("leave_records").insert({
            year: year,
            personnel_id: leave.personnel_id,
            personnel_name: fullName,
            rank: personnel.rank,
            badge_number: personnel.badge_number,
            station: personnel.station,
            designation: personnel.designation,
            leave_status: leaveStatus,
            leave_type: leave.leave_type,
            leave_request_id: leave.id,
            leave_initiated_date: leave.created_at,
            leave_approved_date: leave.approved_at,
            start_date: leave.start_date,
            end_date: leave.end_date,
            num_days: leave.num_days,
            record_generated_date: new Date().toISOString().split("T")[0],
            approved_by: leave.approved_by || "Yearly Archive",
            generated_by: "Yearly Archive",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

          // ========== DELETE THE ORIGINAL ==========
          await supabase.from("leave_requests").delete().eq("id", leave.id);

          results.archived++;
        } catch (err) {
          console.error(`Error archiving leave ${leave.id}:`, err);
          results.failed++;
        }
      }

      // Get pending leaves count
      const { data: pendingLeaves } = await supabase
        .from("leave_requests")
        .select("id")
        .or(`created_at.gte.${year}-01-01,created_at.lte.${year}-12-31`)
        .eq("status", "Pending");

      toast.success(
        `✅ Archived ${results.archived} leaves for ${year}. ` +
          `${results.failed} failed. ` +
          `Pending leaves remaining: ${pendingLeaves?.length || 0}`
      );

      // Refresh data
      loadAvailableYears();
      setViewMode("yearly");
      setSelectedYear(year);
      setTimeout(() => {
        loadLeaveData();
      }, 1000);
    } catch (err) {
      console.error("Manual archive error:", err);
      toast.error(`Failed: ${err.message}`);
    } finally {
      setTimeout(() => {
        setGeneratingYearlyRecord(false);
      }, 1000);
    }
  };

const manuallyArchiveSingleLeave = async (leaveId, leaveData) => {
  setArchivingRecordId(leaveId);

  try {
    // 1. Get the leave request details
    const { data: leave, error } = await supabase
      .from("leave_requests")
      .select("*")
      .eq("id", leaveId)
      .single();

    if (error) throw error;

    // 2. Check if already archived
    const { data: existingArchive } = await supabase
      .from("leave_records")
      .select("id")
      .eq("leave_request_id", leaveId)
      .single();

    if (existingArchive) {
      toast.info("This leave is already archived");
      setArchivingRecordId(null);
      return;
    }

    // 3. Validate it can be archived
    if (leave.status === "Pending") {
      toast.warning("Only Approved or Rejected leaves can be archived");
      setArchivingRecordId(null);
      return;
    }

    // 4. Get personnel info
    const { data: personnel } = await supabase
      .from("personnel")
      .select(
        "first_name, last_name, middle_name, rank, badge_number, station, designation"
      )
      .eq("id", leave.personnel_id)
      .single();

    // 5. Determine year
    const year = leave.approved_at
      ? new Date(leave.approved_at).getFullYear()
      : new Date(leave.created_at).getFullYear();

    // 6. Map status
    let leaveStatus;
    switch (leave.status.toUpperCase()) {
      case "APPROVED":
        leaveStatus = "APPROVED";
        break;
      case "REJECTED":
        leaveStatus = "REJECTED";
        break;
      case "CANCELLED":
        leaveStatus = "CANCELLED";
        break;
      default:
        leaveStatus = "PENDING";
    }

    const fullName = `${personnel.first_name || ""} ${
      personnel.middle_name || ""
    } ${personnel.last_name || ""}`
      .replace(/\s+/g, " ")
      .trim();

    // 7. Create the yearly record
    const { error: insertError } = await supabase.from("leave_records").insert({
      year: year,
      personnel_id: leave.personnel_id,
      personnel_name: fullName,
      rank: personnel.rank,
      badge_number: personnel.badge_number,
      station: personnel.station,
      designation: personnel.designation,
      leave_status: leaveStatus,
      leave_type: leave.leave_type,
      leave_request_id: leave.id,
      leave_initiated_date: leave.created_at,
      leave_approved_date: leave.approved_at,
      start_date: leave.start_date,
      end_date: leave.end_date,
      num_days: leave.num_days,
      record_generated_date: new Date().toISOString().split("T")[0],
      approved_by: leave.approved_by || "Manual Archive",
      generated_by: "Manual Archive",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (insertError) {
      console.error("Archive insert error:", insertError);
      throw insertError;
    }

    // ========== NEW: DELETE THE ORIGINAL REQUEST ==========
    // 8. First, transfer any documents
    const { data: leaveDocuments } = await supabase
      .from("leave_documents")
      .select("*")
      .eq("leave_request_id", leaveId);

    if (leaveDocuments && leaveDocuments.length > 0) {
      console.log(
        `Transferring ${leaveDocuments.length} document(s) to yearly records...`
      );

      // If you want to keep documents linked, you could update them here
      // Or leave them as-is since they're still associated via leave_request_id
    }

    // 9. Delete from leave_requests
    const { error: deleteError } = await supabase
      .from("leave_requests")
      .delete()
      .eq("id", leaveId);

    if (deleteError) {
      console.error("Error deleting original request:", deleteError);
      toast.warning(
        "Yearly record created but could not delete original request"
      );
    } else {
      console.log("✅ Original leave request deleted after archiving");
    }

    toast.success(
      "✅ Leave archived successfully and removed from active requests!"
    );
    loadLeaveData();
  } catch (err) {
    console.error("Error archiving single leave:", err);
    toast.error(`Failed to archive: ${err.message}`);
  } finally {
    setArchivingRecordId(null);
  }
};
  // Bulk delete functions
  const toggleRecordSelection = (recordId) => {
    setSelectedRecords((prev) => {
      if (prev.includes(recordId)) {
        return prev.filter((id) => id !== recordId);
      } else {
        return [...prev, recordId];
      }
    });
  };

  const toggleSelectAllOnPage = () => {
    if (selectedRecords.length === paginated.length) {
      // Deselect all on current page
      setSelectedRecords([]);
    } else {
      // Select all on current page
      const pageIds = paginated.map((record) => record.id);
      setSelectedRecords(pageIds);
    }
  };

  const toggleSelectAllFiltered = () => {
    if (selectedRecords.length === filteredLeaveData.length) {
      // Deselect all filtered
      setSelectedRecords([]);
    } else {
      // Select all filtered
      const filteredIds = filteredLeaveData.map((record) => record.id);
      setSelectedRecords(filteredIds);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedRecords.length === 0) {
      toast.warning("No records selected for deletion");
      return;
    }

    setShowBulkDeleteConfirm(true);
  };

  // Function to delete PDFs from storage
  const deletePdfFromStorage = async (record) => {
    try {
      let storagePath = null;

      // Check if the record has a document path
      if (record.documentPath) {
        storagePath = record.documentPath;
      } else if (record.documentUrl) {
        // Extract path from URL
        const url = new URL(record.documentUrl);
        const pathMatch = url.pathname.match(
          /\/storage\/v1\/object\/public\/leave-documents\/(.+)/
        );
        if (pathMatch) {
          storagePath = decodeURIComponent(pathMatch[1]);
        }
      }

      // If we have a storage path, delete it
      if (storagePath) {
        console.log(`Attempting to delete PDF from storage: ${storagePath}`);

        const { error } = await supabase.storage
          .from("leave-documents")
          .remove([storagePath]);

        if (error) {
          console.warn(
            `Error deleting PDF from storage (${storagePath}):`,
            error
          );
          // Don't throw error - just log it
        } else {
          console.log(`Successfully deleted PDF from storage: ${storagePath}`);
        }
      }

      // Also check for any related documents in the database
      let relatedDocs = [];

      if (record.recordType === "current") {
        const { data, error } = await supabase
          .from("leave_documents")
          .select("file_path")
          .eq("leave_request_id", record.dbId)
          .eq("document_type", "LEAVE_FORM");

        if (!error && data) {
          relatedDocs = data;
        }
      } else if (record.recordType === "yearly") {
        const { data, error } = await supabase
          .from("leave_documents")
          .select("file_path")
          .eq("leave_record_id", record.id)
          .eq("document_type", "LEAVE_FORM");

        if (!error && data) {
          relatedDocs = data;
        }
      }

      // Delete any related documents from storage
      for (const doc of relatedDocs) {
        if (doc.file_path) {
          try {
            const { error: storageError } = await supabase.storage
              .from("leave-documents")
              .remove([doc.file_path]);

            if (storageError) {
              console.warn(
                `Error deleting related PDF (${doc.file_path}):`,
                storageError
              );
            } else {
              console.log(`Deleted related PDF: ${doc.file_path}`);
            }
          } catch (err) {
            console.warn(`Exception deleting PDF ${doc.file_path}:`, err);
          }
        }
      }

      return true;
    } catch (error) {
      console.error("Error in deletePdfFromStorage:", error);
      // Don't throw - just log the error
      return false;
    }
  };

  // Perform bulk deletion
  const performBulkDelete = async () => {
    setGeneratingYearlyRecord(true); // Reuse loading state
    let successCount = 0;
    let failCount = 0;

    try {
      for (const recordId of selectedRecords) {
        try {
          const record = leaveData.find((r) => r.id === recordId);
          if (!record) continue;

          // Delete PDFs from storage first
          await deletePdfFromStorage(record);

          if (record.recordType === "yearly") {
            // Delete yearly record
            const { error } = await supabase
              .from("leave_records")
              .delete()
              .eq("id", recordId);

            if (error) throw error;

            // Also delete related documents from database
            const { error: docError } = await supabase
              .from("leave_documents")
              .delete()
              .eq("leave_record_id", recordId);

            if (docError)
              console.warn("Error deleting related documents:", docError);

            successCount++;
          } else if (record.recordType === "current") {
            // Delete current request
            await deleteLeaveCascade(record.dbId, record);
            successCount++;
          }
        } catch (err) {
          console.error(`Error deleting record ${recordId}:`, err);
          failCount++;
        }
      }

      // Clear selection and refresh data
      setSelectedRecords([]);
      setIsBulkDeleteMode(false);
      setShowBulkDeleteConfirm(false);

      // Show results
      if (successCount > 0) {
        toast.success(
          `Successfully deleted ${successCount} record(s) and their PDFs`
        );
        await loadLeaveData();
      }

      if (failCount > 0) {
        toast.error(`Failed to delete ${failCount} record(s)`);
      }
    } catch (error) {
      console.error("Bulk delete error:", error);
      toast.error("Error during bulk deletion");
    } finally {
      setGeneratingYearlyRecord(false);
    }
  };

  // Cascade delete for leave requests
  const deleteLeaveCascade = async (leaveId, record) => {
    try {
      // 0. First, delete PDFs from storage
      await deletePdfFromStorage(record);

      // 1. Check and delete from leave_records if exists
      if (record.recordType === "current") {
        const { data: archivedRecord } = await supabase
          .from("leave_records")
          .select("id, document_path, document_url")
          .eq("leave_request_id", leaveId)
          .single();

        if (archivedRecord) {
          // Delete any PDFs from the archived record too
          if (archivedRecord.document_path || archivedRecord.document_url) {
            await deletePdfFromStorage({
              ...archivedRecord,
              recordType: "yearly",
            });
          }

          const { error: archiveError } = await supabase
            .from("leave_records")
            .delete()
            .eq("id", archivedRecord.id);

          if (archiveError) {
            console.warn("Error deleting archived record:", archiveError);
          }
        }
      }

      // 2. Delete leave documents (database records)
      const { error: documentsError } = await supabase
        .from("leave_documents")
        .delete()
        .eq(
          record.recordType === "current"
            ? "leave_request_id"
            : "leave_record_id",
          leaveId
        );

      if (documentsError && !documentsError.message.includes("No rows")) {
        console.warn("Error deleting leave documents:", documentsError);
      }

      // 3. Finally delete the main record
      if (record.recordType === "current") {
        const { error: mainError } = await supabase
          .from("leave_requests")
          .delete()
          .eq("id", leaveId);

        if (mainError) throw mainError;
      } else {
        const { error: mainError } = await supabase
          .from("leave_records")
          .delete()
          .eq("id", leaveId);

        if (mainError) throw mainError;
      }

      return true;
    } catch (error) {
      console.error("Error in cascade delete:", error);
      throw error;
    }
  };

  // Check if leave can be deleted
  const canDeleteLeave = async (leaveId, leaveData) => {
    try {
      const leaveStatus = leaveData?.status?.toLowerCase() || "";

      // Check if there are PDFs that will be deleted
      let hasPdfs = false;
      if (leaveData.documentUrl || leaveData.documentPath) {
        hasPdfs = true;
      } else {
        // Check leave_documents table
        let pdfCheck;
        if (leaveData.recordType === "current") {
          pdfCheck = await supabase
            .from("leave_documents")
            .select("id")
            .eq("leave_request_id", leaveData.dbId || leaveId)
            .eq("document_type", "LEAVE_FORM")
            .limit(1);
        } else {
          pdfCheck = await supabase
            .from("leave_documents")
            .select("id")
            .eq("leave_record_id", leaveId)
            .eq("document_type", "LEAVE_FORM")
            .limit(1);
        }

        if (!pdfCheck.error && pdfCheck.data && pdfCheck.data.length > 0) {
          hasPdfs = true;
        }
      }

      const pdfNote = hasPdfs
        ? "Associated PDFs will also be deleted from storage."
        : "";

      // 1. Always allow deletion of rejected/cancelled leaves
      if (leaveStatus === "rejected" || leaveStatus === "cancelled") {
        return { canDelete: true, reason: pdfNote };
      }

      // 2. Check if archived first (if current record)
      if (leaveData.recordType === "current") {
        const { data: archivedRecord } = await supabase
          .from("leave_records")
          .select("id")
          .eq("leave_request_id", leaveId)
          .single();

        if (archivedRecord) {
          return {
            canDelete: true,
            reason: `Note: This will also delete the archived yearly record. ${pdfNote}`,
          };
        }
      }

      // 3. For pending leaves, we may want to restrict deletion or allow with warning
      if (leaveStatus === "pending") {
        return {
          canDelete: true,
          reason: `Note: This is a pending leave request. ${pdfNote}`,
        };
      }

      // 4. For approved leaves, allow deletion
      return { canDelete: true, reason: pdfNote };
    } catch (error) {
      console.error("Error checking deletion eligibility:", error);
      return { canDelete: false, reason: "Error checking status." };
    }
  };

  // Update the deleteLeaveRequest function
  const deleteLeaveRequest = async (leaveId, record) => {
    console.log("Delete clicked for:", leaveId, record);
    try {
      const { canDelete, reason } = await canDeleteLeave(leaveId, record);
      console.log("Can delete?", canDelete, reason);

      if (!canDelete) {
        setDeleteId(leaveId);
        setDeleteRecord(record);
        setIsDeleteOpen(true);
        setDeleteReason(reason);
        return;
      }

      setDeleteId(leaveId);
      setDeleteRecord(record);
      setIsDeleteOpen(true);
      setDeleteReason("");
    } catch (error) {
      console.error("Error in deleteLeaveRequest:", error);
      toast.error("Error checking deletion eligibility");
    }
  };

  // Update the performDelete function
  const performDelete = async () => {
    if (!deleteId || !deleteRecord) return;

    try {
      // Delete PDFs from storage first
      await deletePdfFromStorage(deleteRecord);

      // Proceed with deletion
      let success = false;

      if (deleteRecord.recordType === "current") {
        // First, check if there's a related record in leave_records
        const { data: archivedRecord, error: archiveCheckError } =
          await supabase
            .from("leave_records")
            .select("id, document_path, document_url")
            .eq("leave_request_id", deleteId)
            .single();

        // If there's an archived record, delete it first (including its PDFs)
        if (archivedRecord && !archiveCheckError) {
          // Delete any PDFs from the archived record too
          if (archivedRecord.document_path || archivedRecord.document_url) {
            await deletePdfFromStorage({
              ...archivedRecord,
              recordType: "yearly",
            });
          }

          const { error: deleteArchiveError } = await supabase
            .from("leave_records")
            .delete()
            .eq("id", archivedRecord.id);

          if (deleteArchiveError) {
            console.error(
              "Error deleting archived record:",
              deleteArchiveError
            );
            // Continue with deletion of leave request anyway
          } else {
            console.log("Deleted archived record:", archivedRecord.id);
          }
        }

        // Delete from leave_requests
        const { error } = await supabase
          .from("leave_requests")
          .delete()
          .eq("id", deleteId);

        if (error) throw error;
        success = true;
      } else if (deleteRecord.recordType === "yearly") {
        // For yearly records, just delete from leave_records
        const { error } = await supabase
          .from("leave_records")
          .delete()
          .eq("id", deleteId);

        if (error) throw error;
        success = true;
      }

      if (success) {
        await loadLeaveData();
        cancelDelete();
        setDeleteReason("");
        toast.success("Leave record and associated PDFs deleted successfully!");
      }
    } catch (err) {
      console.error("Delete error:", err);
      toast.error("Error deleting record: " + err.message);
      setDeleteReason("");
    }
  };

  const cancelDelete = () => {
    setDeleteId(null);
    setDeleteRecord(null);
    setIsDeleteOpen(false);
    setDeleteReason("");
  };

  const checkIfArchived = async (leaveId) => {
    try {
      console.log(`🔍 Checking archive for leave ID: ${leaveId}`);

      // Use a simpler query approach
      const { data, error, count } = await supabase
        .from("leave_records")
        .select("id", { count: "exact", head: false })
        .eq("leave_request_id", leaveId)
        .limit(1);

      if (error) {
        console.error("❌ Archive check query error:", {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        return false;
      }

      console.log(
        `📊 Archive check result: ${data ? data.length : 0} records found`
      );
      return data && data.length > 0;
    } catch (err) {
      console.error("💥 Exception in checkIfArchived:", err);
      return false;
    }
  };
  const getStatusClass = (status) => {
    const statusMap = {
      pending: styles.pending, // This matches .pending in your CSS
      approved: styles.approved, // This matches .approved in your CSS
      rejected: styles.rejected, // This matches .rejected in your CSS
      "in progress": styles.pending,
      cancelled: styles.rejected,
      completed: styles.approved,
    };
    return statusMap[status.toLowerCase()] || styles.pending;
  };

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
const handleArchiveClick = (record) => {
  if (
    record.recordType === "current" &&
    (record.status === "Approved" ||
      record.status === "Rejected" ||
      record.status === "Cancelled")
  ) {
    setLeaveToArchive(record);
    setShowArchiveConfirmModal(true);
  }
};

const renderArchiveConfirmModal = () => {
  if (!showArchiveConfirmModal || !leaveToArchive) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent} style={{ maxWidth: "500px" }}>
        <div className={styles.modalHeader}>
          <h2>Confirm Archive & Delete</h2>
          <button
            className={styles.modalCloseBtn}
            onClick={() => {
              setShowArchiveConfirmModal(false);
              setLeaveToArchive(null);
            }}
          >
            &times;
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.archiveWarningIcon}>📦 → 🗄️</div>
          <h3>Archive Leave Request</h3>

          <div className={styles.archiveDetails}>
            <p>
              <strong>Personnel:</strong> {leaveToArchive.fullName}
            </p>
            <p>
              <strong>Leave Type:</strong> {leaveToArchive.leaveType}
            </p>
            <p>
              <strong>Duration:</strong> {leaveToArchive.numDays} days
            </p>
            <p>
              <strong>Status:</strong> {leaveToArchive.status}
            </p>
            <p>
              <strong>Request Date:</strong>{" "}
              {formatDate(leaveToArchive.dateRequested)}
            </p>
          </div>

          <div className={styles.archiveWarningBox}>
            <p>
              <strong>⚠️ This action will:</strong>
            </p>
            <ol>
              <li>Create a yearly record in the archive</li>
              <li>
                <strong>DELETE the original request</strong> from active leaves
              </li>
              <li>The leave will no longer appear in Leave Management</li>
            </ol>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button
            className={styles.modalCancelButton}
            onClick={() => {
              setShowArchiveConfirmModal(false);
              setLeaveToArchive(null);
            }}
          >
            Cancel
          </button>
          <button
            className={styles.archiveConfirmButton}
            onClick={async () => {
              await manuallyArchiveSingleLeave(
                leaveToArchive.dbId,
                leaveToArchive
              );
              setShowArchiveConfirmModal(false);
              setLeaveToArchive(null);
            }}
            disabled={archivingRecordId === leaveToArchive.dbId}
          >
            {archivingRecordId === leaveToArchive.dbId
              ? "Archiving..."
              : "✅ Archive & Delete"}
          </button>
        </div>
      </div>
    </div>
  );
};
  const handleManageClick = (record) => {
    if (record.recordType === "current" && record.dbId) {
      const manageUrl = `/leaveManagement?requestId=${encodeURIComponent(
        record.dbId
      )}&username=${encodeURIComponent(
        record.username
      )}&type=${encodeURIComponent(record.leaveType)}`;
      window.location.href = manageUrl;
    } else {
      toast.info(
        "Yearly records are read-only. Manage current requests instead."
      );
    }
  };

  const handleViewDetails = (record) => {
    setSelectedRecordDetails(record);
    setShowDetailsModal(true);
  };

  const renderPdfProgressOverlay = () => {
    if (!generatingPdf) return null;

    return (
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
    );
  };

  if (loading) {
    return (
      <div className={`main-content ${isSidebarCollapsed ? "collapsed" : ""}`}>
        <div className={styles.loadingContainer}>
          <div className={styles.loadingSpinner}></div>
          <p>Loading leave records...</p>
        </div>
      </div>
    );
  }

  // NEW: Function to render table header with checkbox for bulk delete mode
  const renderTableHeader = () => {
    if (isBulkDeleteMode && viewMode === "yearly") {
      return (
        <tr>
          <th style={{ width: "50px" }}>
            <input
              type="checkbox"
              checked={
                selectedRecords.length === paginated.length &&
                paginated.length > 0
              }
              onChange={toggleSelectAllOnPage}
              className={styles.bulkCheckbox}
            />
          </th>
          <th className={styles.rankHeader}>Full Name</th>
          <th>Rank</th>
          <th>Badge No.</th>
          <th>Station</th>
          <th>Date</th>
          <th>Leave Type</th>
          <th>Days</th>
          <th>Status</th>
          <th>Archive Status</th>
          <th>Actions</th>
        </tr>
      );
    }

    return (
      <tr>
        <th className={styles.rankHeader}>Personnel</th>
        <th>Rank</th>
        <th>Badge No.</th>
        <th>Station</th>
        <th>Date</th>
        <th>Leave Type</th>
        <th>Days</th>
        <th>Status</th>
        <th>Archive Status</th>
        <th>Actions</th>
      </tr>
    );
  };

  // NEW: Function to render table row with checkbox for bulk delete mode
  const renderTableRow = (record) => {
    const isSelected = selectedRecords.includes(record.id);

    if (isBulkDeleteMode && viewMode === "yearly") {
      return (
        <tr key={record.id} className={isSelected ? styles.selectedRow : ""}>
          <td>
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => toggleRecordSelection(record.id)}
              className={styles.bulkCheckbox}
            />
          </td>
          <td>{record.fullName}</td>
          <td>{record.rank}</td>
          <td>{record.badgeNumber}</td>
          <td>{record.station}</td>
          <td>
            {viewMode === "current"
              ? formatDate(record.dateRequested)
              : formatDate(record.recordDate)}
          </td>
          <td>{record.leaveType}</td>
          <td>{record.numDays}</td>
          <td>
            <span
              className={`${styles.status} ${getStatusClass(record.status)}`}
            >
              {record.status}
            </span>
          </td>
          <td>
            <span
              className={`${styles.archiveStatusBadge} ${styles.archivedBadge}`}
            >
              📊 Archived ({record.year})
            </span>
          </td>
          <td>
            <div className={styles.actionButtons}>
              <button
                className={styles.viewBtn}
                onClick={() => handleViewDetails(record)}
                title="View Details"
              >
                👁️ View
              </button>

              {/* PDF Button */}
              {getPdfButton(record)}

              {/* Delete button for individual deletion */}
              <button
                className={styles.deleteBtn}
                onClick={() => deleteLeaveRequest(record.id, record)}
                title="Delete yearly record"
              >
                🗑️ Delete
              </button>
            </div>
          </td>
        </tr>
      );
    }

    // Regular row (not in bulk delete mode)
    return (
      <tr key={record.id}>
        <td>{record.fullName}</td>
        <td>{record.rank}</td>
        <td>{record.badgeNumber}</td>
        <td>{record.station}</td>
        <td>
          {viewMode === "current"
            ? formatDate(record.dateRequested)
            : formatDate(record.recordDate)}
        </td>
        <td>{record.leaveType}</td>
        <td>{record.numDays}</td>
        <td>
          <span className={`${styles.status} ${getStatusClass(record.status)}`}>
            {record.status}
          </span>
        </td>
        <td>
          {record.recordType === "current" ? (
            record.isArchived ? (
              <span
                className={`${styles.archiveStatusBadge} ${styles.archivedBadge}`}
              >
                ✅ Archived
              </span>
            ) : (
              <span
                className={`${styles.archiveStatusBadge} ${styles.notArchivedBadge}`}
              >
                📝 Not Archived
              </span>
            )
          ) : (
            <span
              className={`${styles.archiveStatusBadge} ${styles.archivedBadge}`}
            >
              📊 Archived ({record.year})
            </span>
          )}
        </td>
        <td>
          <div className={styles.actionButtons}>
            <button
              className={styles.viewBtn}
              onClick={() => handleViewDetails(record)}
              title="View Details"
            >
              👁️ View
            </button>

            {/* PDF Button */}
            {getPdfButton(record)}

            {record.recordType === "current" ? (
              <>
                {/* Archive Button - Only for Approved/Rejected/Cancelled leaves */}
                {!record.isArchived &&
                  (record.status === "Approved" ||
                    record.status === "Rejected" ||
                    record.status === "Cancelled") && (
                    <button
                      className={styles.archiveBtn}
                      onClick={() => handleArchiveClick(record)}
                      disabled={archivingRecordId === record.dbId}
                      title="Archive to yearly records"
                    >
                      {archivingRecordId === record.dbId ? (
                        <>⏳ Archiving...</>
                      ) : (
                        <>📦 Archive & Delete</>
                      )}
                    </button>
                  )}

                {/* Delete Button - Only for Approved/Rejected/Cancelled leaves */}
                {(record.status === "Approved" ||
                  record.status === "Rejected" ||
                  record.status === "Cancelled") && (
                  <button
                    className={styles.deleteBtn}
                    onClick={() => deleteLeaveRequest(record.dbId, record)}
                    disabled={deletingRecordId === record.dbId}
                    title="Delete leave request"
                  >
                    {deletingRecordId === record.dbId ? (
                      <>⏳ Deleting...</>
                    ) : (
                      <>🗑️ Delete</>
                    )}
                  </button>
                )}

                {/* Manage Button - Only for Pending */}
                {record.status === "Pending" && (
                  <button
                    className={styles.manageBtn}
                    onClick={() => handleManageClick(record)}
                    title="Manage leave"
                  >
                    ⚙️ Manage
                  </button>
                )}
              </>
            ) : (
              // Add delete button for yearly records
              <button
                className={styles.deleteBtn}
                onClick={() => deleteLeaveRequest(record.id, record)}
                title="Delete yearly record"
              >
                🗑️ Delete
              </button>
            )}
          </div>
        </td>
      </tr>
    );
  };

  // NEW: Render bulk delete controls
  const renderBulkDeleteControls = () => {
    if (viewMode !== "yearly" || filteredLeaveData.length === 0) return null;

    return (
      <div className={styles.bulkDeleteControls}>
        {!isBulkDeleteMode ? (
          <>
            <button
              className={styles.bulkDeleteToggleBtn}
              onClick={() => setIsBulkDeleteMode(true)}
              title="Enable bulk selection for deletion"
            >
              🔲 Bulk Delete
            </button>
            {filteredLeaveData.length > 10 && (
              <span className={styles.recordCountWarning}>
                ({filteredLeaveData.length} records - consider using bulk
                delete)
              </span>
            )}
          </>
        ) : (
          <div className={styles.bulkDeleteActive}>
            <div className={styles.bulkSelectionInfo}>
              <span className={styles.selectedCount}>
                {selectedRecords.length} of {filteredLeaveData.length} selected
              </span>
              <button
                className={styles.selectAllBtn}
                onClick={toggleSelectAllFiltered}
              >
                {selectedRecords.length === filteredLeaveData.length
                  ? "Deselect All"
                  : "Select All Filtered"}
              </button>
            </div>

            <div className={styles.bulkActionButtons}>
              <button
                className={styles.cancelBulkBtn}
                onClick={() => {
                  setIsBulkDeleteMode(false);
                  setSelectedRecords([]);
                }}
              >
                Cancel
              </button>
              <button
                className={styles.bulkDeleteConfirmBtn}
                onClick={handleBulkDelete}
                disabled={selectedRecords.length === 0}
              >
                🗑️ Delete Selected ({selectedRecords.length})
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // NEW: Render bulk delete confirmation modal
  const renderBulkDeleteModal = () => {
    if (!showBulkDeleteConfirm) return null;

    const selectedYearlyRecords = selectedRecords
      .map((id) => leaveData.find((r) => r.id === id))
      .filter((r) => r?.recordType === "yearly");

    const selectedCurrentRecords = selectedRecords
      .map((id) => leaveData.find((r) => r.id === id))
      .filter((r) => r?.recordType === "current");

    // Count records with PDFs
    const recordsWithPdfs = selectedRecords
      .map((id) => leaveData.find((r) => r.id === id))
      .filter((record) => record?.documentUrl || record?.documentPath).length;

    return (
      <div className={styles.modalOverlay}>
        <div className={styles.modalContent} style={{ maxWidth: "600px" }}>
          <div className={styles.modalHeader}>
            <h2>Confirm Bulk Deletion</h2>
            <button
              className={styles.modalCloseBtn}
              onClick={() => setShowBulkDeleteConfirm(false)}
            >
              &times;
            </button>
          </div>

          <div className={styles.modalBody}>
            <div className={styles.deleteWarningIcon}>⚠️</div>
            <h3>
              Are you sure you want to delete {selectedRecords.length}{" "}
              record(s)?
            </h3>

            <div className={styles.bulkDeleteDetails}>
              <p>
                <strong>Yearly Records to Delete:</strong>{" "}
                {selectedYearlyRecords.length}
              </p>
              <p>
                <strong>Current Requests to Delete:</strong>{" "}
                {selectedCurrentRecords.length}
              </p>

              {recordsWithPdfs > 0 && (
                <div className={styles.pdfDeletionWarning}>
                  <p>
                    <strong>⚠️ PDF Files:</strong> {recordsWithPdfs} record(s)
                    have associated PDFs
                  </p>
                  <p className={styles.pdfNote}>
                    PDF files will be deleted from the leave-documents storage
                    bucket.
                  </p>
                </div>
              )}

              {selectedYearlyRecords.length > 0 && (
                <div className={styles.yearlyRecordsList}>
                  <p>
                    <strong>
                      Yearly Records (will be permanently deleted):
                    </strong>
                  </p>
                  <ul>
                    {selectedYearlyRecords.slice(0, 5).map((record) => (
                      <li key={record.id}>
                        {record.fullName} - {record.year} - {record.leaveType}
                        {(record.documentUrl || record.documentPath) && " 📄"}
                      </li>
                    ))}
                    {selectedYearlyRecords.length > 5 && (
                      <li>...and {selectedYearlyRecords.length - 5} more</li>
                    )}
                  </ul>
                </div>
              )}
            </div>

            <div className={styles.deleteWarningBox}>
              <p>
                <strong>⚠️ WARNING:</strong> This action cannot be undone!
              </p>
              <p>
                All selected records and their associated documents will be
                permanently deleted from the database and storage.
              </p>
            </div>
          </div>

          <div className={styles.modalFooter}>
            <button
              className={styles.modalCancelButton}
              onClick={() => setShowBulkDeleteConfirm(false)}
              disabled={generatingYearlyRecord}
            >
              Cancel
            </button>
            <button
              className={styles.modalDeleteButton}
              onClick={performBulkDelete}
              disabled={generatingYearlyRecord}
            >
              {generatingYearlyRecord
                ? "Deleting..."
                : `Delete ${selectedRecords.length} Record(s)`}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Add delete modal rendering function
  const renderDeleteModal = () => {
    if (!isDeleteOpen) return null;

    return (
      <div
        className={styles.inventoryModalDeleteOverlay}
        onClick={cancelDelete}
      >
        <div
          className={styles.inventoryModalDeleteContent}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles.inventoryModalDeleteHeader}>
            <h2 style={{ marginLeft: "30px" }}>Confirm Deletion</h2>
            <span
              className={styles.inventoryModalDeleteCloseBtn}
              onClick={cancelDelete}
            >
              &times;
            </span>
          </div>

          <div className={styles.inventoryModalDeleteBody}>
            {deleteReason ? (
              // Show warning if deletion has restrictions
              <div className={styles.deleteRestrictedWarning}>
                <div className={styles.inventoryDeleteWarningIcon}>⚠️</div>
                <h3>Deletion Notice</h3>
                <p className={styles.deleteWarningText}>{deleteReason}</p>
                <div className={styles.clearanceDetails}>
                  <p>
                    <strong>Leave Type:</strong> {deleteRecord?.leaveType}
                  </p>
                  <p>
                    <strong>Status:</strong> {deleteRecord?.status}
                  </p>
                  <p>
                    <strong>Personnel:</strong> {deleteRecord?.fullName}
                  </p>
                  <p>
                    <strong>Days:</strong> {deleteRecord?.numDays}
                  </p>
                </div>
                <p className={styles.deleteInstructions}>
                  <strong>Note:</strong> {deleteReason}
                </p>
              </div>
            ) : (
              // Normal deletion confirmation
              <div className={styles.inventoryDeleteConfirmationContent}>
                <div className={styles.inventoryDeleteWarningIcon}>⚠️</div>
                <p className={styles.inventoryDeleteConfirmationText}>
                  Are you sure you want to delete the leave record for
                </p>
                <p className={styles.inventoryDocumentNameHighlight}>
                  "{deleteRecord?.fullName || "this record"}"?
                </p>

                {deleteRecord && (
                  <div className={styles.modalRecordDetails}>
                    <p>
                      <strong>Type:</strong> {deleteRecord.leaveType}
                    </p>
                    <p>
                      <strong>Status:</strong> {deleteRecord.status}
                    </p>
                    <p>
                      <strong>Days:</strong> {deleteRecord.numDays}
                    </p>
                    <p>
                      <strong>Record Type:</strong>{" "}
                      {deleteRecord.recordType === "current"
                        ? "Current Request"
                        : "Yearly Record"}
                    </p>

                    {/* Check for PDFs */}
                    {(deleteRecord.documentUrl ||
                      deleteRecord.documentPath) && (
                      <div className={styles.pdfWarning}>
                        <p>
                          <strong>⚠️ PDF Alert:</strong> This record has a
                          generated PDF in storage.
                        </p>
                        <p className={styles.pdfNote}>
                          The PDF file will also be deleted from the
                          leave-documents bucket.
                        </p>
                      </div>
                    )}

                    {deleteRecord.status === "Pending" && (
                      <p className={styles.accountabilityNote}>
                        <em>Note: This is a pending leave request.</em>
                      </p>
                    )}

                    {deleteRecord.status === "Rejected" && (
                      <p className={styles.rejectedNote}>
                        <em>
                          Note: Rejected leaves can be deleted without
                          restrictions.
                        </em>
                      </p>
                    )}
                  </div>
                )}

                <p className={styles.inventoryDeleteWarning}>
                  This action cannot be undone. All associated data including
                  PDF files will be permanently deleted.
                </p>
              </div>
            )}
          </div>

          <div className={styles.inventoryModalDeleteActions}>
            <button
              className={`${styles.inventoryModalDeleteBtn} ${styles.inventoryModalCancelBtn}`}
              onClick={cancelDelete}
            >
              Cancel
            </button>
            {!deleteReason && (
              <button
                className={`${styles.inventoryModalDeleteBtn} ${styles.inventoryDeleteConfirmBtn}`}
                onClick={performDelete}
              >
                Delete
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderDetailsModal = () => {
    if (!showDetailsModal || !selectedRecordDetails) return null;

    const isYearly = selectedRecordDetails.recordType === "yearly";
    const record = selectedRecordDetails;

    return (
      <div className={styles.modalOverlay}>
        <div className={styles.modalContent}>
          <div className={styles.modalHeader}>
            <h2>Leave Record Details</h2>
            <button
              className={styles.modalCloseBtn}
              onClick={() => setShowDetailsModal(false)}
            >
              &times;
            </button>
          </div>

          <div className={styles.modalBody}>
            {/* Personnel Information Section */}
            <div className={styles.modalSection}>
              <h3 className={styles.modalSectionTitle}>
                Personnel Information
              </h3>
              <div className={styles.modalDetailsGrid}>
                <div className={styles.modalDetailItem}>
                  <span className={styles.modalLabel}>Full Name:</span>
                  <span className={styles.modalValue}>{record.fullName}</span>
                </div>
                <div className={styles.modalDetailItem}>
                  <span className={styles.modalLabel}>Rank:</span>
                  <span className={styles.modalValue}>{record.rank}</span>
                </div>
                <div className={styles.modalDetailItem}>
                  <span className={styles.modalLabel}>Badge Number:</span>
                  <span className={styles.modalValue}>
                    {record.badgeNumber}
                  </span>
                </div>
                <div className={styles.modalDetailItem}>
                  <span className={styles.modalLabel}>Station:</span>
                  <span className={styles.modalValue}>{record.station}</span>
                </div>
                {record.designation && (
                  <div className={styles.modalDetailItem}>
                    <span className={styles.modalLabel}>Designation:</span>
                    <span className={styles.modalValue}>
                      {record.designation}
                    </span>
                  </div>
                )}
                {record.username && (
                  <div className={styles.modalDetailItem}>
                    <span className={styles.modalLabel}>Username:</span>
                    <span className={styles.modalValue}>{record.username}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Leave Information Section */}
            <div className={styles.modalSection}>
              <h3 className={styles.modalSectionTitle}>Leave Information</h3>
              <div className={styles.modalDetailsGrid}>
                <div className={styles.modalDetailItem}>
                  <span className={styles.modalLabel}>Leave Type:</span>
                  <span className={styles.modalValue}>{record.leaveType}</span>
                </div>
                <div className={styles.modalDetailItem}>
                  <span className={styles.modalLabel}>Status:</span>
                  <span
                    className={`${styles.modalValue} ${
                      styles[record.status?.toLowerCase()]
                    }`}
                  >
                    {record.status}
                  </span>
                </div>
                <div className={styles.modalDetailItem}>
                  <span className={styles.modalLabel}>
                    {isYearly ? "Record Date:" : "Date Requested:"}
                  </span>
                  <span className={styles.modalValue}>
                    {isYearly
                      ? formatDate(record.recordDate)
                      : formatDate(record.dateRequested)}
                  </span>
                </div>
                <div className={styles.modalDetailItem}>
                  <span className={styles.modalLabel}>Start Date:</span>
                  <span className={styles.modalValue}>
                    {formatDate(record.startDate)}
                  </span>
                </div>
                <div className={styles.modalDetailItem}>
                  <span className={styles.modalLabel}>End Date:</span>
                  <span className={styles.modalValue}>
                    {formatDate(record.endDate)}
                  </span>
                </div>
                <div className={styles.modalDetailItem}>
                  <span className={styles.modalLabel}>Number of Days:</span>
                  <span className={`${styles.modalValue} ${styles.daysValue}`}>
                    {record.numDays} day{record.numDays !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            </div>

            {/* Additional Details based on Record Type */}
            {isYearly ? (
              <>
                {/* Yearly Record Information */}
                <div className={styles.modalSection}>
                  <h3 className={styles.modalSectionTitle}>
                    Yearly Record Information
                  </h3>
                  <div className={styles.modalDetailsGrid}>
                    <div className={styles.modalDetailItem}>
                      <span className={styles.modalLabel}>Year:</span>
                      <span className={styles.modalValue}>{record.year}</span>
                    </div>
                    <div className={styles.modalDetailItem}>
                      <span className={styles.modalLabel}>Record Date:</span>
                      <span className={styles.modalValue}>
                        {formatDate(record.recordDate)}
                      </span>
                    </div>
                    <div className={styles.modalDetailItem}>
                      <span className={styles.modalLabel}>Source:</span>
                      <span className={styles.modalValue}>
                        {record.source || "Manually Generated"}
                      </span>
                    </div>
                    <div className={styles.modalDetailItem}>
                      <span className={styles.modalLabel}>Generated By:</span>
                      <span className={styles.modalValue}>
                        {record.generatedBy || "System"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Leave Summary for Yearly Records */}
                <div className={styles.modalSection}>
                  <h3 className={styles.modalSectionTitle}>Leave Summary</h3>
                  <div className={styles.modalDetailsGrid}>
                    <div className={styles.modalDetailItem}>
                      <span className={styles.modalLabel}>Vacation Days:</span>
                      <span className={styles.modalValue}>
                        {record.totalVacationDays || 0}
                      </span>
                    </div>
                    <div className={styles.modalDetailItem}>
                      <span className={styles.modalLabel}>Sick Days:</span>
                      <span className={styles.modalValue}>
                        {record.totalSickDays || 0}
                      </span>
                    </div>
                    <div className={styles.modalDetailItem}>
                      <span className={styles.modalLabel}>Emergency Days:</span>
                      <span className={styles.modalValue}>
                        {record.totalEmergencyDays || 0}
                      </span>
                    </div>
                    <div className={styles.modalDetailItem}>
                      <span className={styles.modalLabel}>Total Days:</span>
                      <span
                        className={`${styles.modalValue} ${styles.daysValue}`}
                      >
                        {record.numDays || 0} day
                        {record.numDays !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              /* Current Request Details */
              <>
                <div className={styles.modalSection}>
                  <h3 className={styles.modalSectionTitle}>Request Details</h3>
                  <div className={styles.modalDetailsGrid}>
                    <div className={styles.modalDetailItem}>
                      <span className={styles.modalLabel}>Approved By:</span>
                      <span className={styles.modalValue}>
                        {record.approvedBy || "Pending"}
                      </span>
                    </div>
                    <div className={styles.modalDetailItem}>
                      <span className={styles.modalLabel}>Approved Date:</span>
                      <span className={styles.modalValue}>
                        {record.approvedDate
                          ? formatDate(record.approvedDate)
                          : "Pending"}
                      </span>
                    </div>
                    <div className={styles.modalDetailItem}>
                      <span className={styles.modalLabel}>Completed Date:</span>
                      <span className={styles.modalValue}>
                        {record.completedDate
                          ? formatDate(record.completedDate)
                          : "N/A"}
                      </span>
                    </div>
                    <div className={styles.modalDetailItem}>
                      <span className={styles.modalLabel}>Archive Status:</span>
                      <span className={styles.modalValue}>
                        {record.isArchived ? "✅ Archived" : "📝 Not Archived"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Leave Specific Details */}
                {record.leaveType === "Vacation" &&
                  record.vacationLocationType && (
                    <div className={styles.modalSection}>
                      <h3 className={styles.modalSectionTitle}>
                        Vacation Details
                      </h3>
                      <div className={styles.modalDetailsGrid}>
                        <div className={styles.modalDetailItem}>
                          <span className={styles.modalLabel}>
                            Location Type:
                          </span>
                          <span className={styles.modalValue}>
                            {record.vacationLocationType === "abroad"
                              ? "Abroad"
                              : "Within Philippines"}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                {record.leaveType === "Sick" &&
                  (record.illnessType || record.illnessDetails) && (
                    <div className={styles.modalSection}>
                      <h3 className={styles.modalSectionTitle}>
                        Sick Leave Details
                      </h3>
                      <div className={styles.modalDetailsGrid}>
                        {record.illnessType && (
                          <div className={styles.modalDetailItem}>
                            <span className={styles.modalLabel}>
                              Illness Type:
                            </span>
                            <span className={styles.modalValue}>
                              {record.illnessType === "in_hospital"
                                ? "In Hospital"
                                : "Out Patient"}
                            </span>
                          </div>
                        )}
                        {record.illnessDetails && (
                          <div className={styles.modalDetailItem}>
                            <span className={styles.modalLabel}>
                              Illness Details:
                            </span>
                            <span className={styles.modalValue}>
                              {record.illnessDetails}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                {/* Leave Balance Information */}
                {record.balanceBefore !== undefined && (
                  <div className={styles.modalSection}>
                    <h3 className={styles.modalSectionTitle}>Leave Balance</h3>
                    <div className={styles.modalDetailsGrid}>
                      <div className={styles.modalDetailItem}>
                        <span className={styles.modalLabel}>
                          Balance Before:
                        </span>
                        <span className={styles.modalValue}>
                          {record.balanceBefore || 0} days
                        </span>
                      </div>
                      <div className={styles.modalDetailItem}>
                        <span className={styles.modalLabel}>This Leave:</span>
                        <span className={styles.modalValue}>
                          {record.numDays || 0} days
                        </span>
                      </div>
                      <div className={styles.modalDetailItem}>
                        <span className={styles.modalLabel}>
                          Balance After:
                        </span>
                        <span className={styles.modalValue}>
                          {record.balanceAfter || 0} days
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className={styles.modalFooter}>
            <button
              className={styles.modalCloseButton}
              onClick={() => setShowDetailsModal(false)}
            >
              Close
            </button>
            {/* Optional: Add PDF button in modal if needed */}
            {record.status?.toLowerCase() === "approved" && (
              <button
                className={styles.modalPdfButton}
                onClick={() => {
                  setShowDetailsModal(false);
                  generateAndUploadLeaveForm(record);
                }}
              >
                📄 Generate PDF
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderManualArchiveModal = () => {
    if (!showManualArchiveModal) return null;

    return (
      <div
        className={styles.archiveModalOverlay}
        onClick={() => setShowManualArchiveModal(false)}
      >
        <div
          className={styles.archiveModalContent}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles.archiveModalHeader}>
            <h2>Manual Archive - Archive All Leave Records</h2>
            <button
              className={styles.archiveModalCloseBtn}
              onClick={() => setShowManualArchiveModal(false)}
            >
              &times;
            </button>
          </div>

          <div className={styles.archiveModalBody}>
            <div>
              <label htmlFor="archiveYear">
                <strong>Enter year to archive:</strong>
              </label>
              <input
                id="archiveYear"
                type="number"
                className={styles.archiveYearInput}
                value={archiveYear}
                onChange={(e) => setArchiveYear(e.target.value)}
                min="2000"
                max={new Date().getFullYear()}
                placeholder="Enter year (2000 to current year)"
              />
            </div>

            <div className={styles.archiveWarningBox}>
              <div>
                <span className={styles.archiveWarningIcon}>⚠️</span>
                <strong>Important Notice:</strong>
              </div>
              <p className={styles.archiveWarningText}>
                This will archive all{" "}
                <strong>APPROVED, REJECTED, and CANCELLED</strong> leave
                requests from {archiveYear || "selected year"}.
              </p>
              <p className={styles.archiveWarningText}>
                <strong>PENDING leaves will NOT be archived</strong> and will
                remain in the Leave Management System.
              </p>
            </div>

            <div>
              <p>To confirm, please type:</p>
              <p className={styles.archiveConfirmText}>ARCHIVE{archiveYear}</p>
              <input
                type="text"
                className={styles.archiveConfirmInput}
                value={archiveConfirmText}
                onChange={(e) =>
                  setArchiveConfirmText(e.target.value.toUpperCase())
                }
                placeholder={`Type "ARCHIVE${archiveYear}" to confirm`}
                autoComplete="off"
              />
            </div>
          </div>

          <div className={styles.archiveModalFooter}>
            <button
              className={styles.archiveCancelButton}
              onClick={() => setShowManualArchiveModal(false)}
              disabled={generatingYearlyRecord}
            >
              Cancel
            </button>
            <button
              className={styles.archiveConfirmButton}
              onClick={performManualArchive}
              disabled={
                generatingYearlyRecord ||
                archiveConfirmText !== `ARCHIVE${archiveYear}`
              }
            >
              {generatingYearlyRecord
                ? "Archiving..."
                : `Archive ${archiveYear} Records`}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={styles.leaveAppContainer}>
      <Title>Leave Records | BFP Villanueva</Title>
      <Meta name="robots" content="noindex, nofollow" />

      <Hamburger />
      <Sidebar />
      <ToastContainer />

      <div className={`main-content ${isSidebarCollapsed ? "collapsed" : ""}`}>
        <div className={styles.headerContainer}>
          <h1>Leave Records</h1>

          <div className={styles.viewControls}>
            <div className={styles.viewToggle}>
              <button
                className={`${styles.viewBtn} ${
                  viewMode === "current" ? styles.viewBtnActive : ""
                }`}
                onClick={() => setViewMode("current")}
              >
                Current Requests
              </button>
              <button
                className={`${styles.viewBtn} ${
                  viewMode === "yearly" ? styles.viewBtnActive : ""
                }`}
                onClick={() => setViewMode("yearly")}
              >
                Yearly Records
              </button>
            </div>
            <button
              onClick={manuallyArchiveAllForYear}
              className={styles.manualArchiveBtn}
              disabled={generatingYearlyRecord}
              title="Manually archive ALL leave records for a year"
            >
              {generatingYearlyRecord ? "Archiving..." : "📦 Manual Archive"}
            </button>
            {viewMode === "yearly" && (
              <div className={styles.yearSelector}>
                <label>Year:</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className={styles.yearSelect}
                >
                  {availableYears.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                  {availableYears.length === 0 && (
                    <option value={new Date().getFullYear()}>
                      {new Date().getFullYear()}
                    </option>
                  )}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* NEW: Bulk Delete Controls */}
        {renderBulkDeleteControls()}

        {/* Top Controls */}
        <div className={styles.leaveTopControls}>
          <div className={styles.leaveTableHeader}>
            <select
              className={styles.leaveFilterStatus}
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All Status</option>
              <option>PENDING</option>
              <option>APPROVED</option>
              <option>REJECTED</option>
              <option>CANCELLED</option>
              <option>COMPLETED</option>
            </select>

            <select
              className={styles.leaveFilterType}
              value={filterLeaveType}
              onChange={(e) => {
                setFilterLeaveType(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All Leave Types</option>
              <option>Vacation</option>
              <option>Sick</option>
              <option>Emergency</option>
              <option>Maternity</option>
              <option>Paternity</option>
              <option>Study</option>
              <option>Bereavement</option>
              <option>Special</option>
            </select>

            <input
              type="text"
              className={styles.leaveSearchBar}
              placeholder="🔍 Search leave records..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>

        {/* Summary Cards */}
        <div className={styles.leaveSummary}>
          <button
            className={`${styles.leaveSummaryCard} ${styles.leaveTotal} ${
              currentFilterCard === "total" ? styles.leaveActive : ""
            }`}
            onClick={() => handleCardClick("total")}
          >
            <h3>Total Records</h3>
            <p>{totalItems}</p>
            {viewMode === "yearly" && <small>Year: {selectedYear}</small>}
          </button>
          <button
            className={`${styles.leaveSummaryCard} ${styles.leavePending} ${
              currentFilterCard === "pending" ? styles.leaveActive : ""
            }`}
            onClick={() => handleCardClick("pending")}
          >
            <h3>Pending</h3>
            <p>{pendingItems}</p>
          </button>
          <button
            className={`${styles.leaveSummaryCard} ${styles.leaveApproved} ${
              currentFilterCard === "approved" ? styles.leaveActive : ""
            }`}
            onClick={() => handleCardClick("approved")}
          >
            <h3>Approved</h3>
            <p>{approvedItems}</p>
          </button>
          <button
            className={`${styles.leaveSummaryCard} ${styles.leaveRejected} ${
              currentFilterCard === "rejected" ? styles.leaveActive : ""
            }`}
            onClick={() => handleCardClick("rejected")}
          >
            <h3>Rejected</h3>
            <p>{rejectedItems}</p>
          </button>
        </div>

        <div className={styles.leaveTableContainer}>
          <div className={styles.leavePaginationContainer}>
            {renderPaginationButtons()}
          </div>
          {/* ADD THIS WRAPPER DIV - Same as LeaveManagement */}
          <div className={styles.tableWrapper}>
            <table className={styles.leaveTable}>
              <thead>{renderTableHeader()}</thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td
                      colSpan={
                        isBulkDeleteMode && viewMode === "yearly" ? "11" : "10"
                      }
                      className={styles.leaveNoRequestsTable}
                    >
                      <div style={{ fontSize: "48px", marginBottom: "16px" }}>
                        <span className={styles.animatedEmoji}>📭</span>
                      </div>
                      <h3>No Leave Records Found</h3>
                      <p>There are no leave requests submitted yet.</p>
                    </td>
                  </tr>
                ) : (
                  paginated.map((record) => renderTableRow(record))
                )}
              </tbody>
            </table>
          </div>
          {/* END OF tableWrapper */}
          {/* Bottom Pagination */}
          <div className={styles.leavePaginationContainer}>
            {renderPaginationButtons()}
          </div>
        </div>
        {renderArchiveConfirmModal()}
        {/* Details Modal */}
        {renderDetailsModal()}
        {/* Bulk Delete Modal */}
        {renderBulkDeleteModal()}
        {/* Delete Modal */}
        {renderDeleteModal()}
        {/* Manual Archive Modal */}
        {renderManualArchiveModal()}
        {/* PDF Progress Overlay */}
        {renderPdfProgressOverlay()}
      </div>
    </div>
  );
};

export default LeaveRecords;
