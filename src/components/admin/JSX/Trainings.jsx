// Trainings.jsx
import React, { useState, useEffect } from "react";
import styles from "../styles/Trainings.module.css";
import Sidebar from "../../Sidebar.jsx";
import Hamburger from "../../Hamburger.jsx";
import { useSidebar } from "../../SidebarContext.jsx";
import { Title, Meta } from "react-head";
import { supabase } from "../../../lib/supabaseClient.js";

const Trainings = () => {
  const [trainings, setTrainings] = useState([]);
  const [personnel, setPersonnel] = useState([]);
  const [loading, setLoading] = useState(true);
  const { isSidebarCollapsed } = useSidebar();

  // State variables for table functionality
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 5;
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [currentFilterCard, setCurrentFilterCard] = useState("total");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTraining, setEditingTraining] = useState(null);
  const [formData, setFormData] = useState({
    personnelId: "",
    fullName: "",
    rank: "",
    dateOfTraining: "",
    days: "",
    status: "Pending",
    certificateUrl: "",
  });

  // File upload states
  const [certificateFile, setCertificateFile] = useState(null);
  const [certificateFileName, setCertificateFileName] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState("");

  useEffect(() => {
    loadPersonnel();
    loadTrainings();
  }, []);

  // Load personnel from Supabase
  const loadPersonnel = async () => {
    try {
      const { data, error } = await supabase
        .from('personnel')
        .select('*')
        .eq('is_active', true)
        .order('last_name', { ascending: true });

      if (error) {
        console.error("Error loading personnel:", error);
        return;
      }

      setPersonnel(data || []);
    } catch (error) {
      console.error("Error in loadPersonnel:", error);
    }
  };

  // Load trainings from Supabase with personnel data
  const loadTrainings = async () => {
    try {
      setLoading(true);
      
      // First, get all trainings
      const { data: trainingsData, error: trainingsError } = await supabase
        .from('trainings')
        .select('*')
        .order('created_at', { ascending: false });

      if (trainingsError) {
        console.error("Error loading trainings:", trainingsError);
        
        // Check if table doesn't exist
        if (trainingsError.message.includes('does not exist')) {
          await createTrainingsTable();
          setTrainings([]);
          setLoading(false);
          return;
        }
        
        return;
      }

      // Get personnel data for each training
      const trainingsWithPersonnel = await Promise.all(
        (trainingsData || []).map(async (training) => {
          try {
            // Get personnel info
            const { data: personnelData, error: personnelError } = await supabase
              .from('personnel')
              .select('*')
              .eq('id', training.personnel_id)
              .single();

            if (personnelError) {
              console.error("Error loading personnel for training:", personnelError);
              return {
                id: training.id,
                name: 'Unknown',
                rank: 'Unknown',
                date: training.training_date || '',
                days: training.duration_days || '',
                status: training.status || 'Pending',
                personnelId: training.personnel_id,
                certificateUrl: training.certificate_url || '',
                created_at: training.created_at,
              };
            }

            const fullName = `${personnelData.first_name} ${personnelData.middle_name || ''} ${personnelData.last_name}`.trim();

            return {
              id: training.id,
              name: fullName,
              rank: personnelData.rank || 'Unknown',
              date: training.training_date || '',
              days: training.duration_days || '',
              status: training.status || 'Pending',
              personnelId: training.personnel_id,
              certificateUrl: training.certificate_url || '',
              created_at: training.created_at,
            };
          } catch (error) {
            console.error("Error processing training:", error);
            return {
              id: training.id,
              name: 'Error Loading',
              rank: 'Error',
              date: training.training_date || '',
              days: training.duration_days || '',
              status: training.status || 'Pending',
              personnelId: training.personnel_id,
              certificateUrl: training.certificate_url || '',
              created_at: training.created_at,
            };
          }
        })
      );

      setTrainings(trainingsWithPersonnel);
      setLoading(false);
    } catch (error) {
      console.error("Error in loadTrainings:", error);
      setLoading(false);
    }
  };

  // Create trainings table if it doesn't exist
  const createTrainingsTable = async () => {
    try {
      console.log("Creating trainings table...");
      
      // Run SQL to create table via REST API
      const response = await fetch(`https://wqjzbyblmcrxafcbljij.supabase.co/rest/v1/`, {
        method: 'POST',
        headers: {
          'apikey': process.env.REACT_APP_SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            CREATE TABLE IF NOT EXISTS trainings (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              personnel_id UUID NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
              training_date DATE NOT NULL,
              duration_days INTEGER NOT NULL CHECK (duration_days > 0 AND duration_days <= 365),
              status VARCHAR(50) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Ongoing', 'Completed', 'Cancelled')),
              certificate_url VARCHAR(500),
              created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
              updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
              notes TEXT,
              training_name VARCHAR(255),
              training_type VARCHAR(100),
              organizer VARCHAR(255),
              location VARCHAR(255)
            );
            
            -- Enable RLS
            ALTER TABLE trainings ENABLE ROW LEVEL SECURITY;
            
            -- Create policy for all operations
            CREATE POLICY "Enable all operations for anon users" ON trainings
              FOR ALL USING (true) WITH CHECK (true);
          `
        })
      });
      
      console.log("Table creation response:", response);
    } catch (error) {
      console.error("Error creating table:", error);
    }
  };

  // Handle file selection for certificate
  const handleCertificateChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      const allowedTypes = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/jpg',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ];
      
      const fileExtension = file.name.split('.').pop().toLowerCase();
      const isValidType = allowedTypes.includes(file.type) || 
                         ['pdf', 'jpeg', 'jpg', 'png', 'doc', 'docx'].includes(fileExtension);
      
      if (!isValidType) {
        alert('Please select a PDF, image, or Word document (PDF, JPEG, PNG, DOC, DOCX)');
        return;
      }
      
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert('Certificate file size should be less than 10MB');
        return;
      }
      
      setCertificateFile(file);
      setCertificateFileName(file.name);
      setUploadError("");
    }
  };

  // Upload file to Supabase Storage - FIXED VERSION
  const uploadFile = async (file, folderName) => {
    try {
      setUploadError("");
      
      // Create unique filename
      const fileExt = file.name.split('.').pop();
      const uniqueFileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      const filePath = `${folderName}/${uniqueFileName}`;

      console.log('Uploading file:', file.name, 'to:', filePath);

      // Try to upload file
      const { data, error } = await supabase.storage
        .from('training-files')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('Upload error details:', error);
        
        // If RLS error, try to fix storage policy
        if (error.message.includes('row-level security policy')) {
          setUploadError("Storage RLS policy is blocking uploads. Certificate upload disabled.");
          
          // Create a data URL as fallback
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              resolve(reader.result); // Data URL
            };
            reader.readAsDataURL(file);
          });
        }
        
        throw error;
      }

      console.log('File uploaded successfully:', data);

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('training-files')
        .getPublicUrl(filePath);

      console.log('Public URL generated:', publicUrl);
      return publicUrl;
    } catch (error) {
      console.error('Error in uploadFile:', error);
      setUploadError(`Upload failed: ${error.message}`);
      throw error;
    }
  };

  // Delete file from Supabase Storage
  const deleteFile = async (url) => {
    if (!url) return;
    
    try {
      // Check if it's a data URL (starts with data:)
      if (url.startsWith('data:')) {
        console.log('Skipping deletion of data URL');
        return;
      }
      
      // Extract the file path from the URL
      const urlParts = url.split('/');
      const bucketIndex = urlParts.indexOf('training-files');
      
      if (bucketIndex === -1) {
        console.error('Invalid URL format for storage file');
        return;
      }
      
      const filePath = urlParts.slice(bucketIndex + 1).join('/');
      
      console.log('Deleting file from path:', filePath);
      
      const { error } = await supabase.storage
        .from('training-files')
        .remove([filePath]);

      if (error) {
        console.error('Error deleting file:', error);
      } else {
        console.log('File deleted successfully');
      }
    } catch (error) {
      console.error('Error in deleteFile:', error);
    }
  };

  const handleInputChange = (e) => {
    const { id, value } = e.target;

    if (id === "personnelId") {
      const selectedPerson = personnel.find((p) => p.id === value);

      if (selectedPerson) {
        const fullName = `${selectedPerson.first_name} ${selectedPerson.middle_name || ''} ${selectedPerson.last_name}`.trim();

        setFormData((prev) => ({
          ...prev,
          personnelId: value,
          fullName: fullName,
          rank: selectedPerson.rank || '',
        }));
      }
    } else {
      setFormData((prev) => ({
        ...prev,
        [id]: value,
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setUploadProgress(0);
      setUploadError("");
      
      let certificateUrl = formData.certificateUrl;

      // Upload certificate if selected
      if (certificateFile) {
        try {
          setUploadProgress(30);
          certificateUrl = await uploadFile(certificateFile, 'certificates');
          setUploadProgress(80);
          
          if (uploadError && uploadError.includes('RLS')) {
            console.log('Using data URL due to RLS restrictions');
          }
        } catch (uploadError) {
          console.error('Certificate upload failed:', uploadError);
          // Continue without certificate
        }
      }

      const trainingData = {
        personnel_id: formData.personnelId,
        training_date: formData.dateOfTraining,
        duration_days: parseInt(formData.days, 10) || 1,
        status: formData.status,
        certificate_url: certificateUrl || null,
        updated_at: new Date().toISOString(),
      };

      console.log('Saving training data:', trainingData);

      if (editingTraining !== null) {
        // Update training
        const { error } = await supabase
          .from('trainings')
          .update(trainingData)
          .eq('id', editingTraining.id);

        if (error) {
          console.error("Error updating training:", error);
          
          // Check for RLS issue
          if (error.message.includes('row-level security')) {
            alert('Database RLS policy is blocking updates. Please check your Supabase RLS settings.');
          } else {
            alert('Failed to update training. Please try again.');
          }
          return;
        }

        // Delete old certificate if it exists and we're uploading a new one
        if (certificateFile && formData.certificateUrl && !formData.certificateUrl.startsWith('data:')) {
          // Do this after successful update
          setTimeout(() => {
            deleteFile(formData.certificateUrl);
          }, 1000);
        }
      } else {
        // Insert new training
        trainingData.created_at = new Date().toISOString();
        
        const { error } = await supabase
          .from('trainings')
          .insert([trainingData]);

        if (error) {
          console.error("Error adding training:", error);
          
          // Check for RLS issue
          if (error.message.includes('row-level security')) {
            alert('Database RLS policy is blocking inserts. Please check your Supabase RLS settings.');
          } else {
            alert('Failed to add training. Please try again.');
          }
          return;
        }
      }

      setUploadProgress(100);

      await loadTrainings();
      closeAllForms();
      
      setTimeout(() => {
        setUploadProgress(0);
        alert(editingTraining !== null ? 'Training updated successfully!' : 'Training added successfully!');
      }, 500);
      
    } catch (error) {
      console.error("Error saving training:", error);
      alert('An error occurred. Please try again.');
      setUploadProgress(0);
    }
  };

  const addNewTraining = () => {
    setFormData({
      personnelId: "",
      fullName: "",
      rank: "",
      dateOfTraining: "",
      days: "",
      status: "Pending",
      certificateUrl: "",
    });
    setCertificateFile(null);
    setCertificateFileName("");
    setEditingTraining(null);
    setUploadError("");
    openSidebar();
  };

  const editTraining = (training) => {
    setFormData({
      personnelId: training.personnelId,
      fullName: training.name,
      rank: training.rank,
      dateOfTraining: training.date,
      days: training.days,
      status: training.status || "Pending",
      certificateUrl: training.certificateUrl || "",
    });
    setCertificateFile(null);
    setCertificateFileName(training.certificateUrl ? training.certificateUrl.split('/').pop() : "");
    setEditingTraining(training);
    setUploadError("");
    openModal();
  };

  const deleteTrainingRecord = async (index) => {
    const training = trainings[index];
    
    if (window.confirm("Are you sure you want to delete this training?")) {
      try {
        // Delete certificate file if it exists
        if (training.certificateUrl && !training.certificateUrl.startsWith('data:')) {
          await deleteFile(training.certificateUrl);
        }

        // Delete training record from database
        const { error } = await supabase
          .from('trainings')
          .delete()
          .eq('id', training.id);

        if (error) {
          console.error("Error deleting training:", error);
          alert('Failed to delete training. Please try again.');
          return;
        }

        await loadTrainings();
        alert('Training deleted successfully!');
      } catch (error) {
        console.error("Error in deleteTrainingRecord:", error);
        alert('An error occurred. Please try again.');
      }
    }
  };

  // Function to view/download certificate
  const viewCertificate = (url) => {
    if (url) {
      if (url.startsWith('data:')) {
        // For data URLs, open in new tab
        const newWindow = window.open();
        if (newWindow) {
          newWindow.document.write(`<img src="${url}" style="max-width:100%; height:auto;" />`);
        }
      } else {
        window.open(url, '_blank');
      }
    } else {
      alert('No certificate available for this training.');
    }
  };

  const openSidebar = () => setIsFormOpen(true);
  const openModal = () => setIsModalOpen(true);

  const closeAllForms = () => {
    setIsFormOpen(false);
    setIsModalOpen(false);
    setEditingTraining(null);
    setFormData({
      personnelId: "",
      fullName: "",
      rank: "",
      dateOfTraining: "",
      days: "",
      status: "Pending",
      certificateUrl: "",
    });
    setCertificateFile(null);
    setCertificateFileName("");
    setUploadProgress(0);
    setUploadError("");
  };

  // Filtering & pagination logic
  function applyFilters(items) {
    let filtered = [...items];

    // Card filter
    if (currentFilterCard === "pending") {
      filtered = filtered.filter((i) => i.status?.toLowerCase() === "pending");
    } else if (currentFilterCard === "completed") {
      filtered = filtered.filter((i) => i.status?.toLowerCase() === "completed");
    } else if (currentFilterCard === "ongoing") {
      filtered = filtered.filter((i) => i.status?.toLowerCase() === "ongoing");
    } else if (currentFilterCard === "cancelled") {
      filtered = filtered.filter((i) => i.status?.toLowerCase() === "cancelled");
    }

    // Text filters
    const s = search.trim().toLowerCase();
    const statusFilter = filterStatus.trim().toLowerCase();

    filtered = filtered.filter((i) => {
      const text =
        `${i.name} ${i.rank} ${i.date} ${i.days} ${i.status}`.toLowerCase();
      const statusMatch =
        !statusFilter || (i.status || "").toLowerCase().includes(statusFilter);
      const searchMatch = !s || text.includes(s);
      return statusMatch && searchMatch;
    });

    return filtered;
  }

  const filteredTrainingData = applyFilters(trainings);
  const totalPages = Math.max(
    1,
    Math.ceil(filteredTrainingData.length / rowsPerPage)
  );
  const pageStart = (currentPage - 1) * rowsPerPage;
  const paginated = filteredTrainingData.slice(
    pageStart,
    pageStart + rowsPerPage
  );

  // Pagination function
  const renderPaginationButtons = () => {
    const pageCount = Math.max(
      1,
      Math.ceil(filteredTrainingData.length / rowsPerPage)
    );
    const hasNoData = filteredTrainingData.length === 0;

    const buttons = [];

    // Previous button
    buttons.push(
      <button
        key="prev"
        className={`${styles.TSPaginationBtn} ${
          hasNoData ? styles.TSDisabled : ""
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
        className={`${styles.TSPaginationBtn} ${
          1 === currentPage ? styles.TSActive : ""
        } ${hasNoData ? styles.TSDisabled : ""}`}
        onClick={() => setCurrentPage(1)}
        disabled={hasNoData}
      >
        1
      </button>
    );

    // Show ellipsis after first page if needed
    if (currentPage > 3) {
      buttons.push(
        <span key="ellipsis1" className={styles.TSPaginationEllipsis}>
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

    // Generate middle page buttons
    for (let i = startPage; i <= endPage; i++) {
      if (i > 1 && i < pageCount) {
        buttons.push(
          <button
            key={i}
            className={`${styles.TSPaginationBtn} ${
              i === currentPage ? styles.TSActive : ""
            } ${hasNoData ? styles.TSDisabled : ""}`}
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
        <span key="ellipsis2" className={styles.TSPaginationEllipsis}>
          ...
        </span>
      );
    }

    // Always show last page if there is more than 1 page
    if (pageCount > 1) {
      buttons.push(
        <button
          key={pageCount}
          className={`${styles.TSPaginationBtn} ${
            pageCount === currentPage ? styles.TSActive : ""
          } ${hasNoData ? styles.TSDisabled : ""}`}
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
        className={`${styles.TSPaginationBtn} ${
          hasNoData ? styles.TSDisabled : ""
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
  const totalItems = trainings.length;
  const pendingItems = trainings.filter(
    (i) => i.status?.toLowerCase() === "pending"
  ).length;
  const completedItems = trainings.filter(
    (i) => i.status?.toLowerCase() === "completed"
  ).length;
  const ongoingItems = trainings.filter(
    (i) => i.status?.toLowerCase() === "ongoing"
  ).length;
  const cancelledItems = trainings.filter(
    (i) => i.status?.toLowerCase() === "cancelled"
  ).length;

  function handleCardClick(filter) {
    if (currentFilterCard === filter) {
      setCurrentFilterCard("total");
    } else {
      setCurrentFilterCard(filter);
    }
    setCurrentPage(1);
  }

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterStatus, currentFilterCard]);

  // Get file name from URL
  const getFileNameFromUrl = (url) => {
    if (!url) return "";
    if (url.startsWith('data:')) return "Data URL Certificate";
    const parts = url.split('/');
    return parts[parts.length - 1];
  };

  if (loading) {
    return (
      <div className={`main-content ${isSidebarCollapsed ? "collapsed" : ""}`}>
        <p>Loading training records...</p>
      </div>
    );
  }

  return (
    <div className={styles.TSAppContainer}>
      <Title>Training Management | BFP Villanueva</Title>
      <Meta name="robots" content="noindex, nofollow" />

      <Hamburger />
      <Sidebar />
      <div className={`main-content ${isSidebarCollapsed ? "collapsed" : ""}`}>
        <h1 className={styles.TSTitle}>Training Management</h1>

        {/* Top Controls */}
        <div className={styles.TSTopControls}>
          <div className={styles.TSTableHeader}>
            <select
              className={styles.TSFilterType}
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All Status</option>
              <option>Pending</option>
              <option>Completed</option>
              <option>Ongoing</option>
              <option>Cancelled</option>
            </select>

            <input
              type="text"
              className={styles.TSSearchBar}
              placeholder="🔍 Search training records..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>

        {/* Summary Cards */}
        <div className={styles.TSSummary}>
          <button
            className={`${styles.TSSummaryCard} ${styles.TSTotal} ${
              currentFilterCard === "total" ? styles.TSActive : ""
            }`}
            onClick={() => handleCardClick("total")}
          >
            <h3>Total Trainings</h3>
            <p>{totalItems}</p>
          </button>
          <button
            className={`${styles.TSSummaryCard} ${styles.TSPending} ${
              currentFilterCard === "pending" ? styles.TSActive : ""
            }`}
            onClick={() => handleCardClick("pending")}
          >
            <h3>Pending</h3>
            <p>{pendingItems}</p>
          </button>
          <button
            className={`${styles.TSSummaryCard} ${styles.TSCompleted} ${
              currentFilterCard === "completed" ? styles.TSActive : ""
            }`}
            onClick={() => handleCardClick("completed")}
          >
            <h3>Completed</h3>
            <p>{completedItems}</p>
          </button>
          <button
            className={`${styles.TSSummaryCard} ${styles.TSOngoing} ${
              currentFilterCard === "ongoing" ? styles.TSActive : ""
            }`}
            onClick={() => handleCardClick("ongoing")}
          >
            <h3>Ongoing</h3>
            <p>{ongoingItems}</p>
          </button>
          <button
            className={`${styles.TSSummaryCard} ${styles.TSCancelled} ${
              currentFilterCard === "cancelled" ? styles.TSActive : ""
            }`}
            onClick={() => handleCardClick("cancelled")}
          >
            <h3>Cancelled</h3>
            <p>{cancelledItems}</p>
          </button>
        </div>

        {/* Add Training Button */}
        <button className={styles.TSAddBtn} onClick={addNewTraining}>
          Add Training Personnel
        </button>

        {/* Table Container with Pagination */}
        <div className={styles.TSTableContainer}>
          {/* Pagination at the top */}
          <div className={styles.TSPaginationContainer}>
            {renderPaginationButtons()}
          </div>

          <table className={styles.TSTable}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Rank</th>
                <th>Training Date</th>
                <th>Days</th>
                <th>Status</th>
                <th>Certificate</th>
                <th>Manage</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan="7" className={styles.TSNoRequestsTable}>
                    <div style={{ fontSize: "48px", marginBottom: "16px" }}>
                      📚
                    </div>
                    <h3>No Training Records Found</h3>
                    <p>There are no training records added yet.</p>
                  </td>
                </tr>
              ) : (
                paginated.map((training, index) => (
                  <tr key={training.id} className={styles.TSTableRow}>
                    <td>{training.name}</td>
                    <td>{training.rank}</td>
                    <td>{training.date}</td>
                    <td>{training.days}</td>
                    <td>
                      <span
                        className={`${styles.TSStatus} ${
                          styles[training.status?.toLowerCase() || 'pending']
                        }`}
                      >
                        {training.status || 'Pending'}
                      </span>
                    </td>
                    <td>
                      {training.certificateUrl ? (
                        <div className={styles.certificateCell}>
                          <button
                            className={styles.certificateBtn}
                            onClick={() => viewCertificate(training.certificateUrl)}
                            title={`View ${getFileNameFromUrl(training.certificateUrl)}`}
                          >
                            📄 View
                          </button>
                          <div className={styles.certificateInfo}>
                            <small>{getFileNameFromUrl(training.certificateUrl)}</small>
                          </div>
                        </div>
                      ) : (
                        <span className={styles.noCertificate}>No Certificate</span>
                      )}
                    </td>
                    <td>
                      <button
                        className={`${styles.TSActionBtn} ${styles.TSEditBtn}`}
                        onClick={() => editTraining(training)}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        className={`${styles.TSActionBtn} ${styles.TSDeleteBtn}`}
                        onClick={() => deleteTrainingRecord(pageStart + index)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Sidebar Form for Add Training */}
        <div
          className={`${styles.TSFormCard} ${
            isFormOpen ? styles.TSActive : ""
          }`}
        >
          <div className={styles.TSFormHeader}>
            <h2>{editingTraining ? 'Edit Training' : 'Add New Training'}</h2>
            <button
              type="button"
              className={styles.TSCloseBtn}
              onClick={closeAllForms}
            >
              ×
            </button>
          </div>

          {/* Upload Progress Bar */}
          {uploadProgress > 0 && uploadProgress < 100 && (
            <div className={styles.progressBarContainer}>
              <div 
                className={styles.progressBar} 
                style={{ width: `${uploadProgress}%` }}
              >
                Uploading... {uploadProgress}%
              </div>
            </div>
          )}

          {/* Upload Error Message */}
          {uploadError && (
            <div className={styles.errorMessage}>
              <strong>⚠️ Notice:</strong> {uploadError}
              <br />
              <small>Training will be saved with a data URL for the certificate.</small>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Personnel Information Section */}
            <div className={styles.TSFormSection}>
              <h3>Personnel Information</h3>
              <div className={styles.TSFormRow}>
                <div className={styles.TSFormGroup}>
                  <label htmlFor="personnelId">Select Personnel *</label>
                  <select
                    id="personnelId"
                    value={formData.personnelId}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">-- Choose Personnel --</option>
                    {personnel.map((person) => (
                      <option key={person.id} value={person.id}>
                        {`${person.first_name} ${person.middle_name || ''} ${person.last_name}`} - {person.rank || 'No rank'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={styles.TSFormRow}>
                <div className={styles.TSFormGroup}>
                  <label>Full Name</label>
                  <input
                    type="text"
                    value={formData.fullName}
                    readOnly
                    className={styles.TSReadOnlyInput}
                    placeholder="Auto-filled from selection"
                  />
                </div>
                <div className={styles.TSFormGroup}>
                  <label>Rank</label>
                  <input
                    type="text"
                    value={formData.rank}
                    readOnly
                    className={styles.TSReadOnlyInput}
                  />
                </div>
              </div>
            </div>

            {/* Training Details Section */}
            <div className={styles.TSFormSection}>
              <h3>Training Details</h3>
              <div className={styles.TSFormRow}>
                <div className={styles.TSFormGroup}>
                  <label htmlFor="dateOfTraining">Training Date *</label>
                  <input
                    type="date"
                    id="dateOfTraining"
                    value={formData.dateOfTraining}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className={styles.TSFormGroup}>
                  <label htmlFor="days">Duration (Days) *</label>
                  <input
                    type="number"
                    id="days"
                    min="1"
                    max="365"
                    value={formData.days}
                    onChange={handleInputChange}
                    required
                    placeholder="e.g., 5"
                  />
                </div>
              </div>

              <div className={styles.TSFormRow}>
                <div className={styles.TSFormGroup}>
                  <label htmlFor="status">Training Status *</label>
                  <select
                    id="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="Pending">Pending</option>
                    <option value="Ongoing">Ongoing</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              {/* Certificate Upload Section */}
              <div className={styles.TSFormSection}>
                <h3>Training Certificate</h3>
                <div className={styles.TSFormRow}>
                  <div className={styles.TSFormGroup}>
                    <label htmlFor="certificate">Upload Certificate (Optional)</label>
                    <div className={styles.fileUpload}>
                      <label htmlFor="certificate" className={styles.fileUploadLabel}>
                        📄 Upload Certificate (Max 10MB)
                      </label>
                      <input
                        type="file"
                        id="certificate"
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,application/pdf,image/jpeg,image/png,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        onChange={handleCertificateChange}
                      />
                      <span>{certificateFileName || "No certificate selected"}</span>
                    </div>
                    {formData.certificateUrl && !certificateFile && (
                      <div className={styles.currentFile}>
                        <small>Current file: {getFileNameFromUrl(formData.certificateUrl)}</small>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div className={styles.TSFormActions}>
              <button type="submit" className={styles.TSSaveBtn}>
                {editingTraining ? 'Update Training' : 'Save Training'}
              </button>
              <button
                type="button"
                onClick={closeAllForms}
                className={styles.TSCancelBtn}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>

        {/* Edit Modal */}
        {isModalOpen && (
          <div className={styles.TSModalOverlay} onClick={closeAllForms}>
            <div
              className={styles.TSModalContent}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.TSModalHeader}>
                <h2>Edit Training</h2>
                <button
                  type="button"
                  className={styles.TSCloseBtn}
                  onClick={closeAllForms}
                >
                  ×
                </button>
              </div>

              {/* Upload Progress Bar for Modal */}
              {uploadProgress > 0 && uploadProgress < 100 && (
                <div className={styles.progressBarContainer}>
                  <div 
                    className={styles.progressBar} 
                    style={{ width: `${uploadProgress}%` }}
                  >
                    Uploading... {uploadProgress}%
                  </div>
                </div>
              )}

              {/* Upload Error Message */}
              {uploadError && (
                <div className={styles.errorMessage}>
                  <strong>⚠️ Notice:</strong> {uploadError}
                  <br />
                  <small>Training will be saved with a data URL for the certificate.</small>
                </div>
              )}

              <form onSubmit={handleSubmit}>
                {/* Personnel Information Section */}
                <div className={styles.TSFormSection}>
                  <h3>Personnel Information</h3>
                  <div className={styles.TSFormRow}>
                    <div className={styles.TSFormGroup}>
                      <label htmlFor="personnelId">Select Personnel *</label>
                      <select
                        id="personnelId"
                        value={formData.personnelId}
                        onChange={handleInputChange}
                        required
                      >
                        <option value="">-- Choose Personnel --</option>
                        {personnel.map((person) => (
                          <option key={person.id} value={person.id}>
                            {`${person.first_name} ${person.middle_name || ''} ${person.last_name}`} - {person.rank || 'No rank'}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className={styles.TSFormRow}>
                    <div className={styles.TSFormGroup}>
                      <label>Full Name</label>
                      <input
                        type="text"
                        value={formData.fullName}
                        readOnly
                        className={styles.TSReadOnlyInput}
                        placeholder="Auto-filled from selection"
                      />
                    </div>
                    <div className={styles.TSFormGroup}>
                      <label>Rank</label>
                      <input
                        type="text"
                        value={formData.rank}
                        readOnly
                        className={styles.TSReadOnlyInput}
                      />
                    </div>
                  </div>
                </div>

                {/* Training Details Section */}
                <div className={styles.TSFormSection}>
                  <h3>Training Details</h3>
                  <div className={styles.TSFormRow}>
                    <div className={styles.TSFormGroup}>
                      <label htmlFor="dateOfTraining">Training Date *</label>
                      <input
                        type="date"
                        id="dateOfTraining"
                        value={formData.dateOfTraining}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div className={styles.TSFormGroup}>
                      <label htmlFor="days">Duration (Days) *</label>
                      <input
                        type="number"
                        id="days"
                        min="1"
                        max="365"
                        value={formData.days}
                        onChange={handleInputChange}
                        required
                        placeholder="e.g., 5"
                      />
                    </div>
                  </div>

                  <div className={styles.TSFormRow}>
                    <div className={styles.TSFormGroup}>
                      <label htmlFor="status">Training Status *</label>
                      <select
                        id="status"
                        value={formData.status}
                        onChange={handleInputChange}
                        required
                      >
                        <option value="Pending">Pending</option>
                        <option value="Ongoing">Ongoing</option>
                        <option value="Completed">Completed</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    </div>
                  </div>

                  {/* Certificate Upload Section */}
                  <div className={styles.TSFormSection}>
                    <h3>Training Certificate</h3>
                    <div className={styles.TSFormRow}>
                      <div className={styles.TSFormGroup}>
                        <label htmlFor="certificate">Upload Certificate (Optional)</label>
                        <div className={styles.fileUpload}>
                          <label htmlFor="certificate" className={styles.fileUploadLabel}>
                            📄 Change Certificate (Max 10MB)
                          </label>
                          <input
                            type="file"
                            id="certificate"
                            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,application/pdf,image/jpeg,image/png,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                            onChange={handleCertificateChange}
                          />
                          <span>{certificateFileName || "Keep current certificate"}</span>
                        </div>
                        {formData.certificateUrl && !certificateFile && (
                          <div className={styles.currentFile}>
                            <small>Current file: {getFileNameFromUrl(formData.certificateUrl)}</small>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Form Actions */}
                <div className={styles.TSFormActions}>
                  <button type="submit" className={styles.TSSaveBtn}>
                    Update Training
                  </button>
                  <button
                    type="button"
                    onClick={closeAllForms}
                    className={styles.TSCancelBtn}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Trainings;