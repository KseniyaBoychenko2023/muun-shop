document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || 'null');

    if (!token || !user) {
        window.location.href = 'login.html';
        return;
    }

    // Заполняем данные пользователя
    const userNameEl = document.getElementById('user-name');
    const userEmailEl = document.getElementById('user-email');
    const userEmailDisplayEl = document.getElementById('user-email-display');
    
    if (userNameEl) userNameEl.textContent = user.name;
    if (userEmailEl) userEmailEl.textContent = user.email;
    if (userEmailDisplayEl) userEmailDisplayEl.textContent = user.email;
    
    // Загружаем полные данные с сервера
    await loadUserProfile(token);
    
    // Загружаем заказы
    await loadUserOrders(token);

    initProfileEditing(token);

    const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
    if (confirmCancelBtn) {
        confirmCancelBtn.addEventListener('click', async () => {
            if (!currentOrderId) return;
            
            const token = localStorage.getItem('token');
            try {
                const response = await fetch(`${API_URL}/orders/${currentOrderId}/cancel`, {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (response.ok) {
                    showNotification('Заказ отменён', 'info');
                    closeCancelModal();
                    // Перезагружаем заказы
                    loadUserOrders(token);
                } else {
                    const data = await response.json();
                    showNotification(data.message || 'Ошибка при отмене', 'error');
                    closeCancelModal();
                }
            } catch (error) {
                console.error('Error cancelling order:', error);
                showNotification('Ошибка соединения', 'error');
                closeCancelModal();
            }
        });
    }
});

let currentOrderId = null;

async function loadUserProfile(token) {
    try {
        const response = await fetch(`${API_URL}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.user) {
                // Обновляем данные, если они изменились
                document.getElementById('user-name').textContent = data.user.name;
                document.getElementById('user-email').textContent = data.user.email;
                document.getElementById('user-email-display').textContent = data.user.email;
                
                // Форматируем дату регистрации
                if (data.user.created_at) {
                    const date = new Date(data.user.created_at);
                    document.getElementById('user-created').textContent = 
                        date.toLocaleDateString('ru-RU', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                        });
                }

                // Обновляем данные в localStorage
                const user = JSON.parse(localStorage.getItem('user') || '{}');
                user.name = data.user.name;
                localStorage.setItem('user', JSON.stringify(user));
            }
        } else if (response.status === 401) {
            // Токен истек или недействителен
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = 'login.html';
        }
    } catch (error) {
        console.error('Error loading user data:', error);
        document.getElementById('user-created').textContent = 'Не удалось загрузить';
    }
}

async function loadUserOrders(token) {
    try {
        const response = await fetch(`${API_URL}/orders`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const orders = await response.json();
            renderOrders(orders);
        }
    } catch (error) {
        console.error('Error loading orders:', error);
    }
}

// Функция для открытия модального окна отмены
window.openCancelModal = function(orderId) {
    currentOrderId = orderId;
    const modal = document.getElementById('cancel-order-modal');
    if (modal) {
        modal.style.display = 'flex';
    }
};

// Закрыть модальное окно отмены
window.closeCancelModal = function() {
    const modal = document.getElementById('cancel-order-modal');
    if (modal) {
        modal.style.display = 'none';
        currentOrderId = null;
    }
};

// Функция для открытия модального окна с деталями заказа
window.openOrderDetails = async function(orderId) {
    const token = localStorage.getItem('token');
    const modal = document.getElementById('order-details-modal');
    const detailsBody = document.getElementById('order-details-body');
    
    if (!modal || !detailsBody) return;
    
    // Показываем загрузку
    detailsBody.innerHTML = '<div class="loading">Загрузка...</div>';
    modal.style.display = 'flex';
    
    try {
        const response = await fetch(`${API_URL}/orders/${orderId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const order = await response.json();
            renderOrderDetails(order, detailsBody);
        } else {
            detailsBody.innerHTML = '<p class="error-message">Ошибка загрузки деталей заказа</p>';
        }
    } catch (error) {
        console.error('Error loading order details:', error);
        detailsBody.innerHTML = '<p class="error-message">Ошибка соединения</p>';
    }
};

// Отрисовка деталей заказа
function renderOrderDetails(order, container) {
    // Форматируем дату
    const date = new Date(order.created_at);
    const formattedDate = date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    // Карта статусов
    const statusMap = {
        'processing': 'Обрабатывается',
        'shipped': 'Отправлен',
        'delivered': 'Доставлен',
        'cancelled': 'Отменён'
    };
    
    const statusColorMap = {
        'processing': '#f39c12',
        'shipped': '#3498db',
        'delivered': '#27ae60',
        'cancelled': '#e74c3c'
    };
    
    // Карта способов оплаты
    const paymentMap = {
        'card': 'Банковской картой',
        'cash': 'Наличными при получении'
    };
    
    // Формируем HTML для товаров
    let itemsHtml = '';
    order.items.forEach(item => {
        itemsHtml += `
            <div class="order-details-item">
                <div class="order-details-item-info">
                    <div class="order-details-item-name">${item.product_name}</div>
                    <div class="order-details-item-details">
                        ${item.size ? `Размер: ${item.size} · ` : ''}
                        ${item.quantity} × ${item.priceFormatted}
                    </div>
                </div>
                <div class="order-details-item-price">${item.totalFormatted}</div>
            </div>
        `;
    });
    
    // Формируем HTML для доставки
    const deliveryHtml = `
        <div class="delivery-info">
            <h4>Доставка</h4>
            <p><strong>Получатель:</strong> ${order.delivery_recipient}</p>
            <p><strong>Телефон:</strong> ${order.delivery_phone}</p>
            <p><strong>Адрес:</strong> ${order.delivery_city}, ${order.delivery_address}</p>
            ${order.delivery_postal_code ? `<p><strong>Индекс:</strong> ${order.delivery_postal_code}</p>` : ''}
        </div>
    `;
    
    container.innerHTML = `
        <div class="order-details-header">
            <div class="order-details-number">${order.order_number}</div>
            <div class="order-details-date">${formattedDate}</div>
            <div class="order-details-status" style="background: ${statusColorMap[order.status]}20; color: ${statusColorMap[order.status]}">
                ${statusMap[order.status] || order.status}
            </div>
        </div>
        
        ${deliveryHtml}
        
        <div class="order-details-items">
            <h4>Товары</h4>
            ${itemsHtml}
        </div>
        
        <div class="order-details-total">
            <span>Итого к оплате</span>
            <span>${order.totalAmountFormatted}</span>
        </div>
        
        <div class="payment-method-badge">
            Оплата: ${paymentMap[order.payment_method] || order.payment_method}
        </div>
    `;
}

// Закрыть модальное окно деталей
window.closeDetailsModal = function() {
    const modal = document.getElementById('order-details-modal');
    if (modal) {
        modal.style.display = 'none';
    }
};

// Функция для отображения заказов
function renderOrders(orders) {
    const container = document.getElementById('orders-container');
    
    if (!orders || orders.length === 0) {
        container.innerHTML = `
            <div class="empty-orders">
                <p>У вас пока нет заказов</p>
                <a href="catalog.html" class="btn">Перейти в каталог</a>
            </div>
        `;
        return;
    }
    
    container.innerHTML = '';
    
    orders.forEach(order => {
        const orderCard = document.createElement('div');
        orderCard.className = 'order-card';
        
        const date = new Date(order.created_at);
        const formattedDate = date.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
        
        let itemsHtml = '';
        order.items.forEach(item => {
            itemsHtml += `
                <div class="order-item-row">
                    <span class="order-item-name">
                        ${item.product_name}
                        ${item.size ? `<small>Размер: ${item.size}</small>` : ''}
                        <small>×${item.quantity}</small>
                    </span>
                    <span class="order-item-price">${item.totalFormatted}</span>
                </div>
            `;
        });
        
        orderCard.innerHTML = `
            <div class="order-header">
                <span class="order-number">${order.order_number}</span>
                <span class="order-date">${formattedDate}</span>
                <span class="order-status ${order.status}" style="background: ${order.statusColor}20; color: ${order.statusColor}">
                    ${order.statusText}
                </span>
            </div>
            <div class="order-items-list">
                ${itemsHtml}
            </div>
            <div class="order-footer">
                <span class="order-total">Итого: ${order.totalAmountFormatted}</span>
                <div class="order-actions">
                    ${order.status === 'processing' ? 
                        `<button class="btn-small btn-outline" onclick="openCancelModal(${order.id})">Отменить</button>` : 
                        ''}
                    <button class="btn-small" onclick="openOrderDetails(${order.id})">Подробнее</button>
                </div>
            </div>
        `;
        
        container.appendChild(orderCard);
    });
}

// Инициализация редактирования профиля
function initProfileEditing(token) {
    const editBtn = document.querySelector('.edit-btn');
    if (!editBtn) return;

    // Убираем старый обработчик
    editBtn.removeAttribute('onclick');
    
    // Добавляем новый обработчик
    editBtn.addEventListener('click', () => {
        showEditNameModal(token);
    });
}

// Показ модального окна для редактирования имени
function showEditNameModal(token) {
    const currentName = document.getElementById('user-name').textContent;
    
    // Создаем модальное окно
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Редактировать имя</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label for="edit-name">Новое имя</label>
                    <input type="text" id="edit-name" value="${currentName}" placeholder="Введите ваше имя" maxlength="50">
                </div>
                <div id="edit-error" class="error-message" style="display: none;"></div>
                <div id="edit-success" class="success-message" style="display: none;"></div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" onclick="this.closest('.modal').remove()">Отмена</button>
                <button class="btn" id="save-name-btn">Сохранить</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Добавляем стили для модального окна
    if (!document.querySelector('#modal-styles')) {
        const styles = document.createElement('style');
        styles.id = 'modal-styles';
        styles.textContent = `
            .modal {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 2000;
                animation: fadeIn 0.2s ease;
            }
            
            .modal-content {
                background: white;
                width: 90%;
                max-width: 450px;
                border-radius: 2px;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
                animation: slideUp 0.3s ease;
            }
            
            .modal-header {
                padding: 20px 25px;
                border-bottom: 1px solid #f0f0f0;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .modal-header h3 {
                font-size: 1.3rem;
                font-weight: 400;
                color: #1a1a1a;
            }
            
            .modal-close {
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: #999;
                transition: color 0.2s;
            }
            
            .modal-close:hover {
                color: #000;
            }
            
            .modal-body {
                padding: 25px;
            }
            
            .modal-footer {
                padding: 20px 25px;
                border-top: 1px solid #f0f0f0;
                display: flex;
                justify-content: flex-end;
                gap: 12px;
            }
            
            .modal-footer .btn {
                width: auto;
                margin: 0;
                padding: 12px 30px;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            @keyframes slideUp {
                from {
                    opacity: 0;
                    transform: translateY(20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
        `;
        document.head.appendChild(styles);
    }
    
    // Закрытие модального окна
    modal.querySelector('.modal-close').addEventListener('click', () => {
        modal.remove();
    });
    
    // Закрытие по клику вне модального окна
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    // Обработка сохранения
    const saveBtn = modal.querySelector('#save-name-btn');
    const nameInput = modal.querySelector('#edit-name');
    const errorDiv = modal.querySelector('#edit-error');
    const successDiv = modal.querySelector('#edit-success');
    
    saveBtn.addEventListener('click', async () => {
        const newName = nameInput.value.trim();
        
        // Валидация
        if (!newName) {
            showModalMessage(errorDiv, 'Имя не может быть пустым');
            return;
        }
        
        if (newName.length > 50) {
            showModalMessage(errorDiv, 'Имя не может быть длиннее 50 символов');
            return;
        }
        
        if (newName === currentName) {
            showModalMessage(errorDiv, 'Новое имя совпадает с текущим');
            return;
        }
        
        // Скрываем предыдущие сообщения
        errorDiv.style.display = 'none';
        successDiv.style.display = 'none';
        
        try {
            const response = await fetch(`${API_URL}/auth/profile`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name: newName })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // Обновляем имя на странице
                document.getElementById('user-name').textContent = newName;
                
                // Обновляем имя в localStorage
                const user = JSON.parse(localStorage.getItem('user') || '{}');
                user.name = newName;
                localStorage.setItem('user', JSON.stringify(user));
                
                // Обновляем имя в навигации
                const userNameEl = document.querySelector('.user-name');
                if (userNameEl) {
                    userNameEl.textContent = newName;
                }
                
                // Показываем успешное сообщение
                showModalMessage(successDiv, 'Имя успешно обновлено!', 'success');
                
                // Закрываем модальное окно через 1.5 секунды
                setTimeout(() => {
                    modal.remove();
                }, 1500);
            } else {
                showModalMessage(errorDiv, data.message || 'Ошибка при обновлении имени');
            }
        } catch (error) {
            console.error('Error updating name:', error);
            showModalMessage(errorDiv, 'Ошибка соединения с сервером');
        }
    });
    
    // Обработка Enter
    nameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            saveBtn.click();
        }
    });
    
    // Фокус на поле ввода
    nameInput.focus();
}

// Вспомогательная функция для показа сообщений в модальном окне
function showModalMessage(element, message, type = 'error') {
    element.textContent = message;
    element.style.display = 'block';
    
    if (type === 'success') {
        element.className = 'success-message';
    } else {
        element.className = 'error-message';
    }
    
    // Автоматически скрываем через 3 секунды
    setTimeout(() => {
        if (element) {
            element.style.display = 'none';
        }
    }, 3000);
}

// Закрытие модальных окон по клику вне
window.onclick = function(event) {
    const cancelModal = document.getElementById('cancel-order-modal');
    const detailsModal = document.getElementById('order-details-modal');
    
    if (event.target === cancelModal) {
        closeCancelModal();
    }
    if (event.target === detailsModal) {
        closeDetailsModal();
    }
};

// Закрытие по клавише Escape
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        const cancelModal = document.getElementById('cancel-order-modal');
        const detailsModal = document.getElementById('order-details-modal');
        
        if (cancelModal && cancelModal.style.display === 'flex') {
            closeCancelModal();
        }
        if (detailsModal && detailsModal.style.display === 'flex') {
            closeDetailsModal();
        }
    }
});