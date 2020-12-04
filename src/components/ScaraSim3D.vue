<template>
    <div> 
        <a-scene embedded style="width: 600px; height: 400px; margin: auto;" vr-mode-ui="enabled: false">
            <a-entity>
                <a-cylinder position="0 140 -44" radius="8" height="280" color="#444444"/>
                <a-cylinder position="0 100 0" radius="12" height="200" color="#CCCCCC" metalness="0.5"/>
                <a-cylinder position="42 100 -60" radius="12" height="200" color="#CCCCCC" metalness="0.5"/>
                <a-cylinder position="-42 100 -60" radius="12" height="200" color="#CCCCCC" metalness="0.5"/>
            </a-entity>
            <a-entity :position="'0 ' + z + ' 0'">
                <a-box height="5" width="130" depth="140" position="0 0 -30"/>
                <a-entity :rotation="'0 ' + a1 + ' 0'" position="0 10 0">
                    <a-box height="10" width="50" depth="140" position="0 0 70" />
                    <a-cylinder position="0 0 0" radius="25" height="10"/>
                    <a-cylinder position="0 0 140" radius="25" height="10"/>
                    <a-entity :rotation="'0 ' + a2 + ' 0'" position="0 10 140">
                        <a-box height="10" width="50" depth="140" position="0 0 70" />
                        <a-cylinder position="0 0 0" radius="25" height="10"/>
                        <a-cylinder position="0 0 140" radius="25" height="10"/>
                        <a-cylinder position="0 -80 140" radius="5" height="160" color="black"/>
                    </a-entity>
                </a-entity>
            </a-entity>
            <a-entity :meshline="'lineWidth: 5; path: ' + path_str + '; color: #E20049'" :position="x_offset + ' 20 ' + y_offset"/>
            <a-plane position="0 0 0" rotation="-90 0 0" width="400" height="400" color="#7BC8A4"/>
            <a-sky color="#ECECEC"></a-sky>
            <a-entity camera look-controls orbit-controls="target: 0 0 0; minDistance: 200; maxDistance: 600; initialPosition: 200 200 200"></a-entity>
        </a-scene>
        <br><br>
        <v-slider v-model="a1" label="Near Arm Angle" thumb-color="red" thumb-label="always" min="-90" max="90"></v-slider>
        <v-slider v-model="a2" label="Far Arm Angle‏‏‎ ‎‎" thumb-color="red" thumb-label="always" min="-90" max="90"></v-slider>
    </div>
</template>

<script lang="ts">
    const gcodeParser = require('gcode-parser');
    import Vue from 'vue'
    export default Vue.extend({
        props: {
            x_offset: Number,
            y_offset: Number,
            uploaded_gcode: String,
        },
        data() {
            return {
                z: 180,
                a1: 0,
                a2: 0,
                a1_start_angle: 0,
                a2_start_angle: 0,
                a1_len: 140,
                a2_len: 140,
                path: [] as number[][]
            }
        },
        methods: {
            gen_path(gcode_string: string) {
                gcode_string = gcode_string.replace(/[N]\d+(?= [^G])/g, "G1");
                gcode_string = gcode_string.replace(/[N]\d+ /g, "");
                var prev_pt = [0, 0, 0];
                let pt_array = gcode_string.split("\n").reduce((pt_array: number[][], raw_line: string) => {
                    let gcode_cmd = gcodeParser.parseLine(raw_line);
                    if(gcode_cmd.words.length === 0) {
                        return pt_array;
                    }
                    let pt = prev_pt.slice();
                    for (const gcode_seg_index in gcode_cmd.words) {
                        const gcode_seg = gcode_cmd.words[gcode_seg_index];
                        if(gcode_seg[0] === "X") {
                            pt[0] = gcode_seg[1]
                        }
                        if(gcode_seg[0] === "Y") {
                            pt[2] = gcode_seg[1]
                        }
                        if(gcode_seg[0] === "Z") {
                            pt[1] = gcode_seg[1]
                        }
                    }
                    prev_pt = pt;
                    pt_array.push(pt);
                    return pt_array
                }, []);
                this.path = pt_array
            },
        },
        watch: {
            uploaded_gcode() {
                this.gen_path(this.uploaded_gcode);
            }
        },
        computed: {
            path_str(): string {
                return this.path.reduce((agg: string, pt: number[]) => {
                    return `${agg}${agg != "" ? "," : ""} ${pt[0]} ${pt[1]} ${pt[2]}`
                }, "");
            },
            x2(): number {
                let a1_x2 = Math.cos((this.a1 + this.a1_start_angle)  * Math.PI / 180) * this.a1_len;
                let a2_x2 = a1_x2 + Math.cos((this.a2 + this.a2_start_angle)  * Math.PI / 180) * this.a2_len;
                return a2_x2;
            },
            y2(): number {
                let a1_y2 = Math.sin((this.a1 + this.a1_start_angle) * Math.PI / 180) * this.a1_len;
                let a2_y2 = a1_y2 + Math.sin((this.a2 + this.a2_start_angle) * Math.PI / 180) * this.a2_len;
                return a2_y2;
            }
        },
        mounted() {
            this.$nextTick(() => {
                this.gen_path(this.uploaded_gcode);
            });
        }
    })
</script>