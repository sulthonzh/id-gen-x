'use strict';

// ============================================================================
// id-gen-x: Zero-dependency ID generation library
// NanoID | UUID v4/v7 | ULID | Snowflake | CUID | Shortcodes | Custom radix
// ============================================================================

// --- Crypto-safe random ---

let _crypto;
function getCrypto() {
  if (!_crypto) {
    _crypto = globalThis.crypto?.webcrypto ?? globalThis.crypto ?? null;
  }
  return _crypto;
}

function randomBytes(length) {
  const crypto = getCrypto();
  if (crypto && typeof crypto.getRandomValues === 'function') {
    return crypto.getRandomValues(new Uint8Array(length));
  }
  // Fallback to Math.random (not cryptographically secure)
  const arr = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    arr[i] = Math.floor(Math.random() * 256);
  }
  return arr;
}

function randomInt(max) {
  // Unbiased random integer in [0, max) using rejection sampling
  // Avoids modulo bias that `val % max` introduces when max doesn't divide 2^32 evenly
  const limit = Math.floor(0xFFFFFFFF / max) * max;
  let val;
  do {
    const bytes = randomBytes(4);
    val = (bytes[0] << 24 | bytes[1] << 16 | bytes[2] << 8 | bytes[3]) >>> 0;
  } while (val >= limit);
  return val % max;
}

// --- Base32 Crockford encoding (for ULID) ---

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function encodeCrockford(value, length) {
  let str = '';
  let v = BigInt(value);
  const base = BigInt(32);
  while (v > 0n) {
    str = CROCKFORD[Number(v % base)] + str;
    v = v / base;
  }
  while (str.length < length) {
    str = '0' + str;
  }
  return str.slice(0, length);
}

// --- Base36 encoding (for CUID and shortcodes) ---

function toBase36(num) {
  if (typeof num === 'bigint') {
    let str = '';
    const base = 36n;
    while (num > 0n) {
      const d = Number(num % base);
      str = (d < 10 ? String.fromCharCode(48 + d) : String.fromCharCode(97 + d - 10)) + str;
      num = num / base;
    }
    return str || '0';
  }
  return num.toString(36);
}

function fromBase36(str) {
  return parseInt(str, 36);
}

// --- Base62 encoding (for NanoID custom and shortcodes) ---

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

function encodeBase62(num) {
  if (num === 0) return '0';
  let str = '';
  while (num > 0) {
    str = BASE62[num % 62] + str;
    num = Math.floor(num / 62);
  }
  return str;
}

// ============================================================================
// NanoID — URL-safe, compact, customizable
// ============================================================================

const NANO_URLSAFE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
const NANO_DEFAULT = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Generate a NanoID.
 * @param {Object} [opts]
 * @param {number} [opts.size=21] - ID length
 * @param {string} [opts.alphabet] - Custom alphabet (must be ≤ 256 chars)
 * @param {string} [opts.prefix] - Optional prefix
 * @returns {string}
 */
function nanoid(opts = {}) {
  const { size = 21, alphabet = NANO_URLSAFE, prefix = '' } = opts;
  if (alphabet.length < 2 || alphabet.length > 256) {
    throw new RangeError('alphabet must contain 2–256 characters');
  }
  const mask = (2 << Math.floor(Math.log2(alphabet.length - 1))) - 1;
  const step = Math.ceil((1.6 * mask * size) / alphabet.length);
  let id = '';
  while (id.length < size) {
    const bytes = randomBytes(step);
    for (let i = 0; i < step && id.length < size; i++) {
      const idx = bytes[i] & mask;
      if (idx < alphabet.length) {
        id += alphabet[idx];
      }
    }
  }
  return prefix + id;
}

/** Custom alphabet NanoID factory */
function createCustomNanoid(alphabet, defaultSize = 21) {
  if (!alphabet || alphabet.length < 2) {
    throw new RangeError('alphabet must have at least 2 characters');
  }
  return (size = defaultSize) => nanoid({ size, alphabet });
}

// ============================================================================
// UUID v4 & v7
// ============================================================================

/**
 * Generate RFC 4122 v4 UUID.
 * @returns {string}
 */
function uuidv4() {
  const b = randomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40; // version 4
  b[8] = (b[8] & 0x3f) | 0x80; // variant 10
  const h = [];
  for (let i = 0; i < 16; i++) h.push(b[i].toString(16).padStart(2, '0'));
  return `${h[0]}${h[1]}${h[2]}${h[3]}-${h[4]}${h[5]}-${h[6]}${h[7]}-${h[8]}${h[9]}-${h[10]}${h[11]}${h[12]}${h[13]}${h[14]}${h[15]}`;
}

// UUID v7 state for monotonic generation
let _v7LastMs = 0;
let _v7Counter = 0;

/**
 * Generate RFC 9562 v7 UUID (timestamp-ordered).
 * @param {Object} [opts]
 * @param {number|Date} [opts.timestamp] - Custom timestamp (ms since epoch)
 * @param {boolean} [opts.monotonic=true] - Ensure monotonic ordering within same ms
 * @returns {string}
 */
function uuidv7(opts = {}) {
  const { timestamp, monotonic = true } = opts;
  const hasExplicitTs = timestamp !== undefined;
  let ms = timestamp instanceof Date ? timestamp.getTime() : (typeof timestamp === 'number' ? timestamp : Date.now());

  if (monotonic) {
    if (hasExplicitTs) {
      // For explicit timestamps, ensure correct counter behavior
      if (ms < _v7LastMs) {
        _v7Counter = 0;
      } else if (ms === _v7LastMs) {
        _v7Counter++;
        if (_v7Counter > 0x0fff) {
          ms++;
          _v7Counter = 0;
        }
      }
    } else {
      // Automatic timestamp handling with monotonic logic
      if (ms <= _v7LastMs) {
        ms = _v7LastMs;
        _v7Counter++;
        if (_v7Counter > 0x0fff) {
          ms++; // overflow, advance to next ms
          _v7Counter = 0;
        }
      }
    }
    _v7LastMs = ms;
  } else {
    _v7LastMs = ms;
    _v7Counter = hasExplicitTs ? 0 : randomInt(0x1000);
  }

  const b = randomBytes(10);
  const msBig = BigInt(ms);

  // 48-bit timestamp in bytes 0-5
  const ts0 = Number((msBig >> 40n) & 0xffn);
  const ts1 = Number((msBig >> 32n) & 0xffn);
  const ts2 = Number((msBig >> 24n) & 0xffn);
  const ts3 = Number((msBig >> 16n) & 0xffn);
  const ts4 = Number((msBig >> 8n) & 0xffn);
  const ts5 = Number(msBig & 0xffn);

  const counterHi = (_v7Counter >> 8) & 0x0f;
  const counterLo = _v7Counter & 0xff;

  // Version 7 in the upper nibble of byte 6
  // bytes 6-7: version (7) + rand_a (12 bits) — we use counter here for monotonicity
  // bytes 8-9: variant (10) + rand_b (14 bits)
  // bytes 10-15: rand_b continuation
  const out = new Uint8Array(16);
  out[0] = ts0; out[1] = ts1; out[2] = ts2;
  out[3] = ts3; out[4] = ts4; out[5] = ts5;
  out[6] = 0x70 | counterHi;
  out[7] = counterLo;
  out[8] = 0x80 | (b[0] & 0x3f);
  out[9] = b[1];
  for (let i = 2; i < 10; i++) out[8 + i] = b[i];

  const h = [];
  for (let i = 0; i < 16; i++) h.push(out[i].toString(16).padStart(2, '0'));
  return `${h[0]}${h[1]}${h[2]}${h[3]}-${h[4]}${h[5]}-${h[6]}${h[7]}-${h[8]}${h[9]}-${h[10]}${h[11]}${h[12]}${h[13]}${h[14]}${h[15]}`;
}

/** Extract timestamp from UUID v7 */
function uuidv7Timestamp(uuid) {
  const hex = uuid.replace(/-/g, '');
  const tsHex = hex.slice(0, 12);
  return parseInt(tsHex, 16);
}

/** Validate UUID format */
function isUUID(str, version) {
  const re = version
    ? new RegExp(`^[0-9a-f]{8}-[0-9a-f]{4}-${version}[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`, 'i')
    : /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return re.test(str);
}

// ============================================================================
// ULID — Universally Unique Lexicographically Sortable Identifier
// ============================================================================

let _ulidLastMs = 0;
let _ulidCounter = 0;
let _ulidPrevRand = 0n;

/**
 * Generate a ULID (26 chars, Crockford Base32).
 * @param {Object} [opts]
 * @param {number} [opts.timestamp] - Custom timestamp (ms since epoch)
 * @param {boolean} [opts.monotonic=true] - Ensure monotonic ordering
 * @returns {string}
 */
function ulid(opts = {}) {
  const { timestamp, monotonic = true } = opts;
  let ms = typeof timestamp === 'number' ? timestamp : Date.now();

  let counter;
  if (monotonic && ms <= _ulidLastMs) {
    ms = _ulidLastMs;
    _ulidCounter++;
  } else {
    _ulidLastMs = ms;
    const rb = randomBytes(10);
    _ulidCounter = 0;
    for (let i = 0; i < 10; i++) {
      _ulidCounter = _ulidCounter * 256 + rb[i];
      if (_ulidCounter > Number.MAX_SAFE_INTEGER) {
        _ulidCounter = _ulidCounter % 0x10000000000;
      }
    }
    counter = _ulidCounter;
  }

  // For monotonic increment, we need a simpler approach:
  // timestamp (48 bits = 10 chars) + randomness (80 bits = 16 chars)
  // Use BigInt for full precision
  const tsBig = BigInt(ms);

  // Encode timestamp (10 Crockford chars)
  let tsPart = encodeCrockford(tsBig, 10);

  // For randomness/counter, use 80 bits
  // On monotonic increment within same ms: keep high bits from previous random,
  // just increment the low portion to preserve sort order while maintaining randomness
  let randBig;
  if (monotonic && _ulidCounter > 0) {
    // Increment previous randomness by 1 in the 80-bit space
    // This ensures monotonic ordering while keeping random distribution
    randBig = _ulidPrevRand + BigInt(_ulidCounter);
  } else {
    const rb = randomBytes(10);
    randBig = 0n;
    for (let i = 0; i < 10; i++) {
      randBig = (randBig << 8n) | BigInt(rb[i]);
    }
    _ulidPrevRand = randBig;
  }

  let randPart = encodeCrockford(randBig, 16);

  return tsPart + randPart;
}

/** Extract timestamp from ULID */
function ulidTimestamp(ulidStr) {
  const tsPart = ulidStr.slice(0, 10);
  let ms = 0;
  for (const ch of tsPart) {
    let val = CROCKFORD.indexOf(ch.toUpperCase());
    if (val === -1) {
      // Handle lowercase O→0, I→1, L→1
      const lower = ch.toLowerCase();
      if (lower === 'o') val = 0;
      else if (lower === 'i' || lower === 'l') val = 1;
      else throw new Error(`Invalid ULID character: ${ch}`);
    }
    ms = ms * 32 + val;
  }
  return ms;
}

// ============================================================================
// Snowflake — Twitter-style distributed IDs
// ============================================================================

/**
 * Create a Snowflake ID generator.
 * @param {Object} opts
 * @param {number} opts.workerId - Worker/machine ID (0 to maxWorkerId)
 * @param {number} [opts.datacenterId=0] - Datacenter ID
 * @param {number} [opts.epoch=1288834974657] - Twitter epoch default
 * @param {number} [opts.workerIdBits=10] - Bits for worker+datacenter IDs
 * @param {number} [opts.sequenceBits=12] - Bits for sequence
 * @returns {{generate: () => bigint, decode: (id: bigint) => Object}}
 */
function createSnowflake(opts) {
  const {
    workerId = 0,
    datacenterId = 0,
    epoch = 1288834974657, // Twitter epoch (Nov 4, 2010)
    workerIdBits = 10,
    sequenceBits = 12,
  } = opts || {};

  // Split workerIdBits between datacenter and worker
  const datacenterIdBits = Math.floor(workerIdBits / 2);
  const actualWorkerIdBits = workerIdBits - datacenterIdBits;
  const maxWorkerId = (1 << actualWorkerIdBits) - 1;
  const maxDatacenterId = (1 << datacenterIdBits) - 1;
  const maxSequence = (1 << sequenceBits) - 1;

  if (workerId < 0 || workerId > maxWorkerId) {
    throw new RangeError(`workerId must be 0–${maxWorkerId}`);
  }
  if (datacenterId < 0 || datacenterId > maxDatacenterId) {
    throw new RangeError(`datacenterId must be 0–${maxDatacenterId}`);
  }

  const workerIdShift = sequenceBits;
  const datacenterIdShift = sequenceBits + actualWorkerIdBits;
  const timestampShift = sequenceBits + workerIdBits;

  let lastTimestamp = -1;
  let sequence = 0;

  function generate() {
    let now = Date.now();
    if (now === lastTimestamp) {
      sequence = (sequence + 1) & maxSequence;
      if (sequence === 0) {
        // Sequence exhausted, wait for next ms
        while (now <= lastTimestamp) {
          now = Date.now();
        }
      }
    } else {
      sequence = 0;
    }
    lastTimestamp = now;

    const ts = BigInt(now - epoch);
    return (ts << BigInt(timestampShift))
      | (BigInt(datacenterId) << BigInt(datacenterIdShift))
      | (BigInt(workerId) << BigInt(workerIdShift))
      | BigInt(sequence);
  }

  function decode(id) {
    const bid = typeof id === 'bigint' ? id : BigInt(id);
    const seq = Number(bid & BigInt(maxSequence));
    const wid = Number((bid >> BigInt(workerIdShift)) & BigInt(maxWorkerId));
    const dcId = Number((bid >> BigInt(datacenterIdShift)) & BigInt(maxDatacenterId));
    const ts = Number(bid >> BigInt(timestampShift)) + epoch;
    return {
      timestamp: ts,
      date: new Date(ts),
      datacenterId: dcId,
      workerId: wid,
      sequence: seq,
    };
  }

  return { generate, decode };
}

// ============================================================================
// CUID2 — Collision-resistant IDs
// ============================================================================

const CUID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Generate a CUID2-style ID.
 * @param {Object} [opts]
 * @param {number} [opts.length=24] - ID length (min 2)
 * @returns {string}
 */
function cuid(opts = {}) {
  const { length = 24 } = opts;
  if (length < 2) throw new RangeError('length must be ≥ 2');

  const ts = Date.now().toString(36).slice(-length);

  // Counter for monotonicity within same process
  _cuidCounter = (_cuidCounter + 1) % 36;
  const counter = _cuidCounter.toString(36);

  // Random part
  let random = '';
  const rb = randomBytes(length);
  for (let i = 0; i < length; i++) {
    random += CUID_ALPHABET[rb[i] % CUID_ALPHABET.length];
  }

  // Fingerprint from process info
  const pid = (process?.pid ?? 1) % 36;
  const fingerprint = pid.toString(36);

  // Combine: ts + counter + fingerprint + random, then trim to length
  let id = ts + counter + fingerprint + random;
  // Shuffle-ish by mixing positions
  return id.slice(0, length);
}

let _cuidCounter = randomInt(36);

// ============================================================================
// Short ID — Compact, URL-friendly IDs
// ============================================================================

/**
 * Generate a short ID using base62 encoding.
 * @param {Object} [opts]
 * @param {number} [opts.length=8] - Approximate ID length
 * @param {string} [opts.alphabet] - Custom alphabet
 * @returns {string}
 */
function shortId(opts = {}) {
  const { length = 8, alphabet = BASE62 } = opts;
  let id = '';
  const bytes = randomBytes(length);
  for (let i = 0; i < length; i++) {
    id += alphabet[bytes[i] % alphabet.length];
  }
  return id;
}

// ============================================================================
// Sequential / Monotonic ID
// ============================================================================

/**
 * Create a sequential ID generator.
 * @param {Object} [opts]
 * @param {number} [opts.start=0] - Starting value
 * @param {string} [opts.prefix=''] - Optional prefix
 * @param {number} [opts.pad=0] - Zero-pad to this width
 * @returns {{next: () => string, current: () => string, reset: (n?: number) => void}}
 */
function createSequential(opts = {}) {
  const { start = 0, prefix = '', pad = 0 } = opts;
  let counter = start;
  return {
    next() {
      const val = String(counter++);
      const padded = pad > 0 ? val.padStart(pad, '0') : val;
      return prefix + padded;
    },
    current() {
      const val = String(counter - 1);
      const padded = pad > 0 ? val.padStart(pad, '0') : val;
      return prefix + padded;
    },
    reset(n = start) { counter = n; },
  };
}

// ============================================================================
// Custom Radix ID
// ============================================================================

/**
 * Generate an ID from a timestamp using custom radix encoding.
 * @param {Object} [opts]
 * @param {string} [opts.alphabet=BASE62] - Characters to use
 * @param {number} [opts.timestamp] - Custom timestamp
 * @param {number} [opts.randomLength=4] - Random suffix length
 * @returns {string}
 */
function timestampId(opts = {}) {
  const { alphabet = BASE62, timestamp, randomLength = 4 } = opts;
  const ts = timestamp ?? Date.now();
  let encoded = '';
  {
    // Encode timestamp in custom base
    let num = ts;
    if (num === 0) encoded = alphabet[0];
    else {
      while (num > 0) {
        encoded = alphabet[num % alphabet.length] + encoded;
        num = Math.floor(num / alphabet.length);
      }
    }
  }
  let suffix = '';
  const rb = randomBytes(randomLength);
  for (let i = 0; i < randomLength; i++) {
    suffix += alphabet[rb[i] % alphabet.length];
  }
  return encoded + suffix;
}

// ============================================================================
// Exports
// ============================================================================

const idgen = {
  // NanoID
  nanoid,
  createCustomNanoid,
  // UUID
  uuidv4,
  uuidv7,
  uuidv7Timestamp,
  isUUID,
  // ULID
  ulid,
  ulidTimestamp,
  // Snowflake
  createSnowflake,
  // CUID
  cuid,
  // Short ID
  shortId,
  // Sequential
  createSequential,
  // Timestamp ID
  timestampId,
  // Constants
  alphabets: {
    urlSafe: NANO_URLSAFE,
    default: NANO_DEFAULT,
    base62: BASE62,
    crockford: CROCKFORD,
    cuid: CUID_ALPHABET,
  },
};

export {
  nanoid,
  createCustomNanoid,
  uuidv4,
  uuidv7,
  uuidv7Timestamp,
  isUUID,
  ulid,
  ulidTimestamp,
  createSnowflake,
  cuid,
  shortId,
  createSequential,
  timestampId,
};

export default idgen;
