import { z } from "zod";

const optionalTrimmedString = (max: number) =>
  z.preprocess((value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }, z.string().max(max).optional());

const optionalTrimmedUrl = (max: number) =>
  z.preprocess((value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }, z.string().url().max(max).optional());

const requiredTrimmedUrl = (max: number) =>
  z.preprocess((value) => {
    if (typeof value !== "string") return value;
    return value.trim();
  }, z.string().url().max(max));

export const BUG_REPORT_SCREENSHOT_LIMITS = {
  maxBytes: 1024 * 1024,
  maxWidth: 960,
  maxHeight: 540,
} as const;

export const BUG_REPORT_DIAGNOSTIC_LIMITS = {
  maxRecentActions: 20,
  maxRecentErrors: 10,
  maxRecentLogs: 25,
} as const;

export const BugReportSourceSchema = z.enum([
  "desktop_corner",
  "mobile_menu",
  "error_prompt",
]);

export const BugReportCategorySchema = z.enum([
  "gameplay",
  "ui",
  "performance",
  "crash",
  "multiplayer",
  "audio",
  "save_load",
  "other",
]);

export const BugReportReproFrequencySchema = z.enum([
  "always",
  "sometimes",
  "once",
  "unknown",
]);

export const BugReportSubmissionIdSchema = z
  .string()
  .trim()
  .min(8)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]+$/);

export const BugReportScreenshotMimeTypeSchema = z.enum([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const SubmitBugReportSchema = z.object({
  submissionId: BugReportSubmissionIdSchema,
  source: BugReportSourceSchema,
  category: BugReportCategorySchema,
  playerMessage: z.string().trim().min(10).max(4000),
  expectedBehavior: optionalTrimmedString(2000),
  reproFrequency: BugReportReproFrequencySchema,
  contact: optionalTrimmedString(200),
  includeDiagnostics: z.boolean(),
  includeScreenshot: z.boolean(),
  screenshotUrl: optionalTrimmedUrl(500),
  diagnostics: z.record(z.unknown()).optional(),
  clientTimestampMs: z.number().int().nonnegative(),
});

export const SubmitBugReportResponseSchema = z.object({
  reportId: z.string(),
  duplicateCount24h: z.number().int().nonnegative(),
  fingerprint: z.string(),
  receivedAt: z.string(),
  queued: z.boolean().optional(),
});

export const BugReportScreenshotUploadRequestSchema = z.object({
  submissionId: BugReportSubmissionIdSchema,
  mimeType: BugReportScreenshotMimeTypeSchema,
  contentLength: z
    .number()
    .int()
    .positive()
    .max(BUG_REPORT_SCREENSHOT_LIMITS.maxBytes),
});

export const BugReportScreenshotCleanupRequestSchema = z.object({
  submissionId: BugReportSubmissionIdSchema,
  screenshotUrl: requiredTrimmedUrl(500),
});

export const BugReportScreenshotUploadResponseSchema = z.object({
  uploadUrl: z.string().url(),
  objectKey: z.string(),
  publicUrl: z.string().url(),
  expiresInSeconds: z.number().int().positive(),
});

export type BugReportSource = z.infer<typeof BugReportSourceSchema>;
export type BugReportCategory = z.infer<typeof BugReportCategorySchema>;
export type BugReportReproFrequency = z.infer<typeof BugReportReproFrequencySchema>;
export type SubmitBugReportRequest = z.infer<typeof SubmitBugReportSchema>;
export type SubmitBugReportResponse = z.infer<typeof SubmitBugReportResponseSchema>;
export type BugReportScreenshotUploadRequest = z.infer<typeof BugReportScreenshotUploadRequestSchema>;
export type BugReportScreenshotCleanupRequest = z.infer<typeof BugReportScreenshotCleanupRequestSchema>;
export type BugReportScreenshotUploadResponse = z.infer<typeof BugReportScreenshotUploadResponseSchema>;
