import Transaction from "../models/transaction.model.js";
import mongoose from "mongoose";

/**
 * Calculate analytics data based on filter
 */
const getAnalytics = async (filter) => {
  try {
    // Build filter for successful transactions only (for most calculations)
    const successFilter = { ...filter, status: "success" };

    // Aggregate analytics in parallel
    const [revenueData, ordersData, profitData, costData, activeOrdersData] =
      await Promise.all([
        // Total Revenue (sum of amounts for successful transactions)
        Transaction.aggregate([
          { $match: successFilter },
          {
            $group: {
              _id: null,
              totalRevenue: { $sum: "$amount" },
            },
          },
        ]),

        // Total Orders (count of successful transactions)
        Transaction.countDocuments(successFilter),

        // Profit calculations
        Transaction.aggregate([
          { $match: successFilter },
          {
            $group: {
              _id: null,
              totalJBProfit: { $sum: "$JBProfit" },
            },
          },
        ]),

        // Total Cost (sum of JBCP for successful transactions)
        Transaction.aggregate([
          { $match: successFilter },
          {
            $group: {
              _id: null,
              totalBaseCost: { $sum: "$baseCost" },
              totalJBProfit: { $sum: "$JBProfit" },
            },
          },
        ]),

        // Active Orders (successful transactions with pending delivery)
        Transaction.countDocuments({
          ...successFilter,
          deliveryStatus: "pending",
        }),
      ]);

    console.log("CostData", costData);
    console.log("ProfitData", profitData);

    // Calculate totals
    const totalRevenue = revenueData[0]?.totalRevenue || 0;
    const totalOrders = ordersData || 0;
    const totalJBProfit = profitData[0]?.totalJBProfit || 0;
    const developersProfit = totalJBProfit * 0.2; // 20% of JBProfit
    const activeOrders = activeOrdersData || 0;

    // Calculate total JBCP (baseCost - JBProfit for all successful transactions)
    const totalBaseCost = costData[0]?.totalBaseCost || 0;
    const totalJBProfitForCost = costData[0]?.totalJBProfit || 0;
    const totalJBCP = totalBaseCost - totalJBProfitForCost;

    //TOTAL RESELLERS PROFIT FOR NOW, BUT WILL MOST LIKELY USE  CREATED BY ME CHUKS
    const totalResellerProfits = totalRevenue - totalBaseCost || 0;
    const totalActualJBCPCost =
      totalRevenue - totalJBProfit - totalResellerProfits || 0;
    const totalCost = totalResellerProfits + totalActualJBCPCost || 0;
    console.log(totalResellerProfits);
    console.log(totalActualJBCPCost);
    console.log(totalCost);

    // Calculate additional metrics
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const profitMargin =
      totalRevenue > 0 ? (totalJBProfit / totalRevenue) * 100 : 0;

    return {
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      totalOrders,
      activeOrders,
      totalJBProfit: parseFloat(totalJBProfit.toFixed(2)),
      developersProfit: parseFloat(developersProfit.toFixed(2)),
      totalCost: parseFloat(totalCost.toFixed(2)),
      totalJBCP: parseFloat(totalJBCP.toFixed(2)),
      averageOrderValue: parseFloat(averageOrderValue.toFixed(2)),
      profitMargin: parseFloat(profitMargin.toFixed(2)),
      totalResellerProfits: parseFloat(totalResellerProfits.toFixed(2)),
      totalActualJBCPCost: parseFloat(totalActualJBCPCost.toFixed(2)),
      currency: "GHS",
    };
  } catch (error) {
    console.error("Error calculating analytics:", error);
    return {
      totalRevenue: 0,
      totalOrders: 0,
      activeOrders: 0,
      totalJBProfit: 0,
      developersProfit: 0,
      totalCost: 0,
      totalJBCP: 0,
      averageOrderValue: 0,
      totalResellerProfits: 0,
      totalActualJBCPCost: 0,
      profitMargin: 0,
      currency: "GHS",
      error: "Failed to calculate some analytics",
    };
  }
};

/**
 * Get paginated transactions with comprehensive analytics
 * Query params:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 10, max: 100)
 * - status: Filter by status (success, failed, pending)
 * - network: Filter by network (at, mtn, vodafone)
 * - startDate: Filter from date (ISO format)
 * - endDate: Filter to date (ISO format)
 * - search: Search by phone number, reference, or email
 * - resellerCode: Filter by reseller code
 * - sortBy: Sort field (default: createdAt)
 * - sortOrder: asc or desc (default: desc)
 */

export const getTransactions = async (req, res) => {
  try {
    // Extract and validate query parameters
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const skip = (page - 1) * limit;

    const {
      status,
      network,
      startDate,
      endDate,
      search,
      resellerCode,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Build filter query
    const filter = {};

    // Status filter
    if (status) {
      filter.status = status;
    }

    // Network filter
    if (network) {
      filter["metadata.network"] = network;
    }

    // Reseller filter
    if (resellerCode) {
      filter.resellerCode = resellerCode;
    }

    // Date range filter
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.createdAt.$lte = new Date(endDate);
      }
    }

    // Search filter (phone number, reference, email)
    if (search) {
      filter.$or = [
        {
          "metadata.phoneNumberReceivingData": {
            $regex: search,
            $options: "i",
          },
        },
        { reference: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    // Execute queries in parallel for better performance
    const [transactions, totalCount, analytics] = await Promise.all([
      // Get paginated transactions
      Transaction.find(filter).sort(sort).skip(skip).limit(limit).lean(),

      // Get total count for pagination
      Transaction.countDocuments(filter),

      // Get analytics data
      getAnalytics(filter),
    ]);

    // Calculate JBCP for each transaction
    const transactionsWithJBCP = transactions.map((transaction) => {
      // JBCP (JoyBundle Cost Price) = baseCost - JBProfit
      const JBCP = transaction.baseCost - transaction.JBProfit;

      return {
        transactionId: transaction.reference,
        dateTime: transaction.createdAt,
        customer: transaction.metadata?.phoneNumberReceivingData || "N/A",
        network: transaction.metadata?.network?.toUpperCase() || "N/A",
        bundleName: transaction.bundleName,
        JBProfit: transaction.JBProfit,
        status: transaction.status,
        deliveryStatus: transaction.deliveryStatus,
        amount: transaction.amount,
        baseCost: transaction.baseCost,
        JBCP: parseFloat(JBCP.toFixed(2)),
        currency: transaction.currency,
        resellerName: transaction.metadata?.resellerName || "N/A",
        resellerProfit: transaction.metadata?.resellerProfit || 0,
        bundleData: transaction.metadata?.bundleData || "N/A",
      };
    });

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    // Prepare response
    const response = {
      success: true,
      data: {
        transactions: transactionsWithJBCP,
        analytics,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems: totalCount,
          itemsPerPage: limit,
          hasNextPage,
          hasPrevPage,
        },
      },
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch transactions",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Export pending orders to CSV and mark them as processing
 */
export const exportPendingOrders = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Find all successful transactions that are pending delivery
    const query = {
      status: "success",
      deliveryStatus: "pending",
    };

    const pendingOrders = await Transaction.find(query).session(session);

    if (!pendingOrders.length) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "No pending orders found to export.",
      });
    }

    // 2. Atomic Update: Mark these specific IDs as 'processing'
    const orderIds = pendingOrders.map((order) => order._id);
    await Transaction.updateMany(
      { _id: { $in: orderIds } },
      { $set: { deliveryStatus: "processing" } },
      { session },
    );

    // 3. Generate CSV Data
    // NEW HEADERS: Removed 'Amount' and 'Network'
    const csvHeaders = ["Transaction ID", "Phone Number", "Bundle", "Date"];

    const csvRows = pendingOrders.map((order) => {
      // Logic to extract just the size (e.g., "2GB" from "2GB Data Bundle")
      let formattedBundle = order.bundleName;
      // Regex looks for a number followed optionally by a decimal, then GB or MB (case insensitive)
      const sizeMatch = order.bundleName.match(/(\d+\.?\d*)\s*(GB|MB)/i);

      if (sizeMatch) {
        // If we find a size like "2 GB" or "500MB", use that and remove spaces
        formattedBundle = sizeMatch[0].replace(/\s/g, "").toUpperCase();
      }

      return [
        order.reference,
        order.metadata?.phoneNumberReceivingData || "N/A",
        // Network column removed
        formattedBundle, // Shows "2GB" instead of full name
        // Amount column removed
        new Date(order.createdAt).toISOString(),
      ].join(",");
    });

    const csvString = [csvHeaders.join(","), ...csvRows].join("\n");

    // 4. Commit Transaction
    await session.commitTransaction();
    session.endSession();

    // 5. Send Response
    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=orders-${new Date().toISOString().split("T")[0]}.csv`,
    );
    return res.status(200).send(csvString);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Export error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to export orders.",
    });
  }
};

// Update delivery status (Mark as Delivered/Failed)
export const updateDeliveryStatus = async (req, res) => {
  try {
    const { id } = req.params; // This receives the reference (e.g., JBpay_...)
    const { deliveryStatus, failureReason } = req.body;

    // Find by 'reference', not '_id', because the frontend sends the JBpay ID
    const transaction = await Transaction.findOneAndUpdate(
      { reference: id },
      {
        deliveryStatus,
        failureReason: failureReason || null,
        deliveredAt: deliveryStatus === "delivered" ? new Date() : null,
      },
      { new: true }, // Return the updated document
    );

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: transaction,
      message: `Order marked as ${deliveryStatus}`,
    });
  } catch (error) {
    console.error("Update delivery status error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update delivery status.",
    });
  }
};
