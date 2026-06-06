import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
function DeleteProductImg(filename) {
  console.log({ filename });
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  return new Promise((resolve, reject) => {
    const imagePath = path.join(__dirname, "productImg", filename); // Assuming the images are in the 'BannerImg' directory.

    fs.unlink(imagePath, (err) => {
      if (err) {
        console.error("Error deleting image:", err);
        reject(err);
      } else {
        console.log("Image deleted:", filename);
        resolve();
      }
    });
  });
}

export { DeleteProductImg };
