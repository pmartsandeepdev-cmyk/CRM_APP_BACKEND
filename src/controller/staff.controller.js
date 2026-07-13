import mongoose from "mongoose";
import Staff from "../model/staff.model.js"; // Adjust the path as needed

// @desc    Create a new staff member
// @route   POST /api/staff
// @access  Private/Admin
export const createStaff = async (req, res) => {
  try {
    const { name, email, phone, role } = req.body;

    // Check if staff already exists
    const existingStaff = await Staff.findOne({ email });
    if (existingStaff) {
      return res.status(400).json({
        success: false,
        message: "Staff member with this email already exists",
      });
    }

    const staff = await Staff.create({
      name,
      email,
      phone,
      role,
    });

    res.status(201).json({
      success: true,
      data: staff,
    });
  } catch (error) {
    console.error("Error creating staff:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create staff member",
      error: error.message,
    });
  }
};

// @desc    Get all staff members
// @route   GET /api/staff
// @access  Private/Admin/Manager
export const getAllStaff = async (req, res) => {
  try {
    const { role, page = 1, limit = 10 } = req.query;

    let query = {};
    if (role) {
      query.role = role;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const staff = await Staff.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Staff.countDocuments(query);

    res.status(200).json({
      success: true,
      data: staff,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching staff:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch staff members",
      error: error.message,
    });
  }
};

// @desc    Get single staff member by ID
// @route   GET /api/staff/:id
// @access  Private/Admin/Manager
export const getStaffById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid staff ID",
      });
    }

    const staff = await Staff.findById(id);

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff member not found",
      });
    }

    res.status(200).json({
      success: true,
      data: staff,
    });
  } catch (error) {
    console.error("Error fetching staff:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch staff member",
      error: error.message,
    });
  }
};

// @desc    Update staff member
// @route   PUT /api/staff/:id
// @access  Private/Admin
export const updateStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, role } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid staff ID",
      });
    }

    // Check if email is being changed and already exists
    if (email) {
      const existingStaff = await Staff.findOne({ email, _id: { $ne: id } });
      if (existingStaff) {
        return res.status(400).json({
          success: false,
          message: "Email already in use by another staff member",
        });
      }
    }

    const staff = await Staff.findByIdAndUpdate(
      id,
      { name, email, phone, role },
      { new: true, runValidators: true }
    );

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff member not found",
      });
    }

    res.status(200).json({
      success: true,
      data: staff,
    });
  } catch (error) {
    console.error("Error updating staff:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update staff member",
      error: error.message,
    });
  }
};

// @desc    Delete staff member
// @route   DELETE /api/staff/:id
// @access  Private/Admin
export const deleteStaff = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid staff ID",
      });
    }

    const staff = await Staff.findByIdAndDelete(id);

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff member not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Staff member deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting staff:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete staff member",
      error: error.message,
    });
  }
};

// @desc    Update staff role
// @route   PATCH /api/staff/:id/role
// @access  Private/Admin
export const updateStaffRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid staff ID",
      });
    }

    if (!role || !["admin", "manager", "employee", "staff"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role. Must be: admin, manager, employee, or staff",
      });
    }

    const staff = await Staff.findByIdAndUpdate(
      id,
      { role },
      { new: true, runValidators: true }
    );

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff member not found",
      });
    }

    res.status(200).json({
      success: true,
      data: staff,
    });
  } catch (error) {
    console.error("Error updating staff role:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update staff role",
      error: error.message,
    });
  }
};