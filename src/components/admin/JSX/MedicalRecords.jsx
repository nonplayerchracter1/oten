import React, { useState, useEffect, useRef } from "react"; // Added useRef
import styles from "../styles/MedicalRecords.module.css";
import Sidebar from "../../Sidebar.jsx";
import Hamburger from "../../Hamburger.jsx";
import { useSidebar } from "../../SidebarContext.jsx";
import { Title, Meta } from "react-head";
import { supabase } from "../../../lib/supabaseClient.js";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const MedicalRecords = () => {
  const [medicalRecords, setMedicalRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const { isSidebarCollapsed } = useSidebar();

  // State variables for table functionality
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 5;
  const [search, setSearch] = useState("");
  const [filterRecordType, setFilterRecordType] = useState("");
  const [currentFilterCard, setCurrentFilterCard] = useState("total");

  // Load medical records from Supabase
  useEffect(() => {
    loadMedicalRecords();
  }, []);

  // Update the loadMedicalRecords function to properly fetch rank images
  const loadMedicalRecords = async () => {
    try {
      setLoading(true);

      // Fetch only medical records (category = 'Medical Record')
      const { data, error } = await supabase
        .from("personnel_documents")
        .select(
          `
          *,
          personnel (
            first_name,
            middle_name,
            last_name,
            rank,
            rank_image,
            designation
          )
        `
        )
        .eq("category", "Medical Record")
        .order("uploaded_at", { ascending: false });

      if (error) throw error;

      // Transform the data with rank images
      const transformedRecords = await Promise.all(
        (data || []).map(async (record) => {
          const personnel = record.personnel || {};

          // Get rank image URL
          let rankImageUrl = "";
          if (personnel.rank_image) {
            try {
              // Check if it's already a full URL
              if (personnel.rank_image.startsWith("http")) {
                rankImageUrl = personnel.rank_image;
              } else {
                // Get public URL from rank_images bucket
                const { data: imageData } = supabase.storage
                  .from("rank_images")
                  .getPublicUrl(personnel.rank_image);
                rankImageUrl = imageData?.publicUrl || "";
              }
            } catch (imgError) {
              console.warn("Error loading rank image:", imgError);
              rankImageUrl = "";
            }
          }

          // Determine record type
          let recordType = record.record_type || "General";
          if (recordType === "General") {
            const docName = record.name?.toLowerCase() || "";
            if (docName.includes("dental")) {
              recordType = "Dental";
            } else if (
              docName.includes("checkup") ||
              docName.includes("medical")
            ) {
              recordType = "Checkup";
            } else if (docName.includes("lab") || docName.includes("test")) {
              recordType = "Lab Test";
            } else if (
              docName.includes("imaging") ||
              docName.includes("x-ray") ||
              docName.includes("mri") ||
              docName.includes("scan")
            ) {
              recordType = "Imaging";
            }
          }

          return {
            id: record.id,
            name: `${personnel.first_name || ""} ${
              personnel.middle_name || ""
            } ${personnel.last_name || ""}`
              .replace(/\s+/g, " ")
              .trim(),
            rank: personnel.rank || "",
            rankImage: rankImageUrl,
            designation: personnel.designation || "",
            recordName: record.name,
            recordType: recordType,
            dateUploaded: record.uploaded_at
              ? new Date(record.uploaded_at).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })
              : new Date().toLocaleDateString(),
            downloadUrl: record.file_url,
            fileName: record.name,
            personnelId: record.personnel_id,
            filePath: record.file_path,
            fileSize: record.file_size,
            description: record.description,
            uploadDate: record.uploaded_at,
          };
        })
      );

      console.log("Loaded medical records:", transformedRecords.length);
      setMedicalRecords(transformedRecords);
    } catch (error) {
      console.error("Error loading medical records:", error);
      toast.error("Failed to load medical records");
    } finally {
      setLoading(false);
    }
  };

  // Filtering & pagination logic
  function applyFilters(items) {
    let filtered = [...items];

    // Card filter
    if (currentFilterCard === "checkup") {
      filtered = filtered.filter(
        (i) => i.recordType.toLowerCase() === "checkup"
      );
    } else if (currentFilterCard === "lab") {
      filtered = filtered.filter((i) =>
        i.recordType.toLowerCase().includes("lab")
      );
    } else if (currentFilterCard === "imaging") {
      filtered = filtered.filter(
        (i) => i.recordType.toLowerCase() === "imaging"
      );
    } else if (currentFilterCard === "dental") {
      filtered = filtered.filter(
        (i) => i.recordType.toLowerCase() === "dental"
      );
    }

    // Text filters
    const s = search.trim().toLowerCase();
    const typeFilter = filterRecordType.trim().toLowerCase();

    filtered = filtered.filter((i) => {
      const text =
        `${i.name} ${i.rank} ${i.designation} ${i.recordName} ${i.recordType} ${i.dateUploaded}`.toLowerCase();
      const typeMatch =
        !typeFilter || (i.recordType || "").toLowerCase().includes(typeFilter);
      const searchMatch = !s || text.includes(s);
      return typeMatch && searchMatch;
    });

    return filtered;
  }

  const filteredMedicalData = applyFilters(medicalRecords);
  const totalPages = Math.max(
    1,
    Math.ceil(filteredMedicalData.length / rowsPerPage)
  );
  const pageStart = (currentPage - 1) * rowsPerPage;
  const paginated = filteredMedicalData.slice(
    pageStart,
    pageStart + rowsPerPage
  );

  // Pagination function
  const renderPaginationButtons = () => {
    const pageCount = Math.max(
      1,
      Math.ceil(filteredMedicalData.length / rowsPerPage)
    );
    const hasNoData = filteredMedicalData.length === 0;

    const buttons = [];

    // Previous button
    buttons.push(
      <button
        key="prev"
        className={`${styles.MDRPaginationBtn} ${
          hasNoData ? styles.MDRDisabled : ""
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
        className={`${styles.MDRPaginationBtn} ${
          1 === currentPage ? styles.MDRActive : ""
        } ${hasNoData ? styles.MDRDisabled : ""}`}
        onClick={() => setCurrentPage(1)}
        disabled={hasNoData}
      >
        1
      </button>
    );

    // Show ellipsis after first page if needed
    if (currentPage > 3) {
      buttons.push(
        <span key="ellipsis1" className={styles.MDRPaginationEllipsis}>
          ...
        </span>
      );
    }

    // Show pages around current page
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
            className={`${styles.MDRPaginationBtn} ${
              i === currentPage ? styles.MDRActive : ""
            } ${hasNoData ? styles.MDRDisabled : ""}`}
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
        <span key="ellipsis2" className={styles.MDRPaginationEllipsis}>
          ...
        </span>
      );
    }

    if (pageCount > 1) {
      buttons.push(
        <button
          key={pageCount}
          className={`${styles.MDRPaginationBtn} ${
            pageCount === currentPage ? styles.MDRActive : ""
          } ${hasNoData ? styles.MDRDisabled : ""}`}
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
        className={`${styles.MDRPaginationBtn} ${
          hasNoData ? styles.MDRDisabled : ""
        }`}
        disabled={currentPage === pageCount || hasNoData}
        onClick={() => setCurrentPage(Math.min(pageCount, currentPage + 1))}
      >
        Next
      </button>
    );

    return buttons;
  };

  // Handle download
  const handleDownload = async (record) => {
    try {
      console.log("Downloading medical record:", record.id, record.fileName);

      if (record.downloadUrl) {
        // Create a temporary link and trigger download
        const link = document.createElement("a");
        link.href = record.downloadUrl;
        link.download = record.fileName || "medical_record";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast.success("Download started");
      } else {
        toast.error("No download URL available");
      }
    } catch (error) {
      console.error("Error downloading file:", error);
      toast.error("Error downloading file");
    }
  };

  // Summary numbers
  const totalItems = medicalRecords.length;
  const checkupItems = medicalRecords.filter(
    (i) => i.recordType.toLowerCase() === "checkup"
  ).length;
  const labItems = medicalRecords.filter((i) =>
    i.recordType.toLowerCase().includes("lab")
  ).length;
  const imagingItems = medicalRecords.filter(
    (i) => i.recordType.toLowerCase() === "imaging"
  ).length;
  const dentalItems = medicalRecords.filter(
    (i) => i.recordType.toLowerCase() === "dental"
  ).length;

  function handleCardClick(filter) {
    if (currentFilterCard === filter) {
      setCurrentFilterCard("total");
    } else {
      setCurrentFilterCard(filter);
    }
    setCurrentPage(1);
  }

  const parseFilenamePath = (filename) => {
    if (!filename) return [];

    // Try to parse as date-based filename
    const dateMatch = filename.match(/(\d{4})[-_](\d{2})[-_](\d{2})/);
    const nameParts = filename.split(/[_\-\.]/);

    return nameParts.map((part, index) => ({
      part,
      type:
        index === 0
          ? "prefix"
          : index === nameParts.length - 1
          ? "extension"
          : dateMatch && dateMatch.index === part.length
          ? "date"
          : "segment",
    }));
  };

  // Utility function for truncation
  const truncateText = (text, maxLength = 30) => {
    if (!text) return "";
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  // Enhanced RecordNameCell with smart positioning
  const RecordNameCell = ({ recordName, rowIndex, totalRows }) => {
    const [isHovered, setIsHovered] = useState(false);
    const [tooltipPosition, setTooltipPosition] = useState("bottom");
    const cellRef = useRef(null);

    // Calculate if we're near the bottom of the table
    const isNearBottom = rowIndex > totalRows - 3; // Last 3 rows

    // Update position on hover
    useEffect(() => {
      if (isHovered && cellRef.current) {
        const rect = cellRef.current.getBoundingClientRect();
        const viewportHeight = window.innerHeight;

        // Check if there's enough space below the cell
        const spaceBelow = viewportHeight - rect.bottom;
        const tooltipHeight = 100; // Estimated tooltip height

        // If near bottom of viewport OR near bottom of table, show tooltip on top
        if (spaceBelow < tooltipHeight + 20 || isNearBottom) {
          setTooltipPosition("top");
        } else {
          setTooltipPosition("bottom");
        }
      }
    }, [isHovered, rowIndex, isNearBottom]);

    const showTooltip = recordName && recordName.length > 30 && isHovered;

    return (
      <div ref={cellRef} className={styles.recordNameCell}>
        <div
          className={styles.recordNameWrapper}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          title={recordName}
        >
          <span className={styles.truncatedText}>
            {truncateText(recordName, 30)}
          </span>
          {recordName && recordName.length > 30 && (
            <span className={styles.fullLengthIndicator}>…</span>
          )}
        </div>

        {showTooltip && (
          <div className={`${styles.tooltip} ${styles[tooltipPosition]}`}>
            <div className={styles.tooltipContent}>
              <span className={styles.tooltipText}>{recordName}</span>
              <span className={styles.tooltipArrow}></span>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className={`main-content ${isSidebarCollapsed ? "collapsed" : ""}`}>
        <div className={styles.loadingContainer}>
          <p>Loading medical records...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.MDRAppContainer}>
      <Title>Medical Records | BFP Villanueva</Title>
      <Meta name="robots" content="noindex, nofollow" />

      <Hamburger />
      <Sidebar />

      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />

      <div className={`main-content ${isSidebarCollapsed ? "collapsed" : ""}`}>
        <h1 className={styles.MDRTitle}>Medical Records of Personnel</h1>

        {/* Top Controls */}
        <div className={styles.MDRTopControls}>
          <div className={styles.MDRTableHeader}>
            <select
              className={styles.MDRFilterType}
              value={filterRecordType}
              onChange={(e) => {
                setFilterRecordType(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All Record Types</option>
              <option value="Checkup">Checkup</option>
              <option value="Lab Test">Lab Test</option>
              <option value="Imaging">Imaging</option>
              <option value="Dental">Dental</option>
              <option value="General">General</option>
            </select>

            <input
              type="text"
              className={styles.MDRSearchBar}
              placeholder="🔍 Search medical records..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>

        {/* Summary Cards */}
        <div className={styles.MDRSummary}>
          <button
            className={`${styles.MDRSummaryCard} ${styles.MDRTotal} ${
              currentFilterCard === "total" ? styles.MDRActive : ""
            }`}
            onClick={() => handleCardClick("total")}
          >
            <h3>Total Records</h3>
            <p>{totalItems}</p>
          </button>
          <button
            className={`${styles.MDRSummaryCard} ${styles.MDRCheckup} ${
              currentFilterCard === "checkup" ? styles.MDRActive : ""
            }`}
            onClick={() => handleCardClick("checkup")}
          >
            <h3>Checkups</h3>
            <p>{checkupItems}</p>
          </button>
          <button
            className={`${styles.MDRSummaryCard} ${styles.MDRLab} ${
              currentFilterCard === "lab" ? styles.MDRActive : ""
            }`}
            onClick={() => handleCardClick("lab")}
          >
            <h3>Lab Tests</h3>
            <p>{labItems}</p>
          </button>
          <button
            className={`${styles.MDRSummaryCard} ${styles.MDRImaging} ${
              currentFilterCard === "imaging" ? styles.MDRActive : ""
            }`}
            onClick={() => handleCardClick("imaging")}
          >
            <h3>Imaging</h3>
            <p>{imagingItems}</p>
          </button>
          <button
            className={`${styles.MDRSummaryCard} ${styles.MDRDental} ${
              currentFilterCard === "dental" ? styles.MDRActive : ""
            }`}
            onClick={() => handleCardClick("dental")}
          >
            <h3>Dental</h3>
            <p>{dentalItems}</p>
          </button>
        </div>
        <div className={styles.MDRPaginationContainer}>
          {renderPaginationButtons()}
        </div>

        {/* Table with Scrollable Container */}
        <div className={styles.MDRTableScrollContainer}>
          <div className={styles.MDRPaginationContainer}></div>

          <table className={styles.MDRTable}>
            <thead>
              <tr>
                {" "}
                <th>Rank</th>
                <th>Name</th>
                <th>Designation</th>
                <th>Record Name</th>
                <th>Record Type</th>
                <th>Date Uploaded</th>
                <th>File Size</th>
                <th>Download</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan="8" className={styles.MDRNoRequestsTable}>
                    <div style={{ fontSize: "48px", marginBottom: "16px" }}>
                      <span className={styles.animatedEmoji}>🏥</span>
                    </div>
                    <h3>No Medical Records Found</h3>
                    <p>There are no medical records uploaded yet.</p>
                  </td>
                </tr>
              ) : (
                paginated.map(
                  (
                    record,
                    index // Added index parameter
                  ) => (
                    <tr key={record.id} className={styles.MDRTableRow}>
                      {/* In your table row rendering: */}
                      <td className={styles.rankCellColumn}>
                        <div className={styles.rankCell}>
                          {record.rankImage ? (
                            <img
                              src={record.rankImage}
                              alt={record.rank || "Rank"}
                              className={styles.rankImage}
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.style.display = "none";
                                e.target.parentNode.querySelector(
                                  ".rankPlaceholder"
                                ).style.display = "flex";
                              }}
                            />
                          ) : null}
                          <div
                            className={`${styles.rankPlaceholder} ${
                              record.rankImage ? "" : styles.show
                            }`}
                            style={{
                              display: record.rankImage ? "none" : "flex",
                            }}
                          >
                            <span className={styles.rankPlaceholderText}>
                              {record.rank?.charAt(0) || "R"}
                            </span>
                          </div>
                          <span className={styles.rankText}>
                            {record.rank || "No Rank"}
                          </span>
                        </div>
                      </td>
                      <td>{record.name}</td>

                      <td>{record.designation}</td>
                      <td className={styles.tableCellWithTooltip}>
                        <RecordNameCell
                          recordName={record.recordName}
                          rowIndex={index} // Added prop
                          totalRows={paginated.length} // Added prop
                        />
                      </td>
                      <td>
                        <span
                          className={`${styles.MDRStatus} ${
                            styles[
                              record.recordType.toLowerCase().replace(" ", "")
                            ]
                          }`}
                        >
                          {record.recordType}
                        </span>
                      </td>
                      <td>{record.dateUploaded}</td>
                      <td>
                        {record.fileSize
                          ? `${Math.round(record.fileSize / 1024)} KB`
                          : "N/A"}
                      </td>
                      <td>
                        <button
                          className={styles.MDRDownloadLink}
                          onClick={() => handleDownload(record)}
                          disabled={!record.downloadUrl}
                        >
                          📥 Download
                        </button>
                      </td>
                    </tr>
                  )
                )
              )}
            </tbody>
          </table>
        </div>
        <div className={styles.MDRPaginationContainerBottom}>
          {renderPaginationButtons()}
        </div>
      </div>
    </div>
  );
};

export default MedicalRecords;
