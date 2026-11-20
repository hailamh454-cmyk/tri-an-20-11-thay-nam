import fs from 'fs';
import path from 'path';

function mat4Identity() { return [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]; }
function mat4Multiply(out, a, b) {
  const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
  const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
  const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
  const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

  let b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3];
  out[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a31; // wait! let's use the tested matrix multiplication
}

// Let's use our dump_all_objects nodeTransforms
