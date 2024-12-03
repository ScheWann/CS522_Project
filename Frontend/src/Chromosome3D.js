import React, { useMemo, useState, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { OrbitControls } from '@react-three/drei';
import { Button, ColorPicker, Switch, Tooltip } from 'antd';
import { DownloadOutlined, ReloadOutlined, ClearOutlined } from "@ant-design/icons";
import { Chromosome3DDistance } from './Chromosome3DDistance';
import "./Styles/Chromosome3D.css";

export const Chromosome3D = ({ chromosome3DExampleData, validChromosomeValidIbpData, selectedChromosomeSequence, geneSize }) => {
    const scaleFactor = 0.15;
    const canvasRef = useRef();
    const controlsRef = useRef();
    const rendererRef = useRef();

    const [hoveredIndex, setHoveredIndex] = useState(null);
    const [selectedIndex, setSelectedIndex] = useState(null);
    const [selectedSphereList, setSelectedSphereList] = useState({});
    const [showChromosome3DDistance, setShowChromosome3DDistance] = useState(false);
    const [geneBeadSeq, setGeneBeadSeq] = useState([]);
    const [isFullGeneVisible, setIsFullGeneVisible] = useState(true);

    const step = 5000;
    const newStart = Math.ceil(selectedChromosomeSequence.start / step) * step;

    useMemo(() => {
        if (geneSize.start > 0 && geneSize.end > 0) {
            const geneStart = Math.floor(geneSize.start / step) * step;
            const geneEnd = Math.ceil(geneSize.end / step) * step;
            const result = [];
            for (let i = geneStart; i <= geneEnd; i += step) {
                result.push(i);
            }
            setGeneBeadSeq(result);
        }
    }, [geneSize]);

    const processedChromosomeData = useMemo(() => {
        return chromosome3DExampleData.map((data, index) => {
            const marker = newStart + index * step;
            const isValid = validChromosomeValidIbpData.includes(marker);
            const isGeneBead = geneBeadSeq.includes(marker);

            return {
                ...data,
                marker,
                isValid,
                isGeneBead
            };
        });
    }, [chromosome3DExampleData, validChromosomeValidIbpData, geneBeadSeq]);

    const coordinates = useMemo(() => {
        return processedChromosomeData.map((data) => {
            const x = data.x * scaleFactor;
            const y = data.y * scaleFactor;
            const z = data.z * scaleFactor;
            return new THREE.Vector3(x, y, z);
        });
    }, [processedChromosomeData]);

    const blendColors = (color1, color2) => {
        const color1Obj = new THREE.Color(color1);
        const color2Obj = new THREE.Color(color2);

        const blendedColor = new THREE.Color();
        blendedColor.r = (color1Obj.r + color2Obj.r) / 2;
        blendedColor.g = (color1Obj.g + color2Obj.g) / 2;
        blendedColor.b = (color1Obj.b + color2Obj.b) / 2;

        return blendedColor;
    }

    const download = () => {
        if (rendererRef.current && rendererRef.current.gl) {
            const { gl, scene, camera } = rendererRef.current;

            const width = window.innerWidth * 2;
            const height = window.innerHeight * 2;

            const renderTarget = new THREE.WebGLRenderTarget(width, height, {
                minFilter: THREE.LinearFilter,
                magFilter: THREE.LinearFilter,
                format: THREE.RGBAFormat,
            });

            // render the scene to the RenderTarget
            const originalTarget = gl.getRenderTarget();
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

            // copy the pixel data to the ImageData
            for (let i = 0; i < pixelBuffer.length; i++) {
                imageData.data[i] = pixelBuffer[i];
            }
            ctx.putImageData(imageData, 0, 0);

            const link = document.createElement('a');
            link.href = canvas.toDataURL('image/png');
            link.download = 'chromosome_3d.png';
            link.click();

            renderTarget.dispose();
        }
    };

    const resetView = () => {
        if (controlsRef.current) {
            controlsRef.current.reset();
        }
    };

    const resetSelectedBead = () => {
        setHoveredIndex(null);
        setSelectedIndex(null);
        setSelectedSphereList({});
    };

    const handleColorChange = (color) => {
        if (selectedIndex !== null) {
            setSelectedSphereList((prev) => ({
                ...prev,
                [selectedIndex]: {
                    color: color.toHexString(),
                    position: {
                        x: coordinates[selectedIndex].x,
                        y: coordinates[selectedIndex].y,
                        z: coordinates[selectedIndex].z,
                    },
                },
            }));
        }
    };

    const handleResetSelect = (index) => {
        if (selectedSphereList[index]?.color) {
            // Reset the sphere's color
            setSelectedSphereList((prev) => {
                const updatedList = { ...prev };
                delete updatedList[index];
                return updatedList;
            });
        } else {
            setSelectedIndex(null);
        }
    };

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            {/* Container for buttons */}
            <div style={{
                position: 'absolute',
                top: 10,
                right: 10,
                zIndex: 10,
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
            }}>
                <Tooltip placement="bottom" title="After gene selection, the gene distribution displayed in whole or in part on the 3D chromosome can be controlled by it" overlayInnerStyle={{ color: '#333' }} color={"white"}>
                    <Switch
                        checkedChildren="All Genes"
                        unCheckedChildren="First Gene"
                        disabled={geneBeadSeq.length === 0}
                        checked={isFullGeneVisible}
                        style={{
                            backgroundColor: isFullGeneVisible ? '#DAA520' : '#262626'
                        }}
                        onChange={() => setIsFullGeneVisible(!isFullGeneVisible)}
                    />
                </Tooltip>
                <Tooltip placement="bottom" title="Used for users to customize the color of the selected bead" overlayInnerStyle={{ color: '#333' }} color={"white"}>
                    <ColorPicker
                        value={selectedSphereList[selectedIndex]?.color || '#ffffff'}
                        disabled={selectedIndex === null}
                        onChange={handleColorChange}
                    />
                </Tooltip>
                <Tooltip placement="bottom" title="Clear the selected beads" overlayInnerStyle={{ color: '#333' }} color={"white"}>
                    <Button
                        style={{
                            fontSize: 15,
                            cursor: "pointer",
                        }}
                        icon={<ClearOutlined />}
                        onClick={resetSelectedBead}
                    />
                </Tooltip>
                <Tooltip placement="bottom" title="Reset 3D chromosome position" overlayInnerStyle={{ color: '#333' }} color={"white"}>
                    <Button
                        style={{
                            fontSize: 15,
                            cursor: "pointer",
                        }}
                        icon={<ReloadOutlined />}
                        onClick={resetView}
                    />
                </Tooltip>
                <Tooltip placement="bottom" title="Download current 3D chromosome structure image" overlayInnerStyle={{ color: '#333' }} color={"white"}>
                    <Button
                        style={{
                            fontSize: 15,
                            cursor: "pointer",
                        }}
                        icon={<DownloadOutlined />}
                        onClick={download}
                    />
                </Tooltip>
                <Tooltip placement="bottom" title="Generate a 3D distance map below based on the selected beads" overlayInnerStyle={{ color: '#333' }} color={"white"}>
                    <Button
                        className={`custom-button ${Object.keys(selectedSphereList).length < 2 ? 'disabled' : ''}`}
                        disabled={Object.keys(selectedSphereList).length < 2}
                        onClick={() => setShowChromosome3DDistance(true)}
                    >
                        Generate Distance
                    </Button>
                </Tooltip>
            </div>

            <div style={{ height: showChromosome3DDistance ? '65%' : '100%', transition: 'height 0.3s ease' }}>
                <Canvas
                    shadows
                    ref={canvasRef}
                    camera={{ position: [0, 0, 230], fov: 75 }}
                    style={{ width: '100%', height: '100%', backgroundColor: '#333' }}
                    onCreated={({ gl, scene, camera }) => {
                        rendererRef.current = { gl, scene, camera };
                    }}
                >
                    <OrbitControls
                        ref={controlsRef}
                        enableZoom={true}
                        enableRotate={true}
                        enablePan={true}
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

                    {coordinates.map((coord, index) => {
                        const isFirst = index === 0;
                        const isLast = index === coordinates.length - 1;
                        const isValid = processedChromosomeData[index].isValid;
                        const isGeneBead = processedChromosomeData[index].isGeneBead;
                        const isGeneStart = geneBeadSeq[0] === processedChromosomeData[index].marker;

                        // Gene beads shows control
                        const shouldRender =
                            geneBeadSeq.length > 0 && isFullGeneVisible
                                ? isGeneBead
                                : isGeneStart;

                        const blendIfInvalid = (baseColor) => blendColors(baseColor, '#FFFFFF');

                        // first bead: green, last bead: blue
                        const originalColor = isFirst ? '#00FF00' : isLast ? '#0000FF' : null;

                        const geneBeadColor = isValid
                            ? '#FFD700' // gold
                            : isFirst
                                ? blendIfInvalid('#00FF00') // mix green and white
                                : isLast
                                    ? blendIfInvalid('#0000FF') // mix blue and white
                                    : blendIfInvalid('#FFD700'); // mix gold and white

                        const validColor = selectedSphereList[index]?.color ||
                            (hoveredIndex === index || selectedIndex === index
                                ? '#F7E7CE'
                                : isFirst || isLast
                                    ? originalColor
                                    : '#669bbc');

                        const currentColor = shouldRender
                            ? geneBeadColor
                            : isValid
                                ? validColor
                                : isFirst
                                    ? blendIfInvalid('#00FF00') // invalid start bead mix green and white
                                    : isLast
                                        ? blendIfInvalid('#0000FF') // invalid end bead mix blue and white
                                        : '#FFFFFF';  // default invalid bead color

                        return (
                            <group
                                key={index}
                                position={coord}
                                onPointerOver={(e) => {
                                    e.stopPropagation();
                                    setHoveredIndex(index);
                                }}
                                onPointerOut={(e) => {
                                    e.stopPropagation();
                                    setHoveredIndex(null);
                                }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedIndex(index);
                                }}
                                onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    handleResetSelect(index);
                                }}
                            >
                                {/* Sphere Mesh */}
                                <mesh>
                                    <sphereGeometry args={[2.8, 32, 32]} />
                                    <meshStandardMaterial
                                        receiveShadow
                                        castShadow
                                        color={currentColor}
                                        metalness={0.3}
                                        roughness={0.1}
                                        emissiveIntensity={0.3}
                                    />
                                </mesh>
                                {/* Outline Mesh */}
                                <mesh>
                                    <sphereGeometry args={[3, 32, 32]} />
                                    <meshBasicMaterial color="white" side={THREE.BackSide} />
                                </mesh>
                            </group>
                        );
                    })}
                </Canvas>
            </div>

            {showChromosome3DDistance && (
                <div style={{ height: '35%', marginTop: 2 }}>
                    <Chromosome3DDistance
                        setShowChromosome3DDistance={setShowChromosome3DDistance}
                        selectedSphereList={selectedSphereList}
                    />
                </div>
            )}
        </div>
    );
};
