import crypto from "crypto";
import multer from "multer";
import path from "path";
import { MENU_IMAGE } from "../../config/constants.js";
import { ensureMenuUploadDir } from "../Utils/menuPaths.js";

// Map HEIC/HEIF to .jpg on disk since most image processors can't serve HEIC directly.
// All other types preserve their original extension.
const HEIC_TYPES = new Set(["image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence"]);

function resolveExt(file) {
  if (HEIC_TYPES.has(file.mimetype)) return ".jpg";
  const ext = path.extname(file.originalname).toLowerCase();
  // Fallback by mimetype if extension is missing
  const mimeExt = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/bmp": ".bmp",
    "image/tiff": ".tiff",
    "image/avif": ".avif",
    "image/svg+xml": ".svg",
  };
  return ext || mimeExt[file.mimetype] || ".jpg";
}

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, ensureMenuUploadDir());
  },
  filename(_req, file, cb) {
    cb(null, `${crypto.randomUUID()}${resolveExt(file)}`);
  },
});

function fileFilter(_req, file, cb) {
  if (!MENU_IMAGE.mimeTypes.includes(file.mimetype)) {
    return cb(new Error(`Unsupported image format: ${file.mimetype}`));
  }
  cb(null, true);
}

export const uploadMenuImage = multer({
  storage,
  limits: { fileSize: MENU_IMAGE.maxBytes },
  fileFilter,
}).single("image");

export function handleUploadError(err, req, res, next) {
  if (!err) return next();
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      success: false,
      error: "File too large",
      message: `Image must be under ${MENU_IMAGE.maxBytes / 1024 / 1024}MB`,
    });
  }
  if (err.message?.includes("Unsupported image format")) {
    return res.status(400).json({
      success: false,
      error: "Invalid file",
      message: err.message,
    });
  }
  return next(err);
}
