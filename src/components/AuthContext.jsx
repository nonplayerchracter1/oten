import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { useNavigate } from "react-router-dom";

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    console.log("🚀 AuthContext - Initializing auth...");
    checkSession();
  }, []);

  const checkSession = () => {
    console.log("🔍 checkSession called");
    try {
      setLoading(true);

      // Check for ANY user session
      const adminUser = localStorage.getItem("adminUser");
      const adminSessionExpiry = localStorage.getItem("adminSessionExpiry");
      const personnelUser = localStorage.getItem("personnelUser");
      const personnelSessionExpiry = localStorage.getItem(
        "personnelSessionExpiry"
      );
      const recruitmentUser = localStorage.getItem("recruitmentUser");
      const recruitmentSessionExpiry = localStorage.getItem(
        "recruitmentSessionExpiry"
      );

      console.log("📦 localStorage contents:");
      console.log("- adminUser:", !!adminUser);
      console.log("- personnelUser:", !!personnelUser);
      console.log("- recruitmentUser:", !!recruitmentUser);

      let foundUser = null;
      let userType = null;
      let latestExpiry = 0;

      // Check admin session
      if (adminUser && adminSessionExpiry) {
        const expiryTime = parseInt(adminSessionExpiry);
        console.log("👤 Found adminUser in storage, expiry:", expiryTime);

        if (Date.now() < expiryTime) {
          try {
            const userData = JSON.parse(adminUser);
            console.log("✅ Valid admin session for:", userData.username);

            if (expiryTime > latestExpiry) {
              foundUser = userData;
              userType = "admin";
              latestExpiry = expiryTime;
            }
          } catch (parseError) {
            console.error("❌ Failed to parse adminUser JSON:", parseError);
          }
        } else {
          console.log("⏰ Admin session expired");
          localStorage.removeItem("adminUser");
          localStorage.removeItem("adminSessionExpiry");
        }
      }

      // Check personnel session
      if (personnelUser && personnelSessionExpiry) {
        const expiryTime = parseInt(personnelSessionExpiry);
        console.log("👤 Found personnelUser in storage, expiry:", expiryTime);

        if (Date.now() < expiryTime) {
          try {
            const userData = JSON.parse(personnelUser);
            console.log("✅ Valid personnel session for:", userData.username);

            if (expiryTime > latestExpiry) {
              foundUser = userData;
              userType = "personnel";
              latestExpiry = expiryTime;
            }
          } catch (parseError) {
            console.error("❌ Failed to parse personnelUser JSON:", parseError);
          }
        } else {
          console.log("⏰ Personnel session expired");
          localStorage.removeItem("personnelUser");
          localStorage.removeItem("personnelSessionExpiry");
        }
      }

      // Check recruitment applicant session
      if (recruitmentUser && recruitmentSessionExpiry) {
        const expiryTime = parseInt(recruitmentSessionExpiry);
        console.log("👤 Found recruitmentUser in storage, expiry:", expiryTime);

        if (Date.now() < expiryTime) {
          try {
            const userData = JSON.parse(recruitmentUser);
            console.log("✅ Valid recruitment session for:", userData.username);

            if (expiryTime > latestExpiry) {
              foundUser = userData;
              userType = "recruitment";
              latestExpiry = expiryTime;
            }
          } catch (parseError) {
            console.error(
              "❌ Failed to parse recruitmentUser JSON:",
              parseError
            );
          }
        } else {
          console.log("⏰ Recruitment session expired");
          localStorage.removeItem("recruitmentUser");
          localStorage.removeItem("recruitmentSessionExpiry");
        }
      }

      if (foundUser) {
        console.log(
          "🎯 Setting user state:",
          foundUser.username,
          "type:",
          userType
        );
        setUser(foundUser);
      } else {
        console.log("❌ No valid session found");
        setUser(null);
      }
    } catch (error) {
      console.error("💥 Session check error:", error);
      setUser(null);
      // Clear all auth storage on error
      localStorage.removeItem("adminUser");
      localStorage.removeItem("adminSessionExpiry");
      localStorage.removeItem("personnelUser");
      localStorage.removeItem("personnelSessionExpiry");
      localStorage.removeItem("recruitmentUser");
      localStorage.removeItem("recruitmentSessionExpiry");
    } finally {
      console.log("🏁 checkSession completed, setting loading to false");
      setLoading(false);
    }
  };

  // Unified login function that checks all user types
  const login = async (username, password) => {
    try {
      setLoading(true);
      console.log("🔐 Login attempt for:", username);

      // Clear all previous sessions when logging in fresh
      localStorage.removeItem("adminUser");
      localStorage.removeItem("adminSessionExpiry");
      localStorage.removeItem("personnelUser");
      localStorage.removeItem("personnelSessionExpiry");
      localStorage.removeItem("recruitmentUser");
      localStorage.removeItem("recruitmentSessionExpiry");

      // Check admin_users first
      const { data: adminUser, error: adminError } = await supabase
        .from("admin_users")
        .select("*")
        .eq("username", username)
        .eq("is_active", true)
        .maybeSingle();

      if (!adminError && adminUser && adminUser.password === password) {
        console.log("✅ Admin user found");
        return handleAdminLogin(adminUser);
      }

      // Check personnel table
      const { data: personnel, error: personnelError } = await supabase
        .from("personnel")
        .select("*")
        .eq("username", username)
        .eq("is_active", true)
        .maybeSingle();

      if (!personnelError && personnel && personnel.password === password) {
        console.log("✅ Personnel user found");
        return handlePersonnelLogin(personnel);
      }

      // Check recruitment_personnel table for applicants
      const { data: applicant, error: applicantError } = await supabase
        .from("recruitment_personnel")
        .select("*")
        .eq("username", username)
        .maybeSingle();

      if (!applicantError && applicant && applicant.password === password) {
        console.log("✅ Recruitment applicant found");

        // Check if applicant has been hired (moved to personnel table)
        if (applicant.status === "Hired" || applicant.stage === "Hired") {
          return {
            success: false,
            message:
              "You have been hired. Please contact HR for your new login credentials.",
          };
        }

        // Check if applicant is still active in the recruitment process
        if (applicant.status === "Rejected" || applicant.stage === "Rejected") {
          return {
            success: false,
            message:
              "Your application has been rejected. Please contact HR for more information.",
          };
        }

        return handleRecruitmentLogin(applicant);
      }

      console.error("❌ No user found with matching credentials");
      return { success: false, message: "Invalid username or password" };
    } catch (error) {
      console.error("💥 Login error:", error);
      return { success: false, message: "Login failed. Please try again." };
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = async (adminUser) => {
    // Update last login
    await supabase
      .from("admin_users")
      .update({ last_login: new Date().toISOString() })
      .eq("id", adminUser.id);

    // Create user session
    const userData = {
      id: adminUser.id,
      username: adminUser.username,
      email: adminUser.email,
      role: adminUser.role,
      user_type: "admin",
      isAdmin: adminUser.role === "admin",
      isInspector: adminUser.role === "inspector",
      personnel_id: adminUser.personnel_id,
      created_at: adminUser.created_at,
      last_login: new Date().toISOString(),
    };

    // Store session (24 hours)
    const sessionDuration = 24 * 60 * 60 * 1000;
    const sessionExpiry = Date.now() + sessionDuration;

    localStorage.setItem("adminUser", JSON.stringify(userData));
    localStorage.setItem("adminSessionExpiry", sessionExpiry.toString());

    setUser(userData);
    console.log("✅ Admin login successful:", userData.username);

    return { success: true, user: userData };
  };

  const handlePersonnelLogin = async (personnel) => {
    // Update last login
    await supabase
      .from("personnel")
      .update({ last_login: new Date().toISOString() })
      .eq("id", personnel.id);

    // Determine role
    let role = "employee";
    let isAdmin = false;

    if (personnel.is_admin) {
      role = personnel.admin_role || "admin";
      isAdmin = true;
    }

    // Create user session
    const userData = {
      id: personnel.id,
      username: personnel.username,
      email: personnel.email,
      badge_number: personnel.badge_number,
      first_name: personnel.first_name,
      last_name: personnel.last_name,
      full_name: `${personnel.first_name} ${personnel.last_name}`,
      rank: personnel.rank,
      designation: personnel.designation,
      station: personnel.station,
      photo_url: personnel.photo_url,
      role: role,
      user_type: "personnel",
      isAdmin: isAdmin,
      admin_role: personnel.admin_role || "none",
      admin_level: personnel.admin_level || "none",
      can_manage_leaves: personnel.can_manage_leaves || false,
      can_manage_personnel: personnel.can_manage_personnel || false,
      can_approve_requests: personnel.can_approve_requests || false,
      can_approve_leaves: personnel.can_approve_leaves || false,
      permissions: personnel.permissions || [],
      created_at: personnel.created_at,
      last_login: new Date().toISOString(),
    };

    // Store session (24 hours)
    const sessionDuration = 24 * 60 * 60 * 1000;
    const sessionExpiry = Date.now() + sessionDuration;

    localStorage.setItem("personnelUser", JSON.stringify(userData));
    localStorage.setItem("personnelSessionExpiry", sessionExpiry.toString());

    setUser(userData);
    console.log("✅ Personnel login successful:", userData.username);

    return { success: true, user: userData };
  };

  const handleRecruitmentLogin = async (applicant) => {
    try {
      // Update last login (add this field to your recruitment_personnel table)
      const { error: updateError } = await supabase
        .from("recruitment_personnel")
        .update({ last_login: new Date().toISOString() })
        .eq("id", applicant.id);

      if (updateError) {
        console.log(
          "Note: last_login field might not exist in recruitment_personnel table",
          updateError.message
        );
      }
    } catch (error) {
      console.log("Error updating last login (non-critical):", error.message);
    }

    // Create user session for applicant
    const userData = {
      id: applicant.id,
      username: applicant.username,
      full_name: applicant.full_name || applicant.candidate,
      candidate: applicant.candidate,
      position: applicant.position,
      application_date: applicant.application_date,
      interview_date: applicant.interview_date,
      stage: applicant.stage,
      status: applicant.status,
      photo_url: applicant.photo_url,
      resume_url: applicant.resume_url,
      schedule_date: applicant.schedule_date,
      schedule_location: applicant.schedule_location,
      schedule_notes: applicant.schedule_notes,
      date_of_birth: applicant.date_of_birth,
      gender: applicant.gender,
      civil_status: applicant.civil_status,
      contact_number: applicant.contact_number,
      emergency_contact: applicant.emergency_contact,
      emergency_contact_number: applicant.emergency_contact_number,
      address: applicant.address,
      city: applicant.city,
      province: applicant.province,
      zip_code: applicant.zip_code,
      educational_background: applicant.educational_background,
      hr_contact_person: applicant.hr_contact_person,
      hr_contact_email: applicant.hr_contact_email,
      hr_contact_phone: applicant.hr_contact_phone,
      hr_office_hours: applicant.hr_office_hours,
      role: "applicant",
      user_type: "recruitment",
      isAdmin: false,
      isApplicant: true,
      created_at: applicant.created_at,
      last_login: new Date().toISOString(),
    };

    // Store session (24 hours)
    const sessionDuration = 24 * 60 * 60 * 1000;
    const sessionExpiry = Date.now() + sessionDuration;

    localStorage.setItem("recruitmentUser", JSON.stringify(userData));
    localStorage.setItem("recruitmentSessionExpiry", sessionExpiry.toString());

    setUser(userData);
    console.log(
      "✅ Recruitment applicant login successful:",
      userData.username
    );

    return { success: true, user: userData };
  };
  // Special login for recruitment personnel (HR/Recruitment staff)
  const loginAsRecruitmentStaff = async (username, password) => {
    try {
      setLoading(true);

      // Query personnel table for recruitment staff
      const { data: recruitmentStaff, error } = await supabase
        .from("personnel")
        .select("*")
        .eq("username", username)
        .eq("is_active", true)
        .eq("role", "recruitment") // Assuming you add 'recruitment' role to personnel table
        .maybeSingle();

      if (error || !recruitmentStaff) {
        return {
          success: false,
          message: "Invalid recruitment staff credentials",
        };
      }

      // Verify password
      if (recruitmentStaff.password !== password) {
        return { success: false, message: "Invalid username or password" };
      }

      // Update last login
      await supabase
        .from("personnel")
        .update({ last_login: new Date().toISOString() })
        .eq("id", recruitmentStaff.id);

      // Create user session for recruitment staff
      const userData = {
        id: recruitmentStaff.id,
        username: recruitmentStaff.username,
        email: recruitmentStaff.email,
        badge_number: recruitmentStaff.badge_number,
        first_name: recruitmentStaff.first_name,
        last_name: recruitmentStaff.last_name,
        full_name: `${recruitmentStaff.first_name} ${recruitmentStaff.last_name}`,
        rank: recruitmentStaff.rank,
        designation: recruitmentStaff.designation,
        station: recruitmentStaff.station,
        photo_url: recruitmentStaff.photo_url,
        role: "recruitment",
        user_type: "personnel",
        isAdmin: false,
        admin_role: recruitmentStaff.admin_role || "none",
        admin_level: recruitmentStaff.admin_level || "none",
        can_manage_leaves: recruitmentStaff.can_manage_leaves || false,
        can_manage_personnel: recruitmentStaff.can_manage_personnel || false,
        can_approve_requests: recruitmentStaff.can_approve_requests || false,
        can_approve_leaves: recruitmentStaff.can_approve_leaves || false,
        permissions: recruitmentStaff.permissions || [],
        created_at: recruitmentStaff.created_at,
        last_login: new Date().toISOString(),
      };

      // Store session (24 hours)
      const sessionDuration = 24 * 60 * 60 * 1000;
      const sessionExpiry = Date.now() + sessionDuration;

      localStorage.setItem("personnelUser", JSON.stringify(userData));
      localStorage.setItem("personnelSessionExpiry", sessionExpiry.toString());

      setUser(userData);
      console.log("✅ Recruitment staff login successful:", userData.username);

      return { success: true, user: userData };
    } catch (error) {
      console.error("💥 Recruitment staff login error:", error);
      return { success: false, message: "Login failed. Please try again." };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    console.log("🚪 Logging out...");
    localStorage.removeItem("adminUser");
    localStorage.removeItem("adminSessionExpiry");
    localStorage.removeItem("personnelUser");
    localStorage.removeItem("personnelSessionExpiry");
    localStorage.removeItem("recruitmentUser");
    localStorage.removeItem("recruitmentSessionExpiry");
    setUser(null);
    navigate("/");
  };

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    loginAsRecruitmentStaff,
    logout,
    hasRole: (requiredRole) => user?.role === requiredRole,
    isAdmin: user?.isAdmin || false,
    isPersonnel: user?.user_type === "personnel",
    isApplicant:
      user?.user_type === "recruitment" && user?.role === "applicant",
    isRecruitmentStaff: user?.role === "recruitment",
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
