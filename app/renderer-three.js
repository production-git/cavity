import * as THREE from 'three';
import { app, getCOL, getRAD } from './state.js';

let scene, camera, renderer, atomGroup, bondGroup;

export function init(canvas) {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setSize(canvas.clientWidth || 800, canvas.clientHeight || 600, false);

    scene = new THREE.Scene();

    const w = canvas.clientWidth || 800;
    const h = canvas.clientHeight || 600;
    camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
    camera.position.set(0, 0, 40);

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);

    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(5, 10, 7);
    scene.add(dir);

    atomGroup = new THREE.Group();
    scene.add(atomGroup);

    bondGroup = new THREE.Group();
    scene.add(bondGroup);
}

export function draw() {
    if (!renderer || !scene || !camera) return;

    atomGroup.children.slice().forEach(child => atomGroup.remove(child));
    bondGroup.children.slice().forEach(child => bondGroup.remove(child));

    for (const atom of app.atoms) {
        const radius = getRAD(atom.t) * 0.15;
        const geo = new THREE.SphereGeometry(radius, 16, 16);
        const mat = new THREE.MeshPhongMaterial({ color: new THREE.Color(getCOL(atom.t)) });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(atom.x, atom.y, atom.z);
        atomGroup.add(mesh);
    }

    const atomById = new Map(app.atoms.map(a => [a.id, a]));
    for (const bond of app.bonds) {
        const a1 = atomById.get(bond.a);
        const a2 = atomById.get(bond.b);
        if (!a1 || !a2) continue;

        const p1 = new THREE.Vector3(a1.x, a1.y, a1.z);
        const p2 = new THREE.Vector3(a2.x, a2.y, a2.z);
        const length = p1.distanceTo(p2);
        if (length < 0.001) continue;

        // TODO: proper dashed-bond rendering (Line2 or shader); for now use thin/dark cylinder
        const radius = bond.dashed ? 0.05 : 0.1;
        const color = bond.dashed ? 0x555555 : 0xaaaaaa;

        const geo = new THREE.CylinderGeometry(radius, radius, length, 8);
        const mat = new THREE.MeshPhongMaterial({ color });
        const mesh = new THREE.Mesh(geo, mat);

        const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
        mesh.position.copy(mid);

        const dir = new THREE.Vector3().subVectors(p2, p1).normalize();
        const axis = new THREE.Vector3(0, 1, 0);
        const quaternion = new THREE.Quaternion().setFromUnitVectors(axis, dir);
        mesh.setRotationFromQuaternion(quaternion);

        bondGroup.add(mesh);
    }

    atomGroup.rotation.y = app.angleY || 0;
    atomGroup.rotation.x = app.angleX || 0;
    bondGroup.rotation.y = app.angleY || 0;
    bondGroup.rotation.x = app.angleX || 0;

    renderer.render(scene, camera);
}
