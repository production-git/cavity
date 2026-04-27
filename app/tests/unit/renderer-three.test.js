import { jest } from '@jest/globals';

// Mocks must be registered before the module under test is dynamically imported.
jest.unstable_mockModule('three', () => ({
    WebGLRenderer: jest.fn().mockImplementation(() => ({
        setPixelRatio: jest.fn(),
        setSize: jest.fn(),
        render: jest.fn(),
    })),
    Scene: jest.fn().mockImplementation(() => ({ add: jest.fn() })),
    PerspectiveCamera: jest.fn().mockImplementation(() => ({
        position: { set: jest.fn() },
    })),
    AmbientLight: jest.fn().mockImplementation(() => ({})),
    DirectionalLight: jest.fn().mockImplementation(() => ({
        position: { set: jest.fn() },
    })),
    SphereGeometry: jest.fn().mockImplementation(() => ({})),
    CylinderGeometry: jest.fn().mockImplementation(() => ({})),
    BufferGeometry: jest.fn().mockImplementation(() => ({
        setAttribute: jest.fn(),
        setFromPoints: jest.fn(function() { return this; }),
    })),
    BufferAttribute: jest.fn().mockImplementation(() => ({})),
    MeshPhongMaterial: jest.fn().mockImplementation(() => ({})),
    MeshBasicMaterial: jest.fn().mockImplementation(() => ({})),
    LineBasicMaterial: jest.fn().mockImplementation(() => ({})),
    Mesh: jest.fn().mockImplementation(() => ({
        position: { set: jest.fn(), copy: jest.fn() },
        setRotationFromQuaternion: jest.fn(),
    })),
    LineSegments: jest.fn().mockImplementation(() => ({})),
    Color: jest.fn().mockImplementation(() => ({})),
    DoubleSide: 2,
    Group: jest.fn().mockImplementation(() => ({
        children: [],
        add: jest.fn(),
        remove: jest.fn(),
        rotation: { x: 0, y: 0 },
    })),
    Vector3: jest.fn().mockImplementation(() => {
        const v = {
            addVectors: jest.fn(() => v),
            multiplyScalar: jest.fn(() => v),
            subVectors: jest.fn(() => v),
            normalize: jest.fn(() => v),
            distanceTo: jest.fn(() => 1.5),
            copy: jest.fn(),
        };
        return v;
    }),
    Quaternion: jest.fn().mockImplementation(() => {
        const q = { setFromUnitVectors: jest.fn(() => q) };
        return q;
    }),
}));

jest.unstable_mockModule('../../state.js', () => ({
    app: {
        atoms: [
            { x: 0, y: 0, z: 0, t: 'Cu', id: 0 },
            { x: 1, y: 1, z: 1, t: 'O', id: 1 },
        ],
        bonds: [],
        angleX: 0,
        angleY: 0.5,
    },
    getCOL: jest.fn(() => '#4A90D9'),
    getRAD: jest.fn(() => 8),
    getAllDrawGroups: jest.fn(() => []),
}));

let rendererThree;
let stateApp;
let stateModule;

beforeAll(async () => {
    rendererThree = await import('../../renderer-three.js');
    stateModule = await import('../../state.js');
    stateApp = stateModule.app;
});

describe('renderer-three module', () => {
    test('exports init and draw functions', () => {
        expect(typeof rendererThree.init).toBe('function');
        expect(typeof rendererThree.draw).toBe('function');
    });

    test('init does not throw with a mock canvas', () => {
        const canvas = {
            clientWidth: 800,
            clientHeight: 600,
            getContext: jest.fn(() => ({})),
        };
        expect(() => rendererThree.init(canvas)).not.toThrow();
    });

    test('draw does not throw after init', () => {
        expect(() => rendererThree.draw()).not.toThrow();
    });

    test('draw creates one mesh per atom', async () => {
        const { Mesh } = await import('three');
        // 2 atoms × 1 draw call so far = 2 Mesh constructions
        expect(Mesh).toHaveBeenCalledTimes(2);
    });
});

describe('renderer-three bond rendering', () => {
    test('draw does not throw with zero bonds', () => {
        stateApp.bonds = [];
        expect(() => rendererThree.draw()).not.toThrow();
    });

    test('bond mesh count matches bonds length', async () => {
        const { CylinderGeometry } = await import('three');
        CylinderGeometry.mockClear();
        stateApp.bonds = [{ a: 0, b: 1, dashed: false }];
        rendererThree.draw();
        expect(CylinderGeometry).toHaveBeenCalledTimes(stateApp.bonds.length);
        stateApp.bonds = [];
    });
});

describe('renderer-three polyhedra rendering', () => {
    test('draw does not throw with zero polyhedra', () => {
        stateModule.getAllDrawGroups.mockReturnValueOnce([]);
        expect(() => rendererThree.draw()).not.toThrow();
    });

    test('BufferGeometry created twice per non-sphere group (faces + edges)', async () => {
        const { BufferGeometry } = await import('three');
        BufferGeometry.mockClear();
        const origAtoms = stateApp.atoms;
        stateApp.atoms = [
            { x: 0, y: 0, z: 0, t: 'Cu', id: 0 },
            { x: 1, y: 0, z: 0, t: 'O',  id: 1 },
            { x: 0, y: 1, z: 0, t: 'O',  id: 2 },
        ];
        stateModule.getAllDrawGroups.mockReturnValueOnce([
            { faces: [[0, 1, 2]], edges: [[0, 1], [1, 2], [2, 0]], ids: [0, 1, 2], color: '#ff0000' },
            { faces: [[0, 1, 2]], edges: [[0, 1]], ids: [0, 1, 2], color: '#0000ff' },
        ]);
        rendererThree.draw();
        // 2 groups × (1 face BufferGeometry + 1 edge BufferGeometry) = 4
        expect(BufferGeometry).toHaveBeenCalledTimes(4);
        stateApp.atoms = origAtoms;
    });

    test('sphere (cavity) groups are skipped by polyhedra path — no face BufferGeometry', async () => {
        const { BufferGeometry } = await import('three');
        BufferGeometry.mockClear();
        stateModule.getAllDrawGroups.mockReturnValueOnce([
            { isSphere: true, cx: 0, cy: 0, cz: 0, r: 1, color: '#ffff00' },
        ]);
        rendererThree.draw();
        expect(BufferGeometry).not.toHaveBeenCalled();
    });
});

describe('renderer-three cavity sphere rendering', () => {
    test('draw does not throw with isSphere groups', () => {
        stateModule.getAllDrawGroups.mockReturnValueOnce([
            { isSphere: true, cx: 0, cy: 0, cz: 0, r: 1.5, color: '#ffff00' },
        ]);
        expect(() => rendererThree.draw()).not.toThrow();
    });

    test('SphereGeometry created once per cavity group (no atoms)', async () => {
        const { SphereGeometry } = await import('three');
        SphereGeometry.mockClear();
        const origAtoms = stateApp.atoms;
        stateApp.atoms = [];
        stateModule.getAllDrawGroups.mockReturnValueOnce([
            { isSphere: true, cx: 0, cy: 0, cz: 0, r: 1.5, color: '#ffff00' },
            { isSphere: true, cx: 3, cy: 0, cz: 0, r: 2.0, color: '#00ffff' },
        ]);
        rendererThree.draw();
        expect(SphereGeometry).toHaveBeenCalledTimes(2);
        stateApp.atoms = origAtoms;
    });

    test('cavity spheres use transparent MeshBasicMaterial', async () => {
        const { MeshBasicMaterial } = await import('three');
        MeshBasicMaterial.mockClear();
        const origAtoms = stateApp.atoms;
        stateApp.atoms = [];
        stateModule.getAllDrawGroups.mockReturnValueOnce([
            { isSphere: true, cx: 0, cy: 0, cz: 0, r: 1.5, color: '#ffff00' },
        ]);
        rendererThree.draw();
        expect(MeshBasicMaterial).toHaveBeenCalledWith(
            expect.objectContaining({ transparent: true })
        );
        stateApp.atoms = origAtoms;
    });
});
