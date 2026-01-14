/**
 * Функция для расчета выручки
 * @param {{discount: number, quantity: number, sale_price: number}} purchase запись о покупке
 * @param {Object} _product карточка товара
 * @returns {number}
 */
function calculateSimpleRevenue(purchase, _product) {
    // @TODO: Реализовать расчет денег
   return purchase.sale_price * purchase.quantity * (1 - purchase.discount / 100);
}

/**
 * Функция для расчета бонусов
 * @param {number} index порядковый номер в отсортированном массиве
 * @param {number} _total общее число продавцов
 * @param {{profit: number}} seller карточка продавца
 * @returns {number}
 */
function calculateBonusByProfit(index, _total, seller) {
    let bonus;

    switch (index) {
        case 0: {
            bonus = 0.15;
            break;
        }
        case 1:
        case 2: {
            bonus = 0.1;
            break;
        }
        case 3: {
            bonus = 0.05;
            break;
        }
        default: {
            bonus = 0;
        }
    }

    // @TODO: Реализовать расчет денег
    return seller.profit * bonus;
}

/**
 * Функция для анализа данных продаж
 * @param {{customers: Array, products: {sku: string, purchase_price: number, sale_price: number}[], sellers: {id: string, first_name: string, last_name: string}[], purchase_records: {seller_id: string, items: {sku: string, discount: number, quantity: number, sale_price: number}[], total_amount: number, total_discount: number}[]}} data
 * @param {{calculateRevenue: Function, calculateBonus: Function}} options
 * @returns {{revenue: number, top_products: { sku: string, quantity: number}[], bonus: number, name: string, sales_count: number, profit: number, seller_id: string}[]}
 */
function analyzeSalesData(data, options) {
    // проверка наличия полного перечня параметров функции
    if (!data || !options || typeof data !== "object" || typeof options !== "object") {
        throw new Error('Invalid input data');
    }

    // проверка типов параметров options
    if (!options.hasOwnProperty('calculateRevenue') || !options.hasOwnProperty('calculateBonus')) {
        throw new Error('Invalid options');
    }

    // проверка наличия всех необходимых полей в данных
    if (!data.hasOwnProperty('customers') || !data.hasOwnProperty('products') || !data.hasOwnProperty('sellers') || !data.hasOwnProperty('purchase_records')) {
        throw new Error('Invalid data');
    }

    const { customers, products, sellers, purchase_records } = data;

    if (!Array.isArray(customers) || !Array.isArray(products) || !Array.isArray(sellers) || !Array.isArray(purchase_records)
    || customers.length === 0 || products.length === 0 || sellers.length === 0 || purchase_records.length === 0) {
        throw new Error('Invalid data format');
    }

    const sellerStatistic = new Map();

    purchase_records.forEach((record) => {
        if (record.seller_id === 'seller_1') debugger

        if (!sellerStatistic.has(record.seller_id)) {
            sellerStatistic.set(record.seller_id, {
                revenue: 0,
                sales_count: 0,
                top_products: new Map(),
            })
        }

        const statictic = sellerStatistic.get(record.seller_id);
        let revenue = statictic.revenue;

        record.items.forEach(({sku, discount, quantity, sale_price}) => {
            // @TODO: Реализовать расчет денег
            revenue += calculateSimpleRevenue({discount, quantity, sale_price}, {})
            if (statictic.top_products.has(sku)) {
                const currentProductStatistic = statictic.top_products.get(sku);

                statictic.top_products.set(sku, currentProductStatistic + quantity)
            } else {
                statictic.top_products.set(sku, quantity)
            }
        });

        sellerStatistic.set(record.seller_id, {
            revenue,
            sales_count: statictic.sales_count + 1,
            top_products: statictic.top_products,
        })
    });

    return Array.from(sellerStatistic.entries()).map(([id, statistic]) => {
        const seller = sellers.find((s) => s.id === id);

        const topProducts = Array.from(statistic.top_products.entries()).map(([sku, quantity]) => ({sku, quantity}));

        let purchase_total = 0;
        topProducts.forEach((p) => {
            const purchase_price = products.find((product) => product.sku === p.sku).purchase_price;
            // @TODO: Реализовать расчет денег
            purchase_total += purchase_price * p.quantity;
        });

        // @TODO: Реализовать расчет денег
        let profit = statistic.revenue - purchase_total;

        return ({
            seller_id: id,
            name: `${seller.first_name} ${seller.last_name}`,
            revenue: +statistic.revenue.toFixed(2),
            profit: +profit.toFixed(2),
            sales_count: statistic.sales_count,
            top_products: topProducts.sort((a, b) => b.quantity - a.quantity).slice(0, 10),
        });
    })
        .sort((a, b) => b.profit - a.profit)
        .map((seller, index) => {
            let bonus = calculateBonusByProfit(index, 0, {profit: seller.profit});
            return ({...seller, bonus: +bonus.toFixed(2)});
        });
}

module.exports = { analyzeSalesData, calculateBonusByProfit, calculateSimpleRevenue };
