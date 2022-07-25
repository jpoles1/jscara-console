<template>
<div>
    <v-tabs v-model="active_tab" @change="gcode_convert_debounce">
        <v-tab key="txt">Text</v-tab>
        <v-tab key="img">Image</v-tab>

        <v-tabs-items v-model="active_tab">
            <v-tab-item key="txt">
                <div style="width: 300px; max-width: 100%">
                    <v-text-field v-model="userText" label="Custom Text" @change="gcode_convert_debounce"/>
                    <v-text-field v-model.number="fontSize" type="number" label="Font Size" @change="gcode_convert_debounce"/>
                    <v-select v-model="fontName" :items="fontOptions" item-text="name" item-value="file" @change="gcode_convert_debounce"/>
                </div>
            </v-tab-item>
            <v-tab-item key="img">
                <div style="width: 300px; max-width: 100%">
                    <v-file-input @change="load_img_file" placeholder="Upload Image" accept=".svg,.png,.jpg,.jpeg"/>
                    <div v-if="imageType == 'photo'">
                        <br>
                        <v-radio-group v-model="photo_mode" @change="photo_to_svg">
                            <v-radio value="tsp" label="Traveling Salesman"/>
                            <v-radio value="squiggle" label="Squiggle"/>
                            <v-radio value="potrace" label="Potrace"/>
                        </v-radio-group>
                        <div v-if="photo_mode == 'potrace'">
                            <v-slider v-model="potrace_params.threshold" thumb-label="always" @change="photo_to_svg" min=-1 max=255  label="Threshold">
                                <template v-slot:append>
                                    <v-icon v-ripple @click="potrace_params.threshold = -1" v-show="potrace_params.threshold != -1">
                                        mdi-replay
                                    </v-icon>
                                </template>
                            </v-slider>
                            <br>
                            <v-slider v-model="potrace_params.turdSize" thumb-label="always" @change="photo_to_svg" min=0 max=50  label="Min Speckle Size"/>
                            <br>
                            <v-checkbox v-model="potrace_params.blackOnWhite"  @change="photo_to_svg" label="Invert"/>
                        </div>
                        <div v-if="photo_mode == 'squiggle'">
                            <v-slider v-model="squiggle_config.frequency" thumb-label="always" @change="photo_to_svg" min=5 max=256  label="Frequency"/>
                            <v-slider v-model="squiggle_config.lineCount" thumb-label="always" @change="photo_to_svg" min=10 max=200  label="# Lines"/>
                            <v-slider v-model="squiggle_config.amplitude" thumb-label="always" @change="photo_to_svg" min=0.1 max=5 step=0.1 label="Amplitude"/>
                            <v-slider v-model="squiggle_config.spacing" thumb-label="always" @change="photo_to_svg" min=0.5 max=3 step="0.1" label="Sampling"/>
                        </div>
                        <div v-if="photo_mode == 'tsp'">
                            <v-slider v-model="tsp_config.resolution" thumb-label="always" @change="photo_to_svg" min=5 max=30 label="Resolution"/>
                            <v-slider v-model="tsp_config.contrast" thumb-label="always" @change="photo_to_svg" min=0 max=100 step=5 label="Contrast"/>
                            <v-slider v-model="tsp_config.whiteCutoff" thumb-label="always" @change="photo_to_svg" min=0 max=255 step=5 label="White Cutoff"/>
                            <v-checkbox v-model="tsp_config.invert"  @change="photo_to_svg" label="Invert"/>
                        </div>
                    </div>
                </div>
            </v-tab-item>

        </v-tabs-items>
    </v-tabs>

    <div :style="{width: `${plot_width+2}px`, height: `${plot_height+2}px`, position: 'relative', overflow: 'hidden'}">
        <drr
            :x="svg_x"
            :y="svg_y"
            :w="svg_w"
            :h="svg_h"
            :angle="svg_rot"
            aspectRatio
            @change="svg_moved"
        >
            <!--<img src="https://upload.wikimedia.org/wikipedia/commons/f/f9/Five_Pointed_Star_Solid.svg" style="width: 100%; height: 100%" />-->
            <div id="svg-drr" style="width: 100%; height: 100%"></div>
        </drr>
        <canvas id="render-workarea" :width="plot_width" :height="plot_height" style="border: 1px solid black;" />
    </div>
    <div class="visuallyhidden" id="svg-tester"/>
</div>

</template>

<script lang="ts">

function replaceChildren(elem: Element, ...new_children: Element[]) {
  const { childNodes } = elem;
  while (childNodes.length) {
    childNodes[0].remove();
  }
  elem.append(...new_children);
}

import opentype from "opentype.js"
import {AdaptiveLinearization} from "@/components/adaptive-linearization/src/index"
import SVGPath from "svgpath"
import potrace from "potrace"
import imgreduce from "image-blob-reduce"
import OneLineClient from './OneLineClient.js';

import Vue from "vue"
export default Vue.extend({
    props: {
        arm_rad: {
            default: 240,
            type: Number,
        },
        svgdoc: Document
    },
    data() {
        const plot_scale = 1.5;
        return {
            active_tab: 0,
            
            userText: "SCARA",
            fontName: "ChunkFive-Regular.otf",
            fontSize: 40,
            userInputDebounce: 0,
            fontOptions: [
                {name: "Allura (Script)", file: "Allura-Regular.otf"},
                {name: "ChunkFive (block)", file: "ChunkFive-Regular.otf"},
                {name: "GreatVibes (caligraphy)", file: "GreatVibes-Regular.ttf"},
            ],

            photo_mode: "tsp",
            photo_upload_max_dim: 500,
            potrace_params: {
                threshold: -1,
                turdSize: 15,
                blackOnWhite: true,
            },
            squiggle_config: {
                black: false,
                frequency: 100,
                amplitude: 2.0 as number,
                lineCount: 50,
                brightness: 0 as number,
                contrast: 0 as number,
                minBrightness: 0 as number,
                maxBrightness: 255,
                spacing: 0.5 as number,
            },
            tsp_config: {
                resolution: 20,
                contrast: 80,
                whiteCutoff: 240,
                invert: false,
                lineWidth: 4,
                fg: "black",
                bg: "white",
            },

            plot_scale: plot_scale,
            plot_width: this.arm_rad * 2 * plot_scale, 
            plot_height: this.arm_rad * plot_scale,
            
            svg_x: 240 * plot_scale,
            svg_y: 100 * plot_scale,
            svg_w: 200,
            svg_h: 200,
            orig_svg_w: 200,
            orig_svg_h: 200,
            svg_rot: 0,

            raw_photo: undefined as ArrayBuffer | undefined,
            photo_blob: undefined as Blob | undefined,
            raw_svg: "",
            imageType: "",
        }
    },
    methods: {
        gcode_convert_debounce() {
            clearTimeout(this.userInputDebounce)
            this.userInputDebounce = setTimeout(() => this.gcode_convert(), 500)
        },
        async gcode_convert() {
            if(this.active_tab == 0) {
                //Convert txt
                this.display_svg(await this.text_to_svg());
            } else if (this.active_tab == 1) {
                //Convert img
                //this.display_svg(await this.text_to_svg());
            }
            this.svg_to_gcode()            
        },
        svg_to_gcode() {
            const lift_dist = 4; // # of mm to lift pen off page inbetween letters
            let gcode = [] as string[]
            let lin_path = ""
            let startpt = [0, 0];

            const root_svg = document.getElementById("svg-render")!;
            const path_chunks = Array.from(root_svg.querySelectorAll("path").values()).reduce((agg, path_elem) => {
                const raw_path = path_elem.getAttribute("d");
                agg.push(raw_path!);
                return agg;
            }, [] as string[])
            path_chunks.forEach(chunk => {
                const svgpath = SVGPath(chunk).scale(this.svg_w / this.orig_svg_w, this.svg_h / this.orig_svg_h).rotate(this.svg_rot, this.svg_w / 2, this.svg_h /2).translate(this.svg_x - this.svg_w / 2, this.svg_y - this.svg_h / 2).unarc().abs().round(4) 
                let gcode_cmds = [] as string[][]
                let svg_cmds = [] as string[]
                // Iterate over svg commands and convert to linearized versions of both GCode and SVG paths
                let round = function(n: number, places: number = 2) {
                    return Math.round((n + Number.EPSILON) * 10 ** places) / 10 ** places;
                }

                let lineConsumer = (x1: number, y1: number, x2: number, y2: number, data: number, svgcmd: string[]) => {
                    x2 = round(-(x2 / this.plot_scale - this.arm_rad))
                    y2 = round(y2 / this.plot_scale)
                    if(!svgcmd) return
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
                    approximationScale: 2,
                    recursionLimit: 8,
                    curve_distance_epsilon: 1e-5,
                    curveColinearityEpsilon: 1e-5,
                });
                svgpath.iterate(al.svgPathIterator);
                // Join with \n and add to the overall gcode string
                console.log(gcode_cmds.map((x: string[]) => x.join("")))
                gcode = gcode_cmds.map((x: string[]) => x.join("")).reduce((agg, arr) => {
                    agg.push(arr);
                    return agg
                }, [] as string[])
                // Join with a space and add to the overall gcode string
                lin_path = lin_path + " " + svg_cmds.join(" ")
            })
            console.log(gcode)
            this.$emit("gcodegen", gcode)
        },
        opentype_promise_font(url: string): Promise<opentype.Font> {
            return new Promise((resolve, reject) => {
                opentype.load(url, (err, font) => {
                    if (err) {
                        alert("Font could not be loaded: " + err);
                        reject(err);
                    } else {
                        resolve(font!);
                    }
                })
            })
        },
        text_to_svg(): Promise<SVGElement> {
            const center_x = this.arm_rad / 2 + ((this.plot_width  - this.arm_rad) / 2)
            return this.opentype_promise_font(`fonts/${this.fontName}`).then((font) => {
                const raw_path = font!.getPath(this.userText, 0, this.fontSize, this.fontSize);
                const raw_path_bb = raw_path.getBoundingBox();

                this.svg_w = raw_path_bb.x2 - raw_path_bb.x1
                this.svg_h = raw_path_bb.y2 - raw_path_bb.y1
                this.orig_svg_w = raw_path_bb.x2 - raw_path_bb.x1
                this.orig_svg_h = raw_path_bb.y2 - raw_path_bb.y1

                const path_svg = raw_path.toSVG(6)
                const svg_elem = document.createElementNS("http://www.w3.org/2000/svg", "svg")
                svg_elem.innerHTML = path_svg
                svg_elem.setAttribute("viewBox", `${raw_path_bb.x1}, ${raw_path_bb.y1}, ${this.svg_w} ${this.svg_h}`);
                return svg_elem
            })
        },
        set_svg_viewport() {
            const svg_elem: SVGGraphicsElement = document.getElementById("svg-tester")!.getElementsByTagName("svg")[0]
            const bbox = svg_elem.getBBox();
            this.svg_w = bbox.width
            this.svg_h = bbox.height
            this.orig_svg_w = bbox.width
            this.orig_svg_h = bbox.height
            const aspect_ratio = this.svg_w / this.svg_h

            const max_dim = 200;
            //If img too big in one dim
            if (this.svg_w > max_dim || this.svg_h > max_dim) {
                //If width too big
                if (aspect_ratio >= 1) {
                    this.svg_w = max_dim
                    this.svg_h = max_dim / aspect_ratio
                }
                else {
                    this.svg_h = max_dim
                    this.svg_w = max_dim * aspect_ratio
                }
            }
            svg_elem.setAttribute("viewBox", `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`);
            this.display_svg(svg_elem);
            this.svg_to_gcode();
        },
        async load_img_file(file: File) {
            if (file === null) return
            const reader = new FileReader();
             if(file.type == "image/svg+xml") {
                reader.onload = (ev: any) => {
                    this.raw_svg = reader.result as string;
                    const svgdoc = new DOMParser().parseFromString(this.raw_svg, "image/svg+xml");
                    replaceChildren(document.getElementById("svg-tester")!, svgdoc.documentElement);
                    this.set_svg_viewport();
                };
                reader.readAsText(file);
            } else if(["image/jpeg", "image/jpg", "image/png"].includes(file.type)) {
                reader.onload = (ev) => {
                    this.imageType = "photo"
                    this.raw_photo = reader.result as ArrayBuffer;
                    this.photo_to_svg();
                };
                await imgreduce().toBlob(file, {max: this.photo_upload_max_dim}).then(((reducedFile: File) => { this.photo_blob = reducedFile; reader.readAsArrayBuffer(reducedFile)}))
            }
            else {
                this.imageType = ""
            }
        },
        async photo_to_svg() {
            if (this.photo_mode=="potrace") {
                if(this.raw_photo != undefined) {
                    potrace.trace(this.raw_photo, this.potrace_params, (err: Error, svg: string) => {
                        if (err) throw err;
                        const svgdoc = new DOMParser().parseFromString(svg, "image/svg+xml");
                        replaceChildren(document.getElementById("svg-tester")!, svgdoc.documentElement);
                        this.set_svg_viewport();
                    });
                }
            }
            if (this.photo_mode == "squiggle") {
                await this.photo_to_svg_squiggle();
            }
            if (this.photo_mode == "tsp") {
                OneLineClient.setImage(this.raw_photo);
                OneLineClient.onResult = ((d: any) => {
                    const raw_svg = d.result
                    const svgdoc = new DOMParser().parseFromString(raw_svg, "image/svg+xml");
                    replaceChildren(document.getElementById("svg-tester")!, svgdoc.documentElement);
                    this.set_svg_viewport();
                }) as any
                OneLineClient.build(this.tsp_config);
            }
        },
        async photo_to_svg_squiggle(single_line=true) {
            const config = this.squiggle_config
            //const width = config.width;
            //const height = config.height;
            const contrast = config.contrast;
            const brightness = config.brightness;
            const lineCount = config.lineCount;
            const minBrightness = config.minBrightness;
            const maxBrightness = config.maxBrightness;
            const spacing = config.spacing;
            const black = config.black;

            let imagePixels: ImageData;
            let canvas = document.createElement("canvas");
            const ctx = canvas.getContext('2d');
            let img = new Image();
            const p = new Promise((resolve, reject) => {
                img.onload = () => {
                    const width = img.width;
                    const height = img.height;
                    canvas.width = width
                    canvas.height = height
                    ctx!.drawImage(img, 0, 0)
                    imagePixels = ctx!.getImageData(0, 0, width, height);
                    // Create some defaults for squiggle-point array
                    let squiggleData = [] as number[][][];
                    let r = 5;
                    let a = 0;
                    let b;
                    let z;
                    let currentLine = []; // create empty array for storing x,y coordinate pairs
                    let currentVerticalPixelIndex = 0;
                    let currentHorizontalPixelIndex = 0;
                    let contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast)); // This was established through experiments
                    let horizontalLineSpacing = Math.floor(height / lineCount); // Number of pixels to advance in vertical direction
                    
                    //If wrapping lines we alternate which dir we process each line
                    let line_dir: boolean = false; // 0 = L to R, 1 = R to L
                    
                    // Iterate line by line (top line to bottom line) in increments of horizontalLineSpacing
                    for (let y = 0; y < height; y+= horizontalLineSpacing) {
                        a = 0;
                        currentLine = [];
                        currentLine.push([0, y]); // Start the line
                        currentVerticalPixelIndex = y*width;  // Because Image Pixel array is of length width * height,
                                                                // starting pixel for each line will be this
                        // Loop through pixels from left to right within the current line, advancing by increments of config.SPACING
                        //console.log(config.spacing, width);
                        for (let x = spacing; x < width; x += spacing ) {
                            currentHorizontalPixelIndex = Math.floor(x + currentVerticalPixelIndex); // Get array position of current pixel
                            // When there is contrast adjustment, the calculations of brightness values are a bit different
                            if (contrast !== 0) {
                            // Determine how bright a pixel is, from 0 to 255 by summing three channels (R,G,B) multiplied by some coefficients
                            b = (0.2125 * ((contrastFactor * (imagePixels!.data[4 * currentHorizontalPixelIndex] - 128) + 128 )
                                + brightness)) + (0.7154 * ((contrastFactor * (imagePixels!.data[4 * (currentHorizontalPixelIndex + 1)] - 128) + 128)
                                + brightness)) + (0.0721 * ((contrastFactor*(imagePixels!.data[4*(currentHorizontalPixelIndex+2)]-128)+128) + brightness));
                            } else {
                            b = (0.2125 * (imagePixels!.data[4*currentHorizontalPixelIndex] + brightness)) + (0.7154 * (imagePixels!.data[4*(currentHorizontalPixelIndex + 1)]+ brightness)) + (0.0721 * (imagePixels!.data[4*(currentHorizontalPixelIndex + 2)] + brightness));
                            }
                            if (black) {
                            b = Math.min(255-minBrightness,255-b);    // Set minimum line curvature to value set by the user
                            z = Math.max(maxBrightness-b,0);  // Set maximum line curvature to value set by the user
                            } else {
                            b = Math.max(minBrightness,b);    // Set minimum line curvature to value set by the user
                            z = Math.max(maxBrightness-b,0);  // Set maximum line curvature to value set by the user
                            }
                            // The magic of the script, determines how high / low the squiggle goes
                            r = config.amplitude * z / lineCount;
                            a += z / config.frequency;
                            currentLine.push([x,y + Math.sin(a)*r]);
                        }
                        if (line_dir) {
                            currentLine = currentLine.reverse()
                        }
                        squiggleData.push(currentLine);
                        if(single_line) {
                            line_dir = !line_dir
                        }
                    }
                    squiggleData = [([] as number[][]).concat(...squiggleData)]
                    const svg_paths = squiggleData.map((path: number[][]) => {
                        let svg_path = "";
                        path.map((point, index) => {
                            if (index === 0) {
                                svg_path += `M ${point[0]},${point[1]}`;
                            } else {
                                svg_path += `L${Math.round(point[0] * 100) / 100},${Math.round(point[1]*100)/100}`
                            }
                        });
                        return `<path d="${svg_path}"/>`;
                    })
                    const raw_svg = `<svg xmlns="http://www.w3.org/2000/svg">${svg_paths.join("\n")}</svg>`;
                    const svgdoc = new DOMParser().parseFromString(raw_svg, "image/svg+xml");
                    console.log(svgdoc)

                    replaceChildren(document.getElementById("svg-tester")!, svgdoc.documentElement);
                    this.set_svg_viewport();
                    resolve(undefined);
                }
            });
            img.src = URL.createObjectURL(this.photo_blob!);
            return p
        },
        display_svg(svg_elem: SVGElement) {
            svg_elem.style.width = "100%"
            svg_elem.style.height = "100%"
            svg_elem.setAttribute("width", this.svg_w + "px");
            svg_elem.setAttribute("height", this.svg_h + "px");
            svg_elem.id = "svg-render"
            replaceChildren(document.getElementById("svg-drr")!, svg_elem);
            //document.getElementById("svg-drr")!.innerHTML = svg_elem.outerHTML
            //document.getElementById("svg-drr")!.innerHTML = `<img src="https://upload.wikimedia.org/wikipedia/commons/f/f9/Five_Pointed_Star_Solid.svg" style="width: 100%; height: 100%" />`
        },
        svg_moved(e: any) {
            console.log(e)
            this.svg_x = e.x
            this.svg_y = e.y
            this.svg_w = e.w
            this.svg_h = e.h
            this.svg_rot = e.angle
            this.gcode_convert_debounce()
        },
        render_workarea() {
            const center_x = this.plot_width / 2
            // Clear out the canvas
            const canvas = document.getElementById("render-workarea") as HTMLCanvasElement
            const ctx = canvas!.getContext("2d");
            ctx!.clearRect(0, 0, canvas!.offsetWidth, canvas!.offsetHeight);
            ctx!.arc(center_x, 0, center_x, 0, 180)
            ctx!.stroke()
            ctx!.beginPath();
            ctx!.moveTo(center_x, 0);
            ctx!.lineTo(center_x, this.plot_width);
            ctx!.closePath();
            ctx!.stroke()
        },
    },
    mounted() {
        this.$nextTick(() => {
            this.render_workarea()
            this.gcode_convert();
        })
    }
});

</script>

<style>

.visuallyhidden {
  position: absolute;

  width: 1px;
  height: 1px;
  margin: -1px;
  border: 0;
  padding: 0;

  clip: rect(0 0 0 0);
  overflow: hidden;
}

svg path {
    fill: none;
    stroke: black;
}
</style>