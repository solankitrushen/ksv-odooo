import express, { Router } from "express";

import authenticateBrachManagerAccount from "./Auth/branchManagerAuth/authenticate.js";
import branchUser from "./Auth/branchManagerAuth/register.js";
import branchLogin from "./Auth/branchManagerAuth/login.js";
import authenticateEmployeeAccount from "./Auth/employeeAuth/authenticate.js";
import employeeUser from "./Auth/employeeAuth/register.js";
import employeeLogin from "./Auth/employeeAuth/login.js";
import authenticateShopKeeperAccount from "./Auth/shopKeeperAuth/authenticate.js";
import registerShopKeeper from "./Auth/shopKeeperAuth/register.js";
import shopKeeperLogin from "./Auth/shopKeeperAuth/login.js";
import logout from "./Auth/shopKeeperAuth/logout.js";
import tokenAuthMiddleware from "./Middleware/employeeloginmiddleware.js";

import AddCart from "./Cart/AddCart.js";
import { GetCarts } from "./Cart/GetCarts.js";
import { CreateOrder } from "./Orders/CreateOrder.js";
import { GetOrders } from "./Orders/GetOrders.js";
import { DeleteOrders } from "./Orders/DeleteOrder.js";
import { UpdateOrder } from "./Orders/UpdateOrder.js";

import CreateProducts from "./Products/CreateProducts.js";
import GetProducts from "./Products/GetProducts.js";
import UpdateProducts, {
  UpdateProductsQty,
} from "./Products/UpdateProducts.js";
import DeleteProducts from "./Products/DeleteProducts.js";
import CheckMinLimit from "./Products/CheckMinLimit.js";

import UploadBanner from "./Middleware/UploadBanner.js";
import UploadCategoryImg from "./Middleware/UploadCategoryImg.js";
import { GetProductImg } from "./GetProductImg.js";
import { DeleteProductImg } from "./DeleteProductImg.js";
import createCategory from "./Category/CreateCategories.js";
import GetCategory from "./Category/GetCategory.js";
import UpdateCategory from "./Category/UpdateCategory.js";
import DeleteCategory from "./Category/DeleteCategory.js";
import { GetCategoryImg } from "./GetCategoryImg.js";
import { deleteImage } from "./DeleteBanner.js";

import GetEmployees from "./Employee/GetEmployees.js";
import UpdateEmployees from "./Employee/UpdateEmployees.js";
import CreateSurveyForm from "./SurveyForm/CreateSurveyForm.js";
import GetSurvey from "./SurveyForm/GetSurvey.js";
import DeleteSurvey from "./SurveyForm/DeleteSurvey.js";
import UpdateSurvey from "./SurveyForm/UpdateSurvey.js";
import GetUser from "./Employee/GetUser.js";
import GetBranchManagers from "./BranchManagers/GetBranchManagers.js";
import { BranchManagerPdfGenerator } from "./PDF Generation/BranchManagerPdfGenerate.js";
import { EmployeePdfGenerator } from "./PDF Generation/EmployeePdfGenerate.js";

import { legacyAuth } from "./Middleware/legacyAuth.js";

const router = Router();

// ---- Public auth ----
router.get("/branch/verify/:branchToken", authenticateBrachManagerAccount);
router.post("/branchManagerRegister", branchUser);
router.post("/branchLogin", branchLogin);

router.post("/employeeLoginMiddleware", tokenAuthMiddleware);
router.get("/employee/verify/:employeeToken", authenticateEmployeeAccount);
router.post("/employeeRegister", employeeUser);
router.post("/employeeLogin", employeeLogin);

router.get("/shopKeeper/verify/:shopKeeperToken", authenticateShopKeeperAccount);
router.post("/shopKeeperRegister", registerShopKeeper);
router.post("/shopKeeperLogin", shopKeeperLogin);

router.post("/logout", logout);

// ---- Static images (no auth — same as InstaCafe public menu) ----
router.use("/categoryImg", express.static("categoryImg"));
router.use("/ProductImg", express.static("ProductImg"));
router.get("/ProductImg/:imageName", GetProductImg);
router.get("/categoryImg/:imageName", GetCategoryImg);

// ---- Cart self-resolve ----
router.get("/cart-id", legacyAuth(), (req, res) => {
  return res.status(200).json({ cartId: req.legacyUser.cartId });
});

// ---- Products (shopkeeper / branchmanager only — they manage inventory) ----
const manageInventory = legacyAuth(["shopkeeper", "branchmanager"]);
router.post("/createProducts", manageInventory, CreateProducts);
router.get("/GetProducts", legacyAuth(), GetProducts);
router.post("/UpdateProducts", manageInventory, UpdateProducts);
router.post("/UpdateProductsQty", manageInventory, UpdateProductsQty);
router.get("/CheckMinLimit", manageInventory, CheckMinLimit);
router.post("/DeleteProducts", manageInventory, DeleteProducts);

// ---- Cart + Orders (any authenticated legacy user) ----
router.post("/CreateCart", legacyAuth(), AddCart);
router.get("/GetCarts", legacyAuth(), GetCarts);
router.post("/CreateOrder", legacyAuth(["employee"]), CreateOrder);
router.get("/GetOrders", legacyAuth(), GetOrders);
router.post("/UpdateOrder", legacyAuth(), UpdateOrder);
router.post("/DeleteOrder", legacyAuth(), DeleteOrders);

// ---- Images ----
router.post(
  "/upload-product-img",
  manageInventory,
  UploadBanner.single("productImg"),
  (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No image" });
    return res
      .status(200)
      .json({ message: "Image uploaded", path: req.file.path });
  }
);
router.post("/delete-product-img", manageInventory, async (req, res) => {
  try {
    const { filename } = req.body || {};
    if (!filename) return res.status(400).json({ error: "Filename required" });
    if (filename.includes("/") || filename.includes("..")) {
      return res.status(400).json({ error: "Invalid filename" });
    }
    await DeleteProductImg(filename);
    return res.status(200).json({ message: "Banner image deleted successfully" });
  } catch (err) {
    console.error("delete-product-img error:", err.message);
    return res.status(500).json({ error: "Failed to delete image" });
  }
});
router.post(
  "/upload-category-img",
  manageInventory,
  UploadCategoryImg.single("categoryImg"),
  (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No image" });
    return res
      .status(200)
      .json({ message: "Image uploaded", path: req.file.path });
  }
);
router.post("/delete-category-img", manageInventory, async (req, res) => {
  try {
    const { filename } = req.body || {};
    if (!filename) return res.status(400).json({ error: "Filename required" });
    if (filename.includes("/") || filename.includes("..")) {
      return res.status(400).json({ error: "Invalid filename" });
    }
    await deleteImage(filename);
    return res.status(200).json({ message: "Banner image deleted successfully" });
  } catch (err) {
    console.error("delete-category-img error:", err.message);
    return res.status(500).json({ error: "Failed to delete image" });
  }
});

// ---- Categories ----
router.post("/createCategory", manageInventory, createCategory);
router.get("/GetCategory", legacyAuth(), GetCategory);
router.post("/UpdateCategory", manageInventory, UpdateCategory);
router.post("/DeleteCategory", manageInventory, DeleteCategory);

// ---- Employees / Branch Managers (branchmanager + shopkeeper only) ----
const manageStaff = legacyAuth(["branchmanager", "shopkeeper"]);
router.get("/GetEmployees", manageStaff, GetEmployees);
router.get("/GetUser", legacyAuth(), GetUser);
router.get("/GetBranchManagers", manageStaff, GetBranchManagers);
router.post("/UpdateEmployee", manageStaff, UpdateEmployees);

// ---- Surveys ----
router.post("/CreateSurveyForm", legacyAuth(), CreateSurveyForm);
router.get("/GetSurvey", legacyAuth(), GetSurvey);
router.post("/UpdateSurvey", legacyAuth(), UpdateSurvey);
router.post("/DeleteSurvey", legacyAuth(), DeleteSurvey);

// ---- PDF (managers + shopkeepers) ----
router.post("/generate-pdf-employee", manageStaff, EmployeePdfGenerator);
router.post(
  "/generate-pdf-branch-manager",
  manageStaff,
  BranchManagerPdfGenerator
);

export default router;
