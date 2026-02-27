const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { dbAsync } = require('../database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Регистрация нового пользователя
router.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Валидация
        if (!name || !email || !password) {
            return res.status(400).json({ 
                message: 'Пожалуйста, заполните все поля' 
            });
        }

        if (password.length < 6) {
            return res.status(400).json({ 
                message: 'Пароль должен быть не менее 6 символов' 
            });
        }

        // Проверяем, не занят ли email
        const existingUser = await dbAsync.get(
            'SELECT id FROM users WHERE email = ?',
            [email]
        );

        if (existingUser) {
            return res.status(400).json({ 
                message: 'Пользователь с таким email уже существует' 
            });
        }

        // Хэшируем пароль
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Сохраняем пользователя в БД
        const result = await dbAsync.run(
            'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
            [name, email, hashedPassword]
        );

        // Создаем JWT токен
        const token = jwt.sign(
            { 
                userId: result.lastID, 
                email: email,
                name: name 
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        // Отправляем успешный ответ
        res.status(201).json({
            message: 'Регистрация прошла успешно',
            token,
            user: {
                id: result.lastID,
                name,
                email
            }
        });

    } catch (error) {
        console.error('Ошибка регистрации:', error);
        res.status(500).json({ 
            message: 'Ошибка при регистрации. Пожалуйста, попробуйте позже.' 
        });
    }
});

// Вход пользователя
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Валидация
        if (!email || !password) {
            return res.status(400).json({ 
                message: 'Пожалуйста, введите email и пароль' 
            });
        }

        // Ищем пользователя в БД
        const user = await dbAsync.get(
            'SELECT id, name, email, password FROM users WHERE email = ?',
            [email]
        );

        if (!user) {
            return res.status(401).json({ 
                message: 'Неверный email или пароль' 
            });
        }

        // Проверяем пароль
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({ 
                message: 'Неверный email или пароль' 
            });
        }

        // Создаем JWT токен
        const token = jwt.sign(
            { 
                userId: user.id, 
                email: user.email,
                name: user.name 
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        // Отправляем успешный ответ
        res.json({
            message: 'Вход выполнен успешно',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email
            }
        });

    } catch (error) {
        console.error('Ошибка входа:', error);
        res.status(500).json({ 
            message: 'Ошибка при входе. Пожалуйста, попробуйте позже.' 
        });
    }
});

// Получение информации о текущем пользователе (защищенный маршрут)
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const user = await dbAsync.get(
            'SELECT id, name, email, created_at FROM users WHERE id = ?',
            [req.userId]
        );

        if (!user) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }

        res.json({ user });
    } catch (error) {
        console.error('Ошибка получения профиля:', error);
        res.status(500).json({ 
            message: 'Ошибка при получении профиля' 
        });
    }
});

// Обновление имени пользователя (защищенный маршрут)
router.put('/profile', authMiddleware, async (req, res) => {
    try {
        const { name } = req.body;

        // Валидация
        if (!name || name.trim().length === 0) {
            return res.status(400).json({ 
                message: 'Имя не может быть пустым' 
            });
        }

        if (name.length > 50) {
            return res.status(400).json({ 
                message: 'Имя не может быть длиннее 50 символов' 
            });
        }

        // Обновляем имя пользователя
        const result = await dbAsync.run(
            'UPDATE users SET name = ? WHERE id = ?',
            [name.trim(), req.userId]
        );

        if (result.changes === 0) {
            return res.status(404).json({ 
                message: 'Пользователь не найден' 
            });
        }

        // Получаем обновленные данные пользователя
        const updatedUser = await dbAsync.get(
            'SELECT id, name, email, created_at FROM users WHERE id = ?',
            [req.userId]
        );

        res.json({
            message: 'Имя успешно обновлено',
            user: {
                id: updatedUser.id,
                name: updatedUser.name,
                email: updatedUser.email,
                created_at: updatedUser.created_at
            }
        });

    } catch (error) {
        console.error('Ошибка обновления профиля:', error);
        res.status(500).json({ 
            message: 'Ошибка при обновлении профиля' 
        });
    }
});

// Выход
router.post('/logout', authMiddleware, (req, res) => {
    res.json({ message: 'Выход выполнен успешно' });
});

module.exports = router;