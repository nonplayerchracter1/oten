// utils/pdfClearanceFormFiller.js
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

/**
 * Enhanced PDF filling function for Clearance Forms
 * @param {ArrayBuffer} pdfBytes - Original PDF template bytes
 * @param {Object} clearanceData - Clearance request data
 * @param {Object} options - Additional options
 * @returns {Promise<Uint8Array>} - Filled PDF bytes
 */
export const fillClearanceFormEnhanced = async (
  pdfBytes,
  clearanceData,
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

    // Define coordinates for clearance form fields (Based on your provided template)
    const fieldCoordinates = {
      // Date (top right)
      date: { x: 580, y: 713 },

      // Personnel Information
      rankName: { x: 188, y: 603 },
      designation: { x: 190, y: 580 },
      station: { x: 210, y: 560 },
      clearanceType: { x: 169, y: 545 },
    };
    const officerNames = clearanceData.officerNames || {};

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

    // Helper function to format dates
    const formatDateForPDF = (dateString) => {
      if (!dateString || dateString === "") return "";
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

    // ========== FILLING THE FORM ==========

    // Date (top right)
    const documentDate = generationDate ? new Date(generationDate) : new Date();
    drawText(
      formatDateForPDF(documentDate),
      fieldCoordinates.date.x,
      fieldCoordinates.date.y,
      12
    );

    // Personnel Information
    const personnel = clearanceData.personnel || {};
    const fullName = `${personnel.first_name || ""} ${
      personnel.middle_name || ""
    } ${personnel.last_name || ""}`
      .replace(/\s+/g, " ")
      .trim();

    // Rank/Name
    drawText(
      `${personnel.rank || ""} ${fullName}`,
      fieldCoordinates.rankName.x,
      fieldCoordinates.rankName.y,
      12
    );

    // Designation
    drawText(
      clearanceData.designation || personnel.designation || "",
      fieldCoordinates.designation.x,
      fieldCoordinates.designation.y,
      12
    );

    // Unit Assignment
    drawText(
      clearanceData.station || personnel.station || "",
      fieldCoordinates.station.x,
      fieldCoordinates.station.y,
      12
    );

    // Purpose (Clearance Type)
    drawText(
      clearanceData.type || "Clearance",
      fieldCoordinates.clearanceType.x,
      fieldCoordinates.clearanceType.y,
      12
    );

    // Additional yearly record info
    if (isYearly) {
      const year = clearanceData.year || new Date().getFullYear();
      const recordDate =
        clearanceData.recordDate || formatDateForPDF(generationDate);

      drawText(`Yearly Archive - ${year}`, 50, 500, 10);
      drawText(`Record Generated: ${recordDate}`, 50, 485, 10);

      // Equipment summary (if available)
      if (clearanceData.totalEquipment) {
        drawText(`Equipment Summary:`, 50, 460, 10);
        drawText(`Total: ${clearanceData.totalEquipment || 0}`, 50, 445, 10);
        drawText(
          `Cleared: ${clearanceData.clearedEquipment || 0}`,
          50,
          430,
          10
        );
        drawText(
          `Pending: ${clearanceData.pendingEquipment || 0}`,
          50,
          415,
          10
        );
      }
    }

    // Station Level Officers (adjust coordinates based on your PDF template)
    drawText(officerNames.stationFinanceOfficer || "", 95, 446, 11);
    drawText(officerNames.stationSupplyAccountableOfficer || "", 550, 446, 11);
    drawText(officerNames.cityMunicipalFireMarshal || "", 260, 396, 11);

    // District/Provincial Level
    drawText(officerNames.districtProvincialFinanceOfficer || "", 540, 343, 11);
    drawText(
      officerNames.districtProvincialSupplyAccountableOfficer || "",
      90,
      343,
      11
    );
    drawText(officerNames.districtProvincialFireMarshal || "", 260, 295, 11);

    // Regional Level
    drawText(officerNames.regionalSupplyAccountableOfficer || "", 90, 238, 11);
    drawText(officerNames.regionalFinanceOfficer || "", 540, 238, 11);
    drawText(officerNames.regionalAccountant || "", 260, 190, 11);
    drawText(officerNames.regionalDirector || "", 260, 135, 11);

    // National Headquarters
    drawText(officerNames.chiefAccountantNHQ || "", 326, 83, 11);
    drawText(officerNames.chiefFinanceServiceNHQ || "", 543, 83, 11);
    drawText(officerNames.chiefSupplyAccountableServiceNHQ || "", 95, 83, 11);
    // Add generated info at bottom




    const pdfBytesFilled = await pdfDoc.save();
    console.log("✅ Clearance PDF successfully filled");
    return pdfBytesFilled;
  } catch (error) {
    console.error("Error in fillClearanceFormEnhanced:", error);
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
export const fillClearanceFormSimple = async (
  pdfBytes,
  clearanceData,
  isYearly = false,
  generationDate = null
) => {
  return fillClearanceFormEnhanced(pdfBytes, clearanceData, {
    isYearly,
    generationDate,
    adminUsername: clearanceData.approvedBy || "System",
  });
};
