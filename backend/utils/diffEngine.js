const crypto = require("crypto");

exports.diff = (oldArr = [], newArr = []) => ({
  added: newArr.filter((x) => !oldArr.includes(x)),
  removed: oldArr.filter((x) => !newArr.includes(x)),
});

exports.contentDiff = (oldContent, newContent) => {
  const oldHash = crypto.createHash("sha256").update(oldContent || "").digest("hex");
  const newHash = crypto.createHash("sha256").update(newContent || "").digest("hex");
  const changed = oldHash !== newHash;

  // Simple line-by-line diff for HTML content
  const oldLines = (oldContent || "").split("\n");
  const newLines = (newContent || "").split("\n");

  const addedLines = [];
  const removedLines = [];

  const maxLen = Math.max(oldLines.length, newLines.length);
  for (let i = 0; i < maxLen; i++) {
    if (i >= oldLines.length) {
      addedLines.push({ line: i + 1, content: newLines[i] });
    } else if (i >= newLines.length) {
      removedLines.push({ line: i + 1, content: oldLines[i] });
    } else if (oldLines[i] !== newLines[i]) {
      removedLines.push({ line: i + 1, content: oldLines[i] });
      addedLines.push({ line: i + 1, content: newLines[i] });
    }
  }

  return {
    changed,
    oldHash,
    newHash,
    addedLines,
    removedLines,
    summary: {
      addedCount: addedLines.length,
      removedCount: removedLines.length,
    },
  };
};

exports.scriptDiff = (oldScripts = [], newScripts = []) => {
  const added = newScripts.filter(s => !oldScripts.includes(s));
  const removed = oldScripts.filter(s => !newScripts.includes(s));
  const suspicious = added.filter(s => /eval|Function|setTimeout|setInterval|document\.write|innerHTML/.test(s));

  return {
    added,
    removed,
    suspicious,
    riskIncrease: suspicious.length > 0 ? 30 : 0,
  };
};
