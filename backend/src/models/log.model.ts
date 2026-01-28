import mongoose, { Schema, Document } from "mongoose";

export type LogLevel = "info" | "warn" | "error";

export interface ILog extends Document {
    level: LogLevel;
    message: string;
    meta?: Record<string, unknown>;
}

const logSchema = new Schema<ILog>(
    {
        level: {
            type: String,
            enum: ["info", "warn", "error"],
            default: "info",
            required: true
        },
        message: { type: String, required: true },
        meta: { type: Schema.Types.Mixed, default: undefined }
    },
    { timestamps: true }
);

export default mongoose.model<ILog>("Log", logSchema);
