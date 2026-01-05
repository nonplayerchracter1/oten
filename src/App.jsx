import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider } from "./components/AuthContext";
import { SidebarProvider } from "./components/SidebarContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./components/Login";

// Admin Components
import AdminDashboard from "./components/admin/JSX/AdminDashboard";
import InventoryControl from "./components/admin/JSX/InventoryControl";
import LeaveManagement from "./components/admin/JSX/LeaveManagement";
import ClearanceSystem from "./components/ClearanceSystemFolder/ClearanceSystem"
import PersonnelRegister from "./components/admin/JSX/PersonnelRegister";
import PersonnelProfile from "./components/admin/JSX/PersonnelProfile";
import LeaveRecords from "./components/admin/JSX/LeaveRecords";
import ClearanceRecords from "./components/admin/JSX/ClearanceRecords";
import MedicalRecords from "./components/admin/JSX/MedicalRecords";
import AwardsCommendations from "./components/admin/JSX/AwardsCommendations";
import Promotion from "./components/admin/JSX/Promotion";
import RecruitmentPersonnel from "./components/admin/JSX/RecruitmentPersonnel";
import Trainings from "./components/admin/JSX/Trainings";
import Placement from "./components/admin/JSX/Placement";
import History from "./components/admin/JSX/History";
import PersonnelRecentActivity from "./components/admin/JSX/PersonnelRecentActivity";

// Employee Components
import EmployeeDashboard from "./components/employee/JSX/EmployeeDashboard";
import EmployeeLeaveDashboard from "./components/employee/JSX/EmployeeLeaveDashboard";
import EmployeeLeaveRequest from "./components/employee/JSX/EmployeeLeaveRequest";

// Inspector Components
import InspectorDashboard from "./components/inspector/JSX/InspectorDashboard";
import InspectorInventoryControl from "./components/inspector/JSX/InspectorInventoryControl";
import InspectorEquipmentInspection from "./components/inspector/JSX/InspectorEquipmentInspection";
import InspectorInspectionReport from "./components/inspector/JSX/InspectorInspectionReport";
import InspectionHistory from "./components/inspector/JSX/InspectionHistory";

// Recruitment Profile Component
import RecruitmentProfile from "./components/recruiment_applicant/JSX/RecruitmentProfile";
import RecruitmentDashboard from "./components/recruiment_applicant/JSX/RecruitmentDashboard";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { HeadProvider } from "react-head";

function App() {
  return (
    <HeadProvider>
      <Router>
        <AuthProvider>
          <SidebarProvider>
            <Routes>
              <Route path="/" element={<Login />} />

              {/* Admin-only routes */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/inventoryControl"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <InventoryControl />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/leaveManagement"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <LeaveManagement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/clearanceSystem"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <ClearanceSystem />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/personnelRegister"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <PersonnelRegister />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/personnelProfile"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <PersonnelProfile />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/leaveRecords"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <LeaveRecords />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/clearanceRecords"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <ClearanceRecords />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/medicalRecords"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <MedicalRecords />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/awardsCommendations"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <AwardsCommendations />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/promotion"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <Promotion />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/recruitmentPersonnel"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <RecruitmentPersonnel />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/trainings"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <Trainings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/placement"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <Placement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/history"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <History />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/personnelRecentActivity"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <PersonnelRecentActivity />
                  </ProtectedRoute>
                }
              />

              {/* Recruitment Personnel routes */}
              <Route
                path="/recruitment/dashboard"
                element={
                  <ProtectedRoute requiredRole="applicant">
                    <RecruitmentDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/recruitment/profile"
                element={
                  <ProtectedRoute requiredRole="applicant">
                    <RecruitmentProfile />
                  </ProtectedRoute>
                }
              />

              {/* Inspector routes */}
              <Route
                path="/inspectorDashboard"
                element={
                  <ProtectedRoute requiredRole="inspector">
                    <InspectorDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/inspector/inventory"
                element={
                  <ProtectedRoute requiredRole="inspector">
                    <InspectorInventoryControl />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/inspector/equipment"
                element={
                  <ProtectedRoute requiredRole="inspector">
                    <InspectorEquipmentInspection />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/inspector/report"
                element={
                  <ProtectedRoute requiredRole="inspector">
                    <InspectorInspectionReport />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/inspector/history"
                element={
                  <ProtectedRoute requiredRole="inspector">
                    <InspectionHistory />
                  </ProtectedRoute>
                }
              />

              {/* Employee routes - Fixed to use new structure */}
              <Route
                path="/employee"
                element={
                  <ProtectedRoute requiredRole="employee">
                    <Navigate to="/employee/dashboard" replace />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/employee/dashboard"
                element={
                  <ProtectedRoute requiredRole="employee">
                    <EmployeeDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/employee/leave-dashboard"
                element={
                  <ProtectedRoute requiredRole="employee">
                    <EmployeeLeaveDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/employee/leave-request"
                element={
                  <ProtectedRoute requiredRole="employee">
                    <EmployeeLeaveRequest />
                  </ProtectedRoute>
                }
              />

              {/* Legacy routes - Redirect to new ones */}

              {/* Fallback route */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <ToastContainer />
          </SidebarProvider>
        </AuthProvider>
      </Router>
    </HeadProvider>
  );
}

export default App;
