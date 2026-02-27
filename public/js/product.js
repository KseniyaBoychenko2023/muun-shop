const urlParams = new URLSearchParams(window.location.search);
const productId = urlParams.get('id');

// Загружаем данные товара при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    loadProductDetails(productId);
});

async function loadProductDetails(id) {
    try {
        const response = await fetch(`${API_URL}/products/${id}`);
        
        if (!response.ok) {
            throw new Error('Товар не найден');
        }
        
        const product = await response.json();
        renderProductPage(product);
        
    } catch (error) {
        console.error('Error loading product:', error);
        const container = document.getElementById('product-container');
        container.innerHTML = `
            <div class="error-message">
                <p>Товар не найден</p>
                <a href="/catalog.html" class="btn">Вернуться в каталог</a>
            </div>
        `;
    }
}

function renderProductPage(product) {
    const container = document.getElementById('product-container');
    
    container.innerHTML = `
        <div class="product-images">
            <img src="${product.image_url || 'https://via.placeholder.com/600x800'}" 
                 alt="${product.name}"
                 class="main-image"
                 onerror="this.src='https://via.placeholder.com/600x800'">
        </div>
        
        <div class="product-info">
            <div class="product-header">
                <h1 class="product-title">${product.name}</h1>
                <p class="product-category">${product.category}</p>
            </div>
            
            <div class="product-price-large">${product.priceFormatted}</div>
            
            <div class="product-description">
                <h3>Описание</h3>
                <p>${product.description || 'Описание товара будет добавлено позже.'}</p>
            </div>
            
            <div class="product-materials">
                <h3>Материал</h3>
                <p>${product.material || 'Информация о материале будет добавлена позже.'}</p>
            </div>
            
            <div class="size-selector">
                <div class="size-header">
                    <h3>Выберите размер</h3>
                    <button class="size-guide-btn" onclick="openSizeModal()">Размерная сетка</button>
                </div>
                
                <div class="size-options" id="size-options">
                    <label class="size-option">
                        <input type="radio" name="size" value="XS">
                        <span>XS</span>
                    </label>
                    <label class="size-option">
                        <input type="radio" name="size" value="S">
                        <span>S</span>
                    </label>
                    <label class="size-option">
                        <input type="radio" name="size" value="M">
                        <span>M</span>
                    </label>
                    <label class="size-option">
                        <input type="radio" name="size" value="L">
                        <span>L</span>
                    </label>
                    <label class="size-option">
                        <input type="radio" name="size" value="XL">
                        <span>XL</span>
                    </label>
                </div>
            </div>
            
            <div class="product-actions-large">
                <button class="btn btn-large add-to-cart-page" onclick="addToCartWithSize(${product.id})">
                    В корзину
                </button>
                <button class="btn btn-outline btn-large add-to-favorites-page" onclick="toggleFavoritePage(${product.id}, this)">
                    В избранное
                </button>
            </div>
        </div>
    `;
    
    // Проверяем статус избранного для этого товара
    checkFavoriteStatusForPage(product.id);
}

// Проверка статуса избранного для страницы товара
async function checkFavoriteStatusForPage(productId) {
    const token = localStorage.getItem('token');
    if (!token) return;
    
    try {
        const response = await fetch(`${API_URL}/favorites`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const favorites = await response.json();
            const isFavorite = favorites.some(item => item.id === productId);
            const favBtn = document.querySelector('.add-to-favorites-page');
            
            if (isFavorite && favBtn) {
                favBtn.classList.add('active');
                favBtn.textContent = 'В избранном';
            }
        }
    } catch (error) {
        console.error('Error checking favorite status:', error);
    }
}

// Добавление в избранное со страницы товара
window.toggleFavoritePage = async function(productId, button) {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    const isActive = button.classList.contains('active');

    try {
        if (isActive) {
            const response = await fetch(`${API_URL}/favorites/${productId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (response.ok) {
                button.classList.remove('active');
                button.textContent = 'В избранное';
            }
        } else {
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
    } catch (error) {
        console.error('Error toggling favorite:', error);
        alert('Ошибка при работе с избранным');
    }
};

// Добавление в корзину с размером
window.addToCartWithSize = async function(productId) {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login.html';
        return;
    }
    
    // Получаем выбранный размер
    const selectedSize = document.querySelector('input[name="size"]:checked');
    
    if (!selectedSize) {
        showNotification('Пожалуйста, выберите размер', 'error');
        return;
    }
    
    await addToCartDirect(productId, 1, selectedSize.value);
};

// Функции для работы с модальным окном размерной сетки
window.openSizeModal = function() {
    const modal = document.getElementById('size-modal');
    if (modal) {
        modal.style.display = 'flex';
    }
};

window.closeSizeModal = function() {
    const modal = document.getElementById('size-modal');
    if (modal) {
        modal.style.display = 'none';
    }
};

// Закрытие модального окна по клику вне его
window.onclick = function(event) {
    const modal = document.getElementById('size-modal');
    if (event.target === modal) {
        modal.style.display = 'none';
    }
};