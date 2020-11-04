import Vue from "vue";
import App from "./App.vue";
import router from "./router";
import store from "./store";
import "./registerServiceWorker";
import vuetify from "./plugins/vuetify";

Vue.config.productionTip = false;

Vue.config.ignoredElements = [
	'a-scene',
	'a-assets',
	'a-sky',
	'a-camera',
	'a-cursor',
	'a-animation',
	'a-entity',
	'a-box',
	'a-cylinder',
	'a-plane'
]

new Vue({
	router,
	store,
	vuetify,
	render: h => h(App)
}).$mount("#app");
