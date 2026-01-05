import { supabase } from "../../../lib/supabaseClient.js";

export const checkLostEquipment = async (
  personnelId,
  clearanceType,
  clearanceRequestId = null
) => {
  try {
    // Only check for Resignation/Retirement with Equipment Completion
    if (
      clearanceType === "Resignation" ||
      clearanceType === "Retirement" ||
      clearanceType === "Equipment Completion"
    ) {
      let query = supabase
        .from("accountability_records")
        .select(
          `
          id,
          inventory_id,
          record_type,
          amount_due,
          is_settled,
          equipment_returned,
          clearance_request_id,
          inventory:inventory_id (
            item_name,
            item_code,
            category
          )
        `
        )
        .eq("personnel_id", personnelId)
        .eq("record_type", "LOST")
        .eq("is_settled", false) // Only unsettled lost equipment
        .eq("equipment_returned", false); // Not returned yet

      // If we have a clearance request ID, also get records linked to this specific request
      if (clearanceRequestId) {
        query = query.or(
          `clearance_request_id.is.null,clearance_request_id.eq.${clearanceRequestId}`
        );
      }

      const { data: lostRecords, error } = await query;

      if (error) throw error;

      return {
        hasLostEquipment: lostRecords && lostRecords.length > 0,
        lostItems: lostRecords || [],
        count: lostRecords?.length || 0,
      };
    }

    return { hasLostEquipment: false, lostItems: [], count: 0 };
  } catch (error) {
    console.error("Error checking lost equipment:", error);
    return { hasLostEquipment: false, lostItems: [], count: 0 };
  }
};

export const getDetailedLostEquipment = async (
  personnelId,
  clearanceRequestId = null
) => {
  try {
    let query = supabase
      .from("accountability_records")
      .select(
        `
        id,
        inventory_id,
        record_type,
        amount_due,
        is_settled,
        equipment_returned,
        return_date,
        settlement_date,
        settlement_method,
        record_date,
        clearance_request_id,
        inventory:inventory_id (
          item_name,
          item_code,
          category,
          status,
          price
        )
      `
      )
      .eq("personnel_id", personnelId)
      .eq("record_type", "LOST")
      .order("record_date", { ascending: false });

    if (clearanceRequestId) {
      query = query.or(
        `clearance_request_id.is.null,clearance_request_id.eq.${clearanceRequestId}`
      );
    }

    const { data: lostRecords, error } = await query;

    if (error) throw error;

    return lostRecords || [];
  } catch (error) {
    console.error("Error getting detailed lost equipment:", error);
    return [];
  }
};

// NEW FUNCTION: Link accountability records to clearance request
export const linkLostEquipmentToClearance = async (
  clearanceRequestId,
  personnelId
) => {
  try {
    console.log(
      `🔗 Linking lost equipment to clearance request ${clearanceRequestId} for personnel ${personnelId}`
    );

    // Find all LOST accountability records for this personnel that are not linked to any clearance
    const { data: lostRecords, error: findError } = await supabase
      .from("accountability_records")
      .select("id, record_type, is_settled")
      .eq("personnel_id", personnelId)
      .eq("record_type", "LOST")
      .is("clearance_request_id", null)
      .eq("is_settled", false);

    if (findError) throw findError;

    if (lostRecords && lostRecords.length > 0) {
      console.log(
        `📝 Found ${lostRecords.length} lost equipment records to link`
      );

      // Update each record with the clearance_request_id
      const recordIds = lostRecords.map((record) => record.id);

      const { error: updateError } = await supabase
        .from("accountability_records")
        .update({
          clearance_request_id: clearanceRequestId,
          updated_at: new Date().toISOString(),
        })
        .in("id", recordIds);

      if (updateError) throw updateError;

      console.log(
        `✅ Successfully linked ${recordIds.length} lost equipment records to clearance ${clearanceRequestId}`
      );

      return {
        success: true,
        linkedCount: recordIds.length,
        message: `Linked ${recordIds.length} lost equipment records to this clearance`,
      };
    }

    return {
      success: true,
      linkedCount: 0,
      message: "No unlinked lost equipment records found",
    };
  } catch (error) {
    console.error("Error linking lost equipment to clearance:", error);
    return {
      success: false,
      linkedCount: 0,
      message: `Failed to link lost equipment: ${error.message}`,
    };
  }
};

// NEW FUNCTION: Create accountability record for lost equipment during clearance
export const createLostEquipmentAccountability = async (data) => {
  try {
    const {
      personnelId,
      inventoryId,
      clearanceRequestId,
      recordType = "LOST",
      amountDue,
      remarks,
    } = data;

    const recordData = {
      personnel_id: personnelId,
      inventory_id: inventoryId,
      record_type: recordType,
      record_date: new Date().toISOString().split("T")[0],
      amount_due: amountDue || 0,
      is_settled: false,
      equipment_returned: false,
      clearance_request_id: clearanceRequestId,
      remarks:
        remarks || `Created during clearance process: ${recordType} equipment`,
    };

    const { data: newRecord, error } = await supabase
      .from("accountability_records")
      .insert([recordData])
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      record: newRecord,
      message: "Accountability record created successfully",
    };
  } catch (error) {
    console.error("Error creating accountability record:", error);
    return {
      success: false,
      record: null,
      message: `Failed to create accountability record: ${error.message}`,
    };
  }
};
