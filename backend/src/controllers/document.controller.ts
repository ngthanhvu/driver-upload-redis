import { randomUUID } from "crypto";
import { Request, Response } from "express";
import {
    S3RequestError,
    deleteObject,
    getObject,
    headObject,
    listObjectKeys,
    putObject
} from "../config/s3";

const ONE_HOUR_SECONDS = 60 * 60;
const MAX_EXTENSION_MINUTES = 12 * 60;

type StoredDocumentMeta = {
    id: string;
    originalName: string;
    contentType: string;
    size: number;
    permanent: boolean;
    createdAt: number;
    expiresAt: number | null;
};

const safeFilename = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return "";
    return trimmed.replace(/[\\/?%*:|"<>]/g, "_");
};

const toUnixMs = (value: string | null | undefined) => {
    if (!value) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const isPermanent = (value: string | null | undefined) =>
    (value || "").toLowerCase() === "true";

const parseMetaFromHeaders = (id: string, headers: Record<string, string>): StoredDocumentMeta => {
    const originalName = decodeURIComponent(
        headers["x-amz-meta-original-name"] || headers["x-amz-meta-originalname"] || ""
    );
    const contentType =
        headers["x-amz-meta-content-type"] ||
        headers["content-type"] ||
        "application/octet-stream";
    const size = Number(headers["content-length"] || 0);
    const permanent = isPermanent(headers["x-amz-meta-permanent"]);
    const createdAt = toUnixMs(headers["x-amz-meta-created-at"]) || Date.now();
    const expiresAtRaw = toUnixMs(headers["x-amz-meta-expires-at"]);

    return {
        id,
        originalName: originalName || `document-${id}`,
        contentType,
        size,
        permanent,
        createdAt,
        expiresAt: permanent ? null : expiresAtRaw
    };
};

const buildListItem = (meta: StoredDocumentMeta, now: number) => {
    const expiresInSeconds =
        meta.expiresAt === null ? null : Math.max(0, Math.ceil((meta.expiresAt - now) / 1000));

    return {
        ...meta,
        expiresInSeconds,
        downloadUrl: `/api/documents/${meta.id}`
    };
};

const isExpired = (meta: StoredDocumentMeta, now: number) =>
    !meta.permanent && typeof meta.expiresAt === "number" && meta.expiresAt <= now;

const loadDocumentMeta = async (id: string) => {
    try {
        const { headers } = await headObject(id);
        return parseMetaFromHeaders(id, headers);
    } catch (error) {
        if (error instanceof S3RequestError && error.status === 404) {
            return null;
        }
        throw error;
    }
};

const saveDocumentToS3 = async ({
    id,
    file,
    expiresAt,
    permanent,
    createdAt
}: {
    id: string;
    file: Express.Multer.File;
    expiresAt: number | null;
    permanent: boolean;
    createdAt: number;
}) => {
    await putObject({
        key: id,
        body: file.buffer,
        contentType: file.mimetype || "application/octet-stream",
        metadata: {
            "original-name": encodeURIComponent(file.originalname),
            "content-type": file.mimetype || "application/octet-stream",
            "created-at": String(createdAt),
            permanent: String(permanent),
            ...(expiresAt ? { "expires-at": String(expiresAt) } : {})
        }
    });
};

const handleUpload = async (req: Request, res: Response, permanent: boolean) => {
    const file = req.file;
    if (!file) {
        return res.status(400).json({ message: "File is required." });
    }

    const id = randomUUID();
    const createdAt = Date.now();
    const expiresAt = permanent ? null : createdAt + ONE_HOUR_SECONDS * 1000;

    await saveDocumentToS3({
        id,
        file,
        expiresAt,
        permanent,
        createdAt
    });

    return res.status(201).json({
        id,
        permanent,
        createdAt,
        expiresInSeconds: permanent ? null : ONE_HOUR_SECONDS,
        expiresAt,
        downloadUrl: `/api/documents/${id}`
    });
};

export const uploadDocument = async (req: Request, res: Response) => handleUpload(req, res, false);

export const uploadPermanentDocument = async (req: Request, res: Response) =>
    handleUpload(req, res, true);

export const listDocuments = async (_req: Request, res: Response) => {
    const keys = await listObjectKeys();

    if (keys.length === 0) {
        return res.status(200).json({ items: [] });
    }

    const now = Date.now();
    const items: ReturnType<typeof buildListItem>[] = [];

    for (const key of keys) {
        const meta = await loadDocumentMeta(key);
        if (!meta) continue;

        if (isExpired(meta, now)) {
            await deleteObject(key).catch(() => undefined);
            continue;
        }

        items.push(buildListItem(meta, now));
    }

    items.sort((a, b) => {
        if (a.permanent !== b.permanent) {
            return Number(a.permanent) - Number(b.permanent);
        }
        if (a.permanent) {
            return b.createdAt - a.createdAt;
        }
        return (a.expiresAt || 0) - (b.expiresAt || 0);
    });

    return res.status(200).json({ items });
};

export const downloadDocument = async (req: Request, res: Response) => {
    const { id } = req.params;
    const meta = await loadDocumentMeta(id);

    if (!meta) {
        return res.status(404).json({ message: "File not found or expired." });
    }

    const now = Date.now();
    if (isExpired(meta, now)) {
        await deleteObject(id).catch(() => undefined);
        return res.status(404).json({ message: "File not found or expired." });
    }

    const fallbackName = `document-${id}`;
    const filename = safeFilename(meta.originalName) || fallbackName;

    res.setHeader("Content-Type", meta.contentType || "application/octet-stream");
    res.setHeader("Content-Length", meta.size);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("x-document-permanent", String(meta.permanent));
    if (meta.expiresAt !== null) {
        res.setHeader("x-document-expires-at", String(meta.expiresAt));
    }

    if (req.method === "HEAD") {
        return res.status(200).end();
    }

    const { buffer } = await getObject(id);
    return res.status(200).send(buffer);
};

export const extendDocument = async (req: Request, res: Response) => {
    const { id } = req.params;
    const rawMinutes = Number(req.body?.minutes);

    if (!Number.isFinite(rawMinutes) || rawMinutes <= 0) {
        return res.status(400).json({ message: "Minutes must be a positive number." });
    }

    if (rawMinutes > MAX_EXTENSION_MINUTES) {
        return res.status(400).json({ message: "Maximum extension is 720 minutes." });
    }

    const meta = await loadDocumentMeta(id);
    if (!meta) {
        return res.status(404).json({ message: "File not found or expired." });
    }

    if (meta.permanent) {
        return res.status(400).json({ message: "Permanent file does not need extension." });
    }

    if (isExpired(meta, Date.now())) {
        await deleteObject(id).catch(() => undefined);
        return res.status(404).json({ message: "File not found or expired." });
    }

    const now = Date.now();
    const newExpiresAt = now + rawMinutes * 60 * 1000;

    const { buffer } = await getObject(id);

    await putObject({
        key: id,
        body: buffer,
        contentType: meta.contentType,
        metadata: {
            "original-name": encodeURIComponent(meta.originalName),
            "content-type": meta.contentType,
            "created-at": String(meta.createdAt),
            permanent: "false",
            "expires-at": String(newExpiresAt)
        }
    });

    return res.status(200).json({
        id,
        permanent: false,
        expiresAt: newExpiresAt,
        expiresInSeconds: Math.max(1, Math.ceil((newExpiresAt - now) / 1000))
    });
};

let isCleanupRunning = false;

export const cleanupExpiredDocuments = async () => {
    if (isCleanupRunning) return;
    isCleanupRunning = true;

    try {
        const keys = await listObjectKeys();
        const now = Date.now();

        for (const key of keys) {
            const meta = await loadDocumentMeta(key);
            if (!meta) continue;

            if (isExpired(meta, now)) {
                await deleteObject(key).catch(() => undefined);
            }
        }
    } finally {
        isCleanupRunning = false;
    }
};
