<template>
    <div>
        <canvas id="canvas" :width="plot_width" :height="plot_height" style="border: 1px solid black;"/>
    </div>  
</template>

<script lang="ts">
import {ScaraConverter} from "@/ScaraConverter";

import Vue from "vue"
export default Vue.extend({
    props: {
        arm_rad: {
            default: 240,
            type: Number,
        },
        x_offset: {
            default: 0,
            type: Number,
        },
        y_offset: {
            default: 0,
            type: Number,
        },
    },
    data() {
        return {
            plot_width: 500, 
            plot_height: 300,
            userText: "Jordan Poles",
            fontName: "GreatVibes-Regular.ttf",
            fontSize: 40,
            userInputDebounce: 0,
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
        },
        x_offset() {
            clearTimeout(this.userInputDebounce)
            this.userInputDebounce = setTimeout(() => this.textToGcode(), 500)
        },
        y_offset() {
            clearTimeout(this.userInputDebounce)
            this.userInputDebounce = setTimeout(() => this.textToGcode(), 500)
        },
    },
    methods: {
        textToGcode() {
            // Load in the font of choice
            const center_x = this.arm_rad / 2 + ((this.plot_width  - this.arm_rad) / 2)
            // Clear out the canvas
            const canvas = document.getElementById("canvas") as HTMLCanvasElement
            const ctx = canvas!.getContext("2d");
            ctx!.clearRect(0, 0, canvas!.offsetWidth, canvas!.offsetHeight);
            // Display the SVG path as a preview
            let x_grid = Array.from({length: 480}, (x, i) => i - 240)
            let y_grid = Array.from({length: 480}, (x, i) => i - 240)
            let conv = new ScaraConverter();
            let reachable = true;
            x_grid.forEach((x_pt) => {
                y_grid.forEach((y_pt) => {
                    try {
                        conv.map_cartesian_to_scara({X: x_pt, Y: y_pt})
                        reachable = true
                    }
                    catch (e) {
                        reachable = false
                    }
                    ctx!.fillStyle = reachable ? "green" : "red";
                    ctx!.fillRect(x_pt + center_x, y_pt, 1, 1);
                })
            })
            ctx!.arc(center_x, 0, this.arm_rad, 0, 180)
            ctx!.stroke()
            ctx!.beginPath();
            ctx!.moveTo(center_x, 0);
            ctx!.lineTo(center_x, this.arm_rad);
            ctx!.closePath();
            ctx!.stroke()
        },
    },
    mounted() {
        this.$nextTick(() => {
            this.textToGcode()
        })
    }
})
</script>