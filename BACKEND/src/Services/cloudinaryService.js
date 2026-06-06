import { v2 as cloudinary } from "cloudinary";
import { logger } from "../Utils/logger.js";

let configured = false;

function ensureConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    return false;
  }
  if (!configured) {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
    configured = true;
  }
  return true;
}

export function isCloudinaryEnabled() {
  return ensureConfig();
}

/**
 * Upload buffer to Cloudinary. Returns secure URL or null if not configured.
 */
export async function uploadImageBuffer(buffer, options = {}) {
  if (!ensureConfig()) {
    return null;
  }

  const folder = options.folder || "instacafe/menu";
  const mimetype = options.mimetype || "image/jpeg";

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        format: mimetype.includes("png") ? "png" : "jpg",
        transformation: [
          { width: 800, height: 600, crop: "limit", quality: "auto:good" },
        ],
      },
      (err, result) => {
        if (err) {
          logger.error("Cloudinary upload failed", { error: err.message });
          return reject(err);
        }
        resolve(result?.secure_url || null);
      }
    );
    uploadStream.end(buffer);
  });
}

export async function deleteImageByUrl(url) {
  if (!ensureConfig() || !url?.includes("cloudinary.com")) {
    return;
  }
  try {
    const match = url.match(/\/v\d+\/(.+)\.\w+$/);
    if (match?.[1]) {
      await cloudinary.uploader.destroy(match[1], { resource_type: "image" });
    }
  } catch (err) {
    logger.warn("Cloudinary delete skipped", { error: err.message });
  }
}
