import Vue from "vue";
import VueRouter from "vue-router";
import Home from "@/views/Home.vue";
import SCARA from "@/views/SCARA.vue";
import ScaraSim from "@/components/ScaraSim.vue"

Vue.use(VueRouter);

const routes = [
	{
		path: "/",
		name: "home",
		component: Home,
	},
	{
		path: "/scara",
		name: "SCARA",
		component: SCARA,
	},
	{
		path: "/sim",
		name: "sim",
		component: ScaraSim,
	},
];

const router = new VueRouter({
	mode: "history",
	base: process.env.BASE_URL,
	routes,
});

export default router;
