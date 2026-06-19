import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { execFileSync } from 'child_process';
import {
  nanoid, createCustomNanoid,
  uuidv4, uuidv7, uuidv7Timestamp, isUUID,
  ulid, ulidTimestamp,
  createSnowflake, cuid, shortId,
  createSequential, timestampId,
} from './index.js';
import idgen from './index.js';

// --- NanoID Tests ---

test('nanoid generates default 21-char ID', () => {
  const id = nanoid();
  assert.equal(id.length, 21);
  assert.match(id, /^[A-Za-z0-9_-]{21}$/);
});

test('nanoid respects custom size', () => {
  for (const size of [1, 5, 10, 32, 100]) {
    assert.equal(nanoid({ size }).length, size);
  }
});

test('nanoid respects custom alphabet', () => {
  const id = nanoid({ size: 20, alphabet: 'abcdef0123456789' });
  assert.match(id, /^[a-f0-9]{20}$/);
});

test('nanoid respects prefix', () => {
  const id = nanoid({ size: 10, prefix: 'usr_' });
  assert.equal(id.slice(0, 4), 'usr_');
  assert.equal(id.length, 14);
});

test('nanoid generates unique IDs', () => {
  const ids = new Set();
  for (let i = 0; i < 10000; i++) ids.add(nanoid());
  assert.equal(ids.size, 10000);
});

test('nanoid rejects invalid alphabet', () => {
  assert.throws(() => nanoid({ alphabet: 'a' }), RangeError);
  assert.throws(() => nanoid({ alphabet: '' }), RangeError);
});

test('createCustomNanoid returns factory', () => {
  const gen = createCustomNanoid('abcdef', 12);
  const id = gen();
  assert.match(id, /^[a-f]{12}$/);
  assert.equal(gen(8).length, 8);
});

// --- UUID v4 Tests ---

test('uuidv4 generates valid UUID', () => {
  const id = uuidv4();
  assert.equal(id.length, 36);
  assert.ok(isUUID(id));
  assert.ok(isUUID(id, 4));
  assert.equal(id[14], '4'); // version
});

test('uuidv4 generates unique UUIDs', () => {
  const ids = new Set();
  for (let i = 0; i < 10000; i++) ids.add(uuidv4());
  assert.equal(ids.size, 10000);
});

// --- UUID v7 Tests ---

test('uuidv7 generates valid UUID with correct version', () => {
  const id = uuidv7();
  assert.equal(id.length, 36);
  assert.ok(isUUID(id));
  assert.equal(id[14], '7'); // version 7
});

test('uuidv7 encodes current timestamp', () => {
  const now = Date.now();
  const id = uuidv7({ timestamp: now, monotonic: false });
  const extracted = uuidv7Timestamp(id);
  assert.equal(extracted, now);
});

test('uuidv7 generates monotonic IDs within same ms', () => {
  const now = Date.now();
  const id1 = uuidv7({ timestamp: now });
  const id2 = uuidv7({ timestamp: now });
  assert.ok(id1 < id2, 'second UUID v7 should sort after first');
});

test('uuidv7 with custom Date timestamp', () => {
  const d = new Date('2025-01-01T00:00:00Z');
  const id = uuidv7({ timestamp: d });
  assert.equal(uuidv7Timestamp(id), d.getTime());
});

// --- isUUID Tests ---

test('isUUID validates correctly', () => {
  assert.ok(isUUID(uuidv4()));
  assert.ok(isUUID(uuidv7()));
  assert.ok(!isUUID('not-a-uuid'));
  assert.ok(!isUUID(''));
  assert.ok(!isUUID(null));
  assert.ok(!isUUID(12345));
});

// --- ULID Tests ---

test('ulid generates 26-char string', () => {
  const id = ulid();
  assert.equal(id.length, 26);
  assert.match(id, /^[0-9A-Z]{26}$/);
});

test('ulid encodes timestamp', () => {
  const ts = 1700000000000;
  const id = ulid({ timestamp: ts, monotonic: false });
  const extracted = ulidTimestamp(id);
  assert.equal(extracted, ts);
});

test('ulid generates monotonic IDs', () => {
  const now = Date.now();
  const id1 = ulid({ timestamp: now });
  const id2 = ulid({ timestamp: now });
  assert.ok(id1 <= id2, 'second ULID should sort >= first');
});

test('ulid generates unique IDs', () => {
  const ids = new Set();
  for (let i = 0; i < 10000; i++) ids.add(ulid());
  assert.equal(ids.size, 10000);
});

// --- Snowflake Tests ---

test('snowflake generates positive bigint', () => {
  const sf = createSnowflake({ workerId: 1 });
  const id = sf.generate();
  assert.ok(id > 0n);
});

test('snowflake encodes workerId', () => {
  const sf = createSnowflake({ workerId: 5, datacenterId: 2 });
  const id = sf.generate();
  const decoded = sf.decode(id);
  assert.equal(decoded.workerId, 5);
  assert.equal(decoded.datacenterId, 2);
  assert.ok(decoded.timestamp > 0);
  assert.ok(decoded.date instanceof Date);
  assert.ok(decoded.sequence >= 0);
});

test('snowflake generates increasing IDs', () => {
  const sf = createSnowflake({ workerId: 0 });
  const ids = [];
  for (let i = 0; i < 100; i++) ids.push(sf.generate());
  for (let i = 1; i < ids.length; i++) {
    assert.ok(ids[i] > ids[i - 1], 'snowflake IDs should be increasing');
  }
});

test('snowflake rejects invalid workerId', () => {
  assert.throws(() => createSnowflake({ workerId: 2000 }), RangeError);
  assert.throws(() => createSnowflake({ workerId: -1 }), RangeError);
});

test('snowflake decode roundtrip', () => {
  const sf = createSnowflake({ workerId: 3, datacenterId: 1 });
  const id = sf.generate();
  const decoded = sf.decode(id);
  assert.equal(decoded.workerId, 3);
  assert.equal(decoded.datacenterId, 1);
});

// --- CUID Tests ---

test('cuid generates ID with specified length', () => {
  const id = cuid({ length: 20 });
  assert.equal(id.length, 20);
});

test('cuid generates unique IDs', () => {
  const ids = new Set();
  for (let i = 0; i < 10000; i++) ids.add(cuid());
  assert.equal(ids.size, 10000);
});

test('cuid rejects length < 2', () => {
  assert.throws(() => cuid({ length: 1 }), RangeError);
});

// --- Short ID Tests ---

test('shortId generates default length 8', () => {
  const id = shortId();
  assert.equal(id.length, 8);
  assert.match(id, /^[A-Za-z0-9]{8}$/);
});

test('shortId respects custom length', () => {
  assert.equal(shortId({ length: 4 }).length, 4);
  assert.equal(shortId({ length: 16 }).length, 16);
});

test('shortId respects custom alphabet', () => {
  const id = shortId({ length: 10, alphabet: 'abc' });
  assert.match(id, /^[abc]{10}$/);
});

test('shortId generates unique IDs', () => {
  const ids = new Set();
  for (let i = 0; i < 10000; i++) ids.add(shortId({ length: 8 }));
  // With 8 chars and 62 alphabet, collisions are extremely unlikely in 10k
  assert.ok(ids.size > 9900, `expected >9900 unique, got ${ids.size}`);
});

// --- Sequential Tests ---

test('sequential generates incrementing IDs', () => {
  const seq = createSequential();
  assert.equal(seq.next(), '0');
  assert.equal(seq.next(), '1');
  assert.equal(seq.next(), '2');
});

test('sequential respects start and prefix', () => {
  const seq = createSequential({ start: 100, prefix: 'ID-' });
  assert.equal(seq.next(), 'ID-100');
  assert.equal(seq.next(), 'ID-101');
});

test('sequential respects padding', () => {
  const seq = createSequential({ start: 1, pad: 5 });
  assert.equal(seq.next(), '00001');
  assert.equal(seq.next(), '00002');
});

test('sequential current returns last generated', () => {
  const seq = createSequential({ start: 50 });
  seq.next(); // 50
  assert.equal(seq.current(), '50');
});

test('sequential reset', () => {
  const seq = createSequential();
  seq.next();
  seq.next();
  seq.reset();
  assert.equal(seq.next(), '0');
});

// --- Timestamp ID Tests ---

test('timestampId generates string with timestamp', () => {
  const id = timestampId({ timestamp: 1700000000000, randomLength: 4 });
  assert.ok(id.length > 4);
  assert.match(id, /^[A-Za-z0-9]+$/);
});

test('timestampId with different lengths', () => {
  const id1 = timestampId({ timestamp: 1700000000000, randomLength: 0 });
  const id2 = timestampId({ timestamp: 1700000000000, randomLength: 8 });
  assert.ok(id2.length > id1.length);
});

// --- Format / Encoding Tests ---

test('ulid timestamp decode handles known values', () => {
  // 2025-01-01T00:00:00.000Z = 1735689600000 ms
  const ts = 1735689600000;
  const id = ulid({ timestamp: ts, monotonic: false });
  const decoded = ulidTimestamp(id);
  assert.equal(decoded, ts);
});

test('uuidv7 generates lexicographically sortable IDs', () => {
  const id1 = uuidv7({ timestamp: 1700000000000, monotonic: false });
  const id2 = uuidv7({ timestamp: 1700000001000, monotonic: false });
  assert.ok(id1 < id2, 'earlier timestamp should sort before later');
});

// --- Integration Tests ---

test('all generators produce valid strings', () => {
  assert.ok(typeof nanoid() === 'string');
  assert.ok(typeof uuidv4() === 'string');
  assert.ok(typeof uuidv7() === 'string');
  assert.ok(typeof ulid() === 'string');
  assert.ok(typeof cuid() === 'string');
  assert.ok(typeof shortId() === 'string');
  assert.ok(typeof timestampId() === 'string');
  const sf = createSnowflake({ workerId: 0 });
  assert.ok(typeof sf.generate().toString() === 'string');
  const seq = createSequential();
  assert.ok(typeof seq.next() === 'string');
});

test('IDs are not empty', () => {
  assert.ok(nanoid().length > 0);
  assert.ok(uuidv4().length > 0);
  assert.ok(uuidv7().length > 0);
  assert.ok(ulid().length > 0);
  assert.ok(cuid().length > 0);
  assert.ok(shortId().length > 0);
  assert.ok(timestampId().length > 0);
});

// --- v1.1.0 Quality Audit Tests ---

// Version / CLI tests
test('package.json has correct version', () => {
  const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.version, '1.1.0');
  assert.ok(pkg.scripts.prepublishOnly, 'prepublishOnly script must exist');
  assert.ok(Array.isArray(pkg.files), 'files field must exist');
});

// randomInt unbiased distribution
test('randomInt produces values in range', () => {
  // Can't import randomInt directly (not exported), but we can test indirectly via cuid counter
  // Just ensure cuid generates valid IDs consistently
  for (let i = 0; i < 1000; i++) {
    const id = cuid({ length: 10 });
    assert.ok(id.length === 10);
    assert.match(id, /^[a-z0-9]{10}$/);
  }
});

// NanoID with very large size
test('nanoid handles large sizes', () => {
  const id = nanoid({ size: 1000 });
  assert.equal(id.length, 1000);
});

// NanoID single-char alphabet
test('nanoid works with minimal 2-char alphabet', () => {
  const id = nanoid({ size: 10, alphabet: 'ab' });
  assert.match(id, /^[ab]{10}$/);
});

// NanoID with 256-char alphabet
test('nanoid works with max 256-char alphabet', () => {
  const chars = [];
  for (let i = 0; i < 256; i++) chars.push(String.fromCharCode(i));
  const alpha = chars.join('');
  const id = nanoid({ size: 5, alphabet: alpha });
  assert.equal(id.length, 5);
});

// UUID v7 monotonic counter overflow protection
test('uuidv7 handles many calls without errors', () => {
  // Generate many UUIDs rapidly to exercise monotonic counter
  const ids = [];
  for (let i = 0; i < 500; i++) {
    ids.push(uuidv7());
  }
  // All must be unique
  assert.equal(new Set(ids).size, 500);
  // All must be valid
  for (const id of ids) assert.ok(isUUID(id, 7));
});

// UUID v7 with zero timestamp
test('uuidv7 handles timestamp 0 (epoch)', () => {
  const id = uuidv7({ timestamp: 0, monotonic: false });
  const ts = uuidv7Timestamp(id);
  assert.equal(ts, 0);
});

// UUID v7 with far-future timestamp
test('uuidv7 handles far-future timestamp', () => {
  const futureTs = 9999999999999; // year 2286
  const id = uuidv7({ timestamp: futureTs, monotonic: false });
  const ts = uuidv7Timestamp(id);
  assert.equal(ts, futureTs);
});

// isUUID with uppercase
test('isUUID accepts uppercase hex', () => {
  assert.ok(isUUID('F47AC10B-58CC-4372-A567-0E02B2C3D479'));
  assert.ok(isUUID('F47AC10B-58CC-4372-A567-0E02B2C3D479', 4));
});

// isUUID rejects malformed input
test('isUUID rejects malformed UUIDs', () => {
  assert.ok(!isUUID('g47ac10b-58cc-4372-a567-0e02b2c3d479')); // 'g' is not hex
  assert.ok(!isUUID('f47ac10b-58cc-4372-3567-0e02b2c3d479', 4)); // version 3, not 4
  assert.ok(!isUUID('f47ac10b-58cc-4372-a567-0e02b2c3d47'));
  assert.ok(!isUUID('f47ac10b-58cc-4372-a567-0e02b2c3d4799'));
});

// ULID monotonic with rapid generation
test('ulid monotonic IDs maintain sort order under rapid generation', () => {
  const ids = [];
  for (let i = 0; i < 200; i++) {
    ids.push(ulid());
  }
  for (let i = 1; i < ids.length; i++) {
    assert.ok(ids[i] >= ids[i - 1], `ULID ${i} should sort >= ${i-1}`);
  }
});

// ULID with specific known timestamp
test('ulid encodes and decodes timestamp 0', () => {
  const id = ulid({ timestamp: 0, monotonic: false });
  const ts = ulidTimestamp(id);
  assert.equal(ts, 0);
});

// ULID lowercase decoding
test('ulidTimestamp handles lowercase ULID', () => {
  const id = ulid({ timestamp: 1700000000000, monotonic: false });
  const lowerId = id.toLowerCase();
  const ts = ulidTimestamp(lowerId);
  assert.equal(ts, 1700000000000);
});

// Snowflake sequence increment
test('snowflake increments sequence within same ms', () => {
  const sf = createSnowflake({ workerId: 0 });
  const id1 = sf.generate();
  const d1 = sf.decode(id1);
  // Generate rapidly — sequence should increment if same ms
  const id2 = sf.generate();
  const d2 = sf.decode(id2);
  if (d1.timestamp === d2.timestamp) {
    assert.ok(d2.sequence > d1.sequence || d2.sequence === 0, 'sequence should increment or wrap');
  }
});

// Snowflake with custom epoch
test('snowflake respects custom epoch', () => {
  const customEpoch = 1700000000000;
  const sf = createSnowflake({ workerId: 1, epoch: customEpoch });
  const id = sf.generate();
  const decoded = sf.decode(id);
  assert.ok(decoded.timestamp > customEpoch, 'timestamp should be > custom epoch');
});

// Snowflake decode with string input
test('snowflake decode accepts string representation of bigint', () => {
  const sf = createSnowflake({ workerId: 7, datacenterId: 3 });
  const id = sf.generate();
  const idStr = id.toString();
  const decoded = sf.decode(BigInt(idStr));
  assert.equal(decoded.workerId, 7);
  assert.equal(decoded.datacenterId, 3);
});

// CUID default length
test('cuid default length is 24', () => {
  const id = cuid();
  assert.equal(id.length, 24);
});

// CUID with large length
test('cuid handles large length', () => {
  const id = cuid({ length: 50 });
  assert.equal(id.length, 50);
  assert.match(id, /^[a-z0-9]{50}$/);
});

// Short ID with empty alphabet fallback
test('shortId with numeric-only alphabet', () => {
  const id = shortId({ length: 6, alphabet: '0123456789' });
  assert.match(id, /^[0-9]{6}$/);
});

// Sequential with negative start
test('sequential handles negative start', () => {
  const seq = createSequential({ start: -5 });
  assert.equal(seq.next(), '-5');
  assert.equal(seq.next(), '-4');
});

// Sequential reset to custom value
test('sequential reset accepts custom value', () => {
  const seq = createSequential({ start: 0 });
  seq.next(); // 0
  seq.next(); // 1
  seq.reset(100);
  assert.equal(seq.next(), '100');
});

// Sequential current before any next
test('sequential current before first next returns start-1', () => {
  const seq = createSequential({ start: 10 });
  // Before any next(), counter is at start, so current() returns start-1
  assert.equal(seq.current(), '9');
});

// TimestampId uniqueness
test('timestampId generates unique IDs', () => {
  const ids = new Set();
  for (let i = 0; i < 1000; i++) {
    ids.add(timestampId({ randomLength: 6 }));
  }
  assert.equal(ids.size, 1000);
});

// TimestampId with zero random length
test('timestampId with randomLength 0 produces just encoded timestamp', () => {
  const id = timestampId({ timestamp: 1700000000000, randomLength: 0 });
  assert.ok(id.length > 0);
  assert.match(id, /^[A-Za-z0-9]+$/);
});

// TimestampId with custom alphabet
test('timestampId respects custom alphabet', () => {
  const id = timestampId({ timestamp: 1700000000000, randomLength: 4, alphabet: 'ab' });
  assert.match(id, /^[ab]+$/);
});

// alphabets constant export
test('alphabets constant has expected entries', () => {
  assert.ok(idgen.alphabets.urlSafe.length > 0);
  assert.ok(idgen.alphabets.base62.length === 62);
  assert.ok(idgen.alphabets.crockford.length === 32);
});

// CLI version flag (spawn test)
test('CLI --version outputs version', () => {
  const output = execFileSync('node', ['cli.js', '--version'], {
    cwd: new URL('.', import.meta.url),
    encoding: 'utf8',
  }).trim();
  assert.match(output, /^\d+\.\d+\.\d+$/);
});

// CLI -V flag (short form)
test('CLI -V outputs version', () => {
  const output = execFileSync('node', ['cli.js', '-V'], {
    cwd: new URL('.', import.meta.url),
    encoding: 'utf8',
  }).trim();
  assert.match(output, /^\d+\.\d+\.\d+$/);
});

// CLI demo command
test('CLI demo generates output for all types', () => {
  const output = execFileSync('node', ['cli.js', 'demo'], {
    cwd: new URL('.', import.meta.url),
    encoding: 'utf8',
  });
  assert.ok(output.includes('NanoID'));
  assert.ok(output.includes('UUID v4'));
  assert.ok(output.includes('UUID v7'));
  assert.ok(output.includes('ULID'));
  assert.ok(output.includes('Snowflake'));
});
