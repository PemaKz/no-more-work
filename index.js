const { Kernel, BullBoardExtension, Service } = require('zyket');

// Service que aplica las migraciones Sequelize (umzug) al boot. Vive aquí
// y no en el engine porque las migraciones cubren modelos del proyecto
// entero, no solo del engine. Se registra como PRIMER servicio del
// usuario para que las tablas existan antes de que cualquier otro
// servicio (auth, nmw-engine, ...) las consulte.
class MigrationsService extends Service {
	#container;
	constructor(container) {
		super('migrations');
		this.#container = container;
	}
	async boot() {
		await this.#container.get('database').runMigrations();
	}
}

const kernel = new Kernel({
	services: [
		['migrations', MigrationsService, ['@service_container']],
		['auth', require('./src/services/auth'), ['@service_container']],
		['nmw-engine', require('./src/services/nmw-engine'), ['@service_container']],
	],
    extensions: [
        new BullBoardExtension({
        }),
    ],
});

kernel.boot().catch((error) => {
    console.error('Error booting kernel:', error);
});
