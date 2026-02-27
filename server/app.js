const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Загружаем переменные окружения
dotenv.config({ path: path.join(__dirname, '../.env') });

// Инициализируем базу данных
const { initializeDatabase } = require('./database');

// Создаем приложение Express
const app = express();

// Middleware
app.use(cors()); // Разрешаем кросс-доменные запросы
app.use(express.json()); // Парсим JSON-тела запросов
app.use(express.urlencoded({ extended: true })); // Парсим данные из форм

// Инициализируем базу данных при запуске
initializeDatabase();

// Отдаем статические файлы из папки public
app.use(express.static(path.join(__dirname, '../public')));

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/login.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/register.html'));
});

app.get('/profile', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/profile.html'));
});

app.get('/favorites', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/favorites.html'));
});

app.get('/cart', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/cart.html'));
});

app.get('/novinki', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/novinki.html'));
});

app.get('/catalog', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/catalog.html'));
});

app.get('/base', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/base.html'));
});

app.get('/about', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/about.html'));
});

app.get('/product/:id', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/product.html'));
});

// Простой тестовый маршрут
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Сервер работает!' });
});

// Подключаем маршруты
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const favoriteRoutes = require('./routes/favorites');
const cartRoutes = require('./routes/cart');
const orderRoutes = require('./routes/orders');

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);

app.get('/checkout', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/checkout.html'));
});

// Обработка ошибок
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Что-то пошло не так!' });
});

// Запускаем сервер
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Сервер запущен. Порт: ${PORT}.`);
});