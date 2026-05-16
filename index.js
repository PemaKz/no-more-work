const { Kernel } = require('zyket');

const kernel = new Kernel({
	services: [
		['auth', require('./src/services/auth'), ["@service_container"]],
	]
});

kernel.boot().then(() => {
    console.log('Kernel booted successfully!');
}).catch((error) => {
    console.error('Error booting kernel:', error);
});
