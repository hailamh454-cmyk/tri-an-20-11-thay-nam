// Test camera projection
function vec3Sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function vec3Normalize(a) {
  const len = Math.sqrt(a[0]*a[0] + a[1]*a[1] + a[2]*a[2]);
  return [a[0]/len, a[1]/len, a[2]/len];
}

function vec3Cross(a, b) {
  return [
    a[1]*b[2] - a[2]*b[1],
    a[2]*b[0] - a[0]*b[2],
    a[0]*b[1] - a[1]*b[0]
  ];
}

function vec3Dot(a, b) {
  return a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
}

function projectPoint(camPos, lookAt, up, fovYDeg, aspect, p) {
  // View matrix
  const f = vec3Normalize(vec3Sub(lookAt, camPos));
  const s = vec3Normalize(vec3Cross(f, up));
  const u = vec3Cross(s, f);

  // Translate point relative to camPos
  const pRel = vec3Sub(p, camPos);
  
  // View space coordinates
  const vx = vec3Dot(pRel, s);
  const vy = vec3Dot(pRel, u);
  const vz = vec3Dot(pRel, f); // forward is +z in this convention

  if (vz <= 0) return { inFront: false };

  // Perspective projection
  const tanHalfFov = Math.tan((fovYDeg * Math.PI / 180) / 2);
  const screenY = vy / (vz * tanHalfFov);
  const screenX = vx / (vz * tanHalfFov * aspect);

  return { inFront: true, x: screenX, y: screenY, z: vz };
}

// Let's test different camera positions
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

console.log('Testing Camera Positions:');
// Aspect ratio 16:9
const aspect = 16 / 9;
const fovY = 50;

const testCamPositions = [
  { name: 'Cam A (Center-Back)', pos: [51.94, 160.0, 50.0], lookAt: [51.94, 150.0, 485.0] },
  { name: 'Cam B (Slightly right, elevated)', pos: [85.0, 175.0, 40.0], lookAt: [51.94, 150.0, 485.0] },
  { name: 'Cam C (Student perspective row 2 right)', pos: [110.0, 165.0, 70.0], lookAt: [50.0, 155.0, 485.0] },
  { name: 'Cam D (Closer wide view)', pos: [70.0, 160.0, 120.0], lookAt: [51.94, 150.0, 485.0] },
  { name: 'Cam E (Autumn Godray viewpoint - right side by window)', pos: [140.0, 170.0, 60.0], lookAt: [45.0, 155.0, 485.0] },
];

testCamPositions.forEach(c => {
  console.log(`\n=== ${c.name} ===`);
  console.log('Cam Pos:', c.pos, 'LookAt:', c.lookAt);
  const pBoard = projectPoint(c.pos, c.lookAt, [0, 1, 0], fovY, aspect, boardCenter);
  console.log(`Board Center projected: x=${pBoard.x.toFixed(3)}, y=${pBoard.y.toFixed(3)} (0,0 is center, [-1,1] screen)`);
  
  const bProjs = boardCorners.map(p => projectPoint(c.pos, c.lookAt, [0, 1, 0], fovY, aspect, p));
  const bMinX = Math.min(...bProjs.map(p => p.x));
  const bMaxX = Math.max(...bProjs.map(p => p.x));
  const bMinY = Math.min(...bProjs.map(p => p.y));
  const bMaxY = Math.max(...bProjs.map(p => p.y));
  console.log(`Board screen extents: X=[${bMinX.toFixed(2)}, ${bMaxX.toFixed(2)}], Y=[${bMinY.toFixed(2)}, ${bMaxY.toFixed(2)}]`);

  const pDesk = projectPoint(c.pos, c.lookAt, [0, 1, 0], fovY, aspect, deskCenter);
  console.log(`Desk Center projected:  x=${pDesk.x.toFixed(3)}, y=${pDesk.y.toFixed(3)}`);

  const dProjs = deskCorners.map(p => projectPoint(c.pos, c.lookAt, [0, 1, 0], fovY, aspect, p));
  const dMinX = Math.min(...dProjs.map(p => p.x));
  const dMaxX = Math.max(...dProjs.map(p => p.x));
  const dMinY = Math.min(...dProjs.map(p => p.y));
  const dMaxY = Math.max(...dProjs.map(p => p.y));
  console.log(`Desk screen extents:  X=[${dMinX.toFixed(2)}, ${dMaxX.toFixed(2)}], Y=[${dMinY.toFixed(2)}, ${dMaxY.toFixed(2)}]`);
});
