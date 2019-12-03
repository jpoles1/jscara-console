<template>
	<div id="serial-pane">
		<div id="notSupported">
			Sorry, <b>Web Serial</b> is not supported on this device, make sure you're running Chrome 78 or later and have enabled the
			<code>#enable-experimental-web-platform-features</code> flag in
			<code>chrome://flags</code>
		</div>
		<div v-if="reader === undefined">
			<v-btn @click="serial_connect">
				Connect to SCARA
			</v-btn>
		</div>
		<div v-else style="display: flex; align-items: center;">
			<v-text-field label="GCODE Command" v-model="cmd" outlined style="max-width: 500px; margin-right: 30px;"/> 
			<v-btn @click="write_cmd_to_serial" style="transform: scale(1.2);">
				Send
			</v-btn>
		</div>
		<div style="height: 600px; width: 90%; overflow-y: scroll; border: 1px dotted #333;">
			<span v-for="(entry, entryIndex) in serial_log" :key="entryIndex" v-html="entry" />
		</div>
	</div>
</template>

<script lang="ts">

//https://codelabs.developers.google.com/codelabs/web-serial/

import Vue from "vue";

export default Vue.extend({
	data() {
		return {
			serial_log: [] as string[],
			cmd: "",
			reader: undefined as ReadableStreamDefaultReader<any> | undefined,
			output_stream: undefined as WritableStream<any> | undefined,
		};
	},
	methods: {
		async read_serial() {
			if (this.reader === undefined) return;
			while (true) {
				let { value, done } = await this.reader.read();
				if (value) {
					value = value.replace("\n", "<br>")
					this.serial_log.push(value);
				}
				if (done) {
					console.log("[readLoop] DONE", done);
					this.reader.releaseLock();
					break;
				}
			}
		},
		async write_cmd_to_serial() {
			await this.write_serial(this.cmd + "\n");
			this.cmd = "";
		},
		async write_serial(data: string) {
			console.log(data, this.output_stream);
			if (this.output_stream === undefined) {
				this.$toast("Failed to write to serial");
				return;
			}
			const writer = this.output_stream.getWriter();
			await writer.write(data);
			await writer.close();
			console.log("written");
		},
		async serial_connect() {
			let port = await (navigator as any).serial.requestPort();
			// - Wait for the port to open.
			await port.open({ baudrate: 9600 });
			// Setup Writer
			const encoder = new TextEncoderStream();
			const outputDone = encoder.readable.pipeTo(port.writable);
			this.output_stream = encoder.writable;
			// Setup Reader 
			let decoder = new TextDecoderStream();
			const inputDone = port.readable.pipeTo(decoder.writable);
			const inputStream = decoder.readable;
			this.reader = inputStream.getReader();
			this.read_serial();
		},
	},
	mounted() {
		console.log((navigator as any).serial !== undefined);
		if ((navigator as any).serial !== undefined) {
			const notSupported = document.getElementById("notSupported");
			notSupported!.style.display = "none";
		}
	},
});
</script>

<style scoped>
	#serial-pane >>> .v-text-field__details {
		display: none;
	}
</style>