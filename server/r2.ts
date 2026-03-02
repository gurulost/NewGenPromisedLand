import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID ?? "";
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID ?? "";
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY ?? "";
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME ?? "";
const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL ?? "").replace(/\/$/, "");

export const R2_CONFIGURED =
  Boolean(R2_ACCOUNT_ID) &&
  Boolean(R2_ACCESS_KEY_ID) &&
  Boolean(R2_SECRET_ACCESS_KEY) &&
  Boolean(R2_BUCKET_NAME);

const PRESIGNED_EXPIRY_SECONDS = 300;

// Allowed base MIME types (without codec params). Browsers typically send
// "audio/webm;codecs=opus" or "audio/mp4;codecs=mp4a.40.2" — we strip the
// codec suffix before checking so any valid base type is accepted.
const ALLOWED_AUDIO_BASE_TYPES = new Set<string>([
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/x-m4a",
  "audio/aac",
]);

export const VOICE_LIMITS = {
  maxDurationMs: 180_000,
  maxBytes: 8_388_608,
} as const;

// NOTE: R2 bucket CORS must be configured in the Cloudflare dashboard to allow
// direct browser PUTs from your app domain. Required rule:
//   AllowedOrigins: ["https://your-app-domain"]
//   AllowedMethods: ["PUT"]
//   AllowedHeaders: ["Content-Type"]
// Without this, browser PUT requests to presigned URLs will be blocked.

function getR2Client(): S3Client {
  if (!R2_CONFIGURED) {
    throw new Error("R2 object storage is not configured");
  }
  return new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
}

function normalizeBaseMimeType(mimeType: string): string {
  return mimeType.split(";")[0].trim().toLowerCase();
}

function sanitizeObjectKeySegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9\-_]/g, "_").slice(0, 128);
}

function mimeTypeToExtension(mimeType: string): string {
  const base = normalizeBaseMimeType(mimeType);
  const sub = base.split("/")[1] ?? "webm";
  const extMap: Record<string, string> = {
    "x-m4a": "m4a",
    mpeg: "mp3",
    ogg: "ogg",
    wav: "wav",
    mp4: "mp4",
    aac: "aac",
    webm: "webm",
  };
  return extMap[sub] ?? sub;
}

export function isAllowedVoiceMimeType(mimeType: string): boolean {
  return ALLOWED_AUDIO_BASE_TYPES.has(normalizeBaseMimeType(mimeType));
}

export interface PresignedVoiceUpload {
  uploadUrl: string;
  objectKey: string;
  publicUrl: string;
  expiresInSeconds: number;
}

export async function createVoiceUploadUrl(params: {
  lobbyCode: string;
  messageId: string;
  mimeType: string;
  contentLength: number;
}): Promise<PresignedVoiceUpload> {
  const { lobbyCode, messageId, mimeType, contentLength } = params;

  if (!isAllowedVoiceMimeType(mimeType)) {
    throw Object.assign(new Error(`Unsupported audio type: ${normalizeBaseMimeType(mimeType)}`), { status: 415 });
  }
  if (contentLength <= 0) {
    throw Object.assign(new Error("contentLength must be > 0"), { status: 400 });
  }
  if (contentLength > VOICE_LIMITS.maxBytes) {
    throw Object.assign(
      new Error(`Voice note too large: max ${VOICE_LIMITS.maxBytes / 1024 / 1024} MB`),
      { status: 413 }
    );
  }

  const safeCode = sanitizeObjectKeySegment(lobbyCode);
  const safeId = sanitizeObjectKeySegment(messageId);
  const ext = mimeTypeToExtension(mimeType);
  const objectKey = `voice/${safeCode}/${safeId}.${ext}`;

  const client = getR2Client();
  // The ContentType in the presigned command must exactly match the
  // Content-Type header the client will send in the PUT request.
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: objectKey,
    ContentType: mimeType,
    ContentLength: contentLength,
  });

  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn: PRESIGNED_EXPIRY_SECONDS,
  });

  if (!R2_PUBLIC_URL) {
    throw Object.assign(
      new Error("R2_PUBLIC_URL is required for voice notes. Set it to your bucket's public base URL."),
      { status: 503 }
    );
  }

  const publicUrl = `${R2_PUBLIC_URL}/${objectKey}`;
  return { uploadUrl, objectKey, publicUrl, expiresInSeconds: PRESIGNED_EXPIRY_SECONDS };
}

export async function deleteVoiceObject(objectKey: string): Promise<void> {
  const client = getR2Client();
  await client.send(
    new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: objectKey })
  );
}
