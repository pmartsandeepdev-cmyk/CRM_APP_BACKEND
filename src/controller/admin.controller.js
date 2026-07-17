import { Admin } from '../model/admin.model.js';
import sendPasswordRestEmail from '../utils/changepassword.js';
import bcrypt from 'bcryptjs';

const generateAccessTokenandRefreshToken = async (userid) => {
  try {
    console.log("========================================");
    console.log("Generating tokens for user ID:", userid);
    
    // Find user by ID
    const user = await Admin.findById(userid);
    if (!user) {
      console.error("❌ User not found with ID:", userid);       
      throw new Error("User not found");
    }
    
    console.log("✅ User found:", user.email);
    console.log("Username:", user.username);
    console.log("Admin Type:", user.adminType);
    console.log("User has generateAccessToken method:", typeof user.generateAccessToken === 'function');
    console.log("User has generateRefreshToken method:", typeof user.generateRefreshToken === 'function');
    
    // Check if JWT secrets are configured
    if (!process.env.ACCESS_TOKEN_SECRET) {
      console.error("❌ ACCESS_TOKEN_SECRET is missing in environment variables!");
      throw new Error("JWT secrets not configured. Please check your .env file");
    }
    
    if (!process.env.REFRESH_TOKEN_SECRET) {
      console.error("❌ REFRESH_TOKEN_SECRET is missing in environment variables!");
      throw new Error("JWT secrets not configured. Please check your .env file");
    }
    
    // Generate tokens
    console.log("Generating access token...");
    const accessToken = user.generateAccessToken();
    console.log("Generating refresh token...");
    const refreshToken = user.generateRefreshToken();
    
    console.log("✅ Access Token generated successfully");
    console.log("Access Token (first 30 chars):", accessToken?.substring(0, 30) + "...");
    console.log("Refresh Token (first 30 chars):", refreshToken?.substring(0, 30) + "...");
    
    // Save refresh token to database
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    console.log("✅ Refresh token saved to database");
    console.log("========================================");
    
    return { accessToken, refreshToken };
  } catch (error) {
    console.error("❌ Error in generateAccessTokenandRefreshToken:", error);
    console.error("Error stack:", error.stack);
    throw new Error(`Something went wrong while generating tokens: ${error.message}`);
  }
};

const CreateAdmin = async (req, res) => {
  const {username, email, password, adminType} = req.body

  console.log("=== CREATE ADMIN STARTED ===");
  console.log("Request body:", { username, email, password, adminType });

  if (!username || !email || !password || !adminType) {
    return res.status(400).json({
      success: false,
      message: "All fields required!"
    });
  }
     
  try {
    // Check if admin already exists
    const existingAdmin = await Admin.findOne({
      $or: [{ username }, { email }],
    });

    if (existingAdmin) {
      return res.status(400).json({
        status: 400,
        message: "Admin already exists",
        success: false
      });
    }
    
    // Hash password
    console.log("Hashing password...");
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    console.log("✅ Password hashed successfully");
    
    // Create admin with hashed password
    const admin = await Admin.create({
      username,
      email,
      password: hashedPassword,
      adminType
    });
  
    console.log("✅ Admin created successfully with ID:", admin._id);
    console.log("Admin email:", admin.email);
    console.log("Stored password (first 20 chars):", admin.password?.substring(0, 20));
  
    // Remove password from response
    const adminResponse = admin.toObject();
    delete adminResponse.password;
  
    return res.status(200).json({
      status: 200,
      message: "Admin Created Successfully",
      success: true,
      data: adminResponse
    });
  } catch (error) {
    console.error("❌ Error creating admin:", error);
    return res.status(500).json({
      status: 500,
      success: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
}

const adminloging = async (req, res) => {
  const { email, password } = req.body

  console.log("========================================");
  console.log("=== LOGIN ATTEMPT ===");
  console.log("Email:", email);
  console.log("Password provided:", password);

  if (!email || !password) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "Email and password are required"
    });
  }

  try {
    // Find user by email
    const user = await Admin.findOne({ email });
    console.log("User found:", user ? "✅ Yes" : "❌ No");
    
    if (!user) {
      return res.status(400).json({
        message: "Invalid credentials",
        success: false
      });
    }

    console.log("User ID:", user._id);
    console.log("Username:", user.username);
    console.log("Stored password (first 20 chars):", user.password?.substring(0, 20));
    console.log("Is password a bcrypt hash?", user.password?.startsWith('$2'));
    
    // Verify password
    const isPasswordCorrect = await user.isPasswordCorrect(password);
    console.log("Password correct:", isPasswordCorrect ? "✅ Yes" : "❌ No");

    if (!isPasswordCorrect) {
      return res.status(403).json({
        success: false,
        message: "Invalid credentials"
      });
    }
    
    // Generate tokens
    console.log("Generating authentication tokens...");
    const { accessToken, refreshToken } = await generateAccessTokenandRefreshToken(user._id);
    
    // Get user data without sensitive info
    console.log("Fetching user data without sensitive info...");
    const loggedInUser = await Admin.findById(user._id).select("-password -refreshToken");
    
    // Cookie options
    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    };
    
    console.log("✅ Login successful, sending response...");
    console.log("========================================");
    
    return res.status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json({
        data: loggedInUser,
        adminType: loggedInUser.adminType,
        id: loggedInUser._id,
        senderType: "admin",
        success: true,
        accessToken: accessToken,
        refreshToken: refreshToken,
        message: "Logged in successfully!"
      });
  } catch (error) {
    console.error("❌ Login error:", error);
    console.error("Error stack:", error.stack);
    return res.status(500).json({
      message: "Internal server error",
      success: false,
      error: error.message
    });
  }
}

const logoutAdmin = async (req, res) => {
  try {
    console.log("Logging out admin:", req.user?._id);
    
    await Admin.findByIdAndUpdate(
      req.user?._id,
      {
        $unset: {
          refreshToken: 1,
        },
      },
      { new: true }    
    );

    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production"
    };

    return res.status(200)
      .clearCookie("accessToken", options)
      .clearCookie("refreshToken", options)
      .json({
        message: "Admin Logged Out Successfully",
        success: true
      });
  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json({
      message: "Error during logout",
      success: false,
      error: error.message
    });
  }
}

const getAllAdmin = async (req, res) => {
  try {
    const admins = await Admin.find({}).select("-password -refreshToken");
    const count = admins.length;
    console.log("Admin count:", count);
    
    return res.status(200).json({
      data: admins,
      count: count,
      success: true
    });
  } catch (error) {
    console.error("Error getting admins:", error);
    return res.status(500).json({
      message: "Internal server Error",
      success: false,
      error: error.message
    });
  }
}

function generateOTP() {
  return Math.floor(10000 + Math.random() * 90000).toString();
}

const sendMailTochangePassword = async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({
      message: "Email is required",
      success: false
    });
  }
  
  try {
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(400).json({ 
        message: "Admin not Found",
        success: false
      });
    }
    
    const generatedOTP = generateOTP();
    admin.changepasswordcode = generatedOTP;
    await admin.save();
    
    const emailSent = await sendPasswordRestEmail(email, generatedOTP);
    
    if (emailSent) {
      return res.status(200).json({
        message: "Password reset email sent",
        success: true
      });
    } else {
      return res.status(500).json({
        message: "Failed to send password reset email",
        success: false
      });
    }
  } catch (error) {
    console.error("Error sending password reset email:", error);
    return res.status(500).json({
      message: "Error while sending password reset email",
      success: false,
      error: error.message
    });
  }
}

const changepassword = async (req, res) => {
  const { newPassword, otp, email } = req.body;
  
  if (!newPassword || !otp || !email) {
    return res.status(400).json({
      message: "New password, OTP, and Email are required!",
      success: false 
    });
  }
  try {
    const admin = await Admin.findOne({
      email: email,
      changepasswordcode: otp,
    });
    
    if (!admin) {
      return res.status(404).json({
        message: "Admin not found or OTP is expired",
        success: false
      });
    }
    
    // Hash new password
    const salt = await bcrypt.genSalt(10);
    admin.password = await bcrypt.hash(newPassword, salt);
    admin.changepasswordcode = null;
    await admin.save();

    return res.status(200).json({
      message: "Password updated successfully",
      success: true
    });
  } catch (error) {
    console.error("Error changing password:", error);
    return res.status(500).json({
      message: "Error while updating password",
      success: false,
      error: error.message
    });
  }
}

const deleteAdmin = async (req, res) => {
  const { email } = req.body;
  try {
    const deletedAdmin = await Admin.findOneAndDelete({ email });
    if (!deletedAdmin) {
      return res.status(404).json({
        message: "Admin Not Found!",
        success: false
      });
    }

    return res.status(200).json({
      data: deletedAdmin,
      message: "Admin Deleted Successfully!",
      success: true
    });
  } catch (error) {
    console.error("Error deleting admin:", error);
    return res.status(500).json({
      message: "Error Deleting Admin!",
      success: false,
      error: error.message
    });
  }
}

const getCurrentAdmin = async (req, res) => {
  try {
    const _id = req.user?._id;
    const admin = await Admin.findById(_id).select("-password -refreshToken");
    if (!admin) {
      return res.status(404).json({
        message: "Admin Not Found!",
        success: false
      });
    }
    return res.status(200).json({
      data: admin,
      message: "Admin Found",
      success: true
    });
  } catch (error) {
    console.error("Error getting current admin:", error);
    return res.status(500).json({
      message: "Error while getting admin info",
      success: false,
      error: error.message
    });
  }
}

export {
  CreateAdmin,
  adminloging,
  logoutAdmin,
  getAllAdmin,
  sendMailTochangePassword,
  changepassword,
  deleteAdmin,
  getCurrentAdmin
}