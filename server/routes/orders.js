const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { dbAsync } = require('../database');

// Все маршруты заказов требуют авторизации
router.use(authMiddleware);

// Функция для генерации уникального номера заказа
function generateOrderNumber() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `MUUN-${year}${month}${day}-${random}`;
}

// Создать заказ из корзины
router.post('/', async (req, res) => {
    try {
        const {
            deliveryAddress,
            deliveryCity,
            deliveryPostalCode,
            deliveryPhone,
            deliveryRecipient,
            paymentMethod = 'card' // card или cash
        } = req.body;

        // Валидация
        if (!deliveryAddress || !deliveryCity || !deliveryPhone || !deliveryRecipient) {
            return res.status(400).json({ 
                message: 'Пожалуйста, заполните все обязательные поля доставки' 
            });
        }

        // Получаем корзину пользователя
        const cartItems = await dbAsync.all(
            `SELECT 
                c.quantity,
                c.size,
                p.id as product_id,
                p.name as product_name,
                p.price as product_price
             FROM cart_items c
             JOIN products p ON c.product_id = p.id
             WHERE c.user_id = ?`,
            [req.userId]
        );

        if (!cartItems || cartItems.length === 0) {
            return res.status(400).json({ message: 'Корзина пуста' });
        }

        // Рассчитываем общую сумму
        const totalAmount = cartItems.reduce((sum, item) => 
            sum + (item.product_price * item.quantity), 0
        );

        // Генерируем уникальный номер заказа
        const orderNumber = generateOrderNumber();

        // Начинаем транзакцию (в SQLite нужно делать последовательно)
        // Создаем заказ
        const orderResult = await dbAsync.run(
            `INSERT INTO orders (
                user_id, order_number, total_amount, status, 
                payment_method, delivery_address, delivery_city, 
                delivery_postal_code, delivery_phone, delivery_recipient
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                req.userId, 
                orderNumber, 
                totalAmount, 
                'processing', // Статус по умолчанию
                paymentMethod,
                deliveryAddress,
                deliveryCity,
                deliveryPostalCode || null,
                deliveryPhone,
                deliveryRecipient
            ]
        );

        // Добавляем товары в заказ
        for (const item of cartItems) {
            await dbAsync.run(
                `INSERT INTO order_items (
                    order_id, product_id, product_name, product_price, quantity, size
                ) VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    orderResult.lastID,
                    item.product_id,
                    item.product_name,
                    item.product_price,
                    item.quantity,
                    item.size || null
                ]
            );
        }

        // Очищаем корзину
        await dbAsync.run(
            'DELETE FROM cart_items WHERE user_id = ?',
            [req.userId]
        );

        // Получаем созданный заказ для ответа
        const newOrder = await dbAsync.get(
            `SELECT * FROM orders WHERE id = ?`,
            [orderResult.lastID]
        );

        // Форматируем сумму
        newOrder.totalAmountFormatted = new Intl.NumberFormat('ru-RU').format(newOrder.total_amount) + ' ₽';
        
        // Добавляем статус на русском для отображения
        const statusMap = {
            'processing': 'Обрабатывается',
            'shipped': 'Отправлен',
            'delivered': 'Доставлен',
            'cancelled': 'Отменён'
        };
        newOrder.statusText = statusMap[newOrder.status] || newOrder.status;

        res.status(201).json({
            message: 'Заказ успешно оформлен',
            order: newOrder
        });

    } catch (error) {
        console.error('Ошибка создания заказа:', error);
        res.status(500).json({ 
            message: 'Ошибка при оформлении заказа',
            error: error.message 
        });
    }
});

// Получить все заказы пользователя
router.get('/', async (req, res) => {
    try {
        const orders = await dbAsync.all(
            `SELECT * FROM orders 
             WHERE user_id = ? 
             ORDER BY created_at DESC`,
            [req.userId]
        );

        // Для каждого заказа получаем товары
        const ordersWithItems = await Promise.all(orders.map(async (order) => {
            const items = await dbAsync.all(
                `SELECT * FROM order_items WHERE order_id = ?`,
                [order.id]
            );

            // Форматируем цены
            const formattedItems = items.map(item => ({
                ...item,
                priceFormatted: new Intl.NumberFormat('ru-RU').format(item.product_price) + ' ₽',
                totalFormatted: new Intl.NumberFormat('ru-RU').format(item.product_price * item.quantity) + ' ₽'
            }));

            // Карта статусов для отображения
            const statusMap = {
                'processing': 'Обрабатывается',
                'shipped': 'Отправлен',
                'delivered': 'Доставлен',
                'cancelled': 'Отменён'
            };

            // Карта цветов для статусов
            const statusColorMap = {
                'processing': '#f39c12', // оранжевый
                'shipped': '#3498db',     // синий
                'delivered': '#27ae60',   // зеленый
                'cancelled': '#e74c3c'    // красный
            };

            return {
                ...order,
                items: formattedItems,
                totalAmountFormatted: new Intl.NumberFormat('ru-RU').format(order.total_amount) + ' ₽',
                statusText: statusMap[order.status] || order.status,
                statusColor: statusColorMap[order.status] || '#95a5a6',
                createdFormatted: new Date(order.created_at).toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                })
            };
        }));

        res.json(ordersWithItems);
    } catch (error) {
        console.error('Ошибка получения заказов:', error);
        res.status(500).json({ 
            message: 'Ошибка при получении заказов',
            error: error.message 
        });
    }
});

// Получить конкретный заказ
router.get('/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;

        const order = await dbAsync.get(
            `SELECT * FROM orders WHERE id = ? AND user_id = ?`,
            [orderId, req.userId]
        );

        if (!order) {
            return res.status(404).json({ message: 'Заказ не найден' });
        }

        const items = await dbAsync.all(
            `SELECT * FROM order_items WHERE order_id = ?`,
            [orderId]
        );

        const formattedItems = items.map(item => ({
            ...item,
            priceFormatted: new Intl.NumberFormat('ru-RU').format(item.product_price) + ' ₽',
            totalFormatted: new Intl.NumberFormat('ru-RU').format(item.product_price * item.quantity) + ' ₽'
        }));

        const statusMap = {
            'processing': 'Обрабатывается',
            'shipped': 'Отправлен',
            'delivered': 'Доставлен',
            'cancelled': 'Отменён'
        };

        res.json({
            ...order,
            items: formattedItems,
            totalAmountFormatted: new Intl.NumberFormat('ru-RU').format(order.total_amount) + ' ₽',
            statusText: statusMap[order.status] || order.status,
            createdFormatted: new Date(order.created_at).toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            })
        });
    } catch (error) {
        console.error('Ошибка получения заказа:', error);
        res.status(500).json({ 
            message: 'Ошибка при получении заказа',
            error: error.message 
        });
    }
});

// Отменить заказ (только если он в статусе processing)
router.put('/:orderId/cancel', async (req, res) => {
    try {
        const { orderId } = req.params;

        const order = await dbAsync.get(
            `SELECT status FROM orders WHERE id = ? AND user_id = ?`,
            [orderId, req.userId]
        );

        if (!order) {
            return res.status(404).json({ message: 'Заказ не найден' });
        }

        if (order.status !== 'processing') {
            return res.status(400).json({ 
                message: 'Нельзя отменить заказ после отправки' 
            });
        }

        await dbAsync.run(
            `UPDATE orders SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP 
             WHERE id = ?`,
            [orderId]
        );

        res.json({ message: 'Заказ отменён' });
    } catch (error) {
        console.error('Ошибка отмены заказа:', error);
        res.status(500).json({ 
            message: 'Ошибка при отмене заказа',
            error: error.message 
        });
    }
});

// Для администрирования (имитация смены статуса) - можно добавить позже
// router.put('/:orderId/status', adminMiddleware, ...)

module.exports = router;