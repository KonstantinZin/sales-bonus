/**
 * Функция для расчета выручки
 * @param {{discount: number, quantity: number, sale_price: number}} purchase запись о покупке
 * @param {Object} _product карточка товара
 * @returns {number}
 */
function calculateSimpleRevenue(purchase, _product) {
    // Реализация расчета денег с учетом скидки
    return purchase.sale_price * purchase.quantity * (1 - purchase.discount / 100);
}

/**
 * Функция для расчета бонусов
 * @param {number} index порядковый номер в отсортированном массиве
 * @param {number} total общее число продавцов
 * @param {{profit: number}} seller карточка продавца
 * @returns {number}
 */
function calculateBonusByProfit(index, total, seller) {
   
    if (index === 0) {
        // 15% для первого места
        return seller.profit * 0.15;
    } else if (index === 1 || index === 2) {
        // 10% для второго и третьего места
        return seller.profit * 0.10;
    } else if (index === total - 1) {
        // 0% для последнего места
        return 0;
    } else {
        // 5% для всех остальных
        return seller.profit * 0.05;
    }
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
    
    if (!Array.isArray(data.sellers) || data.sellers.length === 0 ||
        !Array.isArray(data.products) || data.products.length === 0 ||
        !Array.isArray(data.purchase_records) || data.purchase_records.length === 0) {
        throw new Error('Некорректные входные данные');
    }

    // 2. Проверка опций
    const { calculateRevenue, calculateBonus } = options || {};
    if (typeof calculateRevenue !== 'function' || typeof calculateBonus !== 'function') {
        throw new Error('Отсутствуют необходимые функции для расчетов');
    }

    // 3. Подготовка промежуточных данных для сбора статистики
    const sellerStats = data.sellers.map(seller => ({
        id: seller.id,
        name: `${seller.first_name} ${seller.last_name}`,
        revenue: 0,
        profit: 0,
        sales_count: 0,
        products_sold: {} // для накопления количества проданных товаров по SKU
    }));

    // 4. Создание индексов для быстрого доступа
    const sellerIndex = {};
    sellerStats.forEach(stat => {
        sellerIndex[stat.id] = stat;
    });

    const productIndex = {};
    data.products.forEach(product => {
        productIndex[product.sku] = product;
    });

    // 5. Обработка всех записей о продажах
    data.purchase_records.forEach(record => {
        const seller = sellerIndex[record.seller_id];
        
        if (!seller) {
            // Если продавец не найден, пропускаем запись
            return;
        }

        // Увеличиваем количество продаж
        seller.sales_count += 1;
        
        // Добавляем общую сумму чека к выручке
        seller.revenue += record.total_amount;

        // Обрабатываем каждый товар в чеке
        record.items.forEach(item => {
            const product = productIndex[item.sku];
            
            if (!product) {
                // Если товар не найден, пропускаем
                return;
            }

            // Рассчитываем выручку для этого товара
            const itemRevenue = calculateRevenue(item, product);
            
            // Рассчитываем себестоимость товара
            const itemCost = product.purchase_price * item.quantity;
            
            // Рассчитываем прибыль от этого товара
            const itemProfit = itemRevenue - itemCost;
            
            // Добавляем прибыль к общей прибыли продавца
            seller.profit += itemProfit;
            
            // Учитываем количество проданных товаров
            if (!seller.products_sold[item.sku]) {
                seller.products_sold[item.sku] = 0;
            }
            seller.products_sold[item.sku] += item.quantity;
        });
    });

   
    sellerStats.sort((a, b) => b.profit - a.profit);

    // 7. Расчет бонусов и формирование итоговой коллекции
    const result = sellerStats.map((seller, index) => {
        
        const bonus = calculateBonus(index, sellerStats.length, seller);
        
        // Формируем топ-10 товаров
        const topProducts = Object.entries(seller.products_sold)
            .map(([sku, quantity]) => ({ sku, quantity }))
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 10);
        
      
        return {
            seller_id: seller.id,
            name: seller.name,
            revenue: +seller.revenue.toFixed(2),
            profit: +seller.profit.toFixed(2),
            sales_count: seller.sales_count,
            top_products: topProducts,
            bonus: +bonus.toFixed(2)
        };
    });

    return result;
}

module.exports = { analyzeSalesData, calculateBonusByProfit, calculateSimpleRevenue };