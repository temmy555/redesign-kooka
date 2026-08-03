import { createHash } from "node:crypto";
import { readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const catalogPath = path.join(
  projectRoot,
  "data/sources/agoda-kooka-residence.json",
);
const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
const maximumSourceBytes = 20 * 1024 * 1024;

function outputPath(localPath) {
  if (!localPath.startsWith("/images/agoda-kooka/")) {
    throw new Error(`Unsafe local asset path: ${localPath}`);
  }
  return path.join(projectRoot, "public", localPath);
}

async function download(asset) {
  const destination = outputPath(asset.localPath);
  const temporary = `${destination}.download`;
  const response = await fetch(asset.sourceUrl, {
    headers: {
      accept: "image/avif,image/webp,image/jpeg,image/png;q=0.9,*/*;q=0.1",
      "user-agent": "KOOKA-Residence-Catalog-Sync/1.0",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`${asset.id}: source returned HTTP ${response.status}`);
  }

  const source = Buffer.from(await response.arrayBuffer());
  if (source.length === 0 || source.length > maximumSourceBytes) {
    throw new Error(`${asset.id}: invalid source size ${source.length}`);
  }

  const image = sharp(source, { failOn: "error" });
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error(`${asset.id}: downloaded payload is not a valid image`);
  }

  const normalized = await image
    .rotate()
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
  await writeFile(temporary, normalized, { flag: "w" });
  await rename(temporary, destination);

  return {
    id: asset.id,
    width: metadata.width,
    height: metadata.height,
    bytes: (await stat(destination)).size,
    sha256: createHash("sha256").update(normalized).digest("hex"),
  };
}

const results = [];
for (const asset of catalog.assets) {
  try {
    results.push(await download(asset));
  } catch (error) {
    const temporary = `${outputPath(asset.localPath)}.download`;
    await unlink(temporary).catch(() => undefined);
    throw error;
  }
}

const integrityPath = path.join(
  projectRoot,
  "data/sources/agoda-kooka-assets.integrity.json",
);
await writeFile(
  integrityPath,
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      sourceProvider: catalog.source.provider,
      assetCount: results.length,
      assets: results,
    },
    null,
    2,
  )}\n`,
);

console.log(
  JSON.stringify(
    {
      downloaded: results.length,
      directory: "public/images/agoda-kooka",
      integrity: "data/sources/agoda-kooka-assets.integrity.json",
    },
    null,
    2,
  ),
);
