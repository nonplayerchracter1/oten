import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import styles from "../styles/ClearanceRecords.module.css";
import Sidebar from "../../Sidebar.jsx";
import Hamburger from "../../Hamburger.jsx";
import { useSidebar } from "../../SidebarContext.jsx";
import { Title, Meta } from "react-head";
import { supabase } from "../../../lib/supabaseClient.js";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const ClearanceRecords = () => {
  const [clearanceData, setClearanceData] = useState([]);
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

  const [deleteReason, setDeleteReason] = useState(""); 
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfDownloadProgress, setPdfDownloadProgress] = useState(0);
  const [pdfDownloadForRequest, setPdfDownloadForRequest] = useState(null);
  const [existingPdfs, setExistingPdfs] = useState({});

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [deleteRecord, setDeleteRecord] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 5;
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterClearanceType, setFilterClearanceType] = useState("");
  const [currentFilterCard, setCurrentFilterCard] = useState("total");
const [showManualArchiveModal, setShowManualArchiveModal] = useState(false);
const [archiveYear, setArchiveYear] = useState(
  new Date().getFullYear().toString()
);
const [archiveConfirmText, setArchiveConfirmText] = useState("");

  const [selectedRecords, setSelectedRecords] = useState([]);
  const [isBulkDeleteMode, setIsBulkDeleteMode] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  useEffect(() => {
    loadClearanceData();
    loadAvailableYears();
  }, [viewMode, selectedYear]);

  useEffect(() => {
    // Load existing PDFs when clearance data changes
    if (clearanceData.length > 0) {
      loadExistingPdfs();
    }
  }, [clearanceData]);

  const loadClearanceData = async () => {
    setLoading(true);
    try {
      if (viewMode === "current") {
        await loadCurrentClearanceRequests();
      } else {
        await loadYearlyClearanceRecords();
      }
    } catch (err) {
      console.error("[ClearanceRecords] error loading", err);
      toast.error("An unexpected error occurred");
      setNoData(true);
    } finally {
      setLoading(false);
    }
  };

  const loadExistingPdfs = async () => {
    try {
      // For current requests
      if (viewMode === "current") {
        const requestIds = clearanceData
          .filter((item) => item.recordType === "current" && item.dbId)
          .map((item) => item.dbId);

        if (requestIds.length > 0) {
          const { data, error } = await supabase
            .from("clearance_documents")
            .select(
              "id, clearance_request_id, document_name, file_url, file_path, document_type, uploaded_at"
            )
            .in("clearance_request_id", requestIds)
            .eq("document_type", "CLEARANCE_FORM");

          if (!error && data) {
            const pdfsMap = {};
            data.forEach((doc) => {
              if (!pdfsMap[doc.clearance_request_id]) {
                pdfsMap[doc.clearance_request_id] = [];
              }
              pdfsMap[doc.clearance_request_id].push(doc);
            });
            setExistingPdfs(pdfsMap);
          }
        }
      }
      // For yearly records
      else {
        const recordIds = clearanceData
          .filter((item) => item.recordType === "yearly" && item.id)
          .map((item) => item.id);

        if (recordIds.length > 0) {
          const { data, error } = await supabase
            .from("clearance_documents")
            .select(
              "id, clearance_record_id, document_name, file_url, file_path, document_type, uploaded_at"
            )
            .in("clearance_record_id", recordIds)
            .eq("document_type", "CLEARANCE_FORM");

          if (!error && data) {
            const pdfsMap = {};
            data.forEach((doc) => {
              if (!pdfsMap[doc.clearance_record_id]) {
                pdfsMap[doc.clearance_record_id] = [];
              }
              pdfsMap[doc.clearance_record_id].push(doc);
            });
            setExistingPdfs(pdfsMap);
          }
        }
      }
    } catch (err) {
      console.error("Error loading existing PDFs:", err);
    }
  };

  const loadCurrentClearanceRequests = async () => {
    console.log("=== LOADING CURRENT CLEARANCE REQUESTS ===");

    const { data: clearanceRequests, error } = await supabase
      .from("clearance_requests")
      .select(
        `
      *,
      personnel:personnel_id (
        id,
        first_name,
        last_name,
        rank,
        username,
        badge_number,
        station
      )
      `
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching clearance records:", error);
      toast.error("Failed to load clearance records");
      setNoData(true);
      return;
    }

    console.log(
      "Total Current Clearance Requests:",
      clearanceRequests?.length || 0
    );

    if (!clearanceRequests || clearanceRequests.length === 0) {
      console.log("No clearance requests found in database");
      setNoData(true);
      return;
    }

    // Get all clearance request IDs
    const requestIds = clearanceRequests.map((request) => request.id);

    // Batch check archive status for all requests
    const { data: archivedRecords, error: archiveError } = await supabase
      .from("clearance_records")
      .select("clearance_request_id")
      .in("clearance_request_id", requestIds);

    if (archiveError) {
      console.warn("Error checking archived records:", archiveError);
    }

    // Create a Set of archived clearance request IDs for faster lookup
    const archivedIds = new Set();
    if (archivedRecords && archivedRecords.length > 0) {
      archivedRecords.forEach((record) => {
        if (record.clearance_request_id) {
          archivedIds.add(record.clearance_request_id);
        }
      });
    }

    const processedData = clearanceRequests.map((request, index) => {
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

      return {
        id: uniqueId,
        dbId: request.id,
        fullName: personnel
          ? `${personnel.first_name} ${personnel.last_name}`
          : "Unknown Personnel",
        rank: personnel?.rank || "N/A",
        badgeNumber: personnel?.badge_number || "N/A",
        station: personnel?.station || "N/A",
        clearanceType: request.type || "N/A",
        dateRequested: dateRequested,
        status: request.status || "Pending",
        username: personnel?.username || "N/A",
        personnelId: request.personnel_id,
        recordType: "current",
        effectiveDate: request.effective_date,
        completedDate: request.completed_at,
        missingAmount: request.missing_amount || 0,
        hasPendingAccountability: request.has_pending_accountability || false,
        originalRequest: request,
        isArchived: isArchived,
        documentUrl: request.document_url,
        documentPath: request.document_path,
      };
    });

    console.log("Processed current records:", processedData.length);
    setClearanceData(processedData);
    setNoData(processedData.length === 0);
  };

  const loadYearlyClearanceRecords = async () => {
    console.log("=== LOADING YEARLY RECORDS ===");

    const { data: yearlyRecords, error } = await supabase
      .from("clearance_records")
      .select(
        `
        *,
        clearance_requests:clearance_request_id (
          id,
          personnel_id,
          type,
          status
        )
      `
      )
      .eq("year", selectedYear)
      .order("record_generated_date", { ascending: false });

    if (error) {
      console.error("Error loading yearly clearance records:", error);
      toast.error("Failed to load yearly clearance records");
      setNoData(true);
      return;
    }

    console.log("Yearly records fetched:", yearlyRecords?.length || 0);

    const processedData = (yearlyRecords || []).map((record) => {
      const status =
        record.clearance_status ||
        record.status ||
        record.clearance_requests?.status ||
        "UNKNOWN";

      const completedDate = record.clearance_completed_date
        ? new Date(record.clearance_completed_date).toLocaleDateString()
        : "N/A";

      const initiatedDate = record.clearance_initiated_date
        ? new Date(record.clearance_initiated_date).toLocaleDateString()
        : "N/A";

      return {
        id: record.id,
        fullName: record.personnel_name || "Unknown",
        rank: record.rank || "N/A",
        badgeNumber: record.badge_number || "N/A",
        station: record.station || "N/A",
        clearanceType:
          record.clearance_type || record.clearance_requests?.type || "N/A",
        dateRequested: initiatedDate,
        recordDate: record.record_generated_date
          ? new Date(record.record_generated_date).toLocaleDateString()
          : "N/A",
        year: record.year,
        status: status.toUpperCase(),
        source: "Manually Generated",
        personnelId: record.personnel_id,
        clearanceRequestId: record.clearance_request_id,
        recordType: "yearly",
        totalEquipment: record.total_equipment_count || 0,
        clearedEquipment: record.cleared_equipment_count || 0,
        pendingEquipment: record.pending_equipment_count || 0,
        lostEquipment: record.lost_equipment_count || 0,
        damagedEquipment: record.damaged_equipment_count || 0,
        totalValue: record.total_equipment_value || 0,
        outstandingAmount: record.outstanding_amount || 0,
        settledAmount: record.settled_amount || 0,
        completedDate: completedDate,
        generatedBy: record.generated_by || "System",
        autoArchived: false,
        originalRecord: record,
        documentUrl: record.document_url,
        documentPath: record.document_path,
      };
    });

    console.log("Processed yearly records:", processedData);
    setClearanceData(processedData);
    setNoData(processedData.length === 0);
  };

  const loadAvailableYears = async () => {
    try {
      const { data, error } = await supabase
        .from("clearance_records")
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

  // PDF GENERATION FUNCTIONS
  const loadPdfTemplate = async () => {
    try {
      const templatePaths = [
        "/forms/blank-No-Money-and-Property-Accountability-Clearance.pdf",
        "./forms/blank-No-Money-and-Property-Accountability-Clearance.pdf",
        `${window.location.origin}/forms/blank-No-Money-and-Property-Accountability-Clearance.pdf`,
      ];

      let response = null;
      let lastError = null;

      for (const path of templatePaths) {
        try {
          console.log("Trying to load clearance template from:", path);
          response = await fetch(path);
          if (response.ok) {
            console.log("Clearance template loaded successfully from:", path);
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

const fillClearanceForm = async (
  pdfBytes,
  clearanceData,
  isYearly = false,
  generationDate = null
) => {
  try {
    const pdfLib = await import("pdf-lib");
    const { PDFDocument, rgb, StandardFonts } = pdfLib;

    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const textColor = rgb(0, 0, 0);

    const drawText = (text, x, y, size = 12) => {
      if (text && typeof text === "string" && text.trim() !== "") {
        firstPage.drawText(text.trim(), {
          x,
          y,
          size: size,
          font: font,
          color: textColor,
        });
      }
    };

    const formatDate = (dateString) => {
      if (!dateString) return new Date().toLocaleDateString("en-PH");
      try {
        const date = new Date(dateString);
        return date.toLocaleDateString("en-PH", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
      } catch (error) {
        return dateString;
      }
    };

    // ===== FILL THE FORM DATA =====

    // Use the actual generation date if provided, otherwise use current date
    const documentDate = generationDate ? new Date(generationDate) : new Date();
    drawText(formatDate(documentDate), 400, 710, 12);

    // Personnel Information
    const fullName = clearanceData.fullName || "N/A";
    const rank = clearanceData.rank || "N/A";

    // Rank/Name
    drawText(`${rank} ${fullName}`, 240, 110, 12);

    // Designation - Use designation field instead of station
    drawText(
      clearanceData.designation || clearanceData.station || "N/A",
      200,
      620,
      12
    );

    // Station
    drawText(clearanceData.station || "N/A", 200, 600, 12);

    // Purpose (Clearance Type)
    drawText(clearanceData.clearanceType || "Clearance", 200, 580, 12);

    // Additional info for yearly records - REMOVE FINANCIAL SECTIONS
    if (isYearly) {
      drawText(
        `Year: ${clearanceData.year || new Date().getFullYear()}`,
        50,
        500,
        10
      );
      drawText(
        `Record Generated: ${clearanceData.recordDate || "N/A"}`,
        50,
        485,
        10
      );

      // Equipment summary only (no financial)
      drawText(`Equipment Summary:`, 50, 460, 10);
      drawText(`Total: ${clearanceData.totalEquipment || 0}`, 50, 445, 10);
      drawText(`Cleared: ${clearanceData.clearedEquipment || 0}`, 50, 430, 10);
      drawText(`Pending: ${clearanceData.pendingEquipment || 0}`, 50, 415, 10);
      drawText(
        `Lost/Damaged: ${
          (clearanceData.lostEquipment || 0) +
          (clearanceData.damagedEquipment || 0)
        }`,
        50,
        400,
        10
      );

      // REMOVED FINANCIAL SUMMARY SECTION
    }

    // Add processed by and timestamp
    const timestamp = documentDate.toLocaleString();
    drawText(
      `Processed by: ${clearanceData.generatedBy || "System Administrator"}`,
      50,
      50,
      8
    );

    // Stamp the actual generation date
    if (generationDate) {
      const generatedDate = new Date(generationDate);
      drawText(
        `Document Generated on: ${formatDate(generatedDate)}`,
        50,
        35,
        8
      );
    } else {
      drawText(`Generated on: ${timestamp}`, 50, 35, 8);
    }

    // Add document type indicator
    if (isYearly) {
      drawText(`Archived Yearly Record - ${clearanceData.year}`, 200, 30, 8);
    }

    const pdfBytesFilled = await pdfDoc.save();
    console.log("Clearance PDF successfully filled");
    return pdfBytesFilled;
  } catch (error) {
    console.error("Error filling clearance PDF form:", error);
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

  const createPersonnelFolderName = (personnel) => {
    const fullName =
      personnel.fullName
        ?.replace(/[^a-zA-Z0-9\s]/g, "")
        ?.replace(/\s+/g, "_") || "Unknown";
    const rank =
      personnel.rank?.replace(/[^a-zA-Z0-9\s]/g, "")?.replace(/\s+/g, "_") ||
      "N/A";
    const badgeNumber =
      personnel.badgeNumber?.replace(/[^a-zA-Z0-9]/g, "") || "N/A";

    return `${fullName}_${rank}_${badgeNumber}`;
  };

  const generateClearancePDF = async (
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

      const filledPdf = await fillClearanceForm(
        pdfBytes,
        {
          ...record,
          ...personnelData,
          station: record.station || personnelData?.station || "N/A",
        },
        isYearly,
        generationDate
      );

      return filledPdf;
    } catch (error) {
      console.error("Error generating clearance PDF:", error);
      throw error;
    }
  };

  const saveClearanceDocument = async (documentData, isYearly = false) => {
    try {
      const documentToInsert = {
        document_type: "CLEARANCE_FORM",
        document_category: "Clearance Form",
        document_name: documentData.documentName,
        file_url: documentData.fileUrl,
        file_path: documentData.filePath,
        file_type: "application/pdf",
        file_size: documentData.fileSize,
        description: isYearly
          ? "Archived yearly clearance record"
          : "Clearance certificate",
        uploaded_by: documentData.uploadedBy || "System",
        uploaded_at: new Date().toISOString(),
      };

      if (isYearly && documentData.clearanceRecordId) {
        documentToInsert.clearance_record_id = documentData.clearanceRecordId;
      } else if (documentData.clearanceRequestId) {
        documentToInsert.clearance_request_id = documentData.clearanceRequestId;
      }

      const { data, error } = await supabase
        .from("clearance_documents")
        .insert([documentToInsert])
        .select()
        .single();

      if (error) {
        console.error("Error saving clearance document metadata:", error);
        throw error;
      }

      // Update the clearance request or record with document info
      if (isYearly && documentData.clearanceRecordId) {
        await supabase
          .from("clearance_records")
          .update({
            document_url: documentData.fileUrl,
            document_path: documentData.filePath,
            updated_at: new Date().toISOString(),
          })
          .eq("id", documentData.clearanceRecordId);
      } else if (documentData.clearanceRequestId) {
        await supabase
          .from("clearance_requests")
          .update({
            document_url: documentData.fileUrl,
            document_path: documentData.filePath,
            updated_at: new Date().toISOString(),
          })
          .eq("id", documentData.clearanceRequestId);
      }

      const key = isYearly
        ? documentData.clearanceRecordId
        : documentData.clearanceRequestId;
      if (key) {
        setExistingPdfs((prev) => ({
          ...prev,
          [key]: [...(prev[key] || []), data],
        }));
      }

      return data;
    } catch (error) {
      console.error("Error in saveClearanceDocument:", error);
      throw error;
    }
  };

  const checkExistingPdfMetadata = async (record) => {
    try {
      if (record.recordType === "current") {
        // Check clearance_documents table
        const { data: documents, error } = await supabase
          .from("clearance_documents")
          .select("uploaded_at, file_path")
          .eq("clearance_request_id", record.dbId)
          .eq("document_type", "CLEARANCE_FORM")
          .order("uploaded_at", { ascending: false })
          .limit(1);

        if (!error && documents && documents.length > 0) {
          return {
            hasExisting: true,
            uploadedAt: documents[0].uploaded_at,
            filePath: documents[0].file_path,
          };
        }

        // Check clearance_requests table as fallback
        const { data: requestData } = await supabase
          .from("clearance_requests")
          .select("document_url, updated_at")
          .eq("id", record.dbId)
          .single();

        if (requestData?.document_url) {
          return {
            hasExisting: true,
            uploadedAt: requestData.updated_at,
            documentUrl: requestData.document_url,
          };
        }
      } else if (record.recordType === "yearly") {
        // Check clearance_documents table for yearly records
        const { data: documents, error } = await supabase
          .from("clearance_documents")
          .select("uploaded_at, file_path")
          .eq("clearance_record_id", record.id)
          .eq("document_type", "CLEARANCE_FORM")
          .order("uploaded_at", { ascending: false })
          .limit(1);

        if (!error && documents && documents.length > 0) {
          return {
            hasExisting: true,
            uploadedAt: documents[0].uploaded_at,
            filePath: documents[0].file_path,
          };
        }

        // Check clearance_records table as fallback
        const { data: recordData } = await supabase
          .from("clearance_records")
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
      }

      return { hasExisting: false };
    } catch (error) {
      console.error("Error checking PDF metadata:", error);
      return { hasExisting: false };
    }
  };

  const generateAndUploadClearanceForm = async (record) => {
    const isYearly = record.recordType === "yearly";

    const validStatus = isYearly
      ? record.status?.toUpperCase() === "CLEARED" ||
        record.status?.toUpperCase() === "COMPLETED"
      : record.status?.toLowerCase() === "completed";

    if (!validStatus) {
      toast.info(
        isYearly
          ? "PDF form is only available for CLEARED yearly records"
          : "PDF form is only available for completed clearance requests",
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

      // Use existing uploaded date if available, otherwise use current date
      const generationDate =
        existingPdfMetadata.uploadedAt || new Date().toISOString();
      const filledPdfBytes = await generateClearancePDF(
        record,
        isYearly,
        generationDate
      );

      const employeeName = record.fullName
        .replace(/[^a-zA-Z0-9\s]/g, "")
        .replace(/\s+/g, "_");
      const clearanceType = record.clearanceType.replace(/\s+/g, "_");

      // Create filename with timestamp from actual generation date
      const generationTimestamp = new Date(generationDate).getTime();
      const datePart = isYearly
        ? record.year || new Date().getFullYear()
        : new Date(generationDate).toISOString().split("T")[0];

      const fileName = `${employeeName}_${clearanceType}_${
        isYearly ? "Yearly_" : ""
      }Clearance_${datePart}_${generationTimestamp}.pdf`;

      const folderName = createPersonnelFolderName(record);

      const storagePath = isYearly
        ? `yearly-records/${record.year}/${folderName}/${generationTimestamp}_${fileName}`
        : `current-requests/${folderName}/${generationTimestamp}_${fileName}`;

      setPdfDownloadProgress(80);

      // Download locally
      downloadPdf(filledPdfBytes, fileName);

      setPdfDownloadProgress(85);

      try {
        const pdfFile = new File([filledPdfBytes], fileName, {
          type: "application/pdf",
        });

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("clearance-documents")
          .upload(storagePath, pdfFile, {
            cacheControl: "3600",
            upsert: true,
            contentType: "application/pdf",
          });

        if (uploadError) {
          console.error("Storage upload error:", uploadError);

          if (
            uploadError.message.includes("bucket") &&
            uploadError.message.includes("not found")
          ) {
            const { error: createBucketError } =
              await supabase.storage.createBucket("clearance-documents", {
                public: true,
                allowedMimeTypes: ["application/pdf"],
              });

            if (createBucketError) {
              throw createBucketError;
            }

            const { error: retryError } = await supabase.storage
              .from("clearance-documents")
              .upload(storagePath, pdfFile, {
                cacheControl: "3600",
                upsert: true,
                contentType: "application/pdf",
              });

            if (retryError) throw retryError;
          } else {
            throw uploadError;
          }
        }

        const { data: urlData } = supabase.storage
          .from("clearance-documents")
          .getPublicUrl(storagePath);

        const publicUrl = urlData?.publicUrl;

        await saveClearanceDocument(
          {
            clearanceRequestId: isYearly ? null : record.dbId,
            clearanceRecordId: isYearly ? record.id : null,
            documentName: fileName,
            fileUrl: publicUrl,
            filePath: storagePath,
            fileSize: pdfFile.size,
            uploadedBy: record.generatedBy || "System",
          },
          isYearly
        );

        setPdfDownloadProgress(100);

        toast.success(
          `PDF ${isYearly ? "yearly record " : ""}generated successfully!`,
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
      console.error("Error generating clearance form:", error);
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
      const clearanceType = record.clearanceType.replace(/\s+/g, "_");
      const datePart =
        record.recordType === "yearly"
          ? record.year || new Date().getFullYear()
          : new Date().toISOString().split("T")[0];

      const fileName = `${employeeName}_${clearanceType}_${
        record.recordType === "yearly" ? "Yearly_" : ""
      }Clearance_${datePart}.pdf`;

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
        ? record.status?.toUpperCase() === "CLEARED" ||
          record.status?.toUpperCase() === "COMPLETED"
        : record.status?.toLowerCase() === "completed";

    if (!isPdfAvailable) {
      return (
        <button
          className={styles.CRSpdfBtn}
          disabled
          title={
            record.recordType === "yearly"
              ? "PDF only available for CLEARED yearly records"
              : "PDF only available for completed clearances"
          }
        >
          📄 PDF
        </button>
      );
    }

    if (hasExistingPdf) {
      return (
        <button
          className={styles.CRSpdfBtn}
          onClick={() =>
            downloadExistingPdf(existingPdfsForRecord[0].file_url, record)
          }
          title={`Download existing PDF (Generated: ${new Date(
            existingPdfsForRecord[0].uploaded_at
          ).toLocaleDateString()})`}
        >
          📥 PDF
        </button>
      );
    } else {
      return (
        <button
          className={styles.CRSpdfBtn}
          onClick={() => generateAndUploadClearanceForm(record)}
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

const generateYearlyClearanceRecord = async () => {
  const year = prompt(
    "Enter year for clearance record generation:",
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
      "generate_yearly_clearance_records",
      {
        target_year: parseInt(year),
      }
    );

    if (error) {
      console.error("Error generating yearly records:", error);
      toast.error(`Failed to generate yearly records: ${error.message}`);
    } else {
      toast.success(`Generated ${data} yearly clearance records for ${year}`);
      loadAvailableYears();
      setViewMode("yearly");
      setSelectedYear(parseInt(year));
      loadClearanceData();
    }
  } catch (err) {
    console.error("Error in generateYearlyClearanceRecord:", err);
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
    } else if (currentFilterCard === "completed") {
      filtered = filtered.filter((i) => i.status.toLowerCase() === "completed");
    } else if (currentFilterCard === "rejected") {
      filtered = filtered.filter((i) => i.status.toLowerCase() === "rejected");
    }

    const s = search.trim().toLowerCase();
    const statusFilter = filterStatus.trim().toLowerCase();
    const typeFilter = filterClearanceType.trim().toLowerCase();

    filtered = filtered.filter((i) => {
      const text =
        `${i.fullName} ${i.rank} ${i.dateRequested} ${i.clearanceType} ${i.status}`.toLowerCase();
      const statusMatch =
        !statusFilter || (i.status || "").toLowerCase().includes(statusFilter);
      const typeMatch =
        !typeFilter ||
        (i.clearanceType || "").toLowerCase().includes(typeFilter);
      const searchMatch = !s || text.includes(s);
      return statusMatch && typeMatch && searchMatch;
    });

    return filtered;
  }

  const filteredClearanceData = applyFilters(clearanceData);
  const totalPages = Math.max(
    1,
    Math.ceil(filteredClearanceData.length / rowsPerPage)
  );
  const pageStart = (currentPage - 1) * rowsPerPage;
  const paginated = filteredClearanceData.slice(
    pageStart,
    pageStart + rowsPerPage
  );

  const renderPaginationButtons = () => {
    const pageCount = Math.max(
      1,
      Math.ceil(filteredClearanceData.length / rowsPerPage)
    );
    const hasNoData = filteredClearanceData.length === 0;

    const buttons = [];

    buttons.push(
      <button
        key="prev"
        className={`${styles.CRSpaginationBtn} ${
          hasNoData ? styles.CRSdisabled : ""
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
        className={`${styles.CRSpaginationBtn} ${
          1 === currentPage ? styles.CRSactive : ""
        } ${hasNoData ? styles.CRSdisabled : ""}`}
        onClick={() => setCurrentPage(1)}
        disabled={hasNoData}
      >
        1
      </button>
    );

    if (currentPage > 3) {
      buttons.push(
        <span key="ellipsis1" className={styles.CRSpaginationEllipsis}>
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
            className={`${styles.CRSpaginationBtn} ${
              i === currentPage ? styles.CRSactive : ""
            } ${hasNoData ? styles.CRSdisabled : ""}`}
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
        <span key="ellipsis2" className={styles.CRSpaginationEllipsis}>
          ...
        </span>
      );
    }

    if (pageCount > 1) {
      buttons.push(
        <button
          key={pageCount}
          className={`${styles.CRSpaginationBtn} ${
            pageCount === currentPage ? styles.CRSactive : ""
          } ${hasNoData ? styles.CRSdisabled : ""}`}
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
        className={`${styles.CRSpaginationBtn} ${
          hasNoData ? styles.CRSdisabled : ""
        }`}
        disabled={currentPage === pageCount || hasNoData}
        onClick={() => setCurrentPage(Math.min(pageCount, currentPage + 1))}
      >
        Next
      </button>
    );

    return buttons;
  };

  const totalItems = clearanceData.length;
  const pendingItems = clearanceData.filter(
    (i) => i.status.toLowerCase() === "pending"
  ).length;
  const completedItems = clearanceData.filter(
    (i) => i.status.toLowerCase() === "completed"
  ).length;
  const rejectedItems = clearanceData.filter(
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

  if (!year || isNaN(year) || year < 2000 || year > new Date().getFullYear()) {
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
    const { data: checkData, error: checkError } = await supabase
      .from("clearance_requests")
      .select("id, status")
      .or(`created_at.gte.${year}-01-01,created_at.lte.${year}-12-31`)
      .in("status", ["Completed", "Rejected", "Cancelled"])
      .limit(1);

    if (checkError) {
      throw checkError;
    }

    if (!checkData || checkData.length === 0) {
      toast.info(
        `No completed/rejected/cancelled clearance requests found for year ${year}`
      );
      setGeneratingYearlyRecord(false);
      return;
    }

    const { data: pendingData } = await supabase
      .from("clearance_requests")
      .select("id, status")
      .or(`created_at.gte.${year}-01-01,created_at.lte.${year}-12-31`)
      .eq("status", "Pending");

    if (pendingData && pendingData.length > 0) {
      toast.info(
        `${pendingData.length} PENDING clearances will remain in Clearance System`
      );
    }

    const { data, error } = await supabase.rpc(
      "archive_all_clearance_records",
      {
        target_year: parseInt(year),
      }
    );

    if (error) {
      console.error("Error manual archiving:", error);
      toast.error(`Failed: ${error.message}`);
    } else {
      toast.success(`Successfully archived ${data} records for ${year}`);
      loadAvailableYears();
      setViewMode("yearly");
      setSelectedYear(parseInt(year));
      setTimeout(() => {
        loadClearanceData();
      }, 1000);
    }
  } catch (err) {
    console.error("Manual archive error:", err);
    toast.error("Manual archive failed");
  } finally {
    setTimeout(() => {
      setGeneratingYearlyRecord(false);
    }, 1000);
  }
};

  const manuallyArchiveSingleClearance = async (clearanceId, clearanceData) => {
    setArchivingRecordId(clearanceId);

    try {
      const { data: clearance, error } = await supabase
        .from("clearance_requests")
        .select("*")
        .eq("id", clearanceId)
        .single();

      if (error) throw error;

      const { data: existingArchive } = await supabase
        .from("clearance_records")
        .select("id")
        .eq("clearance_request_id", clearanceId)
        .single();

      if (existingArchive) {
        toast.info("This clearance is already archived");
        setArchivingRecordId(null);
        return;
      }

      if (
        clearance.status === "Pending" ||
        clearance.status === "In Progress"
      ) {
        toast.warning("Only Completed or Rejected clearances can be archived");
        setArchivingRecordId(null);
        return;
      }

      const { data: personnel } = await supabase
        .from("personnel")
        .select("first_name, last_name, rank, badge_number, station")
        .eq("id", clearance.personnel_id)
        .single();

      const year = clearance.completed_at
        ? new Date(clearance.completed_at).getFullYear()
        : new Date(clearance.created_at).getFullYear();

      let clearanceStatus;
      switch (clearance.status.toUpperCase()) {
        case "COMPLETED":
          clearanceStatus = "CLEARED";
          break;
        case "REJECTED":
          clearanceStatus = "REJECTED";
          break;
        case "CANCELLED":
          clearanceStatus = "CANCELLED";
          break;
        default:
          clearanceStatus = "PENDING";
      }

      const { error: insertError } = await supabase
        .from("clearance_records")
        .insert({
          year: year,
          personnel_id: clearance.personnel_id,
          personnel_name: `${personnel.first_name} ${personnel.last_name}`,
          rank: personnel.rank,
          badge_number: personnel.badge_number,
          station: personnel.station,
          clearance_status: clearanceStatus,
          clearance_type: clearance.type,
          clearance_request_id: clearance.id,
          clearance_initiated_date: clearance.created_at,
          clearance_completed_date: clearance.completed_at,
          record_generated_date: new Date().toISOString().split("T")[0],
          generated_by: "Manual Archive",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error("Archive insert error:", insertError);
        throw insertError;
      }

      toast.success("✅ Clearance archived successfully!");
      loadClearanceData();
    } catch (err) {
      console.error("Error archiving single clearance:", err);
      toast.error(`Failed to archive: ${err.message}`);
    } finally {
      setArchivingRecordId(null);
    }
  };

  const deleteClearanceRequest = async (clearanceId, record) => {
    console.log("Delete clicked for:", clearanceId, record);
    try {
      const { canDelete, reason } = await canDeleteClearance(
        clearanceId,
        record
      );
      console.log("Can delete?", canDelete, reason);

      if (!canDelete) {
        setDeleteId(clearanceId);
        setDeleteRecord(record);
        setIsDeleteOpen(true);
        setDeleteReason(reason);
        return;
      }

      setDeleteId(clearanceId);
      setDeleteRecord(record);
      setIsDeleteOpen(true);
      setDeleteReason("");
    } catch (error) {
      console.error("Error in deleteClearanceRequest:", error);
      toast.error("Error checking deletion eligibility");
    }
  };

  const checkIfArchived = async (clearanceId) => {
    try {
      const { data, error } = await supabase
        .from("clearance_records")
        .select("id")
        .eq("clearance_request_id", clearanceId);

      if (error) {
        console.error("Error checking archive status:", error);
        // Return false as default if there's an error
        return false;
      }

      // Check if any records exist
      return data && data.length > 0;
    } catch (err) {
      console.error("Error in checkIfArchived:", err);
      return false;
    }
  };

  const getStatusClass = (status) => {
    const statusMap = {
      pending: styles.CRSpending,
      completed: styles.CRScompleted,
      rejected: styles.CRSrejected,
      "in progress": styles.CRSpending,
      cancelled: styles.CRSrejected,
      cleared: styles.CRScompleted,
      with_accountability: styles.CRSpending,
      partial: styles.CRSpending,
    };
    return statusMap[status.toLowerCase()] || styles.CRSpending;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(amount || 0);
  };

  const handleManageClick = (record) => {
    if (record.recordType === "current" && record.dbId) {
      const manageUrl = `/clearanceSystem?requestId=${encodeURIComponent(
        record.dbId
      )}&username=${encodeURIComponent(
        record.username
      )}&type=${encodeURIComponent(record.clearanceType)}`;
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

  // NEW: Bulk delete functions
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
    if (selectedRecords.length === filteredClearanceData.length) {
      // Deselect all filtered
      setSelectedRecords([]);
    } else {
      // Select all filtered
      const filteredIds = filteredClearanceData.map((record) => record.id);
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
        /\/storage\/v1\/object\/public\/clearance-documents\/(.+)/
      );
      if (pathMatch) {
        storagePath = decodeURIComponent(pathMatch[1]);
      }
    }

    // If we have a storage path, delete it
    if (storagePath) {
      console.log(`Attempting to delete PDF from storage: ${storagePath}`);

      const { error } = await supabase.storage
        .from("clearance-documents")
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
        .from("clearance_documents")
        .select("file_path")
        .eq("clearance_request_id", record.dbId)
        .eq("document_type", "CLEARANCE_FORM");

      if (!error && data) {
        relatedDocs = data;
      }
    } else if (record.recordType === "yearly") {
      const { data, error } = await supabase
        .from("clearance_documents")
        .select("file_path")
        .eq("clearance_record_id", record.id)
        .eq("document_type", "CLEARANCE_FORM");

      if (!error && data) {
        relatedDocs = data;
      }
    }

    // Delete any related documents from storage
    for (const doc of relatedDocs) {
      if (doc.file_path) {
        try {
          const { error: storageError } = await supabase.storage
            .from("clearance-documents")
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
const performBulkDelete = async () => {
  setGeneratingYearlyRecord(true); // Reuse loading state
  let successCount = 0;
  let failCount = 0;

  try {
    for (const recordId of selectedRecords) {
      try {
        const record = clearanceData.find((r) => r.id === recordId);
        if (!record) continue;

        // Delete PDFs from storage first
        await deletePdfFromStorage(record);

        if (record.recordType === "yearly") {
          // Delete yearly record
          const { error } = await supabase
            .from("clearance_records")
            .delete()
            .eq("id", recordId);

          if (error) throw error;

          // Also delete related documents from database
          const { error: docError } = await supabase
            .from("clearance_documents")
            .delete()
            .eq("clearance_record_id", recordId);

          if (docError)
            console.warn("Error deleting related documents:", docError);

          successCount++;
        } else if (record.recordType === "current") {
          // Delete current request using existing cascade function
          await deleteClearanceCascade(record.dbId, record);
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
      await loadClearanceData();
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
          <th>Full Name</th>
          <th>Rank</th>
          <th>Badge No.</th>
          <th>Station</th>
          <th>Date</th>
          <th>Clearance Type</th>
          <th>Status</th>
          <th>Archive Status</th>
          <th>Actions</th>
        </tr>
      );
    }

    return (
      <tr>
        <th>Full Name</th>
        <th>Rank</th>
        <th>Badge No.</th>
        <th>Station</th>
        <th>Date</th>
        <th>Clearance Type</th>
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
            {viewMode === "current" ? record.dateRequested : record.recordDate}
          </td>
          <td>{record.clearanceType}</td>
          <td>
            <span
              className={`${styles.CRSstatus} ${getStatusClass(record.status)}`}
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
            <div className={styles.CRSactionButtons}>
              <button
                className={styles.CRSviewBtndetails}
                onClick={() => handleViewDetails(record)}
                title="View Details"
              >
                👁️ View
              </button>

              {/* PDF Button */}
              {getPdfButton(record)}

              {/* Delete button for individual deletion */}
              <button
                className={styles.CRSdeleteBtn}
                onClick={() => deleteClearanceRequest(record.id, record)}
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
          {viewMode === "current" ? record.dateRequested : record.recordDate}
        </td>
        <td>{record.clearanceType}</td>
        <td>
          <span
            className={`${styles.CRSstatus} ${getStatusClass(record.status)}`}
          >
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
          <div className={styles.CRSactionButtons}>
            <button
              className={styles.CRSviewBtndetails}
              onClick={() => handleViewDetails(record)}
              title="View Details"
            >
              👁️ View
            </button>

            {/* PDF Button */}
            {getPdfButton(record)}

            {record.recordType === "current" ? (
              <>
                {/* Archive Button - Only for Completed/Rejected clearances */}
                {!record.isArchived &&
                  (record.status === "Completed" ||
                    record.status === "Rejected" ||
                    record.status === "Cancelled") && (
                    <button
                      className={styles.CRSarchiveBtn}
                      onClick={() =>
                        manuallyArchiveSingleClearance(record.dbId, record)
                      }
                      disabled={archivingRecordId === record.dbId}
                      title="Archive to yearly records"
                    >
                      {archivingRecordId === record.dbId ? (
                        <>⏳ Archiving...</>
                      ) : (
                        <>📦 Archive</>
                      )}
                    </button>
                  )}

                {/* Delete Button - Only for Completed/Rejected/Cancelled clearances */}
                {(record.status === "Completed" ||
                  record.status === "Rejected" ||
                  record.status === "Cancelled") && (
                  <button
                    className={styles.CRSdeleteBtn}
                    onClick={() => deleteClearanceRequest(record.dbId, record)}
                    disabled={deletingRecordId === record.dbId}
                    title="Delete clearance request"
                  >
                    {deletingRecordId === record.dbId ? (
                      <>⏳ Deleting...</>
                    ) : (
                      <>🗑️ Delete</>
                    )}
                  </button>
                )}

                {/* Manage Button - Only for Pending/In Progress */}
                {(record.status === "Pending" ||
                  record.status === "In Progress") && (
                  <button
                    className={styles.CRSmanageBtn}
                    onClick={() => handleManageClick(record)}
                    title="Manage clearance"
                  >
                    ⚙️ Manage
                  </button>
                )}
              </>
            ) : (
              // Add delete button for yearly records
              <button
                className={styles.CRSdeleteBtn}
                onClick={() => deleteClearanceRequest(record.id, record)}
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
    if (viewMode !== "yearly" || filteredClearanceData.length === 0)
      return null;

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
            {filteredClearanceData.length > 10 && (
              <span className={styles.recordCountWarning}>
                ({filteredClearanceData.length} records - consider using bulk
                delete)
              </span>
            )}
          </>
        ) : (
          <div className={styles.bulkDeleteActive}>
            <div className={styles.bulkSelectionInfo}>
              <span className={styles.selectedCount}>
                {selectedRecords.length} of {filteredClearanceData.length}{" "}
                selected
              </span>
              <button
                className={styles.selectAllBtn}
                onClick={toggleSelectAllFiltered}
              >
                {selectedRecords.length === filteredClearanceData.length
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
    .map((id) => clearanceData.find((r) => r.id === id))
    .filter((r) => r?.recordType === "yearly");

  const selectedCurrentRecords = selectedRecords
    .map((id) => clearanceData.find((r) => r.id === id))
    .filter((r) => r?.recordType === "current");

  // Count records with PDFs
  const recordsWithPdfs = selectedRecords
    .map((id) => clearanceData.find((r) => r.id === id))
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
            Are you sure you want to delete {selectedRecords.length} record(s)?
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
                  PDF files will be deleted from the clearance-documents storage
                  bucket.
                </p>
              </div>
            )}

            {selectedYearlyRecords.length > 0 && (
              <div className={styles.yearlyRecordsList}>
                <p>
                  <strong>Yearly Records (will be permanently deleted):</strong>
                </p>
                <ul>
                  {selectedYearlyRecords.slice(0, 5).map((record) => (
                    <li key={record.id}>
                      {record.fullName} - {record.year} - {record.clearanceType}
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

  const renderPdfProgressOverlay = () => {
    if (!generatingPdf) return null;

    return (
      <div className={styles.pdfProgressOverlay}>
        <div className={styles.pdfProgressModal}>
          <h3>Generating Clearance Form PDF</h3>
          <div className={styles.pdfProgressBar}>
            <div
              className={styles.pdfProgressFill}
              style={{ width: `${pdfDownloadProgress}%` }}
            ></div>
          </div>
          <p>{pdfDownloadProgress}% Complete</p>
          <p className={styles.pdfProgressNote}>
            Please wait while we generate your clearance form...
          </p>
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
            <h2>Clearance Record Details</h2>
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
              </div>
            </div>

            {/* Clearance Information Section */}
            <div className={styles.modalSection}>
              <h3 className={styles.modalSectionTitle}>
                Clearance Information
              </h3>
              <div className={styles.modalDetailsGrid}>
                <div className={styles.modalDetailItem}>
                  <span className={styles.modalLabel}>Clearance Type:</span>
                  <span className={styles.modalValue}>
                    {record.clearanceType}
                  </span>
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
                    {isYearly ? record.recordDate : record.dateRequested}
                  </span>
                </div>
                {!isYearly && record.effectiveDate && (
                  <div className={styles.modalDetailItem}>
                    <span className={styles.modalLabel}>Effective Date:</span>
                    <span className={styles.modalValue}>
                      {record.effectiveDate}
                    </span>
                  </div>
                )}
                {isYearly && record.year && (
                  <div className={styles.modalDetailItem}>
                    <span className={styles.modalLabel}>Year:</span>
                    <span className={styles.modalValue}>{record.year}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Additional Details based on Record Type */}
            {isYearly ? (
              <>
                {/* Equipment Summary for Yearly Records */}
                <div className={styles.modalSection}>
                  <h3 className={styles.modalSectionTitle}>
                    Equipment Summary
                  </h3>
                  <div className={styles.modalDetailsGrid}>
                    <div className={styles.modalDetailItem}>
                      <span className={styles.modalLabel}>
                        Total Equipment:
                      </span>
                      <span className={styles.modalValue}>
                        {record.totalEquipment || 0}
                      </span>
                    </div>
                    <div className={styles.modalDetailItem}>
                      <span className={styles.modalLabel}>Cleared:</span>
                      <span className={styles.modalValue}>
                        {record.clearedEquipment || 0}
                      </span>
                    </div>
                    <div className={styles.modalDetailItem}>
                      <span className={styles.modalLabel}>Pending:</span>
                      <span className={styles.modalValue}>
                        {record.pendingEquipment || 0}
                      </span>
                    </div>
                    <div className={styles.modalDetailItem}>
                      <span className={styles.modalLabel}>Lost:</span>
                      <span className={styles.modalValue}>
                        {record.lostEquipment || 0}
                      </span>
                    </div>
                    <div className={styles.modalDetailItem}>
                      <span className={styles.modalLabel}>Damaged:</span>
                      <span className={styles.modalValue}>
                        {record.damagedEquipment || 0}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Financial Summary for Yearly Records */}
                <div className={styles.modalSection}>
                  <h3 className={styles.modalSectionTitle}>
                    Financial Summary
                  </h3>
                  <div className={styles.modalDetailsGrid}>
                    <div className={styles.modalDetailItem}>
                      <span className={styles.modalLabel}>Total Value:</span>
                      <span className={styles.modalValue}>
                        {formatCurrency(record.totalValue)}
                      </span>
                    </div>
                    <div className={styles.modalDetailItem}>
                      <span className={styles.modalLabel}>Outstanding:</span>
                      <span className={styles.modalValue}>
                        {formatCurrency(record.outstandingAmount)}
                      </span>
                    </div>
                    <div className={styles.modalDetailItem}>
                      <span className={styles.modalLabel}>Settled:</span>
                      <span className={styles.modalValue}>
                        {formatCurrency(record.settledAmount)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Record Information */}
                <div className={styles.modalSection}>
                  <h3 className={styles.modalSectionTitle}>
                    Record Information
                  </h3>
                  <div className={styles.modalDetailsGrid}>
                    <div className={styles.modalDetailItem}>
                      <span className={styles.modalLabel}>Generated By:</span>
                      <span className={styles.modalValue}>
                        {record.generatedBy || "System"}
                      </span>
                    </div>
                    <div className={styles.modalDetailItem}>
                      <span className={styles.modalLabel}>Completed Date:</span>
                      <span className={styles.modalValue}>
                        {record.completedDate || "N/A"}
                      </span>
                    </div>
                    {record.source && (
                      <div className={styles.modalDetailItem}>
                        <span className={styles.modalLabel}>Source:</span>
                        <span className={styles.modalValue}>
                          {record.source}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className={styles.modalSection}>
                  <h3 className={styles.modalSectionTitle}>Request Details</h3>
                  <div className={styles.modalDetailsGrid}>
                    <div className={styles.modalDetailItem}>
                      <span className={styles.modalLabel}>Missing Amount:</span>
                      <span className={styles.modalValue}>
                        {formatCurrency(record.missingAmount)}
                      </span>
                    </div>
                    <div className={styles.modalDetailItem}>
                      <span className={styles.modalLabel}>
                        Pending Accountability:
                      </span>
                      <span className={styles.modalValue}>
                        {record.hasPendingAccountability ? "Yes" : "No"}
                      </span>
                    </div>
                    <div className={styles.modalDetailItem}>
                      <span className={styles.modalLabel}>Archive Status:</span>
                      <span className={styles.modalValue}>
                        {record.isArchived ? "✅ Archived" : "📝 Not Archived"}
                      </span>
                    </div>
                    <div className={styles.modalDetailItem}>
                      <span className={styles.modalLabel}>Username:</span>
                      <span className={styles.modalValue}>
                        {record.username}
                      </span>
                    </div>
                  </div>
                </div>
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
            {record.status?.toLowerCase() === "completed" && (
              <button
                className={styles.modalPdfButton}
                onClick={() => {
                  setShowDetailsModal(false);
                  generateAndUploadClearanceForm(record);
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

  function confirmDelete(clearanceId, record) {
    // Check eligibility first with detailed clearance info
    canDeleteClearance(clearanceId, record).then(({ canDelete, reason }) => {
      if (!canDelete) {
        // Show detailed information in the modal
        setDeleteId(clearanceId);
        setDeleteRecord(record);
        setIsDeleteOpen(true);

        // Set a state for the reason to show in modal
        setDeleteReason(reason);
        return;
      }

      setDeleteId(clearanceId);
      setDeleteRecord(record);
      setIsDeleteOpen(true);
      setDeleteReason(""); // Clear any previous reason
    });
  }

  function cancelDelete() {
    setDeleteId(null);
    setDeleteRecord(null);
    setIsDeleteOpen(false);
    setDeleteReason(""); // <-- ADD THIS LINE
  }

async function performDelete() {
  if (!deleteId || !deleteRecord) return;

  try {
    // Check accountability status first
    const { data: accountabilityData, error: accountabilityError } =
      await supabase
        .from("accountability_records")
        .select("id, is_settled")
        .eq("clearance_request_id", deleteId)
        .eq("is_settled", false)
        .limit(1);

    if (accountabilityError) throw accountabilityError;

    // Check if there are unsettled accountability records
    if (accountabilityData && accountabilityData.length > 0) {
      // Check personnel_equipment_accountability_table for settlement status
      const { data: equipmentAccountability, error: equipmentError } =
        await supabase
          .from("personnel_equipment_accountability_table")
          .select("accountability_status")
          .eq("clearance_request_id", deleteId)
          .single();

      if (!equipmentError && equipmentAccountability) {
        if (equipmentAccountability.accountability_status !== "SETTLED") {
          toast.error(
            "Cannot delete: Equipment accountability is not settled."
          );
          cancelDelete();
          return;
        }
      } else {
        toast.error("Cannot delete: Unsettled accountability records exist.");
        cancelDelete();
        return;
      }
    }

    // Delete PDFs from storage first
    await deletePdfFromStorage(deleteRecord);

    // Proceed with deletion
    let success = false;

    if (deleteRecord.recordType === "current") {
      // First, check if there's a related record in clearance_records
      const { data: archivedRecord, error: archiveCheckError } = await supabase
        .from("clearance_records")
        .select("id, document_path, document_url")
        .eq("clearance_request_id", deleteId)
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
          .from("clearance_records")
          .delete()
          .eq("id", archivedRecord.id);

        if (deleteArchiveError) {
          console.error("Error deleting archived record:", deleteArchiveError);
          // Continue with deletion of clearance request anyway
        } else {
          console.log("Deleted archived record:", archivedRecord.id);
        }
      }

      // Delete from clearance_requests
      const { error } = await supabase
        .from("clearance_requests")
        .delete()
        .eq("id", deleteId);

      if (error) throw error;
      success = true;
    } else if (deleteRecord.recordType === "yearly") {
      // For yearly records, just delete from clearance_records
      const { error } = await supabase
        .from("clearance_records")
        .delete()
        .eq("id", deleteId);

      if (error) throw error;
      success = true;
    }

    if (success) {
      await loadClearanceData();
      cancelDelete();
      setDeleteReason("");
      toast.success(
        "Clearance record and associated PDFs deleted successfully!"
      );
    }
  } catch (err) {
    console.error("Delete error:", err);

    // Provide more specific error messages
    if (err.message.includes("accountability")) {
      toast.error(
        "Cannot delete: Accountability records must be settled first."
      );
    } else if (err.message.includes("foreign key")) {
      // If it's a foreign key error, it might be related to other tables
      // Try a more comprehensive deletion approach
      try {
        await deleteClearanceCascade(deleteId, deleteRecord);
        await loadClearanceData();
        cancelDelete();
        setDeleteReason("");
        toast.success(
          "Clearance record and related data deleted successfully!"
        );
      } catch (cascadeError) {
        console.error("Cascade delete error:", cascadeError);
        toast.error(
          "Cannot delete: Related records exist. Please check all associated records first."
        );
      }
    } else {
      toast.error("Error deleting record: " + err.message);
    }

    setDeleteReason("");
  }
}

 const deleteClearanceCascade = async (clearanceId, record) => {
   try {
     // 0. First, delete PDFs from storage
     await deletePdfFromStorage(record);

     // 1. Delete any accountability records
     const { error: accountabilityError } = await supabase
       .from("accountability_records")
       .delete()
       .eq("clearance_request_id", clearanceId);

     if (
       accountabilityError &&
       !accountabilityError.message.includes("No rows")
     ) {
       console.warn(
         "Error deleting accountability records:",
         accountabilityError
       );
     }

     // 2. Delete from personnel_equipment_accountability_table
     const { error: equipmentError } = await supabase
       .from("personnel_equipment_accountability_table")
       .delete()
       .eq("clearance_request_id", clearanceId);

     if (equipmentError && !equipmentError.message.includes("No rows")) {
       console.warn("Error deleting equipment accountability:", equipmentError);
     }

     // 3. Delete clearance documents (database records)
     const { error: documentsError } = await supabase
       .from("clearance_documents")
       .delete()
       .eq(
         record.recordType === "current"
           ? "clearance_request_id"
           : "clearance_record_id",
         clearanceId
       );

     if (documentsError && !documentsError.message.includes("No rows")) {
       console.warn("Error deleting clearance documents:", documentsError);
     }

     // 4. Delete clearance_inventory records
     const { error: inventoryError } = await supabase
       .from("clearance_inventory")
       .delete()
       .eq("clearance_request_id", clearanceId);

     if (inventoryError && !inventoryError.message.includes("No rows")) {
       console.warn("Error deleting clearance inventory:", inventoryError);
     }

     // 5. Check and delete from clearance_records if exists
     if (record.recordType === "current") {
       const { data: archivedRecord } = await supabase
         .from("clearance_records")
         .select("id, document_path, document_url")
         .eq("clearance_request_id", clearanceId)
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
           .from("clearance_records")
           .delete()
           .eq("id", archivedRecord.id);

         if (archiveError) {
           console.warn("Error deleting archived record:", archiveError);
         }
       }
     }

     // 6. Finally delete the main record
     if (record.recordType === "current") {
       const { error: mainError } = await supabase
         .from("clearance_requests")
         .delete()
         .eq("id", clearanceId);

       if (mainError) throw mainError;
     } else {
       const { error: mainError } = await supabase
         .from("clearance_records")
         .delete()
         .eq("id", clearanceId);

       if (mainError) throw mainError;
     }

     return true;
   } catch (error) {
     console.error("Error in cascade delete:", error);
     throw error;
   }
 };

const canDeleteClearance = async (clearanceId, clearanceData) => {
  try {
    const clearanceType = clearanceData?.clearanceType?.toLowerCase() || "";
    const clearanceStatus = clearanceData?.status?.toLowerCase() || "";

    // Define which clearance types typically have accountability
    const accountabilityTypes = [
      "equipment completion",
      "retirement",
      "resignation",
      "transfer",
    ];

    // Define which clearance types typically DON'T have accountability
    const nonAccountabilityTypes = [
      "promotion",
      "administrative",
      "others",
      "general",
    ];

    const isAccountabilityType = accountabilityTypes.some((type) =>
      clearanceType.includes(type)
    );

    const isNonAccountabilityType = nonAccountabilityTypes.some((type) =>
      clearanceType.includes(type)
    );

    const isRejected =
      clearanceStatus === "rejected" || clearanceStatus === "cancelled";

    // Check if there are PDFs that will be deleted
    let hasPdfs = false;
    if (clearanceData.documentUrl || clearanceData.documentPath) {
      hasPdfs = true;
    } else {
      // Check clearance_documents table
      let pdfCheck;
      if (clearanceData.recordType === "current") {
        pdfCheck = await supabase
          .from("clearance_documents")
          .select("id")
          .eq("clearance_request_id", clearanceData.dbId || clearanceId)
          .eq("document_type", "CLEARANCE_FORM")
          .limit(1);
      } else {
        pdfCheck = await supabase
          .from("clearance_documents")
          .select("id")
          .eq("clearance_record_id", clearanceId)
          .eq("document_type", "CLEARANCE_FORM")
          .limit(1);
      }

      if (!pdfCheck.error && pdfCheck.data && pdfCheck.data.length > 0) {
        hasPdfs = true;
      }
    }

    const pdfNote = hasPdfs
      ? "Associated PDFs will also be deleted from storage."
      : "";

    // 1. Always allow deletion of rejected/cancelled clearances
    if (isRejected) {
      return { canDelete: true, reason: pdfNote };
    }

    // 2. Non-accountability types can be deleted without checks
    if (isNonAccountabilityType) {
      return { canDelete: true, reason: pdfNote };
    }

    // 3. Check if archived first (if current record)
    if (clearanceData.recordType === "current") {
      const { data: archivedRecord } = await supabase
        .from("clearance_records")
        .select("id")
        .eq("clearance_request_id", clearanceId)
        .single();

      if (archivedRecord) {
        return {
          canDelete: true,
          reason: `Note: This will also delete the archived yearly record. ${pdfNote}`,
        };
      }
    }

    // 4. Accountability types require settlement checks
    if (isAccountabilityType) {
      // Check if there are actually any accountability records
      const { data: accountabilityRecords, error } = await supabase
        .from("accountability_records")
        .select("id, is_settled")
        .eq("clearance_request_id", clearanceId);

      if (error) throw error;

      // If no accountability records exist, allow deletion
      if (!accountabilityRecords || accountabilityRecords.length === 0) {
        return { canDelete: true, reason: pdfNote };
      }

      // Check if all are settled
      const allSettled = accountabilityRecords.every(
        (record) => record.is_settled
      );

      if (!allSettled) {
        const unsettledCount = accountabilityRecords.filter(
          (record) => !record.is_settled
        ).length;
        return {
          canDelete: false,
          reason: `${unsettledCount} unsettled accountability record(s) exist for this ${
            clearanceData?.clearanceType || "clearance"
          }.`,
        };
      }

      // Check equipment accountability table
      const { data: equipmentAccountability } = await supabase
        .from("personnel_equipment_accountability_table")
        .select("accountability_status")
        .eq("clearance_request_id", clearanceId)
        .single();

      if (
        equipmentAccountability &&
        equipmentAccountability.accountability_status !== "SETTLED"
      ) {
        return {
          canDelete: false,
          reason: "Equipment accountability not settled.",
        };
      }

      return { canDelete: true, reason: pdfNote };
    }

    // 5. For unknown/undefined types, be conservative and check
    // Check if any accountability records exist at all
    const { data: accountabilityRecords, error } = await supabase
      .from("accountability_records")
      .select("id, is_settled")
      .eq("clearance_request_id", clearanceId)
      .limit(1);

    if (error) throw error;

    if (accountabilityRecords && accountabilityRecords.length > 0) {
      // Has accountability records - check settlement
      const { data: unsettledRecords } = await supabase
        .from("accountability_records")
        .select("id")
        .eq("clearance_request_id", clearanceId)
        .eq("is_settled", false)
        .limit(1);

      if (unsettledRecords && unsettledRecords.length > 0) {
        return {
          canDelete: false,
          reason: "This clearance has unsettled accountability records.",
        };
      }
    }

    return { canDelete: true, reason: pdfNote };
  } catch (error) {
    console.error("Error checking deletion eligibility:", error);
    return { canDelete: false, reason: "Error checking status." };
  }
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
          <h2>Manual Archive - Archive All Clearance Records</h2>
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
              <strong>COMPLETED, REJECTED, and CANCELLED</strong> clearance
              requests from {archiveYear || "selected year"}.
            </p>
            <p className={styles.archiveWarningText}>
              <strong>PENDING clearances will NOT be archived</strong> and will
              remain in the Clearance System.
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
  if (loading) {
    return (
      <div className={`main-content ${isSidebarCollapsed ? "collapsed" : ""}`}>
        <p>Loading clearance records...</p>
      </div>
    );
  }

  return (
    <div className={styles.CRSappContainer}>
      <Title>Clearance Records | BFP Villanueva</Title>
      <Meta name="robots" content="noindex, nofollow" />

      <Hamburger />
      <Sidebar />
      <ToastContainer />

      <div className={`main-content ${isSidebarCollapsed ? "collapsed" : ""}`}>
        <div className={styles.CRSheaderContainer}>
          <h1>Clearance Records</h1>

          <div className={styles.CRSviewControls}>
            <div className={styles.CRSviewToggle}>
              <button
                className={`${styles.CRSviewBtn} ${
                  viewMode === "current" ? styles.CRSviewBtnActive : ""
                }`}
                onClick={() => setViewMode("current")}
              >
                Current Requests
              </button>
              <button
                className={`${styles.CRSviewBtn} ${
                  viewMode === "yearly" ? styles.CRSviewBtnActive : ""
                }`}
                onClick={() => setViewMode("yearly")}
              >
                Yearly Records
              </button>
            </div>
            <button
              onClick={manuallyArchiveAllForYear}
              className={styles.CRSmanualArchiveBtn}
              disabled={generatingYearlyRecord}
              title="Manually archive ALL clearance records for a year"
            >
              {generatingYearlyRecord ? "Archiving..." : "📦 Manual Archive"}
            </button>
            {viewMode === "yearly" && (
              <div className={styles.CRSyearSelector}>
                <label>Year:</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className={styles.CRSyearSelect}
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

        {/* Top Controls - ADDED */}
        <div className={styles.CRStopControls}>
          <div className={styles.CRStableHeader}>
            <select
              className={styles.CRSfilterStatus}
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All Status</option>
              <option>PENDING</option>
              <option>IN_PROGRESS</option>
              <option>COMPLETED</option>
              <option>APPROVED</option>
              <option>REJECTED</option>
              <option>CANCELLED</option>
              <option>CLEARED</option>
              <option>WITH_ACCOUNTABILITY</option>
              <option>PARTIAL</option>
            </select>

            <select
              className={styles.CRSfilterType}
              value={filterClearanceType}
              onChange={(e) => {
                setFilterClearanceType(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All Clearance Types</option>
              <option>Resignation</option>
              <option>Retirement</option>
              <option>Equipment Completion</option>
              <option>Transfer</option>
              <option>Promotion</option>
              <option>Administrative</option>
              <option>Others</option>
            </select>

            <input
              type="text"
              className={styles.CRSsearchBar}
              placeholder="🔍 Search clearance records..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>

        {/* Summary Cards - ADDED */}
        <div className={styles.CRSsummary}>
          <button
            className={`${styles.CRSsummaryCard} ${styles.CRStotal} ${
              currentFilterCard === "total" ? styles.CRSactive : ""
            }`}
            onClick={() => handleCardClick("total")}
          >
            <h3>Total Records</h3>
            <p>{totalItems}</p>
            {viewMode === "yearly" && <small>Year: {selectedYear}</small>}
          </button>
          <button
            className={`${styles.CRSsummaryCard} ${styles.CRSpending} ${
              currentFilterCard === "pending" ? styles.CRSactive : ""
            }`}
            onClick={() => handleCardClick("pending")}
          >
            <h3>Pending</h3>
            <p>{pendingItems}</p>
          </button>
          <button
            className={`${styles.CRSsummaryCard} ${styles.CRScompleted} ${
              currentFilterCard === "completed" ? styles.CRSactive : ""
            }`}
            onClick={() => handleCardClick("completed")}
          >
            <h3>Completed</h3>
            <p>{completedItems}</p>
          </button>
          <button
            className={`${styles.CRSsummaryCard} ${styles.CRSrejected} ${
              currentFilterCard === "rejected" ? styles.CRSactive : ""
            }`}
            onClick={() => handleCardClick("rejected")}
          >
            <h3>Rejected</h3>
            <p>{rejectedItems}</p>
          </button>
        </div>

        {/* Table Container */}
        <div className={styles.CRStableContainer}>
          {/* Top Pagination */}
          <div className={styles.CRSpaginationContainer}>
            {renderPaginationButtons()}
          </div>

          {/* Table Wrapper */}
          <div className={styles.tableWrapper}>
            <table className={styles.CRStable}>
              <thead>{renderTableHeader()}</thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td
                      colSpan={
                        isBulkDeleteMode && viewMode === "yearly" ? "10" : "9"
                      }
                      className={styles.CRSnoRequestsTable}
                    >
                      <div style={{ fontSize: "48px", marginBottom: "16px" }}>
                             <span className={styles.animatedEmoji}>💾</span>
                      </div>
                      <h3> No clearance records found </h3>
                      <p>There are no clearance requests submitted yet.</p>
                    </td>
                  </tr>
                ) : (
                  paginated.map((record) => renderTableRow(record))
                )}
              </tbody>
            </table>
          </div>

          {/* Bottom Pagination */}
          <div className={styles.CRSpaginationContainer}>
            {renderPaginationButtons()}
          </div>
        </div>

        {/* Details Modal */}
        {renderDetailsModal()}

        {/* NEW: Bulk Delete Modal */}
        {renderBulkDeleteModal()}
        {/* Manual Archive Modal */}
        {renderManualArchiveModal()}
        {/* PDF Progress Overlay */}
        {renderPdfProgressOverlay()}
      </div>
      {isDeleteOpen && (
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
                // Show warning if deletion is restricted
                <div className={styles.deleteRestrictedWarning}>
                  <div className={styles.inventoryDeleteWarningIcon}>⚠️</div>
                  <h3>Deletion Restricted</h3>
                  <p className={styles.deleteWarningText}>{deleteReason}</p>
                  <div className={styles.clearanceDetails}>
                    <p>
                      <strong>Clearance Type:</strong>{" "}
                      {deleteRecord?.clearanceType}
                    </p>
                    <p>
                      <strong>Status:</strong> {deleteRecord?.status}
                    </p>
                    <p>
                      <strong>Personnel:</strong> {deleteRecord?.fullName}
                    </p>
                  </div>
                  <p className={styles.deleteInstructions}>
                    To delete this clearance, you must first:
                    <ul>
                      <li>Settle all accountability records</li>
                      <li>Complete equipment return procedures</li>
                      <li>Or if rejected, no action needed</li>
                    </ul>
                  </p>
                </div>
              ) : (
                // Normal deletion confirmation
                <div className={styles.inventoryDeleteConfirmationContent}>
                  <div className={styles.inventoryDeleteWarningIcon}>⚠️</div>
                  <p className={styles.inventoryDeleteConfirmationText}>
                    Are you sure you want to delete the clearance record for
                  </p>
                  <p className={styles.inventoryDocumentNameHighlight}>
                    "{deleteRecord?.fullName || "this record"}"?
                  </p>

                  {deleteRecord && (
                    <div className={styles.modalRecordDetails}>
                      <p>
                        <strong>Type:</strong> {deleteRecord.clearanceType}
                      </p>
                      <p>
                        <strong>Status:</strong> {deleteRecord.status}
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
                            clearance-documents bucket.
                          </p>
                        </div>
                      )}

                      {/* Show accountability info if applicable */}
                      {(deleteRecord.clearanceType?.includes("Resignation") ||
                        deleteRecord.clearanceType?.includes("Retirement") ||
                        deleteRecord.clearanceType?.includes(
                          "Equipment Completion"
                        )) &&
                        deleteRecord.status !== "Rejected" && (
                          <p className={styles.accountabilityNote}>
                            <em>
                              Note: This clearance type may have associated
                              accountability records.
                            </em>
                          </p>
                        )}

                      {deleteRecord.status === "Rejected" && (
                        <p className={styles.rejectedNote}>
                          <em>
                            Note: Rejected clearances can be deleted without
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
      )}
    </div>
  );
};

export default ClearanceRecords;
