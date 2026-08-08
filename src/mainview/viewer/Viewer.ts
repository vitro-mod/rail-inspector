// src/viewer/Viewer.ts

import {
    AmbientLight,
    AxesHelper,
    Box3,
    Color,
    DirectionalLight,
    GridHelper,
    Mesh,
    Object3D,
    PerspectiveCamera,
    Scene,
    Vector3,
    LOD,
    LinearSRGBColorSpace
} from 'three'
import * as THREE from 'three';
import { WebGPURenderer } from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { disposeObject } from './disposeObject'
import { MstsShapeLoader } from './msts/MstsShapeLoader';
import { GeometryFactory } from './msts/GeometryFactory';
import { MaterialFactory } from './msts/MaterialFactory';
import { MstsTextureLoader } from './msts/MstsTextureLoader';
import { Cache } from './Cache';
import { RpcFileLoader } from './msts/RpcFileLoader';
import { IMstsLoader } from './msts/IMstsLoader';
import { FileDialogResult } from '../file-dialog';

export interface ViewerOptions {
    showGrid?: boolean
    showAxes?: boolean
    wireframe?: boolean
}

export class Viewer {
    private readonly scene = new Scene()
    private readonly webGPU: boolean
    private readonly camera = new PerspectiveCamera(45, 1, 0.01, 1000)
    private readonly renderer: WebGPURenderer
    private readonly controls: OrbitControls

    private readonly cache: Cache
    private readonly fileLoader: IMstsLoader
    private readonly textureLoader: MstsTextureLoader
    private readonly materialFactory: MaterialFactory
    private readonly geometryFactory: GeometryFactory
    private readonly shapeLoader: MstsShapeLoader

    private readonly grid = new GridHelper(100, 100)
    private readonly axes = new AxesHelper(1)

    private readonly resizeObserver: ResizeObserver

    private model: Object3D | null = null
    private disposed = false
    private wireframe = false

    public constructor(
        private readonly container: HTMLElement,
        options: ViewerOptions = {},
    ) {
        const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');

        this.scene.background = darkModeQuery.matches ? new Color(0x666666) : new Color(0xcccccc);

        this.webGPU = navigator.gpu !== undefined;

        this.renderer = new WebGPURenderer({ forceWebGL: !this.webGPU, antialias: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.outputColorSpace = LinearSRGBColorSpace;
        this.container.appendChild(this.renderer.domElement)

        this.camera.position.set(5, 3, 5)

        this.controls = new OrbitControls(
            this.camera,
            this.renderer.domElement,
        )
        this.controls.enableDamping = false
        this.controls.mouseButtons = {
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.PAN,
            RIGHT: THREE.MOUSE.DOLLY
        }
        this.controls.zoomSpeed = 3;

        this.setupScene()

        this.setGridVisible(options.showGrid ?? true)
        this.setAxesVisible(options.showAxes ?? false)
        this.setWireframe(options.wireframe ?? false)

        this.resizeObserver = new ResizeObserver(() => {
            this.onResize()
        })
        this.resizeObserver.observe(this.container)

        this.onResize()
        this.renderer.setAnimationLoop(this.animate.bind(this))

        this.cache = new Cache();
        this.fileLoader = new RpcFileLoader();
        this.textureLoader = new MstsTextureLoader(this.cache, this.fileLoader, {
            initTextureAsync: (texture) => this.renderer.initTextureAsync(texture)
        });
        this.materialFactory = new MaterialFactory(this.cache, this.textureLoader);
        this.geometryFactory = new GeometryFactory();
        this.shapeLoader = new MstsShapeLoader(this.cache, this.fileLoader, this.textureLoader, this.materialFactory, this.geometryFactory);
    }

    public async loadModel(url: FileDialogResult): Promise<LOD> {
        if (!url.path || !url.file) {
            throw new Error('No file specified in FileDialogResult');
        }
        const model = await this.shapeLoader.load(url.path, url.dir ?? '', 0);
        console.log('Model loaded:', model);
        return model;
    }

    public async setModel(model: Object3D): Promise<void> {
        this.clearModel();

        this.model = model
        this.scene.add(model)

        this.applyWireframe(model, this.wireframe)
        this.frameObject(model)
    }

    public clearModel(): void {
        if (!this.model) {
            return
        }

        this.model.removeFromParent()
        disposeObject(this.model)
        this.model = null
    }

    public setGridVisible(visible: boolean): void {
        this.grid.visible = visible
    }

    public setAxesVisible(visible: boolean): void {
        this.axes.visible = visible
    }

    public setWireframe(enabled: boolean): void {
        this.wireframe = enabled

        if (this.model) {
            this.applyWireframe(this.model, enabled)
        }
    }

    public frameModel(): void {
        if (this.model) {
            this.frameObject(this.model)
        }
    }

    public dispose(): void {
        if (this.disposed) {
            return
        }

        this.disposed = true

        this.resizeObserver.disconnect()
        this.controls.dispose()

        this.clearModel()

        this.renderer.dispose()
        this.renderer.domElement.remove()
    }

    private setupScene(): void {
        this.scene.add(this.grid)
        this.scene.add(this.axes)

        const ambientLight = new AmbientLight(0xffffff, 1.5)
        this.scene.add(ambientLight)

        const directionalLight = new DirectionalLight(0xffffff, 2)
        directionalLight.position.set(4, 8, 6)
        this.scene.add(directionalLight)
    }

    private onResize(): void {
        const width = window.innerWidth
        const height = window.innerHeight

        if (width <= 0 || height <= 0) {
            return
        }

        this.camera.aspect = width / height
        this.camera.updateProjectionMatrix()

        this.renderer.setSize(width, height, false)
    }

    private animate(): void {
        if (this.disposed) {
            return
        }

        this.controls.update()
        this.renderer.render(this.scene, this.camera)
    }

    private frameObject(object: Object3D): void {
        const bounds = new Box3().setFromObject(object)

        if (bounds.isEmpty()) {
            return
        }

        const center = bounds.getCenter(new Vector3())
        const size = bounds.getSize(new Vector3())
        const radius = Math.max(size.x, size.y, size.z) / 4

        const verticalFov = this.camera.fov * Math.PI / 180
        const verticalDistance = radius / Math.tan(verticalFov / 2)

        const horizontalFov = 2 * Math.atan(
            Math.tan(verticalFov / 2) * this.camera.aspect,
        )
        const horizontalDistance = radius / Math.tan(horizontalFov / 2)

        const distance = Math.max(verticalDistance, horizontalDistance) * 1.5

        const direction = new Vector3(-1, 0, 0).normalize()

        this.camera.position.copy(center).addScaledVector(direction, distance)
        this.camera.near = Math.max(distance / 1000, 0.001)
        this.camera.far = Math.max(distance * 100, 1000)
        this.camera.updateProjectionMatrix()

        this.controls.target.copy(center)
        this.controls.update()
    }

    private applyWireframe(root: Object3D, enabled: boolean): void {
        root.traverse(object => {
            if (!(object instanceof Mesh)) {
                return
            }

            const materials = Array.isArray(object.material)
                ? object.material
                : [object.material]

            for (const material of materials) {
                if ('wireframe' in material) {
                    material.wireframe = enabled
                    material.needsUpdate = true
                }
            }
        })
    }
}