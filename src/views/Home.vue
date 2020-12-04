<template>
	<div id="serial-pane" style="margin-left: 24px;">
		<div id="notSupported">
			Sorry, <b>Web Serial</b> is not supported on this device, make sure you're running Chrome 78 or later and have enabled the
			<code>#enable-experimental-web-platform-features</code> flag in
			<code>chrome://flags</code>
		</div>
		<div v-if="reader === undefined || output_stream === undefined">
			<v-btn @click="serial_connect" v-if="!attempting_to_connect" color="primary">
				Connect to SCARA
			</v-btn>
			<v-btn @click="cancel_connect = true" v-else color="error">
				Cancel Connect to SCARA
			</v-btn>
		</div>
		<div v-else style="display: flex; align-items: center;">
			<v-text-field label="GCODE Command" v-model="cmd" outlined style="max-width: 500px; margin-right: 30px;" 
			autocomplete="off"
			@keyup.enter.native="write_cmd_to_serial"  @keyup.up.native="recover_prev_cmd(1)" @keyup.down.native="recover_prev_cmd(-1)"/> 
			<v-btn @click="write_cmd_to_serial" style="transform: scale(1.2);">
				Send
			</v-btn>
		</div>
		<div v-if="!(reader === undefined || output_stream === undefined)">
			<v-btn @click="home_scara" style="transform: scale(0.85);">
				Origin
			</v-btn>
			<v-btn @click="write_serial('G92 X0 Y0\n')" style="transform: scale(0.85);">
				XY=0
			</v-btn>
			<v-btn @click="write_serial('G92 Z0\n')" style="transform: scale(0.85);">
				Z=0
			</v-btn>
			<v-btn @click="write_serial('G92 X0 Y0 Z0\n')" style="transform: scale(0.85);">
				XYZ=0
			</v-btn>
			<v-btn @click="write_serial('M18\n')" style="transform: scale(0.85);">
				Release Steppers
			</v-btn>
			<div style="display: flex; align-items: stretch;">
				<div class="jog-box">
					<div class="jog-col">
						<v-text-field v-model.number="jog_inc['x']" type="number" style="text-align: center;" step=5 />
						<v-btn @click="write_serial('G91\nG0 X' + jog_inc['x'] + '\nG90\n')" class="jog-btn">
							+X
						</v-btn>
						<v-btn @click="write_serial('G91\nG0 X-' + jog_inc['x'] + '\nG90\n')" class="jog-btn">
							-X
						</v-btn>
					</div>
					<div class="jog-col">
						<v-text-field v-model.number="jog_inc['y']" type="number" style="text-align: center;" step=5 />
						<v-btn @click="write_serial('G91\nG0 Y' + jog_inc['y'] + '\nG90\n')" class="jog-btn">
							+Y
						</v-btn>
						<v-btn @click="write_serial('G91\nG0 Y-' + jog_inc['y'] + '\nG90\n')" class="jog-btn">
							-Y
						</v-btn>
					</div>
					<div class="jog-col">
						<v-text-field v-model.number="jog_inc['z']" type="number" style="text-align: center;" step=5 />
						<v-btn @click="write_serial('G91\nG0 Z' + Math.max(1, jog_inc['z']) + '\nG90\n')" class="jog-btn">
							+Z
						</v-btn>
						<v-btn @click="write_serial('G91\nG0 Z-' + Math.max(1, jog_inc['z']) + '\nG90\n')" class="jog-btn">
							-Z
						</v-btn>
					</div>
				</div>
				<div style="width: 240px; margin: 10px 20px; padding: 16px 30px; background-color: #ffb8b8; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-direction: column" >
					<v-row>
						<v-text-field type="number" v-model.number="goto.x" label="X Position" style="width: 100px;"/>
						<div>&nbsp;&nbsp;&nbsp;</div>
						<v-text-field type="number" v-model.number="goto.y" label="Y Position" style="width: 100px;"/>
					</v-row>
					<v-row justify="center">
						<v-btn @click="goto_point">Go To</v-btn>
					</v-row>
				</div>
			</div>
			<v-text-field type="number" v-model.number="scara_conv.x_offset" label="X Offset" style="width: 100px;"/>
			<v-text-field type="number" v-model.number="scara_conv.y_offset" label="Y Offset" style="width: 100px;"/>
			Working Area: {{work_area_dim}} x {{work_area_dim}}
		</div>
		<div style="margin-top: 14px; min-height: 40vh; max-height: 60vh; width: 90%; overflow-y: scroll; border: 1px dotted #333;">
			<span v-for="(entry, entryIndex) in serial_log" :key="entryIndex" v-html="entry" />
		</div>
		<v-expansion-panels>
			<v-expansion-panel>
				<v-expansion-panel-header color="#333">
					Text 🢂 SCARA
				</v-expansion-panel-header>
				<v-expansion-panel-content>
					<TextToGcode v-on:gcodegen="gcode_from_text"/>
					<br>
					<v-btn @click="send_converted_gcode" v-if="converted_gcode.length > 0">
						Send Converted GCODE
					</v-btn>
					<v-btn @click="regen_converted_gcode" v-if="raw_gcode.length > 0">
						Regen SCARA GCODE
					</v-btn>
					<v-btn @click="write_next_in_buffer_to_serial" v-if="send_buffer.length > 0">
						Unclog Stuck Buffer
					</v-btn>
					<v-btn @click="clear_buffer" v-if="send_buffer.length > 0">
						Clear Buffer
					</v-btn>
				</v-expansion-panel-content>
			</v-expansion-panel>
			<v-expansion-panel>
				<v-expansion-panel-header color="#333">
					Image 🢂 SCARA	
				</v-expansion-panel-header>
				<v-expansion-panel-content>
					<ImgToGcode v-on:gcodegen="gcode_from_text"/>
					<br>
					<v-btn @click="send_converted_gcode" v-if="converted_gcode.length > 0">
						Send Converted GCODE
					</v-btn>
					<v-btn @click="regen_converted_gcode" v-if="raw_gcode.length > 0">
						Regen SCARA GCODE
					</v-btn>
					<v-btn @click="write_next_in_buffer_to_serial" v-if="send_buffer.length > 0">
						Unclog Stuck Buffer
					</v-btn>
					<v-btn @click="clear_buffer" v-if="send_buffer.length > 0">
						Clear Buffer
					</v-btn>
					<v-btn @click="saveGcode(raw_gcode)" v-if="converted_gcode.length > 0">
						Save Raw GCODE
					</v-btn>
				</v-expansion-panel-content>
			</v-expansion-panel>
			<v-expansion-panel>
				<v-expansion-panel-header>
					GCode Uploader
				</v-expansion-panel-header>
				<v-expansion-panel-content>
					<v-file-input @change="load_gcode_file" placeholder="Upload Cartesian GCODE" />
					<br>
					<v-btn @click="send_converted_gcode" v-if="converted_gcode.length > 0">
						Send Converted GCODE
					</v-btn>
					<v-btn @click="regen_converted_gcode" v-if="raw_gcode.length > 0">
						Regen SCARA GCODE
					</v-btn>
					<v-btn @click="write_next_in_buffer_to_serial" v-if="send_buffer.length > 0">
						Unclog Stuck Buffer
					</v-btn>
					<v-btn @click="clear_buffer" v-if="send_buffer.length > 0">
						Clear Buffer
					</v-btn>
				</v-expansion-panel-content>
			</v-expansion-panel>
			<v-expansion-panel>
				<v-expansion-panel-header>
					SCARA Sim
				</v-expansion-panel-header>
				<v-expansion-panel-content>
					<ScaraSim3D :uploaded_gcode="this.raw_gcode" :x_offset="scara_conv.x_offset" :y_offset="scara_conv.y_offset"/>
				</v-expansion-panel-content>
			</v-expansion-panel>
		</v-expansion-panels>
	</div>
</template>

<script lang="ts">

const async_wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

//https://codelabs.developers.google.com/codelabs/web-serial/

import Vue from "vue";
import {ScaraConverter} from "@/ScaraConverter";
import ScaraSim3D from "@/components/ScaraSim3D.vue";
import TextToGcode from "@/components/TextToGcode.vue";
import ImgToGcode from "@/components/ImgToGcode.vue";
import saveAs from "@/components/FileSaver"

export default Vue.extend({
	components: {
		ScaraSim3D,
		TextToGcode,
		ImgToGcode,
	},
	data() {
		return {
			raw_gcode: "",
			send_buffer: [] as string[],
			last_resp: undefined as number | undefined,
			send_buffer_interval: undefined as any,
			converted_gcode: [] as string[],
			scara_conv: new ScaraConverter((e: string) => {this.$toast(e, {x: "center", color: "red"})}),
			send_log: [] as string[],
			send_log_index: 0,
			recv_buffer: "",
			serial_log: [] as string[],
			cmd: "",
			jog_inc: {x: 10, y: 10, z: 10},
			goto: {x: 0, y: 0},
			attempting_to_connect: false,
			cancel_connect: false,
			reader: undefined as ReadableStreamDefaultReader<any> | undefined,
			output_stream: undefined as WritableStream<any> | undefined,
			regen_debounce: 0,
		};
	},
	watch: {
		"scara_conv.x_offset"() {
			clearTimeout(this.regen_debounce)
			this.regen_debounce = setTimeout(this.regen_converted_gcode, 500)
		},
		"scara_conv.y_offset"() {
			clearTimeout(this.regen_debounce)
			this.regen_debounce = setTimeout(this.regen_converted_gcode, 500)
		},
	},
	methods: {
		async goto_point() {
			const raw_gcode = `G1 X${this.goto.x} Y${this.goto.y} F50000\n`
			const scara_gcode = this.scara_conv.convert_cartesian_to_scara(raw_gcode);
			await this.write_serial(scara_gcode + "\n");
		},
		async home_scara() {
			const home_cmd_lines = [
				"G1 Z10 F5000",
				"G1 X0 Y0 F5000",
				"G1 Z0 F5000",
			];
			for (const gcode_line_index in home_cmd_lines) {
				const gcode_line = home_cmd_lines[gcode_line_index]
				await this.write_serial(gcode_line + "\n");
			}
		},
		recover_prev_cmd(inc: number) {
			if (this.cmd == this.send_log[this.send_log_index]) {
				this.send_log_index += inc;
				if (this.send_log_index < this.send_log.length) {
					this.cmd = this.send_log[this.send_log_index];
				}
			} else if (this.send_log.length > 0) {
				this.send_log_index = 0;
				this.cmd = this.send_log[this.send_log_index];
			}
		},
		async read_serial() {
			if (this.reader === undefined) return;
			while (true) {
				let { value, done } = await this.reader.read();
				if (value) {
					this.recv_buffer += value;
					if (this.recv_buffer.includes("\n")){
						if(this.send_buffer.length > 0 && (this.recv_buffer.includes("ok") || this.recv_buffer.includes("error:"))) {
							this.last_resp = Date.now();
							this.write_next_in_buffer_to_serial();
						}
						this.recv_buffer = this.recv_buffer.replace("\n", "<br>")
						this.serial_log.push(this.recv_buffer);
						this.recv_buffer = "";
					}
				}
				if (done) {
					console.log("[readLoop] DONE", done);
					this.reader.releaseLock();
					break;
				}
			}
		},
		async write_next_in_buffer_to_serial() {
			this.write_serial(this.send_buffer.shift() + "\n");
		},
		async write_cmd_to_serial() {
			await this.write_serial(this.cmd + "\n");
			this.send_log.unshift(this.cmd);
			this.cmd = "";
		},
		async write_serial(data: string) {
			//console.log(data, this.output_stream);
			if (this.output_stream === undefined) {
				this.$toast("Failed to write to serial");
				return;
			}
			const writer = this.output_stream.getWriter();
			await writer.write(data);
			await writer.releaseLock();
			//console.log("written");
		},
		async serial_connect() {
			let port = await (navigator as any).serial.requestPort();
			// - Wait for the port to open.
			let port_open_error = "" as any;
			this.attempting_to_connect = true;
			while (port_open_error != undefined) {
				port_open_error = undefined;
				await port.open({ baudRate: 250000 }).catch((e: any) => {
					this.$toast(`Failed to open serial connection: ${e}`)
					port_open_error = e;
				});
				if (this.cancel_connect) {
					this.cancel_connect = false;
					this.attempting_to_connect = false;
					return;
				}
				if (port_open_error != undefined) {
					await async_wait(1500);
				}
			}
			// Connected successfully
			this.attempting_to_connect = false;
			// Setup Writer
			const encoder = new TextEncoderStream();
			const outputDone = encoder.readable.pipeTo(port.writable);
			this.output_stream = encoder.writable;
			this.send_buffer_interval = setInterval(() => {
				if (this.send_buffer.length > 0 && ((Date.now() - (this.last_resp || 0)) / 1000 > 2)) {
					this.write_serial("?\n");
				}
			}, 4000);
			// Setup Reader 
			let decoder = new TextDecoderStream();
			const inputDone = port.readable.pipeTo(decoder.writable);
			const inputStream = decoder.readable;
			this.reader = inputStream.getReader();
			this.read_serial();
		},
		regen_converted_gcode() {
			this.converted_gcode = this.scara_conv.convert_cartesian_to_scara(this.raw_gcode).split("\n");
		},
		load_gcode_file(file: File) {
			if (file === null) return
            const reader = new FileReader();
            reader.onload = (ev: any) => {
				this.raw_gcode = ev.target!.result;
				this.regen_converted_gcode();
			};
            reader.readAsText(file);
		},
		gcode_from_text(gcode: string) {
			// Add homing seq to end of gcode
			this.raw_gcode = gcode + ["G0Z10", `G0X${this.scara_conv.scara_props.L1 + this.scara_conv.scara_props.L2}Y-${this.scara_conv.inner_rad}`, "G0Z0"].join("\n");
			this.regen_converted_gcode();
		},
		saveGcode(gcode: string) {
			(saveAs as any)(new Blob([gcode], {type: 'text/plain'}), "jscara_export.gcode")
		},
		clear_buffer() {
			this.send_buffer = [];
		},
		async send_converted_gcode() {
			this.send_buffer = this.send_buffer.concat(this.converted_gcode);
			this.write_next_in_buffer_to_serial();
		}
	},
	computed: {
		work_area_dim(): number {
			const R = this.scara_conv.inner_rad
			const L = this.scara_conv.scara_props.L1 + this.scara_conv.scara_props.L2
			return parseFloat(((-R + Math.sqrt(2 * L**2 - R**2))/2).toFixed(0));
		},
	},
	mounted() {
		if ((navigator as any).serial !== undefined) {
			const notSupported = document.getElementById("notSupported");
			notSupported!.style.display = "none";
		}
	},
});
</script>

<style>
	.jog-box {
		display: flex;
		align-items: center;
		background-color: lightblue;
		width: 240px;
		justify-content: center;
		padding: 16px;
		border-radius: 10px;
		margin: 10px 0;
	}
	.jog-col {
		display: flex;
		flex-direction: column;
	}
	.jog-col input {
		text-align: center;
	}
	.jog-btn {
		transform: scale(0.85);
		min-width: 0;
		font-weight: bold;
		font-size: 150%;
	}
	#serial-pane .v-text-field__details {
		display: none;
	}
	.v-expansion-panel-content {
		border-top: 1px solid #999;
    	padding-top: 20px;
	}
</style>