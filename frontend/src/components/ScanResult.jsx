export default function ScanResult({ result }) {
  if (!result) return null;

  // Sanitize HTML content to prevent XSS
  const sanitizeHtml = (html) => {
    if (!html) return "";
    return html.replace(/</g, "<").replace(/>/g, ">");
  };

  // Sanitize script content
  const sanitizeScript = (script) => {
    if (!script) return "";
    return script.substring(0, 100) + (script.length > 100 ? "..." : "");
  };

  const handleExportPDF = async () => {
    try {
      const { exportScanPDF } = await import("../api/scannerApi.jsx");
      const blob = await exportScanPDF(result._id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `scan-report-${result._id}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Failed to export PDF:", error);
      alert("Failed to export PDF. Please try again.");
    }
  };

  return (
    <div className="card">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
        }}
      >
        <h3>Status: {result.corrupted ? "❌ Corrupted" : "✅ Safe"}</h3>
        <button onClick={handleExportPDF} className="btn btn-secondary">
          📄 Export PDF
        </button>
      </div>
      <p>Risk Score: {result.score}/100</p>
      <p>
        Severity:{" "}
        <span className={`severity-${result.severity}`}>
          {result.severity.toUpperCase()}
        </span>
      </p>

      {result.reasons && result.reasons.length > 0 && (
        <div>
          <h4>Risk Factors:</h4>
          <ul>
            {result.reasons.map((r, i) => (
              <li key={`reason-${i}`}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {result.threats && result.threats.dynamic && (
        <div>
          <h4>Dynamic Analysis Threats:</h4>
          <div className="threats-grid">
            <div className="threat-item">
              <strong>Redirects:</strong>{" "}
              {result.threats.dynamic.redirects ? "Yes" : "No"}
            </div>
            <div className="threat-item">
              <strong>DOM Mutations:</strong>{" "}
              {result.threats.dynamic.domMutations || 0}
            </div>
            <div className="threat-item">
              <strong>Network Errors:</strong>{" "}
              {result.threats.dynamic.networkErrors || 0}
            </div>
            <div className="threat-item">
              <strong>Console Errors:</strong>{" "}
              {result.threats.dynamic.consoleErrors || 0}
            </div>
            <div className="threat-item">
              <strong>Dynamic Scripts:</strong>{" "}
              {result.threats.dynamic.dynamicScripts || 0}
            </div>
            <div className="threat-item">
              <strong>Dynamic Iframes:</strong>{" "}
              {result.threats.dynamic.dynamicIframes || 0}
            </div>
            <div className="threat-item">
              <strong>Total Requests:</strong>{" "}
              {result.threats.dynamic.totalRequests || 0}
            </div>
          </div>
        </div>
      )}

      {result.dynamicAnalysis && (
        <div>
          <h4>Dynamic Analysis Details:</h4>

          {result.dynamicAnalysis.analysisFailed && (
            <div className="error-section">
              <h5>Analysis Failed:</h5>
              <p>
                Browser errors:{" "}
                {result.dynamicAnalysis.browserErrors?.join(", ") ||
                  "Unknown error"}
              </p>
            </div>
          )}

          <div className="analysis-details">
            <p>
              <strong>Final URL:</strong>{" "}
              {sanitizeHtml(result.dynamicAnalysis.finalURL || result.url)}
            </p>
            <p>
              <strong>Network Requests:</strong>{" "}
              {result.dynamicAnalysis.requests?.length || 0}
            </p>
            <p>
              <strong>Network Responses:</strong>{" "}
              {result.dynamicAnalysis.responses?.length || 0}
            </p>
          </div>

          {result.dynamicAnalysis.consoleMessages &&
            result.dynamicAnalysis.consoleMessages.length > 0 && (
              <div>
                <h5>Browser Console Messages:</h5>
                <ul className="console-messages">
                  {result.dynamicAnalysis.consoleMessages
                    .slice(0, 10)
                    .map((msg, i) => (
                      <li
                        key={`console-${i}`}
                        className={`console-${msg.type}`}
                      >
                        <strong>{msg.type}:</strong> {sanitizeHtml(msg.text)}
                      </li>
                    ))}
                  {result.dynamicAnalysis.consoleMessages.length > 10 && (
                    <li>
                      ... and{" "}
                      {result.dynamicAnalysis.consoleMessages.length - 10} more
                      messages
                    </li>
                  )}
                </ul>
              </div>
            )}

          {result.dynamicAnalysis.dynamicScripts &&
            result.dynamicAnalysis.dynamicScripts.length > 0 && (
              <div>
                <h5>Dynamic Scripts Loaded:</h5>
                <ul className="script-list">
                  {result.dynamicAnalysis.dynamicScripts
                    .slice(0, 5)
                    .map((script, i) => (
                      <li key={`script-${i}`}>
                        <code>{sanitizeScript(script)}</code>
                      </li>
                    ))}
                  {result.dynamicAnalysis.dynamicScripts.length > 5 && (
                    <li>
                      ... and {result.dynamicAnalysis.dynamicScripts.length - 5}{" "}
                      more scripts
                    </li>
                  )}
                </ul>
              </div>
            )}

          {result.dynamicAnalysis.dynamicIframes &&
            result.dynamicAnalysis.dynamicIframes.length > 0 && (
              <div>
                <h5>Dynamic Iframes:</h5>
                <ul>
                  {result.dynamicAnalysis.dynamicIframes.map((iframe, i) => (
                    <li key={`iframe-${i}`}>
                      <code>{sanitizeHtml(iframe)}</code>
                    </li>
                  ))}
                </ul>
              </div>
            )}
        </div>
      )}
    </div>
  );
}
