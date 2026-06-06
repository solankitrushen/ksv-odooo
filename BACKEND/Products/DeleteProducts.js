import products from "../Schema/product.js";

const DeleteProducts = async (req, res) => {
  const { productId } = req.body;
  try {
    const deleteProduct = await products.deleteOne({ productId });
    if (deleteProduct) {
      res.json({ message: "product deleted", deleteProduct });
    } else {
      res.json({ message: "error deleting product" });
    }
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "An error occurred while deleting the todo" });
  }
};
export default DeleteProducts;
