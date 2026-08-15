import { beforeEach, describe, expect, it, vi } from "vitest";

function chain(resolveValue: unknown, recorder: Record<string, unknown> = {}) {
  const link: Record<string, unknown> = {
    values: (v: unknown) => {
      recorder.values = v;
      return link;
    },
    set: (v: unknown) => {
      recorder.set = v;
      return link;
    },
    onConflictDoNothing: () => link,
    returning: () => link,
    from: () => link,
    where: () => link,
    limit: () => link,
    then: (resolve: (value: unknown) => void) => resolve(resolveValue),
  };
  return link;
}

const { insert, select, update, transaction } = vi.hoisted(() => ({
  insert: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  transaction: vi.fn(),
}));
const { mkdir, writeFile, rm, readFile } = vi.hoisted(() => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  rm: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue(Buffer.from("file-bytes")),
}));
const { recordAuditEvent } = vi.hoisted(() => ({
  recordAuditEvent: vi.fn().mockResolvedValue(undefined),
}));
const { hasPermission } = vi.hoisted(() => ({
  hasPermission: vi.fn().mockResolvedValue(true),
}));
const { loggerError, loggerWarn } = vi.hoisted(() => ({
  loggerError: vi.fn(),
  loggerWarn: vi.fn(),
}));

vi.mock("../../src/db", () => ({
  getDatabase: () => ({ insert, select, update, transaction }),
}));
vi.mock("node:fs/promises", () => ({ mkdir, writeFile, rm, readFile }));
vi.mock("../../src/platform/audit", () => ({ recordAuditEvent }));
vi.mock("../../src/platform/authorization", () => ({ hasPermission }));
vi.mock("../../src/platform/logger", () => ({
  getLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: loggerWarn,
    error: loggerError,
    child: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  }),
}));
vi.mock("../../src/platform/environment", () => ({
  parseApplicationEnvironment: () => ({
    PRIVATE_STORAGE_ROOT: "/var/kooka-private-files",
  }),
}));

import {
  FileNotAccessibleError,
  InvalidFileError,
  noopMalwareScanner,
  purgeStoredFile,
  readStoredFile,
  runMalwareScan,
  saveStoredFile,
} from "../../src/platform/file-storage";

const PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01, 0x02, 0x03,
]);
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x01, 0x02, 0x03]);
const PDF_BYTES = Buffer.concat([Buffer.from("%PDF-1.4"), Buffer.from([0x0a])]);
const MP4_BYTES = Buffer.from([
  0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
]);

function pngChunk(type: string, data: Buffer) {
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  chunk.write(type, 4, 4, "ascii");
  data.copy(chunk, 8);
  return chunk;
}

function structuredPng(width: number, height: number) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    PNG_BYTES.subarray(0, 8),
    pngChunk("IHDR", header),
    pngChunk("eXIf", Buffer.from("gps-private-metadata")),
    pngChunk("IDAT", Buffer.from([0x00])),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function jpegSegment(marker: number, data: Buffer) {
  const segment = Buffer.alloc(4 + data.length);
  segment[0] = 0xff;
  segment[1] = marker;
  segment.writeUInt16BE(data.length + 2, 2);
  data.copy(segment, 4);
  return segment;
}

function structuredJpeg(width: number, height: number) {
  const frame = Buffer.alloc(15);
  frame[0] = 8;
  frame.writeUInt16BE(height, 1);
  frame.writeUInt16BE(width, 3);
  frame[5] = 3;
  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    jpegSegment(0xe1, Buffer.from("Exif\0\0gps-private-metadata")),
    jpegSegment(0xc0, frame),
    Buffer.from([0xff, 0xda, 0x00, 0x02, 0xff, 0xd9]),
  ]);
}

beforeEach(() => {
  insert.mockReset();
  select.mockReset();
  update.mockReset();
  transaction.mockReset();
  transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
    callback({ insert, select, update }),
  );
  mkdir.mockClear();
  writeFile.mockClear();
  rm.mockClear();
  readFile.mockClear().mockResolvedValue(Buffer.from("file-bytes"));
  recordAuditEvent.mockClear();
  hasPermission.mockReset().mockResolvedValue(true);
  loggerError.mockReset();
  loggerWarn.mockReset();
});

describe("saveStoredFile", () => {
  const baseInput = {
    propertyId: "prop-1",
    mimeType: "image/png",
    bytes: PNG_BYTES,
    classification: "GUEST_DOCUMENT",
    purpose: "identity-verification",
    retentionCategory: "IDENTITY_DOCUMENT",
    actorUserId: "user-1",
  };

  it("rejects a MIME type outside the allowlist", async () => {
    await expect(
      saveStoredFile({ ...baseInput, mimeType: "application/x-msdownload" }),
    ).rejects.toBeInstanceOf(InvalidFileError);
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("rejects an empty file", async () => {
    await expect(
      saveStoredFile({ ...baseInput, bytes: Buffer.alloc(0) }),
    ).rejects.toThrow(/empty/u);
  });

  it("rejects content whose signature does not match the declared MIME type", async () => {
    await expect(
      saveStoredFile({
        ...baseInput,
        bytes: Buffer.from("not actually a png"),
      }),
    ).rejects.toThrow(/signature/u);
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("writes the file under an opaque key and records metadata for a valid upload", async () => {
    insert.mockReturnValueOnce(
      chain([{ id: "file-1", storageKey: "prop-1/ab/xyz.png" }]),
    );

    const record = await saveStoredFile(baseInput);

    expect(writeFile).toHaveBeenCalledTimes(1);
    const [writtenPath] = writeFile.mock.calls[0] as [string, Buffer];
    expect(writtenPath).toContain("prop-1/");
    expect(writtenPath.startsWith("/var/kooka-private-files")).toBe(true);
    // Opaque key: never derived from the original filename.
    expect(writtenPath).not.toContain("originalName");
    expect(record).toMatchObject({ id: "file-1" });
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "file.upload",
        targetType: "stored_file",
      }),
      expect.anything(),
    );
  });

  it("removes the written file if the metadata insert fails, avoiding an orphaned blob", async () => {
    insert.mockImplementationOnce(() => {
      throw new Error("db unavailable");
    });

    await expect(saveStoredFile(baseInput)).rejects.toThrow("db unavailable");
    expect(rm).toHaveBeenCalledTimes(1);
  });

  it("accepts a JPEG upload (signature check for image/jpeg)", async () => {
    insert.mockReturnValueOnce(chain([{ id: "file-jpeg" }]));

    const record = await saveStoredFile({
      ...baseInput,
      mimeType: "image/jpeg",
      bytes: JPEG_BYTES,
    });

    expect(record).toMatchObject({ id: "file-jpeg" });
  });

  it("accepts a PDF upload (signature check for application/pdf)", async () => {
    insert.mockReturnValueOnce(chain([{ id: "file-pdf" }]));

    const record = await saveStoredFile({
      ...baseInput,
      mimeType: "application/pdf",
      bytes: PDF_BYTES,
    });

    expect(record).toMatchObject({ id: "file-pdf" });
  });

  it("accepts an MP4 upload with an ISO media signature", async () => {
    insert.mockReturnValueOnce(chain([{ id: "file-mp4" }]));

    const record = await saveStoredFile({
      ...baseInput,
      mimeType: "video/mp4",
      bytes: MP4_BYTES,
    });

    expect(record).toMatchObject({ id: "file-mp4" });
  });

  it("strips PNG metadata before hashing and writing private bytes", async () => {
    insert.mockReturnValueOnce(chain([{ id: "file-sanitized" }]));

    await saveStoredFile({ ...baseInput, bytes: structuredPng(800, 600) });

    const written = writeFile.mock.calls[0]?.[1] as Buffer;
    expect(written.includes(Buffer.from("eXIf"))).toBe(false);
    expect(written.includes(Buffer.from("gps-private-metadata"))).toBe(false);
  });

  it("rejects images with decompression-bomb dimensions", async () => {
    await expect(
      saveStoredFile({ ...baseInput, bytes: structuredPng(12_000, 12_000) }),
    ).rejects.toThrow(/dimensions/u);
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("strips JPEG APP1 metadata while retaining verified image data", async () => {
    insert.mockReturnValueOnce(chain([{ id: "jpeg-sanitized" }]));

    await saveStoredFile({
      ...baseInput,
      mimeType: "image/jpeg",
      bytes: structuredJpeg(1_200, 800),
    });

    const written = writeFile.mock.calls[0]?.[1] as Buffer;
    expect(written.includes(Buffer.from("Exif"))).toBe(false);
    expect(written.includes(Buffer.from("gps-private-metadata"))).toBe(false);
    expect(written.includes(Buffer.from([0xff, 0xc0]))).toBe(true);
  });

  it("rejects oversized JPEG dimensions and malformed PNG chunks", async () => {
    await expect(
      saveStoredFile({
        ...baseInput,
        mimeType: "image/jpeg",
        bytes: structuredJpeg(12_000, 12_000),
      }),
    ).rejects.toThrow(/dimensions/u);

    const malformed = Buffer.concat([
      PNG_BYTES.subarray(0, 8),
      Buffer.from([0x00, 0x00, 0x10, 0x00]),
      Buffer.from("IHDR"),
      Buffer.alloc(20),
    ]);
    await expect(
      saveStoredFile({ ...baseInput, bytes: malformed }),
    ).rejects.toThrow(/chunk length/u);
  });
});

describe("noopMalwareScanner", () => {
  it("always resolves CLEAN -- an explicit placeholder, never a hidden default", async () => {
    await expect(
      noopMalwareScanner({ storageKey: "k", absolutePath: "/p" }),
    ).resolves.toBe("CLEAN");
  });
});

describe("runMalwareScan", () => {
  it("throws when the file does not exist", async () => {
    select.mockReturnValueOnce(chain([]));
    await expect(
      runMalwareScan("missing-file", async () => "CLEAN"),
    ).rejects.toBeInstanceOf(FileNotAccessibleError);
  });

  it("persists the scanner's verdict", async () => {
    select.mockReturnValueOnce(
      chain([{ id: "file-1", storageKey: "prop-1/ab/x.png" }]),
    );
    const recorder: Record<string, unknown> = {};
    update.mockReturnValueOnce(chain(undefined, recorder));

    const result = await runMalwareScan("file-1", async () => "REJECTED");

    expect(result).toBe("REJECTED");
    expect(recorder.set).toMatchObject({ scanStatus: "REJECTED" });
  });
});

describe("readStoredFile", () => {
  const baseAccess = {
    fileId: "file-1",
    actorUserId: "user-1",
    permissionCode: "guest.identity_document.view",
    action: "DOWNLOAD" as const,
  };

  it("denies access to a file that has not cleared malware scanning", async () => {
    select.mockReturnValueOnce(
      chain([
        {
          id: "file-1",
          scanStatus: "PENDING",
          storageKey: "k",
          purgedAt: null,
        },
      ]),
    );

    await expect(readStoredFile(baseAccess)).rejects.toBeInstanceOf(
      FileNotAccessibleError,
    );
    expect(readFile).not.toHaveBeenCalled();
  });

  it("denies access to a purged file even if scanStatus is CLEAN", async () => {
    select.mockReturnValueOnce(
      chain([
        {
          id: "file-1",
          propertyId: "prop-1",
          scanStatus: "CLEAN",
          storageKey: "k",
          purgedAt: new Date(),
        },
      ]),
    );

    await expect(readStoredFile(baseAccess)).rejects.toBeInstanceOf(
      FileNotAccessibleError,
    );
  });

  it("records an access event and returns bytes for an authorized, clean, non-purged file", async () => {
    select.mockReturnValueOnce(
      chain([
        {
          id: "file-1",
          propertyId: "prop-1",
          scanStatus: "CLEAN",
          storageKey: "prop-1/ab/x.png",
          purgedAt: null,
        },
      ]),
    );
    const recorder: Record<string, unknown> = {};
    insert.mockReturnValueOnce(chain(undefined, recorder));

    const result = await readStoredFile(baseAccess);

    expect(result.bytes.toString()).toBe("file-bytes");
    expect(recorder.values).toMatchObject({
      action: "DOWNLOAD",
      result: "SUCCESS",
    });
  });

  it("denies access when the actor lacks the named permission", async () => {
    select.mockReturnValueOnce(
      chain([
        {
          id: "file-1",
          propertyId: "prop-1",
          scanStatus: "CLEAN",
          storageKey: "prop-1/ab/x.png",
          purgedAt: null,
        },
      ]),
    );
    hasPermission.mockResolvedValueOnce(false);

    await expect(readStoredFile(baseAccess)).rejects.toBeInstanceOf(
      FileNotAccessibleError,
    );
    expect(readFile).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("fails closed -- denies access -- when the access-audit write itself fails", async () => {
    select.mockReturnValueOnce(
      chain([
        {
          id: "file-1",
          propertyId: "prop-1",
          scanStatus: "CLEAN",
          storageKey: "prop-1/ab/x.png",
          purgedAt: null,
        },
      ]),
    );
    insert.mockImplementationOnce(() => {
      throw new Error("audit db down");
    });

    await expect(readStoredFile(baseAccess)).rejects.toBeInstanceOf(
      FileNotAccessibleError,
    );
    expect(readFile).toHaveBeenCalledTimes(1);
    expect(loggerError).toHaveBeenCalledTimes(1);
  });
});

describe("purgeStoredFile", () => {
  it("deletes the bytes and marks the row purged", async () => {
    select.mockReturnValueOnce(
      chain([
        {
          id: "file-1",
          propertyId: "prop-1",
          storageKey: "prop-1/ab/x.png",
          purgedAt: null,
        },
      ]),
    );
    const recorder: Record<string, unknown> = {};
    update.mockReturnValueOnce(chain(undefined, recorder));

    await purgeStoredFile("file-1", "user-1");

    expect(rm).toHaveBeenCalledTimes(1);
    expect(recorder.set).toHaveProperty("purgedAt");
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "file.purge" }),
      expect.anything(),
    );
  });

  it("is a no-op for a file that was already purged", async () => {
    select.mockReturnValueOnce(
      chain([
        { id: "file-1", storageKey: "prop-1/ab/x.png", purgedAt: new Date() },
      ]),
    );

    await purgeStoredFile("file-1", "user-1");

    expect(rm).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("throws when the file does not exist", async () => {
    select.mockReturnValueOnce(chain([]));

    await expect(purgeStoredFile("missing-file")).rejects.toBeInstanceOf(
      FileNotAccessibleError,
    );
  });
});
