const API_URL = 'https://muun-backend.onrender.com/api';
let DADATA_API_KEY = '';

async function loadConfig() {
    try {
        const API_URL = window.location.hostname === 'localhost' 
            ? 'http://localhost:3000/api'
            : 'https://muun-backend.onrender.com/api';
            
        const response = await fetch(`${API_URL}/config`);
        if (!response.ok) throw new Error('Failed to load config');
        
        const config = await response.json();
        DADATA_API_KEY = config.dadataApiKey;
        console.log('DaData API key loaded');
    } catch (error) {
        console.error('Error loading config:', error);
    }
}

// Проверка авторизации при загрузке
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    
    if (!token) {
        window.location.href = '/login.html?redirect=checkout';
        return;
    }

    // Загружаем конфигурацию
    await loadConfig();

    // Загружаем корзину
    await loadCartForCheckout();
    
    // Подставляем имя пользователя, если есть
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.name) {
        document.getElementById('recipient').value = user.name;
    }
    
    // Инициализируем все функции
    initPhoneMask();
    initInputValidation();
    initCityDadata();
    initAddressDadata();
    initAdditionalFields();
});

// ========== МАСКА ДЛЯ ТЕЛЕФОНА ==========
function initPhoneMask() {
    const phoneInput = document.getElementById('phone');
    if (!phoneInput) return;
    
    if (!phoneInput.value) {
        phoneInput.value = '+7';
    }
    
    phoneInput.addEventListener('input', function(e) {
        let value = e.target.value;
        let digits = value.replace(/[^\d+]/g, '');
        
        if (digits.startsWith('8')) {
            digits = '+7' + digits.substring(1);
        } else if (!digits.startsWith('+7') && digits.length > 0) {
            digits = '+7' + digits.replace(/^\+?7?/, '');
        }
        
        const maxDigits = 12;
        if (digits.length > maxDigits) {
            digits = digits.substring(0, maxDigits);
        }
        
        e.target.value = formatPhoneNumber(digits);
    });
    
    phoneInput.addEventListener('keydown', function(e) {
        const allowedKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End'];
        if (allowedKeys.includes(e.key)) return;
        
        const allowedChars = /^[\d\+\-\(\)]$/;
        if (!allowedChars.test(e.key) && e.key.length === 1) {
            e.preventDefault();
        }
    });
    
    phoneInput.addEventListener('focus', function(e) {
        if (!e.target.value) {
            e.target.value = '+7';
        }
    });
}

function formatPhoneNumber(digits) {
    if (!digits) return '+7';
    
    let cleaned = digits.replace(/[^\d+]/g, '');
    
    if (!cleaned.startsWith('+')) {
        cleaned = '+' + cleaned;
    }
    
    if (cleaned === '+' || cleaned === '+7') {
        return '+7';
    }
    
    const countryCode = '+7';
    let number = cleaned.substring(2);
    
    if (number.length > 10) {
        number = number.substring(0, 10);
    }
    
    let formatted = countryCode;
    
    if (number.length > 0) {
        formatted += ' (';
        formatted += number.substring(0, 3);
        
        if (number.length > 3) {
            formatted += ') ';
            formatted += number.substring(3, 6);
            
            if (number.length > 6) {
                formatted += '-';
                formatted += number.substring(6, 8);
                
                if (number.length > 8) {
                    formatted += '-';
                    formatted += number.substring(8, 10);
                }
            }
        } else {
            formatted += ')';
        }
    }
    
    return formatted;
}

// ========== ВАЛИДАЦИЯ ПОЛЕЙ ==========
function initInputValidation() {
    const recipientInput = document.getElementById('recipient');
    if (recipientInput) {
        recipientInput.addEventListener('input', function(e) {
            let value = e.target.value;
            value = value.replace(/[^a-zA-Zа-яА-Я\s\-\.]/g, '');
            e.target.value = value;
        });
    }
    
    const postalInput = document.getElementById('postal-code');
    if (postalInput) {
        postalInput.addEventListener('input', function(e) {
            let value = e.target.value;
            value = value.replace(/[^\d]/g, '');
            if (value.length > 6) {
                value = value.substring(0, 6);
            }
            e.target.value = value;
        });
    }
}

// ========== DADATA ДЛЯ ГОРОДОВ ==========
function initCityDadata() {
    const cityInput = document.getElementById('city');
    const dropdown = document.getElementById('city-dropdown');
    
    if (!cityInput || !dropdown) return;
    
    cityInput.addEventListener('input', async function(e) {
        // Сбрасываем сохранённый город при изменении поля
        delete this.dataset.city;
        
        // Город изменяется вручную — сбрасываем валидность
        this.classList.remove('valid');
        
        // Блокируем поле адреса при любом изменении города
        const addressInput = document.getElementById('address');
        if (addressInput) {
            addressInput.value = '';
            addressInput.classList.remove('valid');
            addressInput.disabled = true;
        }

        const query = e.target.value;
        
        if (query.length < 2) {
            dropdown.classList.remove('active');
            dropdown.innerHTML = '';
            return;
        }
        
        try {
            const url = 'https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address';
            const options = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': 'Token ' + DADATA_API_KEY
                },
                body: JSON.stringify({ 
                    query: query, 
                    count: 10,
                    from_bound: { value: "city" },
                    to_bound: { value: "city" }
                })
            };
            
            const response = await fetch(url, options);
            const data = await response.json();
            showCitySuggestions(data.suggestions || [], dropdown, cityInput);
            
        } catch (error) {
            console.error('Error fetching cities:', error);
        }
    });
    
    cityInput.addEventListener('focus', function() {
        if (this.value.length >= 2) {
            dropdown.classList.add('active');
        }
        this.classList.add('highlight');
    });
    
    cityInput.addEventListener('blur', function() {
        setTimeout(() => {
            dropdown.classList.remove('active');
            this.classList.remove('highlight');
            
            // Если поле не валидно и не пустое, показываем подсказку
            if (!this.classList.contains('valid') && this.value.trim()) {
                showFieldError('city', 'Выберите город из списка');
            }
        }, 200);
    });
    
    cityInput.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            dropdown.classList.remove('active');
            this.classList.remove('highlight');
        }
    });
    
    document.addEventListener('click', function(e) {
        if (!cityInput.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('active');
            cityInput.classList.remove('highlight');
        }
    });
}

// ========== DADATA ДЛЯ АДРЕСОВ ==========
function initAddressDadata() {
    const addressInput = document.getElementById('address');
    const dropdown = document.getElementById('address-dropdown');
    const cityInput = document.getElementById('city');

    if (!addressInput || !dropdown) return;
    
    // Адрес доступен только после выбора города
    addressInput.disabled = !(cityInput.classList.contains('valid') && cityInput.dataset.city);
    
    addressInput.addEventListener('input', async function(e) {
        const query = e.target.value;
        const city = cityInput.dataset.city;

        // При ручном вводе сбрасываем валидность
        this.dataset.addressValid = 'false';
        this.dataset.hasHouse = 'false';
        this.classList.remove('valid');

        if (query.length < 3) {
            dropdown.classList.remove('active');
            dropdown.innerHTML = '';
            return;
        }
        
        try {
            const url = 'https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address';
            
            // Расширяем границы поиска до квартиры
            let requestBody = {
                query: query,
                count: 10,
                from_bound: { value: "street" },
                to_bound: { value: "flat" }
            };
            
            // Если город выбран, добавляем ограничение по городу
            if (city) {
                requestBody.locations = [{ city: city }];
            }
            
            console.log('Sending request to DaData:', requestBody);
            
            const options = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': 'Token ' + DADATA_API_KEY
                },
                body: JSON.stringify(requestBody)
            };
            
            const response = await fetch(url, options);
            
            if (!response.ok) {
                console.error('DaData response error:', response.status);
                return;
            }
            
            const data = await response.json();
            console.log('DaData response:', data);
            
            const addresses = data.suggestions || [];
            showAddressSuggestions(addresses, dropdown, addressInput);
            
        } catch (error) {
            console.error('Error fetching addresses:', error);
        }
    });
    
    addressInput.addEventListener('focus', function() {
        if (this.value.length >= 3 && cityInput.dataset.city) {
            dropdown.classList.add('active');
        }
        this.classList.add('highlight');
    });
    
    addressInput.addEventListener('blur', function() {
        setTimeout(() => {
            dropdown.classList.remove('active');
            this.classList.remove('highlight');
        }, 200);
    });
    
    addressInput.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            dropdown.classList.remove('active');
            this.classList.remove('highlight');
        }
    });
    
    document.addEventListener('click', function(e) {
        if (!addressInput.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('active');
            addressInput.classList.remove('highlight');
        }
    });
}

// ========== ОТОБРАЖЕНИЕ ПОДСКАЗОК ДЛЯ ГОРОДОВ ==========
function showCitySuggestions(suggestions, dropdown, input) {
    dropdown.innerHTML = '';
    
    if (!suggestions || suggestions.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'city-dropdown-empty';
        emptyMessage.textContent = 'Город не найден';
        dropdown.appendChild(emptyMessage);
        dropdown.classList.add('active');
        return;
    }
    
    suggestions.forEach(suggestion => {
        const item = document.createElement('div');
        item.className = 'city-dropdown-item';
        item.textContent = suggestion.value;
        
        item.addEventListener('click', () => {
            input.value = suggestion.value;
            // Сохраняем название города для поиска адресов
            input.dataset.city = suggestion.data.city || suggestion.data.settlement || suggestion.value;
            input.classList.add('valid');
            
            // Убираем сообщение об ошибке, если было
            const existingMessage = input.parentElement.querySelector('.field-error-message');
            if (existingMessage) {
                existingMessage.remove();
            }

            const addressInput = document.getElementById('address');
            if (addressInput) {
                addressInput.disabled = false;
                addressInput.value = '';
                addressInput.classList.remove('valid');
                addressInput.focus();
            }
            dropdown.classList.remove('active');
            
            if (suggestion.data && suggestion.data.postal_code) {
                const postalInput = document.getElementById('postal-code');
                if (postalInput) {
                    postalInput.value = suggestion.data.postal_code;
                }
            }
        });
        
        dropdown.appendChild(item);
    });
    
    dropdown.classList.add('active');
}

// ========== ОТОБРАЖЕНИЕ ПОДСКАЗОК ДЛЯ АДРЕСОВ ==========
function showAddressSuggestions(suggestions, dropdown, input) {
    dropdown.innerHTML = '';
    
    if (!suggestions || suggestions.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'address-dropdown-empty';
        emptyMessage.textContent = 'Адрес не найден';
        dropdown.appendChild(emptyMessage);
        dropdown.classList.add('active');
        return;
    }
    
    suggestions.forEach(suggestion => {
        const item = document.createElement('div');
        item.className = 'address-dropdown-item';
        
        // Формируем адрес для отображения и вставки (без квартиры)
        let displayText = '';
        let addressValue = '';
        let hasHouse = false;
        
        if (suggestion.data) {
            const parts = [];
            const addressParts = [];
            
            // Добавляем улицу
            if (suggestion.data.street) {
                parts.push(suggestion.data.street);
                addressParts.push(suggestion.data.street);
            }
            
            // Добавляем номер дома (обязательно) - БЕЗ точки
            if (suggestion.data.house) {
                parts.push('д ' + suggestion.data.house);
                addressParts.push('д ' + suggestion.data.house);
                hasHouse = true;
            }
            
            // Добавляем корпус (если есть) - БЕЗ точки
            if (suggestion.data.block) {
                parts.push('корп ' + suggestion.data.block);
                addressParts.push('корп ' + suggestion.data.block);
            }
            
            // Добавляем строение (если есть) - БЕЗ точки
            if (suggestion.data.structure) {
                parts.push('стр ' + suggestion.data.structure);
                addressParts.push('стр ' + suggestion.data.structure);
            }
            
            // НЕ добавляем квартиру в адрес
            // Если есть квартира, сохраняем её в отдельное поле
            if (suggestion.data.flat) {
                const apartmentInput = document.getElementById('apartment');
                if (apartmentInput && !apartmentInput.value) {
                    // Автоматически заполняем квартиру, если поле пустое
                    apartmentInput.value = suggestion.data.flat;
                }
            }
            
            displayText = parts.join(', ');
            addressValue = addressParts.join(', ');
        }
        
        // Если не удалось извлечь части, используем короткую версию
        if (!displayText) {
            const parts = suggestion.value.split(',');
            displayText = parts[parts.length - 1].trim();
            addressValue = displayText;
            hasHouse = displayText.includes('д ') || displayText.includes('дом');
        }
        
        // Если нет номера дома, делаем элемент некликабельным
        if (!hasHouse) {
            item.style.opacity = '0.5';
            item.style.cursor = 'not-allowed';
            item.title = 'Для этого адреса не указан номер дома';
            item.addEventListener('click', (e) => {
                e.preventDefault();
                showFieldError('address', 'Выберите адрес с номером дома');
            });
        } else {
            item.addEventListener('click', () => {
                input.value = addressValue;
                input.classList.add('valid');
                dropdown.classList.remove('active');
                
                // Сохраняем данные о выбранном адресе
                input.dataset.addressValid = 'true';
                input.dataset.hasHouse = 'true';
                
                if (suggestion.data && suggestion.data.postal_code) {
                    const postalInput = document.getElementById('postal-code');
                    if (postalInput) {
                        postalInput.value = suggestion.data.postal_code;
                    }
                }
                
                // Если есть квартира и поле квартиры пустое, заполняем его
                if (suggestion.data && suggestion.data.flat) {
                    const apartmentInput = document.getElementById('apartment');
                    if (apartmentInput && !apartmentInput.value) {
                        apartmentInput.value = suggestion.data.flat;
                    }
                }
            });
        }
        
        item.textContent = displayText;
        dropdown.appendChild(item);
    });
    
    dropdown.classList.add('active');
}

// ========== ФУНКЦИИ ДЛЯ РАБОТЫ С ОШИБКАМИ ==========
function showFormError(message, fieldId = null) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    
    if (fieldId) {
        const field = document.getElementById(fieldId);
        if (field) {
            field.classList.add('error');
            
            const removeError = () => {
                field.classList.remove('error');
                field.removeEventListener('input', removeError);
            };
            field.addEventListener('input', removeError, { once: true });
        }
    }
    
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}

function showFieldError(fieldId, message) {
    const field = document.getElementById(fieldId);
    if (!field) return;
    
    const existingMessage = field.parentElement.querySelector('.field-error-message');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    field.classList.add('error');
    
    const errorMessage = document.createElement('div');
    errorMessage.className = 'field-error-message';
    errorMessage.textContent = message;
    
    field.parentElement.appendChild(errorMessage);
    
    const removeError = () => {
        field.classList.remove('error');
        const msg = field.parentElement.querySelector('.field-error-message');
        if (msg) msg.remove();
        field.removeEventListener('input', removeError);
    };
    field.addEventListener('input', removeError, { once: true });
}

// ========== ВАЛИДАЦИЯ ВСЕХ ПОЛЕЙ ПЕРЕД ОТПРАВКОЙ ==========
function validateAllFields() {
    const fields = [
        { id: 'recipient', name: 'Имя получателя' }
    ];

    // Проверка телефона
    const phoneInput = document.getElementById('phone');
    const phone = phoneInput.value.trim();
    
    if (phone === '+7') { 
        showFormError('Пожалуйста, введите номер телефона', 'phone');
        showFieldError('phone', 'Введите номер телефона');
        phoneInput.focus();
        return false;
    }

    if (phone.length < 16) { 
        showFormError('Пожалуйста, введите номер телефона полностью', 'phone');
        showFieldError('phone', 'Введите номер полностью');
        phoneInput.focus();
        return false;
    }
    
    // Проверка города
    const cityInput = document.getElementById('city');
    const city = cityInput.value.trim();
    
    if (!city) {
        showFormError('Пожалуйста, выберите город', 'city');
        showFieldError('city', 'Выберите город из списка');
        cityInput.focus();
        return false;
    }
    
    if (!cityInput.classList.contains('valid') || !cityInput.dataset.city) {
        showFormError('Пожалуйста, выберите город из списка', 'city');
        showFieldError('city', 'Выберите город из списка');
        cityInput.focus();
        return false;
    }
    
    // Проверка адреса
    const addressInput = document.getElementById('address');
    const address = addressInput.value.trim();
    
    if (!address) {
        showFormError('Пожалуйста, введите адрес доставки', 'address');
        showFieldError('address', 'Введите адрес доставки');
        addressInput.focus();
        return false;
    }
    
    if (!addressInput.classList.contains('valid') || addressInput.dataset.addressValid !== 'true') {
        showFormError('Пожалуйста, выберите адрес из списка', 'address');
        showFieldError('address', 'Выберите адрес из списка');
        addressInput.focus();
        return false;
    }
    
    // Дополнительные поля не обязательны, но если заполнены, должны быть цифрами
    const entranceInput = document.getElementById('entrance');
    const floorInput = document.getElementById('floor');
    const apartmentInput = document.getElementById('apartment');
    
    if (entranceInput.value && !/^\d+$/.test(entranceInput.value)) {
        showFormError('Подъезд должен содержать только цифры', 'entrance');
        showFieldError('entrance', 'Только цифры');
        entranceInput.focus();
        return false;
    }
    
    if (floorInput.value && !/^\d+$/.test(floorInput.value)) {
        showFormError('Этаж должен содержать только цифры', 'floor');
        showFieldError('floor', 'Только цифры');
        floorInput.focus();
        return false;
    }
    
    if (apartmentInput.value && !/^\d+$/.test(apartmentInput.value)) {
        showFormError('Квартира должна содержать только цифры', 'apartment');
        showFieldError('apartment', 'Только цифры');
        apartmentInput.focus();
        return false;
    }
    
    for (const field of fields) {
        const input = document.getElementById(field.id);
        if (!input.value.trim()) {
            showFormError(`Пожалуйста, заполните поле "${field.name}"`, field.id);
            showFieldError(field.id, 'Вы пропустили это поле');
            input.focus();
            return false;
        }
    }
    
    return true;
}

// ========== ДОПОЛНИТЕЛЬНЫЕ ПОЛЯ (ПОДЪЕЗД, ЭТАЖ, КВАРТИРА) ==========
function initAdditionalFields() {
    const entranceInput = document.getElementById('entrance');
    const floorInput = document.getElementById('floor');
    const apartmentInput = document.getElementById('apartment');
    
    // Валидация для подъезда (только цифры)
    if (entranceInput) {
        entranceInput.addEventListener('input', function(e) {
            let value = e.target.value;
            value = value.replace(/[^\d]/g, '');
            e.target.value = value;
        });
    }
    
    // Валидация для этажа (только цифры)
    if (floorInput) {
        floorInput.addEventListener('input', function(e) {
            let value = e.target.value;
            value = value.replace(/[^\d]/g, '');
            e.target.value = value;
        });
    }
    
    // Валидация для квартиры (только цифры)
    if (apartmentInput) {
        apartmentInput.addEventListener('input', function(e) {
            let value = e.target.value;
            value = value.replace(/[^\d]/g, '');
            e.target.value = value;
        });
    }
}

// ========== ЗАГРУЗКА КОРЗИНЫ ==========
async function loadCartForCheckout() {
    const token = localStorage.getItem('token');
    const orderItemsList = document.getElementById('order-items-list');
    const orderTotal = document.getElementById('order-total');
    
    try {
        const response = await fetch(`${API_URL}/cart`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error('Ошибка загрузки');
        
        const data = await response.json();
        
        if (!data.items || data.items.length === 0) {
            window.location.href = '/cart.html';
            return;
        }
        
        renderOrderItems(data.items, orderItemsList, orderTotal, data.totalAmountFormatted);
        
    } catch (error) {
        console.error('Error loading cart:', error);
        orderItemsList.innerHTML = '<p class="error-message">Ошибка загрузки корзины</p>';
    }
}

// ========== ОТРИСОВКА ТОВАРОВ ==========
function renderOrderItems(items, container, totalElement, totalFormatted) {
    container.innerHTML = '';
    
    items.forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.className = 'order-item';
        
        itemElement.innerHTML = `
            <img src="${item.image_url || 'https://via.placeholder.com/60x80'}" 
                 alt="${item.name}"
                 class="order-item-image"
                 onerror="this.src='https://via.placeholder.com/60x80'">
            <div class="order-item-info">
                <h4>${item.name}</h4>
                <div class="order-item-details">
                    ${item.size ? `<span>Размер: ${item.size}</span>` : ''}
                    <span>${item.quantity} × ${item.priceFormatted}</span>
                </div>
            </div>
            <div class="order-item-price">${item.itemTotalFormatted}</div>
        `;
        
        container.appendChild(itemElement);
    });
    
    totalElement.textContent = totalFormatted;
}

// ========== ОБРАБОТКА ОТПРАВКИ ФОРМЫ ==========
const checkoutForm = document.getElementById('checkout-form');
if (checkoutForm) {
    checkoutForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = '/login.html';
            return;
        }
        
        if (!validateAllFields()) {
            return;
        }
        
        const formData = {
            deliveryRecipient: document.getElementById('recipient').value.trim(),
            deliveryPhone: document.getElementById('phone').value.trim(),
            deliveryCity: document.getElementById('city').value.trim(),
            deliveryAddress: document.getElementById('address').value.trim(),
            deliveryEntrance: document.getElementById('entrance').value.trim() || null,
            deliveryFloor: document.getElementById('floor').value.trim() || null,
            deliveryApartment: document.getElementById('apartment').value.trim() || null,
            deliveryPostalCode: document.getElementById('postal-code').value.trim() || undefined,
            paymentMethod: document.querySelector('input[name="payment-method"]:checked').value
        };
        
        const submitBtn = document.getElementById('submit-order');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Оформляем...';
        
        try {
            const response = await fetch(`${API_URL}/orders`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
            
            const data = await response.json();
            
            if (response.ok) {
                showSuccessModal(data.order.order_number);
            } else {
                showFormError(data.message || 'Ошибка при оформлении заказа');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Подтвердить заказ';
            }
        } catch (error) {
            console.error('Error creating order:', error);
            showFormError('Ошибка соединения с сервером');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Подтвердить заказ';
        }
    });
}

// ========== МОДАЛЬНОЕ ОКНО УСПЕХА ==========
function showSuccessModal(orderNumber) {
    const modal = document.getElementById('success-modal');
    const orderNumberSpan = document.getElementById('order-number');
    
    orderNumberSpan.textContent = `Номер заказа: ${orderNumber}`;
    modal.style.display = 'flex';
}

window.closeSuccessModal = function() {
    const modal = document.getElementById('success-modal');
    modal.style.display = 'none';
    window.location.href = '/profile.html';
};

window.onclick = function(event) {
    const modal = document.getElementById('success-modal');
    if (event.target === modal) {
        closeSuccessModal();
    }
};