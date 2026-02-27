const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { dbAsync } = require('../database');

// Все маршруты корзины требуют авторизации
router.use(authMiddleware);

// Получить все товары в корзине текущего пользователя
router.get('/', async (req, res) => {
    try {
        const cartItems = await dbAsync.all(
            `SELECT 
                c.id as cart_item_id,
                c.quantity,
                c.size,
                c.created_at as added_at,
                p.*
             FROM cart_items c
             JOIN products p ON c.product_id = p.id
             WHERE c.user_id = ?
             ORDER BY c.created_at DESC`,
            [req.userId]
        );

        // Форматируем цену и считаем общую стоимость
        let totalAmount = 0;
        const formattedItems = cartItems.map(item => {
            const itemTotal = item.price * item.quantity;
            totalAmount += itemTotal;
            return {
                ...item,
                priceFormatted: new Intl.NumberFormat('ru-RU').format(item.price) + ' ₽',
                itemTotal: itemTotal,
                itemTotalFormatted: new Intl.NumberFormat('ru-RU').format(itemTotal) + ' ₽',
                size: item.size || null // Если размер не указан, возвращаем null
            };
        });

        res.json({
            items: formattedItems,
            totalAmount: totalAmount,
            totalAmountFormatted: new Intl.NumberFormat('ru-RU').format(totalAmount) + ' ₽',
            totalItems: cartItems.reduce((sum, item) => sum + item.quantity, 0)
        });
    } catch (error) {
        console.error('Ошибка получения корзины:', error);
        res.status(500).json({ 
            message: 'Ошибка при получении корзины',
            error: error.message 
        });
    }
});

// Добавить товар в корзину (или увеличить количество)
router.post('/', async (req, res) => {
    try {
        const { productId, quantity = 1, size } = req.body;

        if (!productId) {
            return res.status(400).json({ message: 'Не указан ID товара' });
        }

        if (quantity < 1) {
            return res.status(400).json({ message: 'Количество должно быть больше 0' });
        }

        // Проверяем, существует ли товар
        const product = await dbAsync.get(
            'SELECT id, price FROM products WHERE id = ?',
            [productId]
        );

        if (!product) {
            return res.status(404).json({ message: 'Товар не найден' });
        }

        // Проверяем, есть ли уже этот товар с таким же размером в корзине пользователя
        const existingItem = await dbAsync.get(
            'SELECT id, quantity FROM cart_items WHERE user_id = ? AND product_id = ? AND size = ?',
            [req.userId, productId, size || null]
        );

        let result;
        if (existingItem) {
            // Если товар с таким размером уже есть, обновляем количество
            result = await dbAsync.run(
                'UPDATE cart_items SET quantity = quantity + ? WHERE user_id = ? AND product_id = ? AND size = ?',
                [quantity, req.userId, productId, size || null]
            );
        } else {
            // Если товара с таким размером нет, добавляем новую запись
            result = await dbAsync.run(
                'INSERT INTO cart_items (user_id, product_id, quantity, size) VALUES (?, ?, ?, ?)',
                [req.userId, productId, quantity, size || null]
            );
        }

        res.status(201).json({ 
            message: 'Товар добавлен в корзину',
            productId: productId,
            quantity: quantity,
            size: size || null
        });

    } catch (error) {
        console.error('Ошибка добавления в корзину:', error);
        res.status(500).json({ 
            message: 'Ошибка при добавлении в корзину',
            error: error.message 
        });
    }
});

// Изменить количество конкретного товара в корзине
router.put('/:productId', async (req, res) => {
    try {
        const { productId } = req.params;
        const { quantity, size } = req.body; // Добавляем size для точного определения товара

        if (!quantity || quantity < 1) {
            return res.status(400).json({ message: 'Укажите корректное количество (больше 0)' });
        }

        // Проверяем, есть ли товар с таким размером в корзине
        const existingItem = await dbAsync.get(
            'SELECT id FROM cart_items WHERE user_id = ? AND product_id = ? AND size = ?',
            [req.userId, productId, size || null]
        );

        if (!existingItem) {
            return res.status(404).json({ message: 'Товар не найден в корзине' });
        }

        // Обновляем количество
        await dbAsync.run(
            'UPDATE cart_items SET quantity = ? WHERE user_id = ? AND product_id = ? AND size = ?',
            [quantity, req.userId, productId, size || null]
        );

        res.json({ 
            message: 'Количество товара обновлено',
            productId: productId,
            quantity: quantity,
            size: size || null
        });

    } catch (error) {
        console.error('Ошибка обновления корзины:', error);
        res.status(500).json({ 
            message: 'Ошибка при обновлении корзины',
            error: error.message 
        });
    }
});

// Удалить конкретный товар из корзины
router.delete('/:productId', async (req, res) => {
    try {
        const { productId } = req.params;
        const { size } = req.query; // Размер может быть передан как query параметр

        let result;
        if (size) {
            // Удаляем товар конкретного размера
            result = await dbAsync.run(
                'DELETE FROM cart_items WHERE user_id = ? AND product_id = ? AND size = ?',
                [req.userId, productId, size]
            );
        } else {
            // Если размер не указан, удаляем все размеры этого товара
            result = await dbAsync.run(
                'DELETE FROM cart_items WHERE user_id = ? AND product_id = ?',
                [req.userId, productId]
            );
        }

        if (result.changes === 0) {
            return res.status(404).json({ message: 'Товар не найден в корзине' });
        }

        res.json({ 
            message: 'Товар удален из корзины',
            productId: productId,
            size: size || null
        });

    } catch (error) {
        console.error('Ошибка удаления из корзины:', error);
        res.status(500).json({ 
            message: 'Ошибка при удалении из корзины',
            error: error.message 
        });
    }
});

// Полностью очистить корзину пользователя
router.delete('/', async (req, res) => {
    try {
        await dbAsync.run(
            'DELETE FROM cart_items WHERE user_id = ?',
            [req.userId]
        );

        res.json({ message: 'Корзина очищена' });

    } catch (error) {
        console.error('Ошибка очистки корзины:', error);
        res.status(500).json({ 
            message: 'Ошибка при очистке корзины',
            error: error.message 
        });
    }
});

module.exports = router;