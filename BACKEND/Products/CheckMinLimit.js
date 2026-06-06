import products from "../Schema/product.js";

const CheckMinLimit = async (req, res) => {
  try {
    const findProducts = await products.find({});
    const minProducts = [];

    for (const product of findProducts) {
      if (product.quantityInStock <= product.minQty) {
        minProducts.push(product);
      }
    }

    if (minProducts.length > 0) {
      res.status(200).json({ min: true, findProducts: minProducts });
    } else {
      res
        .status(200)
        .json({
          message: "No products found that meet the condition",
          min: false,
        });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
    console.log(err);
  }
};

export default CheckMinLimit;
