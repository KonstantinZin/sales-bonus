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
    if (!seller || typeof seller.profit !== 'number') return 0;
    
    let bonusPercentage = 0;
    
    if (index === 0) {
        bonusPercentage = 0.15;
    } else if (index === 1 || index === 2) {
        bonusPercentage = 0.10;
    } else if (index === total - 1) {
        bonusPercentage = 0;
    } else {
        bonusPercentage = 0.05;
    }
    
    return seller.profit * bonusPercentage;
   
}

/**
 * Функция для анализа данных продаж
 * @param {{customers: Array, products: {sku: string, purchase_price: number, sale_price: number}[], sellers: {id: string, first_name: string, last_name: string}[], purchase_records: {seller_id: string, items: {sku: string, discount: number, quantity: number, sale_price: number}[], total_amount: number, total_discount: number}[]}} data
 * @param {{calculateRevenue: Function, calculateBonus: Function}} options
 * @returns {{revenue: number, top_products: { sku: string, quantity: number}[], bonus: number, name: string, sales_count: number, profit: number, seller_id: string}[]}
 */
function analyzeSalesData(data, options) {
    if (!data || typeof data !== "object") {
        throw new Error('Некорректные входные данные');
    }

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

    if (!options || typeof options !== "object") {
        throw new Error('Не переданы опции');
    }
    
    const { calculateRevenue, calculateBonus } = options;
    if (typeof calculateRevenue !== 'function' || typeof calculateBonus !== 'function') {
        throw new Error('Отсутствуют необходимые функции для расчетов');
    }

    const productIndex = {};
    data.products.forEach(product => {
        productIndex[product.sku] = product;
    });

    const sellerStats = {};
    data.sellers.forEach(seller => {
        sellerStats[seller.id] = {
            id: seller.id,
            name: `${seller.first_name} ${seller.last_name}`,
            revenue: 0,
            cost: 0,
            sales_count: 0,
            products_sold: {}
        };
    });

    data.purchase_records.forEach(record => {
        const sellerStat = sellerStats[record.seller_id];
        
        if (!sellerStat) return;
        
        sellerStat.sales_count += 1;
        
        record.items.forEach(item => {
            const product = productIndex[item.sku];
            
            if (!product) return;
            
            const itemRevenue = calculateRevenue(item, product);
            
            const itemCost = product.purchase_price * item.quantity;
            
            sellerStat.revenue += itemRevenue;
            sellerStat.cost += itemCost;
            
            if (!sellerStat.products_sold[item.sku]) {
                sellerStat.products_sold[item.sku] = 0;
            }
            sellerStat.products_sold[item.sku] += item.quantity;
        });
    });
    
    const statsArray = Object.values(sellerStats).map(stat => ({
        ...stat,
        profit: stat.revenue - stat.cost
    }));
    
    statsArray.sort((a, b) => b.profit - a.profit);
    
    const result = statsArray.map((stat, index) => {
        const topProducts = Object.entries(stat.products_sold)
            .map(([sku, quantity]) => ({ sku, quantity }))
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 10);
        
        const bonus = calculateBonus(index, statsArray.length, { profit: stat.profit });
        
        return {
            seller_id: stat.id,
            name: stat.name,
            revenue: +(stat.revenue.toFixed(2)),
             profit: +(stat.profit.toFixed(2)), 
            sales_count: stat.sales_count,
            top_products: topProducts,
            bonus: +(bonus.toFixed(2))
        };
    });
    
    return result;
}


if (typeof module !== 'undefined' && module.exports) {
    module.exports = { analyzeSalesData, calculateBonusByProfit, calculateSimpleRevenue };
}