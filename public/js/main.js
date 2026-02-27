const API_URL = 'https://muun-backend.onrender.com/api';
const productsCache = new Map(); // Кэш для хранения результатов запросов
let currentRequestController = null; // Для отмены предыдущего запроса

// ========== НАВИГАЦИЯ И АВТОРИЗАЦИЯ ==========
function updateNavigation() {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    const rightMenu = document.querySelector('.right-menu');

    if (!rightMenu) return;

    if (token && user) {
        // Пользователь авторизован
        const authHtml = `
            <div class="user-menu">
                <span class="user-name">${user.name}</span>
                <div class="user-dropdown">
                    <a href="/profile.html">Личный кабинет</a>
                    <a href="/favorites.html">Избранное <span class="fav-count">0</span></a>
                    <a href="/cart.html">Корзина <span class="cart-count">0</span></a>
                    <button class="logout-btn" onclick="logout()">Выйти</button>
                </div>
            </div>
        `;

        rightMenu.innerHTML = '';
        rightMenu.insertAdjacentHTML('beforeend', authHtml);
    } else {
        // Пользователь не авторизован
        rightMenu.innerHTML = '';
        rightMenu.insertAdjacentHTML('beforeend', '<a href="/login.html">Войти</a>');
    }
}

// Выход из системы
window.logout = function () {
    const token = localStorage.getItem('token');
    if (token) {
        fetch(`${API_URL}/auth/logout`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        }).finally(() => {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            updateNavigation();
            window.location.href = '/index.html';
        });
    } else {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/index.html';
    }
};

// Загрузка товаров по категории
window.loadProducts = async function (category, containerId) {
    try {
        let url = category ? `${API_URL}/products?category=${encodeURIComponent(category)}` : `${API_URL}/products`;

        const response = await fetch(url);
        if (!response.ok) throw new Error('Ошибка загрузки');

        const products = await response.json();

        const container = document.getElementById(containerId);
        if (!container) return;

        if (!products || products.length === 0) {
            container.innerHTML = '<p class="empty-message">Товары не найдены</p>';
            return;
        }

        container.innerHTML = '';
        products.forEach(product => {
            container.appendChild(createProductCard(product));
        });
    } catch (error) {
        console.error('Error loading products:', error);
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = '<p class="error-message">Ошибка загрузки товаров. Пожалуйста, обновите страницу.</p>';
        }
    }
};

// ========== ЗАГРУЗКА ТОВАРОВ ПО СТРАНИЦАМ ==========
function loadPageProducts() {
    const path = window.location.pathname;

    if (path.includes('novinki.html') || path === '/novinki') {
        // Загружаем товары категории "новинки" с возможностью фильтрации
        loadProductsWithFilters('новинки');
    } else if (path.includes('catalog.html') || path === '/catalog') {
        // Загружаем товары категории "коллекции" с возможностью фильтрации
        loadProductsWithFilters('коллекции');
    } else if (path.includes('base.html') || path === '/base') {
        // Загружаем товары категории "база" с возможностью фильтрации
        loadProductsWithFilters('база');
    } else if (path.includes('favorites.html') || path === '/favorites') {
        loadFavorites();
    } else if (path.includes('cart.html') || path === '/cart') {
        loadCart();
    }
}

// Загрузка товаров для каталога с учетом фильтров
async function loadProductsWithFilters(category = 'коллекции') {
    // Определяем ID контейнера в зависимости от категории
    let containerId = 'products-grid'; // по умолчанию для коллекций

    if (category === 'новинки') {
        containerId = 'novinki-grid';
    } else if (category === 'база') {
        containerId = 'basics-grid';
    }

    const container = document.getElementById(containerId);
    if (!container) return;

    // Собираем значения фильтров
    const search = document.getElementById('search-input')?.value || '';
    const minPrice = document.getElementById('price-min')?.value || '';
    const maxPrice = document.getElementById('price-max')?.value || '';
    const material = document.getElementById('material')?.value || '';
    const sortBy = document.getElementById('sort-by')?.value || 'created_at';
    const sortOrder = document.getElementById('sort-order')?.value || 'DESC';

    // Формируем ключ для кэша на основе всех параметров
    const cacheKey = `${category}-${search}-${minPrice}-${maxPrice}-${material}-${sortBy}-${sortOrder}`;

    // ПРОВЕРЯЕМ КЭШ: если уже загружали такие же фильтры, используем сохранённые данные
    if (productsCache.has(cacheKey)) {
        console.log('Загружено из кэша:', cacheKey);
        renderProducts(productsCache.get(cacheKey), container);
        return;
    }

    // Отменяем предыдущий запрос, если он ещё выполняется
    if (currentRequestController) {
        console.log('Отмена предыдущего запроса');
        currentRequestController.abort();
    }

    // Создаём новый контроллер для отмены запроса
    currentRequestController = new AbortController();

    // Формируем URL с параметрами
    let url = new URL(`${API_URL}/products`, window.location.origin);

    // Добавляем категорию
    url.searchParams.append('category', category);

    if (search) url.searchParams.append('search', search);
    if (minPrice) url.searchParams.append('minPrice', minPrice);
    if (maxPrice) url.searchParams.append('maxPrice', maxPrice);
    if (material) url.searchParams.append('material', material);
    url.searchParams.append('sortBy', sortBy);
    url.searchParams.append('order', sortOrder);

    try {
        // Показываем индикатор загрузки
        container.innerHTML = '<p class="loading">Загрузка...</p>';

        // Отправляем запрос с возможностью отмены
        const response = await fetch(url, {
            signal: currentRequestController.signal
        });

        if (!response.ok) throw new Error('Ошибка загрузки');

        const products = await response.json();

        // СОХРАНЯЕМ В КЭШ
        productsCache.set(cacheKey, products);
        console.log('Сохранено в кэш:', cacheKey);

        // Ограничиваем размер кэша (храним только последние 20 запросов)
        if (productsCache.size > 20) {
            const firstKey = productsCache.keys().next().value;
            productsCache.delete(firstKey);
            console.log('Кэш очищен, удалён старый ключ:', firstKey);
        }

        // Отрисовываем товары
        renderProducts(products, container);

    } catch (error) {
        // Если запрос отменён - это нормально, ничего не показываем
        if (error.name === 'AbortError') {
            console.log('Запрос отменён');
            return;
        }

        // Другие ошибки показываем пользователю
        console.error('Error loading products:', error);
        container.innerHTML = '<p class="error-message">Ошибка загрузки товаров.</p>';
    } finally {
        // Сбрасываем контроллер
        currentRequestController = null;
    }
}

// Создание карточки товара
function createProductCard(product) {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.dataset.id = product.id;
    card.style.cursor = 'pointer';

    // Проверяем, есть ли товар в избранном (если пользователь авторизован)
    const token = localStorage.getItem('token');

    card.innerHTML = `
        ${product.category === 'новинки' ? '<span class="new-badge">New</span>' : ''}
        <img src="${product.image_url || 'https://via.placeholder.com/300x400'}" 
             alt="${product.name}" 
             loading="lazy"
             onerror="this.src='https://via.placeholder.com/300x400'">
        <div class="product-name">${product.name}</div>
        <div class="product-price">${product.priceFormatted || new Intl.NumberFormat('ru-RU').format(product.price) + ' ₽'}</div>
        <div class="product-actions">
            <button class="fav-btn" onclick="toggleFavorite(${product.id}, this)">
                В избранное
            </button>
            <button class="cart-btn" onclick="addToCart(${product.id})">
                В корзину
            </button>
        </div>
    `;

    // Проверяем статус избранного при загрузке
    if (token) {
        checkFavoriteStatus(product.id, card.querySelector('.fav-btn'));
    }

    return card;
}

// ========== ОТРИСОВКА ТОВАРОВ ==========
function renderProducts(products, container) {
    if (!products || products.length === 0) {
        container.innerHTML = '<p class="empty-message">Товары не найдены</p>';
        return;
    }

    // Сохраняем текущие карточки для сравнения
    const currentCards = Array.from(container.children);

    // Если количество товаров совпадает, пробуем обновить только изменившиеся
    if (currentCards.length === products.length) {
        let needsFullRender = false;

        products.forEach((product, index) => {
            const existingCard = currentCards[index];
            // Если ID не совпадает или карточки нет, нужна полная перерисовка
            if (!existingCard || existingCard.dataset.id !== String(product.id)) {
                needsFullRender = true;
            }
        });

        if (!needsFullRender) {
            // Всё хорошо, ничего не делаем
            return;
        }
    }

    // Полная перерисовка
    container.innerHTML = '';
    products.forEach(product => {
        container.appendChild(createProductCard(product));
    });
}

// Проверка, есть ли товар в избранном
async function checkFavoriteStatus(productId, button) {
    const token = localStorage.getItem('token');
    if (!token || !button) return;

    try {
        const response = await fetch(`${API_URL}/favorites`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const favorites = await response.json();
            const isFavorite = favorites.some(item => item.id === productId);
            if (isFavorite) {
                button.classList.add('active');
                button.textContent = 'В избранном';
            }
        }
    } catch (error) {
        console.error('Error checking favorite status:', error);
    }
}

// ========== РАБОТА С ИЗБРАННЫМ ==========
window.toggleFavorite = async function (productId, button) {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    const isActive = button.classList.contains('active');

    try {
        if (isActive) {
            // Удаляем из избранного
            const response = await fetch(`${API_URL}/favorites/${productId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                button.classList.remove('active');
                button.textContent = 'В избранное';
            }
        } else {
            // Добавляем в избранное
            const response = await fetch(`${API_URL}/favorites`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ productId })
            });

            if (response.ok) {
                button.classList.add('active');
                button.textContent = 'В избранном';
            }
        }

        updateCounters();

        // Если мы на странице избранного, обновляем её
        if (window.location.pathname.includes('favorites')) {
            loadFavorites();
        }
    } catch (error) {
        console.error('Error toggling favorite:', error);
        alert('Ошибка при работе с избранным');
    }
};

// Загрузка избранного на страницу favorites.html
async function loadFavorites() {
    const token = localStorage.getItem('token');
    const container = document.querySelector('.favorites-grid');

    if (!container) return;

    if (!token) {
        container.innerHTML = `
            <div class="empty-state">
                <p>Войдите, чтобы увидеть избранное</p>
                <a href="/login.html" class="btn">Войти</a>
            </div>
        `;
        return;
    }

    try {
        const response = await fetch(`${API_URL}/favorites`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Ошибка загрузки');

        const favorites = await response.json();

        if (!favorites || favorites.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>В избранном пока пусто</p>
                    <a href="/catalog.html" class="btn">Перейти в каталог</a>
                </div>
            `;
            return;
        }

        container.innerHTML = '';
        favorites.forEach(item => {
            const card = createFavoriteCard(item);
            container.appendChild(card);
        });
    } catch (error) {
        console.error('Error loading favorites:', error);
        container.innerHTML = '<p class="error-message">Ошибка загрузки избранного</p>';
    }
}

// Создание карточки для страницы избранного
function createFavoriteCard(item) {
    const card = document.createElement('div');
    card.className = 'favorite-card';
    card.dataset.id = item.id;
    card.style.cursor = 'pointer';

    card.innerHTML = `
        <button class="remove-btn" onclick="removeFromFavorites(${item.id}, this)" aria-label="Удалить из избранного">×</button>
        <img src="${item.image_url || 'https://via.placeholder.com/300x400'}" 
             alt="${item.name}"
             onerror="this.src='https://via.placeholder.com/300x400'">
        <div class="favorite-info">
            <h3 class="favorite-title">${item.name}</h3>
            <p class="favorite-price">${item.priceFormatted || new Intl.NumberFormat('ru-RU').format(item.price) + ' ₽'}</p>
            <button class="add-to-cart-btn" onclick="addToCart(${item.id})">В корзину</button>
        </div>
    `;

    // Обработчик клика на всю карточку
    card.addEventListener('click', (e) => {
        // Не переходим на страницу товара, если кликнули на кнопку
        if (!e.target.closest('button')) {
            window.location.href = `/product.html?id=${item.id}`;
        }
    });

    return card;
}

window.removeFromFavorites = async function (productId, button) {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
        const response = await fetch(`${API_URL}/favorites/${productId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            // Находим и удаляем карточку
            const card = button.closest('.favorite-card');
            if (card) card.remove();

            updateCounters();

            // Если корзина стала пустой, показываем заглушку
            const container = document.querySelector('.favorites-grid');
            if (container && container.children.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <p>В избранном пока пусто</p>
                        <a href="/catalog.html" class="btn">Перейти в каталог</a>
                    </div>
                `;
            }
        }
    } catch (error) {
        console.error('Error removing from favorites:', error);
    }
};

// Функция для прямого добавления в корзину (используется в product.js)
window.addToCartDirect = async function (productId, quantity = 1, size = null) {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    try {
        const response = await fetch(`${API_URL}/cart`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ productId, quantity, size })
        });

        if (response.ok) {
            showNotification('Товар добавлен в корзину');
            updateCounters();
        } else {
            const data = await response.json();
            showNotification(data.message || 'Ошибка при добавлении', 'error');
        }
    } catch (error) {
        console.error('Error adding to cart:', error);
        showNotification('Ошибка соединения', 'error');
    }
};

// Загрузка корзины на страницу cart.html
async function loadCart() {
    const token = localStorage.getItem('token');
    const container = document.querySelector('.cart-container');

    if (!container) return;

    if (!token) {
        container.innerHTML = `
            <h1 class="page-title">Корзина</h1>
            <div class="empty-state">
                <p>Войдите, чтобы увидеть корзину</p>
                <a href="/login.html" class="btn">Войти</a>
            </div>
        `;
        return;
    }

    try {
        const response = await fetch(`${API_URL}/cart`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Ошибка загрузки');

        const data = await response.json();

        if (!data.items || data.items.length === 0) {
            container.innerHTML = `
                <h1 class="page-title">Корзина</h1>
                <div class="empty-state">
                    <p>Корзина пуста</p>
                    <a href="/catalog.html" class="btn">Перейти в каталог</a>
                </div>
            `;
            return;
        }

        renderCart(container, data);
    } catch (error) {
        console.error('Error loading cart:', error);
        container.innerHTML = '<p class="error-message">Ошибка загрузки корзины</p>';
    }
}

// Отрисовка корзины
function renderCart(container, data) {
    container.innerHTML = `
        <h1 class="page-title">Корзина</h1>
        <div class="cart-content">
            <div class="cart-items" id="cart-items-list"></div>
            <div class="cart-summary">
                <h2 class="summary-title">Ваш заказ</h2>
                <div class="summary-row">
                    <span>Товары (${data.totalItems})</span>
                    <span>${data.totalAmountFormatted}</span>
                </div>
                <div class="summary-row">
                    <span>Доставка</span>
                    <span>Бесплатно</span>
                </div>
                <div class="summary-total">
                    <span>Итого</span>
                    <span>${data.totalAmountFormatted}</span>
                </div>
                <button class="checkout-btn" onclick="proceedToCheckout()">
                    Оформить заказ
                </button>
                <p class="payment-info">Принимаем карты любого банка</p>
            </div>
        </div>
    `;

    const itemsContainer = document.getElementById('cart-items-list');
    data.items.forEach(item => {
        itemsContainer.appendChild(createCartItemCard(item));
    });
}

window.proceedToCheckout = function () {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login.html?redirect=cart';
        return;
    }
    window.location.href = '/checkout.html';
};

// Создание карточки товара в корзине
function createCartItemCard(item) {
    const card = document.createElement('div');
    card.className = 'cart-item';
    card.dataset.id = item.id;
    card.dataset.size = item.size || '';
    card.style.cursor = 'pointer';

    card.innerHTML = `
        <button class="remove-item" onclick="removeFromCart(${item.id}, '${item.size || ''}')" aria-label="Удалить товар">×</button>
        <img src="${item.image_url || 'https://via.placeholder.com/100x150'}" 
             alt="${item.name}"
             onerror="this.src='https://via.placeholder.com/100x150'">
        <div class="item-info">
            <h3 class="item-title">${item.name}</h3>
            <p class="item-price">${item.priceFormatted}</p>
            ${item.size ? `<p class="item-size">Размер: ${item.size}</p>` : ''}
        </div>
        <div class="item-quantity">
            <button class="quantity-btn minus" onclick="updateCartQuantity(${item.id}, ${item.quantity - 1}, '${item.size || ''}')">−</button>
            <span class="quantity-value">${item.quantity}</span>
            <button class="quantity-btn plus" onclick="updateCartQuantity(${item.id}, ${item.quantity + 1}, '${item.size || ''}')">+</button>
        </div>
        <div class="item-total">${item.itemTotalFormatted}</div>
    `;

    // Обработчик клика на всю карточку
    card.addEventListener('click', (e) => {
        // Не переходим на страницу товара, если кликнули на кнопку или на блок с количеством
        if (!e.target.closest('button') && !e.target.closest('.item-quantity')) {
            window.location.href = `/product.html?id=${item.id}`;
        }
    });

    return card;
}

window.removeFromCart = async function (productId, size = '') {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
        const url = size ?
            `${API_URL}/cart/${productId}?size=${encodeURIComponent(size)}` :
            `${API_URL}/cart/${productId}`;

        const response = await fetch(url, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            showNotification('Товар удален из корзины', 'info');
            loadCart(); // Перезагружаем корзину
            updateCounters();
        }
    } catch (error) {
        console.error('Error removing from cart:', error);
    }
};

window.updateCartQuantity = async function (productId, newQuantity, size = '') {
    if (newQuantity < 1) {
        removeFromCart(productId, size);
        return;
    }

    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_URL}/cart/${productId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ quantity: newQuantity, size: size || null })
        });

        if (response.ok) {
            loadCart(); // Перезагружаем корзину
            updateCounters();
        }
    } catch (error) {
        console.error('Error updating cart:', error);
    }
};

// ========== СЧЕТЧИКИ ==========
async function updateCounters() {
    const token = localStorage.getItem('token');

    if (!token) {
        document.querySelectorAll('.fav-count, .cart-count').forEach(el => {
            if (el) el.textContent = '0';
        });
        return;
    }

    try {
        const [favorites, cart] = await Promise.all([
            fetch(`${API_URL}/favorites`, {
                headers: { 'Authorization': `Bearer ${token}` }
            }).then(res => res.json()),
            fetch(`${API_URL}/cart`, {
                headers: { 'Authorization': `Bearer ${token}` }
            }).then(res => res.json())
        ]);

        document.querySelectorAll('.fav-count').forEach(el => {
            el.textContent = favorites.length || '0';
        });

        document.querySelectorAll('.cart-count').forEach(el => {
            const totalItems = cart.items ? cart.items.reduce((sum, item) => sum + item.quantity, 0) : 0;
            el.textContent = totalItems || '0';
        });
    } catch (error) {
        console.error('Error updating counters:', error);
    }
}

// ========== УВЕДОМЛЕНИЯ ==========
function showNotification(message, type = 'success') {
    // Создаем элемент уведомления, если его нет
    let notification = document.querySelector('.notification');
    if (!notification) {
        notification = document.createElement('div');
        notification.className = 'notification';
        document.body.appendChild(notification);
    }

    // Очищаем предыдущую анимацию
    notification.style.animation = '';

    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.style.display = 'flex';
    notification.style.alignItems = 'center';

    setTimeout(() => {
        notification.style.animation = 'slideOutLeft 0.3s ease';
        setTimeout(() => {
            notification.style.display = 'none';
            notification.style.animation = ''; // Сбрасываем анимацию
        }, 300);
    }, 3000);
}

// ========== ОБРАБОТКА ФОРМ АВТОРИЗАЦИИ ==========
// Обработка формы входа
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        showAuthMessage('error-message', 'Вход в систему...', false);

        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));

                showAuthMessage('success-message', 'Вход выполнен успешно!', true);
                document.getElementById('error-message').style.display = 'none';

                setTimeout(() => {
                    window.location.href = '/index.html';
                }, 1000);
            } else {
                showAuthMessage('error-message', data.message || 'Ошибка при входе');
            }
        } catch (error) {
            showAuthMessage('error-message', 'Ошибка соединения с сервером');
            console.error('Login error:', error);
        }
    });
}

// Обработка формы регистрации
const registerForm = document.getElementById('register-form');
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('name').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirm-password').value;

        if (password !== confirmPassword) {
            showAuthMessage('error-message', 'Пароли не совпадают');
            return;
        }

        if (password.length < 6) {
            showAuthMessage('error-message', 'Пароль должен быть не менее 6 символов');
            return;
        }

        try {
            const response = await fetch(`${API_URL}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, email, password })
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));

                showAuthMessage('success-message', 'Регистрация прошла успешно!', true);

                setTimeout(() => {
                    window.location.href = '/index.html';
                }, 1500);
            } else {
                showAuthMessage('error-message', data.message || 'Ошибка при регистрации');
            }
        } catch (error) {
            showAuthMessage('error-message', 'Ошибка соединения с сервером');
            console.error('Register error:', error);
        }
    });
}

function showAuthMessage(elementId, message, isSuccess = false) {
    const element = document.getElementById(elementId);
    if (!element) return;

    element.textContent = message;
    element.style.display = 'block';

    if (isSuccess) element.className = 'success-message';
    else {
        if (message === 'Вход в систему...') element.className = 'info-message';
        else element.className = 'error-message';
    }

    setTimeout(() => {
        if (element) element.style.display = 'none';
    }, 5000);
}

// Обработчик клика на карточку товара
document.addEventListener('click', (e) => {
    // Не обрабатываем клики по выпадающему меню и его элементам
    if (e.target.closest('.user-menu') || e.target.closest('.user-dropdown')) {
        return;
    }

    // Не обрабатываем клики по модальным окнам
    if (e.target.closest('.modal')) {
        return;
    }

    // Не обрабатываем клики по уведомлениям
    if (e.target.closest('.notification')) {
        return;
    }
    const productCard = e.target.closest('.product-card');
    if (productCard && !e.target.closest('button')) {
        const productId = productCard.dataset.id;
        if (productId) {
            window.location.href = `/product.html?id=${productId}`;
        }
    }
});

// ========== МОДАЛЬНОЕ ОКНО ВЫБОРА РАЗМЕРА ==========
let currentProductId = null;

// Открыть модальное окно выбора размера
window.openSizeSelectorModal = function (productId) {
    currentProductId = productId;
    const modal = document.getElementById('size-selector-modal');
    if (modal) {
        // Сбрасываем выбранный размер
        const checkedRadio = modal.querySelector('input[name="modal-size"]:checked');
        if (checkedRadio) {
            checkedRadio.checked = false;
        }

        // Показываем модальное окно с анимацией
        modal.style.display = 'flex';

        // Добавляем класс для анимации контента
        const modalContent = modal.querySelector('.modal-content');
        modalContent.style.animation = 'none';
        modalContent.offsetHeight; // Trigger reflow
        modalContent.style.animation = 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
    }
};

// Закрыть модальное окно с анимацией
window.closeSizeSelectorModal = function () {
    const modal = document.getElementById('size-selector-modal');
    if (modal) {
        const modalContent = modal.querySelector('.modal-content');

        // Анимация закрытия
        modalContent.style.animation = 'slideDownAndFade 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards';

        setTimeout(() => {
            modal.style.display = 'none';
            // Сбрасываем анимацию для следующего открытия
            modalContent.style.animation = '';
            currentProductId = null;
        }, 300);
    }
};

// Подтвердить добавление в корзину с выбранным размером
window.confirmAddToCart = async function () {
    if (!currentProductId) {
        closeSizeSelectorModal();
        return;
    }

    // Получаем выбранный размер
    const selectedSize = document.querySelector('input[name="modal-size"]:checked');

    if (!selectedSize) {
        showNotification('Пожалуйста, выберите размер', 'error');
        return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    try {
        const response = await fetch(`${API_URL}/cart`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                productId: currentProductId,
                quantity: 1,
                size: selectedSize.value
            })
        });

        if (response.ok) {
            showNotification('Товар добавлен в корзину', 'success');
            updateCounters();
            closeSizeSelectorModal();
        } else {
            const data = await response.json();
            showNotification(data.message || 'Ошибка при добавлении', 'error');
        }
    } catch (error) {
        console.error('Error adding to cart:', error);
        showNotification('Ошибка соединения', 'error');
    }
};

// addToCart для вызова модального окна
window.addToCart = async function (productId) {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    // Открываем модальное окно выбора размера
    openSizeSelectorModal(productId);
};

// Закрытие модального окна по клику вне его
window.onclick = function (event) {
    const modal = document.getElementById('size-selector-modal');
    if (event.target === modal) {
        closeSizeSelectorModal();
    }
};

// Обработчик для клавиши Escape
document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
        const modal = document.getElementById('size-selector-modal');
        if (modal && modal.style.display === 'flex') {
            closeSizeSelectorModal();
        }
    }
});

// ========== ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ ==========
document.addEventListener('DOMContentLoaded', () => {
    updateNavigation();
    updateCounters();
    loadPageProducts();
    initCustomSelects();
    initInstantFilters();

    // Обработчики для страниц с фильтрами (коллекции, новинки, база)
    if (window.location.pathname.includes('catalog.html') || window.location.pathname === '/catalog' ||
        window.location.pathname.includes('novinki.html') || window.location.pathname === '/novinki' ||
        window.location.pathname.includes('base.html') || window.location.pathname === '/base') {

        const searchBtn = document.getElementById('search-btn');
        const applyBtn = document.getElementById('apply-filters');
        const resetBtn = document.getElementById('reset-filters');
        const searchInput = document.getElementById('search-input');
        const priceMin = document.getElementById('price-min');
        const priceMax = document.getElementById('price-max');

        // Определяем категорию для загрузки
        let category = 'коллекции';
        if (window.location.pathname.includes('novinki.html') || window.location.pathname === '/novinki') {
            category = 'новинки';
        } else if (window.location.pathname.includes('base.html') || window.location.pathname === '/base') {
            category = 'база';
        }

        // Запрещаем ввод отрицательных чисел
        if (priceMin) {
            priceMin.addEventListener('keydown', preventNegativeNumbers);
            priceMin.addEventListener('input', preventNegativeNumbersInput);
        }

        if (priceMax) {
            priceMax.addEventListener('keydown', preventNegativeNumbers);
            priceMax.addEventListener('input', preventNegativeNumbersInput);
        }

        if (searchBtn) {
            searchBtn.addEventListener('click', (e) => {
                e.preventDefault();
                loadProductsWithFilters(category);
            });
        }

        if (applyBtn) {
            applyBtn.addEventListener('click', (e) => {
                e.preventDefault();
                loadProductsWithFilters(category);
            });
        }

        if (resetBtn) {
            resetBtn.addEventListener('click', (e) => {
                e.preventDefault();
                document.getElementById('search-input').value = '';
                document.getElementById('price-min').value = '';
                document.getElementById('price-max').value = '';
                document.getElementById('material').value = '';
                document.getElementById('sort-by').value = 'created_at';
                document.getElementById('sort-order').value = 'DESC';
                updateCustomSelectsFromHidden();
                loadProductsWithFilters(category);
            });
        }

        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    loadProductsWithFilters(category);
                }
            });
        }
    }
});

// Функции для запрета отрицательных чисел
function preventNegativeNumbers(e) {
    // Запрещаем ввод минуса
    if (e.key === '-' || e.key === 'e' || e.key === 'E') {
        e.preventDefault();
    }
}

function preventNegativeNumbersInput(e) {
    // Удаляем минус, если он каким-то образом появился
    if (e.target.value < 0) {
        e.target.value = '';
    }
    // Удаляем все нечисловые символы кроме цифр
    e.target.value = e.target.value.replace(/[^\d]/g, '');
}

// ========== КАСТОМНЫЕ ВЫПАДАЮЩИЕ СПИСКИ ==========

function initCustomSelects() {
    const customSelects = document.querySelectorAll('.custom-select');

    customSelects.forEach(select => {
        const selected = select.querySelector('.select-selected');
        const itemsContainer = select.querySelector('.select-items');
        const items = itemsContainer.querySelectorAll('div');
        const hiddenInput = document.getElementById(select.dataset.select);

        // Устанавливаем начальный текст из скрытого поля
        if (hiddenInput && hiddenInput.value) {
            const matchedItem = Array.from(items).find(item => item.dataset.value === hiddenInput.value);
            if (matchedItem) {
                selected.textContent = matchedItem.textContent;
                matchedItem.classList.add('selected');
            }
        }

        // Открытие/закрытие списка
        selected.addEventListener('click', (e) => {
            e.stopPropagation();

            // Закрываем все другие списки
            document.querySelectorAll('.select-selected.active').forEach(el => {
                if (el !== selected) {
                    el.classList.remove('active');
                    el.closest('.custom-select').querySelector('.select-items').classList.remove('active');
                }
            });

            // Открываем/закрываем текущий
            selected.classList.toggle('active');
            itemsContainer.classList.toggle('active');
        });

        // Выбор элемента
        items.forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();

                const value = item.dataset.value;
                const text = item.textContent;

                // Обновляем скрытый select
                if (hiddenInput) {
                    hiddenInput.value = value;

                    // ВЫЗЫВАЕМ СОБЫТИЕ CHANGE для мгновенной фильтрации
                    const event = new Event('change', { bubbles: true });
                    hiddenInput.dispatchEvent(event);
                }

                // Обновляем отображаемый текст
                selected.textContent = text;

                // Убираем выделение со всех элементов
                items.forEach(i => i.classList.remove('selected'));
                item.classList.add('selected');

                // Закрываем список
                selected.classList.remove('active');
                itemsContainer.classList.remove('active');

                // Для сортировки и порядка можно сразу применять фильтрацию
                if (select.dataset.select === 'sort-by' || select.dataset.select === 'sort-order') {
                    // Определяем категорию из URL
                    let category = 'коллекции';
                    if (window.location.pathname.includes('novinki.html') || window.location.pathname === '/novinki') {
                        category = 'новинки';
                    } else if (window.location.pathname.includes('base.html') || window.location.pathname === '/base') {
                        category = 'база';
                    }
                    loadProductsWithFilters(category);
                }
            });
        });
    });

    // Закрытие при клике вне списка
    document.addEventListener('click', () => {
        document.querySelectorAll('.select-selected.active').forEach(el => {
            el.classList.remove('active');
            el.closest('.custom-select').querySelector('.select-items').classList.remove('active');
        });
    });
}

// Функция для обновления отображения селектов из скрытых полей
function updateCustomSelectsFromHidden() {
    const customSelects = document.querySelectorAll('.custom-select');

    customSelects.forEach(select => {
        const selected = select.querySelector('.select-selected');
        const itemsContainer = select.querySelector('.select-items');
        const items = itemsContainer.querySelectorAll('div');
        const hiddenInput = document.getElementById(select.dataset.select);

        if (hiddenInput && hiddenInput.value) {
            const matchedItem = Array.from(items).find(item => item.dataset.value === hiddenInput.value);
            if (matchedItem) {
                selected.textContent = matchedItem.textContent;
                items.forEach(i => i.classList.remove('selected'));
                matchedItem.classList.add('selected');
            }
        }
    });
}

function initInstantFilters() {
    // Только для страниц с фильтрами
    if (!window.location.pathname.includes('catalog.html') &&
        !window.location.pathname.includes('novinki.html') &&
        !window.location.pathname.includes('base.html')) {
        return;
    }

    // Определяем категорию
    let category = 'коллекции';
    if (window.location.pathname.includes('novinki.html') || window.location.pathname === '/novinki') {
        category = 'новинки';
    } else if (window.location.pathname.includes('base.html') || window.location.pathname === '/base') {
        category = 'база';
    }

    // Функция-дебаунсер для предотвращения слишком частых вызовов
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Фильтрация с задержкой
    const debouncedFilter = debounce(() => {
        loadProductsWithFilters(category);
    }, 500); // Ждём 500мс после последнего изменения

    // Следим за изменениями в полях ввода
    const searchInput = document.getElementById('search-input');
    const priceMin = document.getElementById('price-min');
    const priceMax = document.getElementById('price-max');

    if (searchInput) {
        searchInput.addEventListener('input', debouncedFilter);
    }

    if (priceMin) {
        priceMin.addEventListener('input', debouncedFilter);
    }

    if (priceMax) {
        priceMax.addEventListener('input', debouncedFilter);
    }

    // Для кастомных селектов используем MutationObserver
    // чтобы следить за изменением скрытых полей
    const materialInput = document.getElementById('material');
    const sortByInput = document.getElementById('sort-by');
    const sortOrderInput = document.getElementById('sort-order');

    if (materialInput) {
        materialInput.addEventListener('change', debouncedFilter);
    }

    if (sortByInput) {
        sortByInput.addEventListener('change', debouncedFilter);
    }

    if (sortOrderInput) {
        sortOrderInput.addEventListener('change', debouncedFilter);
    }

    // Кнопки теперь можно скрыть или оставить как "дополнительный" способ
    const applyBtn = document.getElementById('apply-filters');
    if (applyBtn) {
        applyBtn.style.display = 'none'; // Скрываем кнопку "Применить"
    }
}