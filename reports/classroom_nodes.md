# Classroom GLB Scene Structure & Node Inspection Report

**Asset Path:** `assets/classroom.glb`  
**File Size:** 8,536,288 bytes (~8.14 MB)  
**glTF Specification:** glTF 2.0 Binary (GLB)  
**Header:** Magic `0x46546C67` (`glTF`), Version `2`, Total Length `8,536,288`  
**Chunks:**
- **JSON Chunk:** Length `104,236` bytes (Type `0x4E4F534A`)
- **BIN Chunk:** Length `8,432,024` bytes (Type `0x4E4942`)
- **Total Nodes:** 176  
- **Total Meshes:** 66  
- **Total Materials:** 23  
- **Full Structure Data:** [`reports/classroom_glb_structure.json`](file:///d:/2011%20Th%E1%BA%A7y%20Nam/reports/classroom_glb_structure.json)

---

## 1. Key Entities Identification

### 1.1 Chalkboard / Blackboard
The main writing surface facing the classroom:

- **Hierarchy:**
  - Node 20: `Collection` (Parent translation: `[-31.24, 78.39, 502.52]`)
  - Node 21: `Collection|board_L_board.blend|Dupli|`
  - Node 22: `Collection|board_L_board.blend|Dupli|_board_0` *(Mesh holder)*
- **Node Name:** `Collection|board_L_board.blend|Dupli|_board_0`
- **Mesh Name:** `Collection|board_L_board.blend|Dupli|_board_0` (Mesh Index: `8`)
- **Material:** `board` (Material Index: `5`, dark green slate blackboard)
- **Geometry Stats:** 1 Primitive, 658 vertices (`POSITION`, `NORMAL`, `TEXCOORD_0`, `TEXCOORD_1`)
- **Local Accessor Bounding Box:**
  - Min: `[-2.176, 0.000, 0.000]`
  - Max: `[3.840, 0.230, 1.681]`
- **World Bounding Box Extents:**
  - **Min (XYZ):** `[-248.86, 78.39, 479.55]`
  - **Max (XYZ):** `[352.73, 246.51, 502.52]`
  - **Center (XYZ):** `[51.94, 162.45, 491.04]`
  - **Size / Dimensions:** Width `601.59`, Height `168.12`, Depth `22.97`
- **Orientation & Surface Normal:**
  - Mounted directly on the front wall at $+Z \approx 501.7$.
  - Front writing plane is at $Z \approx 479.55$, facing towards $-Z$ (into the classroom towards the student seats).
  - Bottom ledge is at $Y = 78.39$, top edge at $Y = 246.51$.

---

### 1.2 Teacher's Podium / Desk
The wooden teacher's desk positioned in front of the chalkboard:

- **Hierarchy:**
  - Node 26: `teacherDesk.001` (Translation: `[2.44, -0.38, 343.40]`)
  - Node 27: `teacherDesk.001|teacherDesk_L_teacherDesk.blend|Dupli|`
  - Node 28: `teacherDesk.001|teacherDesk_L_teacherDesk.blend|Dupli|_teacherDesk_0` *(Mesh holder)*
- **Node Name:** `teacherDesk.001|teacherDesk_L_teacherDesk.blend|Dupli|_teacherDesk_0`
- **Mesh Name:** `teacherDesk.001|teacherDesk_L_teacherDesk.blend|Dupli|_teacherDesk_0` (Mesh Index: `10`)
- **Material:** `teacherDesk` (Material Index: `7`, rich dark wood finish)
- **Geometry Stats:** 1 Primitive, 370 vertices
- **World Bounding Box Extents:**
  - **Min (XYZ):** `[-85.83, -0.38, 290.32]`
  - **Max (XYZ):** `[90.71, 78.60, 396.47]`
  - **Center (XYZ):** `[2.44, 39.11, 343.40]`
  - **Size / Dimensions:** Width `176.54`, Height `78.98`, Depth `106.15`
- **Spatial Relationship to Blackboard:**
  - Desk top surface is at $Y = 78.60$, precisely flush with the chalkboard bottom ledge ($Y = 78.39$).
  - Desk center $X = 2.44$ is shifted to the left ($-X$) of the chalkboard center ($X = 51.94$).
  - Desk $Z = [290.32, 396.47]$ is positioned approximately 83–190 units in front of the chalkboard surface ($Z = 479.55$).

---

### 1.3 Classroom Wall Clock
- **Node Name:** `clock.001|clock_L_clock.blend|Dupli|_clock_0` (Node Index: `25`)
- **Mesh Name:** `clock.001|clock_L_clock.blend|Dupli|_clock_0` (Mesh Index: `9`)
- **Material:** `clock` (Material Index: `6`)
- **World Center:** `[-31.24, 277.22, 499.82]`
- **World Size:** Width `45.50`, Height `45.50`, Depth `3.40`
- Mounted directly above the chalkboard center-left, ideal for nostalgic classroom framing.

---

### 1.4 Windows & Volumetric Godrays
Natural afternoon lighting sources on the $+X$ wall:

- **Windows:**
  - `Window.002` (Node 31–39): Centered at `X = 391.5, Y = 204.5, Z = -239.3`
  - `Window.003` (Node 42–50): Centered at `X = 391.5, Y = 204.5, Z = +237.3`
  - Materials: `PlasticGrey`, `glass`, `WindowWoodPlate`, `Rideau`
- **Volumetric Godrays (Meshes 37–40, Material `godray`):**
  - Node 97 (`Cube.001_godray_0`): Center `[167.9, 152.3, -129.8]`, Size `[453.1, 294.6, 193.9]`
  - Node 99 (`Cube.002_godray_0`): Center `[167.9, 152.3, +143.8]`, Size `[453.1, 294.6, 193.9]`
  - Node 101 (`Cube.003_godray_0`): Center `[167.9, 152.3, -348.2]`, Size `[453.1, 294.6, 193.9]`
  - Node 103 (`Cube.004_godray_0`): Center `[167.9, 152.3, +352.0]`, Size `[453.1, 294.6, 193.9]`
- The godray meshes slant downward and diagonally from the windows ($+X \approx 390$) across the classroom towards the chalkboard and desks.

---

### 1.5 Classroom Boundaries (Room Dimensions)
- **Ground Floor:** Node 4 (`ground_ground_0`)
  - Width ($X$): `804.00` (Span: `[-402.0, +402.0]`)
  - Height ($Y$): `0.00`
  - Depth ($Z$): `1003.40` (Span: `[-501.7, +501.7]`)
- **Ceiling:** Node 14 (`ceilling_ceilling_0`) at $Y = 340.00$
- **Front Wall (+Z):** $Z = +501.70$ (holds the chalkboard and clock)
- **Back Wall (-Z):** $Z = -501.70$ (holds student lockers `casiers_low` and `GrandCasier`)
- **Right Wall (+X):** $X = +402.00$ (holds the windows and curtains)
- **Left Wall (-X):** $X = -402.00$ (holds the hallway door `Door.001` and coat racks `porteManteau`)

---

## 2. Classroom Top-Down Spatial Map

```text
                        FRONT WALL (Z = +501.7)
        ============================================================
        [ Door ]             [  CHALKBOARD  ]              [ Clock ]
        X = -402             X = -249 .. +353               Y = 277
                               [TEACHER DESK]
                             X = -86 .. +91, Z = 343
        ------------------------------------------------------------
        [ Coat ]                                           [ Window ]
        [ Racks]       [Col 4]    [Col 3]    [Col 2]    [Col 1]  X = +392
        X = -396       X = -266   X = -85    X = +111   X = +278 (Godrays)
                       ---------------------------------
        HALLWAY        Row 1: Z = +192  (Front Seats)          SUNLIGHT
        SIDE           Row 2: Z = +55                          ANGLES
        (-X)           Row 3: Z = -81                          DOWN
                       Row 4: Z = -218                         FROM +X
                       Row 5: Z = -355  (Back Seats)
        ------------------------------------------------------------
        [ Door ]       [    STUDENT DESKS (Cube_Desk_0)   ]
        Z = -400       [       LOCKERS (casiers_low)      ]
        ============================================================
                         BACK WALL (Z = -501.7)
```

---

## 3. Camera Setup Recommendations

### Recommendation A: Cinematic Autumn Aisle View (Primary / Recommended)
This camera placement delivers the nostalgic autumn afternoon composition: the blackboard occupies the visual center, the teacher's desk anchors the lower-left corner, and warm volumetric sunlight streams in from the windows on the right.

```javascript
// Recommended Three.js Camera Configuration
const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 1, 2000);
camera.position.set(-220.0, 145.0, 120.0);
camera.lookAt(45.0, 155.0, 485.0);
```

#### Screen Projection Verification (Normalized Screen Coordinates 0%–100%):
- **Blackboard Center:** Screen `(48.9%, 48.3%)` *(Centered horizontally & vertically)*
- **Blackboard Frame:** Screen `X = [26.8% to 99.6%]`, `Y = [14.6% to 77.3%]`
- **Teacher Desk Center:** Screen `(40.9%, 87.4%)` *(Anchored at Bottom-Left)*
- **Teacher Desk Frame:** Screen `X = [22.5% to 60.4%]`, `Y = [69.1% to 100%+]`
- **Classroom Clock:** Screen `(59.6%, 20.1%)` *(Visible above blackboard)*

---

### Recommendation B: Frontal Centered Lecture View (Alternative)
For an orthogonal frontal view from student row 2-3 center seat:

```javascript
const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 1, 2000);
camera.position.set(52.0, 160.0, 40.0);
camera.lookAt(52.0, 155.0, 485.0);
```

#### Screen Projection:
- **Blackboard Center:** Screen `(50.0%, 48.0%)`
- **Blackboard Frame:** Screen `X = [4.7% to 95.3%]`, `Y = [24.2% to 69.2%]`
- **Teacher Desk Center:** Screen `(61.1%, 96.9%)` (bottom edge)

---

## 4. Three.js GLTFLoader Code Reference

```javascript
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
loader.load('assets/classroom.glb', (gltf) => {
  const scene = gltf.scene;

  // 1. Locate Blackboard
  const boardNode = scene.getObjectByName('Collection|board_L_board.blend|Dupli|_board_0');
  console.log('Found blackboard:', boardNode);

  // 2. Locate Teacher Desk
  const deskNode = scene.getObjectByName('teacherDesk.001|teacherDesk_L_teacherDesk.blend|Dupli|_teacherDesk_0');
  console.log('Found teacher desk:', deskNode);

  // 3. Locate Clock
  const clockNode = scene.getObjectByName('clock.001|clock_L_clock.blend|Dupli|_clock_0');
  console.log('Found clock:', clockNode);

  // 4. Configure Camera (Recommended Setup A)
  camera.position.set(-220.0, 145.0, 120.0);
  camera.lookAt(45.0, 155.0, 485.0);
});
```

---

## 5. Summary Table of Key Nodes

| Item | Node Index | Node / Mesh Name | Material | World Center (X, Y, Z) | World Size (W, H, D) |
|---|:---:|---|---|:---:|:---:|
| **Blackboard** | **22** | `Collection\|board_L_board.blend\|Dupli\|_board_0` | `board` (mat 5) | `[51.94, 162.45, 491.04]` | `[601.59, 168.12, 22.97]` |
| **Teacher Desk** | **28** | `teacherDesk.001\|teacherDesk_L_teacherDesk.blend\|Dupli\|_teacherDesk_0` | `teacherDesk` (mat 7) | `[2.44, 39.11, 343.40]` | `[176.54, 78.98, 106.15]` |
| **Wall Clock** | **25** | `clock.001\|clock_L_clock.blend\|Dupli\|_clock_0` | `clock` (mat 6) | `[-31.24, 277.22, 499.82]` | `[45.50, 45.50, 3.40]` |
| **Window Front** | **42** | `Window.003\|Wall_L_Window.blend\|Dupli\|_wallConcrete_0` | `wallConcrete_0` | `[391.46, 204.46, 237.28]` | `[20.28, 205.08, 16.00]` |
| **Window Back** | **31** | `Window.002\|Wall_L_Window.blend\|Dupli\|_wallConcrete_0` | `wallConcrete_0` | `[391.46, 204.46, -239.34]` | `[20.28, 205.08, 16.00]` |
| **Godray Front** | **103** | `Cube.004_godray_0` | `godray` (mat 18) | `[167.92, 152.32, 352.01]` | `[453.13, 294.63, 193.94]` |
| **Student Desks**| **19** | `Cube_Desk_0` | `Desk` (mat 4) | `[11.02, 39.50, -61.47]` | `[661.73, 79.00, 617.43]` |
| **Ground Floor** | **4** | `ground_ground_0` | `ground` (mat 0) | `[0.00, 0.00, 0.00]` | `[804.00, 0.00, 1003.40]` |
| **Ceiling** | **14** | `ceilling_ceilling_0` | `ceilling` (mat 2) | `[0.00, 340.00, 0.00]` | `[804.00, 0.00, 1003.40]` |
