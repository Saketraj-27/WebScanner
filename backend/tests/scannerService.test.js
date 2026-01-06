const scannerService = require('../services/scannerService');
const axios = require('axios');
const puppeteer = require('puppeteer');

// Mock external dependencies
jest.mock('axios');
jest.mock('puppeteer');

describe('Scanner Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear browser pool between tests
    const scannerService = require('../services/scannerService');
    // Reset the browser pool by accessing the module's internal state
    // This is a bit hacky but necessary for testing
    scannerService.browserPool = [];
  });

  describe('scan function', () => {
    const mockUrl = 'http://example.com';
    const mockHtml = `
      <html>
        <head>
          <script src="http://external-script.com/script.js"></script>
          <script>eval('alert("test")');</script>
          <meta name="description" content="Test page">
        </head>
        <body>
          <iframe src="http://iframe.com"></iframe>
          <div id="content">Test content</div>
        </body>
      </html>
    `;

    beforeEach(() => {
      axios.get.mockResolvedValue({ data: mockHtml });
    });

    it('should perform static analysis and return results', async () => {
      const result = await scannerService(mockUrl, { useBrowser: false });

      expect(result).toHaveProperty('staticAnalysis');
      expect(result).toHaveProperty('dynamicAnalysis');
      expect(result.staticAnalysis).toHaveProperty('hash');
      expect(result.staticAnalysis.scripts).toContain('http://external-script.com/script.js');
      expect(result.staticAnalysis.inlineScripts).toContain('eval(\'alert("test")\');');
      expect(result.staticAnalysis.iframes).toContain('http://iframe.com');
      expect(result.staticAnalysis.suspiciousPatterns.evalUsage).toBe(true);
    });

    it('should perform dynamic analysis when useBrowser is true', async () => {
      const mockBrowser = {
        newPage: jest.fn().mockResolvedValue({
          setUserAgent: jest.fn(),
          on: jest.fn(),
          evaluateOnNewDocument: jest.fn(),
          goto: jest.fn(),
          waitForTimeout: jest.fn(),
          evaluate: jest.fn().mockResolvedValue({
            dynamicScripts: [],
            dynamicIframes: [],
            redirects: false,
            domMutations: [],
            finalURL: mockUrl
          }),
          close: jest.fn()
        }),
        close: jest.fn()
      };

      puppeteer.launch.mockResolvedValue(mockBrowser);

      const result = await scannerService(mockUrl, { useBrowser: true });

      expect(puppeteer.launch).toHaveBeenCalled();
      expect(result).toHaveProperty('dynamicAnalysis');
      expect(result.dynamicAnalysis).toHaveProperty('requests');
      expect(result.dynamicAnalysis).toHaveProperty('responses');
    });

    it('should handle dynamic analysis errors gracefully', async () => {
      puppeteer.launch.mockRejectedValue(new Error('Browser launch failed'));

      const result = await scannerService(mockUrl, { useBrowser: true, skipCache: true });

      expect(result.dynamicAnalysis).toHaveProperty('browserErrors');
      expect(result.dynamicAnalysis.browserErrors).toContain('Browser launch failed');
    });

    it('should calculate risk score and severity correctly', async () => {
      const highRiskHtml = `
        <html>
          <script>eval('malicious code');</script>
          <script>document.write('injected');</script>
          <script>element.innerHTML = 'dangerous';</script>
          <iframe style="display: none;" src="hidden"></iframe>
          ${'<script src="external.js"></script>'.repeat(15)}
        </html>
      `;

      axios.get.mockResolvedValue({ data: highRiskHtml });

      const result = await scannerService(mockUrl, { useBrowser: false, skipCache: true });

      expect(result.score).toBeGreaterThan(50);
      expect(result.severity).toBe('critical');
      expect(result.corrupted).toBe(true);
      expect(result.reasons).toContain('Use of eval() detected in scripts');
      expect(result.reasons).toContain('document.write() usage detected');
      expect(result.reasons).toContain('innerHTML manipulation detected');
      expect(result.reasons).toContain('Hidden iframes detected');
      expect(result.reasons).toContain('High number of external scripts (15)');
    });

    it('should return low risk for clean HTML', async () => {
      const cleanHtml = `
        <html>
          <head><title>Clean Page</title></head>
          <body><h1>Hello World</h1></body>
        </html>
      `;

      axios.get.mockResolvedValue({ data: cleanHtml });

      const result = await scannerService(mockUrl, { useBrowser: false, skipCache: true });

      expect(result.score).toBe(0);
      expect(result.severity).toBe('low');
      expect(result.corrupted).toBe(false);
      expect(result.reasons).toHaveLength(0);
    });

    it('should respect timeout option', async () => {
      const mockPage = {
        setUserAgent: jest.fn(),
        on: jest.fn(),
        evaluateOnNewDocument: jest.fn(),
        goto: jest.fn(),
        waitForTimeout: jest.fn(),
        evaluate: jest.fn().mockResolvedValue({
          dynamicScripts: [],
          dynamicIframes: [],
          redirects: false,
          domMutations: [],
          finalURL: mockUrl
        }),
        close: jest.fn()
      };

      const mockBrowser = {
        newPage: jest.fn().mockResolvedValue(mockPage),
        close: jest.fn()
      };

      puppeteer.launch.mockResolvedValue(mockBrowser);

      await scannerService(mockUrl, { useBrowser: true, timeout: 5000, skipCache: true });

      expect(mockPage.goto).toHaveBeenCalledWith(mockUrl, { waitUntil: 'load', timeout: 5000 });
    });
  });
});
