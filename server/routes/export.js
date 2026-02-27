const express = require('express');
const router = express.Router();
const { dbAsync } = require('../database');
const authMiddleware = require('../middleware/auth');

// Специальный middleware для админа
const adminMiddleware = (req, res, next) => {
    if (req.userEmail === process.env.ADMIN_EMAIL) {
        next();
    } else {
        res.status(403).json({ message: 'Доступ запрещён' });
    }
};

router.get('/export-all', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const users = await dbAsync.all('SELECT * FROM users');
        const products = await dbAsync.all('SELECT * FROM products');
        const orders = await dbAsync.all('SELECT * FROM orders');
        const orderItems = await dbAsync.all('SELECT * FROM order_items');
        const favorites = await dbAsync.all('SELECT * FROM favorites');
        const cartItems = await dbAsync.all('SELECT * FROM cart_items');
        
        res.json({
            success: true,
            timestamp: new Date().toISOString(),
            data: {
                users,
                products,
                orders,
                orderItems,
                favorites,
                cartItems
            }
        });
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

module.exports = router;