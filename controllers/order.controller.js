import Transaction from "../models/transaction.model.js";
import Bundle from "../models/bundle.model.js";
import axios from "axios";
import { PAYSTACK_SECRET_KEY, FRONTEND_URL } from "../config/env.js";

//  1. CREATE ORDER & INITIATE PAYMENT
export const createOrder = async (req, res, next) => {
  try {
    // 1. Accept both "buyerPhone" (Backend naming) and "customerPhone" (Frontend naming)
    const { bundleId, paymentMethod, email } = req.body;
    const buyerPhone = req.body.buyerPhone || req.body.customerPhone;

    if (!bundleId) {
      return res
        .status(400)
        .json({ success: false, message: "bundleId is required" });
    }

    // 2. Find the bundle
    const bundle = await Bundle.findById(bundleId);
    if (!bundle) {
      return res
        .status(404)
        .json({ success: false, message: "Bundle not found" });
    }

    // 3. Calculate Amounts
    const amount = bundle.JBSP || bundle.price; // Selling Price
    const baseCost = bundle.JBCP || 0; // Cost Price

    // 4. Create Transaction Record (Pending)
    const reference = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const newTransaction = await Transaction.create({
      email: email || "no-email@provided.com",
      bundleId: bundle._id,
      bundleIdName: bundle.Bundle_id || "UNKNOWN",
      bundleName: bundle.name,
      resellerCode: req.query.ref || "DIRECT", // Capture ref from URL query
      baseCost: baseCost,
      amount: amount,
      JBProfit: amount - baseCost,
      currency: "GHS",
      reference: reference,
      status: "pending",
      channel: paymentMethod || "mobile_money",
      buyerPhone: buyerPhone,
    });

    // 5. INITIATE PAYSTACK PAYMENT
    // We do this here so the frontend gets the URL in one go
    const paystackResponse = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email: newTransaction.email,
        amount: Math.round(newTransaction.amount * 100), // Convert GHS to Pesewas
        reference: newTransaction.reference,
        callback_url: `${FRONTEND_URL}/payment/callback`, // Redirect back to your site
        metadata: {
          transactionId: newTransaction._id.toString(),
          custom_fields: [
            {
              display_name: "Bundle",
              variable_name: "bundle_name",
              value: bundle.name,
            },
            {
              display_name: "Phone",
              variable_name: "phone_number",
              value: buyerPhone,
            },
          ],
        },
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      },
    );

    // 6. Return Success with Payment URL
    return res.status(201).json({
      success: true,
      message: "Order created",
      order: newTransaction,
      paymentUrl: paystackResponse.data.data.authorization_url,
      accessCode: paystackResponse.data.data.access_code,
    });
  } catch (error) {
    console.error(
      "Order Creation Error:",
      error.response?.data || error.message,
    );
    next(error);
  }
};

// ✅ 2. GET ORDERS
export const getOrders = async (req, res, next) => {
  try {
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
