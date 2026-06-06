import Cart from "../Schema/Cart.js";

export const GetCarts = async (req, res) => {
  try {
    if (!req.legacyUser?.cartId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Force the cartId to the JWT-resolved value. Client-supplied
    // ?cartId=… is ignored so users cannot probe other carts.
    const cartId = req.legacyUser.cartId;
    const data = await Cart.find({ cartId });
    return res.status(200).json({ existedOrder: data });
  } catch (err) {
    console.error("GetCarts error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
};
