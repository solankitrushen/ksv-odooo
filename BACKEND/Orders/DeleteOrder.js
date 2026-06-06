import Order from "../Schema/Order.js";

export const DeleteOrders = async (req, res) => {
  try {
    if (!req.legacyUser) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const { orderId } = req.query || {};
    if (!orderId) {
      return res.status(400).json({ error: "orderId required" });
    }

    const query = { orderId: Number(orderId) || orderId };
    // Employees can only delete their own pending orders.
    if (req.legacyUser.role === "employee") {
      query.cartId = req.legacyUser.cartId;
      query.Status = "pending";
    }

    const deletedOrders = await Order.deleteOne(query);
    if (deletedOrders.deletedCount === 0) {
      return res.status(404).json({ error: "Order not found" });
    }
    return res.status(200).json({ deletedOrders });
  } catch (err) {
    console.error("DeleteOrders error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
};
