# Predicting late grocery deliveries: Fenmoor Fresh

*Exported from Jupyter. MSc Data Science, University of Kestrel, module DS7102 Applied Machine Learning, individual project.*

## 1. Problem

Fenmoor Fresh (a fictional online grocer used as the module case study) promises delivery inside a one-hour slot. Late deliveries drive complaints and refunds. The operations team wanted to know, at the time an order is placed, which orders are likely to arrive late, so they can move them to a less busy van or warn the customer.

Goal: a classifier that flags likely-late orders, judged mainly on recall for the late class, because a missed late order costs more than a false alarm.

## 2. Data

```python
import pandas as pd
orders = pd.read_parquet("fenmoor_orders_2024.parquet")
orders.shape
```

```
(48219, 23)
```

```python
orders["late"].value_counts(normalize=True).round(3)
```

```
0    0.884
1    0.116
Name: late, dtype: float64
```

So 11.6% of orders were late. The data covers 48,219 orders from March to November 2024 across 3 depots. I dropped 412 orders with missing GPS traces, leaving 47,807.

```python
orders = orders.dropna(subset=["drop_lat", "drop_lon"])
len(orders)
```

```
47807
```

## 3. Features

I built 14 features. The ones that mattered most:

- `distance_km`: road distance from depot to drop (from the routing API cache)
- `slot_hour`: hour the delivery slot starts
- `driver_shift_hours`: how long the driver had been on shift at the slot start
- `drops_in_route`: number of drops on the same van run
- `rain_mm`: rainfall in the slot hour (Met Office open data, matched by depot)

```python
from sklearn.model_selection import train_test_split
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, stratify=y, random_state=42)
```

I split by time as a check as well (train on March to August, test on September to November). Results were within 0.01 AUC, so the random split is reported below.

## 4. Models

### Baseline: logistic regression

```python
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score, recall_score
lr = LogisticRegression(max_iter=1000, class_weight="balanced").fit(X_train, y_train)
print(round(roc_auc_score(y_test, lr.predict_proba(X_test)[:, 1]), 2))
print(round(recall_score(y_test, lr.predict(X_test)), 2))
```

```
0.71
0.62
```

### Gradient boosting (LightGBM)

```python
import lightgbm as lgb
gbm = lgb.LGBMClassifier(n_estimators=600, learning_rate=0.03,
                         num_leaves=31, is_unbalance=True)
gbm.fit(X_train, y_train)
print(round(roc_auc_score(y_test, gbm.predict_proba(X_test)[:, 1]), 2))
print(round(recall_score(y_test, gbm.predict(X_test)), 2))
```

```
0.84
0.79
```

| Model | AUC | Recall (late) | Precision (late) |
|---|---|---|---|
| Logistic regression | 0.71 | 0.62 | 0.21 |
| LightGBM | 0.84 | 0.79 | 0.34 |

Tuning: 5-fold cross-validation over 36 parameter combinations with Optuna. Best params above. Training time about 40 seconds on my laptop.

## 5. What drives lateness

```python
import shap
explainer = shap.TreeExplainer(gbm)
shap_values = explainer.shap_values(X_test)
```

Mean absolute SHAP values put `drops_in_route`, `driver_shift_hours` and `slot_hour` at the top, then `distance_km`. Rain mattered less than I expected. Orders on a run with more than 18 drops were late 27% of the time, against 8% for runs with 10 drops or fewer. Slots starting at 17:00 or 18:00 were the worst.

## 6. Results and recommendation

- LightGBM raised recall on late orders from 0.62 to 0.79 and AUC from 0.71 to 0.84 compared with the logistic regression baseline.
- At the chosen threshold the model flags about 1 in 4 orders, and catches roughly 4 in 5 of the orders that will be late.
- The biggest driver is how many drops are on the van run, which the planners control. I recommended capping evening runs at 18 drops as a trial.

## 7. Limitations

The data is from one year and three depots, so seasonality is only partly covered. Precision is still low (0.34), so a warning to customers based on the flag alone would annoy many people whose order arrives on time. The model has not been tested live.

Repo: code, notebook and a short model card are in my GitHub (link on my CV).
