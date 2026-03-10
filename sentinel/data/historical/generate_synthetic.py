
import pandas as pd
import numpy as np
import xgboost as xgb
import os

np.random.seed(42)
n = 5000
X = np.column_stack([
    np.random.uniform(0, 45, n),
    np.random.uniform(1, 15, n),
    np.random.uniform(2000, 20000, n),
    np.random.uniform(20, 110, n),
    np.random.binomial(1, 0.15, n),
    np.random.binomial(1, 0.08, n),
    np.random.binomial(1, 0.10, n),
    np.random.uniform(0, 9, n),
    np.random.randint(0, 6, n),
    np.random.randint(0, 6, n),
    np.random.randint(0, 6, n),
    np.random.uniform(0, 1, n),
    np.random.uniform(0, 1, n),
    np.random.randint(0, 120, n),
    np.random.uniform(0, 0.0001, n),
])
y = (
    (X[:,0] > 33) | (X[:,1] < 4) | (X[:,2] < 6000) |
    (X[:,4] == 1) | (X[:,5] == 1) | (X[:,6] == 1) |
    (X[:,7] >= 7) | (X[:,10] >= 3) | (X[:,14] > 1e-5)
).astype(int)
print(f'Samples: {n}, NO-GO: {y.sum()}, GO: {(y==0).sum()}')
model = xgb.XGBClassifier(n_estimators=100, max_depth=4, random_state=42)
model.fit(X, y)
os.makedirs('data', exist_ok=True)
model.save_model('data/model.json')
print('Model saved to data/model.json')
