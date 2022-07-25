import Vue from "vue";
import Vuetify from "vuetify";
import "vuetify/dist/vuetify.min.css";

Vue.use(Vuetify);

import VuetifyToast from "vuetify-toast-snackbar";
Vue.use(VuetifyToast, {
	showClose: false,
	color: "#403e4d",
});

export default new Vuetify({
	theme: { dark: true },
});
