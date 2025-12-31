// utils/leaveDocumentUpload.js
import { supabase } from "../../lib/supabaseClient.js";

/**
 * Shared function to upload leave documents to storage
 * @param {Object} params - Upload parameters
 * @param {Object} params.record - Leave record data
 * @param {string} params.pdfBytes - PDF bytes to upload
 * @param {string} params.fileName - Generated filename
 * @param {boolean} params.isYearly - Whether it's a yearly record
 * @param {string} params.generatedBy - Who generated the document
 * @returns {Promise<Object>} - Upload result with URL and path
 */
export const uploadLeaveDocumentToStorage = async ({
  record,
  pdfBytes,
  fileName,
  isYearly = false,
  generatedBy = "System",
}) => {
  try {
    console.log("=== UPLOADING LEAVE DOCUMENT ===");

    // Create personnel folder name (same format for both)
    const folderName = createPersonnelFolderName({
      fullName: record.fullName || record.employeeName,
      rank: record.rank,
      badgeNumber: record.badgeNumber || record.badge_number,
    });

    // Determine the year
    const year = isYearly
      ? record.year || new Date().getFullYear()
      : new Date(
          record.dateRequested ||
            record.created_at ||
            record.approvedDate ||
            Date.now()
        ).getFullYear();

    // Create the storage path
    const storagePath = `leave-form/${year}/${folderName}/${fileName}`;

    console.log("Upload details:", {
      fileName,
      folderName,
      year,
      storagePath,
      fileSize: pdfBytes.byteLength,
    });

    // Create File object
    const pdfFile = new File([pdfBytes], fileName, {
      type: "application/pdf",
      lastModified: Date.now(),
    });

    // Try to upload to the bucket
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("leave-documents")
      .upload(storagePath, pdfFile, {
        cacheControl: "3600",
        upsert: true,
        contentType: "application/pdf",
      });

    // If bucket doesn't exist, create it
    if (uploadError) {
      console.error("Initial upload error:", uploadError);

      if (
        uploadError.message.includes("bucket") &&
        uploadError.message.includes("not found")
      ) {
        console.log("Creating leave-documents bucket...");

        // Try to create the bucket
        const { error: createBucketError } =
          await supabase.storage.createBucket("leave-documents", {
            public: true,
            allowedMimeTypes: ["application/pdf"],
          });

        if (createBucketError) {
          console.error("Failed to create bucket:", createBucketError);
          throw new Error(
            `Failed to create storage bucket: ${createBucketError.message}`
          );
        }

        // Try upload again after creating bucket
        const { data: retryData, error: retryError } = await supabase.storage
          .from("leave-documents")
          .upload(storagePath, pdfFile, {
            cacheControl: "3600",
            upsert: true,
            contentType: "application/pdf",
          });

        if (retryError) {
          throw retryError;
        }

        console.log("✅ Bucket created and file uploaded");
      } else {
        throw uploadError;
      }
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("leave-documents")
      .getPublicUrl(storagePath);

    const publicUrl = urlData?.publicUrl;

    console.log("✅ Upload successful:", {
      storagePath,
      publicUrl,
      fileSize: pdfFile.size,
    });

    return {
      success: true,
      fileUrl: publicUrl,
      filePath: storagePath,
      fileName: fileName,
      fileSize: pdfFile.size,
    };
  } catch (error) {
    console.error("Error in uploadLeaveDocumentToStorage:", error);
    throw error;
  }
};

/**
 * Create personnel folder name (shared format)
 * Format: FullName_Rank_BadgeNumber
 */
export const createPersonnelFolderName = (personnel) => {
  const fullName = (personnel.fullName || personnel.employeeName || "Unknown")
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
 * Create standardized PDF filename
 * Format: FullName_Rank_BadgeNumber_LeaveType_SubType_DateGenerated_Timestamp.pdf
 */
export const createLeavePdfFileName = (record, personnelData = null) => {
  // Get basic info
  const fullName = record.fullName || record.employeeName || "Unknown";
  const rank = record.rank || personnelData?.rank || "N/A";
  const badgeNumber =
    record.badgeNumber || personnelData?.badge_number || "N/A";
  const leaveType = record.leaveType || "Unknown";

  // Determine subtype
  let subType = "";
  if (leaveType.toLowerCase().includes("vacation")) {
    subType = record.vacationLocationType === "abroad" ? "Abroad" : "Local";
  } else if (leaveType.toLowerCase().includes("sick")) {
    subType =
      record.illnessType === "in_hospital" ? "In_Hospital" : "Out_Patient";
  }

  // Format date
  const generationDate = new Date();
  const dateString = generationDate.toISOString().split("T")[0];
  const timeString = generationDate.getTime();

  // Clean strings for filename
  const safeName = fullName.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_");
  const safeRank = rank.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_");
  const safeBadge = badgeNumber.replace(/[^a-zA-Z0-9]/g, "");
  const safeLeaveType = leaveType.replace(/\s+/g, "_");
  const safeSubType = subType.replace(/\s+/g, "_");

  // Construct filename
  let fileName = `${safeName}_${safeRank}_${safeBadge}_${safeLeaveType}`;
  if (safeSubType) {
    fileName += `_${safeSubType}`;
  }
  fileName += `_${dateString}_${timeString}.pdf`;

  return fileName;
};

/**
 * Save document metadata to database
 */
// utils/leaveDocumentUpload.js - FIXED VERSION
// utils/leaveDocumentUpload.js - CORRECTED VERSION
/**
 * Save document metadata to database (UPDATED for your schema)
 */
// In leaveDocumentUpload.js - FIXED saveLeaveDocumentMetadata
export const saveLeaveDocumentMetadata = async ({
  leaveRequestId = null,
  leaveRecordId = null,
  documentName,
  fileUrl,
  filePath,
  fileSize,
  uploadedBy = "System",
  documentType = "LEAVE_FORM",
  description = null,
  fileType = "application/pdf",
  fileHash = null
}) => {
  try {
    // Build document object
    const documentToInsert = {
      document_type: documentType,
      document_name: documentName,
      description: description || (documentType === "LEAVE_FORM" ? "Leave Form PDF" : null),
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

    // Check what we're inserting
    console.log("Document to insert:", documentToInsert);

    let query;
    
    if (leaveRequestId) {
      // For leave_requests - your table supports this
      documentToInsert.leave_request_id = leaveRequestId;
      query = supabase
        .from("leave_documents")
        .insert([documentToInsert])
        .select()
        .single();
    } else if (leaveRecordId) {
      // For leave_records - your table doesn't support this yet
      // So we'll just skip and maybe log a warning
      console.warn("leave_record_id not supported in current leave_documents schema");
      
      // Update leave_records table instead (which has document_url)
      const { error: updateError } = await supabase
        .from("leave_records")
        .update({
          document_url: fileUrl,
          document_path: filePath,
          updated_at: new Date().toISOString(),
        })
        .eq("id", leaveRecordId);

      if (updateError) {
        console.error("Error updating leave_records:", updateError);
        throw updateError;
      }

      return {
        id: leaveRecordId,
        document_type: documentType,
        document_name: documentName,
        file_url: fileUrl,
        file_path: filePath,
        uploaded_at: new Date().toISOString(),
        is_leave_record: true,
      };
    } else {
      throw new Error("Either leaveRequestId or leaveRecordId is required");
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error saving document metadata:", error);
      throw error;
    }

    console.log("✅ Document metadata saved:", data);

    return data;
  } catch (error) {
    console.error("Error in saveLeaveDocumentMetadata:", error);
    throw error;
  }
};  