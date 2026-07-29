import { isAllowedTargetUrl } from './urlValidator';

function assert(condition: boolean, message: string) {
    if (!condition) {
        throw new Error(`Test Failed: ${message}`);
    }
}

console.log('--- Running SSRF & URL Validator Unit Tests ---');

// Test 1: Valid allowlisted domain (Twelve Data)
try {
    const res = isAllowedTargetUrl('https://api.twelvedata.com/price?symbol=AAPL');
    assert(res.allowed === true, 'Allowlisted domain api.twelvedata.com should be permitted');
    console.log('✓ Test 1 Passed: Allowlisted domain permitted');
} catch (e: any) {
    console.error('✕ Test 1 Failed:', e.message);
}

// Test 2: Valid allowlisted domain (Google Gemini AI)
try {
    const res = isAllowedTargetUrl('https://generativelanguage.googleapis.com/v1beta/models');
    assert(res.allowed === true, 'Allowlisted domain generativelanguage.googleapis.com should be permitted');
    console.log('✓ Test 2 Passed: Google Gemini AI domain permitted');
} catch (e: any) {
    console.error('✕ Test 2 Failed:', e.message);
}

// Test 3: SSRF Attack Vector - AWS Metadata API (169.254.169.254)
try {
    const res = isAllowedTargetUrl('http://169.254.169.254/latest/meta-data/');
    assert(res.allowed === false, 'AWS Metadata IP (169.254.169.254) must be blocked');
    assert(res.reason?.includes('internal network') === true, 'Reason should mention internal network');
    console.log('✓ Test 3 Passed: AWS Metadata IP blocked');
} catch (e: any) {
    console.error('✕ Test 3 Failed:', e.message);
}

// Test 4: SSRF Attack Vector - Loopback / Localhost (127.0.0.1)
try {
    const res = isAllowedTargetUrl('http://127.0.0.1:3000/api/admin');
    assert(res.allowed === false, 'Loopback IP 127.0.0.1 must be blocked');
    console.log('✓ Test 4 Passed: Loopback 127.0.0.1 blocked');
} catch (e: any) {
    console.error('✕ Test 4 Failed:', e.message);
}

// Test 5: SSRF Attack Vector - Internal IP 10.x.x.x
try {
    const res = isAllowedTargetUrl('http://10.0.0.1/secret');
    assert(res.allowed === false, 'Private IP 10.0.0.1 must be blocked');
    console.log('✓ Test 5 Passed: Private IP 10.0.0.1 blocked');
} catch (e: any) {
    console.error('✕ Test 5 Failed:', e.message);
}

// Test 6: Non-allowlisted external domain
try {
    const res = isAllowedTargetUrl('https://malicious-external-site.com/steal-data');
    assert(res.allowed === false, 'Non-allowlisted external domain must be blocked');
    assert(res.reason?.includes('allowlist') === true, 'Reason should mention allowlist');
    console.log('✓ Test 6 Passed: Non-allowlisted domain blocked');
} catch (e: any) {
    console.error('✕ Test 6 Failed:', e.message);
}

// Test 8: Wildcard ALLOWED_PROXY_DOMAINS='*' allows external sites while still blocking 169.254.169.254
try {
    process.env.ALLOWED_PROXY_DOMAINS = '*';
    const extRes = isAllowedTargetUrl('https://custom-stock-site.com/price');
    assert(extRes.allowed === true, 'Wildcard allowlist permits external stock site');
    const metadataRes = isAllowedTargetUrl('http://169.254.169.254/latest');
    assert(metadataRes.allowed === false, 'Wildcard allowlist STILL blocks AWS metadata IP');
    delete process.env.ALLOWED_PROXY_DOMAINS;
    console.log('✓ Test 8 Passed: Wildcard allowlist permits external domains but blocks internal IPs');
} catch (e: any) {
    console.error('✕ Test 8 Failed:', e.message);
}

console.log('--- All SSRF Unit Tests Executed Successfully ---');
