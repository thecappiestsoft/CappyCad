"""
Generuje src/data/capy-outline.json — dane płaskiej kapibary z logo CappyCad:
  pts   — obrys (wielokąt) w milimetrach, szerokość 60 mm,
  mesh  — odcinki ażurowej siatki trójkątów z logo (turkusowe linie i węzły),
  ear, eye, nose, mouth — elementy twarzy (grawerowane).

Wejście: obraz logo (PNG) w oryginalnej kolorystyce: brązowa kapibara, turkusowa siatka na ciemnym tle.
Wymagania: Python 3, opencv-python, numpy
  pip install opencv-python numpy

  python tools/capybara/trace-capybara.py logo.png src/data/capy-outline.json

Uwaga: współrzędne ucha, oka, nosa i pyszczka (FEATURES) zostały odczytane z logo 1932 px
i są skalowane do rozdzielczości obrazu wejściowego.
"""
import itertools
import json
import sys

import cv2
import numpy as np

WIDTH_MM = 60.0
FEATURES_REF = 1932  # rozdzielczość, w której odczytano punkty poniżej
FEATURES = {
    "ear": (1218, 652, 40, 56),  # środek x, y, szerokość, wysokość (elipsa)
    "eye": [(1318, 790), (1340, 805), (1362, 810), (1385, 804), (1408, 790)],
    "nose": [(1562, 776), (1580, 767), (1602, 786)],
    "mouth": [(1532, 1015), (1565, 1026), (1600, 1013)],
}


def masks(img):
    b, g, r = [img[..., i].astype(int) for i in range(3)]
    brown = (r > 90) & (r > g + 15) & (g > b + 5)
    cyan = (b > 150) & (g > 150) & (r < 120)
    return brown, cyan


def silhouette(brown, cyan):
    """Obrys całej kapibary: brązowe ciało + turkusowa siatka, wygładzony."""
    mask = ((brown | cyan) * 255).astype(np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (41, 41)))
    cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    filled = np.zeros_like(mask)
    cv2.drawContours(filled, [max(cnts, key=cv2.contourArea)], -1, 255, -1)
    # otwarcie usuwa „wypustki” po okrągłych węzłach siatki na brzegu
    filled = cv2.morphologyEx(filled, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (35, 35)))
    cnts, _ = cv2.findContours(filled, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    return max(cnts, key=cv2.contourArea)


def lattice(cyan):
    """Węzły (kropki) i krawędzie (linie) turkusowej siatki."""
    cyan8 = cyan.astype(np.uint8) * 255
    dots = cv2.erode(cyan8, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13)))  # linie znikają, kropki zostają
    n, _, stats, cent = cv2.connectedComponentsWithStats(dots)
    nodes = [tuple(c) for i, c in enumerate(cent[1:], 1) if stats[i, cv2.CC_STAT_AREA] > 15]

    def covered(i, j):  # czy odcinek między węzłami biegnie po turkusowej linii
        (x1, y1), (x2, y2) = nodes[i], nodes[j]
        ts = np.linspace(0.1, 0.9, 40)
        xs = (x1 + (x2 - x1) * ts).astype(int)
        ys = (y1 + (y2 - y1) * ts).astype(int)
        return cyan8[ys, xs].mean() / 255 > 0.95

    def passes_node(i, j):  # odrzuca dłuższe odcinki biegnące przez inny węzeł
        (x1, y1), (x2, y2) = nodes[i], nodes[j]
        for k, (x, y) in enumerate(nodes):
            if k in (i, j):
                continue
            t = ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / ((x2 - x1) ** 2 + (y2 - y1) ** 2)
            dist = abs((x2 - x1) * (y1 - y) - (x1 - x) * (y2 - y1)) / np.hypot(x2 - x1, y2 - y1)
            if 0.05 < t < 0.95 and dist < 8:
                return True
        return False

    edges = []
    for i, j in itertools.combinations(range(len(nodes)), 2):
        d = np.hypot(nodes[j][0] - nodes[i][0], nodes[j][1] - nodes[i][1])
        if 40 <= d <= 600 and covered(i, j) and not passes_node(i, j):
            edges.append((i, j))
    return nodes, edges


def main(src, dst):
    img = cv2.imread(src)
    brown, cyan = masks(img)
    contour = silhouette(brown, cyan)
    x0, y0, w, h = cv2.boundingRect(contour)
    s = WIDTH_MM / w
    mm = lambda x, y: [round((x - x0) * s, 2), round((y0 + h - y) * s, 2)]  # oś Y w górę
    k = img.shape[1] / FEATURES_REF

    outline = cv2.approxPolyDP(contour, 6.0, True)[:, 0, :]
    nodes, edges = lattice(cyan)
    ex, ey, ew, eh = FEATURES["ear"]
    data = {
        "pts": [mm(x, y) for x, y in outline],
        "mesh": [mm(*nodes[i]) + mm(*nodes[j]) for i, j in edges],
        "ear": mm(ex * k, ey * k) + [round(ew * k * s, 2), round(eh * k * s, 2)],
        **{name: [mm(x * k, y * k) for x, y in FEATURES[name]] for name in ("eye", "nose", "mouth")},
    }
    with open(dst, "w") as f:
        json.dump(data, f)
    print(f"Obrys: {len(data['pts'])} punktów, siatka: {len(edges)} odcinków, wymiary {w * s:.1f} × {h * s:.1f} mm -> {dst}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
