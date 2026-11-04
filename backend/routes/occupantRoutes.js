const express = require('express');
const router = express.Router();
const multer = require('multer');
const occupantController = require('../controllers/occupantController');

// Multer memory storage (keeps file buffer in RAM for quick xlsx parsing)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
});

// List all occupants
router.get('/', occupantController.getAllOccupants);

// Download Excel sample template
router.get('/template', occupantController.getTemplate);

// Export current directory as Excel
router.get('/export', occupantController.exportOccupants);

// Add occupant manually
router.post('/', occupantController.createOccupant);

// Bulk upload occupants via Excel (.xlsx, .xls) or CSV
router.post('/upload', upload.single('file'), occupantController.uploadExcel);

// Quick toggle evacuation status
router.patch('/:id/status', occupantController.updateStatus);

// Edit occupant manually
router.put('/:id', occupantController.updateOccupant);

// Delete occupant
router.delete('/:id', occupantController.deleteOccupant);

module.exports = router;
