import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import fs from 'fs';
import invoiceRoutes from './routes/routes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;

const uploadsDir = join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL 
    : ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Invoice AI Running',
    timestamp: new Date().toISOString(),
    ai_enabled: !!process.env.OPENAI_API_KEY,
    model: 'OpenAI GPT-4'
  });
});

app.use('/api', invoiceRoutes);

app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Server error' : error.message
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Invoice AI Server`);
  console.log(`Running on http://localhost:${PORT}`);
  console.log(`OpenAI: ${process.env.OPENAI_API_KEY ? 'ENABLED' : 'DISABLED'}`);
  console.log(`Uploads: ${uploadsDir}`);
});
