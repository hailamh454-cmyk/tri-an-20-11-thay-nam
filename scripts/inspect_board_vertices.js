import fs from 'fs';
import path from 'path';

// Matrix math helpers for 4x4 column-major matrices (glTF standard)
function mat4Identity() {
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  ];
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
  const x = r ? r[0] : 0;
  const y = r ? r[1] : 0;
  const z = r ? r[2] : 0;
  const w = r ? r[3] : 1;

  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;

  const sx = s ? s[0] : 1;
  const sy = s ? s[1] : 1;
  const sz = s ? s[2] : 1;

  const m = new Array(16);
  m[0] = (1 - (yy + zz)) * sx;
  m[1] = (xy + wz) * sx;
  m[2] = (xz - wy) * sx;
  m[3] = 0;

  m[4] = (xy - wz) * sy;
  m[5] = (1 - (xx + zz)) * sy;
  m[6] = (yz + wx) * sy;
  m[7] = 0;

  m[8] = (xz + wy) * sz;
  m[9] = (yz - wx) * sz;
  m[10] = (1 - (xx + yy)) * sz;
  m[11] = 0;

  m[12] = t ? t[0] : 0;
  m[13] = t ? t[1] : 0;
  m[14] = t ? t[2] : 0;
  m[15] = 1;

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
let binChunk = null;

while (offset < totalLength) {
  const chunkLength = buffer.readUInt32LE(offset);
  const chunkType = buffer.readUInt32LE(offset + 4);
  if (chunkType === 0x4E4F534A) {
    jsonChunk = JSON.parse(buffer.subarray(offset + 8, offset + 8 + chunkLength).toString('utf8'));
  } else if (chunkType === 0x4E4942) {
    binChunk = buffer.subarray(offset + 8, offset + 8 + chunkLength);
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
  let localMat;
  if (node.matrix) {
    localMat = [...node.matrix];
  } else {
    localMat = mat4FromTRS(node.translation, node.rotation, node.scale);
  }

  const worldMat = new Array(16);
  mat4Multiply(worldMat, parentMatrix, localMat);
  nodeTransforms[nodeIdx] = { localMat, worldMat };

  if (node.children) {
    for (const childIdx of node.children) {
      computeNodeTransform(childIdx, worldMat);
    }
  }
}

for (const rootIdx of sceneRootIndices) {
  computeNodeTransform(rootIdx, mat4Identity());
}

function getAccessorData(accIdx) {
  const acc = jsonChunk.accessors[accIdx];
  const bv = jsonChunk.bufferViews[acc.bufferView];
  const byteOffset = (bv.byteOffset || 0) + (acc.byteOffset || 0);
  const count = acc.count;
  
  let numComponents = 1;
  if (acc.type === 'VEC2') numComponents = 2;
  if (acc.type === 'VEC3') numComponents = 3;
  if (acc.type === 'VEC4') numComponents = 4;
  if (acc.type === 'MAT4') numComponents = 16;
  
  const byteStride = bv.byteStride || (numComponents * 4);
  const result = [];
  
  for (let i = 0; i < count; i++) {
    const itemOffset = byteOffset + i * byteStride;
    const item = [];
    for (let c = 0; c < numComponents; c++) {
      item.push(binChunk.readFloatLE(itemOffset + c * 4));
    }
    result.push(item);
  }
  return { accessor: acc, data: result };
}

// 1. Board inspection
const boardNodeIdx = 22;
const boardMeshIdx = nodes[boardNodeIdx].mesh;
const boardWorldMat = nodeTransforms[boardNodeIdx].worldMat;
const boardPositions = getAccessorData(meshes[boardMeshIdx].primitives[0].attributes.POSITION).data;

const boardWorldPositions = boardPositions.map(p => transformPoint(boardWorldMat, p));

let bwMin = [Infinity, Infinity, Infinity];
let bwMax = [-Infinity, -Infinity, -Infinity];

boardWorldPositions.forEach(p => {
  for (let i = 0; i < 3; i++) {
    if (p[i] < bwMin[i]) bwMin[i] = p[i];
    if (p[i] > bwMax[i]) bwMax[i] = p[i];
  }
});

console.log('Board World Bounding Box from actual vertices:');
console.log('  Min:', bwMin);
console.log('  Max:', bwMax);
console.log('  Center:', [
  (bwMin[0] + bwMax[0]) / 2,
  (bwMin[1] + bwMax[1]) / 2,
  (bwMin[2] + bwMax[2]) / 2
]);
console.log('  Size:', [
  bwMax[0] - bwMin[0],
  bwMax[1] - bwMin[1],
  bwMax[2] - bwMin[2]
]);

// Let's examine the Z-distribution of the board vertices
// Is there a front face at min Z (since room front wall is +501)?
const zValues = boardWorldPositions.map(p => p[2]);
zValues.sort((a, b) => a - b);
console.log('Board Z min (closest to classroom):', zValues[0], 'Z max (furthest against wall):', zValues[zValues.length - 1]);

// 2. Teacher desk inspection
const deskNodeIdx = 28;
const deskMeshIdx = nodes[deskNodeIdx].mesh;
const deskWorldMat = nodeTransforms[deskNodeIdx].worldMat;
const deskPositions = getAccessorData(meshes[deskMeshIdx].primitives[0].attributes.POSITION).data;
const deskWorldPositions = deskPositions.map(p => transformPoint(deskWorldMat, p));

let dwMin = [Infinity, Infinity, Infinity];
let dwMax = [-Infinity, -Infinity, -Infinity];
deskWorldPositions.forEach(p => {
  for (let i = 0; i < 3; i++) {
    if (p[i] < dwMin[i]) dwMin[i] = p[i];
    if (p[i] > dwMax[i]) dwMax[i] = p[i];
  }
});

console.log('\nTeacher Desk World Bounding Box from actual vertices:');
console.log('  Min:', dwMin);
console.log('  Max:', dwMax);
console.log('  Center:', [
  (dwMin[0] + dwMax[0]) / 2,
  (dwMin[1] + dwMax[1]) / 2,
  (dwMin[2] + dwMax[2]) / 2
]);
console.log('  Size:', [
  dwMax[0] - dwMin[0],
  dwMax[1] - dwMin[1],
  dwMax[2] - dwMin[2]
]);

// 3. Inspect student desks (Cube_Desk_0)
const studentDeskNode = nodes.find(n => n.name === 'Cube');
if (studentDeskNode) {
  const sWorldMat = nodeTransforms[nodes.indexOf(studentDeskNode)].worldMat;
  console.log('\nStudent Desk ("Cube") World Pos:', [sWorldMat[12], sWorldMat[13], sWorldMat[14]]);
}

