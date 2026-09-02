export {};
import { createRateLimiter, sweepExpiredEntries } from './rateLimit';

function assert(condition: boolean, message: string) {
    if (!condition) {
        throw new Error(`Test Failed: ${message}`);
    }
}

console.log('--- Running Rate Limiter & Memory Sweep Unit Tests ---');

// Setup mock request and response
let statusCode: number | null = null;
let jsonBody: any = null;
let callCount = 0;

const resetMock = () => {
    statusCode = null;
    jsonBody = null;
    callCount = 0;
};

const mockRes: any = {
    status: (code: number) => {
        statusCode = code;
        return {
            json: (body: any) => {
                jsonBody = body;
            },
        };
    },
};

const next: any = () => {
    callCount++;
};

const limiter = createRateLimiter({
    namespace: 'test-auth',
    windowMs: 1000,
    maxAttempts: 2,
    blockMs: 2000,
    message: 'Rate limit exceeded',
    key: (req: any) => req.ip || '127.0.0.1',
});

// Test 1: First and second requests pass within limit
resetMock();
limiter({ ip: '1.2.3.4' } as any, mockRes, next);
assert(callCount === 1, 'First request must pass');

resetMock();
limiter({ ip: '1.2.3.4' } as any, mockRes, next);
assert(callCount === 1, 'Second request must pass (limit is 2)');
console.log('✓ Test 1 Passed: Requests within limit succeed');

// Test 2: Third request gets blocked with 429
resetMock();
limiter({ ip: '1.2.3.4' } as any, mockRes, next);
assert(callCount === 0, 'Third request must be blocked');
assert(statusCode === 429, `Status must be 429, got ${statusCode}`);
assert(jsonBody?.message === 'Rate limit exceeded', 'Error message matches');
console.log('✓ Test 2 Passed: Excess requests are blocked with HTTP 429');

// Test 3: Sweep expired entries
const futureTime = Date.now() + 5000;
const sweptCount = sweepExpiredEntries(futureTime);
assert(sweptCount >= 1, `Expired entries should be swept, got ${sweptCount}`);
console.log('✓ Test 3 Passed: Expired rate limiter entries are purged from memory');

console.log('--- All Rate Limiter Unit Tests Executed Successfully ---');
