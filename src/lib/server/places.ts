import { asc, eq } from 'drizzle-orm';
import type { DB } from './db';
import { places, type Place } from './db/schema';
import { getCategory } from './budgets';
import { notFoundUnless, owned, ownedById } from './scope';
import { t } from '../i18n/fr';

export type PlaceInput = {
	name: string;
	address: string;
	lat: number | null;
	lng: number | null;
	defaultCategoryId: number | null;
};

export function validatePlaceInput(input: Pick<PlaceInput, 'name' | 'lat' | 'lng'>): string | null {
	if (!input.name.trim()) return t.places.nameRequired;
	if ((input.lat == null) !== (input.lng == null)) return t.places.invalidCoords;
	if (input.lat != null && (Math.abs(input.lat) > 90 || Math.abs(input.lng!) > 180))
		return t.places.invalidCoords;
	return null;
}

export function listPlaces(
	db: DB,
	userId: number,
	opts: { includeArchived?: boolean } = {}
): Place[] {
	return db
		.select()
		.from(places)
		.where(owned(places, userId, opts.includeArchived ? undefined : eq(places.archived, false)))
		.orderBy(asc(places.name))
		.all();
}

export function getPlace(db: DB, userId: number, id: number): Place {
	return notFoundUnless(
		db
			.select()
			.from(places)
			.where(ownedById(places, userId, id))
			.get()
	);
}

function checkCategory(db: DB, userId: number, categoryId: number | null) {
	if (categoryId != null) getCategory(db, userId, categoryId);
}

export function createPlace(db: DB, userId: number, input: PlaceInput): Place {
	checkCategory(db, userId, input.defaultCategoryId);
	return db
		.insert(places)
		.values({ userId, ...input, name: input.name.trim(), address: input.address.trim() })
		.returning()
		.get();
}

export function updatePlace(db: DB, userId: number, id: number, input: PlaceInput): Place {
	getPlace(db, userId, id);
	checkCategory(db, userId, input.defaultCategoryId);
	return db
		.update(places)
		.set({ ...input, name: input.name.trim(), address: input.address.trim() })
		.where(ownedById(places, userId, id))
		.returning()
		.get();
}

export function setPlaceArchived(db: DB, userId: number, id: number, archived: boolean) {
	getPlace(db, userId, id);
	db.update(places)
		.set({ archived })
		.where(ownedById(places, userId, id))
		.run();
}

/** Deletes for good. Past expenses and recurring rules keep everything but the place (FK set null). */
export function deletePlace(db: DB, userId: number, id: number) {
	getPlace(db, userId, id);
	db.delete(places)
		.where(ownedById(places, userId, id))
		.run();
}
