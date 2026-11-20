import fs from 'fs';
import path from 'path';

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

// Function to read accessor buffer
function getAccessorData(accIdx) {
  const acc = jsonChunk.accessors[accIdx];
  const bv = jsonChunk.bufferViews[acc.bufferView];
  const byteOffset = (bv.byteOffset || 0) + (acc.byteOffset || 0);
  const count = acc.count;
  
  // componentType: 5126 is FLOAT
  let numComponents = 1;
  if (acc.type === 'VEC2') numComponents = 2;
  if (acc.type === 'VEC3') numComponents = 3;
  if (acc.type === 'VEC4') numComponents = 4;
  if (acc.type === 'MAT4') numComponents = 16;
  
  const byteStride = bv.byteStride || (numComponents * 4); // for float
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

// Mesh 8: Board
const boardMesh = jsonChunk.meshes[8];
console.log('Board mesh:', boardMesh.name);
const boardPrim = boardMesh.primitives[0];
console.log('Attributes:', boardPrim.attributes);

const boardPositions = getAccessorData(boardPrim.attributes.POSITION);
console.log(`Board positions count: ${boardPositions.data.length}`);
const samplePos = boardPositions.data.slice(0, 10);
console.log('Sample positions (local):', samplePos);

// Calculate min and max from data
let bMin = [Infinity, Infinity, Infinity];
let bMax = [-Infinity, -Infinity, -Infinity];
boardPositions.data.forEach(p => {
  for (let i = 0; i < 3; i++) {
    if (p[i] < bMin[i]) bMin[i] = p[i];
    if (p[i] > bMax[i]) bMax[i] = p[i];
  }
});
console.log('Board local min:', bMin);
console.log('Board local max:', bMax);

if (boardPrim.attributes.NORMAL) {
  const boardNormals = getAccessorData(boardPrim.attributes.NORMAL);
  console.log('Sample normals:', boardNormals.data.slice(0, 5));
}

