// src/viewer/disposeObject.ts

import {
    Material,
    Mesh,
    Object3D,
    Texture,
} from 'three'

export function disposeObject(root: Object3D): void {
    root.traverse(object => {
        if (!(object instanceof Mesh)) {
            return
        }

        object.geometry.dispose()

        const materials = Array.isArray(object.material)
            ? object.material
            : [object.material]

        for (const material of materials) {
            disposeMaterial(material)
        }
    })
}

function disposeMaterial(material: Material): void {
    for (const value of Object.values(material)) {
        if (value instanceof Texture) {
            value.dispose()
        }
    }

    material.dispose()
}