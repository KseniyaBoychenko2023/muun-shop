const express = require('express');
const { dbAsync } = require('../database');
const router = express.Router();

// Получить все товары (с возможностью фильтрации по категории)
router.get('/', async (req, res) => {
    try {
        const {
            category,
            search,
            minPrice,
            maxPrice,
            material,
            sortBy = 'created_at', // По умолчанию сортируем по дате
            order = 'DESC'          // По умолчанию сначала новые
        } = req.query;

        let sql = 'SELECT * FROM products WHERE 1=1'; // Базовый SQL запрос
        let params = [];

        // Фильтр по категории
        if (category) {
            sql += ' AND category = ?';
            params.push(category);
        }

        // Поиск по названию или описанию
        if (search) {
            sql += ' AND (name LIKE ? OR description LIKE ?)';
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm);
        }

        // Фильтр по минимальной цене
        if (minPrice && !isNaN(minPrice)) {
            sql += ' AND price >= ?';
            params.push(parseInt(minPrice));
        }

        // Фильтр по максимальной цене
        if (maxPrice && !isNaN(maxPrice)) {
            sql += ' AND price <= ?';
            params.push(parseInt(maxPrice));
        }

        // Фильтр по материалу
        if (material) {
            sql += ' AND material = ?';
            params.push(material);
        }

        // Сортировка
        // Проверяем, что sortBy - допустимое имя колонки, чтобы избежать SQL-инъекций
        const allowedSortColumns = ['name', 'price', 'created_at', 'category'];
        const allowedOrder = ['ASC', 'DESC'];

        const sortColumn = allowedSortColumns.includes(sortBy) ? sortBy : 'created_at';
        const sortOrder = allowedOrder.includes(order.toUpperCase()) ? order : 'DESC';

        sql += ` ORDER BY ${sortColumn} ${sortOrder}`;

        // Выполняем запрос
        const products = await dbAsync.all(sql, params);

        // Добавляем форматирование цены
        const formattedProducts = products.map(product => ({
            ...product,
            priceFormatted: new Intl.NumberFormat('ru-RU').format(product.price) + ' ₽'
        }));

        res.json(formattedProducts);
    } catch (error) {
        console.error('Ошибка получения товаров:', error);
        res.status(500).json({
            message: 'Ошибка при получении товаров',
            error: error.message
        });
    }
});

// Поиск товаров
router.get('/search/:query', async (req, res) => {
    try {
        const searchQuery = `%${req.params.query}%`;
        const products = await dbAsync.all(
            'SELECT * FROM products WHERE name LIKE ? OR description LIKE ? ORDER BY created_at DESC',
            [searchQuery, searchQuery]
        );

        const formattedProducts = products.map(product => ({
            ...product,
            priceFormatted: new Intl.NumberFormat('ru-RU').format(product.price) + ' ₽'
        }));

        res.json(formattedProducts);
    } catch (error) {
        console.error('Ошибка поиска:', error);
        res.status(500).json({ 
            message: 'Ошибка при поиске',
            error: error.message 
        });
    }
});

// Получить товары по категории
router.get('/category/:category', async (req, res) => {
    try {
        const products = await dbAsync.all(
            'SELECT * FROM products WHERE category = ? ORDER BY created_at DESC',
            [req.params.category]
        );

        const formattedProducts = products.map(product => ({
            ...product,
            priceFormatted: new Intl.NumberFormat('ru-RU').format(product.price) + ' ₽'
        }));

        res.json(formattedProducts);
    } catch (error) {
        console.error('Ошибка получения товаров по категории:', error);
        res.status(500).json({ 
            message: 'Ошибка при получении товаров',
            error: error.message 
        });
    }
});

// Получить новинки
router.get('/new/arrivals', async (req, res) => {
    try {
        const products = await dbAsync.all(
            'SELECT * FROM products ORDER BY created_at DESC LIMIT 8'
        );

        const formattedProducts = products.map(product => ({
            ...product,
            priceFormatted: new Intl.NumberFormat('ru-RU').format(product.price) + ' ₽'
        }));

        res.json(formattedProducts);
    } catch (error) {
        console.error('Ошибка получения новинок:', error);
        res.status(500).json({ 
            message: 'Ошибка при получении новинок',
            error: error.message 
        });
    }
});

// Получить товар по ID
router.get('/:id', async (req, res) => {
    try {
        const product = await dbAsync.get(
            'SELECT * FROM products WHERE id = ?',
            [req.params.id]
        );

        if (!product) {
            return res.status(404).json({ 
                message: 'Товар не найден' 
            });
        }

        // Форматируем цену
        product.priceFormatted = new Intl.NumberFormat('ru-RU').format(product.price) + ' ₽';

        res.json(product);
    } catch (error) {
        console.error('Ошибка получения товара:', error);
        res.status(500).json({ 
            message: 'Ошибка при получении товара',
            error: error.message 
        });
    }
});

module.exports = router;