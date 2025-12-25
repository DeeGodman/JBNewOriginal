import jwt from "jsonwebtoken";
import Commission from "../models/commission.model.js";
import User from "../models/user.model.js";
import { nanoid } from "nanoid";
import {
  sendWelcomeEmail,
  sendOTPEmail,
  sendInviteEmail,
  sendApprovedEmail,
} from "../utils/send-email.js";

export const getReseller = async (req, res, next) => {
  try {
    // real usage is this don't forget
    // const { id } = req.user

    //Manual setting for testing purposes
    // const id = "6942af84c58df50e5dd16d00"

    const { id } = req.user;

    console.log("this is what i am currently debugging", id);
    const user = await User.findById(id).select("-password");

    // const user = await User.findById(req.params.id).select('-password'); // brings eveything out aside from the password of a user

    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    const safeUser = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isAccountVerified: user.isAccountVerified,
      resellerCode: user.resellerCode,
      commissionRate: user.commissionRate,
      totalCommissionsEarned: user.totalCommissionEarned,
      totalCommissionsPaidOut: user.totalCommissionPaidOut,
      totalSales: user.totalSales,
      createdAt: user.createdAt,
    };

    res.status(200).json({
      success: true,

      data: safeUser,
    }); // Right now i am pushing all the user details, would have to make it more specific

    // res.status(200).json({
    //   success: true,
    //   userData:{
    //     name:user.name,
    //     isAccountVerified: user.isAccountVerified
    //   }
    // })
  } catch (error) {
    next(error);
  }
};

//GET USERS BY ADMIN
// export const getResellers = async (req, res, next) => {

//     try {
//         const { id, email, role } = req.user;
//         console.log("this is what i am currently debugging", id);

//         //Pagination setup
//         const page = parseInt(req.query.page) || 1;
//         const limit = parseInt(req.query.limit) || 2;
//         const skip = (page - 1) * limit;

//         // Search setup
//         const search = req.query.search ? req.query.search.trim() : "";

//         // Build search query
//         const query = search
//             ? {
//                 $or: [
//                     { name: { $regex: search, $options: "i" } },
//                     { email: { $regex: search, $options: "i" } },
//                     { role: { $regex: search, $options: "i" } },
//                 ],
//             }
//             : {};

//         //Fetch total users count matching the query, if no query it just returns all users in the db
//         const totalUsers = await User.countDocuments(query);

//         // Fetch paginated users using search query if there is any
//         const users = await User.find(query)
//             .select('-password') // Exclude password
//             .skip(skip)
//             .limit(limit)
//             .sort({ createdAt: -1 }); // optional: newest first

//         // Handle empty search results or no users gracefully doesnt even go to the next res
//         if (!users || users.length === 0) {
//             return res.status(200).json({
//                 success: true,
//                 users: [],
//                 message: search
//                     ? "No users matched your search query"
//                     : "No users found in the database",
//                 pagination: {
//                     currentPage: page,
//                     totalPages: 0,
//                     totalUsers: 0,
//                     limit,
//                     hasNextPage: false,
//                     hasPrevPage: false,
//                     nextPage: null,
//                     prevPage: null,
//                 },
//             });
//         }

//         //Clean users model i can return to the frontend safely(Secured)
//         const safeUsers = users.map(user => ({
//             _id: user._id,
//             name: user.name,
//             email: user.email,
//             role: user.role,
//             isAccountVerified: user.isAccountVerified,
//             createdAt: user.createdAt,
//             totalCommissionEarned:user.totalCommissionEarned,
//             totalCommissionPaidOut: user.totalCommissionPaidOut,
//         }));

//         //paginated Info
//         const hasMore = page * limit < totalUsers;
//         const totalPages = Math.ceil(totalUsers / limit);
//         const hasNextPage = page < totalPages;
//         const hasPrevPage = page > 1;

//         //Actual data returned should all go well, either via searching or simple viewing the users in my database
//         res.status(200).json({
//             success: true,
//             users: safeUsers,
//             message: ` Here are all the users of my app, Request made by ${role} with id:${id}`,
//             pagination: {
//                 currentPage: page,
//                 totalPages,
//                 totalUsers,
//                 limit,
//                 hasNextPage,
//                 hasPrevPage,
//                 nextPage: hasNextPage ? page + 1 : null,
//                 prevPage: hasPrevPage ? page - 1 : null,
//             }
//         }) // Right now i am pushing all the user details, would have to make it more specific

//     } catch (error) {

//         // Handle custom errors with statusCode
//         if (error.statusCode) {
//             return res.status(error.statusCode).json({
//                 success: false,
//                 message: error.message
//             });
//         }

//         // Handle any other unexpected errors
//         return res.status(500).json({
//             success: false,
//             message: 'Internal Server Error',
//         });

//         //next() will be used later when i create my middlewares properly

//     }
// }

//ACCOUNT CREATION BY ADMIN DIRECTLY

export const getResellers = async (req, res, next) => {
  try {
    // const { id, email, role } = req.user;

    const { id, email, role } = req.user;

    console.log("Admin fetching resellers, ID:", id);

    // Pagination setup
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Search setup
    const search = req.query.search ? req.query.search.trim() : "";

    // Build search query
    const query = search
      ? {
          $or: [
            { name: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
          ],
        }
      : {};

    // Execute queries in parallel for better performance
    const [users, totalUsers, analytics] = await Promise.all([
      // Fetch paginated users
      User.find(query)
        .select("-password -accessToken -refreshToken") // Exclude sensitive fields
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }) // Newest first
        .lean(),

      // Get total count for pagination
      User.countDocuments(query),

      // Get analytics (aggregate all users, not just paginated)
      User.aggregate([
        {
          $group: {
            _id: null,
            totalCommissionEarned: { $sum: "$totalCommissionEarned" },
            totalCommissionPaidOut: { $sum: "$totalCommissionPaidOut" },
            totalResellers: { $sum: 1 },
            activeResellers: {
              $sum: { $cond: [{ $eq: ["$isApproved", true] }, 1, 0] },
            },
            pendingResellers: {
              $sum: { $cond: [{ $eq: ["$isApproved", false] }, 1, 0] },
            },
          },
        },
      ]),
    ]);

    // Handle empty search results or no users
    if (!users || users.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        analytics: {
          totalCommissionEarned: 0,
          totalCommissionPaidOut: 0,
          totalResellers: 0,
          activeResellers: 0,
          pendingResellers: 0,
          availableBalance: 0,
          currency: "GHS",
        },
        message: search
          ? "No users matched your search query"
          : "No users found in the database",
        pagination: {
          currentPage: page,
          totalPages: 0,
          totalUsers: 0,
          limit,
          hasNextPage: false,
          hasPrevPage: false,
          nextPage: null,
          prevPage: null,
        },
      });
    }

    // Clean users model - safe to return to frontend
    const safeUsers = users.map((user) => ({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role || "reseller",
      status: user.isApproved ? "active" : "pending",
      isApproved: user.isApproved || false,
      isAccountVerified: user.isAccountVerified || false,
      createdAt: user.createdAt,
      totalCommissionEarned: user.totalCommissionEarned || 0,
      totalCommissionPaidOut: user.totalCommissionPaidOut || 0,
      salesVolume: user.totalCommissionEarned || 0,
      availableBalance:
        (user.totalCommissionEarned || 0) - (user.totalCommissionPaidOut || 0),
    }));

    // Extract analytics data
    const analyticsData = analytics[0] || {
      totalCommissionEarned: 0,
      totalCommissionPaidOut: 0,
      totalResellers: 0,
      activeResellers: 0,
      pendingResellers: 0,
    };

    // Calculate available balance across all resellers
    const availableBalance =
      analyticsData.totalCommissionEarned -
      analyticsData.totalCommissionPaidOut;

    // Pagination info
    const totalPages = Math.ceil(totalUsers / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    // Return data with analytics
    res.status(200).json({
      success: true,
      data: safeUsers,
      analytics: {
        totalCommissionEarned: parseFloat(
          analyticsData.totalCommissionEarned.toFixed(2),
        ),
        totalCommissionPaidOut: parseFloat(
          analyticsData.totalCommissionPaidOut.toFixed(2),
        ),
        totalResellers: analyticsData.totalResellers,
        activeResellers: analyticsData.activeResellers,
        pendingResellers: analyticsData.pendingResellers,
        availableBalance: parseFloat(availableBalance.toFixed(2)),
        currency: "GHS",
      },
      message: `Here are all the resellers. Request made by admin with id: ${id}`,
      pagination: {
        currentPage: page,
        totalPages,
        totalUsers,
        limit,
        hasNextPage,
        hasPrevPage,
        nextPage: hasNextPage ? page + 1 : null,
        prevPage: hasPrevPage ? page - 1 : null,
      },
    });
  } catch (error) {
    console.error("Error fetching resellers:", error);

    // Handle custom errors with statusCode
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

    // Handle any other unexpected errors
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

export const creatAccountByAdmin = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction(); // I actually learnt this in class for relational dbs, makes the database atomic
  //all or nothing, no halfway authentications, it either works or it doesn't

  const { id, role } = req.user;

  // So that we don't have to send empty details to the server
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.json({
      success: false,
      message: "Missing Details, Please provide them",
    });
  }

  //Making sure the person making the update request is the admin first
  if (!req.user || req.user.role !== "admin") {
    const error = new Error("Unauthorized to create admin accounts");
    error.statusCode = 403;
    throw error;
  }

  try {
    //Check if user already exists
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      const error = new Error("User already exists");
      error.statusCode = 409;
      throw error;
    }

    //If newuser doesn't already exit continue flow and hash created passwords
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const newUsers = await User.create(
      [{ name, email, password: hashedPassword }],
      { session },
    ); // I might change this later for just singleNewUser creation

    //I DID NOT AUTOMATICALLY GENERATE TOKEN AND SET TO COOKIES, CAUSE I DON'T WANT THE ACCOUNT TO BE IMMEDIATELY LOGGED IN AFTER CREATION
    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      message: `User created successfully by ${id} role: ${role}, PLEASE LOG IN `,
      data: {
        user: newUsers[0],
      },
    });

    // Sends the welcome email
    await sendWelcomeEmail({
      to: email,
      userName: name,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

//ACCOUNT UPDATE BY ADMIN DIRECTLY
export const updateUserByAdmin = async (req, res, next) => {
  try {
    const { id: user } = req.param; //user id from request params
    const { id: loggedInUser, role } = req.user; // current logged-in user supposedly admin from middleware trying to update a specific account by using :id params

    const updateData = req.body;
  } catch (error) {
    console.log(error);
    next(error);
  }
};

// RESLLER LINK GENERATION
export const resellerLink = async (req, res, next) => {
  try {
    // const userId = req.user.id; // Auth middleware sets this

    // const { userId } = req.query; // instead of req.body// for now until i set the middleware properly will manually send the userId in the query string

    const { id, email, role } = req.user;
    const userId = id;

    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Generate resellerCode if not exists
    if (!user.resellerCode || user.resellerCode.trim() === "") {
      const safeName = user.name || "USER";
      const prefix = safeName.substring(0, 4).toUpperCase(); // first 4 letters
      user.resellerCode = `${prefix}-${nanoid(6)}`; // e.g., JOHN-a1b2c3
      await user.save();
    }

    const referralURL = `http://localhost:3000/buy?resellerCode=${user.resellerCode}`;

    return res.status(200).json({
      success: true,
      message: "Referral link generated successfully",
      referralURL,
    });
  } catch (err) {
    console.error("Error generating referral link:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

//GET RESELLER COMMISSION PUBLIC ENDPOINT
export const getResellerCommission = async (req, res) => {
  try {
    const { resellerCode } = req.params;

    console.log("Backend received resellerCode:", resellerCode);
    // Find reseller by code
    const reseller = await User.findOne({
      resellerCode: resellerCode,
    });

    if (!reseller) {
      return res.status(404).json({
        success: false,
        message: "Reseller not found",
      });
    }

    // Return ONLY commission rate (no sensitive data)
    return res.status(200).json({
      success: true,
      data: {
        resellerCode: reseller.resellerCode,
        commissionRate: reseller.commissionRate, // e.g., 0.15 for 15%
        // Optionally: reseller name for display
      },
    });
  } catch (error) {
    console.error("Get reseller commission error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch commission rate",
    });
  }
};

//Invite Email controller
export const inviteReseller = async (req, res) => {
  try {
    const { email } = req.body;

    // Validate email
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User with this email already exists",
      });
    }

    // Generate invite token (valid for 7 days)
    const inviteToken = jwt.sign(
      { email, type: "reseller_invite" },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    // Create invite link
    const inviteLink = `https://condescending-charlott-discernible.ngrok-free.dev/auth/register?token=${inviteToken}&email=${encodeURIComponent(email)}`;

    // Send invite email
    await sendInviteEmail({
      to: email,
      inviteUrl: inviteLink,
    });

    res.status(200).json({
      success: true,
      message: "Invitation sent successfully",
      email,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error inviting reseller:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send invitation",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
};
