import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { Button, Tooltip } from 'antd';
import { Text, OrbitControls } from '@react-three/drei';
import { ReloadOutlined, MinusOutlined, DownloadOutlined } from "@ant-design/icons";

export const Chromosome3DDistance = ({ selectedSphereList, setShowChromosome3DDistance }) => {
    const controlsRef = useRef();
    const cameraRef = useRef();
    const rendererRef = useRef();

    const spheresData = useMemo(() => {
        return Object.values(selectedSphereList).map(({ position, color }) => {
            const { x, y, z } = position;
            return {
                position: new THREE.Vector3(x / 0.15, y / 0.15, z / 0.15),
                color,
            };
        });
    }, [selectedSphereList]);

    const center = useMemo(() => {
        if (spheresData.length === 0) return new THREE.Vector3();
        const group = new THREE.Group();
        spheresData.forEach(({ position }) => {
            const sphere = new THREE.Mesh(
                new THREE.SphereGeometry(2.5, 32, 32),
                new THREE.MeshBasicMaterial()
            );
            sphere.position.copy(position);
            group.add(sphere);
        });

        const box = new THREE.Box3().setFromObject(group);
        const calculatedCenter = new THREE.Vector3();
        box.getCenter(calculatedCenter);
        return calculatedCenter;
    }, [spheresData]);

    const download = () => {
        if (rendererRef.current) {
            const { gl, scene, camera } = rendererRef.current;

            const width = window.innerWidth * 2;
            const height = window.innerHeight * 2;
            const renderTarget = new THREE.WebGLRenderTarget(width, height);

            // render the scene to the RenderTarget
            const originalTarget = gl.getRenderTarget?.();
            gl.setRenderTarget(renderTarget);
            gl.render(scene, camera);
            gl.setRenderTarget(originalTarget);

            // extract the pixel data from the RenderTarget
            const pixelBuffer = new Uint8Array(width * height * 4);
            gl.readRenderTargetPixels(renderTarget, 0, 0, width, height, pixelBuffer);

            // create a canvas and context to draw the image data
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            const imageData = ctx.createImageData(width, height);

            // flip the image data vertically
            for (let row = 0; row < height; row++) {
                const rowOffset = row * width * 4;
                const flippedRowOffset = (height - row - 1) * width * 4;
                imageData.data.set(pixelBuffer.slice(rowOffset, rowOffset + width * 4), flippedRowOffset);
            }
            ctx.putImageData(imageData, 0, 0);

            // generate download link
            const link = document.createElement('a');
            link.href = canvas.toDataURL('image/png');
            link.download = 'chromosome_3d_distance.png';
            link.click();

            renderTarget.dispose();
        } else {
            console.error("Renderer not properly initialized for download.");
        }
    };

    useEffect(() => {
        if (controlsRef.current && center) {
            controlsRef.current.target.copy(center);
            controlsRef.current.update();
        }
    }, [center]);

    const resetView = () => {
        if (controlsRef.current) {
            controlsRef.current.reset();
            controlsRef.current.target.copy(center);
            controlsRef.current.update();
        }
    };

    const Line = ({ start, end }) => {
        const geometryRef = useRef();
        useEffect(() => {
            if (geometryRef.current) {
                geometryRef.current.setAttribute(
                    'position',
                    new THREE.Float32BufferAttribute([
                        start.x, start.y, start.z,
                        end.x, end.y, end.z,
                    ], 3)
                );
            }
        }, [start, end]);

        return (
            <line>
                <bufferGeometry ref={geometryRef} />
                <lineBasicMaterial color="white" />
            </line>
        );
    };

    return (
        <>
            <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                <div style={{
                    position: 'absolute',
                    top: 10,
                    right: 10,
                    zIndex: 10,
                    display: 'flex',
                    gap: '10px',
                }}>
                    <Tooltip placement="bottom" title="Reset 3D chromosome distance position" overlayInnerStyle={{ color: '#333' }} color={"white"}>
                        <Button
                            style={{
                                fontSize: 15,
                                cursor: "pointer",
                            }}
                            icon={<ReloadOutlined />}
                            onClick={resetView}
                        />
                    </Tooltip>
                    <Tooltip placement="bottom" title="Download current 3D chromosome distance structure image" overlayInnerStyle={{ color: '#333' }} color={"white"}>
                        <Button
                            style={{
                                fontSize: 15,
                                cursor: "pointer",
                            }}
                            icon={<DownloadOutlined />}
                            onClick={download}
                        />
                    </Tooltip>
                    <Tooltip placement="bottom" title="Close 3D chromosome distance view" overlayInnerStyle={{ color: '#333' }} color={"white"}>
                        <Button
                            style={{
                                fontSize: 15,
                                cursor: "pointer",
                            }}
                            icon={<MinusOutlined />}
                            onClick={() => setShowChromosome3DDistance(false)}
                        />
                    </Tooltip>
                </div>

                <Canvas
                    shadows
                    style={{ height: 'calc(100% - 2px)', backgroundColor: '#222' }}
                    camera={{ position: [0, 0, 100], fov: 50 }}
                    onCreated={({ camera, gl, scene }) => {
                        cameraRef.current = camera;
                        rendererRef.current = { gl, scene, camera };
                        if (controlsRef.current) {
                            controlsRef.current.update();
                        }
                    }}
                >
                    <OrbitControls
                        ref={controlsRef}
                        enableZoom={true}
                        enableRotate={true}
                        enablePan={false}
                        target={center}
                    />

                    <ambientLight intensity={0.8} />
                    <directionalLight
                        position={[10, 20, 10]}
                        intensity={1}
                        castShadow
                    />
                    <spotLight
                        position={[30, 50, 50]}
                        angle={0.3}
                        penumbra={1}
                        intensity={1}
                        castShadow
                    />

                    {spheresData.map(({ position, color }, index) => (
                        <group key={index} position={position}>
                            <mesh>
                                <sphereGeometry args={[2.5, 32, 32]} />
                                <meshStandardMaterial
                                    receiveShadow
                                    castShadow
                                    color={color}
                                    metalness={0.3}
                                    roughness={0.1}
                                    emissiveIntensity={0.3} />
                            </mesh>
                            <mesh>
                                <sphereGeometry args={[2.7, 32, 32]} />
                                <meshBasicMaterial color="white" side={THREE.BackSide} />
                            </mesh>
                        </group>
                    ))}

                    {spheresData.map(({ position: positionA }, indexA) => (
                        spheresData.map(({ position: positionB }, indexB) => {
                            if (indexA < indexB) {
                                const distance = positionA.distanceTo(positionB);
                                const midPoint = new THREE.Vector3().addVectors(positionA, positionB).multiplyScalar(0.5);

                                return (
                                    <group key={`${indexA}-${indexB}`}>
                                        <Line start={positionA} end={positionB} />
                                        <Text
                                            position={[midPoint.x, midPoint.y, midPoint.z]}
                                            fontSize={10}
                                            color="white"
                                            anchorX="center"
                                            anchorY="middle"
                                        >
                                            {distance.toFixed(2)}
                                        </Text>
                                    </group>
                                );
                            }
                            return null;
                        })
                    ))}
                </Canvas>
            </div>
        </>
    );
};