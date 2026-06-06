import Store from "../Schema/Store.js";
import { sendError, sendSuccess } from "../Utils/errorResponse.js";

export async function updateStoreLocation(req, res) {
  const { latitude, longitude } = req.validated;
  const updated = await Store.findOneAndUpdate(
    { _id: req.userId, isActive: true },
    { $set: { "location.latitude": latitude, "location.longitude": longitude } },
    { new: true }
  );
  if (!updated) {
    return sendError(res, 404, "Not found", "Store not found");
  }
  return sendSuccess(res, 200, {
    location: updated.location,
    message: "Store location updated",
  });
}

export async function getStoreProfile(req, res) {  const store = await Store.findById(req.userId);
  if (!store) {
    return sendError(res, 404, "Not found", "Store not found");
  }
  return sendSuccess(res, 200, { store: store.toJSON() });
}

export async function updateStoreProfile(req, res) {
  const update = {};
  const allowed = ["name", "upiId", "cuisineTypes"];
  for (const key of allowed) {
    if (req.validated[key] !== undefined) update[key] = req.validated[key];
  }
  if (req.validated.address) {
    for (const [k, v] of Object.entries(req.validated.address)) {
      update[`address.${k}`] = v;
    }
  }
  if (req.validated.owner) {
    for (const [k, v] of Object.entries(req.validated.owner)) {
      update[`owner.${k}`] = v;
    }
  }
  if (Object.keys(update).length === 0) {
    return sendError(res, 400, "Validation", "No updatable fields supplied");
  }
  const updated = await Store.findOneAndUpdate(
    { _id: req.userId, isActive: true },
    { $set: update },
    { new: true }
  );
  if (!updated) {
    return sendError(res, 404, "Not found", "Store not found");
  }
  return sendSuccess(res, 200, { store: updated.toJSON() });
}

export async function updateStoreOrdering(req, res) {
  const update = {};
  for (const [k, v] of Object.entries(req.validated)) {
    update[`ordering.${k}`] = v;
  }
  const updated = await Store.findOneAndUpdate(
    { _id: req.userId, isActive: true },
    { $set: update },
    { new: true, runValidators: true }
  );
  if (!updated) {
    return sendError(res, 404, "Not found", "Store not found");
  }
  return sendSuccess(res, 200, {
    ordering: updated.ordering,
    message: "Ordering settings updated",
  });
}
