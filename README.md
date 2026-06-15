# id-gen-x

Zero-dependency ID generation library for JavaScript/TypeScript.  
NanoID, UUID v4/v7, ULID, Snowflake, CUID, Short IDs, Sequential IDs, and Timestamp IDs — all in one package.

## Why?

Every project needs unique IDs. Instead of pulling 5 different packages, get them all in one zero-dependency library with a clean API and consistent quality.

## Install

```bash
npm install id-gen-x
```

## Quick Start

```js
import { nanoid, uuidv4, uuidv7, ulid, createSnowflake } from 'id-gen-x';

nanoid();        // "V1StGXR8_Z5jdHi6B-myT"
uuidv4();        // "f47ac10b-58cc-4372-a567-0e02b2c3d479"
uuidv7();        // "017f6a1c-8d62-7e1f-9c3a-3a4e5f6a7b8c" (timestamp-ordered)
ulid();          // "01ARZ3NDEKTSV4RRFFQ69G5FAV" (lexicographically sortable)
createSnowflake({ workerId: 1 }).generate();  // 1234567890123456789n
```

## API

### NanoID

Compact, URL-safe IDs with customizable alphabet.

```js
import { nanoid, createCustomNanoid } from 'id-gen-x';

nanoid();                              // 21 chars, URL-safe alphabet
nanoid({ size: 10 });                  // 10 chars
nanoid({ alphabet: 'abcdef0123456789' }); // hex only
nanoid({ prefix: 'usr_' });            // "usr_" + 21 chars

// Factory with fixed alphabet
const genHexId = createCustomNanoid('abcdef0123456789', 12);
genHex();    // "a1b2c3d4e5f6"
genHex(8);   // "a1b2c3d4"
```

### UUID v4

RFC 4122 compliant random UUIDs.

```js
import { uuidv4, isUUID } from 'id-gen-x';

uuidv4();  // "f47ac10b-58cc-4372-a567-0e02b2c3d479"
isUUID(uuidv4());      // true
isUUID(uuidv4(), 4);   // true (check version)
isUUID('not-a-uuid');  // false
```

### UUID v7

RFC 9562 timestamp-ordered UUIDs. Monotonic by default — IDs generated within the same millisecond always sort correctly.

```js
import { uuidv7, uuidv7Timestamp } from 'id-gen-x';

uuidv7();  // "017f6a1c-8d62-7e1f-9c3a-3a4e5f6a7b8c"

// Custom timestamp
uuidv7({ timestamp: new Date('2025-01-01') });

// Extract timestamp
uuidv7Timestamp('017f6a1c-8d62-7e1f-9c3a-3a4e5f6a7b8c');
// → 1700000000000

// Disable monotonic ordering (use random bits)
uuidv7({ monotonic: false });
```

### ULID

26-character Crockford Base32 encoded IDs that are lexicographically sortable by timestamp.

```js
import { ulid, ulidTimestamp } from 'id-gen-x';

ulid();  // "01ARZ3NDEKTSV4RRFFQ69G5FAV"

// Monotonic mode ensures ordering within same ms
const id1 = ulid();
const id2 = ulid();
// id1 < id2 always

// Decode timestamp
ulidTimestamp('01ARZ3NDEKTSV4RRFFQ69G5FAV');
```

### Snowflake

Twitter-style distributed IDs with worker/datacenter identification. 64-bit integers (BigInt).

```js
import { createSnowflake } from 'id-gen-x';

const snowflake = createSnowflake({
  workerId: 1,
  datacenterId: 0,
  // epoch: 1288834974657,  // Twitter epoch (default)
});

const id = snowflake.generate();
// → 1234567890123456789n

snowflake.decode(id);
// → { timestamp: 1700000000000, date: Date, workerId: 1, datacenterId: 0, sequence: 0 }
```

### CUID

Collision-resistant IDs designed for horizontal scaling.

```js
import { cuid } from 'id-gen-x';

cuid();              // 24 chars
cuid({ length: 16 }); // 16 chars
```

### Short ID

Compact random IDs with custom alphabet.

```js
import { shortId } from 'id-gen-x';

shortId();                           // "aB3xK9mQ" (8 chars, base62)
shortId({ length: 6 });              // "aB3xK9"
shortId({ alphabet: '0123456789' }); // "384756"
```

### Sequential

Monotonic sequential IDs with optional prefix and zero-padding.

```js
import { createSequential } from 'id-gen-x';

const orderSeq = createSequential({ start: 1000, prefix: 'ORD-', pad: 6 });
orderSeq.next();  // "ORD-001000"
orderSeq.next();  // "ORD-001001"
orderSeq.current(); // "ORD-001001"
orderSeq.reset();   // reset to start
```

### Timestamp ID

Custom-radix timestamp + random suffix.

```js
import { timestampId } from 'id-gen-x';

timestampId();  // "l3j8K9aB" (timestamp encoded in base62 + random suffix)
timestampId({ randomLength: 6 });  // longer random suffix
timestampId({ alphabet: '0123456789abcdef' }); // hex encoding
```

## CLI

```bash
# Generate IDs from command line
idgen nanoid -s 10
idgen uuid4
idgen uuid7
idgen ulid
idgen snowflake -w 1
idgen cuid -l 16
idgen short -l 6
idgen tsid

# Decode IDs
idgen decode-snowflake 1234567890123456789
idgen decode-uuid7 017f6a1c-8d62-7e1f-9c3a-3a4e5f6a7b8c
idgen decode-ulid 01ARZ3NDEKTSV4RRFFQ69G5FAV

# Generate all types at once
idgen demo
```

## Use Cases

| ID Type | Best For |
|---------|----------|
| NanoID | Short URLs, client-side IDs, general purpose |
| UUID v4 | Standard unique identifiers, database keys |
| UUID v7 | Time-ordered database keys, event sourcing |
| ULID | Lexicographically sortable IDs, log entries |
| Snowflake | Distributed systems, multi-node generation |
| CUID | Horizontal scaling, DOM IDs |
| Short ID | Readable codes, invite links |
| Sequential | Order numbers, invoice numbers |

## Design Decisions

- **Zero dependencies** — Uses `crypto.getRandomValues` with `Math.random` fallback
- **BigInt for Snowflake** — 64-bit IDs require BigInt in JS
- **Monotonic by default** — UUID v7 and ULID ensure ordering within same ms
- **Crockford Base32 for ULID** — No confusing characters (no I, L, O, U)

## License

MIT
