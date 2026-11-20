// Standard Three.js Matrix4 & Camera projection simulation
// Three.js: PerspectiveCamera.lookAt, project() to NDC [-1, 1]

class Vector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x; this.y = y; this.z = z;
  }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  clone() { return new Vector3(this.x, this.y, this.z); }
  sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
  add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
  multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this; }
  dot(v) { return this.x * v.x + this.y * v.y + this.z * v.z; }
  cross(v) {
    const x = this.y * v.z - this.z * v.y;
    const y = this.z * v.x - this.x * v.z;
    const z = this.x * v.y - this.y * v.x;
    this.x = x; this.y = y; this.z = z;
    return this;
  }
  length() { return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z); }
  normalize() {
    const l = this.length();
    if (l > 0) this.multiplyScalar(1 / l);
    return this;
  }
}

class Matrix4 {
  constructor() {
    this.elements = [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ];
  }
  lookAt(eye, target, up) {
    const te = this.elements;
    const z = eye.clone().sub(target).normalize(); // Three.js camera looks down -Z
    if (z.length() === 0) z.z = 1;
    const x = up.clone().cross(z).normalize();
    if (x.length() === 0) {
      z.x += 0.0001;
      x.cross(z).normalize();
    }
    const y = z.clone().cross(x);

    te[0] = x.x; te[4] = y.x; te[8] = z.x; te[12] = eye.x;
    te[1] = x.y; te[5] = y.y; te[9] = z.y; te[13] = eye.y;
    te[2] = x.z; te[6] = y.z; te[10] = z.z; te[14] = eye.z;
    te[3] = 0;   te[7] = 0;   te[11] = 0;   te[15] = 1;
    return this;
  }
  invert() {
    const te = this.elements;
    const n11 = te[0], n21 = te[1], n31 = te[2], n41 = te[3];
    const n12 = te[4], n22 = te[5], n32 = te[6], n42 = te[7];
    const n13 = te[8], n23 = te[9], n33 = te[10], n43 = te[11];
    const n14 = te[12], n24 = te[13], n34 = te[14], n44 = te[15];

    const t11 = n23 * n34 * n42 - n24 * n33 * n42 + n24 * n32 * n43 - n22 * n34 * n43 - n23 * n32 * n44 + n22 * n33 * n44;
    const t12 = n14 * n33 * n42 - n13 * n34 * n42 - n14 * n32 * n43 + n12 * n34 * n43 + n13 * n32 * n44 - n12 * n33 * n44;
    const t13 = n13 * n24 * n42 - n14 * n23 * n42 + n14 * n22 * n43 - n12 * n24 * n43 - n13 * n22 * n44 + n12 * n23 * n44;
    const t14 = n14 * n23 * n32 - n13 * n24 * n32 - n14 * n22 * n33 + n12 * n24 * n33 + n13 * n22 * n34 - n12 * n23 * n34;

    const det = n11 * t11 + n21 * t12 + n31 * t13 + n41 * t14;
    if (det === 0) return this;
    const idet = 1 / det;

    te[0] = t11 * idet;
    te[1] = (n24 * n33 * n41 - n23 * n34 * n41 - n24 * n31 * n43 + n21 * n34 * n43 + n23 * n31 * n44 - n21 * n33 * n44) * idet;
    te[2] = (n22 * n34 * n41 - n24 * n32 * n41 + n24 * n31 * n42 - n21 * n34 * n42 - n22 * n31 * n44 + n21 * n32 * n44) * idet;
    te[3] = (n23 * n32 * n41 - n22 * n33 * n41 - n23 * n31 * n42 + n21 * n33 * n42 + n22 * n31 * n43 - n21 * n32 * n43) * idet;

    te[4] = t12 * idet;
    te[5] = (n13 * n34 * n41 - n14 * n33 * n41 + n14 * n31 * n43 - n11 * n34 * n43 - n13 * n31 * n44 + n11 * n33 * n44) * idet;
    te[6] = (n14 * n32 * n41 - n12 * n34 * n41 - n14 * n31 * n42 + n11 * n34 * n42 + n12 * n31 * n44 - n11 * n32 * n44) * idet;
    te[7] = (n12 * n33 * n41 - n13 * n32 * n41 + n13 * n31 * n42 - n11 * n33 * n42 - n12 * n31 * n43 + n11 * n32 * n43) * idet;

    te[8] = t13 * idet;
    te[9] = (n14 * n23 * n41 - n13 * n24 * n41 - n14 * n21 * n43 + n11 * n24 * n43 + n13 * n21 * n44 - n11 * n23 * n44) * idet;
    te[10] = (n12 * n24 * n41 - n14 * n22 * n41 + n14 * n21 * n42 - n11 * n24 * n42 - n12 * n21 * n44 + n11 * n22 * n44) * idet;
    te[11] = (n13 * n22 * n41 - n12 * n23 * n41 - n13 * n21 * n42 + n11 * n23 * n42 + n12 * n21 * n43 - n11 * n22 * n43) * idet;

    te[12] = t14 * idet;
    te[13] = (n13 * n24 * n31 - n14 * n23 * n31 + n14 * n21 * n33 - n11 * n24 * n33 - n13 * n21 * n34 + n11 * n23 * n34) * idet;
    te[14] = (n14 * n22 * n31 - n12 * n24 * n31 - n14 * n21 * n32 + n11 * n24 * n32 + n12 * n21 * n34 - n11 * n22 * n34) * idet;
    te[15] = (n12 * n23 * n31 - n13 * n22 * n31 + n13 * n21 * n32 - n11 * n23 * n32 - n12 * n21 * n33 + n11 * n22 * n33) * idet;
    return this;
  }
  perspective(fovYDeg, aspect, near, far) {
    const te = this.elements;
    const top = near * Math.tan((fovYDeg * Math.PI / 180) / 2);
    const bottom = -top;
    const right = top * aspect;
    const left = -right;

    const x = 2 * near / (right - left);
    const y = 2 * near / (top - bottom);
    const a = (right + left) / (right - left);
    const b = (top + bottom) / (top - bottom);
    const c = -(far + near) / (far - near);
    const d = -2 * far * near / (far - near);

    te[0] = x;  te[4] = 0;  te[8] = a;   te[12] = 0;
    te[1] = 0;  te[5] = y;  te[9] = b;   te[13] = 0;
    te[2] = 0;  te[6] = 0;  te[10] = c;  te[14] = d;
    te[3] = 0;  te[7] = 0;  te[11] = -1; te[15] = 0;
    return this;
  }
  multiply(m) {
    const ae = this.elements;
    const be = m.elements;
    const out = new Array(16);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        out[i + j*4] = 
          ae[i]*be[j*4] + 
          ae[i+4]*be[1+j*4] + 
          ae[i+8]*be[2+j*4] + 
          ae[i+12]*be[3+j*4];
      }
    }
    this.elements = out;
    return this;
  }
}

function projectToNDC(p, camPos, lookAt, up, fovY, aspect, near = 1, far = 2000) {
  const eye = new Vector3(...camPos);
  const target = new Vector3(...lookAt);
  const upVec = new Vector3(...up);

  const viewMat = new Matrix4().lookAt(eye, target, upVec).invert();
  const projMat = new Matrix4().perspective(fovY, aspect, near, far);
  
  // v = projMat * viewMat * p
  const pv = [p[0], p[1], p[2], 1];
  const vm = viewMat.elements;
  const pm = projMat.elements;

  // view space
  const vx = vm[0]*pv[0] + vm[4]*pv[1] + vm[8]*pv[2] + vm[12]*pv[3];
  const vy = vm[1]*pv[0] + vm[5]*pv[1] + vm[9]*pv[2] + vm[13]*pv[3];
  const vz = vm[2]*pv[0] + vm[6]*pv[1] + vm[10]*pv[2] + vm[14]*pv[3];
  const vw = vm[3]*pv[0] + vm[7]*pv[1] + vm[11]*pv[2] + vm[15]*pv[3];

  // clip space
  const cx = pm[0]*vx + pm[4]*vy + pm[8]*vz + pm[12]*vw;
  const cy = pm[1]*vx + pm[5]*vy + pm[9]*vz + pm[13]*vw;
  const cz = pm[2]*vx + pm[6]*vy + pm[10]*vz + pm[14]*vw;
  const cw = pm[3]*vx + pm[7]*vy + pm[11]*vz + pm[15]*vw;

  if (cw <= 0) return { inFront: false };

  const ndcX = cx / cw;
  const ndcY = cy / cw;
  const ndcZ = cz / cw;

  // Convert NDC [-1, 1] to screen % [0, 1] (0% = top-left, 100% = bottom-right)
  const screenPctX = (ndcX + 1) / 2;
  const screenPctY = (1 - ndcY) / 2; // in screen coordinates, Y increases downward!

  return { inFront: true, ndcX, ndcY, ndcZ, screenPctX, screenPctY };
}

// Bounding boxes
const boardCenter = [51.94, 162.45, 485.0];
const deskCenter = [2.44, 39.11, 343.40];

const deskCorners = [
  [-85.83, 78.60, 290.32],
  [90.71, 78.60, 290.32],
  [-85.83, -0.38, 290.32],
  [90.71, -0.38, 290.32],
  [-85.83, 78.60, 396.47],
  [90.71, 78.60, 396.47],
  [-85.83, -0.38, 396.47],
  [90.71, -0.38, 396.47],
];

const boardCorners = [
  [-248.86, 78.39, 480.0],
  [352.73, 78.39, 480.0],
  [-248.86, 246.51, 480.0],
  [352.73, 246.51, 480.0],
];

const candidates = [
  {
    name: 'Setup 1: Straight-on Cinematic View (Slightly to right of desk, looking at board center)',
    camPos: [52.0, 150.0, 40.0],
    lookAt: [52.0, 150.0, 490.0],
    fov: 46
  },
  {
    name: 'Setup 2: Golden Warm Autumn Angle (Cam shifted right towards window godrays, looking at board center)',
    camPos: [110.0, 155.0, 50.0],
    lookAt: [45.0, 150.0, 490.0],
    fov: 48
  },
  {
    name: 'Setup 3: Slightly Elevated Front-Row View',
    camPos: [65.0, 160.0, 30.0],
    lookAt: [52.0, 155.0, 490.0],
    fov: 46
  },
  {
    name: 'Setup 4: Close Focus on Blackboard with Desk as Anchor at Bottom-Left',
    camPos: [80.0, 150.0, 80.0],
    lookAt: [52.0, 155.0, 490.0],
    fov: 52
  }
];

candidates.forEach(c => {
  console.log(`\n--------------------------------------------------`);
  console.log(c.name);
  console.log(`Cam Position: [${c.camPos.join(', ')}]`);
  console.log(`LookAt Target: [${c.lookAt.join(', ')}]`);
  console.log(`FOV: ${c.fov}°`);

  const pB = projectToNDC(boardCenter, c.camPos, c.lookAt, [0, 1, 0], c.fov, 16/9);
  console.log(`Board Center: NDC (${pB.ndcX.toFixed(2)}, ${pB.ndcY.toFixed(2)}), Screen: (${(pB.screenPctX*100).toFixed(1)}%, ${(pB.screenPctY*100).toFixed(1)}%)`);

  const bPts = boardCorners.map(p => projectToNDC(p, c.camPos, c.lookAt, [0, 1, 0], c.fov, 16/9));
  const bMinX = Math.min(...bPts.map(p => p.screenPctX));
  const bMaxX = Math.max(...bPts.map(p => p.screenPctX));
  const bMinY = Math.min(...bPts.map(p => p.screenPctY));
  const bMaxY = Math.max(...bPts.map(p => p.screenPctY));
  console.log(`Board Screen Bounding Box: X=[${(bMinX*100).toFixed(1)}% to ${(bMaxX*100).toFixed(1)}%], Y=[${(bMinY*100).toFixed(1)}% to ${(bMaxY*100).toFixed(1)}%]`);

  const pD = projectToNDC(deskCenter, c.camPos, c.lookAt, [0, 1, 0], c.fov, 16/9);
  console.log(`Desk Center:  NDC (${pD.ndcX.toFixed(2)}, ${pD.ndcY.toFixed(2)}), Screen: (${(pD.screenPctX*100).toFixed(1)}%, ${(pD.screenPctY*100).toFixed(1)}%)`);

  const dPts = deskCorners.map(p => projectToNDC(p, c.camPos, c.lookAt, [0, 1, 0], c.fov, 16/9));
  const dMinX = Math.min(...dPts.map(p => p.screenPctX));
  const dMaxX = Math.max(...dPts.map(p => p.screenPctX));
  const dMinY = Math.min(...dPts.map(p => p.screenPctY));
  const dMaxY = Math.max(...dPts.map(p => p.screenPctY));
  console.log(`Desk Screen Bounding Box:  X=[${(dMinX*100).toFixed(1)}% to ${(dMaxX*100).toFixed(1)}%], Y=[${(dMinY*100).toFixed(1)}% to ${(dMaxY*100).toFixed(1)}%]`);
});

