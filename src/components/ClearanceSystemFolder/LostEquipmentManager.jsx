import React, { useState } from "react";
import { supabase } from "../../lib/supabaseClient.js";
import { toast } from "react-toastify";
import styles from "./Styles/ClearanceSystem.module.css";

const LostEquipmentManager = ({ clearanceRequest, onUpdate }) => {
  const [lostEquipment, setLostEquipment] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLostItem, setNewLostItem] = useState({
    inventory_id: "",
    amount_due: "",
    remarks: "",
  });

  // Load lost equipment for this clearance
  const loadLostEquipment = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
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
          remarks,
          inventory:inventory_id (
            item_name,
            item_code,
            category,
            price
          )
        `
        )
        .eq("clearance_request_id", clearanceRequest.id)
        .eq("record_type", "LOST")
        .order("record_date", { ascending: false });

      if (error) throw error;

      setLostEquipment(data || []);
    } catch (error) {
      console.error("Error loading lost equipment:", error);
      toast.error("Failed to load lost equipment");
    } finally {
      setLoading(false);
    }
  };

  // Add new lost equipment
  const handleAddLostItem = async () => {
    if (!newLostItem.inventory_id || !newLostItem.amount_due) {
      toast.warning("Please fill in all required fields");
      return;
    }

    try {
      setLoading(true);

      const recordData = {
        personnel_id: clearanceRequest.personnel_id,
        inventory_id: newLostItem.inventory_id,
        clearance_request_id: clearanceRequest.id,
        record_type: "LOST",
        record_date: new Date().toISOString().split("T")[0],
        amount_due: parseFloat(newLostItem.amount_due),
        is_settled: false,
        equipment_returned: false,
        remarks: newLostItem.remarks || `Added during clearance process`,
      };

      const { error } = await supabase
        .from("accountability_records")
        .insert([recordData]);

      if (error) throw error;

      toast.success("Lost equipment added to clearance");
      setNewLostItem({ inventory_id: "", amount_due: "", remarks: "" });
      setShowAddForm(false);
      loadLostEquipment();
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error("Error adding lost equipment:", error);
      toast.error("Failed to add lost equipment");
    } finally {
      setLoading(false);
    }
  };

  // Mark as settled
  const handleMarkAsSettled = async (recordId) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from("accountability_records")
        .update({
          is_settled: true,
          settlement_date: new Date().toISOString().split("T")[0],
          updated_at: new Date().toISOString(),
        })
        .eq("id", recordId);

      if (error) throw error;

      toast.success("Marked as settled");
      loadLostEquipment();
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error("Error marking as settled:", error);
      toast.error("Failed to update status");
    } finally {
      setLoading(false);
    }
  };

  // Remove from clearance (unlink)
  const handleRemoveFromClearance = async (recordId) => {
    if (
      !window.confirm(
        "Are you sure you want to remove this lost equipment from this clearance?"
      )
    ) {
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase
        .from("accountability_records")
        .update({
          clearance_request_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", recordId);

      if (error) throw error;

      toast.success("Removed from clearance");
      loadLostEquipment();
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error("Error removing from clearance:", error);
      toast.error("Failed to remove from clearance");
    } finally {
      setLoading(false);
    }
  };

  // Load data on mount
  React.useEffect(() => {
    if (clearanceRequest?.id) {
      loadLostEquipment();
    }
  }, [clearanceRequest?.id]);

  return (
    <div className={styles.lostEquipmentManager}>
      <div className={styles.lostEquipmentHeader}>
        <h3>Lost Equipment Management</h3>
        <button
          className={styles.addLostItemBtn}
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? "Cancel" : "+ Add Lost Item"}
        </button>
      </div>

      {showAddForm && (
        <div className={styles.addLostItemForm}>
          <h4>Add New Lost Equipment</h4>
          <div className={styles.formGroup}>
            <label>Inventory Item *</label>
            <select
              value={newLostItem.inventory_id}
              onChange={(e) =>
                setNewLostItem({ ...newLostItem, inventory_id: e.target.value })
              }
            >
              <option value="">Select Item</option>
              {/* You would populate this with the personnel's equipment */}
            </select>
          </div>
          <div className={styles.formGroup}>
            <label>Amount Due (PHP) *</label>
            <input
              type="number"
              step="0.01"
              value={newLostItem.amount_due}
              onChange={(e) =>
                setNewLostItem({ ...newLostItem, amount_due: e.target.value })
              }
              placeholder="0.00"
            />
          </div>
          <div className={styles.formGroup}>
            <label>Remarks</label>
            <textarea
              value={newLostItem.remarks}
              onChange={(e) =>
                setNewLostItem({ ...newLostItem, remarks: e.target.value })
              }
              placeholder="Additional details..."
              rows={3}
            />
          </div>
          <div className={styles.formActions}>
            <button
              className={styles.cancelBtn}
              onClick={() => setShowAddForm(false)}
            >
              Cancel
            </button>
            <button
              className={styles.submitBtn}
              onClick={handleAddLostItem}
              disabled={loading}
            >
              {loading ? "Adding..." : "Add Lost Item"}
            </button>
          </div>
        </div>
      )}

      <div className={styles.lostEquipmentList}>
        {loading ? (
          <p>Loading lost equipment...</p>
        ) : lostEquipment.length === 0 ? (
          <p className={styles.noLostItems}>
            No lost equipment linked to this clearance
          </p>
        ) : (
          <table className={styles.lostEquipmentTable}>
            <thead>
              <tr>
                <th>Item</th>
                <th>Lost Date</th>
                <th>Amount Due</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {lostEquipment.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.inventory?.item_name || "Unknown"}</strong>
                    <div className={styles.itemCode}>
                      {item.inventory?.item_code || "N/A"}
                    </div>
                  </td>
                  <td>
                    {item.record_date
                      ? new Date(item.record_date).toLocaleDateString()
                      : "N/A"}
                  </td>
                  <td>₱{parseFloat(item.amount_due || 0).toFixed(2)}</td>
                  <td>
                    <span
                      className={`${styles.statusBadge} ${
                        item.is_settled ? styles.settled : styles.pending
                      }`}
                    >
                      {item.is_settled ? "Settled" : "Pending"}
                    </span>
                  </td>
                  <td>
                    <div className={styles.actionButtons}>
                      {!item.is_settled && (
                        <button
                          className={styles.settleBtn}
                          onClick={() => handleMarkAsSettled(item.id)}
                          disabled={loading}
                        >
                          Mark Settled
                        </button>
                      )}
                      <button
                        className={styles.removeBtn}
                        onClick={() => handleRemoveFromClearance(item.id)}
                        disabled={loading}
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default LostEquipmentManager;
