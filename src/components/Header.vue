<template>
	<div>
		<v-navigation-drawer v-model="drawer" clipped mobile-break-point="600" width="180" v-if="$vuetify.breakpoint.xsOnly">
			<v-list shaped>
				<v-list-tile v-for="(navEntry, navIndex) in navList" :key="navIndex" :to="navEntry.url" @click="drawer = false" :draggable="false">
					<v-list-tile-action v-if="navEntry.icon" style="margin-right: 0px;">
						<v-icon>{{ navEntry.icon || "grip-lines" }}</v-icon>
					</v-list-tile-action>
					<v-list-tile-content>
						<v-list-tile-title style="font-size: 120%;">
							{{ navEntry.name }}
						</v-list-tile-title>
					</v-list-tile-content>
				</v-list-tile>
			</v-list>
		</v-navigation-drawer>
		<v-toolbar>
			<span v-if="$vuetify.breakpoint.xsOnly">
				<div @click="drawer = !drawer">
					<v-icon>fa-bars</v-icon>
				</div>
			</span>
			<v-toolbar-title class="headline">
				<router-link to="/" class="header-logo" style="text-decoration: none;">
					<span>JSCARA</span>
				</router-link>
			</v-toolbar-title>
			<v-spacer v-if="$vuetify.breakpoint.smAndUp" />
			<span v-if="$vuetify.breakpoint.smAndUp">
				<v-btn :to="navEntry.url" class="header-nav" v-for="(navEntry, navIndex) in navList" :key="navIndex">
					<span class="mr-2">{{ navEntry.name }}</span>
					<v-icon>fas {{ navEntry.icon }}</v-icon>
				</v-btn>
			</span>
		</v-toolbar>
	</div>
</template>

<script lang="ts">
import Vue from "vue";
export default Vue.extend({
	data() {
		return {
			drawer: false,
		};
	},
	computed: {
		navList(): any {
			const navList = [];
			//navList.push({ name: "Genius", icon: "fa-user-cog", url: "/" });
			return navList;
		},
	},
});
</script>

<style scoped>
.header-logo {
	color: white;
	transition: 0.6s;
}
.header-logo:hover {
	color: #e06868;
	transition: 1s;
}
.header-nav {
	color: white;
	transition: 0.6s;
	transition-delay: 0s;
}
.header-nav:hover {
	color: #dc97ff;
	transition: 0.8s;
	transition-delay: 0s;
}
</style>
