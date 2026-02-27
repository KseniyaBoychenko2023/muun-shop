const express = require('express');
const router = express.Router();

// Эндпоинт для получения конфигурации
router.get('/config', (req, res) => {
    res.json({
        dadataApiKey: process.env.DADATA_API_KEY
    });
});

module.exports = router;