import express from "express";
import multer from "multer";
import {
    downloadDocument,
    extendDocument,
    listDocuments,
    uploadDocument,
    uploadPermanentDocument
} from "../controllers/document.controller";
import requireUploadAuth from "../middleware/upload-auth";

const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 20 * 1024 * 1024
    }
});

router.get("/", listDocuments);
router.post("/", upload.single("file"), uploadDocument);
router.post(
    "/permanent",
    requireUploadAuth,
    upload.single("file"),
    uploadPermanentDocument
);
router.post("/:id/extend", express.json(), extendDocument);
router.head("/:id", downloadDocument);
router.get("/:id", downloadDocument);

export default router;
