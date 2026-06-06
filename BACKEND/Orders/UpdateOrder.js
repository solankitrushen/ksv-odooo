import Order from "../Schema/Order.js";

const STATUS_ALLOWED_BY_ROLE = {
  shopkeeper: new Set(["pending", "approved", "canceled", "attended"]),
  branchmanager: new Set(["pending", "approved", "canceled", "attended"]),
  employee: new Set([]), // employees cannot change Status
};

export const UpdateOrder = async (req, res) => {
  try {
    if (!req.legacyUser) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const orderData = req.body || {};
    if (!orderData.orderId) {
      return res.status(400).json({ error: "orderId required" });
    }

    const query = { orderId: orderData.orderId };
    // Employees can only mutate their own cart's orders.
    if (req.legacyUser.role === "employee") {
      query.cartId = req.legacyUser.cartId;
    }

    const existing = await Order.findOne(query);
    if (!existing) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Drop fields the caller is not allowed to set. cartId is never
    // mutable client-side.
    const updateDoc = { ...orderData };
    delete updateDoc.cartId;
    delete updateDoc._id;

    if (updateDoc.Status) {
      const allowed = STATUS_ALLOWED_BY_ROLE[req.legacyUser.role] || new Set();
      if (!allowed.has(updateDoc.Status)) {
        return res.status(403).json({ error: "Not allowed to set Status" });
      }
    }

    const updatedOrder = await Order.updateOne(
      { _id: existing._id },
      { $set: updateDoc }
    );
    return res
      .status(200)
      .json({ message: "Order updated successfully", updatedOrder });
  } catch (err) {
    console.error("UpdateOrder error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
};
