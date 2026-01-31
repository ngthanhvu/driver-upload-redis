import express from "express";
import multer from "multer";
import {
    downloadDocument,
    extendDocument,
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
router.post("/:id/extend", express.json(), extendDocument);
router.get("/:id", downloadDocument);

export default router;
