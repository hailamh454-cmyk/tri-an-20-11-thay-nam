import fs from 'fs';
import path from 'path';

// Let's draw an ASCII map of the room looking from above (top-down, looking down from +Y to floor Y=0)
// X goes from -450 to +450 (width 900)
// Z goes from -550 to +550 (depth 1100)

const width = 80;
const height = 40;
const grid = Array.from({ length: height }, () => Array(width).fill(' '));

function worldToGrid(x, z) {
  // x in [-420, 420] -> col in [0, width-1]
  // z in [-520, 520] -> row in [height-1, 0] (so z=+520 is top, z=-520 is bottom)
  const col = Math.round(((x + 420) / 840) * (width - 1));
  const row = Math.round(((520 - z) / 1040) * (height - 1));
  return { col, row };
}

function drawBox(minX, maxX, minZ, maxZ, char) {
  const p1 = worldToGrid(minX, minZ);
  const p2 = worldToGrid(maxX, maxZ);
  const rMin = Math.max(0, Math.min(p1.row, p2.row));
  const rMax = Math.min(height - 1, Math.max(p1.row, p2.row));
  const cMin = Math.max(0, Math.min(p1.col, p2.col));
  const cMax = Math.min(width - 1, Math.max(p1.col, p2.col));

  for (let r = rMin; r <= rMax; r++) {
    for (let c = cMin; c <= cMax; c++) {
      grid[r][c] = char;
    }
  }
}

function drawLabel(x, z, text) {
  const { col, row } = worldToGrid(x, z);
  if (row >= 0 && row < height) {
    for (let i = 0; i < text.length; i++) {
      if (col + i < width) {
        grid[row][col + i] = text[i];
      }
    }
  }
}

// Draw room boundaries
drawBox(-402, 402, -502, 502, '.');
drawBox(-400, 400, -500, 500, ' ');

// Front blackboard at +Z
drawBox(-249, 353, 480, 502, 'B');

// Teacher desk
drawBox(-86, 91, 290, 396, 'T');

// Windows at +X
drawBox(385, 402, -450, 450, 'W');

// Student desks
drawBox(-320, 340, -370, 240, 'S');

// Door at -X
drawBox(-402, -385, -450, -350, 'D');

console.log('TOP-DOWN MAP (Looking down at floor):');
console.log('Top = +Z (Front of classroom, Blackboard)');
console.log('Bottom = -Z (Back of classroom)');
console.log('Left = -X (Door, Coat racks)');
console.log('Right = +X (Windows, Godrays)\n');

grid.forEach(row => console.log(row.join('')));
