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
  if (chunkType === 0x4E4F534A) jsonChunk = JSON.parse(buffer.subarray(offset + 8, offset + 8 + chunkLength).toString('utf8'));
  else if (chunkType === 0x4E4942) binChunk = buffer.subarray(offset + 8, offset + 8 + chunkLength);
  offset += 8 + chunkLength;
}

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

// Check chair mesh 41
const chairMesh = jsonChunk.meshes[41];
const chairVerts = getAccessorData(chairMesh.primitives[0].attributes.POSITION);
// Local bounds
let cMin = [Infinity, Infinity, Infinity], cMax = [-Infinity, -Infinity, -Infinity];
chairVerts.forEach(p => {
  for (let i = 0; i < 3; i++) {
    if (p[i] < cMin[i]) cMin[i] = p[i];
    if (p[i] > cMax[i]) cMax[i] = p[i];
  }
});
console.log('Chair local bounds:', cMin, cMax);

// High Z vertices in local space (the backrest? or seat?)
const highestY = chairVerts.filter(p => p[2] > 0.8 * cMax[2]); // Z is up in FBX pre-rotation?
console.log('Highest Z verts in local:', highestY.slice(0, 5));
