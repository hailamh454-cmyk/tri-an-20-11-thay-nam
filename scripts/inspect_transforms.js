import fs from 'fs';
import path from 'path';

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
for (let i = 0; i < 30; i++) {
  const n = nodes[i];
  console.log(`Node ${i}: "${n.name}"`);
  if (n.translation) console.log('  T:', n.translation);
  if (n.rotation) console.log('  R:', n.rotation);
  if (n.scale) console.log('  S:', n.scale);
  if (n.matrix) console.log('  M:', n.matrix);
}
