import { Request, Response, NextFunction } from "express";

const requireUploadAuth = (req: Request, res: Response, next: NextFunction) => {
    const configuredToken = process.env.UPLOAD_AUTH_TOKEN;

    if (!configuredToken) {
        return res.status(500).json({
            message: "UPLOAD_AUTH_TOKEN is not configured on server."
        });
    }

    const header = req.get("authorization") || "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";

    if (!token || token !== configuredToken) {
        return res.status(401).json({ message: "Unauthorized upload token." });
    }

    next();
};

export default requireUploadAuth;
