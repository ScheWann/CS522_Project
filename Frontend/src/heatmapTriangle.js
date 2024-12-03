import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import { Button, Switch, Tooltip } from 'antd';
import { DownloadOutlined } from "@ant-design/icons";
import { TriangleGeneList } from './triangleGeneList.js';

export const HeatmapTriangle = ({ cellLineName, chromosomeName, geneName, currentChromosomeSequence, geneList, totalChromosomeSequences, currentChromosomeData }) => {
    const containerRef = useRef(null);
    const canvasRef = useRef(null);
    const axisSvgRef = useRef(null);
    const brushSvgRef = useRef(null);

    const [minCanvasDimension, setMinCanvasDimension] = useState(0);
    const [brushedTriangleRange, setBrushedTriangleRange] = useState({ start: 0, end: 0 });
    const [fullTriangleVisible, setFullTriangleVisible] = useState(false);
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

    const downloadImage = () => {
        const canvas = canvasRef.current;
        const svg = axisSvgRef.current;

        const serializer = new XMLSerializer();
        const svgData = serializer.serializeToString(svg);

        const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
        const svgURL = URL.createObjectURL(svgBlob);

        const svgImage = new Image();
        svgImage.onload = () => {
            // Create a new canvas to merge canvas and SVG
            const combinedCanvas = document.createElement("canvas");
            combinedCanvas.width = canvas.width;
            combinedCanvas.height = canvas.height + svgImage.height;

            const combinedContext = combinedCanvas.getContext("2d");

            combinedContext.drawImage(canvas, 0, 0);

            combinedContext.drawImage(svgImage, 0, canvas.height);

            // Convert the combined canvas to an image and trigger download
            const dataURL = combinedCanvas.toDataURL("image/png");
            const link = document.createElement("a");
            link.href = dataURL;
            link.download = "heatmap_triangle.png";
            link.click();

            URL.revokeObjectURL(svgURL);
        };

        svgImage.src = svgURL;
    };

    const switchChange = () => {
        setFullTriangleVisible(!fullTriangleVisible);
        setBrushedTriangleRange({ start: 0, end: 0 });
    };

    useEffect(() => {
        const observer = new ResizeObserver((entries) => {
            for (let entry of entries) {
                const { width, height } = entry.contentRect;
                setContainerSize({ width, height });
            }
        });

        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => {
            observer.disconnect();
        };
    }, []);

    useEffect(() => {
        if (!containerSize.width && !containerSize.height) return;

        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        const margin = { top: 5, right: 5, bottom: 5, left: 5 };
        const parentWidth = containerSize.width;
        const parentHeight = containerSize.height;

        const width = (Math.min(parentWidth, parentHeight) - margin.left - margin.right);
        const height = (Math.min(parentWidth, parentHeight) - margin.top - margin.bottom);

        canvas.width = width * Math.sqrt(2);
        canvas.height = height / 1.4;

        setMinCanvasDimension(canvas.width);
        context.clearRect(0, 0, canvas.width, canvas.height);

        // Apply rotation transformation
        context.scale(1, -1)
        context.translate(canvas.width / 2, -canvas.height * 2);
        context.rotate((Math.PI / 180) * 45);

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

        const transformedXScale = d3.scaleBand()
            .domain(axisValues)
            .range([0, canvas.width])
            .padding(0.1);

        const colorScale = d3.scaleSequential(
            t => d3.interpolateReds(t * 0.8 + 0.2)
        ).domain([0, d3.max(currentChromosomeData, d => d.fq)]);

        const invertBand = (scale, value) => {
            const range = scale.range();
            const step = scale.step();
            const domain = scale.domain();

            const correctedValue = value - step / 2;
            const index = Math.ceil((correctedValue - range[0]) / step);

            if (index < 0 || index >= domain.length) {
                return undefined;
            }

            return domain[index];
        };

        const fqMap = new Map();
        currentChromosomeData.forEach(d => {
            fqMap.set(`X:${d.ibp}, Y:${d.jbp}`, { fq: d.fq, fdr: d.fdr });
        });

        const hasData = (ibp, jbp) => {
            const inRange = totalChromosomeSequences.some(seq =>
                ibp >= seq.start && ibp <= seq.end &&
                jbp >= seq.start && jbp <= seq.end
            );

            return inRange;
        };

        axisValues.forEach(ibp => {
            axisValues.forEach(jbp => {
                const { fq, fdr } = fqMap.get(`X:${ibp}, Y:${jbp}`) || { fq: -1, fdr: -1 };

                const x = margin.left + xScale(jbp);
                const y = margin.top + yScale(ibp);
                const width = xScale.bandwidth();
                const height = yScale.bandwidth();

                if (!fullTriangleVisible) {
                    context.fillStyle = !hasData(ibp, jbp) ? 'white' : (fdr > 0.05 || (fdr === -1 && fq === -1)) ? 'white' : colorScale(fq);
                } else {
                    context.fillStyle = !hasData(ibp, jbp) ? 'white' : (jbp <= ibp) ? 'white' : colorScale(fq);
                }
                context.fillRect(x, y, width, height);
            });
        });

        const updateAxisWithBrushRange = (start, end) => {
            const startX = transformedXScale(start);
            const endX = transformedXScale(end);

            axisSvg.selectAll('.range-line').remove();

            axisSvg.append("line")
                .attr('class', 'range-line')
                .attr('transform', `translate(${(parentWidth - canvas.width) / 2}, ${margin.top})`)
                .attr("x1", startX)
                .attr("y1", 0)
                .attr("x2", startX)
                .attr("y2", 50)
                .attr("stroke", "#C0C0C0")
                .attr("stroke-width", 3);

            axisSvg.append("line")
                .attr('class', 'range-line')
                .attr('transform', `translate(${(parentWidth - canvas.width) / 2}, ${margin.top})`)
                .attr("x1", endX)
                .attr("y1", 0)
                .attr("x2", endX)
                .attr("y2", 50)
                .attr("stroke", "#C0C0C0")
                .attr("stroke-width", 3);
        };

        const brushSvg = d3.select(brushSvgRef.current)
            .attr('width', canvas.width)
            .attr('height', canvas.height);

        brushSvg.selectAll('*').remove();

        const clickableArea = [
            [canvas.width / 2, margin.top],
            [0, canvas.height - margin.bottom],
            [canvas.width, canvas.height - margin.bottom],
        ];

        // Limit the clickable area to the triangle
        brushSvg.append('polygon')
            .attr('points', clickableArea.map(d => d.join(',')).join(' '))
            .attr('fill', 'transparent')

        // Draw a brushed triangle area on click
        brushSvg.on('click', (e) => {
            const [mouseX, mouseY] = d3.pointer(e);

            brushSvg.selectAll('.triangle').remove();

            if (d3.polygonContains(clickableArea, [mouseX, mouseY])) {
                const length = canvas.height - margin.top - mouseY;

                const pointBottomLeft = [Math.max(mouseX - length, 0), canvas.height - margin.bottom];
                const pointBottomRight = [Math.min(mouseX + length, canvas.width), canvas.height - margin.bottom];

                const trianglePoints = [
                    [mouseX, mouseY],
                    pointBottomLeft,
                    pointBottomRight,
                ];

                const brushedTriangleRangeStart = invertBand(transformedXScale, mouseX - length);
                const brushedTriangleRangeEnd = invertBand(transformedXScale, mouseX + length);

                brushSvg.append('polygon')
                    .attr('class', 'triangle')
                    .attr('points', trianglePoints.map(d => d.join(',')).join(' '))
                    .attr('fill', '#808080')
                    .attr('opacity', 0.5)

                updateAxisWithBrushRange(brushedTriangleRangeStart, brushedTriangleRangeEnd);
                setBrushedTriangleRange({ start: brushedTriangleRangeStart, end: brushedTriangleRangeEnd });
            } else {
                setBrushedTriangleRange({ start: 0, end: 0 });
                axisSvg.selectAll('.range-line').remove();
            }
        });

        const axisSvg = d3.select(axisSvgRef.current)
            .attr('width', parentWidth)

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
            .attr('transform', `translate(${(parentWidth - canvas.width) / 2}, ${margin.top})`)
            .call(d3.axisBottom(transformedXScale)
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
            .style("text-anchor", "start")
            .attr("transform", "rotate(45)")
            .attr("dx", "1em")
            .attr("dy", "0em");
    }, [currentChromosomeData, fullTriangleVisible, currentChromosomeSequence, containerSize]);

    return (
        <div ref={containerRef} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', width: '100%', height: '100%' }}>
            <div style={{
                position: 'absolute',
                top: 20,
                right: 20,
                zIndex: 10,
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
            }}>
                <Tooltip placement="bottom" title="Choose to display the upper or lower half of the heat map" overlayInnerStyle={{ color: '#333' }} color={"white"}>
                    <Switch
                        checkedChildren="Partial"
                        unCheckedChildren="Full"
                        checked={!fullTriangleVisible}
                        onChange={switchChange}
                    />
                </Tooltip>
                <Tooltip placement="bottom" title="Download current triangle heatmap" overlayInnerStyle={{ color: '#333' }} color={"white"}>
                    <Button
                        style={{
                            fontSize: 15,
                            cursor: "pointer",
                        }}
                        icon={<DownloadOutlined />}
                        onClick={downloadImage}
                    />
                </Tooltip>
            </div>
            <canvas ref={canvasRef} />
            <svg ref={brushSvgRef} style={{ position: 'absolute', zIndex: 2, pointerEvents: 'all' }} />
            <svg ref={axisSvgRef} style={{ height: '50px', flexShrink: 0 }} />
            {minCanvasDimension > 0 && (
                <TriangleGeneList
                    brushedTriangleRange={brushedTriangleRange}
                    cellLineName={cellLineName}
                    chromosomeName={chromosomeName}
                    geneList={geneList}
                    currentChromosomeSequence={currentChromosomeSequence}
                    minCanvasDimension={minCanvasDimension}
                    geneName={geneName}
                />
            )}
        </div>
    );
};
