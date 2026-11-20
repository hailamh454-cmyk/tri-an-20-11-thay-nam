import * as THREE from 'three';

const boardCenter = new THREE.Vector3(51.94, 162.45, 480.0);
const deskCenter = new THREE.Vector3(2.44, 39.11, 343.40);
const clockCenter = new THREE.Vector3(-31.2, 277.2, 499.8);

const deskCorners = [
  new THREE.Vector3(-85.83, 78.60, 290.32),
  new THREE.Vector3(90.71, 78.60, 290.32),
  new THREE.Vector3(-85.83, -0.38, 290.32),
  new THREE.Vector3(90.71, -0.38, 290.32),
  new THREE.Vector3(-85.83, 78.60, 396.47),
  new THREE.Vector3(90.71, 78.60, 396.47),
  new THREE.Vector3(-85.83, -0.38, 396.47),
  new THREE.Vector3(90.71, -0.38, 396.47),
];

const boardCorners = [
  new THREE.Vector3(-248.86, 78.39, 480.0),
  new THREE.Vector3(352.73, 78.39, 480.0),
  new THREE.Vector3(-248.86, 246.51, 480.0),
  new THREE.Vector3(352.73, 246.51, 480.0),
];

// Let's test a straight-on camera vs slightly angled
// Notice: If camera is at X = 51.94 (board center X), looking straight at board center:
// Board is centered horizontally X = [5%, 95%].
// In this case, where is the Teacher Desk?
// Teacher Desk center is at X = 2.44.
// For a camera facing +Z straight-on, does the teacher desk appear on screen left or screen right?
// Let's test camera at [51.94, 162.45, 0] looking at [51.94, 162.45, 480]!

const camStraight = new THREE.PerspectiveCamera(46, 16/9, 1, 2000);
camStraight.position.set(51.94, 162.45, 20);
camStraight.lookAt(51.94, 162.45, 480);
camStraight.updateMatrixWorld();

const dc = deskCenter.clone().project(camStraight);
const dpts = deskCorners.map(p => p.clone().project(camStraight));
const dMinX = Math.min(...dpts.map(p => p.x));
const dMaxX = Math.max(...dpts.map(p => p.x));
console.log('Straight-on view:');
console.log('Desk Center NDC:', dc.x.toFixed(3), dc.y.toFixed(3));
console.log('Desk NDC X range:', dMinX.toFixed(3), dMaxX.toFixed(3));
