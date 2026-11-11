"""
train_classifier.py
Offline training and validation script for Seismic vs Disturbance vs Ambient classifier.
Uses numpy to evaluate decision boundaries, confusion matrix, precision/recall on the dataset.
"""

import json
import os
import numpy as np

def load_data(filepath):
    with open(filepath, 'r') as f:
        data = json.load(f)
    return data

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    dataset_path = os.path.join(script_dir, '../data/training_dataset.json')

    if not os.path.exists(dataset_path):
        print(f"Error: {dataset_path} does not exist. Run record_training_data.js first.")
        return

    data = load_data(dataset_path)
    print(f"Loaded {len(data)} training samples.")

    # Class distribution
    labels = [d['label'] for d in data]
    unique, counts = np.unique(labels, return_counts=True)
    class_map = {0: 'AMBIENT (0)', 1: 'DISTURBANCE (1)', 2: 'SEISMIC_TREMOR (2)'}
    for u, c in zip(unique, counts):
        print(f"  Class {class_map.get(u, u)}: {c} samples ({c / len(data) * 100:.1f}%)")

    # Evaluate physics-informed ensemble decision forest
    # Rules:
    # 1. Seismic requires continuous oscillatory energy (RMS >= 0.08, or high dynamic peak with sustained SW420 and low crest factor)
    # 2. Disturbance has high crest factor (sharp isolated spike), low continuous energy (RMS < 0.08), or isolated trigger
    # 3. Ambient has low RMS (< 0.04) and low peak dynamic (< 0.08)

    y_true = np.array(labels)
    y_pred = []

    for d in data:
        f = d['features']
        pga1 = f['peakDynamic_1']
        rms1 = f['rms_1']
        crest1 = f['crestFactor_1']
        sw1 = f['swActiveFraction_1']
        seismic_ratio = f['spectralEnergyRatio_1']
        
        # Scoring function based on empirical physics boundaries:
        # Seismic requires high continuous vibration energy (RMS >= 0.05), high dynamic peak (PGA >= 0.20),
        # low crest factor (< 5.0 indicating sustained oscillation, not single impulse knock).
        seismic_score = 0.0
        disturbance_score = 0.0
        ambient_score = 0.0

        if rms1 >= 0.05 and pga1 >= 0.20:
            seismic_score += 5.0
            if rms1 >= 0.15:
                seismic_score += 3.0
            if crest1 < 5.0:
                seismic_score += 2.0
            if sw1 > 0.05:
                seismic_score += 2.0
            if seismic_ratio >= 0.30:
                seismic_score += 1.5

        if sw1 > 0 and rms1 < 0.05: # SW420 clicked from knock/table bump, but continuous RMS is tiny
            disturbance_score += 6.0
        if crest1 >= 5.0 and rms1 < 0.05: # High crest factor = sharp isolated transient impulse
            disturbance_score += 5.0
        if pga1 >= 0.12 and rms1 < 0.05:
            disturbance_score += 3.0

        if rms1 < 0.008 and sw1 == 0:
            ambient_score += 7.0
        elif rms1 < 0.02 and pga1 < 0.12 and sw1 == 0:
            ambient_score += 5.0

        scores = [ambient_score, disturbance_score, seismic_score]
        pred = int(np.argmax(scores))
        y_pred.append(pred)

    y_pred = np.array(y_pred)

    # Compute Confusion Matrix
    num_classes = 3
    conf_matrix = np.zeros((num_classes, num_classes), dtype=int)
    for t, p in zip(y_true, y_pred):
        conf_matrix[t, p] += 1

    print("\n=== CONFUSION MATRIX ===")
    print("Pred ->      Ambient(0)  Disturbance(1)  Seismic(2)")
    row_labels = ["True Ambient(0):    ", "True Disturbance(1):", "True Seismic(2):    "]
    for i in range(num_classes):
        print(f"{row_labels[i]} {conf_matrix[i, 0]:10d} {conf_matrix[i, 1]:15d} {conf_matrix[i, 2]:11d}")

    # Compute Accuracy & Per-Class Precision / Recall
    accuracy = np.mean(y_true == y_pred) * 100
    print(f"\nOverall Model Accuracy: {accuracy:.2f}%")

    for i, name in enumerate(['Ambient', 'Disturbance', 'Seismic']):
        tp = conf_matrix[i, i]
        fp = np.sum(conf_matrix[:, i]) - tp
        fn = np.sum(conf_matrix[i, :]) - tp
        prec = tp / (tp + fp) if (tp + fp) > 0 else 0
        rec = tp / (tp + fn) if (tp + fn) > 0 else 0
        f1 = 2 * (prec * rec) / (prec + rec) if (prec + rec) > 0 else 0
        print(f"  {name:12s} - Precision: {prec*100:5.1f}% | Recall: {rec*100:5.1f}% | F1: {f1*100:5.1f}%")

    print("\nCalibration Complete: Ready for real-time Node.js inference engine integration.")

if __name__ == '__main__':
    main()
