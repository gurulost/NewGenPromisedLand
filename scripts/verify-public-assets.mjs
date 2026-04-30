import { spawnSync } from 'node:child_process';
import { closeSync, openSync, readSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const PUBLIC_DIR = 'client/public';
const LARGE_ASSET_LIMIT_BYTES = 5 * 1024 * 1024;
const LFS_POINTER_PREFIX = 'version https://git-lfs.github.com/spec/v1';

const repoRoot = process.cwd();
const publicRoot = path.join(repoRoot, PUBLIC_DIR);

const toPosixPath = (filePath) => filePath.split(path.sep).join('/');

const listFiles = (dir) => {
  const entries = readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(entryPath);
    if (entry.isFile()) return [entryPath];
    return [];
  });
};

const runGit = (args, input) => {
  const result = spawnSync('git', args, {
    cwd: repoRoot,
    encoding: 'buffer',
    input,
  });

  if (result.status !== 0) {
    const stderr = result.stderr.toString('utf8').trim();
    throw new Error(`git ${args.join(' ')} failed${stderr ? `: ${stderr}` : ''}`);
  }

  return result.stdout;
};

const getLfsFilterByPath = (relativePaths) => {
  if (relativePaths.length === 0) return new Map();

  const input = Buffer.from(`${relativePaths.join('\0')}\0`, 'utf8');
  const output = runGit(['check-attr', '-z', '--stdin', 'filter'], input);
  const parts = output.toString('utf8').split('\0').filter(Boolean);
  const filterByPath = new Map();

  for (let index = 0; index < parts.length; index += 3) {
    const [filePath, attribute, value] = parts.slice(index, index + 3);
    if (attribute === 'filter') {
      filterByPath.set(filePath, value);
    }
  }

  return filterByPath;
};

const readHeader = (absolutePath, byteLength) => {
  const fd = openSync(absolutePath, 'r');
  try {
    const buffer = Buffer.alloc(byteLength);
    const bytesRead = readSync(fd, buffer, 0, byteLength, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    closeSync(fd);
  }
};

const isLfsPointer = (absolutePath) => {
  const header = readHeader(absolutePath, 128).toString('utf8');
  return header.startsWith(LFS_POINTER_PREFIX);
};

const validateGlb = (absolutePath, relativePath, size, failures) => {
  const header = readHeader(absolutePath, 12);
  const magic = header.subarray(0, 4).toString('utf8');
  const version = header.length >= 8 ? header.readUInt32LE(4) : undefined;
  const declaredLength = header.length >= 12 ? header.readUInt32LE(8) : undefined;

  if (magic !== 'glTF') {
    failures.push(`${relativePath}: expected GLB magic "glTF", found "${magic || '<empty>'}"`);
  }

  if (version !== 2) {
    failures.push(`${relativePath}: expected GLB version 2, found ${version ?? '<missing>'}`);
  }

  if (declaredLength !== size) {
    failures.push(`${relativePath}: GLB header length ${declaredLength ?? '<missing>'} does not match file size ${size}`);
  }
};

const formatBytes = (bytes) => `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;

const files = listFiles(publicRoot)
  .map((absolutePath) => ({
    absolutePath,
    relativePath: toPosixPath(path.relative(repoRoot, absolutePath)),
    size: statSync(absolutePath).size,
  }))
  .sort((a, b) => a.relativePath.localeCompare(b.relativePath));

const lfsFilterByPath = getLfsFilterByPath(files.map((file) => file.relativePath));
const failures = [];
let glbCount = 0;
let lfsLargeAssetCount = 0;
let totalBytes = 0;

for (const file of files) {
  totalBytes += file.size;

  if (isLfsPointer(file.absolutePath)) {
    failures.push(`${file.relativePath}: Git LFS pointer file is not hydrated`);
    continue;
  }

  if (file.relativePath.endsWith('.glb')) {
    glbCount += 1;
    validateGlb(file.absolutePath, file.relativePath, file.size, failures);
  }

  if (file.size > LARGE_ASSET_LIMIT_BYTES) {
    const filter = lfsFilterByPath.get(file.relativePath);
    if (filter !== 'lfs') {
      failures.push(`${file.relativePath}: ${formatBytes(file.size)} exceeds ${formatBytes(LARGE_ASSET_LIMIT_BYTES)} but is not Git LFS-filtered`);
    } else {
      lfsLargeAssetCount += 1;
    }
  }
}

if (failures.length > 0) {
  console.error('Public asset verification failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Public asset verification passed');
console.log(`- Files scanned: ${files.length}`);
console.log(`- Total size: ${formatBytes(totalBytes)}`);
console.log(`- GLB files validated: ${glbCount}`);
console.log(`- Large LFS-filtered assets: ${lfsLargeAssetCount}`);
