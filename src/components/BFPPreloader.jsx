import React, { useState, useEffect, useRef } from "react";
import styles from "./BFPPreloader.module.css";
import { useLocation } from "react-router-dom";

const BFPPreloader = ({
  loading = true,
  progress = 0,
  moduleTitle = "",
  onRetry = () => window.location.reload(),
}) => {
  const [visible, setVisible] = useState(true);
  const [localProgress, setLocalProgress] = useState(0);
  const [networkStatus, setNetworkStatus] = useState(navigator.onLine);
  const [connectionError, setConnectionError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const location = useLocation();

  const maxRetries = 3;
  const offlineCheckInterval = useRef(null);
  const retryTimeout = useRef(null);

const getModuleTitle = () => {
  if (moduleTitle) return moduleTitle;

  const path = location.pathname.toLowerCase();

  // Create a mapping object for cleaner code
  const routeTitles = {
    "/leavemanagement": "LEAVE MANAGEMENT SYSTEM • Processing Requests...",
    "/inventorycontrol": "INVENTORY CONTROL SYSTEM • Verifying Equipment...",
    "/clearancesystem": "CLEARANCE SYSTEM • Checking Permissions...",
    "/personnelregister": "PERSONNEL REGISTER • Accessing Database...",
    "/personnelprofile": "PERSONNEL PROFILE • Loading Records...",
    "/leavereconds": "LEAVE RECORDS • Retrieving History...",
    "/clearancerecords": "CLEARANCE RECORDS • Validating Documents...",
    "/medicalrecords": "MEDICAL RECORDS • Accessing Health Data...",
    "/awardscommendations": "AWARDS & COMMENDATIONS • Loading Achievements...",
    "/promotion": "PROMOTION SYSTEM • Checking Eligibility...",
    "/trainings": "TRAINING SYSTEM • Loading Schedules...",
    "/placement": "PLACEMENT SYSTEM • Assigning Positions...",
    "/history": "HISTORY SYSTEM • Retrieving Archives...",
    "/personnelrecentactivity": "ACTIVITY LOGS • Monitoring Actions...",
    "/admin": "ADMIN DASHBOARD • Loading Secure Session...",
    "/recruitment": "RECRUITMENT DASHBOARD • Screening Candidates...",
    "/recruitment/profile": "RECRUITMENT PROFILE • Reviewing Applications...",
    "/employee": "EMPLOYEE DASHBOARD • Loading Personal Data...",
    "/employeeleavedashboard": "LEAVE DASHBOARD • Checking Balances...",
    "/employeeleaverequest": "LEAVE REQUEST • Processing Application...",
    "/inspectordashboard": "INSPECTOR DASHBOARD • Loading Equipment Status...",
    "/inspectorinventorycontrol":
      "INSPECTOR INVENTORY • Verifying Equipment...",
    "/inspectorequipmentinspection":
      "EQUIPMENT INSPECTION • Running Diagnostics...",
    "/inspectorinspectionreport": "INSPECTION REPORTS • Generating Analysis...",
    "/inspectionhistory": "INSPECTION HISTORY • Retrieving Records...",
  };

  // Check for exact path matches first
  if (routeTitles[path]) {
    return routeTitles[path];
  }

  // Then check for partial matches
  for (const [route, title] of Object.entries(routeTitles)) {
    if (path.includes(route.replace("/", ""))) {
      return title;
    }
  }

  // Default fallback
  const defaultTitles = {
    leave: "LEAVE MANAGEMENT • Processing Requests...",
    inventory: "INVENTORY SYSTEM • Verifying Equipment...",
    clearance: "CLEARANCE SYSTEM • Checking Permissions...",
    personnel: "PERSONNEL SYSTEM • Accessing Database...",
    medical: "MEDICAL SYSTEM • Accessing Health Data...",
    training: "TRAINING SYSTEM • Loading Schedules...",
    admin: "ADMIN DASHBOARD • Loading Secure Session...",
    recruitment: "RECRUITMENT SYSTEM • Screening Candidates...",
    employee: "EMPLOYEE PORTAL • Loading Personal Data...",
    inspector: "INSPECTOR PORTAL • Loading Equipment Status...",
  };

  for (const [keyword, title] of Object.entries(defaultTitles)) {
    if (path.includes(keyword)) {
      return title;
    }
  }

  return "BFP MANAGEMENT SYSTEM • System Initializing...";
};

  // Test network connection
  const testNetworkConnection = async () => {
    try {
      const endpoints = [
        "https://www.google.com/favicon.ico",
        "https://connectivitycheck.gstatic.com/generate_204",
      ];

      for (const endpoint of endpoints) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000);

          await fetch(endpoint, {
            method: "HEAD",
            mode: "no-cors",
            signal: controller.signal,
          });

          clearTimeout(timeoutId);
          return true;
        } catch (err) {
          continue;
        }
      }
      return false;
    } catch (error) {
      console.error("Network test failed:", error);
      return false;
    }
  };

  // Enhanced network monitoring
  useEffect(() => {
    const handleOnline = () => {
      setNetworkStatus(true);
      setConnectionError(null);

      // Test connection when back online
      setIsTestingConnection(true);
      setTimeout(() => {
        testNetworkConnection().then((isConnected) => {
          if (isConnected) {
            toastNotification("✅ Connection restored!", "success");
          }
          setIsTestingConnection(false);
        });
      }, 1000);
    };

    const handleOffline = () => {
      setNetworkStatus(false);
      setConnectionError("BROWSER_OFFLINE");
    };

    // Active network monitoring
    const startActiveMonitoring = () => {
      if (offlineCheckInterval.current) {
        clearInterval(offlineCheckInterval.current);
      }

      offlineCheckInterval.current = setInterval(async () => {
        if (!navigator.onLine) return;

        const isConnected = await testNetworkConnection();
        if (!isConnected) {
          setNetworkStatus(false);
          setConnectionError("NETWORK_UNREACHABLE");
        }
      }, 5000);
    };

    // Initial setup
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Test initial connection
    testNetworkConnection().then((isConnected) => {
      if (!isConnected) {
        setNetworkStatus(false);
        setConnectionError("NETWORK_UNREACHABLE");
      }
    });

    // Start active monitoring
    startActiveMonitoring();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (offlineCheckInterval.current) {
        clearInterval(offlineCheckInterval.current);
      }
      if (retryTimeout.current) {
        clearTimeout(retryTimeout.current);
      }
    };
  }, []);

  // Handle loading progress - STAY IN PRELOADER WHEN OFFLINE
  useEffect(() => {
    // Only hide preloader when loading is complete AND we have good connection
    if (!loading && networkStatus && !connectionError) {
      // When parent says loading is complete and we're online, finish animation
      setLocalProgress(100);

      // Small delay before hiding
      const timer = setTimeout(() => {
        setVisible(false);
      }, 500);

      return () => clearTimeout(timer);
    }

    // If parent provides actual progress, use it
    if (progress > 0 && networkStatus) {
      setLocalProgress(Math.min(progress, 90));
    } else if (networkStatus) {
      // Simulate progress while loading (only when online)
      const interval = setInterval(() => {
        setLocalProgress((prev) => {
          if (prev >= 90) return 90;
          return prev + 10;
        });
      }, 200);

      return () => clearInterval(interval);
    } else {
      // When offline, stop progress at current point
      setLocalProgress((prev) => Math.min(prev, 50));
    }
  }, [loading, progress, networkStatus, connectionError]);

  const handleRetry = async () => {
    if (isTestingConnection) return;

    setIsTestingConnection(true);
    setRetryCount((prev) => prev + 1);

    const isConnected = await testNetworkConnection();

    if (isConnected) {
      setNetworkStatus(true);
      setConnectionError(null);
      setRetryCount(0);

      // Notify parent component to retry
      if (onRetry) {
        onRetry();
      }

      toastNotification("✅ Connection successful! Loading data...", "success");
    } else {
      if (retryCount >= maxRetries) {
        toastNotification(
          `❌ Unable to connect after ${maxRetries} attempts. Please check your network.`,
          "error"
        );
      } else {
        toastNotification(
          `⚠️ Retry ${retryCount}/${maxRetries}: Still unable to connect...`,
          "warning"
        );
      }
    }

    setIsTestingConnection(false);
  };

  const handleCheckNetworkSettings = () => {
    toastNotification(
      "1. Check WiFi/mobile data is on\n" +
        "2. Try airplane mode on/off\n" +
        "3. Restart your device\n" +
        "4. Contact IT if issue persists",
      "info",
      5000
    );
  };

  const toastNotification = (message, type = "info", duration = 3000) => {
    const toast = document.createElement("div");
    toast.className = `toastNotification toast${
      type.charAt(0).toUpperCase() + type.slice(1)
    }`;
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 8px;
      color: white;
      z-index: 10001;
      animation: toastSlideIn 0.3s ease-out;
      max-width: 400px;
      white-space: pre-line;
      font-family: inherit;
      font-size: 0.9rem;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    `;

    const typeStyles = {
      success:
        "background: linear-gradient(135deg, #2ecc71, #27ae60); border-left: 4px solid #27ae60;",
      error:
        "background: linear-gradient(135deg, #e74c3c, #c0392b); border-left: 4px solid #c0392b;",
      warning:
        "background: linear-gradient(135deg, #f39c12, #e67e22); border-left: 4px solid #e67e22;",
      info: "background: linear-gradient(135deg, #3498db, #2980b9); border-left: 4px solid #2980b9;",
    };

    toast.style.cssText += typeStyles[type] || typeStyles.info;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = "toastSlideOut 0.3s ease-in forwards";
      setTimeout(() => {
        if (document.body.contains(toast)) {
          document.body.removeChild(toast);
        }
      }, 300);
    }, duration);
  };

  const getConnectionStatusMessage = () => {
    if (connectionError === "BROWSER_OFFLINE") {
      return "Your browser reports no internet connection.";
    } else if (connectionError === "NETWORK_UNREACHABLE") {
      return "Cannot reach BFP servers. Network may be restricted.";
    } else if (!networkStatus) {
      return "Network connection appears to be unstable.";
    }
    return "Unable to connect to BFP server.";
  };

  // NEVER HIDE when offline - always show preloader
  if (!visible && networkStatus && !connectionError) return null;

  // Determine which mode to show
  const showOfflineMode = !networkStatus || connectionError;

  return (
    <div
      className={`${styles.preloaderOverlay} ${
        !visible ? styles.fadeOut : ""
      } ${showOfflineMode ? styles.offlineMode : ""} ${
        !networkStatus ? styles.weakConnection : ""
      }`}
    >
      <div className={styles.preloaderContainer}>
        {/* OFFLINE/WEAK CONNECTION MODE */}
        {showOfflineMode ? (
          <>
            <div className={styles.offlineIcon}>
              <div className={styles.wifiSignal}>
                <div className={styles.wifiArc}></div>
                <div className={styles.wifiArc}></div>
                <div className={styles.wifiArc}></div>
                <div className={styles.wifiCross}></div>
              </div>

              <div className={styles.offlinePulse}></div>

              {retryCount > 0 && (
                <div className={styles.retryCounter}>
                  <span>
                    Attempt {retryCount}/{maxRetries}
                  </span>
                </div>
              )}
            </div>

            <h1 className={styles.bfpText}>BUREAU OF FIRE PROTECTION</h1>
            <p className={styles.offlineSubtitle}>
              <span className={styles.offlineBadge}>
                {connectionError === "BROWSER_OFFLINE"
                  ? "OFFLINE"
                  : "WEAK CONNECTION"}
              </span>
              {getModuleTitle()}
            </p>

            <div className={styles.connectionStatus}>
              <div className={styles.statusIndicator}>
                <div className={styles.statusDot}></div>
                <span>{getConnectionStatusMessage()}</span>
              </div>
              <p className={styles.statusMessage}>
                {connectionError === "BROWSER_OFFLINE"
                  ? "Please check your device's network settings."
                  : "The BFP server may be unreachable or your connection is restricted."}
              </p>
            </div>

            <div className={styles.connectionQuality}>
              <div className={styles.qualityMeter}>
                <div
                  className={styles.qualityBar}
                  style={{ width: networkStatus ? "30%" : "0%" }}
                ></div>
              </div>
              <span className={styles.qualityLabel}>
                {networkStatus ? "Weak Signal" : "No Signal"}
              </span>
            </div>

            <div className={styles.connectionBars}>
              <div className={styles.signalBar}></div>
              <div className={styles.signalBar}></div>
              <div className={styles.signalBar}></div>
              <div className={styles.signalBar}></div>
              <div className={styles.signalBar}></div>
            </div>

            <div className={styles.offlineActions}>
              <button
                className={`${styles.retryButton} ${
                  isTestingConnection ? styles.testing : ""
                }`}
                onClick={handleRetry}
                disabled={isTestingConnection}
              >
                {isTestingConnection ? (
                  <>
                    <span className={styles.spinner}></span>
                    Testing Connection...
                  </>
                ) : (
                  "🔄 Retry Connection"
                )}
              </button>
              <button
                className={styles.checkNetworkButton}
                onClick={handleCheckNetworkSettings}
              >
                🌐 Network Help
              </button>
            </div>

            <div className={styles.networkTips}>
              <p className={styles.tipTitle}>Quick Tips:</p>
              <ul className={styles.tipList}>
                <li>✓ Check WiFi/mobile data is enabled</li>
                <li>✓ Try airplane mode on/off</li>
                <li>✓ Move closer to your router</li>
                <li>✓ Contact IT if problem persists</li>
              </ul>
            </div>

            <p className={styles.lastCheck}>
              Last checked:{" "}
              {new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </>
        ) : (
          <>
            {/* NORMAL LOADING MODE */}
            <div className={styles.bfpLogo}>
              <div className={styles.bfpLogoInner}></div>
            </div>

            <h1 className={styles.bfpText}>BUREAU OF FIRE PROTECTION</h1>
            <p className={styles.bfpSubtitle}>{getModuleTitle()}</p>

            <div className={styles.progressContainer}>
              <div
                className={styles.progressBar}
                style={{ width: `${localProgress}%` }}
              ></div>
            </div>

            <p className={styles.loadingText}>
              {loading
                ? `Loading... ${localProgress}%`
                : "Complete! Finalizing..."}
            </p>

            <div className={styles.fireAnimation}>
              <div className={styles.fireParticle}></div>
              <div className={styles.fireParticle}></div>
              <div className={styles.fireParticle}></div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default BFPPreloader;
