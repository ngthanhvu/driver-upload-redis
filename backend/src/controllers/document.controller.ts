import { Request, Response } from "express";
import { randomUUID } from "crypto";
import { redisClient } from "../config/redis";

const ONE_HOUR_SECONDS = 60 * 60;

const safeFilename = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return "";
    return trimmed.replace(/[\\/?%*:|"<>]/g, "_");
};

export const uploadDocument = async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) {
        return res.status(400).json({ message: "File is required." });
    }

    const id = randomUUID();
    const expiresAt = Date.now() + ONE_HOUR_SECONDS * 1000;
    const payload = {
        id,
        originalName: file.originalname,
        contentType: file.mimetype,
        size: file.size,
        data: file.buffer.toString("base64")
    };

    const metadata = {
        id,
        originalName: file.originalname,
        contentType: file.mimetype,
        size: file.size,
        expiresAt
    };

    await redisClient
        .multi()
        .set(`doc:${id}`, JSON.stringify(payload), { EX: ONE_HOUR_SECONDS })
        .set(`docmeta:${id}`, JSON.stringify(metadata), { EX: ONE_HOUR_SECONDS })
        .exec();

    return res.status(201).json({
        id,
        expiresInSeconds: ONE_HOUR_SECONDS,
        downloadUrl: `/api/documents/${id}`,
        expiresAt
    });
};

export const listDocuments = async (_req: Request, res: Response) => {
    const keys: string[] = [];
    for await (const key of redisClient.scanIterator({
        MATCH: "docmeta:*",
        COUNT: 100
    })) {
        keys.push(key);
    }

    if (keys.length === 0) {
        return res.status(200).json({ items: [] });
    }

    const values = await redisClient.mGet(keys);
    const now = Date.now();
    const items = values
        .map((raw) => {
            if (!raw) return null;
            const meta = JSON.parse(raw) as {
                id: string;
                originalName: string;
                contentType: string;
                size: number;
                expiresAt: number;
            };
            const expiresInSeconds = Math.max(
                0,
                Math.ceil((meta.expiresAt - now) / 1000)
            );

            return {
                ...meta,
                expiresInSeconds,
                downloadUrl: `/api/documents/${meta.id}`
            };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null)
        .sort((a, b) => a.expiresAt - b.expiresAt);

    return res.status(200).json({ items });
};

export const downloadDocument = async (req: Request, res: Response) => {
    const { id } = req.params;
    const raw = await redisClient.get(`doc:${id}`);

    if (!raw) {
        return res.status(404).json({ message: "File not found or expired." });
    }

    const parsed = JSON.parse(raw) as {
        originalName: string;
        contentType: string;
        data: string;
    };

    const buffer = Buffer.from(parsed.data, "base64");
    const fallbackName = `document-${id}`;
    const filename = safeFilename(parsed.originalName) || fallbackName;

    res.setHeader("Content-Type", parsed.contentType || "application/octet-stream");
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    return res.status(200).send(buffer);
};
