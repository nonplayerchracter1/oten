import { supabase } from "../../../lib/supabaseClient.js";

/**
 * Check if a clearance request already exists for personnel
 */
export const checkExistingClearance = async (personnelId, type) => {
  try {
    // Check for any active Retirement or Resignation clearances first
    const { data: retirementResignationData, error: rrError } = await supabase
      .from("clearance_requests")
      .select("id, type, status")
      .eq("personnel_id", personnelId)
      .in("type", ["Retirement", "Resignation"])
      .in("status", ["Pending", "In Progress"])
      .limit(1);

    if (rrError) throw rrError;

    // If user already has an active Retirement or Resignation
    if (retirementResignationData && retirementResignationData.length > 0) {
      const existingType = retirementResignationData[0].type;
      const existingStatus = retirementResignationData[0].status;

      // If trying to submit another Retirement/Resignation while one already exists
      if (
        (type === "Retirement" || type === "Resignation") &&
        (existingType === "Retirement" || existingType === "Resignation")
      ) {
        return {
          exists: true,
          message: `Cannot submit ${type} clearance: Personnel already has a ${existingType.toLowerCase()} clearance (Status: ${existingStatus})`,
        };
      }

      // If trying to submit Retirement while Resignation exists or vice versa
      if (
        (type === "Retirement" && existingType === "Resignation") ||
        (type === "Resignation" && existingType === "Retirement")
      ) {
        return {
          exists: true,
          message: `Cannot submit ${type} clearance: Personnel already has a ${existingType.toLowerCase()} clearance (Status: ${existingStatus})`,
        };
      }
    }

    // Check for existing clearance of the same type
    const { data: sameTypeData, error: sameTypeError } = await supabase
      .from("clearance_requests")
      .select("id, status")
      .eq("personnel_id", personnelId)
      .eq("type", type)
      .in("status", ["Pending", "In Progress"])
      .limit(1);

    if (sameTypeError) throw sameTypeError;

    if (sameTypeData && sameTypeData.length > 0) {
      const existingStatus = sameTypeData[0].status;
      return {
        exists: true,
        message: `This personnel already has a ${type.toLowerCase()} clearance request (Status: ${existingStatus}).`,
      };
    }

    return { exists: false, message: "" };
  } catch (error) {
    console.error("Error checking existing clearance:", error);
    return { exists: false, message: "" };
  }
};

/**
 * Load personnel equipment for clearance
 */
export const loadPersonnelEquipment = async (personnelId) => {
  try {
    console.log("🔍 Loading equipment for personnel ID:", personnelId);

    const { data: personnelData, error: personnelError } = await supabase
      .from("personnel")
      .select("first_name, middle_name, last_name, username")
      .eq("id", personnelId)
      .single();

    if (personnelError) {
      console.error("❌ Error loading personnel:", personnelError);
      return [];
    }

    const fullName = `${personnelData.first_name || ""} ${
      personnelData.middle_name || ""
    } ${personnelData.last_name || ""}`
      .replace(/\s+/g, " ")
      .trim();

    console.log("🔍 Searching for equipment assigned to:", fullName);

    const { data: dataById, error: errorById } = await supabase
      .from("inventory")
      .select(
        "id, item_name, item_code, category, status, assigned_to, price, is_active, assigned_personnel_id"
      )
      .eq("assigned_personnel_id", personnelId)
      .eq("is_active", true);

    const { data: dataByName, error: errorByName } = await supabase
      .from("inventory")
      .select(
        "id, item_name, item_code, category, status, assigned_to, price, is_active, assigned_personnel_id"
      )
      .eq("is_active", true);

    let nameMatchedItems = [];

    if (!errorByName && dataByName) {
      const normalizeName = (name) => {
        if (!name) return "";
        return name.toLowerCase().replace(/\s+/g, " ").trim();
      };

      const normalizedFullName = normalizeName(fullName);
      const normalizedFirstName = normalizeName(personnelData.first_name);
      const normalizedLastName = normalizeName(personnelData.last_name);
      const normalizedUsername = normalizeName(personnelData.username);

      const simplifiedName = (name) => {
        return normalizeName(name).replace(/[^a-z0-9\s]/g, "");
      };

      nameMatchedItems = dataByName.filter((item) => {
        if (!item.assigned_to) return false;

        const assignedToLower = normalizeName(item.assigned_to);

        const matches = [
          assignedToLower === normalizedFullName,
          normalizedFirstName && assignedToLower.includes(normalizedFirstName),
          normalizedLastName && assignedToLower.includes(normalizedLastName),
          normalizedUsername && assignedToLower.includes(normalizedUsername),
          simplifiedName(item.assigned_to) === simplifiedName(fullName),
          normalizedFullName.includes("-") &&
            normalizedFullName
              .split("-")
              .some(
                (part) => part.trim() && assignedToLower.includes(part.trim())
              ),
          normalizedFullName
            .split(" ")
            .some((word) => word.length > 2 && assignedToLower.includes(word)),
        ];

        return matches.some((match) => match === true);
      });
    }

    const combinedResults = [];
    const seenIds = new Set();

    if (dataById) {
      dataById.forEach((item) => {
        if (!seenIds.has(item.id)) {
          combinedResults.push(item);
          seenIds.add(item.id);
        }
      });
    }

    nameMatchedItems.forEach((item) => {
      if (!seenIds.has(item.id)) {
        combinedResults.push(item);
        seenIds.add(item.id);
      }
    });

    console.log(
      `✅ Found ${combinedResults.length} equipment items for ${fullName}:`,
      combinedResults.map((item) => ({
        name: item.item_name,
        assigned_to: item.assigned_to,
        price: item.price,
        personnel_id: item.assigned_personnel_id,
      }))
    );

    return combinedResults;
  } catch (err) {
    console.error("💥 Error loading personnel equipment:", err);
    return [];
  }
};
export const checkClearanceEligibility = async (personnelId, clearanceType) => {
  try {
    // Check for existing clearance first
    const { exists, message } = await checkExistingClearance(
      personnelId,
      clearanceType
    );
    if (exists) {
      return { eligible: false, reason: message };
    }

    // Check for lost equipment if applicable
    if (
      clearanceType === "Resignation" ||
      clearanceType === "Retirement" ||
      clearanceType === "Equipment Completion"
    ) {
      const { data: lostRecords } = await supabase
        .from("accountability_records")
        .select("id, is_settled")
        .eq("personnel_id", personnelId)
        .eq("record_type", "LOST")
        .eq("is_settled", false);

      if (lostRecords && lostRecords.length > 0) {
        return {
          eligible: false,
          reason: `Cannot create clearance: ${lostRecords.length} unsettled lost equipment item(s) found. These must be settled first.`,
        };
      }
    }

    return { eligible: true, reason: "" };
  } catch (error) {
    console.error("Error checking clearance eligibility:", error);
    return { eligible: false, reason: "System error checking eligibility" };
  }
};
/**
 * Update clearance status with accountability checks
 */
export const updateClearanceStatus = async (id, newStatus, remarks = "") => {
  try {
    const updateData = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    if (newStatus === "Completed") {
      updateData.approved_by = "Administrator";
      updateData.approved_at = new Date().toISOString();
      updateData.completed_at = new Date().toISOString();
      updateData.remarks = remarks;
    } else if (newStatus === "Rejected") {
      updateData.rejection_reason = remarks;
    }

    const { error } = await supabase
      .from("clearance_requests")
      .update(updateData)
      .eq("id", id);

    if (error) throw error;

    return true;
  } catch (err) {
    console.error("Error updating clearance status:", err);
    throw err;
  }
};

/**
 * Check if clearance can be approved based on accountability
 */
export const checkClearanceApprovalEligibility = async (
  requestId,
  personnelId
) => {
  try {
    // Check if there's any accountability record
    const { data: accountabilityData, error } = await supabase
      .from("personnel_equipment_accountability_table")
      .select("accountability_status")
      .eq("personnel_id", personnelId)
      .eq("clearance_request_id", requestId)
      .maybeSingle();

    if (error) {
      console.error("Error checking accountability:", error);
      return false;
    }

    // If there's an accountability record, check if it's settled
    if (accountabilityData) {
      return accountabilityData.accountability_status === "SETTLED";
    }

    // No accountability record means no lost/damaged equipment
    return true;
  } catch (err) {
    console.error("Error in checkClearanceApprovalEligibility:", err);
    return false;
  }
};

/**
 * Format currency for display
 */
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount || 0);
};

/**
 * Download PDF helper function
 */
export const downloadPdf = (pdfBytes, fileName) => {
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
