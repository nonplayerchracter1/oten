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
      const personnelSessionExpiry = localStorage.getItem("personnelSessionExpiry");

      console.log("📦 localStorage contents:");
      console.log("- adminUser:", !!adminUser);
      console.log("- personnelUser:", !!personnelUser);
      console.log("- adminSessionExpiry:", adminSessionExpiry);
      console.log("- personnelSessionExpiry:", personnelSessionExpiry);

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
            
            // Track as potential user if it's the latest
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
            
            // Use personnel session if it's newer than admin session
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

      if (foundUser) {
        console.log("🎯 Setting user state:", foundUser.username, "type:", userType);
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
    } finally {
      console.log("🏁 checkSession completed, setting loading to false");
      setLoading(false);
    }
  };

  // Login function for both admin and personnel
  const login = async (username, password, userType = "admin") => {
    try {
      setLoading(true);
      console.log("🔐 Login attempt for:", username, "type:", userType);

      // IMPORTANT: Clear opposite session type when logging in
      if (userType === "admin") {
        localStorage.removeItem("personnelUser");
        localStorage.removeItem("personnelSessionExpiry");
      } else if (userType === "personnel") {
        localStorage.removeItem("adminUser");
        localStorage.removeItem("adminSessionExpiry");
      }

      if (userType === "admin") {
        // Query the admin_users table
        const { data: adminUser, error } = await supabase
          .from("admin_users")
          .select("*")
          .eq("username", username)
          .eq("is_active", true)
          .maybeSingle();

        if (error) {
          console.error("Admin query error:", error);
          return { success: false, message: "System error. Please try again." };
        }

        if (!adminUser) {
          console.error("Admin user not found");
          return { success: false, message: "Invalid username or password" };
        }

        // Plain text password comparison
        if (adminUser.password !== password) {
          console.error("Password mismatch");
          return { success: false, message: "Invalid username or password" };
        }

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

        console.log("💾 Storing admin session in localStorage");
        localStorage.setItem("adminUser", JSON.stringify(userData));
        localStorage.setItem("adminSessionExpiry", sessionExpiry.toString());

        setUser(userData);
        console.log("✅ Admin login successful:", userData.username);

        return { success: true, user: userData };
      } else if (userType === "personnel") {
        // Query the personnel table
        const { data: personnel, error } = await supabase
          .from("personnel")
          .select("*")
          .eq("username", username)
          .eq("is_active", true)
          .maybeSingle();

        if (error) {
          console.error("Personnel query error:", error);
          return { success: false, message: "System error. Please try again." };
        }

        if (!personnel) {
          console.error("Personnel not found");
          return { success: false, message: "Invalid username or password" };
        }

        // Plain text password comparison
        if (personnel.password !== password) {
          console.error("Password mismatch");
          return { success: false, message: "Invalid username or password" };
        }

        // Update last login
        await supabase
          .from("personnel")
          .update({ last_login: new Date().toISOString() })
          .eq("id", personnel.id);

        // Determine role based on admin status
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

        console.log("💾 Storing personnel session in localStorage");
        localStorage.setItem("personnelUser", JSON.stringify(userData));
        localStorage.setItem("personnelSessionExpiry", sessionExpiry.toString());

        setUser(userData);
        console.log("✅ Personnel login successful:", userData.username);

        return { success: true, user: userData };
      }

      return { success: false, message: "Invalid user type" };
    } catch (error) {
      console.error("💥 Login error:", error);
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
    setUser(null);
    navigate("/");
  };

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    logout,
    hasRole: (requiredRole) => user?.role === requiredRole,
    isAdmin: user?.isAdmin || false,
    isPersonnel: user?.user_type === "personnel",
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};