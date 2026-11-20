import fs from 'fs';
import path from 'path';

function mat4Identity() {
  return [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
}
function mat4Multiply(out, a, b) {
  const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
  const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
  const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
  const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

  let b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3];
  out[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

  b0 = b[4]; b1 = b[5]; b2 = b[6]; b3 = b[7];
  out[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

  b0 = b[8]; b1 = b[9]; b2 = b[10]; b3 = b[11];
  out[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

  b0 = b[12]; b1 = b[13]; b2 = b[14]; b3 = b[15];
  out[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  return out;
}
function mat4FromTRS(t, r, s) {
  const x = r ? r[0] : 0, y = r ? r[1] : 0, z = r ? r[2] : 0, w = r ? r[3] : 1;
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  const sx = s ? s[0] : 1, sy = s ? s[1] : 1, sz = s ? s[2] : 1;
  const m = new Array(16);
  m[0] = (1 - (yy + zz)) * sx; m[1] = (xy + wz) * sx; m[2] = (xz - wy) * sx; m[3] = 0;
  m[4] = (xy - wz) * sy; m[5] = (1 - (xx + zz)) * sy; m[6] = (yz + wx) * sy; m[7] = 0;
  m[8] = (xz + wy) * sz; m[9] = (yz - wx) * sz; m[10] = (1 - (xx + yy)) * sz; m[11] = 0;
  m[12] = t ? t[0] : 0; m[13] = t ? t[1] : 0; m[14] = t ? t[2] : 0; m[15] = 1;
  return m;
}
function transformPoint(m, p) {
  const x = p[0], y = p[1], z = p[2];
  const w = m[3] * x + m[7] * y + m[11] * z + m[15] || 1.0;
  return [
    (m[0] * x + m[4] * y + m[8] * z + m[12]) / w,
    (m[1] * x + m[5] * y + m[9] * z + m[13]) / w,
    (m[2] * x + m[6] * y + m[10] * z + m[14]) / w
  ];
}

const glbPath = path.resolve('assets/classroom.glb');
const buffer = fs.readFileSync(glbPath);
let offset = 12;
const totalLength = buffer.readUInt32LE(8);
let jsonChunk = null;
while (offset < totalLength) {
  const chunkLength = buffer.readUInt32LE(offset);
  const chunkType = buffer.readUInt32LE(offset + 4);
  if (chunkType === 0x4E4F534A) {
    jsonChunk = JSON.parse(buffer.subarray(offset + 8, offset + 8 + chunkLength).toString('utf8'));
  }
  offset += 8 + chunkLength;
}

const nodes = jsonChunk.nodes;
const meshes = jsonChunk.meshes;
const accessors = jsonChunk.accessors;
const materials = jsonChunk.materials;
const sceneRootIndices = jsonChunk.scenes[jsonChunk.scene || 0].nodes;

const nodeTransforms = [];
function computeNodeTransform(nodeIdx, parentMatrix) {
  const node = nodes[nodeIdx];
  let localMat = node.matrix ? [...node.matrix] : mat4FromTRS(node.translation, node.rotation, node.scale);
  const worldMat = new Array(16);
  mat4Multiply(worldMat, parentMatrix, localMat);
  nodeTransforms[nodeIdx] = { localMat, worldMat };
  if (node.children) {
    for (const childIdx of node.children) {
      computeNodeTransform(childIdx, worldMat);
    }
  }
}
for (const rootIdx of sceneRootIndices) computeNodeTransform(rootIdx, mat4Identity());

const items = [];
nodes.forEach((node, idx) => {
  if (node.mesh !== undefined) {
    const mesh = meshes[node.mesh];
    let localMin = [Infinity, Infinity, Infinity];
    let localMax = [-Infinity, -Infinity, -Infinity];
    mesh.primitives.forEach(prim => {
      const acc = accessors[prim.attributes.POSITION];
      if (acc && acc.min && acc.max) {
        for (let i = 0; i < 3; i++) {
          if (acc.min[i] < localMin[i]) localMin[i] = acc.min[i];
          if (acc.max[i] > localMax[i]) localMax[i] = acc.max[i];
        }
      }
    });

    const corners = [
      [localMin[0], localMin[1], localMin[2]],
      [localMax[0], localMin[1], localMin[2]],
      [localMin[0], localMax[1], localMin[2]],
      [localMax[0], localMax[1], localMin[2]],
      [localMin[0], localMin[1], localMax[2]],
      [localMax[0], localMin[1], localMax[2]],
      [localMin[0], localMax[1], localMax[2]],
      [localMax[0], localMax[1], localMax[2]],
    ];

    const worldMin = [Infinity, Infinity, Infinity];
    const worldMax = [-Infinity, -Infinity, -Infinity];
    corners.forEach(c => {
      const wc = transformPoint(nodeTransforms[idx].worldMat, c);
      for (let i = 0; i < 3; i++) {
        if (wc[i] < worldMin[i]) worldMin[i] = wc[i];
        if (wc[i] > worldMax[i]) worldMax[i] = wc[i];
      }
    });

    const center = [(worldMin[0] + worldMax[0])/2, (worldMin[1] + worldMax[1])/2, (worldMin[2] + worldMax[2])/2];
    const size = [worldMax[0] - worldMin[0], worldMax[1] - worldMin[1], worldMax[2] - worldMin[2]];

    items.push({
      nodeIdx: idx,
      nodeName: node.name,
      meshIdx: node.mesh,
      meshName: mesh.name,
      material: mesh.primitives[0].material !== undefined ? materials[mesh.primitives[0].material].name : 'none',
      worldMin,
      worldMax,
      center,
      size
    });
  }
});

console.log(`Found ${items.length} mesh nodes. Summary table:`);
console.table(items.map(it => ({
  Node: it.nodeIdx,
  Name: it.nodeName.slice(0, 30),
  Mat: it.material,
  'CenterX': it.center[0].toFixed(1),
  'CenterY': it.center[1].toFixed(1),
  'CenterZ': it.center[2].toFixed(1),
  'SizeX': it.size[0].toFixed(1),
  'SizeY': it.size[1].toFixed(1),
  'SizeZ': it.size[2].toFixed(1)
})));

