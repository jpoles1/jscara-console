<template>
	<v-app>
		<Header />
		<v-content style="margin-top: 20px;">
			<router-view></router-view>
		</v-content>
		<Footer />
	</v-app>
</template>

<script lang="ts">
import Header from "@/components/Header.vue";
import Vue from "vue";
export default Vue.extend({
	name: "App",
	components: {
		Header,
	},
});
</script>

<style>
.flex-break {
	width: 100%;
	content: "";
	margin: 20px 0;
}
</style>
