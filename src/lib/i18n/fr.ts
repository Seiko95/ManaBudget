/**
 * Every UI string lives here so another language can be added later
 * without hunting through components.
 */
export const fr = {
	app: {
		name: 'ManaBudget',
		tagline: 'Votre budget, chez vous.'
	},
	common: {
		save: 'Enregistrer',
		cancel: 'Annuler',
		delete: 'Supprimer',
		edit: 'Modifier',
		create: 'Créer',
		add: 'Ajouter',
		close: 'Fermer',
		back: 'Retour',
		search: 'Rechercher',
		loading: 'Chargement…',
		none: 'Aucun',
		optional: 'facultatif',
		yes: 'Oui',
		no: 'Non',
		confirmDelete: 'Supprimer définitivement ?',
		archive: 'Archiver',
		unarchive: 'Désarchiver',
		archived: 'Archivé',
		showArchived: 'Afficher les éléments archivés',
		saved: 'Enregistré',
		error: 'Une erreur est survenue',
		required: 'Champ obligatoire',
		invalidAmount: 'Montant invalide',
		invalidDate: 'Date invalide',
		notFound: 'Introuvable'
	}
} as const;

export type Messages = typeof fr;
export const t = fr;
