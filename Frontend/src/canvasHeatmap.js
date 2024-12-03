import React, { useEffect, useRef, useState } from 'react';
import { Button, Tooltip, Modal } from "antd";
import { DownloadOutlined, ReloadOutlined, FullscreenOutlined } from "@ant-design/icons";
import { GeneList } from './geneList.js';
import { HeatmapTriangle } from './heatmapTriangle.js';
import * as d3 from 'd3';

export const Heatmap = ({ cellLineName, chromosomeName, chromosomeData, selectedChromosomeSequence, totalChromosomeSequences, geneList, setSelectedChromosomeSequence, chromosome3DExampleID, setChromosome3DLoading, setGeneName, geneName, geneSize, setChromosome3DExampleData, setComparisonCellLine3DLoading, setComparisonCellLine3DData, setGeneSize }) => {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const brushSvgRef = useRef(null);
    const axisSvgRef = useRef(null);
    const [minDimension, setMinDimension] = useState(0);
    const [currentChromosomeSequence, setCurrentChromosomeSequence] = useState(selectedChromosomeSequence);
    const [currentChromosomeData, setCurrentChromosomeData] = useState(chromosomeData);
    const [halfHeatMapModalVisible, setHalfHeatMapModalVisible] = useState(false);

    const download = () => {
        if (chromosomeData) {
            const filteredData = chromosomeData.filter(row => row.fdr < 0.05);

            if (filteredData.length === 0) {
                alert("no suitable data (fdr < 0.05)");
                return;
            }

            const csvData = filteredData.map(row =>
                `${row.cell_line},${row.chrid},${row.ibp},${row.jbp},${row.fq},${row.fdr}`
            ).join('\n');

            const header = 'cell_line,chrid,ibp,jbp,fq,fdr\n';
            const csvContent = header + csvData;

            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = url;
            link.download = `${cellLineName}.${chromosomeName}.${selectedChromosomeSequence.start}.${selectedChromosomeSequence.end}.csv`;
            link.click();

            URL.revokeObjectURL(url);
        }
    };

    const fetchExampleChromos3DData = (cell_line, sample_id, sampleChange, isComparison) => {
        if (cell_line && chromosomeName && selectedChromosomeSequence) {
            fetch("/getExampleChromos3DData", {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ cell_line: cell_line, chromosome_name: chromosomeName, sequences: currentChromosomeSequence, sample_id: sample_id })
            })
                .then(res => res.json())
                .then(data => {
                    if (isComparison) {
                        setComparisonCellLine3DData(data);
                        setComparisonCellLine3DLoading(false);
                    } else {
                        setChromosome3DExampleData(data);
                        if (sampleChange === "submit") {
                            setChromosome3DLoading(false);
                        }
                    }
                });
        }
    };

    const generate3DChromosome = () => {
        setSelectedChromosomeSequence(currentChromosomeSequence);
        setChromosome3DLoading(true);
        fetchExampleChromos3DData(cellLineName, chromosome3DExampleID, "submit", false);
    };

    const openHalfHeatMapModal = () => {
        setHalfHeatMapModalVisible(true);
    }

    useEffect(() => {
        const parentWidth = containerRef.current.offsetWidth;
        const parentHeight = containerRef.current.offsetHeight;
        const margin = { top: 45, right: 10, bottom: 45, left: 60 };

        setMinDimension(Math.min(parentWidth, parentHeight));
        const width = Math.min(parentWidth, parentHeight) - margin.left - margin.right;
        const height = Math.min(parentWidth, parentHeight) - margin.top - margin.bottom;

        const zoomedChromosomeData = chromosomeData.filter(item => {
            const { ibp, jbp } = item;
            return ibp >= currentChromosomeSequence.start && ibp <= currentChromosomeSequence.end &&
                jbp >= currentChromosomeSequence.start && jbp <= currentChromosomeSequence.end;
        });

        setCurrentChromosomeData(zoomedChromosomeData);

        // Draw canvas
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        canvas.width = width + margin.left + margin.right;
        canvas.height = height + margin.top + margin.bottom;

        context.clearRect(0, 0, canvas.width, canvas.height);

        const { start, end } = currentChromosomeSequence;
        const step = 5000;
        const adjustedStart = Math.floor(start / step) * step;
        const adjustedEnd = Math.ceil(end / step) * step;

        const axisValues = Array.from(
            { length: Math.floor((adjustedEnd - adjustedStart) / step) + 1 },
            (_, i) => adjustedStart + i * step
        );

        const xScale = d3.scaleBand()
            .domain(axisValues)
            .range([0, width])
            .padding(0.1);

        const yScale = d3.scaleBand()
            .domain(axisValues)
            .range([height, 0])
            .padding(0.1);

        const colorScale = d3.scaleSequential(
            t => d3.interpolateReds(t * 0.8 + 0.2)
        ).domain([0, d3.max(zoomedChromosomeData, d => d.fq)]);

        const fqMap = new Map();

        zoomedChromosomeData.forEach(d => {
            fqMap.set(`X:${d.ibp}, Y:${d.jbp}`, { fq: d.fq, fdr: d.fdr });
            fqMap.set(`X:${d.jbp}, Y:${d.ibp}`, { fq: d.fq, fdr: d.fdr });
        });

        const hasData = (ibp, jbp) => {
            const inRange = totalChromosomeSequences.some(seq =>
                ibp >= seq.start && ibp <= seq.end &&
                jbp >= seq.start && jbp <= seq.end
            );

            return inRange;
        };

        // Draw heatmap using Canvas
        axisValues.forEach(ibp => {
            axisValues.forEach(jbp => {
                const { fq, fdr } = fqMap.get(`X:${ibp}, Y:${jbp}`) || fqMap.get(`X:${jbp}, Y:${ibp}`) || { fq: -1, fdr: -1 };

                const x = margin.left + xScale(jbp);
                const y = margin.top + yScale(ibp);
                const width = xScale.bandwidth();
                const height = yScale.bandwidth();

                context.fillStyle = !hasData(ibp, jbp) ? 'white' : (jbp <= ibp && (fdr > 0.05 || (fdr === -1 && fq === -1))) ? 'white' : colorScale(fq);
                context.fillRect(x, y, width, height);
            });
        });

        const axisSvg = d3.select(axisSvgRef.current)
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom);

        axisSvg.selectAll('*').remove();

        // Calculate the range of the current chromosome sequence
        const range = currentChromosomeSequence.end - currentChromosomeSequence.start;

        // Dynamically determine the tick count based on the range
        let tickCount;
        if (range < 1000000) {
            tickCount = Math.max(Math.floor(range / 20000), 5);
        } else if (range >= 1000000 && range <= 10000000) {
            tickCount = Math.max(Math.floor(range / 50000), 5);
        } else {
            tickCount = 30;
        }

        tickCount = Math.min(tickCount, 30);

        // X-axis
        axisSvg.append('g')
            .attr('transform', `translate(${margin.left}, ${margin.top + height})`)
            .call(d3.axisBottom(xScale)
                .tickValues(axisValues.filter((_, i) => i % tickCount === 0))
                .tickFormat(d => {
                    if (d >= 1000000) {
                        return `${(d / 1000000).toFixed(3)}M`;
                    }
                    if (d > 10000 && d < 1000000) {
                        return `${(d / 10000).toFixed(3)}W`;
                    }
                    return d;
                }))
            .selectAll("text")
            .style("text-anchor", "end")
            .attr("transform", "rotate(-45)")
            .attr("dx", "-1em")
            .attr("dy", "0em");

        // Y-axis
        axisSvg.append('g')
            .attr('transform', `translate(${margin.left}, ${margin.top})`)
            .call(d3.axisLeft(yScale)
                .tickValues(axisValues.filter((_, i) => i % tickCount === 0))
                .tickFormat(d => {
                    if (d >= 1000000) {
                        return `${(d / 1000000).toFixed(3)}M`;
                    }
                    if (d > 10000 && d < 1000000) {
                        return `${(d / 10000).toFixed(3)}W`;
                    }
                    return d;
                }));

        // Brush for selecting range
        const brushSvg = d3.select(brushSvgRef.current)
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom);

        brushSvg.selectAll('*').remove();

        brushSvg.append('g')
            .attr('class', 'brush')
            .call(d3.brushX()
                .extent([[margin.left, margin.top], [width + margin.left, height + margin.top]])
                .on('end', ({ selection }) => {
                    if (!selection) {
                        setCurrentChromosomeSequence(selectedChromosomeSequence);
                        return;
                    }

                    const [x0, x1] = selection;
                    const brushedX = axisValues.filter(val => {
                        const pos = margin.left + xScale(val) + xScale.bandwidth() / 2;
                        return pos >= x0 && pos <= x1;
                    });
                    setCurrentChromosomeSequence({ start: brushedX[0], end: brushedX[brushedX.length - 1] });
                })
            );

        let adjustedGeneStart, adjustedGeneEnd;

        if (geneSize) {
            adjustedGeneStart = Math.floor(geneSize.start / step) * step;
            adjustedGeneEnd = Math.ceil(geneSize.end / step) * step;
        }

        // Draw gene range lines if geneSize exists
        if (geneSize && xScale(adjustedGeneStart) !== undefined && xScale(adjustedGeneEnd) !== undefined) {
            const geneStartPos = margin.left + xScale(adjustedGeneStart);
            const geneEndPos = margin.left + xScale(adjustedGeneEnd);

            axisSvg.append('line')
                .attr('x1', geneStartPos)
                .attr('x2', geneStartPos)
                .attr('y1', margin.top)
                .attr('y2', margin.top + height)
                .attr('stroke', '#999')
                .attr('stroke-width', 2);

            axisSvg.append('line')
                .attr('x1', geneEndPos)
                .attr('x2', geneEndPos)
                .attr('y1', margin.top)
                .attr('y2', margin.top + height)
                .attr('stroke', '#999')
                .attr('stroke-width', 2);
        }
    }, [minDimension, currentChromosomeSequence, geneSize]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', width: '35%', height: '100%' }}>
            <div ref={containerRef} style={{
                width: '100%', height: '72%', borderRight: "1px solid #eaeaea", position: 'relative', display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
            }}>
                <div style={{
                    position: 'absolute', top: 0, right: 0, zIndex: 10, display: 'flex', gap: '10px', width: '100%', justifyContent: 'space-between', padding: "5px 0 5px 0", borderBottom: "1px solid #eaeaea", alignItems: 'center'
                }}>
                    <div style={{ fontSize: 12, fontWeight: 'bold', marginLeft: 10 }}>
                        <span style={{ marginRight: 5 }}>{currentChromosomeSequence.start}</span>
                        <span style={{ marginRight: 5 }}>~</span>
                        <span>{currentChromosomeSequence.end}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '5px' }}>
                        <Tooltip placement="bottom" title="Reset to the original sequence" overlayInnerStyle={{ color: '#333' }} color={"white"}>
                            <Button
                                size='small'
                                style={{
                                    fontSize: 12,
                                    cursor: "pointer",
                                }}
                                icon={<ReloadOutlined />}
                                onClick={() => setCurrentChromosomeSequence(selectedChromosomeSequence)}
                            />
                        </Tooltip>
                        <Tooltip placement="bottom" title="View detailed heatmap triangle area" overlayInnerStyle={{ color: '#333' }} color={"white"}>
                            <Button
                                size='small'
                                style={{
                                    fontSize: 12,
                                    cursor: "pointer",
                                }}
                                icon={<FullscreenOutlined />}
                                onClick={openHalfHeatMapModal}
                            />
                        </Tooltip>
                        <Tooltip placement="bottom" title="Download non random HiC data(fdr < 0.05)" overlayInnerStyle={{ color: '#333' }} color={"white"}>
                            <Button
                                size='small'
                                style={{
                                    fontSize: 12,
                                    cursor: "pointer",
                                }}
                                icon={<DownloadOutlined />}
                                onClick={download}
                            />
                        </Tooltip>
                        <Tooltip placement="bottom" title="Generate a 3D chromosome structure based on your current sequence selection" overlayInnerStyle={{ color: '#333' }} color={"white"}>
                            <Button size='small' color="primary" variant="outlined" onClick={generate3DChromosome} style={{ marginRight: 5, fontSize: 12 }}>
                                Generate 3D
                            </Button>
                        </Tooltip>
                    </div>
                </div>
                <Modal open={halfHeatMapModalVisible} onOk={() => setHalfHeatMapModalVisible(false)} onCancel={() => setHalfHeatMapModalVisible(false)} footer={null} width={"60vw"} styles={{ body: { overflowY: 'auto', maxHeight: '80vh' } }} >
                    <HeatmapTriangle
                        geneList={geneList}
                        cellLineName={cellLineName}
                        chromosomeName={chromosomeName}
                        totalChromosomeSequences={totalChromosomeSequences}
                        currentChromosomeData={currentChromosomeData}
                        currentChromosomeSequence={currentChromosomeSequence}
                        geneName={geneName}
                    />
                </Modal>
                <canvas ref={canvasRef} style={{ position: 'absolute', zIndex: 0 }} />
                <svg ref={axisSvgRef} style={{ position: 'absolute', zIndex: 1, pointerEvents: 'none' }} />
                <svg ref={brushSvgRef} style={{ position: 'absolute', zIndex: 2, pointerEvents: 'all' }} />
            </div>
            {minDimension > 0 && (
                <GeneList
                    geneList={geneList}
                    cellLineName={cellLineName}
                    chromosomeName={chromosomeName}
                    currentChromosomeSequence={currentChromosomeSequence}
                    minDimension={minDimension}
                    geneName={geneName}
                    setCurrentChromosomeSequence={setCurrentChromosomeSequence}
                    setGeneName={setGeneName}
                    setGeneSize={setGeneSize}
                />
            )}
        </div>
    );
};
