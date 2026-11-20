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
  // t: [x,y,z], r: [x,y,z,w] (quat), s: [x,y,z]
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

const totalLength = buffer.readUInt32LE(8);
let offset = 12;
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

// Determine parent-child relationships and root nodes
const childToParent = new Map();
nodes.forEach((node, pIdx) => {
  if (node.children) {
    node.children.forEach(cIdx => {
      childToParent.set(cIdx, pIdx);
    });
  }
});

const sceneRootIndices = jsonChunk.scenes[jsonChunk.scene || 0].nodes;

// Compute local and world transform for each node
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

  nodeTransforms[nodeIdx] = {
    localMat,
    worldMat
  };

  if (node.children) {
    for (const childIdx of node.children) {
      computeNodeTransform(childIdx, worldMat);
    }
  }
}

for (const rootIdx of sceneRootIndices) {
  computeNodeTransform(rootIdx, mat4Identity());
}

// Compute bounding boxes for each node and mesh
const processedNodes = nodes.map((node, idx) => {
  const transform = nodeTransforms[idx] || { localMat: mat4Identity(), worldMat: mat4Identity() };
  let meshInfo = null;

  if (node.mesh !== undefined) {
    const mesh = meshes[node.mesh];
    let localMin = [Infinity, Infinity, Infinity];
    let localMax = [-Infinity, -Infinity, -Infinity];
    const primitiveInfos = [];

    mesh.primitives.forEach((prim, primIdx) => {
      const posAccIdx = prim.attributes.POSITION;
      const acc = accessors[posAccIdx];
      const matIdx = prim.material;
      const mat = matIdx !== undefined ? materials[matIdx] : null;

      if (acc && acc.min && acc.max) {
        for (let i = 0; i < 3; i++) {
          if (acc.min[i] < localMin[i]) localMin[i] = acc.min[i];
          if (acc.max[i] > localMax[i]) localMax[i] = acc.max[i];
        }
      }

      primitiveInfos.push({
        primitiveIndex: primIdx,
        materialIndex: matIdx,
        materialName: mat ? mat.name : null,
        accessorMin: acc ? acc.min : null,
        accessorMax: acc ? acc.max : null,
        count: acc ? acc.count : 0
      });
    });

    // Compute 8 corners in local space and project to world space
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
      const wc = transformPoint(transform.worldMat, c);
      for (let i = 0; i < 3; i++) {
        if (wc[i] < worldMin[i]) worldMin[i] = wc[i];
        if (wc[i] > worldMax[i]) worldMax[i] = wc[i];
      }
    });

    const worldCenter = [
      (worldMin[0] + worldMax[0]) / 2,
      (worldMin[1] + worldMax[1]) / 2,
      (worldMin[2] + worldMax[2]) / 2
    ];

    const worldSize = [
      worldMax[0] - worldMin[0],
      worldMax[1] - worldMin[1],
      worldMax[2] - worldMin[2]
    ];

    meshInfo = {
      meshIndex: node.mesh,
      meshName: mesh.name,
      primitives: primitiveInfos,
      localBoundingBox: { min: localMin, max: localMax },
      worldBoundingBox: { min: worldMin, max: worldMax, center: worldCenter, size: worldSize }
    };
  }

  // Decompose world translation (m12, m13, m14)
  const worldPos = [
    transform.worldMat[12],
    transform.worldMat[13],
    transform.worldMat[14]
  ];

  return {
    index: idx,
    name: node.name,
    parent: childToParent.get(idx) ?? null,
    children: node.children || [],
    translation: node.translation || null,
    rotation: node.rotation || null,
    scale: node.scale || null,
    matrix: node.matrix || null,
    worldPosition: worldPos,
    mesh: meshInfo
  };
});

// Let's filter key nodes and print detailed info
console.log('--- KEY NODES IDENTIFICATION ---');
const boardNodes = processedNodes.filter(n => n.name && n.name.toLowerCase().includes('board'));
console.log('\nBoard related nodes:');
boardNodes.forEach(n => {
  console.log(`Node [${n.index}] "${n.name}"`);
  if (n.mesh) {
    console.log(`  Mesh: "${n.mesh.meshName}"`);
    console.log(`  World BBox Min: [${n.mesh.worldBoundingBox.min.map(v => v.toFixed(3)).join(', ')}]`);
    console.log(`  World BBox Max: [${n.mesh.worldBoundingBox.max.map(v => v.toFixed(3)).join(', ')}]`);
    console.log(`  World Center:   [${n.mesh.worldBoundingBox.center.map(v => v.toFixed(3)).join(', ')}]`);
    console.log(`  World Size:     [${n.mesh.worldBoundingBox.size.map(v => v.toFixed(3)).join(', ')}]`);
    console.log(`  Primitives:`, JSON.stringify(n.mesh.primitives, null, 2));
  }
});

const deskNodes = processedNodes.filter(n => n.name && n.name.toLowerCase().includes('teacherdesk'));
console.log('\nTeacher desk related nodes:');
deskNodes.forEach(n => {
  console.log(`Node [${n.index}] "${n.name}"`);
  if (n.mesh) {
    console.log(`  Mesh: "${n.mesh.meshName}"`);
    console.log(`  World BBox Min: [${n.mesh.worldBoundingBox.min.map(v => v.toFixed(3)).join(', ')}]`);
    console.log(`  World BBox Max: [${n.mesh.worldBoundingBox.max.map(v => v.toFixed(3)).join(', ')}]`);
    console.log(`  World Center:   [${n.mesh.worldBoundingBox.center.map(v => v.toFixed(3)).join(', ')}]`);
    console.log(`  World Size:     [${n.mesh.worldBoundingBox.size.map(v => v.toFixed(3)).join(', ')}]`);
    console.log(`  Primitives:`, JSON.stringify(n.mesh.primitives, null, 2));
  }
});

const groundNodes = processedNodes.filter(n => n.name && (n.name.toLowerCase().includes('ground') || n.name.toLowerCase().includes('wall') || n.name.toLowerCase().includes('ceilling')));
console.log('\nRoom boundaries (Ground, Walls, Ceiling):');
groundNodes.forEach(n => {
  if (n.mesh) {
    console.log(`Node [${n.index}] "${n.name}" - BBox size: [${n.mesh.worldBoundingBox.size.map(v => v.toFixed(2)).join(', ')}], center: [${n.mesh.worldBoundingBox.center.map(v => v.toFixed(2)).join(', ')}]`);
  }
});

