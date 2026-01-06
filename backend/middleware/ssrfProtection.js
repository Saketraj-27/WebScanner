const dns = require('dns').promises;
const { URL } = require('url');

/**
 * SSRF (Server-Side Request Forgery) Protection Middleware
 * Prevents malicious requests to internal services and localhost
 */

// List of blocked hostnames and IP ranges
const BLOCKED_HOSTNAMES = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '169.254.169.254', // AWS metadata service
  'metadata.google.internal', // GCP metadata service
  'metadata.azure.com', // Azure metadata service
];

const BLOCKED_IP_RANGES = [
  '127.0.0.0/8',     // Loopback
  '10.0.0.0/8',      // Private network
  '172.16.0.0/12',   // Private network
  '192.168.0.0/16',  // Private network
  '169.254.0.0/16',  // Link-local
  '0.0.0.0/8',       // This network
  '224.0.0.0/4',     // Multicast
  '240.0.0.0/4',     // Reserved
];

/**
 * Check if an IP address is in a blocked range
 */
function isBlockedIP(ip) {
  const ipNum = ipToNumber(ip);

  for (const range of BLOCKED_IP_RANGES) {
    const [rangeIP, subnet] = range.split('/');
    const rangeNum = ipToNumber(rangeIP);
    const mask = -1 << (32 - parseInt(subnet));

    if ((ipNum & mask) === (rangeNum & mask)) {
      return true;
    }
  }

  return false;
}

/**
 * Convert IP address to number for range checking
 */
function ipToNumber(ip) {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
}

/**
 * Resolve hostname to IP addresses and check if any are blocked
 */
async function resolveAndCheckHostname(hostname) {
  try {
    // Skip DNS resolution for IP addresses
    if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
      return isBlockedIP(hostname);
    }

    // Check against blocked hostnames
    if (BLOCKED_HOSTNAMES.includes(hostname.toLowerCase())) {
      return true;
    }

    // Resolve hostname to IP addresses with timeout
    const dnsPromise = dns.lookup(hostname, { all: true });
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('DNS resolution timeout')), 5000)
    );

    const addresses = await Promise.race([dnsPromise, timeoutPromise]);

    // Check each resolved IP
    for (const address of addresses) {
      if (isBlockedIP(address.address)) {
        return true;
      }
    }

    return false;
  } catch (error) {
    // If DNS resolution fails or times out, err on the side of caution
    console.warn(`DNS resolution failed for ${hostname}:`, error.message);
    return true;
  }
}

/**
 * Validate URL for SSRF protection
 */
async function validateUrl(urlString) {
  try {
    const url = new URL(urlString);

    // Only allow HTTP and HTTPS protocols
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error(`Protocol ${url.protocol} is not allowed`);
    }

    // Check hostname/IP
    const isBlocked = await resolveAndCheckHostname(url.hostname);
    if (isBlocked) {
      throw new Error(`Access to ${url.hostname} is blocked for security reasons`);
    }

    return true;
  } catch (error) {
    if (error.message.includes('blocked') || error.message.includes('not allowed')) {
      throw error;
    }
    throw new Error(`Invalid URL: ${error.message}`);
  }
}

/**
 * Express middleware for SSRF protection
 */
function ssrfProtection(options = {}) {
  const {
    urlParam = 'url',
    bodyParam = 'url',
    queryParam = 'url',
    customValidator = null,
  } = options;

  return async (req, res, next) => {
    try {
      let urlsToCheck = [];

      // Check URL parameter in route
      if (req.params[urlParam]) {
        urlsToCheck.push(req.params[urlParam]);
      }

      // Check body parameter
      if (req.body && req.body[bodyParam]) {
        urlsToCheck.push(req.body[bodyParam]);
      }

      // Check query parameter
      if (req.query[queryParam]) {
        urlsToCheck.push(req.query[queryParam]);
      }

      // Check for URLs in arrays (e.g., batch operations)
      if (req.body && Array.isArray(req.body.urls)) {
        urlsToCheck.push(...req.body.urls);
      }

      // Validate all found URLs
      for (const url of urlsToCheck) {
        if (url) {
          if (customValidator) {
            await customValidator(url);
          } else {
            await validateUrl(url);
          }
        }
      }

      next();
    } catch (error) {
      console.error('SSRF Protection:', error.message);
      res.status(400).json({
        error: 'Invalid request: Access to this resource is blocked for security reasons',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  };
}

/**
 * Utility function to check URL safety (can be used outside middleware)
 */
async function isUrlSafe(urlString) {
  try {
    await validateUrl(urlString);
    return true;
  } catch (error) {
    return false;
  }
}

module.exports = {
  ssrfProtection,
  validateUrl,
  isUrlSafe,
  isBlockedIP,
  resolveAndCheckHostname,
};
