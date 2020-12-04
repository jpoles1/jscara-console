<template>
    <div>
        <div style="width: 300px; max-width: 100%">
            <v-file-input @change="load_img_file" placeholder="Upload SVG" />
        </div>
        <canvas id="svg-canvas" :width="240 * outputScaler" :height="120 * outputScaler" style="border: 1px solid black;"/>
    </div>  
</template>

<script lang="ts">
import opentype from "opentype.js"
import {AdaptiveLinearization} from "@/components/adaptive-linearization/index.ts"
import SVGPath from "svgpath"
import potrace from "potrace"

import Vue from "vue"
export default Vue.extend({
    data() {
        return {
            rawSVG: "",
            inputScaler: 0.2,
            outputScaler: 2,
        }
    },
    methods: {
        load_img_file(file: File) {
            console.log(file)
            if (file === null) return
            const reader = new FileReader();
            if(["image/jpeg"].includes(file.type)) {
                reader.onload = (ev) => {
                    this.imgToSVG(ev.target!.result as ArrayBuffer);
                };
                reader.readAsArrayBuffer(file);
            }
            else if(file.type == "image/svg+xml") {
                reader.onload = (ev: any) => {
                    this.rawSVG = ev.target!.result;
                    this.svgToGcode();
                };
                reader.readAsText(file);
            }
        },
        imgToSVG(imgdata: ArrayBuffer) {
            const params = {
                steps: 1,
            }
            potrace.trace(imgdata, params, (err: Error, svg: string) => {
                if (err) throw err;
                console.log(svg)
                this.rawSVG = svg;
                this.svgToGcode();
            });
        },
        svgToGcode() {
            const svgdoc = new DOMParser().parseFromString(this.rawSVG, "image/svg+xml");
            const path_chunks = Array.from(svgdoc.querySelectorAll("path").values()).reduce((agg, pathElem) => {
                const rawPath = pathElem.getAttribute("d");
                agg.push(rawPath!);
                return agg;
            }, [] as string[])
            console.log(path_chunks)
            const lift_dist = 5; // # of mm to lift pen off page inbetween letters
            let gcode = `G1Z${lift_dist}` // Start by lifting pen before moving to initial position
            let lin_path = ""
            path_chunks.forEach(chunk => {
                const svgpath = SVGPath(chunk).unarc().abs();
                let gcode_cmds = [] as string[]
                let svg_cmds = [] as string[]
                let startpt = [undefined, undefined] as [number | undefined, number | undefined]
                // Iterate over svg commands and convert to linearized versions of both GCode and SVG paths
                let lineConsumer = (x1: number, y1: number, x2: number, y2: number, data: number, svgcmd: string[]) => {
                    x2 = x2 * this.inputScaler
                    y2 = y2 * this.inputScaler
                    if(gcode_cmds.length == 0) startpt = [x2, y2]
                    if(svgcmd[0] == "M") {
                        gcode_cmds.push(`G1Z${lift_dist}`)
                        gcode_cmds.push(`G0ZX${x2}Y${y2}`)
                        gcode_cmds.push(`G1Z0`)
                    } else {
                        gcode_cmds.push(`G${gcode_cmds.length > 0 ? "1" : "0"}X${x2}Y${y2}`)
                    }
                    svg_cmds.push(svgcmd.join(" "))
                }
                const al = new AdaptiveLinearization(lineConsumer, {
                    recursionLimit: 4,
                    curve_distance_epsilon: 1e-5,
                    curveColinearityEpsilon: 1e-5,
                });
                svgpath.iterate(al.svgPathIterator);
                // Place pen down on page at the start of each path
                gcode_cmds.splice(1, 0, "G1Z0");
                if(startpt[0] !=undefined && startpt[1] != undefined) {
                    // Move to start point to close path!
                    //gcode_cmds.push(`G1X${startpt[0]}Y${startpt[1]}`);
                }
                // And then lift it when we are done
                gcode_cmds.push(`G1Z${lift_dist}`)
                // Join with \n and add to the overall gcode string
                gcode = gcode + "\n" + gcode_cmds.join("\n")
                // Join with a space and add to the overall gcode string
                lin_path = lin_path + " " + svg_cmds.join(" ")
            })
            // Emit the linearized gcode to the parent component for sending to the SCARA arm
            this.$emit("gcodegen", gcode)
            // Clear out the canvas
            const canvas = document.getElementById("svg-canvas") as HTMLCanvasElement
            const ctx = canvas!.getContext("2d");
            ctx!.clearRect(0, 0, canvas!.offsetWidth, canvas!.offsetHeight);
            // Display the SVG path as a preview
            const lin_path_elem = new Path2D(lin_path)
            ctx!.stroke(lin_path_elem)
            console.log(lin_path)
        },
    }
})
</script>