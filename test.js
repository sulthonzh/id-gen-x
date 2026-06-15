import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  nanoid, createCustomNanoid,
  uuidv4, uuidv7, uuidv7Timestamp, isUUID,
  ulid, ulidTimestamp,
  createSnowflake, cuid, shortId,
  createSequential, timestampId,
} from './index.js';

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
