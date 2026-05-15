# Документация калькулятора юнит-экономики

Дата актуализации: `2026-05-15`

Сверено с исходным документом формул: `d:\WORK\v3\docs\unit-economics-formulas-accounting-ru.html`.

## Назначение

Калькулятор на странице `/calculator` считает прибыльность товара Wildberries для сценариев FBO и FBS. Входные параметры редактируются в карточке товара и блоке `Параметры расчета`, результаты выводятся в KPI, структуре затрат, unit-экономике, WB-отчете и графиках чувствительности.

Основные файлы:

- `src/pages/Calculator.jsx` - состояние формы, версии, сохранение расчета.
- `src/lib/unitEconomics.js` - нормализация входных данных и формулы unit-экономики.
- `src/lib/LogisticsService.js` - применение тарифов логистики и расчет оплачиваемого веса.
- `src/lib/calculatorSeed.js` - заполнение формы из товара, снапшотов и справочников.
- `src/lib/calculatorParameterDocs.js` - единый реестр параметров, подсказок и ролей.

## Базовая формула

Цена в поле `price` считается итоговой ценой продажи после скидок.

```text
acquiring = price * acquiring_pct / 100
wbFee = price * wb_commission_pct / 100
promo = price * promo_pct / 100
cogsBase = cogs_purchase + cogs_packaging + cogs_fulfillment + cogs_inbound_to_wb
cogsWithWaste = cogsBase * (1 + waste_pct / 100)
returnLossPerSale = return_rate_pct / 100 * return_loss
marketingCost = cac * paid_share_pct / 100
channelVar = расходы активной схемы FBO или FBS
grossProfit = revenueNet - cogsWithWaste - channelVar - returnLossPerSale
contribution = grossProfit - marketingCost
bepUnits = fixedMonthlyTotal / contribution
```

`fixed_monthly` не влияет на прибыль на единицу. Он используется в точке безубыточности и месячном прогнозе.

## Налоги

Поддерживаемые UI-режимы:

- `usn_income` - налоговая база равна выручке без НДС.
- `usn_income_expense` - налоговая база равна положительной разнице между выручкой и вычитаемыми переменными расходами.

Внутри `unitEconomics.js` legacy-значения мапятся на donor-compatible tax systems.

## Логистика и тарифные справочники

Тариф выбирается по трем осям:

- направление или ПВЗ: `logistics_direction` / `pickup_point`;
- схема: `fulfillment_mode` = `FBO` или `FBS`;
- упаковка: `package_mode` = `box` или `pallet`.

Поддерживаемый production-формат справочника для весовых тарифов:

```json
{
  "FBO": {
    "box": { "base": 100, "per_kg": 2, "storage": 10 },
    "pallet": { "base": 900, "per_kg": 1, "storage": 120 }
  },
  "FBS": {
    "box": { "base": 70, "per_kg": 3, "storage": 6 },
    "pallet": { "base": 700, "per_kg": 1.5, "storage": 90 }
  }
}
```

Для обратной совместимости также поддерживается старый формат:

```json
{
  "FBO": { "base": 45, "per_kg": 1.5, "storage": 8 },
  "FBS": { "base": 30, "per_kg": 0.8, "storage": 5 }
}
```

Также поддерживаются литровые поля WB из документа формул:

```json
{
  "FBO": {
    "box": {
      "boxDeliveryBase": 100,
      "boxDeliveryLiter": 5,
      "boxStorageBase": 10,
      "boxStorageLiter": 1
    },
    "pallet": {
      "palletDeliveryValueBase": 900,
      "palletDeliveryValueLiter": 20,
      "palletStorageValueExpr": 120
    }
  },
  "FBS": {
    "box": {
      "boxDeliveryMarketplaceBase": 70,
      "boxDeliveryMarketplaceLiter": 4
    }
  }
}
```

Правила расчета:

- короб: тариф применяется на одну единицу;
- паллет: тариф применяется на паллет и распределяется на единицу через `wb_boxes_per_pallet`;
- если `wb_boxes_per_pallet = 0`, вместимость считается автоматически по габаритам короба;
- оплачиваемый вес равен `max(weight_kg, volumeLiters / 5)`;
- первые 50 г включены в базовую ставку;
- для литрового тарифа применяется `base + perLiter * max(volumeLiters - 1, 0)`;
- поля `palletDeliveryValueBase` / `palletDeliveryValueLiter` трактуются как уже приведенные к продаже значения и не делятся на количество коробов;
- при смене FBO/FBS, короб/паллет, габаритов, веса, направления или коробов на паллете логистика пересчитывается из справочника.

ПВЗ хранит `directionId`; при выборе ПВЗ калькулятор применяет тариф того направления. Если товар несовместим с FBS по ограничениям, ПВЗ не применяется.

## Параметры

| Параметр | Назначение | Влияние |
| --- | --- | --- |
| `fulfillment_mode` | Выбор FBO или FBS | Определяет активный набор логистических расходов |
| `package_mode` | Короб или паллет | Выбирает package-specific тариф |
| `price` | Цена продажи | База комиссий, налогов, маржи и contribution |
| `wb_cabinet_price` | Цена из кабинета WB | Справочно, в формулу не входит |
| `monthly_plan` | План продаж в месяц | Месячная прибыль и запас к BEP |
| `size_length_cm`, `size_width_cm`, `size_height_cm` | Габариты | Объем, оплачиваемый вес, вместимость паллеты |
| `weight_kg` | Фактический вес | Оплачиваемый вес |
| `wb_boxes_per_pallet` | Коробов на паллете | Распределение паллетного тарифа |
| `cogs_purchase` | Закупка | Базовая себестоимость |
| `cogs_packaging` | Упаковка | Базовая себестоимость |
| `cogs_fulfillment` | Сборка / фулфилмент | Базовая себестоимость |
| `cogs_inbound_to_wb` | Доставка до WB | Базовая себестоимость |
| `waste_pct` | Брак | Увеличивает себестоимость |
| `fbo_wb_logistics`, `fbo_storage`, `fbo_other` | Расходы FBO | Входят в `channelVar` только при FBO |
| `fbs_last_mile`, `fbs_ops`, `fbs_storage`, `fbs_other` | Расходы FBS | Входят в `channelVar` только при FBS |
| `paid_share_pct`, `cac` | Платный трафик | Формируют `marketingCost` |
| `promo_pct` | Промо и акции | Вычитается из выручки |
| `fixed_monthly` | Постоянные расходы | BEP и месячный прогноз |
| `tax_system`, `tax_pct` | Налоги | Налоговая база и сумма налога |
| `acquiring_pct` | Эквайринг | Удержание от цены |
| `wb_commission_pct` | Комиссия WB | Удержание от цены |
| `return_rate_pct`, `return_loss` | Возвраты | Потери на возвраты в gross profit |

## WB-отчет

Поля WB-отчета не дублируют прогнозную unit-экономику. Они используются для фактической сверки по отчету Wildberries:

- `wb_sales_rub - wb_returns_rub` - отчетная выручка;
- `wb_commission_rub / revenue` - фактическая доля комиссии;
- `wb_acquiring_rub / revenue` - фактическая доля эквайринга;
- `wb_logistics_delivery_rub + wb_logistics_return_rub` - фактическая логистика;
- `wb_payout_rub - taxAmount - wb_cogs_rub` - фактическая чистая прибыль.

## Проверка на дублирование

В UI один параметр должен редактироваться только в одном смысловом блоке.

Текущее правило:

- `fbo_other` и `fbs_other` редактируются только в блоке `Логистика`;
- блок `Себестоимость` содержит только COGS-поля и `waste_pct`;
- поля WB-отчета отделены от прогнозных полей и не подменяют их;
- `wb_cabinet_price` является справочным и не подменяет `price`.

Покрытие тестами:

- `node --test src/lib/unitEconomics.test.mjs src/lib/onboarding.test.mjs`;
- проверяется матрица тарифов FBO/FBS x box/pallet x направление/ПВЗ-подобное направление;
- проверяется пересчет логистики при смене package-specific тарифа через `applyFulfillmentModeSeed()`;
- проверяется отсутствие подмешивания расходов неактивной схемы FBO/FBS.
