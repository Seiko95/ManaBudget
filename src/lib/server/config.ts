import path from 'node:path';

/** Runtime configuration, read from the environment (adapter-node fills process.env). */
export const config = {
	get dataDir() {
		return path.resolve(process.env.DATA_DIR || './data');
	},
	get databasePath() {
		return process.env.DATABASE_PATH || path.join(this.dataDir, 'manabudget.db');
	},
	get uploadsDir() {
		return path.join(this.dataDir, 'uploads');
	},
	get migrationsDir() {
		return path.resolve(process.env.MIGRATIONS_DIR || './drizzle');
	},
	get tileUrl() {
		return process.env.TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
	},
	get nominatimUrl() {
		return process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org';
	},
	get geocodingEnabled() {
		return (process.env.GEOCODING_ENABLED ?? 'true').toLowerCase() !== 'false';
	},
	get geocoderUserAgent() {
		return process.env.GEOCODER_USER_AGENT || 'ManaBudget/1.0 (self-hosted budget app)';
	}
};
