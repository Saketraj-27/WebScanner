import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler,
} from "chart.js";
import { Line, Bar, Doughnut } from "react-chartjs-2";
import ScanForm from "../components/ScanForm";
import ScanResult from "../components/ScanResult";
import ScanHistory from "../components/ScanHistory";
import { getScanHistory, getQueueStatus } from "../api/scannerApi";
import { useAuth } from "../context/AuthContext";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
);

export default function Dashboard() {
  const { logout } = useAuth();
  const [result, setResult] = useState(null);
  const [scanHistory, setScanHistory] = useState([]);
  const [queueStatus, setQueueStatus] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [realTimeData, setRealTimeData] = useState({
    activeScans: 0,
    completedToday: 0,
    threatsDetected: 0,
  });
  const socketRef = useRef(null);

  useEffect(() => {
    // Initialize Socket.IO connection
    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
    const socketUrl = apiUrl.replace("/api", "");
    socketRef.current = io(socketUrl);

    // Join public room for real-time updates (works for both authenticated and unauthenticated users)
    socketRef.current.emit("join", null);

    // Listen for real-time updates
    socketRef.current.on("scan.started", (data) => {
      setRealTimeData((prev) => ({
        ...prev,
        activeScans: prev.activeScans + 1,
      }));
    });

    socketRef.current.on("scan.completed", (data) => {
      setScanHistory((prev) => [data, ...prev.slice(0, 9)]);
      setRealTimeData((prev) => ({
        ...prev,
        activeScans: Math.max(0, prev.activeScans - 1),
        completedToday: prev.completedToday + 1,
        threatsDetected: prev.threatsDetected + (data.score > 30 ? 1 : 0), // Increment if threat score > 30
      }));
    });

    socketRef.current.on("scan.failed", (data) => {
      setRealTimeData((prev) => ({
        ...prev,
        activeScans: Math.max(0, prev.activeScans - 1),
      }));
    });

    // Load initial data
    loadDashboardData();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const loadDashboardData = async () => {
    try {
      const [historyData, queueData] = await Promise.all([
        getScanHistory(1, 10),
        getQueueStatus(),
      ]);

      setScanHistory(historyData.scans || []);
      setQueueStatus(queueData);
    } catch (error) {
      console.error("Error loading dashboard data:", error);
      if (error.message === "Invalid token") {
        logout();
      }
    }
  };

  // Prepare chart data
  const threatTrendData = {
    labels: scanHistory
      .slice(0, 7)
      .reverse()
      .map((scan) => new Date(scan.createdAt).toLocaleDateString()),
    datasets: [
      {
        label: "Threat Score",
        data: scanHistory
          .slice(0, 7)
          .reverse()
          .map((scan) => scan.score || 0),
        borderColor: "rgb(255, 99, 132)",
        backgroundColor: "rgba(255, 99, 132, 0.5)",
        tension: 0.1,
      },
    ],
  };

  const severityDistribution = {
    labels: ["Low", "Medium", "High", "Critical"],
    datasets: [
      {
        data: [
          scanHistory.filter((s) => (s.severity || "low") === "low").length,
          scanHistory.filter((s) => s.severity === "medium").length,
          scanHistory.filter((s) => s.severity === "high").length,
          scanHistory.filter((s) => s.severity === "critical").length,
        ],
        backgroundColor: [
          "rgba(75, 192, 192, 0.6)",
          "rgba(255, 206, 86, 0.6)",
          "rgba(255, 99, 132, 0.6)",
          "rgba(153, 102, 255, 0.6)",
        ],
        borderColor: [
          "rgba(75, 192, 192, 1)",
          "rgba(255, 206, 86, 1)",
          "rgba(255, 99, 132, 1)",
          "rgba(153, 102, 255, 1)",
        ],
        borderWidth: 1,
      },
    ],
  };

  const scanStatusData = {
    labels: ["Completed", "Failed", "In Progress"],
    datasets: [
      {
        label: "Scan Status",
        data: [
          scanHistory.filter((s) => s.corrupted !== undefined).length,
          scanHistory.filter((s) => s.error).length,
          realTimeData.activeScans,
        ],
        backgroundColor: [
          "rgba(75, 192, 192, 0.6)",
          "rgba(255, 99, 132, 0.6)",
          "rgba(255, 206, 86, 0.6)",
        ],
      },
    ],
  };

  const exportReport = () => {
    const reportData = {
      generatedAt: new Date().toISOString(),
      summary: {
        totalScans: scanHistory.length,
        activeScans: realTimeData.activeScans,
        threatsDetected: realTimeData.threatsDetected,
        completedToday: realTimeData.completedToday,
      },
      recentScans: scanHistory.slice(0, 10),
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `security-report-${
      new Date().toISOString().split("T")[0]
    }.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Website Security Monitoring Dashboard</h1>
        <div className="header-actions">
          <button onClick={exportReport} className="export-btn">
            Export Report
          </button>
          <button onClick={loadDashboardData} className="refresh-btn">
            Refresh
          </button>
        </div>
      </header>

      {/* Real-time Status Bar */}
      <div className="status-bar">
        <div className="status-item">
          <span className="status-label">Active Scans:</span>
          <span className="status-value">{realTimeData.activeScans}</span>
        </div>
        <div className="status-item">
          <span className="status-label">Completed Today:</span>
          <span className="status-value">{realTimeData.completedToday}</span>
        </div>
        <div className="status-item">
          <span className="status-label">Threats Detected:</span>
          <span className="status-value">{realTimeData.threatsDetected}</span>
        </div>
        <div className="status-item">
          <span className="status-label">Queue Status:</span>
          <span className="status-value">
            {queueStatus
              ? `${queueStatus.active}/${queueStatus.waiting}`
              : "Loading..."}
          </span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="dashboard-tabs">
        <button
          className={activeTab === "overview" ? "active" : ""}
          onClick={() => setActiveTab("overview")}
        >
          Overview
        </button>
        <button
          className={activeTab === "scan" ? "active" : ""}
          onClick={() => setActiveTab("scan")}
        >
          New Scan
        </button>
        <button
          className={activeTab === "history" ? "active" : ""}
          onClick={() => setActiveTab("history")}
        >
          Scan History
        </button>
        <button
          className={activeTab === "analytics" ? "active" : ""}
          onClick={() => setActiveTab("analytics")}
        >
          Analytics
        </button>
      </div>

      {/* Tab Content */}
      <div className="dashboard-content">
        {activeTab === "overview" && (
          <div className="overview-grid">
            <div className="chart-card">
              <h3>Threat Trend (Last 7 Scans)</h3>
              <Line
                data={threatTrendData}
                options={{
                  responsive: true,
                  plugins: {
                    legend: { position: "top" },
                    title: { display: false },
                  },
                }}
              />
            </div>

            <div className="chart-card">
              <h3>Scan Status Distribution</h3>
              <Bar
                data={scanStatusData}
                options={{
                  responsive: true,
                  plugins: {
                    legend: { position: "top" },
                    title: { display: false },
                  },
                }}
              />
            </div>

            <div className="chart-card">
              <h3>Threat Severity Distribution</h3>
              <Doughnut
                data={severityDistribution}
                options={{
                  responsive: true,
                  plugins: {
                    legend: { position: "right" },
                    title: { display: false },
                  },
                }}
              />
            </div>

            <div className="recent-scans-card">
              <h3>Recent Scans</h3>
              <div className="recent-scans-list">
                {scanHistory.slice(0, 5).map((scan, index) => (
                  <div
                    key={scan._id + "-" + index}
                    className="recent-scan-item"
                  >
                    <div className="scan-url">{scan.url}</div>
                    <div className="scan-meta">
                      <span className={`severity ${scan.severity || "low"}`}>
                        {scan.severity || "Low"}
                      </span>
                      <span className="score">Score: {scan.score || 0}</span>
                      <span className="date">
                        {new Date(scan.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "scan" && (
          <div className="scan-section">
            <ScanForm onResult={setResult} />
            {result && <ScanResult result={result} />}
          </div>
        )}

        {activeTab === "history" && <ScanHistory />}

        {activeTab === "analytics" && (
          <div className="analytics-section">
            <div className="analytics-grid">
              <div className="metric-card">
                <h3>Total Scans</h3>
                <div className="metric-value">{scanHistory.length}</div>
              </div>
              <div className="metric-card">
                <h3>Average Threat Score</h3>
                <div className="metric-value">
                  {scanHistory.length > 0
                    ? Math.round(
                        scanHistory.reduce(
                          (sum, scan) => sum + (scan.score || 0),
                          0
                        ) / scanHistory.length
                      )
                    : 0}
                </div>
              </div>
              <div className="metric-card">
                <h3>High Risk Scans</h3>
                <div className="metric-value">
                  {scanHistory.filter((scan) => (scan.score || 0) > 70).length}
                </div>
              </div>
              <div className="metric-card">
                <h3>Clean Scans</h3>
                <div className="metric-value">
                  {scanHistory.filter((scan) => (scan.score || 0) <= 30).length}
                </div>
              </div>
            </div>

            <div className="detailed-charts">
              <div className="chart-card full-width">
                <h3>Comprehensive Threat Analysis</h3>
                <Line
                  data={{
                    labels: scanHistory
                      .slice(0, 14)
                      .reverse()
                      .map((scan) =>
                        new Date(scan.createdAt).toLocaleDateString()
                      ),
                    datasets: [
                      {
                        label: "Threat Score",
                        data: scanHistory
                          .slice(0, 14)
                          .reverse()
                          .map((scan) => scan.score || 0),
                        borderColor: "rgb(255, 99, 132)",
                        backgroundColor: "rgba(255, 99, 132, 0.1)",
                        fill: true,
                      },
                      {
                        label: "Corruption Risk",
                        data: scanHistory
                          .slice(0, 14)
                          .reverse()
                          .map((scan) => (scan.corrupted ? 100 : 0)),
                        borderColor: "rgb(255, 206, 86)",
                        backgroundColor: "rgba(255, 206, 86, 0.1)",
                        fill: true,
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    plugins: {
                      legend: { position: "top" },
                      title: { display: false },
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        max: 100,
                      },
                    },
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
