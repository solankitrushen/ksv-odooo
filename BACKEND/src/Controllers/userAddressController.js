import User from "../Schema/User.js";
import { sendError, sendSuccess } from "../Utils/errorResponse.js";

function addressId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function formatAddress(addr, id) {
  const idx = addr._id || id;
  return { id: String(idx), ...addr.toObject ? addr.toObject() : addr, _id: undefined };
}

async function loadUser(req, res) {
  const user = await User.findById(req.userId);
  if (!user) {
    sendError(res, 404, "Not found", "User not found");
    return null;
  }
  return user;
}

function enforceSingleDefault(addresses, targetId) {
  let hasDefault = false;
  for (const addr of addresses) {
    if (addr.isDefault) {
      if (hasDefault && String(addr._id) !== targetId) {
        addr.isDefault = false;
      }
      hasDefault = true;
    }
  }
  if (!hasDefault && addresses.length > 0) {
    addresses[0].isDefault = true;
  }
  return addresses;
}

export async function listAddresses(req, res) {
  const user = await loadUser(req, res);
  if (!user) return;
  const addresses = (user.addresses || []).map((a) => formatAddress(a));
  return sendSuccess(res, 200, { addresses });
}

export async function createAddress(req, res) {
  const user = await loadUser(req, res);
  if (!user) return;

  const newAddr = { ...req.validated, _id: undefined };
  if (!user.addresses) user.addresses = [];

  if (newAddr.isDefault) {
    for (const a of user.addresses) a.isDefault = false;
  }
  if (user.addresses.length === 0) {
    newAddr.isDefault = true;
  }

  user.addresses.push(newAddr);
  enforceSingleDefault(user.addresses);

  if (user.addresses.length === 1 && !user.address?.street) {
    user.address = {
      street: newAddr.street,
      city: newAddr.city,
      zipCode: newAddr.zipCode,
    };
  }

  await user.save();
  const created = user.addresses[user.addresses.length - 1];
  return sendSuccess(res, 201, { address: formatAddress(created) });
}

export async function updateAddress(req, res) {
  const user = await loadUser(req, res);
  if (!user) return;

  const addrId = req.params.addressId;
  const index = user.addresses?.findIndex((a) => String(a._id) === addrId);
  if (index === undefined || index === -1) {
    return sendError(res, 404, "Not found", "Address not found");
  }

  const existing = user.addresses[index];
  Object.assign(existing, req.validated);
  user.addresses[index] = existing;

  if (req.validated.isDefault) {
    for (let i = 0; i < user.addresses.length; i++) {
      if (i !== index) user.addresses[i].isDefault = false;
    }
  }
  enforceSingleDefault(user.addresses, addrId);

  user.markModified("addresses");
  await user.save();
  return sendSuccess(res, 200, { address: formatAddress(user.addresses[index]) });
}

export async function deleteAddress(req, res) {
  const user = await loadUser(req, res);
  if (!user) return;

  const addrId = req.params.addressId;
  const before = user.addresses?.length || 0;
  user.addresses = (user.addresses || []).filter((a) => String(a._id) !== addrId);

  if (user.addresses.length === before) {
    return sendError(res, 404, "Not found", "Address not found");
  }

  enforceSingleDefault(user.addresses);
  user.markModified("addresses");
  await user.save();
  return sendSuccess(res, 200, { message: "Address removed" });
}

export async function setDefaultAddress(req, res) {
  const user = await loadUser(req, res);
  if (!user) return;

  const addrId = req.params.addressId;
  const addr = user.addresses?.find((a) => String(a._id) === addrId);
  if (!addr) {
    return sendError(res, 404, "Not found", "Address not found");
  }

  for (const a of user.addresses) a.isDefault = false;
  addr.isDefault = true;
  user.markModified("addresses");
  await user.save();

  return sendSuccess(res, 200, { address: formatAddress(addr) });
}
