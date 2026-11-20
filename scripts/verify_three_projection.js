// Accurate Three.js project simulation
// In Three.js:
// camera = new PerspectiveCamera(fov, aspect, near, far)
// camera.position.set(x, y, z)
// camera.lookAt(targetX, targetY, targetZ)
// p.project(camera) -> NDC: x in [-1, 1] (-1=left, +1=right), y in [-1, 1] (-1=bottom, +1=top)

function threeProject(p, camPos, lookAtPos, fovY, aspect, near = 1, far = 2000) {
  // 1. LookAt matrix (world matrix of camera)
  // Forward vector: Target - Eye
  const eye = camPos;
  const target = lookAtPos;
  
  let zx = eye[0] - target[0];
  let zy = eye[1] - target[1];
  let zz = eye[2] - target[2];
  let zLen = Math.sqrt(zx*zx + zy*zy + zz*zz);
  zx /= zLen; zy /= zLen; zz /= zLen; // Z axis points from target to eye (camera backward)

  const up = [0, 1, 0];
  // X = Up x Z
  let xx = up[1]*zz - up[2]*zy;
  let xy = up[2]*zx - up[0]*zz;
  let xz = up[0]*zy - up[1]*zx;
  let xLen = Math.sqrt(xx*xx + xy*xy + xz*xz);
  xx /= xLen; xy /= xLen; xz /= xLen;

  // Y = Z x X
  let yx = zy*xz - zz*xy;
  let yy = zz*xx - zx*xz;
  let yz = zx*xy - zy*xx;

  // Camera world matrix:
  // [ xx  yx  zx  eye.x ]
  // [ xy  yy  zy  eye.y ]
  // [ xz  yz  zz  eye.z ]
  // [ 0   0   0   1     ]
  //
  // View matrix is inverse of camera world matrix:
  // Since rotation is orthonormal: R^T * (p - eye)
  const px = p[0] - eye[0];
  const py = p[1] - eye[1];
  const pz = p[2] - eye[2];

  const vx = xx*px + xy*py + xz*pz;
  const vy = yx*px + yy*py + yz*pz;
  const vz = zx*px + zy*py + zz*pz; // in camera space, looking down -Z, so visible points have vz < 0

  if (vz >= 0) return { visible: false };

  // Perspective projection:
  const tanHalf = Math.tan((fovY * Math.PI / 180) / 2);
  const ndcX = vx / (-vz * tanHalf * aspect);
  const ndcY = vy / (-vz * tanHalf);
  const ndcZ = (-(far + near) / (far - near) * vz - (2 * far * near) / (far - near)) / -vz;

  return {
    visible: true,
    ndcX,
    ndcY,
    ndcZ,
    screenX: (ndcX + 1) / 2,     // 0 = left, 1 = right
    screenY: (1 - ndcY) / 2      // 0 = top, 1 = bottom
  };
}

const boardCorners = [
  [-248.86, 78.39, 480.0],  // bottom-left of board
  [352.73, 78.39, 480.0],   // bottom-right of board
  [-248.86, 246.51, 480.0], // top-left of board
  [352.73, 246.51, 480.0],  // top-right of board
];
const boardCenter = [51.94, 162.45, 480.0];

const deskCorners = [
  [-85.83, 78.60, 290.32],
  [90.71, 78.60, 290.32],
  [-85.83, 0.0, 290.32],
  [90.71, 0.0, 290.32],
  [-85.83, 78.60, 396.47],
  [90.71, 78.60, 396.47],
  [-85.83, 0.0, 396.47],
  [90.71, 0.0, 396.47],
];
const deskCenter = [2.44, 39.11, 343.40];

// Let's test a few fine-tuned camera positions:
const configs = [
  {
    name: 'Option 1: Balanced Center View',
    pos: [52.0, 160.0, 50.0],
    lookAt: [52.0, 155.0, 480.0],
    fov: 46
  },
  {
    name: 'Option 2: Cinematic Autumn View (Shifted slightly right, teacher desk clearly bottom-left)',
    pos: [90.0, 165.0, 50.0],
    lookAt: [50.0, 155.0, 480.0],
    fov: 48
  },
  {
    name: 'Option 3: Intimate Front-Row View (Closer to board)',
    pos: [65.0, 155.0, 100.0],
    lookAt: [52.0, 150.0, 480.0],
    fov: 52
  },
  {
    name: 'Option 4: Wide Classroom Angle (Capturing full desk & godrays)',
    pos: [110.0, 170.0, 40.0],
    lookAt: [45.0, 150.0, 480.0],
    fov: 50
  }
];

configs.forEach(cfg => {
  console.log(`\n======================================================`);
  console.log(cfg.name);
  console.log(`Position: [${cfg.pos.join(', ')}]`);
  console.log(`LookAt:   [${cfg.lookAt.join(', ')}]`);
  console.log(`FOV:      ${cfg.fov}°`);

  const bc = threeProject(boardCenter, cfg.pos, cfg.lookAt, cfg.fov, 16/9);
  console.log(`Board Center NDC: (${bc.ndcX.toFixed(2)}, ${bc.ndcY.toFixed(2)}) => Screen: (${(bc.screenX*100).toFixed(1)}%, ${(bc.screenY*100).toFixed(1)}%)`);

  const bpts = boardCorners.map(p => threeProject(p, cfg.pos, cfg.lookAt, cfg.fov, 16/9));
  const bMinX = Math.min(...bpts.map(p => p.screenX));
  const bMaxX = Math.max(...bpts.map(p => p.screenX));
  const bMinY = Math.min(...bpts.map(p => p.screenY));
  const bMaxY = Math.max(...bpts.map(p => p.screenY));
  console.log(`Board Frame Screen: X=[${(bMinX*100).toFixed(1)}% to ${(bMaxX*100).toFixed(1)}%], Y=[${(bMinY*100).toFixed(1)}% to ${(bMaxY*100).toFixed(1)}%]`);

  const dc = threeProject(deskCenter, cfg.pos, cfg.lookAt, cfg.fov, 16/9);
  console.log(`Desk Center NDC:  (${dc.ndcX.toFixed(2)}, ${dc.ndcY.toFixed(2)}) => Screen: (${(dc.screenX*100).toFixed(1)}%, ${(dc.screenY*100).toFixed(1)}%)`);

  const dpts = deskCorners.map(p => threeProject(p, cfg.pos, cfg.lookAt, cfg.fov, 16/9));
  const dMinX = Math.min(...dpts.map(p => p.screenX));
  const dMaxX = Math.max(...dpts.map(p => p.screenX));
  const dMinY = Math.min(...dpts.map(p => p.screenY));
  const dMaxY = Math.max(...dpts.map(p => p.screenY));
  console.log(`Desk Frame Screen:  X=[${(dMinX*100).toFixed(1)}% to ${(dMaxX*100).toFixed(1)}%], Y=[${(dMinY*100).toFixed(1)}% to ${(dMaxY*100).toFixed(1)}%]`);
});
