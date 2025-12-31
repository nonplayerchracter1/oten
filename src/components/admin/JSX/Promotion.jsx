import React, { useState, useEffect } from "react";
import styles from "../styles/Promotion.module.css";
import Sidebar from "../../Sidebar.jsx";
import Hamburger from "../../Hamburger.jsx";
import { useSidebar } from "../../SidebarContext.jsx";
import { Title, Meta } from "react-head";
import { supabase } from "../../../lib/supabaseClient.js";

const Promotion = () => {
  const [personnel, setPersonnel] = useState([]);
  const [filteredPersonnel, setFilteredPersonnel] = useState([]);
  const [loading, setLoading] = useState(true);
  const { isSidebarCollapsed } = useSidebar();

  // State variables for table functionality
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 5;
  const [search, setSearch] = useState("");
  const [filterRank, setFilterRank] = useState("");
  const [currentFilterCard, setCurrentFilterCard] = useState("total");

  useEffect(() => {
    loadPromotionData();
  }, []);

  useEffect(() => {
    filterPersonnel();
  }, [search, personnel, filterRank, currentFilterCard]);

  // Function to get rank image URL from personnel data
  const getRankImageUrl = (rankImagePath) => {
    if (!rankImagePath) return "";

    try {
      // If it's already a full URL, return it
      if (rankImagePath.startsWith("http")) {
        return rankImagePath;
      }

      // Otherwise, get the public URL from rank_images bucket
      const { data } = supabase.storage
        .from("rank_images")
        .getPublicUrl(rankImagePath);

      return data?.publicUrl || "";
    } catch (error) {
      console.error("Error getting rank image URL:", error);
      return "";
    }
  };

  const calculateYears = (dateString) => {
    if (!dateString) return 0;
    const today = new Date();
    const fromDate = new Date(dateString);
    const diff = today - fromDate;
    return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
  };

  const loadPromotionData = async () => {
    setLoading(true);
    try {
      // Get personnel data from Supabase
      const { data: personnelData, error } = await supabase
        .from("personnel")
        .select("*")
        .eq("is_active", true)
        .order("last_name", { ascending: true }); // Only load active personnel

      if (error) throw error;

      // Transform data to include promotion-specific fields
      const transformedData = personnelData.map((person) => ({
        id: person.id,
        firstName: person.first_name || "",
        middleName: person.middle_name || "",
        lastName: person.last_name || "",
        rank: person.rank || "FO1",
        lastRank: person.last_rank || person.rank || "FO1",
        photoURL: person.photo_url || "",
        dateHired: person.date_hired || "",
        lastPromoted: person.last_promoted || person.date_hired || "",
        // Get rank images from personnel table
        rankImage: getRankImageUrl(person.rank_image),
        lastRankImage: getRankImageUrl(person.rank_image), // Use same image for last rank
        badgeNumber: person.badge_number || "",
      }));

      setPersonnel(transformedData);
    } catch (error) {
      console.error("Error loading promotion data:", error);
      alert("Failed to load personnel data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Helper function for image error handling
  const handleImageError = (e, isPlaceholder = false) => {
    if (isPlaceholder) {
      // For placeholder images
      e.target.src = "/default-avatar.png"; // Use a local fallback
    } else {
      // For rank images
      e.target.onerror = null;
      e.target.style.display = "none";
      const placeholder = e.target.parentNode.querySelector(
        `.${styles.rankPlaceholder}`
      );
      if (placeholder) {
        placeholder.style.display = "flex";
      }
    }
  };

  // Filtering logic
  const applyFilters = (items) => {
    let filtered = [...items];

    // Card filter
    if (currentFilterCard === "eligible") {
      filtered = filtered.filter((person) => {
        const lastPromoted = person.lastPromoted || person.dateHired || "";
        const yearsInRank = calculateYears(lastPromoted);
        return yearsInRank >= 2;
      });
    } else if (currentFilterCard === "not-eligible") {
      filtered = filtered.filter((person) => {
        const lastPromoted = person.lastPromoted || person.dateHired || "";
        const yearsInRank = calculateYears(lastPromoted);
        return yearsInRank < 2;
      });
    }

    // Text filters
    const searchTerm = search.trim().toLowerCase();
    const rankFilter = filterRank.trim().toLowerCase();

    filtered = filtered.filter((person) => {
      const firstName = person.firstName || "";
      const middleName = person.middleName || "";
      const lastName = person.lastName || "";
      const rank = person.rank || "";
      const badgeNumber = person.badgeNumber || "";

      const text =
        `${firstName} ${middleName} ${lastName} ${rank} ${badgeNumber}`.toLowerCase();
      const rankMatch = !rankFilter || rank.toLowerCase().includes(rankFilter);
      const searchMatch = !searchTerm || text.includes(searchTerm);

      return rankMatch && searchMatch;
    });

    return filtered;
  };

  const filterPersonnel = () => {
    const filtered = applyFilters(personnel);
    setFilteredPersonnel(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  };

  // Pagination logic
  const totalPages = Math.max(
    1,
    Math.ceil(filteredPersonnel.length / rowsPerPage)
  );
  const pageStart = (currentPage - 1) * rowsPerPage;
  const paginatedData = filteredPersonnel.slice(
    pageStart,
    pageStart + rowsPerPage
  );

  // Pagination buttons
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
        className={`${styles.QoPPaginationBtn} ${
          hasNoData ? styles.QoPDisabled : ""
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
        className={`${styles.QoPPaginationBtn} ${
          1 === currentPage ? styles.QoPActive : ""
        } ${hasNoData ? styles.QoPDisabled : ""}`}
        onClick={() => setCurrentPage(1)}
        disabled={hasNoData}
      >
        1
      </button>
    );

    // Show ellipsis after first page if needed
    if (currentPage > 3) {
      buttons.push(
        <span key="ellipsis1" className={styles.QoPPaginationEllipsis}>
          ...
        </span>
      );
    }

    // Show pages around current page
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
            className={`${styles.QoPPaginationBtn} ${
              i === currentPage ? styles.QoPActive : ""
            } ${hasNoData ? styles.QoPDisabled : ""}`}
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
        <span key="ellipsis2" className={styles.QoPPaginationEllipsis}>
          ...
        </span>
      );
    }

    // Always show last page if there is more than 1 page
    if (pageCount > 1) {
      buttons.push(
        <button
          key={pageCount}
          className={`${styles.QoPPaginationBtn} ${
            pageCount === currentPage ? styles.QoPActive : ""
          } ${hasNoData ? styles.QoPDisabled : ""}`}
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
        className={`${styles.QoPPaginationBtn} ${
          hasNoData ? styles.QoPDisabled : ""
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
    const lastPromoted = person.lastPromoted || person.dateHired || "";
    const yearsInRank = calculateYears(lastPromoted);
    return yearsInRank >= 2;
  }).length;
  const notEligibleItems = totalItems - eligibleItems;

  const handleCardClick = (filter) => {
    if (currentFilterCard === filter) {
      setCurrentFilterCard("total");
    } else {
      setCurrentFilterCard(filter);
    }
    setCurrentPage(1);
  };

  const promote = async (personId) => {
    const person = personnel.find((p) => p.id === personId);
    if (!person) {
      alert("Personnel not found!");
      return;
    }

    const newRankInput = document.getElementById(`next-rank-${personId}`);
    const newRank = newRankInput ? newRankInput.value.trim() : "";

    if (!newRank) {
      alert("Please select a valid rank.");
      return;
    }

    try {
      // Update person data with promotion information
      const updatedData = {
        last_rank: person.rank, // Store current rank as last_rank
        rank: newRank, // Set new rank
        last_promoted: new Date().toISOString().split("T")[0], // Set promotion date
        updated_at: new Date().toISOString(),
      };

      // Update in Supabase
      const { error } = await supabase
        .from("personnel")
        .update(updatedData)
        .eq("id", personId);

      if (error) throw error;

      // Update local state
      const updatedPersonnel = personnel.map((p) =>
        p.id === personId
          ? {
              ...p,
              lastRank: person.rank,
              rank: newRank,
              lastPromoted: new Date().toISOString().split("T")[0],
            }
          : p
      );
      setPersonnel(updatedPersonnel);

      alert(
        `Successfully promoted ${person.firstName} ${person.lastName} to ${newRank}!`
      );
    } catch (error) {
      console.error("Error promoting personnel:", error);
      alert("Failed to update personnel record. Please try again.");
    }
  };

  const viewAll = () => {
    setSearch("");
    setFilterRank("");
    setCurrentFilterCard("total");
  };

  // Rank progression logic
  const getNextRanks = (currentRank) => {
    const rankHierarchy = ["FO1", "FO2", "FO3", "SFO1", "SFO2", "SFO3", "SFO4"];
    const currentIndex = rankHierarchy.indexOf(currentRank);

    if (currentIndex === -1 || currentIndex === rankHierarchy.length - 1) {
      return []; // No next ranks available
    }

    return rankHierarchy.slice(currentIndex + 1);
  };

  // Get rank image for next rank
  const getNextRankImage = (nextRank) => {
    // Try to find if any personnel has this rank to get the image
    const personWithRank = personnel.find((p) => p.rank === nextRank);
    if (personWithRank && personWithRank.rankImage) {
      return personWithRank.rankImage;
    }
    return "";
  };

  if (loading) {
    return (
      <div className={`main-content ${isSidebarCollapsed ? "collapsed" : ""}`}>
        <div style={{ textAlign: "center", padding: "50px" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>📈</div>
          <h3
            style={{
              fontSize: "18px",
              fontWeight: "600",
              color: "#2b2b2b",
              marginBottom: "8px",
            }}
          >
            Loading Promotion Data
          </h3>
          <p style={{ fontSize: "14px", color: "#999" }}>
            Please wait while we load personnel information...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.QoPContainer}>
      <Title>Promotion | BFP Villanueva</Title>
      <Meta name="robots" content="noindex, nofollow" />

      <Hamburger />
      <Sidebar />
      <div className={`main-content ${isSidebarCollapsed ? "collapsed" : ""}`}>
        <h1 className={styles.QoPTitle}>Promotion Eligibility</h1>

        {/* Top Controls */}
        <div className={styles.QoPTopControls}>
          <div className={styles.QoPTableHeader}>
            <select
              className={styles.QoPFilterType}
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
              className={styles.QoPSearchBar}
              placeholder="🔍 Search personnel..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
            />

            <button onClick={viewAll} className={styles.QoPViewAllBtn}>
              View All
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className={styles.QoPSummary}>
          <button
            className={`${styles.QoPSummaryCard} ${styles.QoPTotal} ${
              currentFilterCard === "total" ? styles.QoPActive : ""
            }`}
            onClick={() => handleCardClick("total")}
          >
            <h3>Total Personnel</h3>
            <p>{totalItems}</p>
          </button>
          <button
            className={`${styles.QoPSummaryCard} ${styles.QoPEligible} ${
              currentFilterCard === "eligible" ? styles.QoPActive : ""
            }`}
            onClick={() => handleCardClick("eligible")}
          >
            <h3>Eligible</h3>
            <p>{eligibleItems}</p>
          </button>
          <button
            className={`${styles.QoPSummaryCard} ${styles.QoPNotEligible} ${
              currentFilterCard === "not-eligible" ? styles.QoPActive : ""
            }`}
            onClick={() => handleCardClick("not-eligible")}
          >
            <h3>Not Eligible</h3>
            <p>{notEligibleItems}</p>
          </button>
        </div>

        <div className={styles.QoPPaginationContainer}>
          {renderPaginationButtons()}
        </div>

        {/* Table */}
        <div className={styles.QoPTableWrapper}>
          <table className={styles.QoPTable}>
            <thead>
              <tr>
                <th>Photo</th>
                <th>First Name</th>
                <th>Middle Name</th>
                <th>Last Name</th>
                <th>Last Rank</th>
                <th>Current Rank</th>
                <th>Years in Rank</th>
                <th>Next Rank</th>
                <th>Eligibility Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan="10" className={styles.QoPNoData}>
                    <div style={{ fontSize: "48px", marginBottom: "16px" }}>
                      <span className={styles.animatedEmoji}>📈</span>
                    </div>
                    <h3>No Personnel Found</h3>
                    <p>
                      There are no personnel records matching your criteria.
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedData.map((person) => {
                  const firstName = person.firstName || "";
                  const middleName = person.middleName || "";
                  const lastName = person.lastName || "";
                  const rank = person.rank || "N/A";
                  const lastRank = person.lastRank || "—";
                  const photo = person.photoURL || "/default-avatar.png";
                  const dateHired = person.dateHired || "";
                  const lastPromoted = person.lastPromoted || dateHired;

                  const yearsInRank = calculateYears(lastPromoted);
                  const eligible = yearsInRank >= 2;
                  const nextRanks = getNextRanks(rank);
                  const nextRankImage = getNextRankImage(nextRanks[0] || "");

                  return (
                    <tr key={person.id} className={styles.QoPTableRow}>
                      <td>
                        <img
                          src={photo}
                          className={styles.QoPProfilePhoto}
                          alt={`${firstName} ${lastName}`}
                          onError={(e) => handleImageError(e, true)}
                        />
                      </td>
                      <td>{firstName}</td>
                      <td>{middleName}</td>
                      <td>{lastName}</td>

                      {/* Last Rank with Image */}
                      <td className={styles.rankCellColumn}>
                        <div className={styles.rankCell}>
                          {person.lastRankImage ? (
                            <>
                              <img
                                src={person.lastRankImage}
                                alt={lastRank}
                                className={styles.rankImage}
                                onError={(e) => handleImageError(e, false)}
                              />
                              <div
                                className={`${styles.rankPlaceholder} ${styles.hidden}`}
                              >
                                <span className={styles.rankPlaceholderText}>
                                  {lastRank ? lastRank.charAt(0) : "L"}
                                </span>
                              </div>
                            </>
                          ) : (
                            <div
                              className={`${styles.rankPlaceholder} ${styles.show}`}
                            >
                              <span className={styles.rankPlaceholderText}>
                                {lastRank ? lastRank.charAt(0) : "L"}
                              </span>
                            </div>
                          )}
                          <span className={styles.rankText}>{lastRank}</span>
                        </div>
                      </td>

                      {/* Current Rank with Image */}
                      <td className={styles.rankCellColumn}>
                        <div className={styles.rankCell}>
                          {person.rankImage ? (
                            <>
                              <img
                                src={person.rankImage}
                                alt={rank}
                                className={styles.rankImage}
                                onError={(e) => handleImageError(e, false)}
                              />
                              <div
                                className={`${styles.rankPlaceholder} ${styles.hidden}`}
                              >
                                <span className={styles.rankPlaceholderText}>
                                  {rank ? rank.charAt(0) : "R"}
                                </span>
                              </div>
                            </>
                          ) : (
                            <div
                              className={`${styles.rankPlaceholder} ${styles.show}`}
                            >
                              <span className={styles.rankPlaceholderText}>
                                {rank ? rank.charAt(0) : "R"}
                              </span>
                            </div>
                          )}
                          <span className={styles.rankText}>{rank}</span>
                        </div>
                      </td>

                      <td>{yearsInRank.toFixed(1)}</td>

                      {/* Next Rank with Image */}
                      <td className={styles.rankCellColumn}>
                        {eligible && nextRanks.length > 0 ? (
                          <div className={styles.rankCell}>
                            {nextRankImage ? (
                              <>
                                <img
                                  src={nextRankImage}
                                  alt={nextRanks[0]}
                                  className={styles.rankImage}
                                  onError={(e) => handleImageError(e, false)}
                                />
                                <div
                                  className={`${styles.rankPlaceholder} ${styles.hidden}`}
                                >
                                  <span className={styles.rankPlaceholderText}>
                                    {nextRanks[0]
                                      ? nextRanks[0].charAt(0)
                                      : "N"}
                                  </span>
                                </div>
                              </>
                            ) : (
                              <div
                                className={`${styles.rankPlaceholder} ${styles.show}`}
                              >
                                <span className={styles.rankPlaceholderText}>
                                  {nextRanks[0] ? nextRanks[0].charAt(0) : "N"}
                                </span>
                              </div>
                            )}
                            <select
                              className={styles.QoPRankInput}
                              id={`next-rank-${person.id}`}
                              defaultValue={nextRanks[0]}
                              style={{ marginLeft: "10px" }}
                            >
                              {nextRanks.map((nextRank) => (
                                <option key={nextRank} value={nextRank}>
                                  {nextRank}
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <div className={styles.rankCell}>
                            <div
                              className={`${styles.rankPlaceholder} ${styles.show}`}
                            >
                              <span className={styles.rankPlaceholderText}>
                                —
                              </span>
                            </div>
                            <span className={styles.rankText}>—</span>
                          </div>
                        )}
                      </td>

                      <td>
                        <span
                          className={`${styles.QoPStatus} ${
                            eligible
                              ? styles.QoPEligibleStatus
                              : styles.QoPNotEligibleStatus
                          }`}
                        >
                          {eligible ? "Eligible" : "Not Eligible"}
                          {eligible && ` (${yearsInRank.toFixed(1)} years)`}
                        </span>
                      </td>
                      <td>
                        {eligible && nextRanks.length > 0 ? (
                          <button
                            className={`${styles.QoPActionBtn} ${styles.QoPUpdateBtn}`}
                            onClick={() => promote(person.id)}
                          >
                            Promote
                          </button>
                        ) : eligible && nextRanks.length === 0 ? (
                          <span className={styles.QoPMaxRank}>Max Rank</span>
                        ) : (
                          "—"
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

export default Promotion;
