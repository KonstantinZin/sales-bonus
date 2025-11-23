/**
 * Функция для расчета выручки
 * @param purchase запись о покупке
 * @param _product карточка товара
 * @returns {number}
 */
function calculateSimpleRevenue(purchase, _product) {
   // Выручка по позиции = цена продажи с учётом скидки × количество
   const qty = Number(purchase?.quantity ?? 0);
   const price = Number(purchase?.sale_price ?? 0);
   const discount = Number(purchase?.discount ?? 0);
   const d = Math.min(Math.max(discount, 0), 100); // 0..100
   const revenue = qty * price * (1 - d / 100);
   return Number.isFinite(revenue) ? revenue : 0;
}

/**
 * Функция для расчета бонусов
 * @param index порядковый номер в отсортированном массиве
 * @param total общее число продавцов
 * @param seller карточка продавца
 * @returns {number}
 */
function calculateBonusByProfit(index, total, seller) {
    // Фиксированная шкала бонусов по месту в рейтинге (по прибыли):
    // 1-е: 15%, 2-е: 10%, 3-е: 10%, 4-е: 5%, остальные: 0%
    const profit = Number(seller?.profit ?? 0);
    if (!(profit > 0) || !(total > 0)) return 0;

    let pct = 0;
    if (index === 0) pct = 0.15;
    else if (index === 1 || index === 2) pct = 0.10;
    else if (index === 3) pct = 0.05;
    else pct = 0;

    const bonus = profit * pct;
    // Округление до копеек (стандартное банковское округление)
    return Math.round(bonus * 100) / 100;
}

/**
 * Функция для анализа данных продаж
 * @param data
 * @param options
 * @returns {{revenue, top_products, bonus, name, sales_count, profit, seller_id}[]}
 */
function analyzeSalesData(data, options) {
    // 1) Проверка входных данных
    if (!data || typeof data !== 'object') throw new Error('Invalid data');

    const products = data.products;
    const sellers = data.sellers;
    const purchaseRecords = data.purchase_records;

    if (!Array.isArray(sellers)) throw new Error('Invalid sellers');
    if (!Array.isArray(products)) throw new Error('Invalid products');
    if (!Array.isArray(purchaseRecords)) throw new Error('Invalid purchase_records');
    if (sellers.length === 0) throw new Error('Empty sellers');
    if (products.length === 0) throw new Error('Empty products');
    if (purchaseRecords.length === 0) throw new Error('Empty purchase_records');

    // 2) Проверка наличия опций
    if (!options || typeof options !== 'object') throw new Error('Options required');
    const { calculateRevenue, calculateBonus } = options;
    if (typeof calculateRevenue !== 'function' || typeof calculateBonus !== 'function') {
        throw new Error('Both calculateRevenue and calculateBonus must be functions');
    }

    // 3) Индексация товаров и продавцов
    const productBySku = new Map(products.map(p => [p.sku, p]));
    const sellerById = new Map(sellers.map(s => [s.id, s]));

    const round2 = (x) => Math.round(x * 100) / 100;

    // 4) Промежуточные агрегаты по продавцам
    const perSeller = new Map();
    for (const s of sellers) {
        perSeller.set(s.id, {
            seller_id: s.id,
            name: `${s.first_name} ${s.last_name}`,
            revenueCents: 0,
            costCents: 0,
            skuSet: new Set(), // множество проданных SKU (для sales_count)
            topQtyBySku: new Map(), // sku -> total quantity
        });
    }

    // 5) Расчёт агрегатов
    for (const receipt of purchaseRecords) {
        const sellerId = receipt?.seller_id;
        if (!perSeller.has(sellerId)) continue;
        const acc = perSeller.get(sellerId);

        const items = Array.isArray(receipt?.items) ? receipt.items : [];
        for (const item of items) {
            const product = productBySku.get(item?.sku);
            if (!product) continue;

            const qty = Number(item?.quantity ?? 0);
            const revenue = Number(calculateRevenue(item, product)) || 0;
            const cost = (Number(product.purchase_price) || 0) * qty;

            // суммируем в копейках по каждой позиции, чтобы избежать накопления ошибок FP
            acc.revenueCents += Math.round(revenue * 100);
            acc.costCents += Math.round(cost * 100);

            if (qty > 0) acc.skuSet.add(product.sku);

            const prevQty = acc.topQtyBySku.get(product.sku) || 0;
            acc.topQtyBySku.set(product.sku, prevQty + (Number.isFinite(qty) ? qty : 0));
        }
    }

    // 6) Формируем итог по каждому продавцу
    let report = Array.from(perSeller.values()).map(acc => {
        // топ-10 SKU по количеству
        const top_products = Array.from(acc.topQtyBySku.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([sku, quantity]) => ({ sku, quantity }));

        const revenue = round2(acc.revenueCents / 100);
        const profit = round2((acc.revenueCents - acc.costCents) / 100);

        return {
            seller_id: acc.seller_id,
            name: acc.name,
            revenue,
            profit,
            sales_count: acc.skuSet.size,
            top_products,
        };
    });

    // 7) Сортировка по прибыли (убывание)
    report.sort((a, b) => b.profit - a.profit);

    // 8) Назначение бонусов
    const total = report.length;
    report = report.map((s, idx) => ({
        ...s,
        bonus: round2(Number(calculateBonus(idx, total, s)) || 0),
    }));

    return report;
}
