<template>
	<div id="scara-converter">
        <v-file-input @change="load_gcode_file" />
	</div>
</template>

<script lang="ts">
import Vue from "vue";
import {ScaraConverter} from "@/ScaraConverter";

export default Vue.extend({
	data() {
		return {
            scara: new ScaraConverter()
		};
	},
	methods: {
        download_gcode(filename: string, gcode_string: string) {
            var element = document.createElement('a');
            element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(gcode_string));
            element.setAttribute('download', filename);

            element.style.display = 'none';
            document.body.appendChild(element);

            element.click();

            document.body.removeChild(element);
        },
        load_gcode_file(file: File) {
            const reader = new FileReader();
            reader.onload = (ev: any) => {
                this.download_gcode(`${file.name.replace(".gcode", "").replace(".nc", "")}_converted.gcode`, this.scara.convert_cartesian_to_scara(ev.target!.result));
            };
            reader.readAsText(file);
        } 
	},
	mounted() {
		
	},
});
</script>

<style scoped>
	#serial-pane >>> .v-text-field__details {
		display: none;
	}
</style>