import products from "../Schema/product.js";

const CreateProducts = async (req, res) => {
  try {
    const productData = req.body;
    console.log(productData);
    const createdProducts = [];

    for (const product of productData) {
      const createdProduct = await products.create(product);
      createdProducts.push(createdProduct);
    }

    if (createdProducts.length > 0) {
      res.json({ message: "Products created successfully", createdProducts });
    } else {
      res.json({ message: "No products were created" });
    }
  } catch (error) {
    console.error("Error creating products:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export default CreateProducts;
