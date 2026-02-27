const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    try {
        // Получаем токен из заголовка Authorization
        const authHeader = req.headers.authorization;
        
        if (!authHeader) {
            return res.status(401).json({ message: 'Токен не предоставлен' });
        }

        // Ожидаем формат: "Bearer <token>"
        const token = authHeader.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ message: 'Неверный формат токена' });
        }

        // Проверяем токен
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Добавляем данные пользователя в запрос
        req.userId = decoded.userId;
        req.userEmail = decoded.email;
        
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Недействительный токен' });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Токен истек' });
        }
        res.status(500).json({ message: 'Ошибка авторизации' });
    }
};

module.exports = authMiddleware;