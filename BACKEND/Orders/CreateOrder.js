import Order from "../Schema/Order.js";

export const CreateOrder = async (req, res) => {
  try {
    if (!req.legacyUser?.cartId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const orderData = {
      ...(req.body || {}),
      cartId: req.legacyUser.cartId,
    };
    if (!orderData.orderId) {
      return res.status(400).json({ error: "orderId required" });
    }

    const existedOrder = await Order.findOne({
      cartId: orderData.cartId,
      orderId: orderData.orderId,
    });
    if (existedOrder) {
      return res.status(409).json({ error: "Order already exists" });
    }

    const createdOrder = await Order.create(orderData);
    return res
      .status(201)
      .json({ message: "Order created successfully", createdOrder });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "Duplicate orderId" });
    }
    console.error("CreateOrder error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
};
