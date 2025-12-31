import React, { useState, useEffect } from "react";
import styles from "../styles/History.module.css";
import Sidebar from "../../Sidebar.jsx";
import Hamburger from "../../Hamburger.jsx";
import { useSidebar } from "../../SidebarContext.jsx";
import { Title, Meta } from "react-head";
import { supabase } from "../../../lib/supabaseClient.js";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const History = () => {
  const { isSidebarCollapsed } = useSidebar();
  const [historyRecords, setHistoryRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  // Load history records from personnel table (non-Active status)
  const loadHistoryRecords = async () => {
    try {
      setLoading(true);
      
      // Get personnel with non-Active status (Retired, Resigned, etc.)
      const { data, error } = await supabase
        .from("personnel")
        .select("*")
        .neq("status", "Active")
        .order("updated_at", { ascending: false });

      if (error) {
        console.error("Error loading history records:", error);
        toast.error("Failed to load history records");
        return;
      }

      // Transform data
      const transformedData = (data || []).map((person) => {
        const fullName = `${person.first_name || ''} ${person.middle_name || ''} ${person.last_name || ''}`.replace(/\s+/g, ' ').trim();
        
        return {
          id: person.id,
          personnel_id: person.id,
          first_name: person.first_name,
          middle_name: person.middle_name,
          last_name: person.last_name,
          full_name: fullName,
          badge_number: person.badge_number,
          rank: person.rank,
          designation: person.designation,
          station: person.station,
          birth_date: person.birth_date,
          date_hired: person.date_hired,
          retirement_date: person.retirement_date,
          photo_url: person.photo_url,
          status: person.status || "Separated",
          years_of_service: calculateYearsOfService(person.date_hired, person.retirement_date || person.updated_at),
          last_updated: person.updated_at,
          // Also get clearance info if available
          clearance_type: person.status === "Retired" ? "Retirement" : 
                         person.status === "Resigned" ? "Resignation" :
                         person.status === "Equipment Completed" ? "Equipment Completion" : 
                         person.status
        };
      });

      setHistoryRecords(transformedData);
    } catch (error) {
      console.error("Error loading history:", error);
      toast.error("Failed to load history data");
    } finally {
      setLoading(false);
    }
  };

  // Calculate years of service
  const calculateYearsOfService = (dateHired, separationDate) => {
    if (!dateHired) return 0;
    
    try {
      const hiredDate = new Date(dateHired);
      const endDate = separationDate ? new Date(separationDate) : new Date();
      
      if (isNaN(hiredDate.getTime()) || isNaN(endDate.getTime())) return 0;
      
      const diffMs = endDate - hiredDate;
      const years = diffMs / (1000 * 60 * 60 * 24 * 365.25);
      return Math.floor(years * 10) / 10; // Return with 1 decimal place
    } catch {
      return 0;
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "N/A";
      
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return "N/A";
    }
  };

  useEffect(() => {
    loadHistoryRecords();
  }, []);

  // Filter records
  const filteredRecords = historyRecords.filter((record) => {
    // Type filter
    if (filterType !== "all") {
      const recordStatus = record.status?.toLowerCase() || "";
      const filterTypeLower = filterType.toLowerCase();
      
      if (filterTypeLower === "retirement" && !recordStatus.includes("retire")) return false;
      if (filterTypeLower === "resignation" && !recordStatus.includes("resign")) return false;
      if (filterTypeLower === "equipment completion" && !recordStatus.includes("equipment")) return false;
    }
    
    // Search filter
    if (search.trim()) {
      const searchTerm = search.toLowerCase();
      const fullName = record.full_name.toLowerCase();
      const badge = record.badge_number?.toLowerCase() || "";
      const rank = record.rank?.toLowerCase() || "";
      const station = record.station?.toLowerCase() || "";
      
      return (
        fullName.includes(searchTerm) ||
        badge.includes(searchTerm) ||
        rank.includes(searchTerm) ||
        station.includes(searchTerm)
      );
    }
    
    return true;
  });

  // Pagination
  const totalPages = Math.ceil(filteredRecords.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedRecords = filteredRecords.slice(startIndex, startIndex + rowsPerPage);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // Reactivate personnel
  const handleReactivate = async (personnelId, personName) => {
    if (!window.confirm(`Are you sure you want to reactivate ${personName}?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from("personnel")
        .update({ 
          status: "Active",
          updated_at: new Date().toISOString()
        })
        .eq("id", personnelId);

      if (error) {
        console.error("Error reactivating personnel:", error);
        toast.error("Failed to reactivate personnel");
        return;
      }

      toast.success(`${personName} has been reactivated`);
      loadHistoryRecords(); // Reload the list
    } catch (error) {
      console.error("Error reactivating personnel:", error);
      toast.error("Failed to reactivate personnel");
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <Title>History | BFP Villanueva</Title>
        <Meta name="robots" content="noindex, nofollow" />
        <Hamburger />
        <Sidebar />
        <div className={`main-content ${isSidebarCollapsed ? "collapsed" : ""}`}>
          <div className={styles.loadingContainer}>
            <div className={styles.loadingIcon}>📜</div>
            <h3>Loading History Records</h3>
            <p>Please wait while we load the history data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Title>History | BFP Villanueva</Title>
      <Meta name="robots" content="noindex, nofollow" />
      
      <Hamburger />
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
      <Sidebar />
      
      <div className={`main-content ${isSidebarCollapsed ? "collapsed" : ""}`}>
        <div className={styles.header}>
          <h1>Personnel Separation History</h1>
          <p className={styles.subtitle}>
            View retired, resigned, and separated personnel records
          </p>
        </div>

        {/* Controls */}
        <div className={styles.controls}>
          <div className={styles.searchContainer}>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search by name, badge number, or station..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
          
          <div className={styles.filterContainer}>
            <select
              className={styles.filterSelect}
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="all">All Status</option>
              <option value="retirement">Retired</option>
              <option value="resignation">Resigned</option>
              <option value="equipment completion">Equipment Completed</option>
            </select>
          </div>
        </div>

        {/* Stats */}
        <div className={styles.stats}>
          <div className={styles.statCard}>
            <div className={styles.statIcon}>📜</div>
            <div className={styles.statContent}>
              <h3>Total Records</h3>
              <p className={styles.statNumber}>{historyRecords.length}</p>
            </div>
          </div>
          
          <div className={`${styles.statCard} ${styles.retiredCard}`}>
            <div className={styles.statIcon}>👴</div>
            <div className={styles.statContent}>
              <h3>Retired</h3>
              <p className={styles.statNumber}>
                {historyRecords.filter(r => r.status === "Retired").length}
              </p>
            </div>
          </div>
          
          <div className={`${styles.statCard} ${styles.resignedCard}`}>
            <div className={styles.statIcon}>👋</div>
            <div className={styles.statContent}>
              <h3>Resigned</h3>
              <p className={styles.statNumber}>
                {historyRecords.filter(r => r.status === "Resigned").length}
              </p>
            </div>
          </div>
          
          <div className={`${styles.statCard} ${styles.equipmentCard}`}>
            <div className={styles.statIcon}>🛠️</div>
            <div className={styles.statContent}>
              <h3>Equipment Completed</h3>
              <p className={styles.statNumber}>
                {historyRecords.filter(r => r.status === "Equipment Completed").length}
              </p>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className={styles.tableContainer}>
          {filteredRecords.length === 0 ? (
            <div className={styles.noRecords}>
              <div className={styles.noRecordsIcon}>📭</div>
              <h3>No History Records Found</h3>
              <p>
                {search || filterType !== "all"
                  ? "No records match your search criteria."
                  : "No retired or resigned personnel found. Approve a clearance request first."}
              </p>
            </div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Photo</th>
                  <th>Name</th>
                  <th>Badge</th>
                  <th>Rank</th>
                  <th>Station</th>
                  <th>Years of Service</th>
                  <th>Date Hired</th>
                  <th>Separation Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRecords.map((record) => (
                  <tr key={record.id} className={styles.tableRow}>
                    <td>
                      {record.photo_url ? (
                        <img
                          src={record.photo_url}
                          alt={record.full_name}
                          className={styles.photo}
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = "https://via.placeholder.com/50";
                          }}
                        />
                      ) : (
                        <div className={styles.photoPlaceholder}>
                          {record.first_name?.[0]}{record.last_name?.[0]}
                        </div>
                      )}
                    </td>
                    <td>
                      <div className={styles.nameCell}>
                        <strong>{record.full_name}</strong>
                        {record.designation && (
                          <span className={styles.designation}>{record.designation}</span>
                        )}
                      </div>
                    </td>
                    <td>{record.badge_number || "N/A"}</td>
                    <td>{record.rank || "N/A"}</td>
                    <td>{record.station || "N/A"}</td>
                    <td>
                      <span className={styles.yearsBadge}>
                        {record.years_of_service.toFixed(1)} years
                      </span>
                    </td>
                    <td>{formatDate(record.date_hired)}</td>
                    <td>
                      {record.retirement_date 
                        ? formatDate(record.retirement_date)
                        : formatDate(record.last_updated)}
                    </td>
                    <td>
                      <span className={`${styles.statusBadge} ${
                        record.status === "Retired" ? styles.retired :
                        record.status === "Resigned" ? styles.resigned :
                        record.status === "Equipment Completed" ? styles.equipment :
                        styles.other
                      }`}>
                        {record.status}
                      </span>
                    </td>
                    <td>
                      <button
                        className={styles.reactivateBtn}
                        onClick={() => handleReactivate(record.id, record.full_name)}
                        title="Reactivate this personnel"
                      >
                        Reactivate
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          
          {/* Simple Pagination */}
          {filteredRecords.length > rowsPerPage && (
            <div className={styles.pagination}>
              <button
                className={`${styles.paginationBtn} ${currentPage === 1 ? styles.disabled : ""}`}
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                Previous
              </button>
              <span className={styles.pageInfo}>
                Page {currentPage} of {totalPages}
              </span>
              <button
                className={`${styles.paginationBtn} ${currentPage === totalPages ? styles.disabled : ""}`}
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Next
              </button>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className={styles.instructions}>
          <h3>How to Add Records to History:</h3>
          <ol>
            <li>Go to <strong>Clearance System</strong></li>
            <li>Initiate a clearance request (Retirement, Resignation, or Equipment Completion)</li>
            <li>Approve the request by clicking "Approve" (status changes to "Completed")</li>
            <li>The personnel will automatically appear here with appropriate status</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default History;