import Transaction from "../models/transaction.model.js"; // ✅ Fixed Import (was order.model.js)
import Bundle from "../models/bundle.model.js";

// ✅ 1. CREATE ORDER (Modified to use Transaction model)
export const createOrder = async (req, res, next) => {
  try {
    const { buyerPhone, bundleId, paymentMethod, email } = req.body;

    if (!bundleId) {
      return res.status(400).json({
        success: false,
        message: "bundleId is required",
      });
    }

    // 1. Find the bundle
    const bundle = await Bundle.findById(bundleId);
    if (!bundle) {
      return res.status(404).json({
        success: false,
        message: "Bundle not found",
      });
    }

    // 2. Auto-populate amount from bundle
    const amount = bundle.JBSP || bundle.price; // Handle JBSP or price field

    // 3. Create the Transaction (Order)
    // Note: I added default values for required fields in Transaction schema
    const newTransaction = await Transaction.create({
      email: email || "no-email@provided.com", // Transaction model requires email
      bundleId: bundle._id,
      bundleIdName: bundle.Bundle_id || "UNKNOWN",
      bundleName: bundle.name,
      resellerCode: "DIRECT", // Default if not provided
      baseCost: bundle.JBCP || 0,
      amount: amount,
      JBProfit: amount - (bundle.JBCP || 0),
      currency: "GHS",
      reference: `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      status: "pending",
      channel: paymentMethod || "mobile_money",
    });

    return res.status(201).json({
      success: true,
      message: "Order created successfully",
      order: newTransaction,
    });
  } catch (error) {
    next(error);
  }
};

// ✅ 2. GET ORDERS (The Missing Export)
export const getOrders = async (req, res, next) => {
  try {
    // Fetch all transactions, sorted by newest first
    const orders = await Transaction.find().sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (error) {
    next(error);
  }
};
