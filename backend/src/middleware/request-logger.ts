import { Request, Response, NextFunction } from "express";
import Log from "../models/log.model";

const requestLogger = (req: Request, res: Response, next: NextFunction) => {
    const startedAt = Date.now();

    res.on("finish", () => {
        const durationMs = Date.now() - startedAt;
        const statusCode = res.statusCode;
        const level = statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "info";

        void Log.create({
            level,
            message: `${req.method} ${req.originalUrl}`,
            meta: {
                statusCode,
                durationMs,
                ip: req.ip,
                userAgent: req.get("user-agent") || null
            }
        }).catch((error) => {
            console.error("❌ Failed to write log:", error);
        });
    });

    next();
};

export default requestLogger;
