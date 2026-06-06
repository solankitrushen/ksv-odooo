import MenuItem from "../Schema/MenuItem.js";

export async function reserveMenuStock(lines) {
  const reserved = [];

  for (const line of lines) {
    if (!line.menuItemId) continue;
    const qty = line.quantity;

    const updated = await MenuItem.findOneAndUpdate(
      {
        _id: line.menuItemId,
        isActive: true,
        $expr: {
          $gte: [{ $subtract: ["$stock", "$stockReserved"] }, qty],
        },
      },
      { $inc: { stockReserved: qty } },
      { new: true }
    );

    if (!updated) {
      await releaseMenuStock(reserved);
      return {
        ok: false,
        message: `Insufficient stock for "${line.name || "item"}"`,
      };
    }
    reserved.push({ menuItemId: line.menuItemId, quantity: qty });
  }

  return { ok: true, reserved };
}

export async function releaseMenuStock(reserved = []) {
  for (const r of reserved) {
    await MenuItem.updateOne(
      { _id: r.menuItemId },
      { $inc: { stockReserved: -r.quantity } }
    );
  }
}

export async function releaseOrderStock(order) {
  const reserved = (order.items || [])
    .filter((l) => l.menuItemId)
    .map((l) => ({ menuItemId: l.menuItemId, quantity: l.quantity }));
  await releaseMenuStock(reserved);
}

export async function consumeOrderStock(order) {
  for (const line of order.items || []) {
    if (!line.menuItemId) continue;
    await MenuItem.updateOne(
      { _id: line.menuItemId },
      {
        $inc: {
          stock: -line.quantity,
          stockReserved: -line.quantity,
        },
      }
    );
  }
}
