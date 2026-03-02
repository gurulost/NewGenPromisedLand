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

export const VOICE_LIMITS = {
  maxDurationMs: 180_000,
  maxBytes: 8_388_608,
  allowedMimeTypes: new Set([
    "audio/webm",
    "audio/ogg",
    "audio/mp4",
    "audio/mpeg",
    "audio/wav",
    "audio/x-m4a",
  ]),
} as const;

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

  if (!VOICE_LIMITS.allowedMimeTypes.has(mimeType as any)) {
    throw Object.assign(new Error(`Unsupported audio type: ${mimeType}`), { status: 415 });
  }
  if (contentLength > VOICE_LIMITS.maxBytes) {
    throw Object.assign(
      new Error(`Voice note too large: ${contentLength} bytes (max ${VOICE_LIMITS.maxBytes})`),
      { status: 413 }
    );
  }
  if (contentLength <= 0) {
    throw Object.assign(new Error("contentLength must be > 0"), { status: 400 });
  }

  const ext = mimeType.split("/")[1]?.split(";")[0] ?? "webm";
  const objectKey = `voice/${lobbyCode}/${messageId}.${ext}`;

  const client = getR2Client();
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: objectKey,
    ContentType: mimeType,
    ContentLength: contentLength,
  });

  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn: PRESIGNED_EXPIRY_SECONDS,
  });

  const publicUrl = R2_PUBLIC_URL
    ? `${R2_PUBLIC_URL}/${objectKey}`
    : uploadUrl.split("?")[0];

  return { uploadUrl, objectKey, publicUrl, expiresInSeconds: PRESIGNED_EXPIRY_SECONDS };
}

export async function deleteVoiceObject(objectKey: string): Promise<void> {
  const client = getR2Client();
  await client.send(
    new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: objectKey })
  );
}
