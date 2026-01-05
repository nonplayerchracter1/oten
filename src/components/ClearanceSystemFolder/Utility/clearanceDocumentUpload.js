// utils/clearanceDocumentUpload.js
import { supabase } from "../../../lib/supabaseClient.js";

/**
 * Shared function to upload clearance documents to storage
 * @param {Object} params - Upload parameters
 * @param {Object} params.record - Clearance record data
 * @param {string} params.pdfBytes - PDF bytes to upload
 * @param {string} params.fileName - Generated filename
 * @param {boolean} params.isYearly - Whether it's a yearly record
 * @param {string} params.generatedBy - Who generated the document
 * @returns {Promise<Object>} - Upload result with URL and path
 */
// Update in utils/clearanceDocumentUpload.js

export const uploadClearanceDocumentToStorage = async ({
  record,
  pdfBytes,
  fileName,
  isYearly = false,
  generatedBy = "System",
}) => {
  try {
    console.log("=== UPLOADING CLEARANCE DOCUMENT ===");

    // 1. Convert PDF bytes to proper Blob
    let pdfBlob;
    if (pdfBytes instanceof ArrayBuffer) {
      pdfBlob = new Blob([pdfBytes], { type: "application/pdf" });
    } else if (pdfBytes instanceof Uint8Array) {
      pdfBlob = new Blob([pdfBytes], { type: "application/pdf" });
    } else if (pdfBytes instanceof Blob) {
      pdfBlob = pdfBytes;
    } else {
      // Try to convert whatever we have
      try {
        const uint8Array = new Uint8Array(pdfBytes);
        pdfBlob = new Blob([uint8Array], { type: "application/pdf" });
      } catch (error) {
        console.error("Failed to convert PDF bytes:", error);
        throw new Error("Invalid PDF data format");
      }
    }

    console.log("PDF Blob created:", {
      size: pdfBlob.size,
      type: pdfBlob.type,
    });

    // 2. Create personnel folder name
    const folderName = createClearancePersonnelFolderName({
      fullName: record.fullName || record.employee || "Unknown",
      rank: record.rank || "N/A",
      badgeNumber: record.badgeNumber || record.badge_number || "N/A",
    });

    // 3. Determine the year
    const year = isYearly
      ? record.year || new Date().getFullYear()
      : new Date(record.created_at || record.date || Date.now()).getFullYear();

    // 4. Create storage path
    const storagePath = isYearly
      ? `yearly-records/${year}/${folderName}/${fileName}`
      : `current-requests/${folderName}/${fileName}`;

    console.log("Uploading to:", storagePath);

    // 5. Create File object with correct MIME type
    const pdfFile = new File([pdfBlob], fileName, {
      type: "application/pdf",
      lastModified: Date.now(),
    });

    console.log("File object created:", {
      name: pdfFile.name,
      size: pdfFile.size,
      type: pdfFile.type,
    });

    // 6. Upload to Supabase Storage
    console.log("Attempting upload to bucket: clearance-documents");

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("clearance-documents")
      .upload(storagePath, pdfFile, {
        cacheControl: "3600",
        upsert: true,
        contentType: "application/pdf",
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);

      // Check if it's a bucket not found error
      if (
        uploadError.message.includes("bucket") ||
        uploadError.message.includes("not found")
      ) {
        console.warn(
          "Bucket 'clearance-documents' might not exist or have wrong permissions"
        );

        // Try to list buckets to see what's available
        const { data: buckets } = await supabase.storage.listBuckets();
        console.log("Available buckets:", buckets);

        throw new Error(
          `Storage bucket 'clearance-documents' not found or inaccessible. ` +
            `Please create it manually in Supabase Dashboard → Storage. ` +
            `Available buckets: ${
              buckets?.map((b) => b.name).join(", ") || "none"
            }`
        );
      }

      throw uploadError;
    }

    console.log("✅ Upload successful:", uploadData);

    // 7. Get public URL
    const { data: urlData } = supabase.storage
      .from("clearance-documents")
      .getPublicUrl(storagePath);

    console.log("Public URL generated:", urlData.publicUrl);

    return {
      success: true,
      fileUrl: urlData.publicUrl,
      filePath: storagePath,
      fileName: fileName,
      fileSize: pdfFile.size,
    };
  } catch (error) {
    console.error("Error in uploadClearanceDocumentToStorage:", error);
    throw error;
  }
};
/**
 * Create personnel folder name for clearance documents
 * Format: FullName_Rank_BadgeNumber
 */
export const createClearancePersonnelFolderName = (personnel) => {
  const fullName = (personnel.fullName || personnel.employee || "Unknown")
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .replace(/\s+/g, "_");

  const rank = (personnel.rank || "N/A")
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .replace(/\s+/g, "_");

  const badgeNumber = (
    personnel.badgeNumber ||
    personnel.badge_number ||
    "N/A"
  ).replace(/[^a-zA-Z0-9]/g, "");

  return `${fullName}_${rank}_${badgeNumber}`;
};

/**
 * Create standardized PDF filename for clearance documents
 * Format: FullName_Rank_BadgeNumber_ClearanceType_DateGenerated_Timestamp.pdf
 */
export const createClearancePdfFileName = (record, personnelData = null) => {
  // Get basic info
  const fullName = record.fullName || record.employee || "Unknown";
  const rank = record.rank || personnelData?.rank || "N/A";
  const badgeNumber =
    record.badgeNumber || personnelData?.badge_number || "N/A";
  const clearanceType = record.type || record.clearanceType || "Clearance";

  // Format date
  const generationDate = new Date();
  const dateString = generationDate.toISOString().split("T")[0];
  const timeString = generationDate.getTime();

  // Clean strings for filename
  const safeName = fullName.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_");
  const safeRank = rank.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_");
  const safeBadge = badgeNumber.replace(/[^a-zA-Z0-9]/g, "");
  const safeClearanceType = clearanceType.replace(/\s+/g, "_");

  // Construct filename
  const fileName = `${safeName}_${safeRank}_${safeBadge}_${safeClearanceType}_${dateString}_${timeString}.pdf`;

  return fileName;
};

/**
 * Save clearance document metadata to database
 */
export const saveClearanceDocumentMetadata = async ({
  clearanceRequestId = null,
  clearanceRecordId = null,
  documentName,
  fileUrl,
  filePath,
  fileSize,
  uploadedBy = "System",
  documentType = "CLEARANCE_FORM",
  description = null,
  fileType = "application/pdf",
  fileHash = null,
}) => {
  try {
    // Build document object
    const documentToInsert = {
      document_type: documentType,
      document_name: documentName,
      description:
        description ||
        (documentType === "CLEARANCE_FORM" ? "Clearance Form PDF" : null),
      file_url: fileUrl,
      file_path: filePath,
      file_type: fileType,
      file_size: fileSize,
      uploaded_by: uploadedBy,
      uploaded_at: new Date().toISOString(),
    };

    // Add file_hash if provided
    if (fileHash) {
      documentToInsert.file_hash = fileHash;
    }

    console.log("Clearance document to insert:", documentToInsert);

    let query;

    if (clearanceRequestId) {
      // For clearance_requests
      documentToInsert.clearance_request_id = clearanceRequestId;
      query = supabase
        .from("clearance_documents")
        .insert([documentToInsert])
        .select()
        .single();
    } else if (clearanceRecordId) {
      // For clearance_records
      documentToInsert.clearance_record_id = clearanceRecordId;
      query = supabase
        .from("clearance_documents")
        .insert([documentToInsert])
        .select()
        .single();
    } else {
      throw new Error(
        "Either clearanceRequestId or clearanceRecordId is required"
      );
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error saving clearance document metadata:", error);
      throw error;
    }

    console.log("✅ Clearance document metadata saved:", data);

    return data;
  } catch (error) {
    console.error("Error in saveClearanceDocumentMetadata:", error);
    throw error;
  }
};

/**
 * Load PDF template for clearance forms
 */
export const loadClearancePdfTemplate = async () => {
  try {
    // Try multiple paths for the template
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
    console.error("Error loading clearance PDF template:", error);
    throw error;
  }
};
