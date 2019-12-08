<template>
    <div>
        <v-slider v-model="a1" min=-80 max=80 thumb-label label="Arm 1 Angle:" style="padding: 10px 24px;" @input="plotScara"/>
        <v-slider v-model="a2" min=-80 max=80 thumb-label label="Arm 2 Angle:" style="padding: 10px 24px;" @input="plotScara"/>
        <div style="border: 1px dotted #222;">
            <svg :width="width" :height="height"/>
        </div>
    </div>
</template>

<script lang="ts">

const d3 = Object.assign({},
    require("d3-selection"),
    require("d3-shape"),
    require("d3-scale"),
    require("d3-axis"), 
    require("d3-array"),
    require("d3-scale-chromatic"),
);

import Vue from "vue";
import {ScaraConverter, ScaraProps, scara_default_props} from "@/ScaraConverter";

export default Vue.extend({
    data() {
        return {
            a1: 0,
            a2: 0,
            width: 500,
            height: 500,
            padding: {top: 30, right: 30, bottom: 60, left: 60},
            plot_area: {
                width: 400, // in mm
                height: 400, // in mm
            }
        };
    },
    methods: {
        plotScara() {
            const svg = d3.select(this.$el).select("svg");
            //d3.selectAll(".davenport-tooltip").remove();
            svg.selectAll("*").remove();
            if (svg === undefined) return;
            const plotArea = svg.append("g");
            plotArea.attr("width", this.width - this.padding.left - this.padding.right)
                .attr("height", this.height - this.padding.top - this.padding.bottom)
                .attr("transform", "translate(" + this.padding.left + "," + this.padding.top + ")")
                .attr("class", "davenport-plot-area");
            // Add X axis
            const xAxis = d3.scaleLinear()
                .domain([0, this.plot_area.width])
                .range([ 0, this.width - this.padding.left - this.padding.right ]);
            plotArea.append("g")
                .attr("transform", "translate(0," + (this.height - this.padding.bottom - 10) + ")")
                .call(d3.axisBottom(xAxis));

            // Add Y axis
            const yAxis = (d3.scaleLinear() as any)
                .domain([0, this.plot_area.height])
                .range([this.height - this.padding.top - this.padding.bottom, 0]);
            plotArea.append("g")
                .call(d3.axisLeft().scale(yAxis));

            const a1_start_angle = 90;
            const a2_start_angle = 90;
            // Arm 1
            let a1_x2 = (this.plot_area.width/2) + Math.cos((this.a1 + a1_start_angle)  * Math.PI / 180) * scara_default_props.L1;
            let a1_y2 = Math.sin((this.a1 + a1_start_angle) * Math.PI / 180) * scara_default_props.L1;
            plotArea.append("line")
                .attr("x1", xAxis(this.plot_area.width/2)).attr("x2", xAxis(a1_x2))
                .attr("y1", yAxis(0)).attr("y2", yAxis(a1_y2))
                .attr("stroke", "coral").attr("stroke-width", 20).attr("stroke-linecap", "round")
            // Arm 2
            let a2_x2 = a1_x2 + Math.cos((this.a2 + a2_start_angle)  * Math.PI / 180) * scara_default_props.L2;
            let a2_y2 = a1_y2 + Math.sin((this.a2 + a2_start_angle) * Math.PI / 180) * scara_default_props.L2;
            plotArea.append("line")
                .attr("x1", xAxis(a1_x2)).attr("x2", xAxis(a2_x2))
                .attr("y1", yAxis(a1_y2)).attr("y2", yAxis(a2_y2))
                .attr("stroke", "teal").attr("stroke-width", 20).attr("stroke-linecap", "round")

        }
    },
    mounted() {
        this.$nextTick(() => {
            this.plotScara();
        })
    }
});
</script>

<style>

</style>