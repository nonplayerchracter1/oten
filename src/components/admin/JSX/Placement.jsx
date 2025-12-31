import React, { useState, useEffect } from "react";
import styles from "../styles/Placement.module.css";
import Sidebar from "../../Sidebar.jsx";
import Hamburger from "../../Hamburger.jsx";
import { useSidebar } from "../../SidebarContext.jsx";
import { Title, Meta } from "react-head";
import { supabase } from "../../../lib/supabaseClient.js";

const Placement = () => {
  const [personnel, setPersonnel] = useState([]);
  const [loading, setLoading] = useState(true);
  const { isSidebarCollapsed } = useSidebar();

  // State variables for table functionality
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 5;
  const [search, setSearch] = useState("");
  const [filterRank, setFilterRank] = useState("");
  const [currentFilterCard, setCurrentFilterCard] = useState("total");
  const [editingIndex, setEditingIndex] = useState(null);
  const [editData, setEditData] = useState({ designation: "", station: "" });

  // Load personnel data from Supabase on component mount
  useEffect(() => {
    loadPersonnelData();
  }, []);

  const loadPersonnelData = async () => {
    try {
      setLoading(true);
      
      // Fetch personnel data from Supabase
      const { data: personnelData, error } = await supabase
        .from("personnel")
        .select("*")
        .order("last_name", { ascending: true });

      if (error) {
        console.error("Error loading personnel data from Supabase:", error);
        throw error;
      }

      console.log(
        "Loaded personnel data from Supabase:",
        personnelData?.length || 0,
        "records"
      );

      setPersonnel(personnelData || []);
      setLoading(false);
    } catch (error) {
      console.error("Error loading personnel data:", error);
      setLoading(false);
    }
  };

  // Helper function to format dates for display
  const formatDateForDisplay = (dateValue) => {
    if (!dateValue) return "N/A";

    // If it's already a string, return it
    if (typeof dateValue === "string") {
      // Try to format it nicely
      try {
        const date = new Date(dateValue);
        if (!isNaN(date.getTime())) {
          return date.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          });
        }
      } catch {
        // If parsing fails, return the original string
      }
      return dateValue;
    }

    // If it's a Date object, format it
    if (dateValue instanceof Date) {
      return dateValue.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }

    // If it's a timestamp or other value, try to convert
    try {
      const date = new Date(dateValue);
      return isNaN(date.getTime()) 
        ? "N/A" 
        : date.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          });
    } catch {
      return "N/A";
    }
  };

  const calculateYears = (dateValue) => {
    if (!dateValue) return 0;

    let date;
    try {
      if (dateValue instanceof Date) {
        date = dateValue;
      } else {
        date = new Date(dateValue);
      }
      
      if (isNaN(date.getTime())) return 0;

      const today = new Date();
      const diff = today - date;
      return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
    } catch {
      return 0;
    }
  };

  const handleEdit = (index) => {
    const person = personnel[index];
    setEditingIndex(index);
    setEditData({
      designation: person.designation || "",
      station: person.station || "",
    });
  };

  const handleSave = async (index) => {
    const { designation, station } = editData;

    if (!designation.trim() || !station.trim()) {
      alert("Please fill in both designation and station/unit.");
      return;
    }

    try {
      const updatedPersonnel = [...personnel];
      const personToUpdate = updatedPersonnel[index];

      // Prepare update data
      const updateData = {
        designation: designation.trim(),
        station: station.trim(),
        updated_at: new Date().toISOString(),
      };

      // Update in Supabase
      const { data, error } = await supabase
        .from("personnel")
        .update(updateData)
        .eq("id", personToUpdate.id)
        .select()
        .single();

      if (error) {
        console.error("Error updating personnel data in Supabase:", error);
        throw error;
      }

      // Update local state
      updatedPersonnel[index] = data;
      setPersonnel(updatedPersonnel);
      setEditingIndex(null);
      setEditData({ designation: "", station: "" });

      console.log("Successfully updated personnel placement data");
    } catch (error) {
      console.error("Error saving personnel data:", error);
      alert("Error saving changes. Please try again.");
    }
  };

  const handleCancel = () => {
    setEditingIndex(null);
    setEditData({ designation: "", station: "" });
  };

  const handleInputChange = (field, value) => {
    setEditData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const getFullName = (person) => {
    const firstName = person.first_name || "";
    const middleName = person.middle_name || "";
    const lastName = person.last_name || "";
    return `${firstName} ${middleName} ${lastName}`.trim() || "N/A";
  };

  // Get the date hired for calculations
  const getDateHired = (person) => {
    return person.date_hired;
  };

  // Get the last promotion date
  const getLastPromotionDate = (person) => {
    return person.last_promoted || person.date_hired;
  };

  // Filtering & pagination logic
  function applyFilters(items) {
    let filtered = [...items];

    // Card filter
    if (currentFilterCard === "eligible") {
      filtered = filtered.filter((person) => {
        const lastPromoted = getLastPromotionDate(person);
        const years = calculateYears(lastPromoted);
        return years >= 2;
      });
    } else if (currentFilterCard === "not-eligible") {
      filtered = filtered.filter((person) => {
        const lastPromoted = getLastPromotionDate(person);
        const years = calculateYears(lastPromoted);
        return years < 2;
      });
    }

    // Text filters
    const s = search.trim().toLowerCase();
    const rankFilter = filterRank.trim().toLowerCase();

    filtered = filtered.filter((person) => {
      const fullName = getFullName(person).toLowerCase();
      const designation = (person.designation || "").toLowerCase();
      const station = (person.station || "").toLowerCase();
      const rank = (person.rank || "").toLowerCase();

      const text =
        `${fullName} ${rank} ${designation} ${station}`.toLowerCase();
      const rankMatch = !rankFilter || rank.includes(rankFilter);
      const searchMatch = !s || text.includes(s);

      return rankMatch && searchMatch;
    });

    return filtered;
  }

  const filteredPersonnel = applyFilters(personnel);
  const totalPages = Math.max(
    1,
    Math.ceil(filteredPersonnel.length / rowsPerPage)
  );
  const pageStart = (currentPage - 1) * rowsPerPage;
  const paginated = filteredPersonnel.slice(pageStart, pageStart + rowsPerPage);

  // Pagination function
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
        className={`${styles.PMTPaginationBtn} ${
          hasNoData ? styles.PMTDisabled : ""
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
        className={`${styles.PMTPaginationBtn} ${
          1 === currentPage ? styles.PMTActive : ""
        } ${hasNoData ? styles.PMTDisabled : ""}`}
        onClick={() => setCurrentPage(1)}
        disabled={hasNoData}
      >
        1
      </button>
    );

    // Show ellipsis after first page if needed
    if (currentPage > 3) {
      buttons.push(
        <span key="ellipsis1" className={styles.PMTPaginationEllipsis}>
          ...
        </span>
      );
    }

    // Show pages around current page (max 5 pages total including first and last)
    let startPage = Math.max(2, currentPage - 1);
    let endPage = Math.min(pageCount - 1, currentPage + 1);

    // Adjust if we're near the beginning
    if (currentPage <= 3) {
      endPage = Math.min(pageCount - 1, 4);
    }

    // Adjust if we're near the end
    if (currentPage >= pageCount - 2) {
      startPage = Math.max(2, pageCount - 3);
    }

    // Generate middle page buttons
    for (let i = startPage; i <= endPage; i++) {
      if (i > 1 && i < pageCount) {
        buttons.push(
          <button
            key={i}
            className={`${styles.PMTPaginationBtn} ${
              i === currentPage ? styles.PMTActive : ""
            } ${hasNoData ? styles.PMTDisabled : ""}`}
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
        <span key="ellipsis2" className={styles.PMTPaginationEllipsis}>
          ...
        </span>
      );
    }

    // Always show last page if there is more than 1 page
    if (pageCount > 1) {
      buttons.push(
        <button
          key={pageCount}
          className={`${styles.PMTPaginationBtn} ${
            pageCount === currentPage ? styles.PMTActive : ""
          } ${hasNoData ? styles.PMTDisabled : ""}`}
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
        className={`${styles.PMTPaginationBtn} ${
          hasNoData ? styles.PMTDisabled : ""
        }`}
        disabled={currentPage === pageCount || hasNoData}
        onClick={() => setCurrentPage(Math.min(pageCount, currentPage + 1))}
      >
        Next
      </button>
    );

    return buttons;
  };

  // Summary numbers
  const totalItems = personnel.length;
  const eligibleItems = personnel.filter((person) => {
    const lastPromoted = getLastPromotionDate(person);
    const years = calculateYears(lastPromoted);
    return years >= 2;
  }).length;
  const notEligibleItems = totalItems - eligibleItems;

  function handleCardClick(filter) {
    if (currentFilterCard === filter) {
      setCurrentFilterCard("total");
    } else {
      setCurrentFilterCard(filter);
    }
    setCurrentPage(1);
  }

  if (loading) {
    return (
      <div className={`main-content ${isSidebarCollapsed ? "collapsed" : ""}`}>
        <div style={{ textAlign: "center", padding: "50px" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>👨‍🚒</div>
          <h3
            style={{
              fontSize: "18px",
              fontWeight: "600",
              color: "#2b2b2b",
              marginBottom: "8px",
            }}
          >
            Loading Personnel Data
          </h3>
          <p style={{ fontSize: "14px", color: "#999" }}>
            Please wait while we load placement information...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.PMTAppContainer}>
      <Title>Personnel Placement | BFP Villanueva</Title>
      <Meta name="robots" content="noindex, nofollow" />

      <Hamburger />
      <Sidebar />
      <div className={`main-content ${isSidebarCollapsed ? "collapsed" : ""}`}>
        <h1 className={styles.PMTTitle}>Personnel Placement</h1>

        {/* Top Controls */}
        <div className={styles.PMTTopControls}>
          <div className={styles.PMTTableHeader}>
            <select
              className={styles.PMTFilterType}
              value={filterRank}
              onChange={(e) => {
                setFilterRank(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All Ranks</option>
              <option>FO1</option>
              <option>FO2</option>
              <option>FO3</option>
              <option>SFO1</option>
              <option>SFO2</option>
              <option>SFO3</option>
              <option>SFO4</option>
            </select>

            <input
              type="text"
              className={styles.PMTSearchBar}
              placeholder="🔍 Search personnel..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>

        {/* Summary Cards */}
        <div className={styles.PMTSummary}>
          <button
            className={`${styles.PMTSummaryCard} ${styles.PMTTotal} ${
              currentFilterCard === "total" ? styles.PMTActive : ""
            }`}
            onClick={() => handleCardClick("total")}
          >
            <h3>Total Personnel</h3>
            <p>{totalItems}</p>
          </button>
          <button
            className={`${styles.PMTSummaryCard} ${styles.PMTEligibleCard} ${
              currentFilterCard === "eligible" ? styles.PMTActive : ""
            }`}
            onClick={() => handleCardClick("eligible")}
          >
            <h3>Eligible for Promotion</h3>
            <p>{eligibleItems}</p>
          </button>
          <button
            className={`${styles.PMTSummaryCard} ${styles.PMTNotEligibleCard} ${
              currentFilterCard === "not-eligible" ? styles.PMTActive : ""
            }`}
            onClick={() => handleCardClick("not-eligible")}
          >
            <h3>Not Eligible</h3>
            <p>{notEligibleItems}</p>
          </button>
        </div>

        {/* Table */}
        <div className={styles.PMTTableContainer}>
          <div className={styles.PMTPaginationContainer}>
            {renderPaginationButtons()}
          </div>

          <table className={styles.PMTTable}>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Rank</th>
                <th>Current Designation</th>
                <th>Station/Unit</th>
                <th>Years in Designation</th>
                <th>Last Promotion Date</th>
                <th>Eligibility Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan="8" className={styles.PMTNoDataTable}>
                    <div style={{ fontSize: "48px", marginBottom: "16px" }}>
                      👨‍🚒
                    </div>
                    <h3>No Personnel Records Found</h3>
                    <p>
                      There are no personnel records matching your criteria.
                    </p>
                  </td>
                </tr>
              ) : (
                paginated.map((person, index) => {
                  const globalIndex = personnel.findIndex(
                    (p) => p.id === person.id
                  );
                  const lastPromoted = getLastPromotionDate(person);
                  const years = calculateYears(lastPromoted);
                  const isEligible = years >= 2;
                  const isEditing = editingIndex === globalIndex;

                  return (
                    <tr key={person.id} className={styles.PMTRow}>
                      <td>{getFullName(person)}</td>
                      <td>{person.rank || "N/A"}</td>
                      <td>
                        {isEditing ? (
                          <input
                            type="text"
                            className={styles.PMTInputField}
                            value={editData.designation}
                            onChange={(e) =>
                              handleInputChange("designation", e.target.value)
                            }
                            placeholder="Enter designation"
                          />
                        ) : (
                          person.designation || "Not assigned"
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            type="text"
                            className={styles.PMTInputField}
                            value={editData.station}
                            onChange={(e) =>
                              handleInputChange("station", e.target.value)
                            }
                            placeholder="Enter station/unit"
                          />
                        ) : (
                          person.station || "Not assigned"
                        )}
                      </td>
                      <td>{years}</td>
                      <td>{formatDateForDisplay(lastPromoted)}</td>
                      <td>
                        <span
                          className={`${styles.PMTStatus} ${
                            isEligible
                              ? styles.PMTEligible
                              : styles.PMTNotEligible
                          }`}
                        >
                          {isEligible ? "Eligible" : "Not Eligible"}
                        </span>
                      </td>
                      <td>
                        {isEditing ? (
                          <div className={styles.PMTActionGroup}>
                            <button
                              className={`${styles.PMTBtn} ${styles.PMTSaveBtn}`}
                              onClick={() => handleSave(globalIndex)}
                            >
                              Save
                            </button>
                            <button
                              className={`${styles.PMTBtn} ${styles.PMTCancelBtn}`}
                              onClick={handleCancel}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            className={`${styles.PMTBtn} ${styles.PMTEditBtn}`}
                            onClick={() => handleEdit(globalIndex)}
                          >
                            ✏️ Edit
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Placement;