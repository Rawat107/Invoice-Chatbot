import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import controller from '../controllers/controller.js';

const router = express.Router();

// Create uploads directory if it doesn't exist
const uploadsDir = 'uploads';
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `invoice-${uniqueSuffix}${ext}`);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|pdf|webp|gif|bmp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype) || file.mimetype.startsWith('image/');

        if (mimetype && extname) {
            cb(null, true);
        } else {
            cb(new Error('Only images and PDFs are allowed'));
        }
    }
});

// Invoice routes
router.get('/invoices', controller.invoice.getAllInvoices.bind(controller.invoice));

// File upload only - URL removed
router.post('/invoices/upload', upload.single('invoice'), controller.invoice.uploadInvoice.bind(controller.invoice));

// Delete invoice route
router.delete('/invoices/:id', controller.invoice.deleteInvoice.bind(controller.invoice));

// Sample data route
router.post('/invoices/sample', controller.invoice.loadSampleData.bind(controller.invoice));

// Chat routes
router.post('/chat', controller.chat.processQuestion.bind(controller.chat));

export default router;