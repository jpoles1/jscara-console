<template>
    <div>
        <div style="width: 300px; max-width: 100%">
            <v-text-field v-model="userText" label="Custom Text" />
            <v-text-field v-model.number="fontSize" type="number" label="Font Size" />
            <v-select v-model="fontName" :items="fontOptions" item-text="name" item-value="file" />
        </div>
        <br>
        <canvas id="canvas" :width="240 * svgScaler" :height="120 * svgScaler" style="border: 1px solid black;"/>
    </div>  
</template>

<script lang="ts">
import opentype from "opentype.js"
import AdaptiveLinearization from "adaptive-linearization"
import SVGPath from "svgpath"
import Vue from "vue"
export default Vue.extend({
    data() {
        return {
            userText: "Jordan Poles",
            fontName: "GreatVibes-Regular.ttf",
            fontSize: 40,
            userInputDebounce: 0,
            svgScaler: 2,
            fontOptions: [
                {name: "GreatVibes (caligraphy)", file: "GreatVibes-Regular.ttf"},
                {name: "ChunkFive (block)", file: "ChunkFive-Regular.otf"},
            ],
        }
    },
    watch: {
        userText() {
            clearTimeout(this.userInputDebounce)
            this.userInputDebounce = setTimeout(() => this.textToGcode(), 500)
        },
        fontName() {
            clearTimeout(this.userInputDebounce)
            this.userInputDebounce = setTimeout(() => this.textToGcode(), 250)
        },
        fontSize() {
            clearTimeout(this.userInputDebounce)
            this.userInputDebounce = setTimeout(() => this.textToGcode(), 500)
        }
    },
    methods: {
        textToGcode() {
            // Load in the font of choice
            opentype.load(`fonts/${this.fontName}`, (err, font) => {
                if (err) {
                    alert("Font could not be loaded: " + err);
                } else {
                    const raw_path = font!.getPath(this.userText, 10, this.fontSize + 10, this.fontSize).toPathData(2);
                    const path_chunks = raw_path.split("Z") // Split on the "close path" cmd
                    const lift_dist = 10; // # of mm to lift pen off page inbetween letters
                    let gcode = `G1Z${lift_dist}` // Start by lifting pen before moving to initial position
                    let lin_path = ""
                    path_chunks.forEach(chunk => {
                        const svgpath = SVGPath(chunk).unarc().abs();
                        let gcode_cmds = [] as string[]
                        let svg_cmds = [] as string[]
                        let startpt = [undefined, undefined] as [number | undefined, number | undefined]
                        // Iterate over svg commands and convert to linearized versions of both GCode and SVG paths
                        let lineConsumer = (x1: number, y1: number, x2: number, y2: number, data: number) => {
                            if(gcode_cmds.length == 0) startpt = [x2, y2]
                            gcode_cmds.push(`G1X${x2}Y${y2}`)
                            svg_cmds.push(`${svg_cmds.length > 0 ? "L" : "M"} ${x2 * this.svgScaler} ${y2 * this.svgScaler}`)
                        }
                        const al = new AdaptiveLinearization(lineConsumer);
                        svgpath.iterate(al.svgPathIterator);
                        // Place pen down on page at the start of each path
                        gcode_cmds.splice(1, 0, "G1Z0");
                        if(startpt[0] !=undefined && startpt[1] != undefined) {
                            // Move to start point to close path!
                            gcode_cmds.push(`G1X${startpt[0]}Y${startpt[1]}`);
                        }
                        // And then lift it when we are done
                        gcode_cmds.push(`G1Z${lift_dist}`)
                        // Join with \n and add to the overall gcode string
                        gcode = gcode + "\n" + gcode_cmds.join("\n")
                        // Separate paths with a "Z" that we had taken out earlier
                        svg_cmds.push("Z")
                        // Join with a space and add to the overall gcode string
                        lin_path = lin_path + " " + svg_cmds.join(" ")
                    })
                    // Emit the linearized gcode to the parent component for sending to the SCARA arm
                    this.$emit("gcodegen", gcode)
                    // Clear out the canvas
                    const canvas = document.getElementById("canvas") as HTMLCanvasElement
                    const ctx = canvas!.getContext("2d");
                    ctx!.clearRect(0, 0, canvas!.offsetWidth, canvas!.offsetHeight);
                    // Display the SVG path as a preview
                    const lin_path_elem = new Path2D(lin_path)
                    ctx!.stroke(lin_path_elem)
                }
            })
        },
    },
    mounted() {
        this.$nextTick(() => {
            this.textToGcode()
        })
    }
})
</script>