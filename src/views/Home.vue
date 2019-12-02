<template>
	<div>
		<div id="notSupported">
			Sorry, <b>Web Serial</b> is not supported on this device, make sure you're running Chrome 78 or later and have enabled the
			<code>#enable-experimental-web-platform-features</code> flag in
			<code>chrome://flags</code>
		</div>

		<v-btn @click="serialConnect">
			Connect to SCARA
		</v-btn>
	</div>
</template>

<script lang="ts">
import Vue from "vue";

export default Vue.extend({
	methods: {
		async serialConnect() {
			(navigator as any).serial
				.requestDevice({ filters: [{}] })
				.then((device: any) => {
					console.log(device.productName); // "Arduino Micro"
					console.log(device.manufacturerName); // "Arduino LLC"
				})
				.catch((error: any) => {
					console.log(error);
				});
		},
	},
	mounted() {
		if ("serial" in navigator) {
			const notSupported = document.getElementById("notSupported");
			notSupported!.classList.add("hidden");
		}
	},
});
</script>
