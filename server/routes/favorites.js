const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { dbAsync } = require('../database');

// Все маршруты избранного требуют авторизации
router.use(authMiddleware);

// Получить все товары из избранного текущего пользователя
router.get('/', async (req, res) => {
    try {
        const favorites = await dbAsync.all(
            `SELECT p.*, f.created_at as favorited_at
             FROM favorites f
             JOIN products p ON f.product_id = p.id
             WHERE f.user_id = ?
             ORDER BY f.created_at DESC`,
            [req.userId]
        );

        // Форматируем цену для каждого товара
        const formattedFavorites = favorites.map(item => ({
            ...item,
            priceFormatted: new Intl.NumberFormat('ru-RU').format(item.price) + ' ₽'
        }));

        res.json(formattedFavorites);
    } catch (error) {
        console.error('Ошибка получения избранного:', error);
        res.status(500).json({ 
            message: 'Ошибка при получении избранного',
            error: error.message 
        });
    }
});

// Добавить товар в избранное
router.post('/', async (req, res) => {
    try {
        const { productId } = req.body;

        if (!productId) {
            return res.status(400).json({ message: 'Не указан ID товара' });
        }

        // Проверяем, существует ли товар
        const product = await dbAsync.get(
            'SELECT id FROM products WHERE id = ?',
            [productId]
        );

        if (!product) {
            return res.status(404).json({ message: 'Товар не найден' });
        }

        // Пытаемся добавить запись. Благодаря UNIQUE(user_id, product_id) дубликаты не создадутся.
        await dbAsync.run(
            'INSERT OR IGNORE INTO favorites (user_id, product_id) VALUES (?, ?)',
            [req.userId, productId]
        );

        res.status(201).json({ 
            message: 'Товар добавлен в избранное',
            productId: productId 
        });
    } catch (error) {
        console.error('Ошибка добавления в избранное:', error);
        res.status(500).json({ 
            message: 'Ошибка при добавлении в избранное',
            error: error.message 
        });
    }
});

// Удалить товар из избранного
router.delete('/:productId', async (req, res) => {
    try {
        const { productId } = req.params;

        const result = await dbAsync.run(
            'DELETE FROM favorites WHERE user_id = ? AND product_id = ?',
            [req.userId, productId]
        );

        if (result.changes === 0) {
            return res.status(404).json({ message: 'Товар не найден в избранном' });
        }

        res.json({ 
            message: 'Товар удален из избранного',
            productId: productId 
        });
    } catch (error) {
        console.error('Ошибка удаления из избранного:', error);
        res.status(500).json({ 
            message: 'Ошибка при удалении из избранного',
            error: error.message 
        });
    }
});

module.exports = router;