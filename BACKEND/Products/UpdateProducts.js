import products from "../Schema/product.js";

const UpdateProducts = async (req, res) => {
  console.log(req.body);
  const productData = req.body;
  try {
    if (productData) {
      const findProduct = await products.findOne({
        productId: productData.productId,
      });
      if (findProduct) {
        const updateProduct = await products.updateOne(
          { productId: productData.productId },
          productData
        );

        if (updateProduct) {
          res.json({ message: "product has been updated", updateProduct });
        } else {
          res.status(404).json("product not found");
        }
      } else {
        res.status(500).json(`please add the product data in body`);
      }
    }
  } catch (err) {
    console.error("Database error:", err); // Log the specific error
    res
      .status(500)
      .json({ error: "An error occurred while updating the product" });
  }
};

export default UpdateProducts;

const UpdateProductsQty = async (req, res) => {
  console.log(req.body);
  let { Quantity } = req.query;
  const productData = req.body;
  Quantity = parseInt(Quantity, 10);
  console.log({ productData });
  try {
    if (productData) {
      const findProduct = await products.findOne({
        productId: productData.productId,
      });

      if (findProduct) {
        console.log(findProduct);
        // Check if Quantity is provided and is a valid number
        if (typeof Quantity === "number") {
          // Calculate the new quantityInStock
          const newQuantityInStock = findProduct.quantityInStock - Quantity;

          // Update the product's quantityInStock
          const updateProduct = await products.updateOne(
            { productId: productData.productId },
            { $set: { quantityInStock: newQuantityInStock } }
          );
          console.log({ updateProduct });
          if (updateProduct.modifiedCount > 0) {
            res.json({ message: "Product quantity has been updated" });
          } else {
            res.status(404).json("Product not found or quantity not updated");
          }
        } else {
          res.status(400).json("Quantity must be a valid number");
        }
      } else {
        res.status(500).json(`Please add the product data in the body`);
      }
    }
  } catch (err) {
    console.error("Database error:", err);
    res
      .status(500)
      .json({ error: "An error occurred while updating the product" });
  }
};

export { UpdateProductsQty };
