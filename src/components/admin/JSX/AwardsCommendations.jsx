import React, { useState, useEffect } from "react";
import styles from "../styles/AwardsCommendations.module.css";
import Sidebar from "../../Sidebar";
import Hamburger from "../../Hamburger";
import { useSidebar } from "../../SidebarContext";
import { Title, Meta } from "react-head";
import { supabase } from "../../../lib/supabaseClient.js";

const AwardsCommendations = () => {
  const [awards, setAwards] = useState([]);
  const [loading, setLoading] = useState(true);
  const { isSidebarCollapsed } = useSidebar();

  // State variables for table functionality
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 5;
  const [search, setSearch] = useState("");
  const [filterAwardType, setFilterAwardType] = useState("");
  const [currentFilterCard, setCurrentFilterCard] = useState("total");

  const loadAwards = async () => {
    try {
      console.log("Loading awards from Supabase...");
      
      // Fetch personnel with their award documents
      const { data: personnelList, error: personnelError } = await supabase
        .from("personnel")
        .select("*")
        .order("last_name", { ascending: true });

      if (personnelError) {
        console.error("Error loading personnel:", personnelError);
        throw personnelError;
      }

      // Fetch all award/commendation documents
      const { data: documentsData, error: documentsError } = await supabase
        .from("personnel_documents")
        .select("*")
        .eq("category", "Award/Commendation")
        .order("uploaded_at", { ascending: false });

      if (documentsError) {
        console.error("Error loading documents:", documentsError);
        throw documentsError;
      }

      // Create a map of personnel by ID for quick lookup
      const personnelMap = {};
      personnelList?.forEach(personnel => {
        personnelMap[personnel.id] = personnel;
      });

      const awardsData = [];

      // Process each award document
      documentsData?.forEach(doc => {
        const personnel = personnelMap[doc.personnel_id];
        
        if (!personnel) {
          console.warn(`No personnel found for document ${doc.id}, personnel_id: ${doc.personnel_id}`);
          return;
        }

        const fullName = `${personnel.first_name || ""} ${personnel.middle_name || ""} ${
          personnel.last_name || ""
        }`.trim();
        const rank = personnel.rank || "N/A";
        const badge = personnel.badge_number || "N/A";
        
        // Determine award type - use record_type if available, otherwise infer from name
        let awardType = doc.record_type || "General";
        
        // If record_type is not set, infer from file name
        if (!doc.record_type || doc.record_type === "General") {
          const docName = doc.name?.toLowerCase() || "";
          
          if (docName.includes("medal") || docName.includes("medal of")) {
            awardType = "Medal";
          } else if (docName.includes("commendation")) {
            awardType = "Commendation";
          } else if (docName.includes("certificate") || docName.includes("certificate of")) {
            awardType = "Certificate";
          } else if (docName.includes("ribbon") || docName.includes("service ribbon")) {
            awardType = "Ribbon";
          } else if (docName.includes("badge") || docName.includes("special badge")) {
            awardType = "Badge";
          }
        }

        // Format date
        const dateTime = doc.uploaded_at 
          ? new Date(doc.uploaded_at).toLocaleString() 
          : "N/A";

        awardsData.push({
          id: doc.id,
          fullName,
          rank,
          badgeNumber: badge,
          awardName: doc.name,
          awardType: awardType,
          dateTime,
          downloadUrl: doc.file_url,
          fileName: doc.name,
          personnelId: doc.personnel_id,
          rawDocument: doc,
        });
      });

      console.log(`Loaded ${awardsData.length} awards from Supabase`);
      setAwards(awardsData);
      setLoading(false);
    } catch (error) {
      console.error("Error loading awards:", error);
      setAwards([]);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAwards();
  }, []);

  // Filtering & pagination logic
  function applyFilters(items) {
    let filtered = [...items];

    // Card filter
    if (currentFilterCard === "medal") {
      filtered = filtered.filter((i) => i.awardType.toLowerCase() === "medal");
    } else if (currentFilterCard === "commendation") {
      filtered = filtered.filter((i) =>
        i.awardType.toLowerCase().includes("commendation")
      );
    } else if (currentFilterCard === "certificate") {
      filtered = filtered.filter(
        (i) => i.awardType.toLowerCase() === "certificate"
      );
    } else if (currentFilterCard === "ribbon") {
      filtered = filtered.filter((i) => i.awardType.toLowerCase() === "ribbon");
    } else if (currentFilterCard === "badge") {
      filtered = filtered.filter((i) => i.awardType.toLowerCase() === "badge");
    }

    // Text filters
    const s = search.trim().toLowerCase();
    const typeFilter = filterAwardType.trim().toLowerCase();

    filtered = filtered.filter((i) => {
      const text =
        `${i.fullName} ${i.rank} ${i.badgeNumber} ${i.awardName} ${i.awardType} ${i.dateTime}`.toLowerCase();
      const typeMatch =
        !typeFilter || (i.awardType || "").toLowerCase().includes(typeFilter);
      const searchMatch = !s || text.includes(s);
      return typeMatch && searchMatch;
    });

    return filtered;
  }

  const filteredAwardsData = applyFilters(awards);
  const totalPages = Math.max(
    1,
    Math.ceil(filteredAwardsData.length / rowsPerPage)
  );
  const pageStart = (currentPage - 1) * rowsPerPage;
  const paginated = filteredAwardsData.slice(
    pageStart,
    pageStart + rowsPerPage
  );

  // Pagination function
  const renderPaginationButtons = () => {
    const pageCount = Math.max(
      1,
      Math.ceil(filteredAwardsData.length / rowsPerPage)
    );
    const hasNoData = filteredAwardsData.length === 0;

    const buttons = [];

    // Previous button
    buttons.push(
      <button
        key="prev"
        className={`${styles.ACSPaginationBtn} ${
          hasNoData ? styles.ACSDisabled : ""
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
        className={`${styles.ACSPaginationBtn} ${
          1 === currentPage ? styles.ACSActive : ""
        } ${hasNoData ? styles.ACSDisabled : ""}`}
        onClick={() => setCurrentPage(1)}
        disabled={hasNoData}
      >
        1
      </button>
    );

    // Show ellipsis after first page if needed
    if (currentPage > 3) {
      buttons.push(
        <span key="ellipsis1" className={styles.ACSPaginationEllipsis}>
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
            className={`${styles.ACSPaginationBtn} ${
              i === currentPage ? styles.ACSActive : ""
            } ${hasNoData ? styles.ACSDisabled : ""}`}
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
        <span key="ellipsis2" className={styles.ACSPaginationEllipsis}>
          ...
        </span>
      );
    }

    // Always show last page if there is more than 1 page
    if (pageCount > 1) {
      buttons.push(
        <button
          key={pageCount}
          className={`${styles.ACSPaginationBtn} ${
            pageCount === currentPage ? styles.ACSActive : ""
          } ${hasNoData ? styles.ACSDisabled : ""}`}
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
        className={`${styles.ACSPaginationBtn} ${
          hasNoData ? styles.ACSDisabled : ""
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
  const totalItems = awards.length;
  const medalItems = awards.filter(
    (i) => i.awardType.toLowerCase() === "medal"
  ).length;
  const commendationItems = awards.filter((i) =>
    i.awardType.toLowerCase().includes("commendation")
  ).length;
  const certificateItems = awards.filter(
    (i) => i.awardType.toLowerCase() === "certificate"
  ).length;
  const ribbonItems = awards.filter(
    (i) => i.awardType.toLowerCase() === "ribbon"
  ).length;
  const badgeItems = awards.filter(
    (i) => i.awardType.toLowerCase() === "badge"
  ).length;

  function handleCardClick(filter) {
    if (currentFilterCard === filter) {
      setCurrentFilterCard("total");
    } else {
      setCurrentFilterCard(filter);
    }
    setCurrentPage(1);
  }

  const handleDownload = async (award) => {
    try {
      console.log("Downloading award:", award.id, award.fileName);

      if (award.downloadUrl) {
        // Use the Supabase storage URL
        const link = document.createElement("a");
        link.href = award.downloadUrl;
        link.download = award.fileName;
        link.target = "_blank"; // Open in new tab for better UX
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        alert("Download link not available for this award.");
      }
    } catch (error) {
      console.error("Error downloading file:", error);
      alert("Error downloading file. Please try again.");
    }
  };

  const formatDateTime = (dateTimeString) => {
    if (!dateTimeString || dateTimeString === "N/A") return "N/A";

    try {
      const date = new Date(dateTimeString);
      return isNaN(date.getTime()) 
        ? "N/A" 
        : date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          });
    } catch {
      return "N/A";
    }
  };

  // Add a refresh button handler
  const handleRefresh = async () => {
    setLoading(true);
    await loadAwards();
  };

  if (loading) {
    return (
      <div className={styles.ACSAppContainer}>
        <Hamburger />
        <Sidebar />
        <div className={`main-content ${isSidebarCollapsed ? "collapsed" : ""}`}>
          <div className={styles.ACSLoading}>
            <p>Loading awards and commendations...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.ACSAppContainer}>
      <Title>Awards & Commendations | BFP Villanueva</Title>
      <Meta name="robots" content="noindex, nofollow" />

      <Hamburger />
      <Sidebar />
      <div className={`main-content ${isSidebarCollapsed ? "collapsed" : ""}`}>
        <div className={styles.ACSHeader}>
          <h1 className={styles.ACSTitle}>Awards & Commendations</h1>
          <button
            className={styles.ACSRefreshBtn}
            onClick={handleRefresh}
            title="Refresh awards list"
          >
            🔄 Refresh
          </button>
        </div>

        {/* Top Controls */}
        <div className={styles.ACSTopControls}>
          <div className={styles.ACSTableHeader}>
            <select
              className={styles.ACSFilterType}
              value={filterAwardType}
              onChange={(e) => {
                setFilterAwardType(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All Award Types</option>
              <option value="medal">Medal</option>
              <option value="commendation">Commendation</option>
              <option value="certificate">Certificate</option>
              <option value="ribbon">Ribbon</option>
              <option value="badge">Badge</option>
              <option value="general">General</option>
            </select>

            <input
              type="text"
              className={styles.ACSSearchBar}
              placeholder="🔍 Search awards..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>

        {/* Summary Cards */}
        <div className={styles.ACSSummary}>
          <button
            className={`${styles.ACSSummaryCard} ${styles.ACSTotal} ${
              currentFilterCard === "total" ? styles.ACSActive : ""
            }`}
            onClick={() => handleCardClick("total")}
          >
            <h3>Total Awards</h3>
            <p>{totalItems}</p>
          </button>
          <button
            className={`${styles.ACSSummaryCard} ${styles.ACSMedal} ${
              currentFilterCard === "medal" ? styles.ACSActive : ""
            }`}
            onClick={() => handleCardClick("medal")}
          >
            <h3>Medals</h3>
            <p>{medalItems}</p>
          </button>
          <button
            className={`${styles.ACSSummaryCard} ${styles.ACSCommendation} ${
              currentFilterCard === "commendation" ? styles.ACSActive : ""
            }`}
            onClick={() => handleCardClick("commendation")}
          >
            <h3>Commendations</h3>
            <p>{commendationItems}</p>
          </button>
          <button
            className={`${styles.ACSSummaryCard} ${styles.ACSCertificate} ${
              currentFilterCard === "certificate" ? styles.ACSActive : ""
            }`}
            onClick={() => handleCardClick("certificate")}
          >
            <h3>Certificates</h3>
            <p>{certificateItems}</p>
          </button>
          <button
            className={`${styles.ACSSummaryCard} ${styles.ACSRibbon} ${
              currentFilterCard === "ribbon" ? styles.ACSActive : ""
            }`}
            onClick={() => handleCardClick("ribbon")}
          >
            <h3>Ribbons</h3>
            <p>{ribbonItems}</p>
          </button>
          <button
            className={`${styles.ACSSummaryCard} ${styles.ACSBadge} ${
              currentFilterCard === "badge" ? styles.ACSActive : ""
            }`}
            onClick={() => handleCardClick("badge")}
          >
            <h3>Badges</h3>
            <p>{badgeItems}</p>
          </button>
        </div>

        {/* Table */}
        <div className={styles.ACSTableContainer}>
          <div className={styles.ACSPaginationContainer}>
            {renderPaginationButtons()}
          </div>

          <table className={styles.ACSTable}>
            <thead>
              <tr>
                <th>Employee Name</th>
                <th>Rank</th>
                <th>Badge No.</th>
                <th>Award/Commendation</th>
                <th>Award Type</th>
                <th>Date & Time Uploaded</th>
                <th>Download</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan="7" className={styles.ACSNoAwardsTable}>
                    <div style={{ fontSize: "48px", marginBottom: "16px" }}>
                      <span className={styles.animatedEmoji}>🏆</span>
                    </div>
                    <h3>No Awards & Commendations Found</h3>
                    <p>There are no awards or commendations uploaded yet.</p>
                    <button
                      className={styles.ACSRefreshBtn}
                      onClick={handleRefresh}
                      style={{ marginTop: "20px" }}
                    >
                      Refresh List
                    </button>
                  </td>
                </tr>
              ) : (
                paginated.map((award) => (
                  <tr key={award.id} className={styles.ACSTableRow}>
                    <td>{award.fullName}</td>
                    <td>{award.rank}</td>
                    <td>{award.badgeNumber}</td>
                    <td className={styles.ACSAwardName}>{award.awardName}</td>
                    <td>
                      <span
                        className={`${styles.ACSStatus} ${
                          styles[award.awardType.toLowerCase().replace(" ", "")]
                        }`}
                      >
                        {award.awardType}
                      </span>
                    </td>
                    <td className={styles.ACSDateTime}>
                      {formatDateTime(award.dateTime)}
                    </td>
                    <td>
                      <button
                        className={styles.ACSDownloadLink}
                        onClick={() => handleDownload(award)}
                        title={`Download ${award.awardName}`}
                      >
                        📥 Download
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {paginated.length > 0 && (
            <div className={styles.ACSPaginationContainer}>
              {renderPaginationButtons()}
            </div>
          )}
        </div>

        {/* Info panel */}
        <div className={styles.ACSInfoPanel}>
          <p>
            <strong>Total Records:</strong> {awards.length} awards
          </p>
          <p>
            <strong>Filtered:</strong> {filteredAwardsData.length} awards
          </p>
          <p>
            <strong>Current Page:</strong> {currentPage} of {totalPages}
          </p>
        </div>
      </div>
    </div>
  );
};

export default AwardsCommendations;