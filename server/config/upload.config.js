import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configure storage for order images
const orderStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Use orderFolderPath set by middleware
    // Structure: {order_type}/{company_name (B2B only)}/{platform_order_id or internal_order_id}
    // req.orderFolderPath is set by prepareNewOrderUpload or prepareUpdateOrderUpload middleware
    const folderPath = req.orderFolderPath || req.body.internal_order_id || 'temp';
    const uploadPath = path.join(__dirname, '../../uploads/orders', folderPath);

    // Create directory if it doesn't exist (recursive creates parent folders too)
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    // Store the upload path for later use
    req.orderUploadPath = uploadPath;
    req.orderFolderPath = folderPath;

    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp-originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext);
    cb(null, `${basename}-${uniqueSuffix}${ext}`);
  }
});

// File filter - only allow images
const imageFileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.'), false);
  }
};

// Multer configuration for order images (supports up to 5 images)
export const uploadOrderImage = multer({
  storage: orderStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size per image
    files: 5 // Maximum 5 files per upload
  }
});

// Middleware to handle multer errors
export const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File too large',
        message: 'Each file size cannot exceed 10MB'
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        error: 'Too many files',
        message: 'Maximum 5 images allowed per order'
      });
    }
    return res.status(400).json({
      success: false,
      error: 'Upload error',
      message: err.message
    });
  } else if (err) {
    return res.status(400).json({
      success: false,
      error: 'Upload error',
      message: err.message
    });
  }
  next();
};
