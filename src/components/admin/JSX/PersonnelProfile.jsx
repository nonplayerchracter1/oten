import React, { useState, useEffect, useRef } from "react";
import Sidebar from "../../Sidebar.jsx";
import Hamburger from "../../Hamburger.jsx";
import { useSidebar } from "../../SidebarContext.jsx";
import { Title, Meta } from "react-head";
import styles from "../styles/PersonnelProfile.module.css";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { supabase } from "../../../lib/supabaseClient.js";
const PersonnelProfile = () => {
  const { isSidebarCollapsed } = useSidebar();
  const [personnelList, setPersonnelList] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterBy, setFilterBy] = useState("firstName");
  const [pendingUploads, setPendingUploads] = useState({});
  const [showMedicalRecordModal, setShowMedicalRecordModal] = useState(false);
  const [showAwardModal, setShowAwardModal] = useState(false);
  const [currentPersonnelIndex, setCurrentPersonnelIndex] = useState(null);
  const [medicalRecordTypes, setMedicalRecordTypes] = useState({});
  const [awardTypes, setAwardTypes] = useState({});
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [showPreviewSidebar, setShowPreviewSidebar] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 6;

  // Format date
  const formatDate = (dateString) => {
    if (!dateString || dateString.trim() === "") return "";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch (error) {
      console.error("Error formatting date:", error);
      return dateString;
    }
  };

  // Format timestamp
  const formatTimestamp = (dateString) => {
    if (!dateString || dateString.trim() === "") return "";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch (error) {
      console.error("Error formatting timestamp:", error);
      return dateString;
    }
  };

  // Load personnel from Supabase
  useEffect(() => {
    loadPersonnel();
  }, []);

const loadPersonnel = async () => {
  try {
    setIsLoading(true);

    // Fetch personnel with their documents and rank images
    const { data: personnelData, error: personnelError } = await supabase
      .from("personnel")
      .select("*")
      .order("last_name", { ascending: true });

    if (personnelError) throw personnelError;

    // Process rank images for each personnel
    const personnelWithRankImages = personnelData.map((personnel) => {
      let rankImageUrl = personnel.rank_image;

      // If rank_image is a storage path, convert to public URL
      if (rankImageUrl && !rankImageUrl.startsWith("http")) {
        const { data: imageData } = supabase.storage
          .from("rank_images")
          .getPublicUrl(rankImageUrl);
        rankImageUrl = imageData?.publicUrl || "";
      }

      return {
        ...personnel,
        rank_image: rankImageUrl,
      };
    });

    // Fetch all documents for all personnel
    const { data: documentsData, error: documentsError } = await supabase
      .from("personnel_documents")
      .select("*")
      .order("uploaded_at", { ascending: false });

    if (documentsError) throw documentsError;

    // Group documents by personnel_id
    const documentsByPersonnel = {};
    documentsData?.forEach((doc) => {
      if (!documentsByPersonnel[doc.personnel_id]) {
        documentsByPersonnel[doc.personnel_id] = [];
      }
      documentsByPersonnel[doc.personnel_id].push(doc);
    });

    // Merge documents into personnel records
    const updatedPersonnel =
      personnelWithRankImages.map((personnel) => ({
        ...personnel,
        documents: documentsByPersonnel[personnel.id] || [],
      })) || [];

    setPersonnelList(updatedPersonnel);
  } catch (error) {
    console.error("Error loading personnel:", error);
    toast.error("Failed to load personnel data");
  } finally {
    setIsLoading(false);
  }
};

  // Upload file to Supabase Storage
  const uploadToSupabaseStorage = async (file, personnelId, recordType = "") => {
    try {
      console.log("Starting upload for file:", file.name);
      
      // Check file size (limit to 50MB)
      const maxSize = 50 * 1024 * 1024; // 50MB
      if (file.size > maxSize) {
        throw new Error(`File size too large. Maximum size is 50MB. Your file is ${(file.size / (1024*1024)).toFixed(2)}MB`);
      }

      // Create unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
      const filePath = `${personnelId}/${fileName}`;

      console.log("Uploading to path:", filePath);

      // Check if storage bucket exists and is accessible
      const { data: bucketData, error: bucketError } = await supabase.storage
        .from('personnel-documents')
        .list();

      if (bucketError) {
        console.error("Bucket access error:", bucketError);
        // Continue anyway, the bucket might not exist but will be created on upload
      }

      // Upload file to storage
      const { data, error } = await supabase.storage
        .from('personnel-documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error("Storage upload error:", error);
        throw error;
      }

      console.log("Upload successful:", data);

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('personnel-documents')
        .getPublicUrl(filePath);

      console.log("Public URL:", publicUrl);

      return {
        url: publicUrl,
        fileName: file.name,
        filePath: filePath,
        fileType: file.type,
        fileSize: file.size
      };
    } catch (error) {
      console.error("Error uploading to Supabase:", error);
      throw error;
    }
  };

  // Save document metadata to Supabase database
  const saveDocumentMetadata = async (documentData) => {
    try {
      const { data, error } = await supabase
        .from('personnel_documents')
        .insert([documentData])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Error saving document metadata:", error);
      throw error;
    }
  };

  // Save uploaded files
  const saveUploadedFiles = async (index) => {
    if (!pendingUploads[index] || uploading) return;

    try {
      setUploading(true);
      const files = pendingUploads[index];
      const personnel = paginatedPersonnel[index];
      const category = document.getElementById(`doc-category-${index}`).value;
      
      let recordType = "";
      if (category === "Medical Record") {
        recordType = medicalRecordTypes[personnel.id] || "General";
      } else if (category === "Award/Commendation") {
        recordType = awardTypes[personnel.id] || "General";
      }

      // Process each file sequentially to avoid race conditions
      for (const file of files) {
        try {
          toast.info(`Uploading ${file.name}...`);
          
          // Upload to Supabase Storage
          const uploadResult = await uploadToSupabaseStorage(file, personnel.id, recordType);
          
          // Save document metadata to database
          const documentData = {
            personnel_id: personnel.id,
            name: file.name,
            category: category,
            record_type: recordType,
            file_url: uploadResult.url,
            file_path: uploadResult.filePath,
            file_type: uploadResult.fileType,
            file_size: uploadResult.fileSize,
            description: `${category} for ${personnel.first_name} ${personnel.last_name}`,
            uploaded_at: new Date().toISOString()
          };

          await saveDocumentMetadata(documentData);
          
          toast.success(`Uploaded: ${file.name}`);
          
        } catch (fileError) {
          console.error(`Error uploading file ${file.name}:`, fileError);
          toast.error(`Failed to upload: ${file.name} - ${fileError.message}`);
        }
      }

      // Clear pending uploads
      setPendingUploads(prev => {
        const newPending = { ...prev };
        delete newPending[index];
        return newPending;
      });

      // Clear record types
      setMedicalRecordTypes(prev => {
        const newTypes = { ...prev };
        delete newTypes[personnel.id];
        return newTypes;
      });
      setAwardTypes(prev => {
        const newTypes = { ...prev };
        delete newTypes[personnel.id];
        return newTypes;
      });

      // Reload personnel data
      await loadPersonnel();
      toast.success("Files uploaded successfully!");
      
    } catch (error) {
      console.error("Error saving uploaded files:", error);
      toast.error(`Error saving files: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  // Remove document
  const removeDocument = async (documentId, filePath) => {
    try {
      // Delete from storage if file exists
      if (filePath) {
        console.log("Deleting from storage:", filePath);
        const { error: storageError } = await supabase.storage
          .from('personnel-documents')
          .remove([filePath]);

        if (storageError) {
          console.warn("File not found in storage:", storageError);
          // Continue with database deletion even if storage fails
        } else {
          console.log("File deleted from storage");
        }
      }

      // Delete from database
      console.log("Deleting from database:", documentId);
      const { error: dbError } = await supabase
        .from('personnel_documents')
        .delete()
        .eq('id', documentId);

      if (dbError) throw dbError;

      console.log("Document deleted successfully");
      toast.success("Document deleted successfully");
      await loadPersonnel(); // Reload data
    } catch (error) {
      console.error("Error deleting document:", error);
      toast.error("Error deleting document. Please try again.");
    }
  };

  // Open delete modal
  const openDeleteModal = (document) => {
    setDocumentToDelete(document);
    setShowDeleteModal(true);
  };

  // Close delete modal
  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setDocumentToDelete(null);
  };

  // Confirm delete
  const confirmDelete = async () => {
    if (documentToDelete) {
      console.log("Deleting document:", documentToDelete);
      await removeDocument(documentToDelete.id, documentToDelete.file_path);
      closeDeleteModal();
    }
  };

  // Handle document click
  const handleDocumentClick = (doc, personnel) => {
    setSelectedDocument({
      ...doc,
      personnelName: `${personnel.first_name} ${personnel.last_name}`,
      personnelRank: personnel.rank,
      personnelDesignation: personnel.designation,
    });
    setShowPreviewSidebar(true);
  };

  // Close preview sidebar
  const closePreviewSidebar = () => {
    setShowPreviewSidebar(false);
    setSelectedDocument(null);
  };

  // Prepare upload
  const prepareUpload = (event, index) => {
    const files = event.target.files;
    const categorySelect = document.getElementById(`doc-category-${index}`);
    const selectedCategory = categorySelect ? categorySelect.value : "";

    if (files.length > 0) {
      const fileNames = Array.from(files)
        .map((file) => file.name)
        .join(", ");
      toast.info(`Selected ${files.length} file(s): ${fileNames}`);
      
      // Check file sizes
      let hasLargeFile = false;
      Array.from(files).forEach(file => {
        if (file.size > 50 * 1024 * 1024) { // 50MB
          hasLargeFile = true;
          toast.warning(`${file.name} is larger than 50MB`);
        }
      });

      if (hasLargeFile) {
        toast.error("Some files exceed the 50MB limit. Please select smaller files.");
        event.target.value = ""; // Clear the input
        return;
      }
    }

    setPendingUploads(prev => ({
      ...prev,
      [index]: files,
    }));

    // Open appropriate modal based on category
    if (selectedCategory === "Medical Record" && files.length > 0) {
      openMedicalRecordModal(index);
    } else if (selectedCategory === "Award/Commendation" && files.length > 0) {
      openAwardModal(index);
    }
  };

  // Open modals
  const openMedicalRecordModal = (index) => {
    setCurrentPersonnelIndex(index);
    setShowMedicalRecordModal(true);
  };

  const openAwardModal = (index) => {
    setCurrentPersonnelIndex(index);
    setShowAwardModal(true);
  };

  const closeMedicalRecordModal = () => {
    setShowMedicalRecordModal(false);
    setCurrentPersonnelIndex(null);
  };

  const closeAwardModal = () => {
    setShowAwardModal(false);
    setCurrentPersonnelIndex(null);
  };

  // Handle type selection
  const handleMedicalRecordTypeSelect = (personnelId, type) => {
    setMedicalRecordTypes((prev) => ({
      ...prev,
      [personnelId]: type,
    }));
  };

  const handleAwardTypeSelect = (personnelId, type) => {
    setAwardTypes((prev) => ({
      ...prev,
      [personnelId]: type,
    }));
  };

  // Get field value for filtering
  const getFieldValue = (personnel, field) => {
    switch (field) {
      case "firstName":
        return personnel.first_name || "";
      case "lastName":
        return personnel.last_name || "";
      case "rank":
        return personnel.rank || "";
      case "designation":
        return personnel.designation || "";
      case "dateHired":
        return personnel.date_hired || "";
      case "Retirement":
        return personnel.retirement_date || "";
      default:
        return "";
    }
  };

  // Filter personnel based on search
  const filteredPersonnel = personnelList.filter((personnel) => {
    if (!searchQuery.trim()) return true;
    const fieldValue = getFieldValue(personnel, filterBy);
    return fieldValue.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Pagination logic
  const totalPages = Math.max(
    1,
    Math.ceil(filteredPersonnel.length / rowsPerPage)
  );
  const pageStart = (currentPage - 1) * rowsPerPage;
  const paginatedPersonnel = filteredPersonnel.slice(
    pageStart,
    pageStart + rowsPerPage
  );

  // Clear search
  const clearSearch = () => {
    setSearchQuery("");
    setCurrentPage(1);
  };

  // Highlight search text
  const highlightText = (text, fieldType) => {
    if (!searchQuery.trim() || !text) return text;

    const shouldHighlight = () => {
      switch (filterBy) {
        case "firstName":
          return fieldType === "first_name";
        case "lastName":
          return fieldType === "last_name";
        case "rank":
          return fieldType === "rank";
        case "designation":
          return fieldType === "designation";
        case "dateHired":
          return fieldType === "date_hired";
        case "Retirement":
          return fieldType === "retirement_date";
        default:
          return false;
      }
    };

    if (!shouldHighlight()) return text;

    const regex = new RegExp(
      `(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
      "gi"
    );
    return text
      .toString()
      .replace(
        regex,
        '<mark style="background:yellow; color:black;">$1</mark>'
      );
  };

  // Render pagination buttons
  const renderPaginationButtons = () => {
    const pageCount = Math.max(
      1,
      Math.ceil(filteredPersonnel.length / rowsPerPage)
    );
    const hasNoData = filteredPersonnel.length === 0;

    if (pageCount <= 1) return null;

    const buttons = [];

    // Previous button
    buttons.push(
      <button
        key="prev"
        className={`${styles.paginationBtn} ${hasNoData ? styles.paginationDisabled : ""}`}
        disabled={currentPage === 1 || hasNoData}
        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
      >
        Previous
      </button>
    );

    // Generate page buttons
    for (let i = 1; i <= pageCount; i++) {
      if (
        i === 1 ||
        i === pageCount ||
        (i >= currentPage - 1 && i <= currentPage + 1)
      ) {
        buttons.push(
          <button
            key={i}
            className={`${styles.paginationBtn} ${i === currentPage ? styles.paginationActive : ""} ${hasNoData ? styles.paginationDisabled : ""}`}
            onClick={() => setCurrentPage(i)}
            disabled={hasNoData}
          >
            {i}
          </button>
        );
      } else if (i === currentPage - 2 || i === currentPage + 2) {
        buttons.push(
          <span key={`ellipsis-${i}`} className={styles.paginationEllipsis}>
            ...
          </span>
        );
      }
    }

    // Next button
    buttons.push(
      <button
        key="next"
        className={`${styles.paginationBtn} ${hasNoData ? styles.paginationDisabled : ""}`}
        disabled={currentPage === pageCount || hasNoData}
        onClick={() => setCurrentPage(Math.min(pageCount, currentPage + 1))}
      >
        Next
      </button>
    );

    return buttons;
  };

  if (isLoading) {
    return (
      <div className={styles.preLoading}>
        <p>Loading personnel data...</p>
      </div>
    );
  }

  return (
    <div className={styles.prePersonnelProfile}>
      {/* Medical Record Modal */}
      {showMedicalRecordModal && currentPersonnelIndex !== null && (
        <MedicalRecordModal
          personnel={paginatedPersonnel[currentPersonnelIndex]}
          onSelectType={(type) =>
            handleMedicalRecordTypeSelect(
              paginatedPersonnel[currentPersonnelIndex].id,
              type
            )
          }
          onClose={closeMedicalRecordModal}
          selectedType={
            medicalRecordTypes[paginatedPersonnel[currentPersonnelIndex]?.id] ||
            ""
          }
        />
      )}
      
      {/* Award/Commendation Modal */}
      {showAwardModal && currentPersonnelIndex !== null && (
        <AwardModal
          personnel={paginatedPersonnel[currentPersonnelIndex]}
          onSelectType={(type) =>
            handleAwardTypeSelect(
              paginatedPersonnel[currentPersonnelIndex].id,
              type
            )
          }
          onClose={closeAwardModal}
          selectedType={
            awardTypes[paginatedPersonnel[currentPersonnelIndex]?.id] || ""
          }
        />
      )}
      
      {/* Delete Confirmation Modal */}
      {showDeleteModal && documentToDelete && (
        <DeleteConfirmationModal
          documentName={documentToDelete.name}
          onConfirm={confirmDelete}
          onCancel={closeDeleteModal}
        />
      )}

      {showPreviewSidebar && selectedDocument && (
        <>
          <div className={styles.previewSidebarOverlay} onClick={closePreviewSidebar} />
          <PreviewSidebar
            document={selectedDocument}
            onClose={closePreviewSidebar}
            formatTimestamp={formatTimestamp}
          />
        </>
      )}
      
      <Title>Personnel Profile | BFP Villanueva</Title>
      <Meta name="robots" content="noindex, nofollow" />
      <Hamburger />
      <Sidebar />
      
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
      
      {/* Main Content */}
      <div className={`main-content ${isSidebarCollapsed ? "collapsed" : ""}`}>
        <div className={styles.preSearchBar}>
          <select value={filterBy} onChange={(e) => setFilterBy(e.target.value)}>
            <option value="firstName">First Name</option>
            <option value="lastName">Last Name</option>
            <option value="rank">Rank</option>
            <option value="designation">Designation</option>
            <option value="dateHired">Date Hired</option>
            <option value="Retirement">Retirement</option>
          </select>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="🔍 Search personnel..."
          />
          {searchQuery && (
            <button onClick={clearSearch} className={styles.clearSearchBtn}>✕</button>
          )}
        </div>
        
        <h1>Personnel Profile (201 Files)</h1>
        
        {/* Pagination Controls */}
        {filteredPersonnel.length > rowsPerPage && (
          <div className={styles.paginationContainer}>
            {renderPaginationButtons()}
          </div>
        )}

        <div className={styles.prePersonnelCards}>
          {paginatedPersonnel.length > 0 ? (
            paginatedPersonnel.map((personnel, index) => (
              <PersonnelCard
                key={personnel.id}
                personnel={personnel}
                index={index}
                searchQuery={searchQuery}
                filterBy={filterBy}
                highlightText={highlightText}
                onPrepareUpload={prepareUpload}
                onSaveUploadedFiles={saveUploadedFiles}
                pendingUploads={pendingUploads}
                uploading={uploading}
                onDocumentClick={handleDocumentClick}
                onRemoveDocument={openDeleteModal}
                medicalRecordType={medicalRecordTypes[personnel.id] || ""}
                awardType={awardTypes[personnel.id] || ""}
                formatDate={formatDate}
                formatTimestamp={formatTimestamp}
              />
            ))
          ) : (
            <div className={styles.preEmptyState}>
              <div className={`${styles.emptyStateIcon} ${styles.animatedEmoji}`}>📇</div>
              <div className={styles.emptyStateTitle}>No Personnel Records</div>
              <div className={styles.emptyStateMessage}>
                {searchQuery
                  ? `No personnel found matching "${searchQuery}"`
                  : "BFP personnel register is empty"}
              </div>
            </div>
          )}
        </div>
        
        {/* Pagination Controls */}
        {filteredPersonnel.length > rowsPerPage && (
          <div className={styles.paginationContainer}>
            {renderPaginationButtons()}
          </div>
        )}
      </div>
    </div>
  );
};

// Medical Record Modal Component
const MedicalRecordModal = ({ personnel, onSelectType, onClose, selectedType }) => {
  const recordTypes = [
    { id: "Checkup", label: "Check Ups", icon: "🩺" },
    { id: "Lab", label: "Lab Tests", icon: "🧪" },
    { id: "Imaging", label: "Imaging", icon: "📷" },
    { id: "Dental", label: "Dental", icon: "🦷" },
  ];

  const handleContinue = () => {
    if (!selectedType) {
      toast.error("Please select a medical record type first.");
      return;
    }
    onClose();
  };

  return (
    <div className={styles.preModal} style={{ display: "flex" }}>
      <div className={styles.preModalContent} style={{ maxWidth: "500px" }}>
        <div className={styles.preModalHeader}>
          <h2>Select Medical Record Type</h2>
          <span className={styles.preCloseBtn} onClick={onClose}>
            &times;
          </span>
        </div>

        <div className={styles.preModalBody}>
          <p style={{ marginBottom: "20px", textAlign: "center" }}>
            For <strong>{personnel.first_name} {personnel.last_name}</strong>
          </p>

          <div className={styles.medicalRecordTypes}>
            {recordTypes.map((type) => (
              <button
                key={type.id}
                className={`${styles.medicalRecordTypeBtn} ${
                  selectedType === type.id ? styles.medicalRecordTypeBtnSelected : ""
                }`}
                onClick={() => onSelectType(type.id)}
              >
                <span className={styles.medicalRecordIcon}>{type.icon}</span>
                <span className={styles.medicalRecordLabel}>{type.label}</span>
              </button>
            ))}
          </div>

          {selectedType && (
            <div className={styles.selectedTypeInfo}>
              <p>
                Selected: <strong>
                  {recordTypes.find((t) => t.id === selectedType)?.label}
                </strong>
              </p>
              <p className={styles.instruction}>
                You can now save the files as medical records.
              </p>
            </div>
          )}
        </div>

        <div className={styles.preModalActions}>
          <button
            className={`${styles.preBtn} ${styles.preCancelBtnModal}`}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className={`${styles.preBtn} ${styles.preSaveBtn}`}
            onClick={handleContinue}
            disabled={!selectedType}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
};

// Award Modal Component
const AwardModal = ({ personnel, onSelectType, onClose, selectedType }) => {
  const awardTypes = [
    { id: "Medal", label: "Medal", icon: "🏅" },
    { id: "Commendation", label: "Commendation", icon: "⭐" },
    { id: "Certificate", label: "Certificate", icon: "📜" },
    { id: "Ribbon", label: "Ribbon", icon: "🎗️" },
    { id: "Badge", label: "Badge", icon: "🛡️" },
  ];

  const handleContinue = () => {
    if (!selectedType) {
      toast.error("Please select an award type first.");
      return;
    }
    onClose();
  };

  return (
    <div className={styles.preModal} style={{ display: "flex" }}>
      <div className={styles.preModalContent} style={{ maxWidth: "500px" }}>
        <div className={styles.preModalHeader}>
          <h2>Select Award Type</h2>
          <span className={styles.preCloseBtn} onClick={onClose}>
            &times;
          </span>
        </div>

        <div className={styles.preModalBody}>
          <p style={{ marginBottom: "20px", textAlign: "center" }}>
            For <strong>{personnel.first_name} {personnel.last_name}</strong>
          </p>

          <div className={styles.medicalRecordTypes}>
            {awardTypes.map((type) => (
              <button
                key={type.id}
                className={`${styles.medicalRecordTypeBtn} ${
                  selectedType === type.id ? styles.medicalRecordTypeBtnSelected : ""
                }`}
                onClick={() => onSelectType(type.id)}
              >
                <span className={styles.medicalRecordIcon}>{type.icon}</span>
                <span className={styles.medicalRecordLabel}>{type.label}</span>
              </button>
            ))}
          </div>

          {selectedType && (
            <div className={styles.selectedTypeInfo}>
              <p>
                Selected: <strong>
                  {awardTypes.find((t) => t.id === selectedType)?.label}
                </strong>
              </p>
              <p className={styles.instruction}>
                You can now save the files as awards/commendations.
              </p>
            </div>
          )}
        </div>

        <div className={styles.preModalActions}>
          <button
            className={`${styles.preBtn} ${styles.preCancelBtnModal}`}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className={`${styles.preBtn} ${styles.preSaveBtn}`}
            onClick={handleContinue}
            disabled={!selectedType}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
};

// Delete Confirmation Modal Component
const DeleteConfirmationModal = ({ documentName, onConfirm, onCancel }) => {
  return (
    <div className={styles.preModalDelete} style={{ display: "flex" }}>
      <div className={styles.preModalContentDelete} style={{ maxWidth: "450px" }}>
        <div className={styles.preModalHeaderDelete}>
          <h2 style={{ marginLeft: "30px" }}>Confirm Deletion</h2>
          <span className={styles.preCloseBtn} onClick={onCancel}>
            &times;
          </span>
        </div>

        <div className={styles.preModalBody}>
          <div className={styles.deleteConfirmationContent}>
            <div className={styles.deleteWarningIcon}>⚠️</div>
            <p className={styles.deleteConfirmationText}>
              Are you sure you want to delete the document
            </p>
            <p className={styles.documentNameHighlight}>"{documentName}"?</p>
            <p className={styles.deleteWarning}>
              This action cannot be undone.
            </p>
          </div>
        </div>

        <div className={styles.preModalActions}>
          <button
            className={`${styles.preBtn} ${styles.preCancelBtn}`}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className={`${styles.preBtn} ${styles.deleteConfirmBtn}`}
            onClick={onConfirm}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

// Preview Sidebar Component
const PreviewSidebar = ({ document, onClose, formatTimestamp }) => {
  const [pdfError, setPdfError] = useState(false);
  const iframeRef = useRef(null);

  const getFileIcon = (fileName) => {
    if (fileName.toLowerCase().endsWith(".pdf")) return "📄";
    if (fileName.toLowerCase().match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i)) return "🖼️";
    if (fileName.toLowerCase().match(/\.(doc|docx)$/i)) return "📝";
    if (fileName.toLowerCase().match(/\.(xls|xlsx)$/i)) return "📊";
    return "📎";
  };

  useEffect(() => {
    setPdfError(false);
  }, [document]);

  const handlePdfError = () => {
    console.error("PDF failed to load:", document.file_url);
    setPdfError(true);
  };

  return (
    <div className={styles.previewSidebar}>
      <div className={styles.previewHeader}>
        <h3>Preview</h3>
        <button className={styles.previewCloseBtn} onClick={onClose}>
          ×
        </button>
      </div>

      <div className={styles.previewContent}>
        <div className={styles.filePreview}>
          {document.name.toLowerCase().endsWith(".pdf") ? (
            pdfError ? (
              <div className={styles.pdfError}>
                <div className={styles.fileIconLarge}>📄</div>
                <p>Unable to display PDF preview</p>
                <a
                  href={document.file_url}
                  className={styles.openInNewTabBtn}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open PDF in new tab
                </a>
              </div>
            ) : (
              <iframe
                ref={iframeRef}
                src={document.file_url}
                type="application/pdf"
                className={styles.previewIframe}
                onError={handlePdfError}
                title={`PDF Preview: ${document.name}`}
              />
            )
          ) : document.name.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i) ? (
            <img
              src={document.file_url}
              alt={document.name}
              className={styles.previewImage}
              onError={(e) => {
                console.error("Image failed to load:", document.file_url);
                e.target.style.display = "none";
              }}
            />
          ) : (
            <div className={styles.noPreview}>
              <div className={styles.fileIconLarge}>
                {getFileIcon(document.name)}
              </div>
              <p>No preview available</p>
              <p className={styles.fileTypeNote}>
                {document.name.split(".").pop()?.toUpperCase()} file
              </p>
            </div>
          )}
        </div>

        <div className={styles.fileDetails}>
          <div className={styles.detailSection}>
            <h4>File Information</h4>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Name:</span>
              <span className={styles.detailValue}>{document.name}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Type:</span>
              <span className={styles.detailValue}>{document.category}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>File Type:</span>
              <span className={styles.detailValue}>
                {document.name.split(".").pop()?.toUpperCase()}
              </span>
            </div>
            {document.record_type && (
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Record Type:</span>
                <span className={styles.detailValue}>
                  {document.record_type}
                </span>
              </div>
            )}
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Uploaded:</span>
              <span className={styles.detailValue}>
                {formatTimestamp(document.uploaded_at)}
              </span>
            </div>
          </div>

          <div className={styles.detailSection}>
            <h4>Personnel Information</h4>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Name:</span>
              <span className={styles.detailValue}>
                {document.personnelName}
              </span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Rank:</span>
              <span className={styles.detailValue}>
                {document.personnelRank}
              </span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Designation:</span>
              <span className={styles.detailValue}>
                {document.personnelDesignation}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Enhanced PersonnelCard Component with Rank Image
const PersonnelCard = ({
  personnel,
  index,
  searchQuery,
  filterBy,
  highlightText,
  onPrepareUpload,
  onSaveUploadedFiles,
  pendingUploads,
  uploading,
  onDocumentClick,
  onRemoveDocument,
  medicalRecordType,
  awardType,
  formatDate,
  formatTimestamp,
}) => {
  const [selectedCategory, setSelectedCategory] = useState("Medical Record");
  
  // Get rank image URL (you need to fetch this from your database)
  // Add this to your loadPersonnel function to include rank_image in the data
  const rankImage = personnel.rank_image || "";

  const handleCategoryChange = (e) => {
    setSelectedCategory(e.target.value);
  };

  const safeRender = (value, defaultValue = "") => {
    if (value === null || value === undefined) return defaultValue;
    if (value instanceof Date) {
      return isNaN(value.getTime()) ? defaultValue : formatDate(value);
    }
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };

  const firstName = highlightText(personnel.first_name || "", "first_name");
  const lastName = highlightText(personnel.last_name || "", "last_name");
  const rank = highlightText(personnel.rank || "", "rank");
  const designation = highlightText(personnel.designation || "", "designation");
  const dateHired = highlightText(formatDate(personnel.date_hired), "date_hired");
  const retirementDate = highlightText(formatDate(personnel.retirement_date), "retirement_date");
  const birthDate = formatDate(personnel.birth_date);

  const pendingFiles = pendingUploads[index];
  const hasPendingFiles = pendingFiles && pendingFiles.length > 0;
  const fileCount = hasPendingFiles ? pendingFiles.length : 0;

  return (
    <div className={styles.prePersonnelCard}>
      {/* Card Header with Rank Image */}
      <div className={styles.preCardHeader}>
        <div className={styles.headerLeft}>
          <img
            src={personnel.photo_url || "/bfp.jpg"}
            alt={`${personnel.first_name} ${personnel.last_name}`}
            onError={(e) => {
              e.target.src = "/bfp.jpg";
            }}
          />
          <div className={styles.headerText}>
            <h3 dangerouslySetInnerHTML={{ __html: `${firstName} ${lastName}` }} />
            <small dangerouslySetInnerHTML={{ __html: `${rank} – ${designation}` }} />
            <small>Badge: {personnel.badge_number || "N/A"}</small>
          </div>
        </div>
        
        {/* Rank Image at Top Right */}
        <div className={styles.rankImageContainer}>
          {rankImage ? (
            <img
              src={rankImage}
              alt={`${personnel.rank || "Rank"} Badge`}
              className={styles.rankImage}
              onError={(e) => {
                e.target.onerror = null;
                e.target.style.display = 'none';
                e.target.parentNode.querySelector('.rankPlaceholder').style.display = 'flex';
              }}
            />
          ) : null}
          <div 
            className={`${styles.rankPlaceholder} ${rankImage ? styles.hidden : styles.show}`}
            style={{
              display: rankImage ? 'none' : 'flex',
            }}
          >
            <span className={styles.rankPlaceholderText}>
              {personnel.rank?.charAt(0) || 'R'}
            </span>
          </div>
        </div>
      </div>
      
      <div className={styles.preCardBody}>
        <div><strong>Station:</strong> {personnel.station || "N/A"}</div>
        <div><strong>Birth Date:</strong> {birthDate}</div>
        <div><strong>Date Hired:</strong> <span dangerouslySetInnerHTML={{ __html: dateHired }} /></div>
        <div><strong>Retirement:</strong> <span dangerouslySetInnerHTML={{ __html: retirementDate }} /></div>
      </div>
      
      <div className={styles.preCardActions}>
        <div className={styles.preDocumentUpload}>
          <select 
            id={`doc-category-${index}`} 
            value={selectedCategory}
            onChange={handleCategoryChange}
            disabled={uploading}
          >
            <option value="Medical Record">Medical Record</option>
            <option value="Award/Commendation">Award/Commendation</option>
            <option value="Others">Others</option>
          </select>
          
          <div className={styles.preFileUpload}>
            <input
              type="file"
              id={`fileInput-${index}`}
              multiple
              onChange={(e) => onPrepareUpload(e, index)}
              disabled={uploading}
            />
            <label 
              htmlFor={`fileInput-${index}`} 
              className={uploading ? styles.disabled : ""}
            >
              {uploading ? "⏳ Uploading..." : "📂 Choose Files"}
            </label>
          </div>

          {hasPendingFiles && (
            <div className={styles.pendingFilesInfo}>
              <small>
                {fileCount} file(s) selected
                {medicalRecordType && selectedCategory === "Medical Record" && (
                  <span> • Type: {medicalRecordType}</span>
                )}
                {awardType && selectedCategory === "Award/Commendation" && (
                  <span> • Type: {awardType}</span>
                )}
              </small>
            </div>
          )}

          <button
            className={`${styles.preBtn} ${styles.preSaveFilesBtn} ${uploading ? styles.disabled : ""}`}
            onClick={() => onSaveUploadedFiles(index)}
            disabled={!hasPendingFiles || uploading}
          >
            {uploading ? "Uploading..." : "Save Files"}
          </button>
          
          <DocumentList
            documents={personnel.documents || []}
            personnel={personnel}
            onDocumentClick={onDocumentClick}
            onRemoveDocument={onRemoveDocument}
            formatTimestamp={formatTimestamp}
            disabled={uploading}
          />
        </div>
      </div>
    </div>
  );
};

// DocumentList Component
const DocumentList = ({
  documents,
  personnel,
  onDocumentClick,
  onRemoveDocument,
  formatTimestamp,
  disabled = false
}) => {
  if (!documents || !documents.length) {
    return (
      <div className={styles.preDocumentList}>
        <i>No documents uploaded</i>
      </div>
    );
  }

  const getFileIcon = (fileName) => {
    if (fileName.toLowerCase().endsWith(".pdf")) return "📄";
    if (fileName.toLowerCase().match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i)) return "🖼️";
    if (fileName.toLowerCase().match(/\.(doc|docx)$/i)) return "📝";
    if (fileName.toLowerCase().match(/\.(xls|xlsx)$/i)) return "📊";
    return "📎";
  };

  return (
    <div className={styles.preDocumentList}>
      {documents.map((doc) => (
        <div
          key={doc.id}
          className={`${styles.preDocumentItem} ${disabled ? styles.disabled : ""}`}
          onClick={() => !disabled && onDocumentClick(doc, personnel)}
        >
          <div className={styles.documentContent}>
            <div className={styles.documentInfo}>
              <span className={styles.documentIcon}>
                {getFileIcon(doc.name)}
              </span>
              <div className={styles.documentDetails}>
                <div className={styles.documentTitle}>
                  <strong className={styles.documentCategory}>
                    [{doc.category}]
                  </strong>
                  <span className={styles.documentName}>{doc.name}</span>
                  {doc.record_type && (
                    <span className={styles.recordTypeBadge}>
                      {doc.record_type}
                    </span>
                  )}
                </div>
                <small className={styles.preDocumentMeta}>
                  {formatTimestamp(doc.uploaded_at)}
                  {doc.file_size && ` • ${Math.round(doc.file_size / 1024)}KB`}
                </small>
              </div>
            </div>
            {!disabled && (
              <button
                className={styles.preRemoveBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveDocument(doc);
                }}
                title="Remove document"
                disabled={disabled}
              >
                ×
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default PersonnelProfile;