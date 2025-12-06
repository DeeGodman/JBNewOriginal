import { Router } from "express";
import { createOrder, getOrders } from "../controllers/order.controller.js";
// Note: Check your controller exports to match these names exactly

const orderRouter = Router();
orderRouter.post("/", createOrder); // Matches POST /api/v1/orders
orderRouter.get("/", getOrders); // Matches GET /api/v1/orders

export default orderRouter;
