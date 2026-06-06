import path from "path";
import { dirname } from "path";
import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));

export const GetCategoryImg = (req, res) => {
  const imageName = req.params.imageName;
  const imagePath = path.join(__dirname, "categoryImg", imageName);

  // Send the image file as a response
  res.sendFile(imagePath);
};
