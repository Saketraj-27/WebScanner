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

  return (
    <div className="card">
      <h3>Status: {result.corrupted ? "❌ Corrupted" : "✅ Safe"}</h3>
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
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {result.threats && (
        <div>
          <h4>Threat Analysis:</h4>
          <div>
            <h5>Static Analysis:</h5>
            <p>
              Obfuscated Scripts:{" "}
              {result.threats.static?.obfuscatedScripts || 0}
            </p>
            <p>
              Suspicious Patterns:{" "}
              {result.threats.static?.suspiciousPatterns?.length || 0}
            </p>
          </div>
          <div>
            <h5>Dynamic Analysis:</h5>
            <p>Redirects: {result.threats.dynamic?.redirects ? "Yes" : "No"}</p>
            <p>DOM Mutations: {result.threats.dynamic?.domMutations || 0}</p>
            <p>Network Errors: {result.threats.dynamic?.networkErrors || 0}</p>
          </div>
        </div>
      )}

      {result.staticAnalysis && (
        <div>
          <h4>Static Analysis Details:</h4>
          <p>External Scripts: {result.staticAnalysis.scripts?.length || 0}</p>
          <p>Iframes: {result.staticAnalysis.iframes?.length || 0}</p>
          {result.staticAnalysis.obfuscatedScripts &&
            result.staticAnalysis.obfuscatedScripts.length > 0 && (
              <div>
                <h5>Obfuscated Scripts:</h5>
                <ul>
                  {result.staticAnalysis.obfuscatedScripts
                    .slice(0, 3)
                    .map((script, i) => (
                      <li key={i}>
                        <code>{sanitizeScript(script)}</code>
                      </li>
                    ))}
                  {result.staticAnalysis.obfuscatedScripts.length > 3 && (
                    <li>
                      ... and{" "}
                      {result.staticAnalysis.obfuscatedScripts.length - 3} more
                    </li>
                  )}
                </ul>
              </div>
            )}
        </div>
      )}

      {result.dynamicAnalysis && (
        <div>
          <h4>Dynamic Analysis Details:</h4>
          <p>Requests: {result.dynamicAnalysis.requests?.length || 0}</p>
          <p>Responses: {result.dynamicAnalysis.responses?.length || 0}</p>
          <p>Final URL: {sanitizeHtml(result.dynamicAnalysis.finalURL)}</p>
          {result.dynamicAnalysis.consoleMessages &&
            result.dynamicAnalysis.consoleMessages.length > 0 && (
              <div>
                <h5>Console Messages:</h5>
                <ul>
                  {result.dynamicAnalysis.consoleMessages
                    .slice(0, 5)
                    .map((msg, i) => (
                      <li key={i}>
                        <strong>{msg.type}:</strong> {sanitizeHtml(msg.text)}
                      </li>
                    ))}
                  {result.dynamicAnalysis.consoleMessages.length > 5 && (
                    <li>
                      ... and{" "}
                      {result.dynamicAnalysis.consoleMessages.length - 5} more
                      messages
                    </li>
                  )}
                </ul>
              </div>
            )}
        </div>
      )}
    </div>
  );
}
