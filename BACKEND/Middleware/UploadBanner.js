import multer from "multer";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 2 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = "ProductImg/";
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const ext = (path.extname(file.originalname || "") || ".jpg")
      .toLowerCase()
      .replace(/[^a-z.]/g, "");
    const safeExt = [".jpg", ".jpeg", ".png", ".webp"].includes(ext)
      ? ext
      : ".jpg";
    cb(null, `${crypto.randomUUID()}${safeExt}`);
  },
});

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME.has(file.mimetype)) {
    return cb(new Error("Only JPEG / PNG / WebP images allowed"));
  }
  cb(null, true);
}

const UploadBanner = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_BYTES, files: 1 },
});

export default UploadBanner;
