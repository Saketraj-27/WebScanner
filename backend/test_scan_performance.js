const scannerService = require('./services/scannerService');

async function testScanPerformance() {
  const testUrl = 'https://httpbin.org/html';

  console.log(`Testing scan performance for: ${testUrl}`);
  console.log('Starting scan...');

  const startTime = Date.now();

  try {
    const result = await scannerService(testUrl, { useBrowser: true, timeout: 15000 });

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    console.log(`\n✅ Scan completed successfully in ${duration.toFixed(2)} seconds`);
    console.log(`Score: ${result.score}`);
    console.log(`Severity: ${result.severity}`);
    console.log(`Threats found: ${result.reasons.length}`);

    if (result.reasons.length > 0) {
      console.log('\nThreats detected:');
      result.reasons.forEach((reason, index) => {
        console.log(`  ${index + 1}. ${reason}`);
      });
    }

    console.log(`\nStatic analysis: ${result.staticAnalysis.scripts.length} scripts, ${result.staticAnalysis.iframes.length} iframes`);
    console.log(`Dynamic analysis: ${result.dynamicAnalysis.requests?.length || 0} requests tracked`);

  } catch (error) {
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    console.log(`\n❌ Scan failed after ${duration.toFixed(2)} seconds`);
    console.error('Error:', error.message);
  }
}

testScanPerformance().then(() => {
  console.log('\nTest completed.');
  process.exit(0);
}).catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
