<template>
    <center>
        <h4>Click To Jog</h4>
        <canvas id="click-move-canvas" :width="plot_width" :height="plot_height" style="border: 1px solid black;"/>
    </center>  
</template>

<script lang="ts">
import opentype from "opentype.js"
import AdaptiveLinearization from "adaptive-linearization"
import SVGPath from "svgpath"
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
            plot_width: 300, 
            plot_height: 150,
        }
    },
    methods: {
        render_bed() {
            const avail_width =  this.plot_width - 20;
            const scale_coef =  (avail_width / 2) / (this.arm_rad + 10)
            const arc_rad = this.arm_rad * 2 < avail_width ? this.arm_rad : (this.arm_rad * scale_coef);
            const center_x = arc_rad / 2 + ((this.plot_width  - arc_rad) / 2)
            // Clear out the canvas
            const canvas = document.getElementById("click-move-canvas") as HTMLCanvasElement
            const ctx = canvas!.getContext("2d");
            ctx!.clearRect(0, 0, canvas!.offsetWidth, canvas!.offsetHeight);
            ctx!.arc(center_x, 0, arc_rad, 0, 180)
            ctx!.stroke()
            ctx!.beginPath();
            ctx!.moveTo(center_x, 0);
            ctx!.lineTo(center_x, arc_rad);
            ctx!.closePath();
            ctx!.stroke()
            
            //Click event
            const click_handler = (event: any) => {
                const rect = canvas.getBoundingClientRect()
                const x = event.clientX - rect.left - center_x
                const y = event.clientY - rect.top
                this.$emit("move", [-x / scale_coef, y / scale_coef]);
            }
            canvas.addEventListener('mousedown', click_handler)
        },
    },
    mounted() {
        this.$nextTick(() => {
            this.render_bed()
        })
    }
})
</script>