// utils/pdfLeaveFormFiller.js
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

/**
 * Enhanced PDF filling function based on LeaveManagement.jsx
 * @param {ArrayBuffer} pdfBytes - Original PDF template bytes
 * @param {Object} leaveData - Leave request data
 * @param {Object} options - Additional options
 * @returns {Promise<Uint8Array>} - Filled PDF bytes
 */
export const fillLeaveFormEnhanced = async (
  pdfBytes,
  leaveData,
  options = {}
) => {
  try {
    const {
      isYearly = false,
      generationDate = null,
      adminUsername = "System",
    } = options;

    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const defaultFontSize = 10;
    const textColor = rgb(0, 0, 0);

    // Define coordinates for each leave type checkbox (from LeaveManagement)
    const leaveTypeCheckboxCoordinates = {
      "Vacation Leave": { x: 57, y: 702 },
      "Mandatory/Forced Leave": { x: 57, y: 702 },
      "Sick Leave": { x: 57, y: 673 },
      "Maternity Leave": { x: 57, y: 702 },
      "Paternity Leave": { x: 57, y: 702 },
      "Special Privilege Leave": { x: 57, y: 702 },
      "Solo Parent Leave": { x: 57, y: 702 },
      "Study Leave": { x: 57, y: 702 },
      "10-Day VAWC Leave": { x: 57, y: 702 },
      "Rehabilitation Privilege": { x: 57, y: 702 },
      "Special Leave Benefits for Women": { x: 57, y: 702 },
      "Special Emergency (Calamity) Leave": { x: 57, y: 543 },
      "Adoption Leave": { x: 57, y: 702 },
      Others: { x: 57, y: 702 },
    };

    // Coordinates for abroad/Philippines checkboxes
    const vacationLocationCoordinates = {
      philippines: { x: 347, y: 687 }, // Coordinates for "Within the Philippines" checkbox
      abroad: { x: 347, y: 672 }, // Coordinates for "Abroad" checkbox
    };

    // Coordinates for sick leave checkboxes (IN HOSPITAL / OUT PATIENT)
    const sickLeaveCheckboxCoordinates = {
      in_hospital: { x: 347, y: 644 }, // Coordinates for "IN HOSPITAL" checkbox
      out_patient: { x: 347, y: 630 }, // Coordinates for "OUT PATIENT" checkbox
    };

    // Define coordinates for name fields with boundaries (from LeaveManagement)
    const nameFields = {
      lastName: {
        x: 270,
        y: 775,
        minX: 250,
        maxX: 370,
        maxWidth: 100,
        text: leaveData.lastName || "",
      },
      firstName: {
        x: 385,
        y: 775,
        minX: 365,
        maxX: 485,
        maxWidth: 100,
        text: leaveData.firstName || "",
      },
      middleName: {
        x: 505,
        y: 775,
        minX: 475,
        maxX: 550,
        maxWidth: 60,
        text: leaveData.middleName || "",
      },
    };

    // Define coordinates for other form fields (from LeaveManagement with adjustments)
    const fieldCoordinates = {
      // Rank and station
      rank: { x: 316, y: 753 },
      station: { x: 90, y: 775 },
      dateOfFiling: { x: 150, y: 753 },
      // Additional Info - Vacation
      locationPhilippines: { x: 460, y: 690 }, // Position for Philippines location
      locationAbroad: { x: 460, y: 675 }, // Position for Abroad location (below Philippines)

      // Additional Info - Sick Leave (SEPARATE POSITIONS)
      illnessDetailsInHospital: { x: 460, y: 644 }, // Position for IN HOSPITAL illness details
      illnessDetailsOutPatient: { x: 460, y: 630 }, // Position for OUT PATIENT illness details (below IN HOSPITAL)

      // Balance fields (from LeaveRecords but using LeaveManagement positions)
      asOfDate: { x: 152, y: 375 },
      vacationTotalEarned: { x: 155, y: 340 },
      vacationLessApplication: { x: 155, y: 323 },
      vacationBalance: { x: 155, y: 310 },
      sickTotalEarned: { x: 237, y: 340 },
      sickLessApplication: { x: 237, y: 323 },
      sickBalance: { x: 237, y: 310 },
    };

    // Helper function to split long text into multiple lines
    const splitTextIntoLines = (text, maxLength) => {
      if (!text) return [];
      const words = text.split(" ");
      const lines = [];
      let currentLine = "";

      for (const word of words) {
        if ((currentLine + word).length > maxLength) {
          lines.push(currentLine.trim());
          currentLine = word + " ";
        } else {
          currentLine += word + " ";
        }
      }

      if (currentLine.trim()) {
        lines.push(currentLine.trim());
      }

      return lines;
    };

    // Helper function to format dates
    const formatDateForPDF = (dateString) => {
      if (!dateString || dateString === "N/A") return "";
      try {
        const date = new Date(dateString);
        return date.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
      } catch (error) {
        return dateString;
      }
    };

    // Helper function to calculate text width
    const calculateTextWidth = (text, fontSize) => {
      if (!text) return 0;
      // Approximate width calculation for Helvetica
      const avgCharWidthRatio = 0.6;
      return text.length * avgCharWidthRatio * fontSize;
    };

    // Helper function for drawing text
    const drawText = (text, x, y, size = defaultFontSize) => {
      if (text && typeof text === "string" && text.trim() !== "") {
        firstPage.drawText(text.trim(), {
          x,
          y,
          size: size,
          font: font,
          color: textColor,
        });
      }
    };

    // Helper function to draw numbers
    const drawNumber = (number, x, y, size = defaultFontSize) => {
      if (number !== null && number !== undefined) {
        const formatted =
          typeof number === "number"
            ? number.toFixed(2)
            : parseFloat(number || 0).toFixed(2);

        drawText(formatted, x, y, size);
      }
    };

    // Helper function to check if all names fit with a given font size
    const checkAllNamesFit = (fontSize) => {
      for (const [fieldName, field] of Object.entries(nameFields)) {
        if (field.text.trim() === "") continue;

        const textWidth = calculateTextWidth(field.text, fontSize);
        const maxAllowedWidth = field.maxX - field.x;

        if (textWidth > maxAllowedWidth) {
          return false;
        }
      }
      return true;
    };

    // Find optimal font size that works for all names
    const findOptimalFontSizeForAllNames = () => {
      let fontSize = defaultFontSize;

      // Try decreasing font size until all names fit
      while (fontSize > 7) {
        if (checkAllNamesFit(fontSize)) {
          return fontSize;
        }
        fontSize -= 0.5; // Decrease by 0.5 for finer granularity
      }

      // Return minimum font size if no better option
      return 7;
    };

    // Calculate optimal positions for all names with consistent font size
    const calculateOptimalPositions = (commonFontSize) => {
      const positions = {};

      for (const [fieldName, field] of Object.entries(nameFields)) {
        if (field.text.trim() === "") {
          positions[fieldName] = { x: field.x, fontSize: commonFontSize };
          continue;
        }

        const textWidth = calculateTextWidth(field.text, commonFontSize);
        let optimalX = field.x;

        // Adjust position to prevent overflow
        if (field.x + textWidth > field.maxX) {
          // Move left to fit within boundaries
          optimalX = Math.max(field.minX, field.maxX - textWidth);
        }

        positions[fieldName] = { x: optimalX, fontSize: commonFontSize };
      }

      return positions;
    };

    // Check for overlaps between names
    const checkForOverlaps = (positions) => {
      const textRanges = [];

      for (const [fieldName, field] of Object.entries(nameFields)) {
        if (field.text.trim() === "") continue;

        const position = positions[fieldName];
        const textWidth = calculateTextWidth(field.text, position.fontSize);

        textRanges.push({
          fieldName,
          startX: position.x,
          endX: position.x + textWidth,
          y: field.y,
        });
      }

      // Sort by startX for easier overlap detection
      textRanges.sort((a, b) => a.startX - b.startX);

      // Check for overlaps
      for (let i = 1; i < textRanges.length; i++) {
        const prev = textRanges[i - 1];
        const current = textRanges[i];

        if (current.startX < prev.endX) {
          // Overlap detected
          return {
            hasOverlap: true,
            overlappingFields: [prev.fieldName, current.fieldName],
            overlapAmount: prev.endX - current.startX,
          };
        }
      }

      return { hasOverlap: false };
    };

    // Adjust positions to resolve overlaps
    const resolveOverlaps = (positions, overlaps) => {
      const adjustedPositions = { ...positions };

      if (!overlaps.hasOverlap) return adjustedPositions;

      // For simplicity, we'll adjust the later field to the right
      const [firstField, secondField] = overlaps.overlappingFields;
      const secondFieldInfo = nameFields[secondField];
      const overlapAmount = overlaps.overlapAmount;

      // Try to move the second field to the right
      const newX = Math.min(
        secondFieldInfo.maxX,
        adjustedPositions[secondField].x + overlapAmount + 2 // Add 2pt padding
      );

      // Check if we can move it without exceeding maxX
      const textWidth = calculateTextWidth(
        secondFieldInfo.text,
        adjustedPositions[secondField].fontSize
      );

      if (newX + textWidth <= secondFieldInfo.maxX) {
        adjustedPositions[secondField].x = newX;
      } else {
        // If can't move right, try moving first field left
        const firstFieldInfo = nameFields[firstField];
        const newFirstX = Math.max(
          firstFieldInfo.minX,
          adjustedPositions[firstField].x - overlapAmount - 2
        );

        adjustedPositions[firstField].x = newFirstX;
      }

      return adjustedPositions;
    };

    // ========== FILLING THE FORM ==========

    // Step 1: Extract name components from fullName
    const fullName = leaveData.fullName || leaveData.employeeName || "";
    const nameParts = fullName.trim().split(/\s+/);

    // Simple name parsing (adjust based on your data structure)
    if (nameParts.length >= 2) {
      nameFields.lastName.text = nameParts[nameParts.length - 1] || "";
      nameFields.firstName.text = nameParts[0] || "";
      nameFields.middleName.text = nameParts.slice(1, -1).join(" ") || "";
    } else {
      nameFields.firstName.text = fullName;
    }

    // Step 2: Find optimal font size for all names
    const commonFontSize = findOptimalFontSizeForAllNames();

    // Step 3: Calculate initial positions
    let positions = calculateOptimalPositions(commonFontSize);

    // Step 4: Check and resolve overlaps
    let overlaps = checkForOverlaps(positions);
    let attempts = 0;
    const maxAttempts = 5;

    while (overlaps.hasOverlap && attempts < maxAttempts) {
      positions = resolveOverlaps(positions, overlaps);
      overlaps = checkForOverlaps(positions);
      attempts++;
    }

    // Step 5: Actually draw the names using calculated positions
    for (const [fieldName, field] of Object.entries(nameFields)) {
      if (field.text.trim() === "") continue;

      const position = positions[fieldName];

      // Actually draw the text with calculated position and font size
      firstPage.drawText(field.text.trim(), {
        x: position.x,
        y: field.y,
        size: position.fontSize,
        font: font,
        color: textColor,
      });
    }

    // Step 6: Fill other fields

    // Rank and station
    drawText(
      leaveData.rank || "",
      fieldCoordinates.rank.x,
      fieldCoordinates.rank.y
    );
    drawText(
      leaveData.station || "",
      fieldCoordinates.station.x,
      fieldCoordinates.station.y
    );

    // Leave type checkbox
    const selectedLeaveType = leaveData.leaveType || "";
    const leaveTypeLower = selectedLeaveType.toLowerCase();

    // Find matching leave type
    const leaveTypeEntries = Object.entries(leaveTypeCheckboxCoordinates);
    const matchedLeaveType = leaveTypeEntries.find(([typeName, _]) => {
      const normalizedInput = selectedLeaveType.toLowerCase().trim();
      const normalizedType = typeName.toLowerCase().trim();
      return (
        normalizedType.includes(normalizedInput) ||
        normalizedInput.includes(normalizedType)
      );
    });

    // Place check mark if we found a match
    if (matchedLeaveType) {
      const [matchedTypeName, coordinates] = matchedLeaveType;
      drawText("X", coordinates.x, coordinates.y, 12);
    } else if (leaveTypeCheckboxCoordinates["Others"]) {
      drawText(
        "X",
        leaveTypeCheckboxCoordinates["Others"].x,
        leaveTypeCheckboxCoordinates["Others"].y,
        12
      );
    }

    // Fill dates
    // Fill dates
    if (fieldCoordinates.dateOfFiling) {
      // Format the date
      const filingDate = formatDateForPDF(
        leaveData.dateRequested ||
          leaveData.dateOfFiling ||
          leaveData.created_at ||
          leaveData.date_of_filing
      );

      console.log("Date of Filing:", filingDate);
      console.log("Drawing at coordinates:", fieldCoordinates.dateOfFiling);

      if (filingDate) {
        drawText(
          filingDate,
          fieldCoordinates.dateOfFiling.x,
          fieldCoordinates.dateOfFiling.y
        );
      }
    } else {
      console.warn("dateOfFiling coordinates not defined in fieldCoordinates");
    }
    // Vacation location handling
    // Vacation location handling - ENHANCED DEBUG
    if (leaveTypeLower.includes("vacation")) {
      console.log("=== VACATION DEBUG ===");
      console.log("Full leaveData:", JSON.stringify(leaveData, null, 2));

      const vacationLocationType =
        leaveData.vacationLocationType?.toLowerCase() ||
        leaveData.vacation_location_type?.toLowerCase() ||
        "philippines";

      // Extract location from the "Philippines: CEBU" format
      let locationText = "";
      if (leaveData.location) {
        // If location contains "Philippines: ", extract just the location part
        if (leaveData.location.includes(": ")) {
          locationText =
            leaveData.location.split(": ")[1] || leaveData.location;
        } else {
          locationText = leaveData.location;
        }
      }

      console.log("Extracted location text:", locationText);

      if (vacationLocationType === "abroad") {
        // Check mark for ABROAD checkbox
        console.log(
          "Drawing ABROAD checkbox at",
          vacationLocationCoordinates.abroad
        );
        drawText(
          "X",
          vacationLocationCoordinates.abroad.x,
          vacationLocationCoordinates.abroad.y,
          12
        );

        // Display location text WITH LINE SPACING
        if (locationText) {
          console.log("Drawing location for abroad:", locationText);
          const locationLines = splitTextIntoLines(locationText, 60);
          console.log("Location lines:", locationLines.length);

          locationLines.forEach((line, index) => {
            // MOVE DOWN for each line - FIX THIS!
            const lineY = fieldCoordinates.locationAbroad.y - index * 15;
            console.log(`Line ${index}: "${line}" at Y:${lineY}`);
            drawText(
              line,
              fieldCoordinates.locationAbroad.x,
              lineY, // THIS IS THE FIX!
              10
            );
          });
        }
      } else {
        // Check mark for WITHIN PHILIPPINES checkbox
        console.log(
          "Drawing PHILIPPINES checkbox at",
          vacationLocationCoordinates.philippines
        );
        drawText(
          "X",
          vacationLocationCoordinates.philippines.x,
          vacationLocationCoordinates.philippines.y,
          12
        );

        // Display location text WITH LINE SPACING
        if (locationText) {
          console.log("Drawing location for philippines:", locationText);
          const locationLines = splitTextIntoLines(locationText, 60);
          console.log("Location lines:", locationLines.length);

          locationLines.forEach((line, index) => {
            // MOVE DOWN for each line - FIX THIS!
            const lineY = fieldCoordinates.locationPhilippines.y - index * 15;
            console.log(`Line ${index}: "${line}" at Y:${lineY}`);
            drawText(
              line,
              fieldCoordinates.locationPhilippines.x,
              lineY, // THIS IS THE FIX!
              10
            );
          });
        }
      }
    }
    // Sick leave handling
    if (leaveTypeLower.includes("sick")) {
      const illnessType =
        leaveData.illnessType?.toLowerCase() ||
        leaveData.illness_type?.toLowerCase();

      if (illnessType === "in_hospital") {
        // Check mark for IN HOSPITAL
        drawText(
          "X",
          sickLeaveCheckboxCoordinates.in_hospital.x,
          sickLeaveCheckboxCoordinates.in_hospital.y,
          12
        );

        // Display illness details - FIXED: Use the correct coordinates
        if (leaveData.illness_details || leaveData.illnessDetails) {
          const illnessText =
            leaveData.illness_details || leaveData.illnessDetails;
          const illnessLines = splitTextIntoLines(illnessText, 60);
          illnessLines.forEach((line, index) => {
            // Use the CORRECT coordinates from fieldCoordinates
            drawText(
              line,
              fieldCoordinates.illnessDetailsInHospital.x, // Now this exists
              fieldCoordinates.illnessDetailsInHospital.y - index * 15
            );
          });
        }
      } else if (illnessType === "out_patient") {
        // Check mark for OUT PATIENT
        drawText(
          "X",
          sickLeaveCheckboxCoordinates.out_patient.x,
          sickLeaveCheckboxCoordinates.out_patient.y,
          12
        );

        // Display illness details - FIXED: Use the correct coordinates
        if (leaveData.illness_details || leaveData.illnessDetails) {
          const illnessText =
            leaveData.illness_details || leaveData.illnessDetails;
          const illnessLines = splitTextIntoLines(illnessText, 60);
          illnessLines.forEach((line, index) => {
            // Use the CORRECT coordinates from fieldCoordinates
            drawText(
              line,
              fieldCoordinates.illnessDetailsOutPatient.x, // Now this exists
              fieldCoordinates.illnessDetailsOutPatient.y - index * 15
            );
          });
        }
      }
    }

    // Fill leave balance information
    const balanceBefore =
      leaveData.balance_before || leaveData.balanceBefore || 0;
    const balanceAfter = leaveData.balance_after || leaveData.balanceAfter || 0;
    const numDays = leaveData.numDays || 0;

    // Add today's date for "As of" field
    const today = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    drawText(today, fieldCoordinates.asOfDate.x, fieldCoordinates.asOfDate.y);

    // Determine which column to use based on leave type
    if (leaveTypeLower.includes("vacation")) {
      // Fill Vacation Leave column
      drawNumber(
        balanceBefore,
        fieldCoordinates.vacationTotalEarned.x,
        fieldCoordinates.vacationTotalEarned.y
      );
      drawNumber(
        numDays,
        fieldCoordinates.vacationLessApplication.x,
        fieldCoordinates.vacationLessApplication.y
      );
      drawNumber(
        balanceAfter,
        fieldCoordinates.vacationBalance.x,
        fieldCoordinates.vacationBalance.y
      );

      // Fill Sick Leave column with zero or existing values
      const sickBalance = leaveData.sick_balance_before || 0;
      drawNumber(
        sickBalance,
        fieldCoordinates.sickTotalEarned.x,
        fieldCoordinates.sickTotalEarned.y
      );
      drawNumber(
        0,
        fieldCoordinates.sickLessApplication.x,
        fieldCoordinates.sickLessApplication.y
      );
      drawNumber(
        sickBalance,
        fieldCoordinates.sickBalance.x,
        fieldCoordinates.sickBalance.y
      );
    } else if (leaveTypeLower.includes("sick")) {
      // Fill Sick Leave column
      drawNumber(
        balanceBefore,
        fieldCoordinates.sickTotalEarned.x,
        fieldCoordinates.sickTotalEarned.y
      );
      drawNumber(
        numDays,
        fieldCoordinates.sickLessApplication.x,
        fieldCoordinates.sickLessApplication.y
      );
      drawNumber(
        balanceAfter,
        fieldCoordinates.sickBalance.x,
        fieldCoordinates.sickBalance.y
      );

      // Fill Vacation Leave column with zero or existing values
      const vacationBalance = leaveData.vacation_balance_before || 0;
      drawNumber(
        vacationBalance,
        fieldCoordinates.vacationTotalEarned.x,
        fieldCoordinates.vacationTotalEarned.y
      );
      drawNumber(
        0,
        fieldCoordinates.vacationLessApplication.x,
        fieldCoordinates.vacationLessApplication.y
      );
      drawNumber(
        vacationBalance,
        fieldCoordinates.vacationBalance.x,
        fieldCoordinates.vacationBalance.y
      );
    } else {
      // For other leave types, show balances as is
      drawNumber(
        leaveData.vacation_balance_before || 0,
        fieldCoordinates.vacationTotalEarned.x,
        fieldCoordinates.vacationTotalEarned.y
      );
      drawNumber(
        0,
        fieldCoordinates.vacationLessApplication.x,
        fieldCoordinates.vacationLessApplication.y
      );
      drawNumber(
        leaveData.vacation_balance_before || 0,
        fieldCoordinates.vacationBalance.x,
        fieldCoordinates.vacationBalance.y
      );

      drawNumber(
        leaveData.sick_balance_before || 0,
        fieldCoordinates.sickTotalEarned.x,
        fieldCoordinates.sickTotalEarned.y
      );
      drawNumber(
        0,
        fieldCoordinates.sickLessApplication.x,
        fieldCoordinates.sickLessApplication.y
      );
      drawNumber(
        leaveData.sick_balance_before || 0,
        fieldCoordinates.sickBalance.x,
        fieldCoordinates.sickBalance.y
      );
    }
    {
      /*
    // Add additional info for yearly records
    if (isYearly) {
      const year = leaveData.year || new Date().getFullYear();
      const recordDate =
        leaveData.recordDate || generationDate || new Date().toISOString();

      drawText(`Yearly Record - ${year}`, 50, 580, 10);
      drawText(
        `Record Generated: ${formatDateForPDF(recordDate)}`,
        50,
        565,
        10
      );

      // Leave summary
      drawText(`Leave Summary:`, 50, 545, 10);
      drawText(
        `Vacation Days: ${leaveData.totalVacationDays || 0}`,
        50,
        530,
        10
      );
      drawText(`Sick Days: ${leaveData.totalSickDays || 0}`, 50, 515, 10);
      drawText(
        `Emergency Days: ${leaveData.totalEmergencyDays || 0}`,
        50,
        500,
        10
      );
      drawText(`Total Days: ${leaveData.numDays || 0}`, 50, 485, 10);
    }

    // Add timestamp and processed by info at the bottom
    const timestamp = generationDate
      ? new Date(generationDate).toLocaleString()
      : new Date().toLocaleString();

    const processedBy =
      leaveData.approvedBy || adminUsername || "System Administrator";

    drawText(`Processed by: ${processedBy}`, 50, 50, 8);
    drawText(`Generated on: ${timestamp}`, 50, 35, 8);

    // Add document type indicator
    if (isYearly) {
      const year = leaveData.year || new Date().getFullYear();
      drawText(`Archived Yearly Record - ${year}`, 200, 30, 8);
    }
*/
    }
    const pdfBytesFilled = await pdfDoc.save();
    console.log("✅ PDF successfully filled with enhanced form filler");
    return pdfBytesFilled;
  } catch (error) {
    console.error("Error in fillLeaveFormEnhanced:", error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    throw error;
  }
};

/**
 * Simple fallback function for backward compatibility
 */
export const fillLeaveFormSimple = async (
  pdfBytes,
  leaveData,
  isYearly = false,
  generationDate = null
) => {
  // Use the enhanced function with default options
  return fillLeaveFormEnhanced(pdfBytes, leaveData, {
    isYearly,
    generationDate,
    adminUsername: leaveData.approvedBy || "System",
  });
};
