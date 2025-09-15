import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import controller from '../controllers/controller.js';

const router = express.Router();

// File upload setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads'),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `invoice-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|pdf|webp/;
    if (allowed.test(path.extname(file.originalname).toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Only images and PDFs allowed'));
    }
  }
});

// Routes
router.get('/invoices', controller.invoice.getAllInvoices.bind(controller.invoice));

router.post('/invoices/upload', (req, res, next) => {
  if (req.is('multipart/form-data')) {
    upload.single('invoice')(req, res, (err) => {
      if (err) return res.status(400).json({ success: false, error: err.message });
      next();
    });
  } else {
    next();
  }
}, controller.invoice.uploadInvoice.bind(controller.invoice));

router.delete('/invoices/:id', controller.invoice.deleteInvoice.bind(controller.invoice));
router.post('/invoices/sample', controller.invoice.loadSampleData.bind(controller.invoice));

// open AI chat endpoint
router.post('/chat', controller.chat.processQuestion.bind(controller.chat));

export default router;
