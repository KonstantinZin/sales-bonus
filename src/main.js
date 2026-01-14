/**
 * Функция для расчета выручки
 * @param {{discount: number, quantity: number, sale_price: number}} purchase запись о покупке
 * @param {Object} _product карточка товара
 * @returns {number}
 */
function calculateSimpleRevenue(purchase, _product) {
    
    if (!purchase || !purchase.sale_price || !purchase.quantity) return 0;
    const discount = purchase.discount || 0;
    const revenue = purchase.sale_price * purchase.quantity * (1 - discount / 100);
    return Math.round(revenue * 100) / 100;
}

/**
 * Функция для расчета бонусов
 * @param {number} index порядковый номер в отсортированном массиве
 * @param {number} total общее число продавцов
 * @param {{profit: number}} seller карточка продавца
 * @returns {number}
 */
function calculateBonusByProfit(index, total, seller) {
    // 15% — для продавца, который принёс наибольшую прибыль (первое место)
    // 10% — для продавцов, которые по прибыли находятся на втором и третьем месте
    // 5% — для всех остальных продавцов, кроме самого последнего
    // 0% — для продавца на последнем месте
    
    if (!seller || typeof seller.profit !== 'number') return 0;
    
    let bonusPercentage = 0;
    
    if (index === 0) {
        // Первое место
        bonusPercentage = 0.15;
    } else if (index === 1 || index === 2) {
        // Второе и третье места
        bonusPercentage = 0.10;
    } else if (index === total - 1) {
        // Последнее место
        bonusPercentage = 0;
    } else {
        // Все остальные
        bonusPercentage = 0.05;
    }
    
    const bonus = seller.profit * bonusPercentage;
    return Math.round(bonus * 100) / 100;
}

/**
 * Функция для анализа данных продаж
 * @param {{customers: Array, products: {sku: string, purchase_price: number, sale_price: number}[], sellers: {id: string, first_name: string, last_name: string}[], purchase_records: {seller_id: string, items: {sku: string, discount: number, quantity: number, sale_price: number}[], total_amount: number, total_discount: number}[]}} data
 * @param {{calculateRevenue: Function, calculateBonus: Function}} options
 * @returns {{revenue: number, top_products: { sku: string, quantity: number}[], bonus: number, name: string, sales_count: number, profit: number, seller_id: string}[]}
 */
function analyzeSalesData(data, options) {
    // 1. Проверка входных данных
    if (!data || typeof data !== "object") {
        throw new Error('Некорректные входные данные');
    }

    // Проверка обязательных полей
    const requiredFields = ['sellers', 'products', 'purchase_records'];
    for (const field of requiredFields) {
        if (!data.hasOwnProperty(field)) {
            throw new Error(`Отсутствует обязательное поле: ${field}`);
        }
        if (!Array.isArray(data[field])) {
            throw new Error(`Поле ${field} должно быть массивом`);
        }
        if (data[field].length === 0) {
            throw new Error(`Массив ${field} не должен быть пустым`);
        }
    }

    // 2. Проверка опций
    if (!options || typeof options !== "object") {
        throw new Error('Не переданы опции');
    }
    
    const { calculateRevenue, calculateBonus } = options;
    if (typeof calculateRevenue !== 'function' || typeof calculateBonus !== 'function') {
        throw new Error('Отсутствуют необходимые функции для расчетов');
    }

    // 3. Создаем индексы для быстрого доступа
    const sellerIndex = {};
    const productIndex = {};
    
    // Инициализация статистики по продавцам
    const sellerStats = data.sellers.map(seller => {
        sellerIndex[seller.id] = seller;
        return {
            id: seller.id,
            name: `${seller.first_name} ${seller.last_name}`,
            revenue: 0,           // общая выручка
            cost: 0,              // себестоимость
            profit: 0,            // прибыль (будет рассчитана позже)
            sales_count: 0,       // количество чеков
            products_sold: {}     // sku -> количество для топ-товаров
        };
    });
    
    // Создаем индекс для статистики продавцов
    const sellerStatsIndex = {};
    sellerStats.forEach(stat => {
        sellerStatsIndex[stat.id] = stat;
    });
    
    // Создаем индекс товаров
    data.products.forEach(product => {
        productIndex[product.sku] = product;
    });

    // 4. Обработка чеков
    data.purchase_records.forEach(record => {
        const sellerStat = sellerStatsIndex[record.seller_id];
        
        if (!sellerStat) {
            // Продавец не найден, пропускаем чек
            return;
        }
        
        // Увеличиваем счетчик продаж
        sellerStat.sales_count += 1;
        
        // Добавляем общую сумму чека к выручке
        // В ТЗ указано, что total_amount - это сумма с учетом скидки
        sellerStat.revenue += record.total_amount || 0;
        
        // Обрабатываем товары в чеке
        record.items.forEach(item => {
            const product = productIndex[item.sku];
            
            if (!product) {
                // Товар не найден в каталоге
                return;
            }
            
            // Рассчитываем выручку от этого товара
            const itemRevenue = calculateRevenue(item, product);
            
            // Рассчитываем себестоимость товара
            const itemCost = product.purchase_price * item.quantity;
            
            // Добавляем к общей себестоимости
            sellerStat.cost += itemCost;
            
            // Учитываем количество проданных товаров для топ-списка
            if (!sellerStat.products_sold[item.sku]) {
                sellerStat.products_sold[item.sku] = 0;
            }
            sellerStat.products_sold[item.sku] += item.quantity;
        });
    });
    
    // 5. Рассчитываем прибыль для каждого продавца
    sellerStats.forEach(stat => {
        stat.profit = stat.revenue - stat.cost;
    });
    
    // 6. Сортируем продавцов по убыванию прибыли
    sellerStats.sort((a, b) => b.profit - a.profit);
    
    // 7. Формируем итоговый результат
    const result = sellerStats.map((stat, index) => {
        // Формируем топ-10 товаров
        const topProducts = Object.entries(stat.products_sold)
            .map(([sku, quantity]) => ({ sku, quantity }))
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 10);
        
        // Рассчитываем бонус
        const bonus = calculateBonus(index, sellerStats.length, { profit: stat.profit });
        
         return {
            seller_id: stat.id,
            name: stat.name,
            revenue: Math.round(stat.revenue * 100) / 100,
            profit: Math.round(stat.profit * 100) / 100,
            sales_count: stat.sales_count,
            top_products: topProducts,
            bonus: Math.round(bonus * 100) / 100
        };
    });
    
    return result;
}


if (typeof module !== 'undefined' && module.exports) {
    module.exports = { analyzeSalesData, calculateBonusByProfit, calculateSimpleRevenue };
}