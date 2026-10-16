/**
 * Every UI string lives here so another language can be added later
 * without hunting through components.
 */
export const fr = {
	app: {
		name: 'ManaBudget',
		tagline: 'Votre budget, chez vous.'
	},
	nav: {
		dashboard: 'Tableau de bord',
		dashboardShort: 'Accueil',
		expenses: 'Dépenses',
		incomes: 'Revenus',
		budgets: 'Budgets',
		places: 'Lieux',
		recurring: 'Récurrents',
		stats: 'Statistiques',
		statsShort: 'Stats',
		settings: 'Réglages',
		admin: 'Administration',
		more: 'Plus',
		newExpense: 'Nouvelle dépense',
		mainNav: 'Navigation principale'
	},
	auth: {
		username: "Nom d'utilisateur",
		password: 'Mot de passe',
		passwordConfirm: 'Confirmer le mot de passe',
		displayName: 'Nom affiché',
		login: 'Se connecter',
		logout: 'Se déconnecter',
		loginTitle: 'Connexion',
		invalidCredentials: "Nom d'utilisateur ou mot de passe incorrect",
		tooManyAttempts: 'Trop de tentatives. Réessayez dans {minutes} min.',
		setupTitle: 'Bienvenue sur ManaBudget',
		setupIntro:
			'Créez le compte administrateur. Il pourra ensuite créer les comptes des autres utilisateurs.',
		setupSubmit: 'Créer le compte administrateur',
		usernameInvalid:
			"Le nom d'utilisateur doit faire 3 à 32 caractères : lettres, chiffres, point, tiret ou tiret bas.",
		usernameTaken: "Ce nom d'utilisateur est déjà pris",
		displayNameRequired: 'Le nom affiché est obligatoire',
		passwordTooShort: 'Le mot de passe doit contenir au moins 8 caractères',
		passwordMismatch: 'Les mots de passe ne correspondent pas'
	},
	period: {
		prev: 'Période précédente',
		next: 'Période suivante',
		current: 'Aujourd’hui'
	},
	budgets: {
		title: 'Budgets',
		subtitle: 'Chaque budget regroupe des catégories. Les limites sont mensuelles.',
		newBudget: 'Nouveau budget',
		editBudget: 'Modifier le budget',
		name: 'Nom',
		icon: 'Icône (emoji)',
		color: 'Couleur',
		limit: 'Limite mensuelle',
		limitHelp: 'Laisser vide ou 0 pour ne pas fixer de limite.',
		limitFrom:
			'S’applique à partir de la période {period} ; les périodes précédentes gardent leur limite.',
		noLimit: 'Pas de limite',
		limitValue: 'Limite : {amount}',
		alertThreshold: 'Alerte à (%)',
		alertHelp: 'Une alerte s’affiche quand ce pourcentage de la limite est atteint.',
		alertValue: 'alerte à {pct}',
		categories: 'Catégories',
		newCategory: 'Nouvelle catégorie',
		editCategory: 'Modifier la catégorie',
		categoryBudget: 'Budget',
		moveUp: 'Monter',
		moveDown: 'Descendre',
		archiveBudgetConfirm:
			'Archiver « {name} » ? Il disparaît des formulaires mais les dépenses passées sont conservées.',
		budgetSaved: 'Budget enregistré',
		categorySaved: 'Catégorie enregistrée',
		archivedDone: 'Archivé',
		unarchivedDone: 'Désarchivé',
		nameRequired: 'Le nom est obligatoire',
		empty: 'Aucune catégorie'
	},
	settings: {
		title: 'Réglages',
		profile: 'Profil',
		period: 'Période budgétaire',
		monthStartDay: 'Le mois commence le',
		monthStartHelp:
			'Jour de votre paie, par exemple. Avec le 25, la période « Octobre » va du 25 septembre au 24 octobre.',
		dayN: 'le {n}',
		changePassword: 'Changer le mot de passe',
		currentPassword: 'Mot de passe actuel',
		newPassword: 'Nouveau mot de passe',
		wrongPassword: 'Mot de passe actuel incorrect',
		passwordChanged: 'Mot de passe modifié',
		saved: 'Réglages enregistrés'
	},
	admin: {
		title: 'Administration',
		subtitle:
			"Comptes utilisateurs. L'administrateur n'a pas accès aux données des autres comptes.",
		newUser: 'Nouvel utilisateur',
		isAdmin: 'Administrateur',
		created: 'Utilisateur créé',
		createdAt: 'Créé le {date}',
		resetPassword: 'Réinitialiser le mot de passe',
		newPassword: 'Nouveau mot de passe',
		passwordReset: 'Mot de passe réinitialisé',
		disable: 'Désactiver',
		enable: 'Réactiver',
		disabled: 'Compte désactivé',
		enabled: 'Compte réactivé',
		disabledBadge: 'Désactivé',
		adminBadge: 'Admin',
		you: 'vous',
		deleteUser: 'Supprimer le compte',
		deleteConfirm:
			'Supprimer le compte « {name} » et toutes ses données (dépenses, photos…) ? Cette action est irréversible.',
		deleted: 'Compte supprimé',
		notSelf: 'Vous ne pouvez pas faire cela sur votre propre compte'
	},
	errors: {
		unauthorized: 'Veuillez vous connecter',
		forbidden: 'Accès refusé',
		notFound: 'Page introuvable',
		home: "Retour à l'accueil"
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
