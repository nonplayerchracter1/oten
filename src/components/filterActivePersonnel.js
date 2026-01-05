// src/utils/filterActivePersonnel.js

/**
 * Filter out retired and resigned personnel
 * @param {Array} personnelList - Array of personnel records
 * @returns {Array} - Filtered array with only active personnel
 */
export const filterActivePersonnel = (personnelList) => {
  if (!Array.isArray(personnelList)) return [];

  return personnelList.filter((person) => {
    // Check if personnel is active
    if (person.is_active === false) return false;

    // Check status field
    if (person.status === "Retired" || person.status === "Resigned") {
      return false;
    }

    // Check separation type
    if (
      person.separation_type === "Retirement" ||
      person.separation_type === "Resignation"
    ) {
      return false;
    }

    // Check if there's a separation date in the past
    if (person.separation_date) {
      const separationDate = new Date(person.separation_date);
      const today = new Date();
      if (separationDate <= today) return false;
    }

    // Check retirement date
    if (person.retirement_date) {
      const retirementDate = new Date(person.retirement_date);
      const today = new Date();
      if (retirementDate <= today) return false;
    }

    // If all checks pass, personnel is active
    return true;
  });
};

/**
 * Get only active personnel for assignment (with additional filtering)
 * @param {Array} personnelList - Array of personnel records
 * @returns {Array} - Active personnel suitable for assignment
 */
export const getAssignablePersonnel = (personnelList) => {
  const activePersonnel = filterActivePersonnel(personnelList);

  // Sort alphabetically by last name
  return activePersonnel.sort((a, b) => {
    const nameA = `${a.last_name || ""} ${a.first_name || ""}`.toLowerCase();
    const nameB = `${b.last_name || ""} ${b.first_name || ""}`.toLowerCase();
    return nameA.localeCompare(nameB);
  });
};

/**
 * Check if a specific personnel is active
 * @param {Object} person - Personnel record
 * @returns {boolean} - True if active, false if retired/resigned
 */
export const isPersonnelActive = (person) => {
  if (!person) return false;

  if (person.is_active === false) return false;

  if (person.status === "Retired" || person.status === "Resigned") {
    return false;
  }

  if (
    person.separation_type === "Retirement" ||
    person.separation_type === "Resignation"
  ) {
    return false;
  }

  if (person.separation_date) {
    const separationDate = new Date(person.separation_date);
    const today = new Date();
    if (separationDate <= today) return false;
  }

  if (person.retirement_date) {
    const retirementDate = new Date(person.retirement_date);
    const today = new Date();
    if (retirementDate <= today) return false;
  }

  return true;
};
