import Cart from "../Schema/Cart.js";

export const AddCart = async (req, res) => {
  try {
    if (!req.legacyUser?.cartId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Bind cartId to the authenticated user — refuse client overrides.
    const cartData = { ...(req.body || {}), cartId: req.legacyUser.cartId };
    const existedOrder = await Cart.findOne({ cartId: cartData.cartId });

    if (!existedOrder) {
      const createdOrder = await Cart.create(cartData);
      return res.status(201).json({ createdOrder });
    }

    const updatedOrder = await Cart.updateOne(
      { cartId: cartData.cartId },
      { $set: cartData }
    );
    return res.status(200).json({ updatedOrder });
  } catch (err) {
    console.error("AddCart error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export default AddCart;
