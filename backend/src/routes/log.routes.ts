import express from "express";
import { createLog, listLogs } from "../controllers/log.controller";

const router = express.Router();

router.get("/", listLogs);
router.post("/", createLog);

export default router;
