import { useState, useEffect, useRef } from "react";
import { scanWebsite, getScanStatus } from "../api/scannerApi";

export default function ScanForm({ onResult }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [scanStatus, setScanStatus] = useState(null);
  const [error, setError] = useState(null);
  const pollingIntervalRef = useRef(null);
  const pollingTimeoutRef = useRef(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  const pollScanStatus = async (jobId) => {
    try {
      const statusResponse = await getScanStatus(jobId);
      setScanStatus(statusResponse);

      if (statusResponse.status === "completed") {
        stopPolling();
        setLoading(false);
        onResult(statusResponse.result);
        setScanStatus(null);
      } else if (statusResponse.status === "failed") {
        stopPolling();
        setLoading(false);
        setError("Scan failed. Please try again.");
        setScanStatus(null);
      } else if (statusResponse.status === "timeout") {
        stopPolling();
        setLoading(false);
        setError("Scan timed out. Please try again.");
        setScanStatus(null);
      }
      // Continue polling for 'active', 'waiting', 'delayed' states
    } catch (err) {
      console.error("Error polling scan status:", err);
      stopPolling();
      setLoading(false);
      setError("Failed to check scan status. Please try again.");
      setScanStatus(null);
    }
  };

  async function handleScan() {
    if (!url.trim()) {
      setError("Please enter a URL");
      return;
    }

    setLoading(true);
    setError(null);
    setScanStatus(null);
    onResult(null); // Clear previous results

    try {
      const scanResponse = await scanWebsite(url);

      if (scanResponse.jobId) {
        // Start polling for status
        pollingIntervalRef.current = setInterval(() => {
          pollScanStatus(scanResponse.jobId);
        }, 2000); // Poll every 2 seconds

        // Set timeout for 5 minutes (300,000 ms)
        pollingTimeoutRef.current = setTimeout(() => {
          stopPolling();
          setLoading(false);
          setError(
            "Scan timed out after 5 minutes. The scan may still be processing in the background."
          );
          setScanStatus(null);
        }, 300000);

        // Initial poll
        await pollScanStatus(scanResponse.jobId);
      } else {
        setLoading(false);
        setError("Failed to start scan. Please try again.");
      }
    } catch (err) {
      console.error("Error starting scan:", err);
      setLoading(false);
      setError(err.message || "Failed to start scan. Please try again.");
    }
  }

  const handleCancel = () => {
    stopPolling();
    setLoading(false);
    setScanStatus(null);
    setError(null);
  };

  return (
    <div className="scan-form">
      <div className="input-group">
        <input
          type="url"
          placeholder="https://example.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={loading}
        />
        <button onClick={handleScan} disabled={loading || !url.trim()}>
          {loading ? "Scanning..." : "Scan"}
        </button>
        {loading && (
          <button onClick={handleCancel} className="cancel-btn">
            Cancel
          </button>
        )}
      </div>

      {error && <div className="error-message">{error}</div>}

      {scanStatus && scanStatus.status !== "completed" && (
        <div className="scan-status">
          <div className="status-indicator">
            <div className="spinner"></div>
            <span>Scan Status: {scanStatus.status}</span>
          </div>
          {scanStatus.progress && (
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${scanStatus.progress}%` }}
              ></div>
            </div>
          )}
          <p>
            Estimated time remaining:{" "}
            {scanStatus.status === "queued" ? "30-60 seconds" : "Processing..."}
          </p>
        </div>
      )}
    </div>
  );
}
