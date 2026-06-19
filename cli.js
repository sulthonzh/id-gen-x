#!/usr/bin/env node
'use strict';

import idgen from './index.js';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

const [cmd, ...args] = process.argv.slice(2);

function usage() {
  console.log(`id-gen-x CLI

Usage: idgen <command> [options]

Commands:
  nanoid    [-s size] [-a alphabet] [-p prefix]   NanoID (default 21 chars, URL-safe)
  uuid4                                        UUID v4
  uuid7    [-t timestamp] [--no-mono]             UUID v7 (timestamp-ordered)
  ulid     [-t timestamp] [--no-mono]             ULID (26 chars, Crockford Base32)
  snowflake [-w workerId] [-d datacenterId]       Snowflake ID (Twitter-style)
  cuid     [-l length]                            CUID2-style
  short    [-l length] [-a alphabet]              Short random ID
  seq      [--start N] [--prefix S] [--pad N]     Sequential IDs (interactive)
  tsid     [-a alphabet] [-l randomLength]        Timestamp + random suffix
  decode-snowflake <id>                           Decode snowflake ID
  decode-uuid7 <uuid>                             Extract timestamp from UUID v7
  decode-ulid <ulid>                              Extract timestamp from ULID
  demo                                           Generate all ID types
  help                                           Show this help

Examples:
  idgen nanoid -s 10
  idgen nanoid -a "abcdef0123456789" -s 8
  idgen uuid4
  idgen uuid7
  idgen ulid
  idgen snowflake -w 1 -d 0
  idgen cuid -l 16
  idgen short -l 6
  idgen decode-snowflake 1234567890123456789n
  idgen demo
`);
}

function parseFlag(flags, name, defaultValue) {
  const idx = flags.indexOf('--' + name);
  if (idx === -1 || idx + 1 >= flags.length) return defaultValue;
  return flags[idx + 1];
}

const flags = args.filter(a => a.startsWith('-'));
const positional = args.filter(a => !a.startsWith('-'));

switch (cmd) {
  case 'nanoid': {
    const size = parseInt(parseFlag(flags, 's', '21'));
    const alphabet = parseFlag(flags, 'a', undefined);
    const prefix = parseFlag(flags, 'p', '');
    console.log(idgen.nanoid({ size, alphabet, prefix }));
    break;
  }
  case 'uuid4':
  case 'uuid-4':
    console.log(idgen.uuidv4());
    break;
  case 'uuid7':
  case 'uuid-7': {
    const ts = parseFlag(flags, 't', undefined);
    const noMono = flags.includes('--no-mono');
    console.log(idgen.uuidv7({ timestamp: ts ? parseInt(ts) : undefined, monotonic: !noMono }));
    break;
  }
  case 'ulid': {
    const ts = parseFlag(flags, 't', undefined);
    const noMono = flags.includes('--no-mono');
    console.log(idgen.ulid({ timestamp: ts ? parseInt(ts) : undefined, monotonic: !noMono }));
    break;
  }
  case 'snowflake': {
    const w = parseInt(parseFlag(flags, 'w', '0'));
    const d = parseInt(parseFlag(flags, 'd', '0'));
    const sf = idgen.createSnowflake({ workerId: w, datacenterId: d });
    console.log(sf.generate().toString());
    break;
  }
  case 'cuid': {
    const len = parseInt(parseFlag(flags, 'l', '24'));
    console.log(idgen.cuid({ length: len }));
    break;
  }
  case 'short': {
    const len = parseInt(parseFlag(flags, 'l', '8'));
    const alpha = parseFlag(flags, 'a', undefined);
    console.log(idgen.shortId({ length: len, alphabet: alpha }));
    break;
  }
  case 'seq': {
    const start = parseInt(parseFlag(flags, 'start', '0'));
    const prefix = parseFlag(flags, 'prefix', '');
    const pad = parseInt(parseFlag(flags, 'pad', '0'));
    const seq = idgen.createSequential({ start, prefix, pad });
    // Generate 5 examples
    for (let i = 0; i < 5; i++) console.log(seq.next());
    break;
  }
  case 'tsid': {
    const alpha = parseFlag(flags, 'a', undefined);
    const rl = parseInt(parseFlag(flags, 'l', '4'));
    console.log(idgen.timestampId({ alphabet: alpha, randomLength: rl }));
    break;
  }
  case 'decode-snowflake': {
    const raw = positional[0];
    if (!raw) { console.error('Error: snowflake ID required'); process.exit(1); }
    const sf = idgen.createSnowflake({});
    console.log(JSON.stringify(sf.decode(raw), null, 2));
    break;
  }
  case 'decode-uuid7': {
    const raw = positional[0];
    if (!raw) { console.error('Error: UUID v7 required'); process.exit(1); }
    const ts = idgen.uuidv7Timestamp(raw);
    console.log(`Timestamp: ${ts}`);
    console.log(`Date: ${new Date(ts).toISOString()}`);
    break;
  }
  case 'decode-ulid': {
    const raw = positional[0];
    if (!raw) { console.error('Error: ULID required'); process.exit(1); }
    const ts = idgen.ulidTimestamp(raw);
    console.log(`Timestamp: ${ts}`);
    console.log(`Date: ${new Date(ts).toISOString()}`);
    break;
  }
  case 'demo': {
    console.log('=== id-gen-x Demo ===\n');
    console.log('NanoID (21):      ', idgen.nanoid());
    console.log('NanoID (10):      ', idgen.nanoid({ size: 10 }));
    console.log('NanoID (hex 8):   ', idgen.nanoid({ size: 8, alphabet: '0123456789abcdef' }));
    console.log('UUID v4:          ', idgen.uuidv4());
    console.log('UUID v7:          ', idgen.uuidv7());
    console.log('ULID:             ', idgen.ulid());
    const sf = idgen.createSnowflake({ workerId: 1 });
    const sid = sf.generate();
    console.log('Snowflake (w=1):  ', sid.toString());
    console.log('  decoded:        ', JSON.stringify(sf.decode(sid)));
    console.log('CUID:             ', idgen.cuid());
    console.log('Short ID (8):     ', idgen.shortId());
    console.log('Short ID (6):     ', idgen.shortId({ length: 6 }));
    console.log('Timestamp ID:     ', idgen.timestampId());
    const seq = idgen.createSequential({ prefix: 'ORD-', pad: 5 });
    console.log('Sequential:       ', [0,1,2].map(() => seq.next()).join(', '));
    break;
  }
  case 'help':
  case '--help':
  case '-h':
    usage();
    break;
  case '--version':
  case '-V':
    console.log(pkg.version);
    break;
  default:
    console.error(`Unknown command: ${cmd}\n`);
    usage();
    process.exit(1);
}
