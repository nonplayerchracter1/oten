import React, { useState, useEffect } from "react";
import styles from "../styles/EmployeeLeaveRequest.module.css";
import Hamburger from "../../Hamburger.jsx";
import EmployeeSidebar from "../../EmployeeSidebar.jsx";
import { useSidebar } from "../../SidebarContext.jsx";
import { useAuth } from "../../AuthContext.jsx";
import { Title, Meta } from "react-head";
import { supabase } from "../../../lib/supabaseClient.js";

const EmployeeLeaveRequest = () => {
  const [formData, setFormData] = useState({
    employeeName: "",
    dateOfFiling: "",
    leaveType: "",
    startDate: "",
    endDate: "",
    numDays: 0,
  });

  const [leaveBalance, setLeaveBalance] = useState({
    vacation: 0,
    sick: 0,
    emergency: 0,
  });

  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showSickLeaveModal, setShowSickLeaveModal] = useState(false); // NEW: Sick leave modal
  const [chosenLocation, setChosenLocation] = useState("");
  const [sickLeaveDetails, setSickLeaveDetails] = useState({
    // NEW: Sick leave details
    type: "", // "in_hospital" or "out_patient"
    illness: "", // illness description
  });
  const [showToast, setShowToast] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const { isSidebarCollapsed } = useSidebar();
  const { user, loading: authLoading } = useAuth();
  const [submitLoading, setSubmitLoading] = useState(false);
  const [employeeId, setEmployeeId] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [showInsufficientModal, setShowInsufficientModal] = useState(false);
  const [insufficientModalMessage, setInsufficientModalMessage] = useState("");
  const [hireDate, setHireDate] = useState(null);
  const [leaveBalanceId, setLeaveBalanceId] = useState(null);

  // Separate state for location details
  const [abroadLocation, setAbroadLocation] = useState("");
  const [philippinesLocation, setPhilippinesLocation] = useState("");

  // Format date as YYYY-MM-DD
  const formatDate = (date) => date.toISOString().split("T")[0];

  // Calculate days between dates
  const calculateDays = (start, end) => {
    if (!start || !end) return 0;
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (isNaN(startDate) || isNaN(endDate) || endDate < startDate) return 0;
    const timeDiff = endDate - startDate;
    return Math.floor(timeDiff / (1000 * 60 * 60 * 24)) + 1;
  };

  // Calculate pro-rated leave using your exact formula
  const calculateProRatedLeave = (hireDateStr, targetDate = new Date()) => {
    if (!hireDateStr) return 0;

    const hireDate = new Date(hireDateStr);
    const target = new Date(targetDate);

    if (hireDate > target) return 0;

    if (
      hireDate.getFullYear() === target.getFullYear() &&
      hireDate.getMonth() === target.getMonth()
    ) {
      const hireDay = hireDate.getDate();
      const daysInMonth = new Date(
        hireDate.getFullYear(),
        hireDate.getMonth() + 1,
        0
      ).getDate();

      // Formula: Days Worked = Days in Month - (Hire Day - 1)
      const daysWorked = daysInMonth - (hireDay - 1);

      // Pro-rated leave: (Days Worked / Days in Month) × 1.25
      const proRatedLeave = (daysWorked / daysInMonth) * 1.25;
      return parseFloat(proRatedLeave.toFixed(3));
    }

    const yearsDiff = target.getFullYear() - hireDate.getFullYear();
    const monthsDiff = target.getMonth() - hireDate.getMonth();
    const totalMonths = Math.max(0, yearsDiff * 12 + monthsDiff);
    const effectiveMonths = Math.min(totalMonths, 12);

    return parseFloat((effectiveMonths * 1.25).toFixed(3));
  };

  // Calculate leaves taken from leave_requests table
  const calculateLeavesTaken = async (personnelId) => {
    try {
      const { data, error } = await supabase
        .from("leave_requests")
        .select("leave_type, num_days, status")
        .eq("personnel_id", personnelId)
        .in("status", ["Approved", "Pending"]);

      if (error) throw error;

      let vacationTaken = 0,
        sickTaken = 0,
        emergencyTaken = 0;

      data?.forEach((request) => {
        const days = parseFloat(request.num_days) || 0;
        switch (request.leave_type) {
          case "Vacation":
            vacationTaken += days;
            break;
          case "Sick":
            sickTaken += days;
            break;
          case "Emergency":
            emergencyTaken += days;
            break;
        }
      });

      return { vacationTaken, sickTaken, emergencyTaken };
    } catch (error) {
      console.error("Error calculating leaves taken:", error);
      return { vacationTaken: 0, sickTaken: 0, emergencyTaken: 0 };
    }
  };

  // Get or create leave balance record in database
  const getOrCreateLeaveBalance = async (personnelId, hireDateStr) => {
    try {
      const year = new Date().getFullYear();

      const { data: existingBalance, error: fetchError } = await supabase
        .from("leave_balances")
        .select("*")
        .eq("personnel_id", personnelId)
        .eq("year", year)
        .single();

      if (fetchError && fetchError.code === "PGRST116") {
        const earnedCredits = calculateProRatedLeave(hireDateStr);

        const newBalance = {
          personnel_id: personnelId,
          year: year,
          vacation_balance: Math.min(earnedCredits, 15),
          sick_balance: Math.min(earnedCredits, 15),
          emergency_balance: Math.min(earnedCredits, 5),
        };

        const { data: createdBalance, error: createError } = await supabase
          .from("leave_balances")
          .insert([newBalance])
          .select()
          .single();

        if (createError) {
          const earned = calculateProRatedLeave(hireDateStr);
          return {
            vacation: Math.min(earned, 15),
            sick: Math.min(earned, 15),
            emergency: Math.min(earned, 5),
          };
        }

        setLeaveBalanceId(createdBalance.id);
        return {
          vacation: parseFloat(createdBalance.vacation_balance),
          sick: parseFloat(createdBalance.sick_balance),
          emergency: parseFloat(createdBalance.emergency_balance),
        };
      }

      if (fetchError) {
        const earned = calculateProRatedLeave(hireDateStr);
        return {
          vacation: Math.min(earned, 15),
          sick: Math.min(earned, 15),
          emergency: Math.min(earned, 5),
        };
      }

      setLeaveBalanceId(existingBalance.id);
      return {
        vacation: parseFloat(existingBalance.vacation_balance),
        sick: parseFloat(existingBalance.sick_balance),
        emergency: parseFloat(existingBalance.emergency_balance),
      };
    } catch (error) {
      console.error("Error in getOrCreateLeaveBalance:", error);
      const earned = calculateProRatedLeave(hireDateStr);
      return {
        vacation: Math.min(earned, 15),
        sick: Math.min(earned, 15),
        emergency: Math.min(earned, 5),
      };
    }
  };

  // Calculate total leave balance for a specific type
  const getLeaveBalanceForType = (leaveType) => {
    switch (leaveType) {
      case "Vacation":
        return leaveBalance.vacation;
      case "Sick":
        return leaveBalance.sick;
      case "Emergency":
        return leaveBalance.emergency;
      default:
        return 0;
    }
  };

  // Check if employee has sufficient leave balance (1.25 minimum rule)
  const hasSufficientBalance = (leaveType, requestedDays) => {
    const balance = getLeaveBalanceForType(leaveType);
    const remainingAfterRequest = balance - requestedDays;
    return remainingAfterRequest >= 1.25;
  };

  // Show insufficient balance modal
  const showInsufficientBalanceModal = (leaveType, requestedDays) => {
    const balance = getLeaveBalanceForType(leaveType);
    const requiredMin = 1.25;

    setInsufficientModalMessage(
      `Cannot submit ${leaveType} Leave request.\n\n` +
        `Current balance: ${balance.toFixed(2)} days\n` +
        `Requested: ${requestedDays} days\n` +
        `Minimum required after request: ${requiredMin} days\n\n` +
        `You need at least ${(requestedDays + requiredMin).toFixed(
          2
        )} days total.`
    );
    setShowInsufficientModal(true);
  };

  // Update leave balance in database
  const updateLeaveBalanceInDB = async (leaveType, daysToDeduct) => {
    if (!leaveBalanceId) {
      console.log("No leaveBalanceId, skipping database update");
      return false;
    }

    const fieldMap = {
      Vacation: "vacation_balance",
      Sick: "sick_balance",
      Emergency: "emergency_balance",
    };

    const fieldName = fieldMap[leaveType];
    if (!fieldName) {
      console.error("Invalid leave type:", leaveType);
      return false;
    }

    try {
      // Get current balance
      const { data: currentBalance, error: fetchError } = await supabase
        .from("leave_balances")
        .select(fieldName)
        .eq("id", leaveBalanceId)
        .single();

      if (fetchError) {
        console.error("Error fetching current balance:", fetchError);
        return false;
      }

      const currentValue = parseFloat(currentBalance[fieldName]);
      const newValue = Math.max(0, currentValue - daysToDeduct);

      // Update in database
      const { error: updateError } = await supabase
        .from("leave_balances")
        .update({
          [fieldName]: newValue,
          updated_at: new Date().toISOString(),
        })
        .eq("id", leaveBalanceId);

      if (updateError) {
        console.error("Error updating leave balance:", updateError);
        return false;
      }

      console.log(
        `Updated ${leaveType} balance from ${currentValue} to ${newValue}`
      );
      return true;
    } catch (error) {
      console.error("Error updating database balance:", error);
      return false;
    }
  };

  // Load employee data from Supabase
  const loadEmployeeData = async () => {
    try {
      setIsLoading(true);

      if (!user) {
        window.location.href = "/index.html";
        return;
      }

      const { data: employeeData, error: employeeError } = await supabase
        .from("personnel")
        .select("*")
        .eq("username", user.username)
        .single();

      if (employeeError) throw employeeError;

      if (employeeData) {
        setEmployeeId(employeeData.id);
        setHireDate(employeeData.hire_date);

        const middle = employeeData.middle_name
          ? ` ${employeeData.middle_name}`
          : "";
        const fullName =
          `${employeeData.first_name}${middle} ${employeeData.last_name}`.trim();
        setFormData((prev) => ({ ...prev, employeeName: fullName }));

        const balanceRecord = await getOrCreateLeaveBalance(
          employeeData.id,
          employeeData.hire_date
        );
        const leavesTaken = await calculateLeavesTaken(employeeData.id);

        const finalBalance = {
          vacation: Math.max(
            0,
            balanceRecord.vacation - leavesTaken.vacationTaken
          ),
          sick: Math.max(0, balanceRecord.sick - leavesTaken.sickTaken),
          emergency: Math.max(
            0,
            balanceRecord.emergency - leavesTaken.emergencyTaken
          ),
        };

        console.log("Calculated leave balance:", {
          earned: balanceRecord,
          taken: leavesTaken,
          final: finalBalance,
        });

        setLeaveBalance(finalBalance);
      }
    } catch (error) {
      console.error("Error loading employee data:", error);
      setErrorMessage("Failed to load employee data. Please refresh.");
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize form when user is loaded
  useEffect(() => {
    if (!authLoading && user) {
      loadEmployeeData();

      const today = formatDate(new Date());
      const minStartDate = new Date();
      minStartDate.setDate(minStartDate.getDate() + 5);
      const minStart = formatDate(minStartDate);

      setFormData((prev) => ({
        ...prev,
        dateOfFiling: today,
        startDate: minStart,
        endDate: minStart,
        numDays: calculateDays(minStart, minStart),
      }));
    }
  }, [user, authLoading]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      window.location.href = "/index.html";
    }
  }, [user, authLoading]);

  // Update days when start or end date changes
  useEffect(() => {
    const days = calculateDays(formData.startDate, formData.endDate);
    setFormData((prev) => ({ ...prev, numDays: days }));
  }, [formData.startDate, formData.endDate]);

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;

    if (name === "leaveType") {
      if (value === "Vacation") {
        setShowLocationModal(true);
        setChosenLocation("");
        // Reset location fields when opening modal
        setAbroadLocation("");
        setPhilippinesLocation("");
      } else if (value === "Sick") {
        // NEW: Open sick leave modal
        setShowSickLeaveModal(true);
        setSickLeaveDetails({
          type: "",
          illness: "",
        });
      } else {
        // For other leave types, reset all modals
        setChosenLocation("");
        setSickLeaveDetails({
          type: "",
          illness: "",
        });
      }
    }

    setFormData((prev) => ({ ...prev, [name]: value }));

    if (name === "startDate" && formData.endDate < value) {
      setFormData((prev) => ({ ...prev, endDate: value }));
    }
  };

  // Handle location confirmation
  const handleConfirmLocation = () => {
    if (selectedLocation === "Abroad" && abroadLocation.trim()) {
      // ADD "Abroad: " prefix
      const fullLocation = `Abroad: ${abroadLocation.trim()}`;
      setChosenLocation(fullLocation);
      setShowLocationModal(false);
      setSelectedLocation("");
      setAbroadLocation("");
      setPhilippinesLocation("");
    } else if (
      selectedLocation === "Philippines" &&
      philippinesLocation.trim()
    ) {
      // ADD "Philippines: " prefix
      const fullLocation = `Philippines: ${philippinesLocation.trim()}`;
      setChosenLocation(fullLocation);
      setShowLocationModal(false);
      setSelectedLocation("");
      setAbroadLocation("");
      setPhilippinesLocation("");
    } else if (!selectedLocation) {
      alert("Please select a location (Abroad or Philippines).");
    } else if (selectedLocation === "Abroad" && !abroadLocation.trim()) {
      alert("Please specify the country and city for abroad location.");
    } else if (
      selectedLocation === "Philippines" &&
      !philippinesLocation.trim()
    ) {
      alert(
        "Please specify the province and city/municipality for Philippines location."
      );
    }
  };

  // NEW: Handle sick leave details confirmation
  const handleConfirmSickLeaveDetails = () => {
    if (!sickLeaveDetails.type) {
      alert("Please select whether it's In hospital or Out patient.");
      return;
    }

    if (!sickLeaveDetails.illness.trim()) {
      alert("Please specify the illness.");
      return;
    }

    setShowSickLeaveModal(false);
  };

  // NEW: Close sick leave modal
  const handleCloseSickLeaveModal = () => {
    setShowSickLeaveModal(false);
    if (formData.leaveType === "Sick") {
      setFormData((prev) => ({ ...prev, leaveType: "" }));
    }
    setSickLeaveDetails({
      type: "",
      illness: "",
    });
  };

  // Close location modal without selecting
  const handleCloseLocationModal = () => {
    setShowLocationModal(false);
    if (formData.leaveType === "Vacation") {
      setFormData((prev) => ({ ...prev, leaveType: "" }));
    }
    setSelectedLocation("");
    setAbroadLocation("");
    setPhilippinesLocation("");
  };

  // Close insufficient balance modal
  const handleCloseInsufficientModal = () => {
    setShowInsufficientModal(false);
    setInsufficientModalMessage("");
  };

  // Submit leave request to Supabase WITH balance tracking
  const submitLeaveRequest = async (leaveRequestData) => {
    try {
      console.log(
        "Submitting leave request with balance tracking:",
        leaveRequestData
      );

      const { error } = await supabase
        .from("leave_requests")
        .insert([leaveRequestData]);

      if (error) {
        console.error("Error submitting leave request:", error);
        throw error;
      }

      console.log("Leave request submitted successfully");
      return { success: true };
    } catch (error) {
      console.error("Error in submitLeaveRequest:", error);
      throw error;
    }
  };

  // Handle form submission to Supabase
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitLoading(true);
    setErrorMessage("");

    // Validations
    if (!formData.leaveType) {
      alert("Please select a leave type.");
      setSubmitLoading(false);
      return;
    }

    if (formData.leaveType === "Vacation" && !chosenLocation) {
      alert("Please select a location for vacation leave.");
      setShowLocationModal(true);
      setSubmitLoading(false);
      return;
    }

    if (
      formData.leaveType === "Sick" &&
      (!sickLeaveDetails.type || !sickLeaveDetails.illness)
    ) {
      alert("Please provide sick leave details.");
      setShowSickLeaveModal(true);
      setSubmitLoading(false);
      return;
    }

    if (!formData.startDate || !formData.endDate) {
      alert("Please select both start and end dates.");
      setSubmitLoading(false);
      return;
    }

    if (!formData.numDays || formData.numDays <= 0) {
      alert("Please enter a valid number of days.");
      setSubmitLoading(false);
      return;
    }

    // Check if employee has sufficient leave balance
    if (!hasSufficientBalance(formData.leaveType, formData.numDays)) {
      showInsufficientBalanceModal(formData.leaveType, formData.numDays);
      setSubmitLoading(false);
      return;
    }

    try {
      const balanceBefore = getLeaveBalanceForType(formData.leaveType);
      const balanceAfter = balanceBefore - formData.numDays;

      // In the handleSubmit function, update the leaveRequestData object:

      const leaveRequestData = {
        personnel_id: employeeId,
        username: user.username,
        employee_name: formData.employeeName,
        leave_type: formData.leaveType,
        location: formData.leaveType === "Vacation" ? chosenLocation : null,
        vacation_location_type:
          formData.leaveType === "Vacation"
            ? chosenLocation.startsWith("Abroad")
              ? "abroad"
              : "philippines"
            : null,
        date_of_filing: formData.dateOfFiling,
        start_date: formData.startDate,
        end_date: formData.endDate,
        num_days: parseFloat(formData.numDays),
        status: "Pending",
        reason:
          formData.leaveType === "Sick"
            ? `${
                sickLeaveDetails.type === "in_hospital"
                  ? "In hospital"
                  : "Out patient"
              }: ${sickLeaveDetails.illness}`
            : `Leave request for ${formData.leaveType.toLowerCase()} leave`,
        submitted_at: new Date().toISOString(),
        leave_balance_id: leaveBalanceId,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        // Use the new column names that match your database
        illness_type:
          formData.leaveType === "Sick" ? sickLeaveDetails.type : null,
        illness_details:
          formData.leaveType === "Sick" ? sickLeaveDetails.illness : null,
      };

      console.log("Submitting leave request with balance tracking...");

      // First update the leave balance in database
      const balanceUpdated = await updateLeaveBalanceInDB(
        formData.leaveType,
        formData.numDays
      );

      if (!balanceUpdated) {
        console.warn(
          "Could not update database balance, proceeding with local update only"
        );
      }

      // Submit the leave request
      const result = await submitLeaveRequest(leaveRequestData);

      if (result.success) {
        console.log("Leave request submitted successfully");

        // Update local leave balance
        setLeaveBalance((prev) => ({
          ...prev,
          [formData.leaveType.toLowerCase()]: parseFloat(
            balanceAfter.toFixed(2)
          ),
        }));

        // Show success toast
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);

        // Reset form
        const today = formatDate(new Date());
        const minStartDate = new Date();
        minStartDate.setDate(minStartDate.getDate() + 5);
        const minStart = formatDate(minStartDate);

        setFormData({
          employeeName: formData.employeeName,
          dateOfFiling: today,
          leaveType: "",
          startDate: minStart,
          endDate: minStart,
          numDays: calculateDays(minStart, minStart),
        });

        setChosenLocation("");
        setSelectedLocation("");
        setAbroadLocation("");
        setPhilippinesLocation("");
        setSickLeaveDetails({
          type: "",
          illness: "",
        });
        setErrorMessage("");
      }
    } catch (error) {
      console.error("Error saving leave request:", error);

      let errorMsg = "Failed to submit leave request. Please try again.";

      if (
        error.message?.includes("network") ||
        error.message?.includes("connection")
      ) {
        errorMsg =
          "Network error. Please check your internet connection and try again.";
      } else if (error.message?.includes("timeout")) {
        errorMsg = "Request timed out. Please try again.";
      } else if (error.code === "23503") {
        errorMsg =
          "Employee not found in database. Please contact administrator.";
      } else if (error.code === "23502") {
        errorMsg = "Missing required field. Please fill all required fields.";
      } else if (error.message?.includes("foreign key constraint")) {
        errorMsg =
          "Database configuration error. Please contact administrator.";
      } else if (error.message?.includes("balance_before")) {
        // If balance_before column doesn't exist, try without it
        console.log("balance_before column not found, retrying without it...");
        try {
          // Retry without balance tracking columns
 const retryData = {
   personnel_id: employeeId,
   username: user.username,
   employee_name: formData.employeeName,
   leave_type: formData.leaveType,
   location: formData.leaveType === "Vacation" ? chosenLocation : null,
   date_of_filing: formData.dateOfFiling,
   start_date: formData.startDate,
   end_date: formData.endDate,
   num_days: parseFloat(formData.numDays),
   status: "Pending",
   reason:
     formData.leaveType === "Sick"
       ? `${
           sickLeaveDetails.type === "in_hospital"
             ? "In hospital"
             : "Out patient"
         }: ${sickLeaveDetails.illness}`
       : `Leave request for ${formData.leaveType.toLowerCase()} leave`,
   submitted_at: new Date().toISOString(),
   // Use the new column names
   illness_type: formData.leaveType === "Sick" ? sickLeaveDetails.type : null,
   illness_details:
     formData.leaveType === "Sick" ? sickLeaveDetails.illness : null,
 };

          const { error: retryError } = await supabase
            .from("leave_requests")
            .insert([retryData]);

          if (retryError) throw retryError;

          // Update local state if successful
          setLeaveBalance((prev) => ({
            ...prev,
            [formData.leaveType.toLowerCase()]: parseFloat(
              (
                getLeaveBalanceForType(formData.leaveType) - formData.numDays
              ).toFixed(2)
            ),
          }));

          setShowToast(true);
          setTimeout(() => setShowToast(false), 3000);

          // Reset form
          const today = formatDate(new Date());
          const minStartDate = new Date();
          minStartDate.setDate(minStartDate.getDate() + 5);
          const minStart = formatDate(minStartDate);

          setFormData({
            employeeName: formData.employeeName,
            dateOfFiling: today,
            leaveType: "",
            startDate: minStart,
            endDate: minStart,
            numDays: calculateDays(minStart, minStart),
          });

          setChosenLocation("");
          setSelectedLocation("");
          setAbroadLocation("");
          setPhilippinesLocation("");
          setSickLeaveDetails({
            type: "",
            illness: "",
          });
          setErrorMessage("");
        } catch (retryError) {
          console.error("Retry failed:", retryError);
          errorMsg =
            "Database column missing. Please contact administrator to add balance_before and balance_after columns.";
        }
      } else if (error.message) {
        errorMsg = error.message;
      }

      setErrorMessage(errorMsg);
      alert(errorMsg);
    } finally {
      setSubmitLoading(false);
    }
  };

  // Handle form reset
  const handleReset = () => {
    const today = formatDate(new Date());
    const minStartDate = new Date();
    minStartDate.setDate(minStartDate.getDate() + 5);
    const minStart = formatDate(minStartDate);

    setFormData({
      employeeName: formData.employeeName,
      dateOfFiling: today,
      leaveType: "",
      startDate: minStart,
      endDate: minStart,
      numDays: calculateDays(minStart, minStart),
    });

    setChosenLocation("");
    setSelectedLocation("");
    setAbroadLocation("");
    setPhilippinesLocation("");
    setSickLeaveDetails({
      type: "",
      illness: "",
    });
    setShowLocationModal(false);
    setShowSickLeaveModal(false);
    setShowInsufficientModal(false);
    setErrorMessage("");
  };

  // Calculate progress percentages
  const maxVacationSickDays = 15;
  const maxEmergencyDays = 5;
  const vacationPercent = Math.min(
    (leaveBalance.vacation / maxVacationSickDays) * 100,
    100
  );
  const sickPercent = Math.min(
    (leaveBalance.sick / maxVacationSickDays) * 100,
    100
  );
  const emergencyPercent = Math.min(
    (leaveBalance.emergency / maxEmergencyDays) * 100,
    100
  );

  // Loading state
  if (authLoading || isLoading) {
    return (
      <div className="app">
        <EmployeeSidebar />
        <Hamburger />
        <div
          className={`main-content ${isSidebarCollapsed ? "collapsed" : ""}`}
        >
          <div className={styles.leaveFormContainer}>
            <div className={styles.loading}>Loading...</div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="app">
      <Title>Employee Leave Request | BFP Villanueva</Title>
      <Meta name="robots" content="noindex, nofollow" />
      <EmployeeSidebar />
      <Hamburger />
      <div className={`main-content ${isSidebarCollapsed ? "collapsed" : ""}`}>
        <div className={styles.leaveFormContainer}>
          <h2 className={styles.pageTitle}>Request Leave</h2>

          {/* Formula Info */}
          <div className={styles.formulaInfo}>
            <h4>Leave Credits Calculation Formula:</h4>
            <p>
              <strong>Pro–rated:</strong> (Days Worked / Days in Month) × 1.25
            </p>
            <p>
              <strong>Days Worked:</strong> Days in Month – (Hire Day – 1)
            </p>
            <p>
              <strong>Monthly Accrual:</strong> 1.25 days per month
            </p>
            <p>
              <strong>Rule:</strong> Must maintain ≥ 1.25 days after request
            </p>
            {hireDate && (
              <p className={styles.hireDateInfo}>
                <strong>Hire Date:</strong>{" "}
                {new Date(hireDate).toLocaleDateString()}
              </p>
            )}
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className={styles.errorMessage}>
              <span className={styles.errorIcon}>⚠️</span>
              {errorMessage}
            </div>
          )}

          <div className={styles.contentWrapper}>
            {/* Leave Balance Card */}
            <div className={styles.leaveBalance}>
              <h3>Leave Balance</h3>
              <div className={styles.balanceInfo}>
                <p>Minimum required balance: 1.25 days</p>
                <p>Accrual rate: 1.25 days/month</p>
                <p>Max: Vacation/Sick: 15 days | Emergency: 5 days</p>
              </div>
              <ul>
                <li>
                  <div className={styles.label}>
                    <span>Vacation</span>
                    <span>{leaveBalance.vacation.toFixed(2)} days</span>
                  </div>
                  <div className={styles.progress}>
                    <div
                      className={`${styles.progressBar} ${styles.progressVacation}`}
                      style={{ width: `${vacationPercent}%` }}
                    ></div>
                  </div>
                </li>
                <li>
                  <div className={styles.label}>
                    <span>Sick</span>
                    <span>{leaveBalance.sick.toFixed(2)} days</span>
                  </div>
                  <div className={styles.progress}>
                    <div
                      className={`${styles.progressBar} ${styles.progressSick}`}
                      style={{ width: `${sickPercent}%` }}
                    ></div>
                  </div>
                </li>
                <li>
                  <div className={styles.label}>
                    <span>Emergency</span>
                    <span>{leaveBalance.emergency.toFixed(2)} days</span>
                  </div>
                  <div className={styles.progress}>
                    <div
                      className={`${styles.progressBar} ${styles.progressEmergency}`}
                      style={{ width: `${emergencyPercent}%` }}
                    ></div>
                  </div>
                </li>
              </ul>
            </div>

            {/* Leave Request Form */}
            <form onSubmit={handleSubmit} className={styles.formCard}>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <input
                    type="text"
                    name="employeeName"
                    value={formData.employeeName}
                    readOnly
                    placeholder=" "
                  />
                  <label>Employee Name</label>
                </div>

                <div className={styles.formGroup}>
                  <input
                    type="date"
                    name="dateOfFiling"
                    value={formData.dateOfFiling}
                    onChange={handleInputChange}
                    required
                    max={formatDate(new Date())}
                  />
                  <label>Date of Filing</label>
                </div>

                <div className={styles.formGroup}>
                  <select
                    name="leaveType"
                    value={formData.leaveType}
                    onChange={handleInputChange}
                    required
                    disabled={submitLoading}
                  >
                    <option value="" disabled hidden></option>
                    <option value="Vacation">Vacation Leave</option>
                    <option value="Sick">Sick Leave</option>
                    <option value="Emergency">Emergency Leave</option>
                    <option value="Maternity">Maternity Leave</option>
                    <option value="Paternity">Paternity Leave</option>
                  </select>
                  <label>Leave Type</label>
                  {chosenLocation && formData.leaveType === "Vacation" && (
                    <small className={styles.chosenLocation}>
                      Location: {chosenLocation}
                    </small>
                  )}
                  {formData.leaveType === "Sick" && sickLeaveDetails.type && (
                    <small className={styles.chosenLocation}>
                      Type:{" "}
                      {sickLeaveDetails.type === "in_hospital"
                        ? "In hospital"
                        : "Out patient"}
                      {sickLeaveDetails.illness &&
                        ` - ${sickLeaveDetails.illness}`}
                    </small>
                  )}
                  {formData.leaveType && (
                    <small className={styles.availableBalance}>
                      Available:{" "}
                      {getLeaveBalanceForType(formData.leaveType).toFixed(2)}{" "}
                      days
                    </small>
                  )}
                </div>

                <div className={styles.formGroup}>
                  <input
                    type="date"
                    name="startDate"
                    value={formData.startDate}
                    onChange={handleInputChange}
                    required
                    min={formatDate(
                      new Date(new Date().setDate(new Date().getDate() + 5))
                    )}
                    disabled={submitLoading}
                  />
                  <label>Start Date</label>
                </div>

                <div className={styles.formGroup}>
                  <input
                    type="date"
                    name="endDate"
                    value={formData.endDate}
                    onChange={handleInputChange}
                    required
                    min={formData.startDate}
                    disabled={submitLoading}
                  />
                  <label>End Date</label>
                </div>

                <div className={styles.formGroup}>
                  <input
                    type="number"
                    name="numDays"
                    value={formData.numDays}
                    readOnly
                    className={styles.numDaysInput}
                  />
                  <label>Number of Days</label>
                  {formData.leaveType && formData.numDays > 0 && (
                    <div className={styles.daysWarning}>
                      {!hasSufficientBalance(
                        formData.leaveType,
                        formData.numDays
                      ) ? (
                        <span className={styles.warningText}>
                          ⚠️ Will leave less than 1.25 days
                        </span>
                      ) : (
                        <span className={styles.okText}>
                          ✓ Sufficient balance
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className={styles.formButtons}>
                <button
                  type="button"
                  onClick={handleReset}
                  className={styles.btnSecondary}
                  disabled={submitLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.btnPrimary}
                  disabled={submitLoading}
                >
                  {submitLoading ? "Submitting..." : "Submit Request"}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Location Modal for Vacation Leave */}
        {showLocationModal && (
          <div className={styles.modal} style={{ display: "flex" }}>
            <div className={styles.modalContent}>
              <span
                className={styles.closeBtn}
                onClick={handleCloseLocationModal}
              >
                &times;
              </span>
              <h3>Select Location for Vacation Leave</h3>

              <div className={styles.modalRadioOptions}>
                <label>
                  <input
                    type="radio"
                    name="location"
                    value="Abroad"
                    checked={selectedLocation === "Abroad"}
                    onChange={(e) => {
                      setSelectedLocation(e.target.value);
                      setPhilippinesLocation("");
                    }}
                  />
                  Abroad
                </label>
                <label>
                  <input
                    type="radio"
                    name="location"
                    value="Philippines"
                    checked={selectedLocation === "Philippines"}
                    onChange={(e) => {
                      setSelectedLocation(e.target.value);
                      setAbroadLocation("");
                    }}
                  />
                  Philippines
                </label>
              </div>

              {/* Abroad Location Input */}
              {selectedLocation === "Abroad" && (
                <div className={styles.locationDetails}>
                  <label htmlFor="abroadLocation">Country and City:</label>
                  <input
                    id="abroadLocation"
                    type="text"
                    value={abroadLocation}
                    onChange={(e) => setAbroadLocation(e.target.value)}
                    placeholder="e.g., Japan, Tokyo"
                    className={styles.locationInput}
                  />
                  <small className={styles.locationHint}>
                    Please specify the country and city
                  </small>
                </div>
              )}

              {/* Philippines Location Input */}
              {selectedLocation === "Philippines" && (
                <div className={styles.locationDetails}>
                  <label htmlFor="philippinesLocation">
                    Province and City/Municipality:
                  </label>
                  <input
                    id="philippinesLocation"
                    type="text"
                    value={philippinesLocation}
                    onChange={(e) => setPhilippinesLocation(e.target.value)}
                    placeholder="e.g., Cebu Province, Cebu City"
                    className={styles.locationInput}
                  />
                  <small className={styles.locationHint}>
                    Please specify the province and city/municipality
                  </small>
                </div>
              )}

              <div className={styles.modalActions}>
                <button
                  onClick={handleConfirmLocation}
                  className={styles.btnPrimary}
                  disabled={
                    !selectedLocation ||
                    (selectedLocation === "Abroad" && !abroadLocation.trim()) ||
                    (selectedLocation === "Philippines" &&
                      !philippinesLocation.trim())
                  }
                >
                  Confirm Location
                </button>
              </div>
            </div>
          </div>
        )}

        {/* NEW: Sick Leave Modal */}
        {showSickLeaveModal && (
          <div className={styles.modal} style={{ display: "flex" }}>
            <div className={styles.modalContent}>
              <span
                className={styles.closeBtn}
                onClick={handleCloseSickLeaveModal}
              >
                &times;
              </span>
              <h3>Sick Leave Details</h3>

              <div className={styles.modalRadioOptions}>
                <label>
                  <input
                    type="radio"
                    name="sickLeaveType"
                    value="in_hospital"
                    checked={sickLeaveDetails.type === "in_hospital"}
                    onChange={(e) =>
                      setSickLeaveDetails((prev) => ({
                        ...prev,
                        type: e.target.value,
                      }))
                    }
                  />
                  In hospital
                </label>
                <label>
                  <input
                    type="radio"
                    name="sickLeaveType"
                    value="out_patient"
                    checked={sickLeaveDetails.type === "out_patient"}
                    onChange={(e) =>
                      setSickLeaveDetails((prev) => ({
                        ...prev,
                        type: e.target.value,
                      }))
                    }
                  />
                  Out patient
                </label>
              </div>

              {/* Illness Input */}
              <div className={styles.locationDetails}>
                <label htmlFor="illnessDetails">Specify Illness:</label>
                <textarea
                  id="illnessDetails"
                  value={sickLeaveDetails.illness}
                  onChange={(e) =>
                    setSickLeaveDetails((prev) => ({
                      ...prev,
                      illness: e.target.value,
                    }))
                  }
                  placeholder="e.g., Flu with high fever, Dengue fever, etc."
                  className={styles.locationInput}
                  rows="3"
                />
                <small className={styles.locationHint}>
                  Please describe the illness or medical condition
                </small>
              </div>

              <div className={styles.modalActions}>
                <button
                  onClick={handleConfirmSickLeaveDetails}
                  className={styles.btnPrimary}
                  disabled={
                    !sickLeaveDetails.type || !sickLeaveDetails.illness.trim()
                  }
                >
                  Confirm Sick Leave Details
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Insufficient Balance Modal */}
        {showInsufficientModal && (
          <div className={styles.modal} style={{ display: "flex" }}>
            <div className={styles.modalContent}>
              <span
                className={styles.closeBtn}
                onClick={handleCloseInsufficientModal}
              >
                &times;
              </span>
              <h3>Insufficient Leave Balance</h3>
              <div className={styles.insufficientMessage}>
                <p style={{ whiteSpace: "pre-line" }}>
                  {insufficientModalMessage}
                </p>
                <p className={styles.importantNote}>
                  <strong>Important:</strong> You must maintain at least 1.25
                  days after your request.
                </p>
              </div>
              <div className={styles.modalActions}>
                <button
                  onClick={handleCloseInsufficientModal}
                  className={styles.btnPrimary}
                >
                  I Understand
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast Notification */}
        {showToast && (
          <div
            className={styles.toast}
            style={{ opacity: 1, transform: "translateY(0)" }}
          >
            ✅ Leave request submitted successfully!
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployeeLeaveRequest;
