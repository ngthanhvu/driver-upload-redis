import express from "express";
import multer from "multer";
import {
    downloadDocument,
    listDocuments,
    uploadDocument
} from "../controllers/document.controller";

const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 20 * 1024 * 1024
    }
});

router.get("/", listDocuments);
router.post("/", upload.single("file"), uploadDocument);
router.get("/:id", downloadDocument);

export default router;
