import Order from "../Schema/Order.js";

export const GetOrders = async (req, res) => {
  try {
    if (!req.legacyUser) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const {
      cartId: qCartId,
      Status,
      orderId,
      EmployeeNotification,
      ShopkeeperNotification,
    } = req.query || {};

    const query = {};

    // Employees only see their own cart. Shopkeepers / branch managers
    // can browse all orders (or filter by a specific cartId).
    if (req.legacyUser.role === "employee") {
      query.cartId = req.legacyUser.cartId;
    } else if (qCartId) {
      query.cartId = Number(qCartId) || qCartId;
    }

    if (Status) query.Status = Status;
    if (orderId) query.orderId = Number(orderId) || orderId;
    if (EmployeeNotification !== undefined)
      query.EmployeeNotification = EmployeeNotification === "true";
    if (ShopkeeperNotification !== undefined)
      query.ShopkeeperNotification = ShopkeeperNotification === "true";

    const existedOrders = await Order.find(query).limit(100);
    return res.status(200).json({ existedOrders });
  } catch (err) {
    console.error("GetOrders error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
};
