import * as THREE from 'three';

export type TransferableAttributes = {
    position: Float32Array;
    normal: Float32Array;
    uv: Float32Array;
    color1: Uint8Array;
    color2: Uint8Array;
}

type BoundingSphere = {
    center: { x: number, y: number, z: number },
    radius: number,
};

export type TransferableGeometryData = {
    attributes: TransferableAttributes;
    indices: Uint32Array;
    boundingSphere?: BoundingSphere;
}

export class TransferableGeometry {

    data: TransferableGeometryData;

    constructor(vertexCount: number, triangleCount: number) {

        const position = new Float32Array(vertexCount * 3);
        const normal = new Float32Array(vertexCount * 3);
        const uv = new Float32Array(vertexCount * 2);
        const color1 = new Uint8Array(vertexCount * 4);
        const color2 = new Uint8Array(vertexCount * 4);
        const indices = new Uint32Array(triangleCount * 3);

        this.data = {
            attributes: { position, normal, uv, color1, color2 },
            indices
        };
    }

    public static getTransferablesArray(geometryData: TransferableGeometryData): ArrayBuffer[] {
        const transfer: ArrayBuffer[] = [];

        transfer.push(<ArrayBuffer>geometryData.attributes.position.buffer);
        transfer.push(<ArrayBuffer>geometryData.attributes.normal.buffer);
        transfer.push(<ArrayBuffer>geometryData.attributes.uv.buffer);
        transfer.push(<ArrayBuffer>geometryData.attributes.color1.buffer);
        transfer.push(<ArrayBuffer>geometryData.attributes.color2.buffer);
        transfer.push(<ArrayBuffer>geometryData.indices.buffer);

        return transfer;
    }

    public static getDataFromBufferGeometry(geometry: THREE.BufferGeometry): TransferableGeometryData {

        const position = <Float32Array>geometry.attributes.position.array;
        const normal = <Float32Array>geometry.attributes.normal.array;
        const uv = <Float32Array>geometry.attributes.uv.array;
        const color1 = <Uint8Array>geometry.attributes.color1.array;
        const color2 = <Uint8Array>geometry.attributes.color2.array;
        const indices = <Uint32Array>geometry.index?.array;

        const boundingSphere: BoundingSphere | undefined = geometry.boundingSphere ? {
            center: {
                x: geometry.boundingSphere.center.x,
                y: geometry.boundingSphere.center.y,
                z: geometry.boundingSphere.center.z,
            },
            radius: geometry.boundingSphere.radius
        } : undefined;

        return {
            attributes: { position, normal, uv, color1, color2 },
            indices,
            boundingSphere
        };
    }

    public static getBoundingSphere(geometryData: TransferableGeometryData): THREE.Sphere {

        return new THREE.Sphere(
            new THREE.Vector3(
                geometryData.boundingSphere?.center.x,
                geometryData.boundingSphere?.center.y,
                geometryData.boundingSphere?.center.z,
            ),
            geometryData.boundingSphere?.radius
        );
    }
}
