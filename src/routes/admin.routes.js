import { Router } from 'express';
import {
    CreateAdmin,
    adminloging,
    logoutAdmin,
    getAllAdmin,
    sendMailTochangePassword,
    changepassword,
    deleteAdmin,
    getCurrentAdmin
} from '../controller/admin.controller.js';
import { verifyJWT } from '../middleware/auth.middleware.js';

const router = Router();

// Public routes
router.post('/create', CreateAdmin);
router.post('/login', adminloging);
router.post('/send-password-reset', sendMailTochangePassword);
router.post('/change-password', changepassword);
// Protected routes
router.get('/getAllAdmin', verifyJWT, getAllAdmin);
router.post('/logout', verifyJWT, logoutAdmin);
router.delete('/delete', verifyJWT, deleteAdmin);
router.get('/current', verifyJWT, getCurrentAdmin);

export default router;