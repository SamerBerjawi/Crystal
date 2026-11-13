import type { Writable } from 'stream';

/*
 * A small ZIP writer: stored (not compressed) entries, written one at a time, so only one file is in memory.
 * Documents are already compressed (PDF, JPEG, PNG), and this keeps the server free of a zip dependency.
 * Limits that keep it valid without ZIP64: fewer than 65,535 entries and under 4 GB in all.
 */

const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        table[n] = c >>> 0;
    }
    return table;
})();

export const crc32 = (data: Buffer): number => {
    let crc = 0xffffffff;
    for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
};

const dosTime = (date: Date) => ({
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: (Math.max(0, date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
});

/** A safe file name: no folders, no dots-only names, no control characters, and unique within the archive. */
export const zipName = (raw: string, taken: Set<string>): string => {
    const base = raw.replace(/[\\/]/g, '_').replace(/[\u0000-\u001f\u007f]/g, '').replace(/^\.+/, '').trim().slice(0, 150) || 'file';
    const dot = base.lastIndexOf('.');
    const stem = dot > 0 ? base.slice(0, dot) : base;
    const ext = dot > 0 ? base.slice(dot) : '';
    let name = base;
    for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${stem} (${n})${ext}`;
    taken.add(name.toLowerCase());
    return name;
};

export class ZipWriter {
    private offset = 0;
    private central: Buffer[] = [];
    private count = 0;
    private readonly stamp = dosTime(new Date());

    constructor(private readonly out: Writable) {}

    private write(chunk: Buffer): Promise<void> {
        this.offset += chunk.length;
        return new Promise((resolve, reject) => {
            if (this.out.write(chunk)) return resolve();
            const onError = (error: Error) => reject(error);
            this.out.once('error', onError);
            this.out.once('drain', () => { this.out.off('error', onError); resolve(); });
        });
    }

    async add(name: string, data: Buffer): Promise<void> {
        if (this.count >= 65_000 || this.offset + data.length > 0xf0000000) throw new Error('The archive is too large.');
        const nameBytes = Buffer.from(name, 'utf8');
        const crc = crc32(data);
        const header = Buffer.alloc(30);
        header.writeUInt32LE(0x04034b50, 0);
        header.writeUInt16LE(20, 4); // version needed
        header.writeUInt16LE(0x0800, 6); // UTF-8 names
        header.writeUInt16LE(0, 8); // stored
        header.writeUInt16LE(this.stamp.time, 10);
        header.writeUInt16LE(this.stamp.date, 12);
        header.writeUInt32LE(crc, 14);
        header.writeUInt32LE(data.length, 18);
        header.writeUInt32LE(data.length, 22);
        header.writeUInt16LE(nameBytes.length, 26);
        header.writeUInt16LE(0, 28);
        const localOffset = this.offset;
        await this.write(Buffer.concat([header, nameBytes]));
        await this.write(data);

        const entry = Buffer.alloc(46);
        entry.writeUInt32LE(0x02014b50, 0);
        entry.writeUInt16LE(20, 4);
        entry.writeUInt16LE(20, 6);
        entry.writeUInt16LE(0x0800, 8);
        entry.writeUInt16LE(0, 10);
        entry.writeUInt16LE(this.stamp.time, 12);
        entry.writeUInt16LE(this.stamp.date, 14);
        entry.writeUInt32LE(crc, 16);
        entry.writeUInt32LE(data.length, 20);
        entry.writeUInt32LE(data.length, 24);
        entry.writeUInt16LE(nameBytes.length, 28);
        entry.writeUInt32LE(localOffset, 42);
        this.central.push(Buffer.concat([entry, nameBytes]));
        this.count++;
    }

    async finish(): Promise<void> {
        const start = this.offset;
        const directory = Buffer.concat(this.central);
        await this.write(directory);
        const end = Buffer.alloc(22);
        end.writeUInt32LE(0x06054b50, 0);
        end.writeUInt16LE(this.count, 8);
        end.writeUInt16LE(this.count, 10);
        end.writeUInt32LE(directory.length, 12);
        end.writeUInt32LE(start, 16);
        await this.write(end);
    }
}
