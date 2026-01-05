import React, { useState, useEffect } from "react";
import styles from "../styles/ClearanceSystem.module.css";

const OfficerInputModal = ({
  isOpen,
  onClose,
  onConfirm,
  initialData = {},
  isGenerating = false,
}) => {
  const [officerNames, setOfficerNames] = useState({
    stationFinanceOfficer: "",
    stationSupplyAccountableOfficer: "",
    cityMunicipalFireMarshal: "",
    districtProvincialFinanceOfficer: "",
    districtProvincialSupplyAccountableOfficer: "",
    districtProvincialFireMarshal: "",
    regionalSupplyAccountableOfficer: "",
    regionalFinanceOfficer: "",
    regionalAccountant: "",
    regionalDirector: "",
    chiefAccountantNHQ: "",
    chiefFinanceServiceNHQ: "",
    chiefSupplyAccountableServiceNHQ: "",
  });

  // Initialize with existing data if provided
  useEffect(() => {
    if (initialData) {
      setOfficerNames((prev) => ({
        ...prev,
        ...initialData,
      }));
    }
  }, [initialData]);

  const handleInputChange = (field, value) => {
    setOfficerNames((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = () => {
    onConfirm(officerNames);
  };

  const handleCancel = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className={styles.officerModalOverlay}>
      <div className={styles.officerModal}>
        <div className={styles.officerModalHeader}>
          <h3>Enter Officer Names for Clearance Form</h3>
          <button
            className={styles.officerModalCloseBtn}
            onClick={handleCancel}
            disabled={isGenerating}
          >
            &times;
          </button>
        </div>

        <div className={styles.officerModalBody}>
          <div className={styles.officerModalNote}>
            <p>
              Please enter the names of officers to be displayed on the
              clearance form. Fields are optional - leave blank to exclude from
              PDF.
            </p>
          </div>

          <div className={styles.officerInputsGrid}>
            {/* Station Level */}
            <div className={styles.officerInputGroup}>
              <label htmlFor="stationFinanceOfficer">
                Station Finance Officer
              </label>
              <input
                type="text"
                id="stationFinanceOfficer"
                value={officerNames.stationFinanceOfficer}
                onChange={(e) =>
                  handleInputChange("stationFinanceOfficer", e.target.value)
                }
                placeholder="Enter name..."
                disabled={isGenerating}
              />
            </div>

            <div className={styles.officerInputGroup}>
              <label htmlFor="stationSupplyAccountableOfficer">
                Station Supply & Property Accountable Officer
              </label>
              <input
                type="text"
                id="stationSupplyAccountableOfficer"
                value={officerNames.stationSupplyAccountableOfficer}
                onChange={(e) =>
                  handleInputChange(
                    "stationSupplyAccountableOfficer",
                    e.target.value
                  )
                }
                placeholder="Enter name..."
                disabled={isGenerating}
              />
            </div>

            <div className={styles.officerInputGroup}>
              <label htmlFor="cityMunicipalFireMarshal">
                City/Municipal Fire Marshal
              </label>
              <input
                type="text"
                id="cityMunicipalFireMarshal"
                value={officerNames.cityMunicipalFireMarshal}
                onChange={(e) =>
                  handleInputChange("cityMunicipalFireMarshal", e.target.value)
                }
                placeholder="Enter name..."
                disabled={isGenerating}
              />
            </div>

            {/* District/Provincial Level */}
            <div className={styles.officerInputGroup}>
              <label htmlFor="districtProvincialFinanceOfficer">
                District/Provincial Finance Officer
              </label>
              <input
                type="text"
                id="districtProvincialFinanceOfficer"
                value={officerNames.districtProvincialFinanceOfficer}
                onChange={(e) =>
                  handleInputChange(
                    "districtProvincialFinanceOfficer",
                    e.target.value
                  )
                }
                placeholder="Enter name..."
                disabled={isGenerating}
              />
            </div>

            <div className={styles.officerInputGroup}>
              <label htmlFor="districtProvincialSupplyAccountableOfficer">
                District/Provincial Supply & Property Accountable Officer
              </label>
              <input
                type="text"
                id="districtProvincialSupplyAccountableOfficer"
                value={officerNames.districtProvincialSupplyAccountableOfficer}
                onChange={(e) =>
                  handleInputChange(
                    "districtProvincialSupplyAccountableOfficer",
                    e.target.value
                  )
                }
                placeholder="Enter name..."
                disabled={isGenerating}
              />
            </div>

            <div className={styles.officerInputGroup}>
              <label htmlFor="districtProvincialFireMarshal">
                District/Provincial Fire Marshal
              </label>
              <input
                type="text"
                id="districtProvincialFireMarshal"
                value={officerNames.districtProvincialFireMarshal}
                onChange={(e) =>
                  handleInputChange(
                    "districtProvincialFireMarshal",
                    e.target.value
                  )
                }
                placeholder="Enter name..."
                disabled={isGenerating}
              />
            </div>

            {/* Regional Level */}
            <div className={styles.officerInputGroup}>
              <label htmlFor="regionalSupplyAccountableOfficer">
                Regional Supply & Property Accountable Officer
              </label>
              <input
                type="text"
                id="regionalSupplyAccountableOfficer"
                value={officerNames.regionalSupplyAccountableOfficer}
                onChange={(e) =>
                  handleInputChange(
                    "regionalSupplyAccountableOfficer",
                    e.target.value
                  )
                }
                placeholder="Enter name..."
                disabled={isGenerating}
              />
            </div>

            <div className={styles.officerInputGroup}>
              <label htmlFor="regionalFinanceOfficer">
                Regional Finance Officer
              </label>
              <input
                type="text"
                id="regionalFinanceOfficer"
                value={officerNames.regionalFinanceOfficer}
                onChange={(e) =>
                  handleInputChange("regionalFinanceOfficer", e.target.value)
                }
                placeholder="Enter name..."
                disabled={isGenerating}
              />
            </div>

            <div className={styles.officerInputGroup}>
              <label htmlFor="regionalAccountant">Regional Accountant</label>
              <input
                type="text"
                id="regionalAccountant"
                value={officerNames.regionalAccountant}
                onChange={(e) =>
                  handleInputChange("regionalAccountant", e.target.value)
                }
                placeholder="Enter name..."
                disabled={isGenerating}
              />
            </div>

            <div className={styles.officerInputGroup}>
              <label htmlFor="regionalDirector">Regional Director</label>
              <input
                type="text"
                id="regionalDirector"
                value={officerNames.regionalDirector}
                onChange={(e) =>
                  handleInputChange("regionalDirector", e.target.value)
                }
                placeholder="Enter name..."
                disabled={isGenerating}
              />
            </div>

            {/* National Headquarters */}
            <div className={styles.officerInputGroup}>
              <label htmlFor="chiefAccountantNHQ">Chief, Accountant, NHQ</label>
              <input
                type="text"
                id="chiefAccountantNHQ"
                value={officerNames.chiefAccountantNHQ}
                onChange={(e) =>
                  handleInputChange("chiefAccountantNHQ", e.target.value)
                }
                placeholder="Enter name..."
                disabled={isGenerating}
              />
            </div>

            <div className={styles.officerInputGroup}>
              <label htmlFor="chiefFinanceServiceNHQ">
                Chief, Finance Service, NHQ
              </label>
              <input
                type="text"
                id="chiefFinanceServiceNHQ"
                value={officerNames.chiefFinanceServiceNHQ}
                onChange={(e) =>
                  handleInputChange("chiefFinanceServiceNHQ", e.target.value)
                }
                placeholder="Enter name..."
                disabled={isGenerating}
              />
            </div>

            <div className={styles.officerInputGroup}>
              <label htmlFor="chiefSupplyAccountableServiceNHQ">
                Chief, Supply & Property Accountable Service, NHQ
              </label>
              <input
                type="text"
                id="chiefSupplyAccountableServiceNHQ"
                value={officerNames.chiefSupplyAccountableServiceNHQ}
                onChange={(e) =>
                  handleInputChange(
                    "chiefSupplyAccountableServiceNHQ",
                    e.target.value
                  )
                }
                placeholder="Enter name..."
                disabled={isGenerating}
              />
            </div>
          </div>

          <div className={styles.officerModalFooter}>
            <button
              className={styles.officerModalCancelBtn}
              onClick={handleCancel}
              disabled={isGenerating}
            >
              Cancel
            </button>
            <button
              className={styles.officerModalConfirmBtn}
              onClick={handleSubmit}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <span className={styles.officerModalSpinner}></span>
                  Generating...
                </>
              ) : (
                "Generate PDF with Officer Names"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OfficerInputModal;
