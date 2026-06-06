import path from "path";
import { dirname } from "path";
import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));

export const GetProductImg = (req, res) => {
  const imageName = req.params.imageName;
  const imagePath = path.join(__dirname, "productImg", imageName);

  // Send the image file as a response
  res.sendFile(imagePath);
};
