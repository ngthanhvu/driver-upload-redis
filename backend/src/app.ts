import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { ensureBucket } from "./config/s3";
import connectDB from "./config/database";
import {
    cleanupExpiredDocuments
} from "./controllers/document.controller";
import requestLogger from "./middleware/request-logger";
import documentRoutes from "./routes/document.routes";
import logRoutes from "./routes/log.routes";

dotenv.config();
connectDB();

void ensureBucket()
    .then(() => {
        console.log("✅ MinIO bucket is ready");
    })
    .catch((error) => {
        console.error("❌ MinIO initialization error:", error);
        process.exit(1);
    });

const cleanupIntervalMs = 60 * 1000;
setInterval(() => {
    void cleanupExpiredDocuments().catch((error) => {
        console.error("❌ Failed to cleanup expired documents:", error);
    });
}, cleanupIntervalMs);

void cleanupExpiredDocuments().catch((error) => {
    console.error("❌ Failed to cleanup expired documents:", error);
});

const app = express();
app.use(
    cors({
        origin: process.env.CORS_ORIGIN || "*"
    })
);
app.use(express.json());
app.use(requestLogger);

app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
});

app.use("/api/documents", documentRoutes);
app.use("/api/logs", logRoutes);

export default app;
