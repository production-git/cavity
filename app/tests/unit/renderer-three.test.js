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
    MeshPhongMaterial: jest.fn().mockImplementation(() => ({})),
    Mesh: jest.fn().mockImplementation(() => ({ position: { set: jest.fn() } })),
    Color: jest.fn().mockImplementation(() => ({})),
    Group: jest.fn().mockImplementation(() => ({
        children: [],
        add: jest.fn(),
        remove: jest.fn(),
        rotation: { x: 0, y: 0 },
    })),
}));

jest.unstable_mockModule('../../state.js', () => ({
    app: {
        atoms: [
            { x: 0, y: 0, z: 0, t: 'Cu', id: 0 },
            { x: 1, y: 1, z: 1, t: 'O', id: 1 },
        ],
        angleX: 0,
        angleY: 0.5,
    },
    getCOL: jest.fn(() => '#4A90D9'),
    getRAD: jest.fn(() => 8),
}));

let rendererThree;

beforeAll(async () => {
    rendererThree = await import('../../renderer-three.js');
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
