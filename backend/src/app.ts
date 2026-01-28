import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./config/database";
import connectRedis from "./config/redis";
import documentRoutes from "./routes/document.routes";
import logRoutes from "./routes/log.routes";
import requestLogger from "./middleware/request-logger";

dotenv.config();
connectDB();
connectRedis();

const app = express();
app.use(
    cors({
        origin: process.env.CORS_ORIGIN || "*"
    })
);
app.use(express.json());
app.use(requestLogger);

app.use("/api/documents", documentRoutes);
app.use("/api/logs", logRoutes);

export default app;
