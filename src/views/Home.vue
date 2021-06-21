<template>
	<div id="serial-pane" style="margin-left: 24px;">
		<div id="notSupported">
			Sorry, <b>Web Serial</b> is not supported on this device, make sure you're running Chrome 78 or later and have enabled the
			<code>#enable-experimental-web-platform-features</code> flag in
			<code>chrome://flags</code>
		</div>
		<div v-if="!serial_connected">
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
		<div v-if="serial_connected">
			<v-btn @click="origin_scara" style="transform: scale(0.85);">
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
			<br>
			<v-btn @click="clear_buffer" style="transform: scale(0.85);">
				Clear Buffer
			</v-btn>
			<v-btn @click="write_serial('M410\n'); ready_to_send=true" style="transform: scale(0.85);">
				Quickstop
			</v-btn>
			<v-btn @click="write_serial('M112\n')" style="transform: scale(0.85);">
				E-Stop
			</v-btn>
			<br>
			<v-btn @click="home_scara()" style="transform: scale(0.85);">
				Home
			</v-btn>
			<v-btn @click="home_scara(true)" style="transform: scale(0.85);">
				Fold-Up
			</v-btn>
			<v-btn @click="write_serial('M18\n')" style="transform: scale(0.85);">
				Release
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
		</div>
		<div style="margin-top: 14px; min-height: 20vh; max-height: 30vh; width: 90%; overflow-y: scroll; border: 1px dotted #333;">
			<span v-for="(entry, entryIndex) in serial_log" :key="entryIndex" v-html="entry" />
		</div>
		<v-expansion-panels>
			<v-expansion-panel>
				<v-expansion-panel-header color="#333">
					Text 🢂 SCARA
				</v-expansion-panel-header>
				<v-expansion-panel-content>
					<TextToGcode v-on:gcodegen="gcode_from_text" :x_offset="scara_conv.x_offset" :y_offset="scara_conv.y_offset"/>
					<br>
					<v-btn @click="send_converted_gcode" v-if="converted_gcode.length > 0">
						Send Converted GCODE
					</v-btn>
					<v-btn @click="regen_converted_gcode" v-if="raw_gcode.length > 0">
						Regen SCARA GCODE
					</v-btn>
					<v-btn @click="save_gcode(converted_gcode.join('\n'))" v-if="converted_gcode.length > 0">
						Save Converted GCODE
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
					<v-btn @click="save_gcode(raw_gcode)" v-if="converted_gcode.length > 0">
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

import { WorkerMsg, WorkerCmd, MasterCmd } from "@/serialtypes";
const serialworker = new Worker('!@/serialworker.ts', { type: 'module' });

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
			ready_to_send: true,
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
			serial_connected: false,
			attempting_to_connect: false,
			cancel_connect: false,
			reader: undefined as ReadableStreamDefaultReader<any> | undefined,
			writer: undefined as WritableStreamDefaultWriter<any> | undefined,
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
			const raw_gcode = `G1 X${this.goto.x} Y${this.goto.y} F20000\n`
			const scara_gcode = this.scara_conv.convert_cartesian_to_scara(raw_gcode);
			await this.write_serial(scara_gcode + "\n");
		},
		async home_scara(fold_up=false) {
			const fold_up_cmd_lines = [
				"G0 Z30 F5000",
				"G92 X0 Y0",
				"G0 Y25",
				"G28 X",
				"G28 Y",
				"G0 Y-30",
				"G0 X-10",
				"G92 X0 Y0",
			]
			const home_cmd_lines = [
				"G0 Z30 F5000",
				"G92 X0 Y0",
				"G0 Y30",
				"G28 X",
				"G28 Y",
				`G0 Y-${this.scara_conv.scara_props.y_estop_offset + 90}`,
				`G0 X-${this.scara_conv.scara_props.x_estop_offset}`,
				`G0 Y-${this.scara_conv.scara_props.y_estop_offset + 180}`,
				"G92 X0 Y0",
				"G1 Z0 F5000",
			];
			const cmd_lines = fold_up ? fold_up_cmd_lines : home_cmd_lines;
			for (const gcode_line_index in cmd_lines) {
				const gcode_line = cmd_lines[gcode_line_index]
				console.log(gcode_line)
				await this.write_serial(gcode_line + "\n");
			}
		},
		async origin_scara() {
			const home_cmd_lines = [
				"G0 Z10 F5000",
				"G0 X0 Y0 F5000",
				"G0 Z0 F5000",
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
		async write_cmd_to_serial() {
			await this.write_serial(this.cmd + "\n");
			this.send_log.unshift(this.cmd);
			this.cmd = "";
		},
		async write_serial(data: string) {
			serialworker.postMessage({ type: MasterCmd.PushToBuffer, data } as WorkerMsg)
		},
		async serial_connect() {
			serialworker.postMessage({ type: MasterCmd.SerialConnect } as WorkerMsg)
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
			// Add homing seq to end of gco de
			this.raw_gcode = gcode// + ["G0Z10", `G0X${this.scara_conv.scara_props.L1 + this.scara_conv.scara_props.L2}Y-${this.scara_conv.inner_rad}`, "G0Z0"].join("\n");
			this.regen_converted_gcode();
		},
		save_gcode(gcode: string) {
			(saveAs as any)(new Blob([gcode], {type: 'text/plain'}), "jscara_export.gcode")
		},
		clear_buffer() {
			serialworker.postMessage({ type: MasterCmd.ClearBuffer } as WorkerMsg)
			this.ready_to_send = true;
		},
		async send_converted_gcode() {
			serialworker.postMessage({ type: MasterCmd.PushToBuffer, data: this.converted_gcode})
			//this.send_buffer = this.send_buffer.concat(this.converted_gcode);
			//this.write_next_in_buffer_to_serial();
		}
	},
	mounted() {
		if ((navigator as any).serial !== undefined) {
			const notSupported = document.getElementById("notSupported");
			notSupported!.style.display = "none";
		}
		serialworker.onmessage = (event) => {
			const msg = event.data;
			if (msg.type == WorkerCmd.SerialConnected) {
				this.serial_connected = true;
			}
			if (msg.type == WorkerCmd.SerialRecv) {
				this.serial_log.unshift(msg.data)
			}
			console.log(msg)
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