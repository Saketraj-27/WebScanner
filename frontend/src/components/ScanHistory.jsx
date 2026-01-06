import React, { useState, useEffect } from "react";
import ScanResult from "./ScanResult";
import { getScanHistory } from "../api/scannerApi";

const ScanHistory = () => {
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalScans, setTotalScans] = useState(0);

  useEffect(() => {
    fetchScans(page);
  }, [page]);

  const fetchScans = async (pageNum = 1) => {
    try {
      setLoading(true);
      const data = await getScanHistory(pageNum, 10);
      setScans(data.scans);
      setTotalPages(data.pagination.pages);
      setTotalScans(data.pagination.total);
    } catch (error) {
      console.error("Error fetching scans:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

  if (loading && scans.length === 0) {
    return <div className="loading">Loading scan history...</div>;
  }

  return (
    <div className="scan-history">
      <div className="history-header">
        <h2>Scan History</h2>
        <div className="stats">
          <span>Total Scans: {totalScans}</span>
          <span>
            Page {page} of {totalPages}
          </span>
        </div>
      </div>

      {scans.length === 0 ? (
        <p>No scans found.</p>
      ) : (
        <>
          <div className="scan-list">
            {scans.map((scan) => (
              <ScanResult key={scan._id} result={scan} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1}
                className="page-btn"
              >
                Previous
              </button>

              <div className="page-numbers">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNum =
                    Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`page-btn ${pageNum === page ? "active" : ""}`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page === totalPages}
                className="page-btn"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ScanHistory;
