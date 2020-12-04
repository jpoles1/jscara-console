<template>
    <div>
        <div style="width: 300px; max-width: 100%">
            <v-file-input @change="load_img_file" placeholder="Upload Image" accept=".svg,.png,.jpg,.jpeg"/>
        </div>
        <div v-show="imageSize[0] + imageSize[1] > 0">
            <div style="display: flex">
                <canvas id="svg-canvas" width=0 height=0 style="border: 1px solid black;"/>
                <div style="width: 300px; margin-left: 20px; border: 1px #888 solid; background-color: lightblue; padding: 16px; border-radius: 10px;">
                    <br>
                    <v-slider v-model="gcodeScale" thumb-label="always" @change="svgToGcode" min=0 max=200 label="GCode Scaler %"/>
                    <div v-if="imageType == 'photo'">
                        <br>
                        <v-slider v-model="potraceParams.threshold" thumb-label="always" @change="photoToSVG" min=-1 max=255  label="Threshold"/>
                        <br>
                        <v-slider v-model="potraceParams.turdSize" thumb-label="always" @change="photoToSVG" min=0 max=50  label="Min Speckle Size"/>
                        <br>
                        <v-checkbox v-model="potraceParams.blackOnWhite"  @change="photoToSVG" label="Invert"/>
                    </div>
                </div>
            </div>
            Print Size: {{(imageSize[0] * gcodeScale / 100).toFixed(1)}} x {{(imageSize[1] * gcodeScale / 100).toFixed(1)}} mm
        </div>
    </div>  
</template>

<script lang="ts">
import opentype from "opentype.js"
import {AdaptiveLinearization} from "@/components/adaptive-linearization/src/index.ts"
import SVGPath from "svgpath"
import potrace from "potrace"

import Vue from "vue"
export default Vue.extend({
    data() {
        return {
            imageSize: [0, 0],
            rawPhoto: undefined as ArrayBuffer | undefined,
            rawSVG: "",
            imageType: "",
            gcodeScale: 100,
            potraceParams: {
                threshold: -1,
                turdSize: 15,
                blackOnWhite: true,
            },
            finalGcode: "",
        }
    },
    methods: {
        load_img_file(file: File) {
            console.log(file)
            if (file === null) return
            const reader = new FileReader();
            if(["image/jpeg", "image/jpg", "image/png"].includes(file.type)) {
                reader.onload = (ev) => {
                    this.imageType = "photo"
                    this.rawPhoto = ev.target!.result as ArrayBuffer;
                    this.photoToSVG();
                };
                reader.readAsArrayBuffer(file);
            }
            else if(file.type == "image/svg+xml") {
                reader.onload = (ev: any) => {
                    this.rawSVG = ev.target!.result;
                    this.svgToGcode();
                };
                reader.readAsText(file);
            } else {
                this.imageType = ""
            }
        },
        photoToSVG() {
            if(this.rawPhoto != undefined) {
                potrace.trace(this.rawPhoto, this.potraceParams, (err: Error, svg: string) => {
                    if (err) throw err;
                    console.log(svg)
                    this.rawSVG = svg;
                    this.svgToGcode();
                });
            }
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
            let gcode = ""
            let lin_path = ""
            let maxVals = [0, 0];
            let startpt = [0, 0];
            path_chunks.forEach(chunk => {
                const svgpath = SVGPath(chunk).unarc().abs();
                let gcode_cmds = [] as string[][]
                let svg_cmds = [] as string[]
                // Iterate over svg commands and convert to linearized versions of both GCode and SVG paths
                let lineConsumer = (x1: number, y1: number, x2: number, y2: number, data: number, svgcmd: string[]) => {
                    if (x2 > maxVals[0]) maxVals[0] = x2
                    if (y2 > maxVals[1]) maxVals[1] = y2
                    x2 = x2 * this.gcodeScale / 100
                    y2 = y2 * this.gcodeScale / 100
                    if(svgcmd[0] == "M") {
                        gcode_cmds.push(["G0", `Z${lift_dist}`])
                        gcode_cmds.push(["G0", `X${x2}`, `Y${y2}`])
                        gcode_cmds.push(["G0", "Z0"])
                        startpt = [x2, y2];
                    } else if(svgcmd[0] == "Z") {
                        gcode_cmds.push(["G0", `X${startpt[0]}`, `Y${startpt[1]}`])
                    } else {
                        gcode_cmds.push(["G1", `X${x2}`, `Y${y2}`])
                    }
                    // Record max vals for resizing canvas
                    // Create final SVG cmd
                    svg_cmds.push(svgcmd.join(" "))
                }
                const al = new AdaptiveLinearization(lineConsumer, {
                    recursionLimit: 4,
                    curve_distance_epsilon: 1e-5,
                    curveColinearityEpsilon: 1e-5,
                });
                svgpath.iterate(al.svgPathIterator);
                // Join with \n and add to the overall gcode string
                gcode = gcode + "\n" + gcode_cmds.map((x: string[]) => x.join("")).join("\n")
                // Join with a space and add to the overall gcode string
                lin_path = lin_path + " " + svg_cmds.join(" ")
            })
            // Display the SVG path as a preview
            console.log(maxVals)
            //this.canvasWidth = maxVals[0]
            //this.canvasHeight = maxVals[1]
            // Clear out the canvas
            const canvas = document.getElementById("svg-canvas") as HTMLCanvasElement
            this.imageSize = maxVals
            canvas.setAttribute("width", `${maxVals[0]}`)
            canvas.setAttribute("height", `${maxVals[1]}`)
            const ctx = canvas!.getContext("2d");
            ctx!.clearRect(0, 0, canvas!.offsetWidth, canvas!.offsetHeight);
            const lin_path_elem = new Path2D(lin_path)
            ctx!.stroke(lin_path_elem)
            // Add homing seq to end of gcode
            gcode = gcode + ["G0Z10", "G0X0Y0", "G0Z0"].join("\n")
            // Emit the linearized gcode to the parent component for sending to the SCARA arm
            this.$emit("gcodegen", gcode)
        },
    }
})
</script>