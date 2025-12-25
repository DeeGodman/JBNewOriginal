import { Router } from "express";

import { authorizeRoles, protect } from "../middlewares/auth.middleware.js";
import {
  getTransactions,
  updateDeliveryStatus,
  exportPendingOrders,
} from "../controllers/transaction.controller.js";

const transactionRouter = Router();

transactionRouter.get(
  "/export-pending",
  protect,
  authorizeRoles("admin"),
  exportPendingOrders,
);

//AN ADMIN ROUTE SO IT NEEDS PROTECTION
transactionRouter.get("/", protect, authorizeRoles("admin"), getTransactions);

// 3. Update Delivery Status (Mark as Delivered/Failed)
// Expects the 'reference' (e.g. JBpay_...) as the :id parameter
transactionRouter.patch(
  "/:id/delivery",
  protect,
  authorizeRoles("admin"),
  updateDeliveryStatus,
);

export default transactionRouter;
