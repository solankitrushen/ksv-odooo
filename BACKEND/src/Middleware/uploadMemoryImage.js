import multer from "multer";
import { MENU_IMAGE } from "../../config/constants.js";

const storage = multer.memoryStorage();

function fileFilter(_req, file, cb) {
  if (!MENU_IMAGE.mimeTypes.includes(file.mimetype)) {
    return cb(new Error(`Unsupported image format: ${file.mimetype}`));
  }
  cb(null, true);
}

export const uploadMemoryImage = multer({
  storage,
  limits: { fileSize: MENU_IMAGE.maxBytes },
  fileFilter,
}).single("image");

export { handleUploadError } from "./uploadMenuImage.js";
