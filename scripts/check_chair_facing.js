import fs from 'fs';
import path from 'path';

function mat4Identity() { return [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]; }
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
let jsonChunk = null, binChunk = null;
while (offset < totalLength) {
  const chunkLength = buffer.readUInt32LE(offset);
  const chunkType = buffer.readUInt32LE(offset + 4);
  if (chunkType === 0x4E4F534A) jsonChunk = JSON.parse(buffer.subarray(offset + 8, offset + 8 + chunkLength).toString('utf8'));
  else if (chunkType === 0x4E4942) binChunk = buffer.subarray(offset + 8, offset + 8 + chunkLength);
  offset += 8 + chunkLength;
}

const nodes = jsonChunk.nodes;
const sceneRootIndices = jsonChunk.scenes[jsonChunk.scene || 0].nodes;
const nodeTransforms = [];
function computeNodeTransform(nodeIdx, parentMatrix) {
  const node = nodes[nodeIdx];
  let localMat = node.matrix ? [...node.matrix] : mat4Identity();
  const worldMat = new Array(16);
  mat4Multiply(worldMat, parentMatrix, localMat);
  nodeTransforms[nodeIdx] = { localMat, worldMat };
  if (node.children) {
    for (const childIdx of node.children) computeNodeTransform(childIdx, worldMat);
  }
}
for (const rootIdx of sceneRootIndices) computeNodeTransform(rootIdx, mat4Identity());

function getAccessorData(accIdx) {
  const acc = jsonChunk.accessors[accIdx];
  const bv = jsonChunk.bufferViews[acc.bufferView];
  const byteOffset = (bv.byteOffset || 0) + (acc.byteOffset || 0);
  const count = acc.count;
  const result = [];
  for (let i = 0; i < count; i++) {
    const o = byteOffset + i * 12;
    result.push([binChunk.readFloatLE(o), binChunk.readFloatLE(o+4), binChunk.readFloatLE(o+8)]);
  }
  return result;
}

// Chair 0 nodeIdx = 106 (mesh 41)
const chairNodeIdx = 106;
const chairWorldMat = nodeTransforms[chairNodeIdx].worldMat;
const chairMesh = jsonChunk.meshes[nodes[chairNodeIdx].mesh];
const chairVerts = getAccessorData(chairMesh.primitives[0].attributes.POSITION);
const chairWorldVerts = chairVerts.map(p => transformPoint(chairWorldMat, p));

// Find chair backrest (highest Y in world)
let highestVerts = chairWorldVerts.filter(p => p[1] > 90);
console.log('Chair 0 top backrest world Z range:', [
  Math.min(...highestVerts.map(p => p[2])),
  Math.max(...highestVerts.map(p => p[2]))
]);
// Find chair seat (around Y=40..50)
let seatVerts = chairWorldVerts.filter(p => p[1] > 40 && p[1] < 55);
console.log('Chair 0 seat world Z range:', [
  Math.min(...seatVerts.map(p => p[2])),
  Math.max(...seatVerts.map(p => p[2]))
]);
