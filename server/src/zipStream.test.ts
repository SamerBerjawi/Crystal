import { Writable } from 'stream';
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { crc32, zipName, ZipWriter } from './zipStream';

const assert = (condition: boolean, message: string) => { if (!condition) throw new Error(`Test Failed: ${message}`); };

const run = async () => {
    // Known CRC-32 of "123456789".
    assert(crc32(Buffer.from('123456789')) === 0xcbf43926, 'crc32 matches the standard check value');

    const taken = new Set<string>();
    assert(zipName('../etc/passwd', taken) === '.._etc_passwd'.replace(/^\.+/, ''), 'folders are flattened and leading dots removed');
    assert(zipName('a.pdf', taken) === 'a.pdf' && zipName('A.pdf', taken) === 'A (2).pdf', 'duplicate names get a number');
    assert(zipName('', new Set()) === 'file', 'an empty name gets a default');
    console.log('✓ crc and names');

    const chunks: Buffer[] = [];
    const sink = new Writable({ write(chunk, _enc, done) { chunks.push(Buffer.from(chunk)); done(); } });
    const zip = new ZipWriter(sink);
    await zip.add('summary.csv', Buffer.from('a,b\n1,2\n'));
    await zip.add('Réçu 1.pdf', Buffer.from('%PDF-1.4 hello'));
    await zip.add('empty.txt', Buffer.alloc(0));
    await zip.finish();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zip-'));
    const file = path.join(dir, 'out.zip');
    fs.writeFileSync(file, Buffer.concat(chunks));
    try {
        const listing = execFileSync('unzip', ['-t', file]).toString();
        assert(/No errors detected/.test(listing), 'unzip accepts the archive');
        assert(execFileSync('unzip', ['-p', file, 'summary.csv']).toString() === 'a,b\n1,2\n', 'content round-trips');
        assert(/R.+ 1\.pdf/.test(listing), 'a name with accents survives');
        console.log('✓ archive verified with unzip');
    } catch (err: any) {
        if (err?.code === 'ENOENT') console.log('- unzip not installed; archive not verified');
        else throw err;
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
};

run().then(() => console.log('All zip tests passed.')).catch(err => { console.error('✕', err.message); process.exit(1); });
