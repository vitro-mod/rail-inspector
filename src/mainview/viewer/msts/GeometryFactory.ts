import * as THREE from 'three';
import { MstsShape } from 'msts-parser';
import { TransferableAttributes, TransferableGeometryData } from './TransferableGeometry';

type PrimitiveGroup = {
    primStateIdx: number;
    vertexIdxs: number[];
};

export class GeometryFactory {

    create(data: TransferableGeometryData): THREE.BufferGeometry {
        const geometry = new THREE.BufferGeometry();
        geometry.setIndex(new THREE.Uint32BufferAttribute(data.indices, 1));
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.attributes.position, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(data.attributes.normal, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(data.attributes.uv, 2));
        geometry.setAttribute('color1', new THREE.Float32BufferAttribute(data.attributes.color1, 4));
        geometry.setAttribute('color2', new THREE.Float32BufferAttribute(data.attributes.color2, 4));

        return geometry;
    }

    createForShape(shape: MstsShape): THREE.BufferGeometry[] {
        const geometries = [];

        for (let dLevelIdx = 0; dLevelIdx < shape.distLevels.length; dLevelIdx++) {
            const dLevel = shape.distLevels[dLevelIdx];

            for (const subObject of dLevel.subObjects) {

                let nv2 = 0;

                const attributes: TransferableAttributes = {
                    position: new Float32Array(subObject.vertices.length * 3),
                    normal: new Float32Array(subObject.vertices.length * 3),
                    uv: new Float32Array(subObject.vertices.length * 2),
                    color1: new Float32Array(subObject.vertices.length * 4),
                    color2: new Float32Array(subObject.vertices.length * 4),
                };

                for (let k = 0; k < subObject.vertices.length; k++) {
                    if (subObject.vertices[k].index < 0) continue;

                    subObject.vertices[k].index = nv2++;
                    const k1 = subObject.vertices[k].pointIndex;
                    const point = shape.points[k1] || [0, 0, 0];
                    attributes.position[k * 3] = point[0];
                    attributes.position[k * 3 + 1] = point[1];
                    attributes.position[k * 3 + 2] = -point[2];

                    const ni = subObject.vertices[k].normalIndex;
                    const normal = shape.normals[ni] || [0, 0, 0];
                    attributes.normal[k * 3] = normal[0];
                    attributes.normal[k * 3 + 1] = normal[1];
                    attributes.normal[k * 3 + 2] = -normal[2];

                    // Use first UV index
                    const uvi = subObject.vertices[k].uvIndices[0] || 0;
                    const uv = shape.uvPoints[uvi] || [0, 0];
                    attributes.uv[k * 2] = uv[0];
                    attributes.uv[k * 2 + 1] = uv[1];

                    const dayColor = subObject.vertices[k].dayColor;
                    attributes.color1[k * 4 + 0] = (dayColor >> 16 & 255) / 255;
                    attributes.color1[k * 4 + 1] = (dayColor >> 8 & 255) / 255;
                    attributes.color1[k * 4 + 2] = (dayColor & 255) / 255;
                    attributes.color1[k * 4 + 3] = (dayColor >> 24 & 255) / 255;

                    const nightColor = subObject.vertices[k].nightColor;
                    attributes.color2[k * 4 + 0] = (nightColor >> 16 & 255) / 255;
                    attributes.color2[k * 4 + 1] = (nightColor >> 8 & 255) / 255;
                    attributes.color2[k * 4 + 2] = (nightColor & 255) / 255;
                    attributes.color2[k * 4 + 3] = (nightColor >> 24 & 255) / 255;
                }

                // A mesh can only have one matrix transform, so collect primitive
                // lists by matrix and represent their materials as geometry groups.
                const primitiveGroupsByMatrix = new Map<number, PrimitiveGroup[]>();
                for (let j = 0; j < subObject.primStateIdxs!.length; j++) {
                    const primStateIdx = subObject.primStateIdxs![j];
                    const triList = subObject.triLists![j];
                    const primState = shape.primStates[primStateIdx];
                    const vtxState = shape.vtxStates[primState.vStateIndex];
                    const matrixIndex = vtxState.matrixIdx;

                    let primitiveGroups = primitiveGroupsByMatrix.get(matrixIndex);
                    if (!primitiveGroups) {
                        primitiveGroups = [];
                        primitiveGroupsByMatrix.set(matrixIndex, primitiveGroups);
                    }

                    primitiveGroups.push({
                        primStateIdx,
                        vertexIdxs: triList.vertexIdxs,
                    });
                }

                for (const [matrixIndex, primitiveGroups] of primitiveGroupsByMatrix) {
                    const indexCount = primitiveGroups.reduce((sum, group) => sum + group.vertexIdxs.length, 0);
                    const indices = new Uint32Array(indexCount);

                    let indexOffset = 0;
                    for (let materialIndex = 0; materialIndex < primitiveGroups.length; materialIndex++) {
                        const primitiveGroup = primitiveGroups[materialIndex];

                        for (let k = 0; k < primitiveGroup.vertexIdxs.length; k += 3) {
                            const k1 = primitiveGroup.vertexIdxs[k];
                            const k2 = primitiveGroup.vertexIdxs[k + 1];
                            const k3 = primitiveGroup.vertexIdxs[k + 2];
                            const v1 = subObject.vertices[k1].index;
                            const v2 = subObject.vertices[k2].index;
                            const v3 = subObject.vertices[k3].index;
                            indices[indexOffset + k] = v3;
                            indices[indexOffset + k + 1] = v2;
                            indices[indexOffset + k + 2] = v1;
                        }

                        indexOffset += primitiveGroup.vertexIdxs.length;
                    }

                    const geometry = this.create({ attributes, indices });

                    indexOffset = 0;
                    for (let materialIndex = 0; materialIndex < primitiveGroups.length; materialIndex++) {
                        const indexLength = primitiveGroups[materialIndex].vertexIdxs.length;
                        geometry.addGroup(indexOffset, indexLength, materialIndex);
                        indexOffset += indexLength;
                    }

                    geometry.userData.matrixIndex = matrixIndex;
                    geometry.userData.primStateIdxs = primitiveGroups.map(group => group.primStateIdx);
                    geometry.userData.dLevelIdx = dLevelIdx;

                    geometries.push(geometry);
                }
            }
        }

        return geometries;
    }
}
