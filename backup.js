const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Настройки
const API_URL = 'https://muun-backend.onrender.com/api';
const TOKEN = '';

async function askForToken() {
    return new Promise((resolve) => {
        rl.question('Введите ваш JWT токен (из localStorage): ', (token) => {
            resolve(token.trim());
        });
    });
}

async function fetchData(token) {
    console.log('Загружаем данные с Render...');
    
    const response = await fetch(`${API_URL}/export-all`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    
    if (!response.ok) {
        throw new Error(`Ошибка загрузки: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
        throw new Error(result.message);
    }
    
    console.log(`Загружено:`);
    console.log(`   - Пользователей: ${result.data.users.length}`);
    console.log(`   - Товаров: ${result.data.products.length}`);
    console.log(`   - Заказов: ${result.data.orders.length}`);
    
    return result.data;
}

async function saveToLocalDb(data) {
    console.log('\nСохраняем в локальную базу...');
    
    const dbPath = path.join(__dirname, 'server', 'muun.db');
    
    // Создаём резервную копию текущей БД
    if (fs.existsSync(dbPath)) {
        const backupPath = path.join(__dirname, 'server', `muun.backup.${Date.now()}.db`);
        fs.copyFileSync(dbPath, backupPath);
        console.log(`Создана резервная копия: ${backupPath}`);
    }
    
    const db = new sqlite3.Database(dbPath);
    
    // Включаем внешние ключи
    db.run('PRAGMA foreign_keys = OFF');
    
    // Очищаем существующие данные (кроме товаров, их оставляем)
    await new Promise((resolve, reject) => {
        db.run('DELETE FROM order_items', (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
    
    await new Promise((resolve, reject) => {
        db.run('DELETE FROM orders', (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
    
    await new Promise((resolve, reject) => {
        db.run('DELETE FROM users', (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
    
    await new Promise((resolve, reject) => {
        db.run('DELETE FROM favorites', (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
    
    await new Promise((resolve, reject) => {
        db.run('DELETE FROM cart_items', (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
    
    // Сохраняем пользователей
    for (const user of data.users) {
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT OR REPLACE INTO users (id, name, email, password, created_at) 
                 VALUES (?, ?, ?, ?, ?)`,
                [user.id, user.name, user.email, user.password, user.created_at],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }
    console.log(`   - Пользователи: ${data.users.length}`);
    
    // Сохраняем заказы
    for (const order of data.orders) {
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT OR REPLACE INTO orders 
                 (id, user_id, order_number, total_amount, status, payment_method, 
                  delivery_address, delivery_city, delivery_postal_code, 
                  delivery_phone, delivery_recipient, created_at, updated_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    order.id, order.user_id, order.order_number, order.total_amount,
                    order.status, order.payment_method, order.delivery_address,
                    order.delivery_city, order.delivery_postal_code, order.delivery_phone,
                    order.delivery_recipient, order.created_at, order.updated_at
                ],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }
    console.log(`   - Заказы: ${data.orders.length}`);
    
    // Сохраняем товары в заказах
    for (const item of data.orderItems) {
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT OR REPLACE INTO order_items 
                 (id, order_id, product_id, product_name, product_price, quantity, size, created_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    item.id, item.order_id, item.product_id, item.product_name,
                    item.product_price, item.quantity, item.size, item.created_at
                ],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }
    console.log(`   - Товары в заказах: ${data.orderItems.length}`);
    
    // Сохраняем избранное
    for (const fav of data.favorites) {
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT OR REPLACE INTO favorites (id, user_id, product_id, created_at) 
                 VALUES (?, ?, ?, ?)`,
                [fav.id, fav.user_id, fav.product_id, fav.created_at],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }
    
    // Сохраняем корзину
    for (const item of data.cartItems) {
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT OR REPLACE INTO cart_items (id, user_id, product_id, quantity, size, created_at) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [item.id, item.user_id, item.product_id, item.quantity, item.size, item.created_at],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }
    
    db.run('PRAGMA foreign_keys = ON');
    db.close();
    
    console.log('\nЛокальная база данных успешно обновлена!');
}

async function main() {
    console.log('Синхронизация данных с Render\n');
    
    try {
        const token = await askForToken();
        const data = await fetchData(token);
        await saveToLocalDb(data);
        
        console.log('\nГотово! Теперь можно коммитить обновлённую БД:');
        console.log('   git add server/muun.db');
        console.log('   git commit -m "Sync orders from production"');
        console.log('   git push');
        
    } catch (error) {
        console.error('\nОшибка:', error.message);
    } finally {
        rl.close();
    }
}

main();