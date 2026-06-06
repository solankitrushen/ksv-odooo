import request from "supertest";

export async function placeOrder(app, userCookie, { storeId, itemId, overrides = {} }) {
  return request(app)
    .post("/api/v1/user/orders")
    .set("Cookie", userCookie)
    .send({
      storeId: String(storeId),
      deliveryType: "takeaway",
      items: [{ menuItemId: String(itemId), quantity: 1 }],
      ...overrides,
    });
}
