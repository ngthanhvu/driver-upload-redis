import { Request, Response } from "express";
import Log, { LogLevel } from "../models/log.model";

const allowedLevels: LogLevel[] = ["info", "warn", "error"];

export const createLog = async (req: Request, res: Response) => {
    const { level, message, meta } = req.body as {
        level?: LogLevel;
        message?: string;
        meta?: Record<string, unknown>;
    };

    if (!message || typeof message !== "string") {
        return res.status(400).json({ message: "message is required." });
    }

    if (level && !allowedLevels.includes(level)) {
        return res.status(400).json({ message: "level is invalid." });
    }

    const log = await Log.create({
        level: level || "info",
        message,
        meta
    });

    return res.status(201).json(log);
};

export const listLogs = async (req: Request, res: Response) => {
    const rawLimit = Number(req.query.limit);
    const limit = Number.isFinite(rawLimit)
        ? Math.min(Math.max(rawLimit, 1), 200)
        : 50;

    const logs = await Log.find()
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

    return res.status(200).json({ items: logs });
};
