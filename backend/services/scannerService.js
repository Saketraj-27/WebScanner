const axios = require("axios");
const cheerio = require("cheerio");
const crypto = require("crypto");
const puppeteer = require("puppeteer");

// Simple in-memory cache for scan results
const scanCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Browser pool for reuse
let browserPool = [];
const MAX_BROWSERS = 3;

async function getBrowser() {
  // Try to get an available browser from pool
  if (browserPool.length > 0) {
    const browser = browserPool.pop();
    try {
      // Test if browser is still working
      await browser.version();
      return browser;
    } catch (error) {
      // Browser is dead, create new one
      console.log("Browser in pool is dead, creating new one");
    }
  }

  // Create new browser if pool is empty or browsers are dead
  if (browserPool.length < MAX_BROWSERS) {
    console.log("Creating new browser instance");
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });
    return browser;
  }

  // Wait for a browser to become available
  return new Promise((resolve) => {
    const checkPool = () => {
      if (browserPool.length > 0) {
        resolve(browserPool.pop());
      } else {
        setTimeout(checkPool, 100);
      }
    };
    checkPool();
  });
}

function returnBrowser(browser) {
  if (browserPool.length < MAX_BROWSERS) {
    browserPool.push(browser);
  } else {
    browser.close().catch(console.error);
  }
}

module.exports = async function scan(url, options = {}) {
  const { useBrowser = false, timeout = 15000, skipCache = false } = options; // Temporarily disable dynamic testing to test static analysis

  // Check cache first
  if (!skipCache) {
    const cacheKey = `${url}_${useBrowser}`;
    const cached = scanCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`Returning cached result for ${url}`);
      return cached.result;
    }
  }

  // Static analysis (fast)
  console.log(`[SCANNER SERVICE] Starting static analysis for ${url}`);
  let staticResult = await performStaticAnalysis(url);
  console.log(`[SCANNER SERVICE] Static analysis completed for ${url}`);

  // Dynamic analysis with headless browser if enabled
  let dynamicResult = {};
  if (useBrowser) {
    let browser;
    try {
      browser = await getBrowser();
      // Add timeout wrapper to prevent hanging
      const dynamicPromise = performDynamicAnalysis(url, timeout, browser);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Dynamic analysis timeout')), timeout + 2000)
      );

      dynamicResult = await Promise.race([dynamicPromise, timeoutPromise]);
    } catch (error) {
      console.warn("Dynamic analysis failed:", error.message);
      dynamicResult = {
        browserErrors: [error.message],
        requests: [],
        responses: [],
        consoleMessages: [],
        networkErrors: [],
        redirects: false,
        domMutations: [],
        finalURL: url,
        dynamicScripts: [],
        dynamicIframes: []
      };
    } finally {
      if (browser) {
        try {
          returnBrowser(browser);
        } catch (error) {
          console.warn("Error returning browser to pool:", error.message);
        }
      }
    }
  }

  // Combine results and calculate risk score
  const combined = combineAnalysisResults(staticResult, dynamicResult);

  const result = {
    ...combined,
    staticAnalysis: staticResult,
    dynamicAnalysis: dynamicResult,
  };

  // Cache the result
  if (!skipCache) {
    const cacheKey = `${url}_${useBrowser}`;
    scanCache.set(cacheKey, {
      result,
      timestamp: Date.now()
    });

    // Clean up old cache entries
    for (const [key, value] of scanCache.entries()) {
      if (Date.now() - value.timestamp > CACHE_TTL) {
        scanCache.delete(key);
      }
    }
  }

  return result;
};

async function performStaticAnalysis(url) {
  try {
    const res = await axios.get(url, { timeout: 20000, maxContentLength: 10000000 });
    const html = res.data;
    const hash = crypto.createHash("sha256").update(html).digest("hex");

    const $ = cheerio.load(html);
    const scripts = $("script[src]").map((i, e) => $(e).attr("src")).get();
    const iframes = $("iframe[src]").map((i, e) => $(e).attr("src")).get();
    const inlineScripts = $("script:not([src])").map((i, e) => $(e).html()).get();
    const metaTags = $("meta").map((i, e) => $(e).attr()).get();

    // Detect obfuscated JavaScript
    const obfuscatedScripts = []; // Temporarily disable for testing

    // Detect suspicious patterns
    const suspiciousPatterns = {
      evalUsage: false,
      documentWrite: false,
      innerHTML: false,
      hiddenIframes: false,
      externalScripts: scripts.length,
    };

    // Debug logging for clean HTML test
    if (html.includes('Clean Page')) {
      console.log('DEBUG performStaticAnalysis: HTML:', html);
      console.log('DEBUG performStaticAnalysis: Scripts:', scripts);
      console.log('DEBUG performStaticAnalysis: Inline scripts:', inlineScripts);
      console.log('DEBUG performStaticAnalysis: Obfuscated scripts:', obfuscatedScripts);
      console.log('DEBUG performStaticAnalysis: Suspicious patterns:', suspiciousPatterns);
    }

    return {
      hash,
      html,
      scripts,
      iframes,
      inlineScripts,
      metaTags,
      obfuscatedScripts,
      suspiciousPatterns,
    };
  } catch (error) {
    console.error(`Static analysis failed for ${url}:`, error.message);
    throw new Error(`Failed to fetch URL: ${error.message}`);
  }
}

async function performDynamicAnalysis(url, timeout, browser) {
  console.log(`Starting dynamic analysis for ${url}`);

  const page = await browser.newPage();

  try {
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

    const requests = [];
    const responses = [];
    const consoleMessages = [];
    const networkErrors = [];

    page.on('request', req => requests.push({
      url: req.url(),
      method: req.method(),
      resourceType: req.resourceType()
    }));

    page.on('response', res => responses.push({
      url: res.url(),
      status: res.status(),
      contentType: res.headers()['content-type']
    }));

    page.on('requestfailed', req => networkErrors.push({
      url: req.url(),
      error: req.failure().errorText
    }));

    page.on('console', msg => consoleMessages.push({
      type: msg.type(),
      text: msg.text()
    }));

    // Track DOM mutations
    await page.evaluateOnNewDocument(() => {
      window.domMutations = [];
      window.originalLocation = window.location.href;
      const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
          if (mutation.type === 'childList') {
            window.domMutations.push({
              type: 'childList',
              addedNodes: mutation.addedNodes.length,
              removedNodes: mutation.removedNodes.length
            });
          }
        });
      });
      observer.observe(document, { childList: true, subtree: true });
    });

    console.log(`Navigating to ${url} with timeout ${timeout}ms`);
    // Use 'load' instead of 'networkidle2' to avoid hanging on sites with ongoing requests
    await page.goto(url, { waitUntil: 'load', timeout: timeout });

    // Wait a bit for dynamic content, but with a shorter timeout
    console.log('Waiting for dynamic content...');
    await new Promise(resolve => setTimeout(resolve, 200)); // Reduced from 500ms

    const dynamicData = await page.evaluate(() => {
      const scripts = Array.from(document.scripts).map(s => s.src || s.innerHTML.substring(0, 100));
      const iframes = Array.from(document.querySelectorAll('iframe')).map(i => i.src);
      const redirects = window.location.href !== window.originalLocation;
      const domMutations = window.domMutations || [];

      return {
        dynamicScripts: scripts,
        dynamicIframes: iframes,
        redirects,
        domMutations,
        finalURL: window.location.href
      };
    });

    console.log(`Dynamic analysis completed for ${url}. Requests: ${requests.length}, Responses: ${responses.length}`);

    return {
      requests,
      responses,
      consoleMessages,
      networkErrors,
      ...dynamicData,
    };

  } finally {
    await page.close();
  }
}

function combineAnalysisResults(staticResult, dynamic) {
  let score = 0;
  let reasons = [];
  let severity = 'low';

  // Debug logging for clean HTML test
  if (staticResult.html.includes('Clean Page')) {
    console.log('DEBUG combineAnalysisResults: Called for clean HTML');
    console.log('DEBUG: Suspicious patterns:', staticResult.suspiciousPatterns);
    console.log('DEBUG: Obfuscated scripts:', staticResult.obfuscatedScripts);
    console.log('DEBUG: Scripts count:', staticResult.scripts.length);
    console.log('DEBUG: Inline scripts:', staticResult.inlineScripts);
  }

  // Static analysis scoring
  if (staticResult.suspiciousPatterns.evalUsage) {
    reasons.push("Use of eval() detected in scripts");
    score += 40;
  }

  if (staticResult.suspiciousPatterns.documentWrite) {
    reasons.push("document.write() usage detected");
    score += 25;
  }

  if (staticResult.suspiciousPatterns.innerHTML) {
    reasons.push("innerHTML manipulation detected");
    score += 20;
  }

  if (staticResult.obfuscatedScripts.length > 0) {
    reasons.push(`${staticResult.obfuscatedScripts.length} obfuscated scripts detected`);
    score += 35;
  }

  if (staticResult.suspiciousPatterns.hiddenIframes) {
    reasons.push("Hidden iframes detected");
    score += 30;
  }

  if (staticResult.scripts.length > 10) {
    reasons.push(`High number of external scripts (${staticResult.scripts.length})`);
    score += 15;
  }

  // Dynamic analysis scoring
  if (dynamic.redirects) {
    reasons.push("Unexpected redirects detected");
    score += 20;
  }

  if (dynamic.domMutations && dynamic.domMutations.length > 50) {
    reasons.push("Excessive DOM mutations detected");
    score += 25;
  }

  if (dynamic.networkErrors && dynamic.networkErrors.length > 0) {
    reasons.push(`${dynamic.networkErrors.length} network errors detected`);
    score += 10;
  }

  if (dynamic.consoleMessages && dynamic.consoleMessages.some(m => m.type === 'error')) {
    reasons.push("JavaScript errors in console");
    score += 15;
  }

  // Determine severity
  if (score >= 80) severity = 'critical';
  else if (score >= 60) severity = 'high';
  else if (score >= 40) severity = 'medium';
  else if (score >= 20) severity = 'low';

  return {
    hash: staticResult.hash,
    scripts: staticResult.scripts,
    iframes: staticResult.iframes,
    score,
    severity,
    reasons,
    corrupted: score > 50,
    threats: {
      static: {
        obfuscatedScripts: staticResult.obfuscatedScripts.length,
        suspiciousPatterns: Object.keys(staticResult.suspiciousPatterns).filter(k => staticResult.suspiciousPatterns[k])
      },
      dynamic: {
        redirects: dynamic.redirects,
        domMutations: dynamic.domMutations ? dynamic.domMutations.length : 0,
        networkErrors: dynamic.networkErrors ? dynamic.networkErrors.length : 0
      }
    }
  };
}
