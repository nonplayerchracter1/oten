// InspectorDashboard.jsx - FIXED VERSION
import React, { useState, useEffect } from "react";
import styles from "../styles/InspectorDashboard.module.css";
import { Title, Meta } from "react-head";
import InspectorSidebar from "../../InspectorSidebar";
import Hamburger from "../../Hamburger";
import { useSidebar } from "../../SidebarContext";
import { supabase } from "../../../lib/supabaseClient.js";
import {
  Calendar,
  Wrench,
  FileCheck,
  AlertCircle,
  Package,
  CheckCircle,
  Clock,
  Users,
  UserX,
  TrendingUp,
  BarChart3,
  Shield,
  AlertTriangle,
  CheckSquare,
  RefreshCw,
  Eye,
  ArrowUpRight,
  DollarSign,
  FileText,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const InspectorDashboard = () => {
  const { isSidebarCollapsed } = useSidebar();
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState({
    // Inspection Stats
    inspectionsDueToday: 0,
    inspectionsThisWeek: 0,
    pendingInspections: 0,
    completedInspections: 0,

    // Equipment Stats
    totalEquipment: 0,
    operationalEquipment: 0,
    maintenanceNeeded: 0,
    unassignedEquipment: 0,

    // Clearance Stats
    pendingClearances: 0,
    clearanceThisWeek: 0,
    totalAccountability: 0,
    settledAccountability: 0,

    // Personnel Stats
    personnelWithEquipment: 0,
    personnelDueClearance: 0,
    overdueInspections: 0,

    // Financial Stats
    pendingSettlements: 0,
    totalOutstanding: 0,
  });

  const [loading, setLoading] = useState(true);
  const [recentActivities, setRecentActivities] = useState([]);
  const [upcomingInspections, setUpcomingInspections] = useState([]);
  const [urgentItems, setUrgentItems] = useState([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [currentDate] = useState(new Date());

  const loadDashboardSummary = async () => {
    setStatsLoading(true);
    try {
      console.log("Loading comprehensive dashboard data...");

      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];
      const weekAgo = new Date(today);
      weekAgo.setDate(today.getDate() - 7);
      const weekAgoStr = weekAgo.toISOString().split("T")[0];
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);
      const nextWeekStr = nextWeek.toISOString().split("T")[0];

      // 1. INSPECTION STATS
      // Inspections due today
      const { data: inspectionsToday, error: inspectionsTodayError } =
        await supabase
          .from("inspections")
          .select("*", { count: "exact" })
          .eq("schedule_inspection_date", todayStr)
          .eq("status", "PENDING");

      // Inspections this week
      const { data: inspectionsWeek, error: inspectionsWeekError } =
        await supabase
          .from("inspections")
          .select("*", { count: "exact" })
          .gte("schedule_inspection_date", todayStr)
          .lte("schedule_inspection_date", nextWeekStr)
          .eq("status", "PENDING");

      // Pending inspections
      const { data: pendingInspections, error: pendingInspectionsError } =
        await supabase
          .from("inspections")
          .select("*", { count: "exact" })
          .eq("status", "PENDING");

      // Completed inspections (last 7 days)
      const { data: completedInspections, error: completedInspectionsError } =
        await supabase
          .from("inspections")
          .select("*", { count: "exact" })
          .eq("status", "COMPLETED")
          .gte("inspection_date", weekAgoStr);

      // 2. EQUIPMENT STATS
      // Total equipment
      const { count: totalEquipment, error: totalEquipmentError } =
        await supabase
          .from("inventory")
          .select("*", { count: "exact", head: true })
          .eq("is_active", true);

      // Operational equipment
      const { count: operationalEquipment, error: operationalEquipmentError } =
        await supabase
          .from("inventory")
          .select("*", { count: "exact", head: true })
          .eq("status", "Good")
          .eq("is_active", true);

      // Equipment needing maintenance
      const { count: maintenanceNeeded, error: maintenanceError } =
        await supabase
          .from("inventory")
          .select("*", { count: "exact", head: true })
          .or(
            "status.eq.Needs Maintenance,status.eq.Under Repair,status.eq.Damaged"
          )
          .eq("is_active", true);

      // Unassigned equipment
      const { count: unassignedEquipment, error: unassignedError } =
        await supabase
          .from("inventory")
          .select("*", { count: "exact", head: true })
          .eq("assigned_to", "Unassigned")
          .eq("is_active", true);

      // 3. CLEARANCE STATS
      // Pending clearance requests (Resignation, Retirement, Equipment Completion only)
      const { count: pendingClearances, error: clearancesError } =
        await supabase
          .from("clearance_requests")
          .select("*", { count: "exact", head: true })
          .eq("status", "Pending")
          .in("type", ["Resignation", "Retirement", "Equipment Completion"]);

      // Clearance requests this week
      const { count: clearanceThisWeek, error: clearanceWeekError } =
        await supabase
          .from("clearance_requests")
          .select("*", { count: "exact", head: true })
          .in("type", ["Resignation", "Retirement", "Equipment Completion"])
          .gte("created_at", weekAgoStr);

      // 4. ACCOUNTABILITY STATS
      // Total accountability amount
      const { data: accountabilityData, error: accountabilityError } =
        await supabase
          .from("accountability_records")
          .select("amount_due, is_settled")
          .eq("is_settled", false);

      const totalAccountability =
        accountabilityData?.reduce(
          (sum, record) => sum + (parseFloat(record.amount_due) || 0),
          0
        ) || 0;

      // Settled accountability
      const { data: settledData, error: settledError } = await supabase
        .from("accountability_records")
        .select("amount_due")
        .eq("is_settled", true)
        .gte("settlement_date", weekAgoStr);

      const settledAccountability =
        settledData?.reduce(
          (sum, record) => sum + (parseFloat(record.amount_due) || 0),
          0
        ) || 0;

      // Pending settlements
      const { count: pendingSettlements, error: settlementsError } =
        await supabase
          .from("accountability_records")
          .select("*", { count: "exact", head: true })
          .eq("is_settled", false);

      // 5. PERSONNEL STATS
      // Personnel with equipment assigned
      const { data: personnelWithEq, error: personnelEqError } = await supabase
        .from("inventory")
        .select("assigned_personnel_id", { count: "exact" })
        .not("assigned_personnel_id", "is", null)
        .eq("is_active", true);

      const personnelWithEquipment = new Set(
        personnelWithEq
          ?.map((item) => item.assigned_personnel_id)
          .filter(Boolean)
      ).size;

      // 6. Load upcoming inspections for the next 3 days - FIXED QUERY
      const next3Days = new Date(today);
      next3Days.setDate(today.getDate() + 3);
      const next3DaysStr = next3Days.toISOString().split("T")[0];

      // First get inspections with basic data
      const { data: upcomingInspectionsData, error: upcomingError } =
        await supabase
          .from("inspections")
          .select("*")
          .gte("schedule_inspection_date", todayStr)
          .lte("schedule_inspection_date", next3DaysStr)
          .eq("status", "PENDING")
          .order("schedule_inspection_date", { ascending: true })
          .limit(5);

      if (upcomingInspectionsData && upcomingInspectionsData.length > 0) {
        // Get equipment details for these inspections
        const equipmentIds = upcomingInspectionsData
          .map((i) => i.equipment_id)
          .filter(Boolean);
        const { data: equipmentData, error: equipmentErr } = await supabase
          .from("inventory")
          .select("*")
          .in("id", equipmentIds);

        const equipmentMap = {};
        equipmentData?.forEach((item) => {
          equipmentMap[item.id] = item;
        });

        // Get assigned personnel details from inventory
        const assignedPersonnelIds = equipmentData
          ?.map((item) => item.assigned_personnel_id)
          .filter(Boolean);

        let personnelMap = {};
        if (assignedPersonnelIds && assignedPersonnelIds.length > 0) {
          const { data: personnelData, error: personnelErr } = await supabase
            .from("personnel")
            .select("*")
            .in("id", assignedPersonnelIds);

          personnelData?.forEach((person) => {
            personnelMap[person.id] = person;
          });
        }

        // Combine data
        const formattedUpcoming = upcomingInspectionsData.map((inspection) => {
          const equipment = equipmentMap[inspection.equipment_id];
          const assignedPersonnel = equipment?.assigned_personnel_id
            ? personnelMap[equipment.assigned_personnel_id]
            : null;

          return {
            ...inspection,
            equipment: {
              item_name: equipment?.item_name,
              item_code: equipment?.item_code,
            },
            assigned_personnel: assignedPersonnel
              ? {
                  first_name: assignedPersonnel.first_name,
                  last_name: assignedPersonnel.last_name,
                }
              : null,
          };
        });

        setUpcomingInspections(formattedUpcoming);
      } else {
        setUpcomingInspections([]);
      }

      // 7. Load urgent items (equipment needing immediate attention) - FIXED QUERY
      const { data: urgentData, error: urgentError } = await supabase
        .from("inventory")
        .select("*")
        .or("status.eq.Damaged,status.eq.Lost,status.eq.Needs Maintenance")
        .eq("is_active", true)
        .order("last_checked", { ascending: true })
        .limit(5);

      if (urgentData && urgentData.length > 0) {
        // Get personnel details for assigned equipment
        const assignedPersonnelIds = urgentData
          .map((item) => item.assigned_personnel_id)
          .filter(Boolean);

        let personnelMap = {};
        if (assignedPersonnelIds.length > 0) {
          const { data: personnelData, error: personnelErr } = await supabase
            .from("personnel")
            .select("*")
            .in("id", assignedPersonnelIds);

          personnelData?.forEach((person) => {
            personnelMap[person.id] = person;
          });
        }

        // Combine data
        const formattedUrgent = urgentData.map((item) => ({
          ...item,
          assigned_personnel: item.assigned_personnel_id
            ? personnelMap[item.assigned_personnel_id]
            : null,
        }));

        setUrgentItems(formattedUrgent);
      } else {
        setUrgentItems([]);
      }

      // 8. Load recent activities (combining inspections and clearances)
      const [recentInspectionsData, recentClearancesData] = await Promise.all([
        supabase
          .from("inspections")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("clearance_requests")
          .select("*")
          .in("type", ["Resignation", "Retirement", "Equipment Completion"])
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      // Get equipment names for inspections
      let equipmentMap = {};
      if (recentInspectionsData.data && recentInspectionsData.data.length > 0) {
        const equipmentIds = recentInspectionsData.data
          .map((i) => i.equipment_id)
          .filter(Boolean);
        const { data: equipmentData } = await supabase
          .from("inventory")
          .select("id, item_name")
          .in("id", equipmentIds);

        equipmentData?.forEach((item) => {
          equipmentMap[item.id] = item;
        });
      }

      // Get personnel names for clearances
      let personnelMap = {};
      if (recentClearancesData.data && recentClearancesData.data.length > 0) {
        const personnelIds = recentClearancesData.data
          .map((c) => c.personnel_id)
          .filter(Boolean);
        const { data: personnelData } = await supabase
          .from("personnel")
          .select("id, first_name, last_name")
          .in("id", personnelIds);

        personnelData?.forEach((person) => {
          personnelMap[person.id] = person;
        });
      }

      const activities = [];

      // Add recent inspections
      recentInspectionsData.data?.forEach((inspection) => {
        const equipment = equipmentMap[inspection.equipment_id];
        activities.push({
          id: inspection.id,
          type: "INSPECTION",
          action: inspection.status,
          details: `Inspection for ${equipment?.item_name || "equipment"}`,
          timestamp: inspection.inspection_date || inspection.created_at,
          icon: inspection.status === "COMPLETED" ? "✅" : "⏳",
          color:
            inspection.status === "COMPLETED"
              ? "#10b981"
              : inspection.status === "PENDING"
              ? "#f59e0b"
              : "#6b7280",
        });
      });

      // Add recent clearances
      recentClearancesData.data?.forEach((clearance) => {
        const personnel = personnelMap[clearance.personnel_id];
        activities.push({
          id: clearance.id,
          type: "CLEARANCE",
          action: clearance.status,
          details: `${clearance.type} - ${personnel?.first_name || ""} ${
            personnel?.last_name || ""
          }`,
          timestamp: clearance.created_at,
          icon: clearance.status === "Completed" ? "✅" : "📋",
          color:
            clearance.status === "Completed"
              ? "#10b981"
              : clearance.status === "Pending"
              ? "#f59e0b"
              : "#6b7280",
        });
      });

      // Sort by timestamp and take top 10
      activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setRecentActivities(activities.slice(0, 10));

      // Calculate personnel due for clearance (those with pending clearance requests)
      const { count: personnelDueClearance, error: dueClearanceError } =
        await supabase
          .from("clearance_requests")
          .select("personnel_id", { count: "exact" })
          .eq("status", "Pending")
          .in("type", ["Resignation", "Retirement", "Equipment Completion"]);

      // Calculate overdue inspections (missed schedule)
      const { count: overdueInspections, error: overdueError } = await supabase
        .from("inspections")
        .select("*", { count: "exact", head: true })
        .lt("schedule_inspection_date", todayStr)
        .eq("status", "PENDING");

      // Set all dashboard data
      setDashboardData({
        // Inspection Stats
        inspectionsDueToday: inspectionsToday?.length || 0,
        inspectionsThisWeek: inspectionsWeek?.length || 0,
        pendingInspections: pendingInspections?.length || 0,
        completedInspections: completedInspections?.length || 0,

        // Equipment Stats
        totalEquipment: totalEquipment || 0,
        operationalEquipment: operationalEquipment || 0,
        maintenanceNeeded: maintenanceNeeded || 0,
        unassignedEquipment: unassignedEquipment || 0,

        // Clearance Stats
        pendingClearances: pendingClearances || 0,
        clearanceThisWeek: clearanceThisWeek || 0,
        totalAccountability,
        settledAccountability,

        // Personnel Stats
        personnelWithEquipment,
        personnelDueClearance: personnelDueClearance || 0,
        overdueInspections: overdueInspections || 0,

        // Financial Stats
        pendingSettlements: pendingSettlements || 0,
        totalOutstanding: totalAccountability,
      });
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setLoading(false);
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardSummary();

    // Refresh data every 2 minutes
    const interval = setInterval(loadDashboardSummary, 120000);

    return () => clearInterval(interval);
  }, []);

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return "";
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (e) {
      return "";
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
    }).format(amount || 0);
  };

  const handleNavigate = (path, params = {}) => {
    let queryString = '';
    if (Object.keys(params).length > 0) {
      const queryParams = new URLSearchParams(params).toString();
      queryString = `?${queryParams}`;
    }
    navigate(`${path}${queryString}`);
  };

  const handleViewInspection = (id) => {
    navigate(`/inspectorEquipmentInspection?inspectionId=${id}`);
  };

  const handleViewEquipment = (id) => {
    navigate(`/inspectorInventoryControl?equipmentId=${id}`);
  };

  const handleViewClearance = (id) => {
    navigate(`/inspectorInspectionReport?clearanceId=${id}`);
  };

  if (loading) {
    return (
      <div className="AppInspector">
        <Title>Inspector Dashboard | BFP Villanueva</Title>
        <Meta name="robots" content="noindex, nofollow" />
        <InspectorSidebar />
        <Hamburger />
        <div
          className={`main-content ${isSidebarCollapsed ? "collapsed" : ""}`}
        >
          <div className={styles.loadingContainer}>
            <RefreshCw size={48} className={styles.spinningIcon} />
            <h2>Loading Inspector Dashboard...</h2>
            <p>Please wait while we load your dashboard data.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="AppInspector">
      <Title>Inspector Dashboard | BFP Villanueva</Title>
      <Meta name="robots" content="noindex, nofollow" />
      <InspectorSidebar />
      <Hamburger />
      <div className={`main-content ${isSidebarCollapsed ? "collapsed" : ""}`}>
        {/* Header */}
        <div className={styles.INSHeader}>
          <div className={styles.headerContent}>
            <h1>
              <Shield size={32} className={styles.headerIcon} />
              Inspector Dashboard
            </h1>
            <p className={styles.welcomeText}>
              Welcome back! Here's your equipment accountability overview for{" "}
              {currentDate.toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
          <div className={styles.headerActions}>
            <button
              className={`${styles.refreshBtn} ${
                statsLoading ? styles.loading : ""
              }`}
              onClick={loadDashboardSummary}
              disabled={statsLoading}
            >
              <RefreshCw
                size={16}
                className={statsLoading ? styles.spinningIcon : ""}
              />
              {statsLoading ? "Refreshing..." : "Refresh Data"}
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className={styles.statsGrid}>
          {/* Row 1: Inspection Metrics */}
          <div className={`${styles.statCard} ${styles.inspectionCard}`}>
            <div className={styles.statHeader}>
              <div className={styles.statIcon}>
                <Calendar size={20} />
              </div>
              <span className={styles.statLabel}>Inspections Due Today</span>
            </div>
            <div className={styles.statMain}>
              <span className={styles.statNumber}>
                {dashboardData.inspectionsDueToday}
              </span>
              <div className={styles.statTrend}>
                <ArrowUpRight size={14} />
                <span>{dashboardData.inspectionsThisWeek} this week</span>
              </div>
            </div>
            <div className={styles.statFooter}>
              <span className={styles.statSubtext}>
                {dashboardData.overdueInspections} overdue •{" "}
                {dashboardData.completedInspections} completed
              </span>
            </div>
          </div>

          <div className={`${styles.statCard} ${styles.equipmentCard}`}>
            <div className={styles.statHeader}>
              <div className={styles.statIcon}>
                <Package size={20} />
              </div>
              <span className={styles.statLabel}>Operational Equipment</span>
            </div>
            <div className={styles.statMain}>
              <span className={styles.statNumber}>
                {dashboardData.operationalEquipment}
              </span>
              <div className={styles.statProgress}>
                <div
                  className={styles.progressBar}
                  style={{
                    width: `${
                      (dashboardData.operationalEquipment /
                        dashboardData.totalEquipment) *
                        100 || 0
                    }%`,
                  }}
                />
              </div>
            </div>
            <div className={styles.statFooter}>
              <span className={styles.statSubtext}>
                of {dashboardData.totalEquipment} total •{" "}
                {dashboardData.maintenanceNeeded} need maintenance
              </span>
            </div>
          </div>

          <div className={`${styles.statCard} ${styles.clearanceCard}`}>
            <div className={styles.statHeader}>
              <div className={styles.statIcon}>
                <FileCheck size={20} />
              </div>
              <span className={styles.statLabel}>Pending Clearances</span>
            </div>
            <div className={styles.statMain}>
              <span className={styles.statNumber}>
                {dashboardData.pendingClearances}
              </span>
              <div className={styles.statTrend}>
                <Users size={14} />
                <span>{dashboardData.personnelDueClearance} personnel</span>
              </div>
            </div>
            <div className={styles.statFooter}>
              <span className={styles.statSubtext}>
                {dashboardData.clearanceThisWeek} this week • Mostly{" "}
                {dashboardData.pendingClearances > 0 ? "Resignation" : "None"}
              </span>
            </div>
          </div>

          <div className={`${styles.statCard} ${styles.financialCard}`}>
            <div className={styles.statHeader}>
              <div className={styles.statIcon}>
                <DollarSign size={20} />
              </div>
              <span className={styles.statLabel}>
                Outstanding Accountability
              </span>
            </div>
            <div className={styles.statMain}>
              <span className={styles.statNumber}>
                {formatCurrency(dashboardData.totalOutstanding)}
              </span>
              <div className={styles.statTrend}>
                <TrendingUp size={14} />
                <span>
                  {dashboardData.pendingSettlements} pending settlements
                </span>
              </div>
            </div>
            <div className={styles.statFooter}>
              <span className={styles.statSubtext}>
                {formatCurrency(dashboardData.settledAccountability)} settled
                this week
              </span>
            </div>
          </div>
        </div>

        {/* Main Dashboard Grid */}
        <div className={styles.dashboardGrid}>
          {/* Left Column: Upcoming Inspections */}
          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <h3>
                <Calendar size={20} />
                Upcoming Inspections (Next 3 Days)
              </h3>
              <button
                className={styles.viewAllBtn}
                onClick={() => handleNavigate("/inspector/equipment", { 
                  view: 'upcoming', 
                  days: '3' 
                })}
              >
                View All
              </button>
            </div>
            <div className={styles.contentSection}>
              {upcomingInspections.length > 0 ? (
                <div className={styles.listContainer}>
                  {upcomingInspections.map((inspection, index) => (
                    <div
                      key={inspection.id}
                      className={`${styles.listItem} ${styles.clickable}`}
                      onClick={() => handleViewInspection(inspection.id)}
                    >
                      <div className={styles.itemMain}>
                        <div className={styles.itemTitle}>
                          {inspection.equipment?.item_name || "Equipment"}
                          <span className={styles.itemCode}>
                            {inspection.equipment?.item_code || "N/A"}
                          </span>
                        </div>
                        <div className={styles.itemDetails}>
                          {inspection.assigned_personnel
                            ? `${
                                inspection.assigned_personnel.first_name || ""
                              } ${
                                inspection.assigned_personnel.last_name || ""
                              }`.trim()
                            : inspection.assigned_to || "Unassigned"}
                        </div>
                      </div>
                      <div className={styles.itemMeta}>
                        <div className={styles.itemDate}>
                          {formatDate(inspection.schedule_inspection_date)}
                        </div>
                        <div className={styles.itemStatus}>
                          <span
                            className={`${styles.statusBadge} ${styles.pending}`}
                          >
                            {inspection.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.emptyState}>
                  <Calendar size={32} className={styles.emptyIcon} />
                  <p>No upcoming inspections scheduled</p>
                  <button
                    className={styles.actionBtn}
                    onClick={() =>
                      handleNavigate("/inspectorEquipmentInspection")
                    }
                  >
                    Schedule Inspection
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Middle Column: Urgent Items */}
          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <h3>
                <AlertTriangle size={20} />
                Urgent Items Needing Attention
              </h3>
              <button
                className={styles.viewAllBtn}
                onClick={() => handleNavigate("/inspector/inventory", { 
                  view: 'urgent', 
                  status: 'damaged,lost,maintenance' 
                })}
              >
                View All
              </button>
            </div>
            <div className={styles.contentSection}>
              {urgentItems.length > 0 ? (
                <div className={styles.listContainer}>
                  {urgentItems.map((item, index) => (
                    <div
                      key={item.id}
                      className={`${styles.listItem} ${styles.clickable}`}
                      onClick={() => handleViewEquipment(item.id)}
                    >
                      <div className={styles.itemMain}>
                        <div className={styles.itemTitle}>
                          {item.item_name}
                          <span className={styles.itemCode}>
                            {item.item_code}
                          </span>
                        </div>
                        <div className={styles.itemDetails}>
                          {item.assigned_personnel
                            ? `${item.assigned_personnel.first_name || ""} ${
                                item.assigned_personnel.last_name || ""
                              }`.trim()
                            : "Unassigned"}
                        </div>
                      </div>
                      <div className={styles.itemMeta}>
                        <div className={styles.itemStatus}>
                          <span
                            className={`${styles.statusBadge} ${
                              item.status === "Damaged"
                                ? styles.damaged
                                : item.status === "Lost"
                                ? styles.lost
                                : styles.maintenance
                            }`}
                          >
                            {item.status}
                          </span>
                        </div>
                        <div className={styles.itemDate}>
                          Last checked:{" "}
                          {item.last_checked
                            ? formatDate(item.last_checked)
                            : "Never"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.emptyState}>
                  <CheckCircle size={32} className={styles.emptyIcon} />
                  <p>All equipment is in good condition</p>
                  <button
                    className={styles.actionBtn}
                    onClick={() => handleNavigate("/inspectorInventoryControl")}
                  >
                    Check Inventory
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Quick Stats */}
          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <h3>
                <BarChart3 size={20} />
                Quick Stats
              </h3>
            </div>
            <div className={styles.quickStats}>
              <div className={styles.quickStatItem}>
                <div className={styles.quickStatIcon}>
                  <Wrench size={18} />
                </div>
                <div className={styles.quickStatContent}>
                  <span className={styles.quickStatLabel}>
                    Maintenance Needed
                  </span>
                  <span className={styles.quickStatValue}>
                    {dashboardData.maintenanceNeeded}
                  </span>
                </div>
              </div>

              <div className={styles.quickStatItem}>
                <div className={styles.quickStatIcon}>
                  <UserX size={18} />
                </div>
                <div className={styles.quickStatContent}>
                  <span className={styles.quickStatLabel}>
                    Unassigned Equipment
                  </span>
                  <span className={styles.quickStatValue}>
                    {dashboardData.unassignedEquipment}
                  </span>
                </div>
              </div>

              <div className={styles.quickStatItem}>
                <div className={styles.quickStatIcon}>
                  <CheckSquare size={18} />
                </div>
                <div className={styles.quickStatContent}>
                  <span className={styles.quickStatLabel}>
                    Pending Inspections
                  </span>
                  <span className={styles.quickStatValue}>
                    {dashboardData.pendingInspections}
                  </span>
                </div>
              </div>

              <div className={styles.quickStatItem}>
                <div className={styles.quickStatIcon}>
                  <Users size={18} />
                </div>
                <div className={styles.quickStatContent}>
                  <span className={styles.quickStatLabel}>
                    Personnel with Equipment
                  </span>
                  <span className={styles.quickStatValue}>
                    {dashboardData.personnelWithEquipment}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className={styles.quickActionsSection}>
              <h4>Quick Actions</h4>
              <div className={styles.quickActionButtons}>
                <button
                  className={`${styles.quickActionBtn} ${styles.primary}`}
                  onClick={() =>
                    handleNavigate("/inspectorEquipmentInspection")
                  }
                >
                  <Calendar size={16} />
                  Schedule Inspection
                </button>
                <button
                  className={`${styles.quickActionBtn} ${styles.secondary}`}
                  onClick={() => handleNavigate("/inspectorInspectionReport")}
                >
                  <FileCheck size={16} />
                  Review Clearances
                </button>
                <button
                  className={`${styles.quickActionBtn} ${styles.tertiary}`}
                  onClick={() => handleNavigate("/inspectorInventoryControl")}
                >
                  <Package size={16} />
                  Inventory Control
                </button>
                <button
                  className={`${styles.quickActionBtn} ${styles.quaternary}`}
                  onClick={() => handleNavigate("/inspectionHistory")}
                >
                  <FileText size={16} />
                  View History
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section: Recent Activity */}
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <h3>
              <Clock size={20} />
              Recent Activity
            </h3>
            <button
              className={styles.viewAllBtn}
              onClick={() => handleNavigate("/inspector/history")}
            >
              View All
            </button>
          </div>
          <div className={styles.activityContainer}>
            {recentActivities.length > 0 ? (
              <div className={styles.activityList}>
                {recentActivities.map((activity, index) => (
                  <div
                    key={activity.id || index}
                    className={styles.activityItem}
                  >
                    <div
                      className={styles.activityIcon}
                      style={{ color: activity.color }}
                    >
                      {activity.icon}
                    </div>
                    <div className={styles.activityContent}>
                      <div className={styles.activityTitle}>
                        {activity.type === "INSPECTION"
                          ? "Inspection"
                          : "Clearance"}{" "}
                        {activity.action}
                      </div>
                      <div className={styles.activityDetails}>
                        {activity.details}
                      </div>
                    </div>
                    <div className={styles.activityTime}>
                      {formatDate(activity.timestamp)}
                    </div>
                    {activity.type === "INSPECTION" && (
                      <button
                        className={styles.viewActivityBtn}
                        onClick={() => handleViewInspection(activity.id)}
                      >
                        <Eye size={14} />
                      </button>
                    )}
                    {activity.type === "CLEARANCE" && (
                      <button
                        className={styles.viewActivityBtn}
                        onClick={() => handleViewClearance(activity.id)}
                      >
                        <Eye size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.emptyState}>
                <Clock size={32} className={styles.emptyIcon} />
                <p>No recent activity found</p>
              </div>
            )}
          </div>
        </div>

        {/* System Status Footer */}
        <div className={styles.systemStatus}>
          <div className={styles.statusItem}>
            <span className={`${styles.statusDot} ${styles.healthy}`} />
            <span>Database: Connected</span>
          </div>
          <div className={styles.statusItem}>
            <span className={`${styles.statusDot} ${styles.healthy}`} />
            <span>Last Updated: {new Date().toLocaleTimeString()}</span>
          </div>
          <div className={styles.statusItem}>
            <span className={`${styles.statusDot} ${styles.healthy}`} />
            <span>
              Records Loaded:{" "}
              {dashboardData.totalEquipment + dashboardData.pendingInspections}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InspectorDashboard;