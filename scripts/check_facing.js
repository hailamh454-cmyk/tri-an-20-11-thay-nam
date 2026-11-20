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
  if (chunkType === 0x4E4F534A) jsonChunk = JSON.parse(buffer.subarray(offset + 8, offset + 8 + chunkLength).toString('utf8'));
  offset += 8 + chunkLength;
}

const nodes = jsonChunk.nodes;
// Check chair nodes: 104, 107, 110, etc.
const chairNodes = nodes.filter(n => n.name && n.name.startsWith('chair'));
console.log('Sample chair node:');
console.log(chairNodes[0]);

// Check teacher desk node
const teacherDeskNode = nodes.find(n => n.name === 'teacherDesk.001');
console.log('Teacher desk node:');
console.log(teacherDeskNode);

// Check board node
const boardNode = nodes.find(n => n.name === 'Collection');
console.log('Board node:');
console.log(boardNode);
