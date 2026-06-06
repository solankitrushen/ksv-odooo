import products from "../Schema/product.js";

const GetProducts = async (req, res) => {
  try {
    const { productId } = await req.query;
    const query = {};

    if (productId) {
      query.productId = productId;
    }

    const findProducts = await products.find(query);
    res.status(200).json({ findProducts });
  } catch (err) {
    res.status(500).json({ error: err.message });
    console.log(err);
  }
};
export default GetProducts;
