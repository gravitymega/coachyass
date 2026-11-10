/**
 * Ligue 3x3 du dimanche (14-15 ans), hiver 2027 : crée le Google Forms d'inscription.
 *
 * MODE D'EMPLOI (2 minutes, une seule fois) :
 *   1. Va sur https://script.google.com, connecté à ton compte Google, puis « Nouveau projet ».
 *   2. Efface le contenu, colle TOUT ce fichier, puis clique sur l'icône Enregistrer.
 *   3. En haut, choisis la fonction « creerFormulaire », puis clique sur « Exécuter ».
 *   4. Google demande l'autorisation : « Examiner les autorisations », choisis ton compte,
 *      « Paramètres avancés », « Accéder au projet (non sécurisé) », puis « Autoriser ».
 *      (Le message est normal : c'est ton propre script, il ne fait que créer un formulaire.)
 *   5. Ouvre « Journal d'exécution » en bas : tu y trouves 3 liens.
 *      - Lien à partager aux parents et aux joueurs
 *      - Lien pour modifier le formulaire
 *      - Google Sheet où arrivent les réponses
 *
 * Le formulaire et la feuille de réponses sont créés dans ton Google Drive.
 * Ne relance pas le script : il créerait un deuxième formulaire.
 */
function creerFormulaire() {
  var form = FormApp.create('Inscription · Ligue 3x3 du dimanche (14-15 ans) · Hiver 2027');

  form.setDescription(
    'Gravity Basketball (OSMM) · 11 dimanches de basketball 3x3 pour les 14-15 ans, de 12h à 14h, ' +
    'du 10 janvier au 21 mars 2027, au Collège Sainte-Anne (gymnase A, 1250, boul. St-Joseph, Lachine).\n\n' +
    'Matchs arbitrés (règles FIBA), classement en ligne, Top 5 vidéo chaque semaine, éliminatoires, finale et trophées. T-shirt inclus.\n\n' +
    'TARIFS\n' +
    '• Lève-tôt : 214 $ par joueur (jusqu\'au 6 décembre)\n' +
    '• Régulier : 268 $ par joueur (à partir du 7 décembre)\n' +
    '• Équipe complète de 4 : 792 $ (198 $ par joueur). Capitaine : 20 $ de rabais.\n' +
    '• Amène un ami : 10 $ de rabais pour chacun des deux.\n\n' +
    '8 équipes maximum. Chaque joueur remplit SON formulaire (même en équipe), avec un parent ou tuteur.\n\n' +
    'Questions : Yassine, 438-341-2051 · @GravityBasketballMTL'
  );
  form.setConfirmationMessage(
    'Merci ! Ta demande d\'inscription est bien reçue. 🏀\n\n' +
    'Ta place est confirmée à la réception du paiement :\n' +
    '• Interac : mqtad9@hotmail.com (mets le nom du joueur dans le message)\n' +
    '• Ou par carte avec le lien Zeffy qu\'on t\'enverra par courriel.\n\n' +
    'On te contacte avant le 6 janvier avec ton équipe et le calendrier. À bientôt sur le terrain !'
  );
  form.setProgressBar(true);
  form.setAllowResponseEdits(false);
  form.setLimitOneResponsePerUser(false); // pas de connexion Google obligatoire pour les parents

  var courriel = FormApp.createTextValidation()
    .setHelpText('Entre une adresse courriel valide.')
    .requireTextIsEmail()
    .build();
  var telephone = FormApp.createTextValidation()
    .setHelpText('Entre un numéro de téléphone (ex. 514-555-1234).')
    .requireTextMatchesPattern('^[0-9 ()+.\\-]{10,}$')
    .build();

  // ---------- 1. Le joueur ----------
  form.addSectionHeaderItem().setTitle('1. Le joueur');
  form.addTextItem().setTitle('Nom complet du joueur').setRequired(true);
  form.addDateItem().setTitle('Date de naissance').setHelpText('La ligue est pour les 14-15 ans.').setRequired(true);
  form.addTextItem().setTitle('École fréquentée').setRequired(false);
  form.addMultipleChoiceItem().setTitle('Niveau de basketball')
    .setChoiceValues(['Débutant (je joue pour le plaisir)', 'Intermédiaire (je joue souvent)', 'Avancé (équipe scolaire ou club)'])
    .setRequired(true);
  form.addListItem().setTitle('Taille de t-shirt')
    .setChoiceValues(['YM (jeune moyen)', 'YL (jeune large)', 'S', 'M', 'L', 'XL', 'XXL'])
    .setRequired(true);
  form.addTextItem().setTitle('Téléphone ou Instagram du joueur (optionnel)')
    .setHelpText('Pour l\'ajouter au groupe de son équipe.').setRequired(false);

  // ---------- 2. L'inscription ----------
  form.addPageBreakItem().setTitle('2. Ton inscription');
  form.addMultipleChoiceItem().setTitle('Type d\'inscription')
    .setChoiceValues([
      'Je suis CAPITAINE et j\'inscris une équipe complète de 4 (792 $ pour l\'équipe, 20 $ de rabais capitaine)',
      'Je fais partie d\'une équipe (mon capitaine inscrit l\'équipe)',
      'Je m\'inscris seul : agent libre (on me place dans une équipe)'
    ])
    .setRequired(true);
  form.addTextItem().setTitle('Nom de l\'équipe').setHelpText('Laisse vide si tu es agent libre.').setRequired(false);
  form.addTextItem().setTitle('Nom du capitaine').setHelpText('Laisse vide si tu es agent libre.').setRequired(false);
  form.addParagraphTextItem().setTitle('Noms des coéquipiers (capitaine seulement)')
    .setHelpText('Les 3 autres joueurs de ton équipe. Chacun doit aussi remplir ce formulaire avec son parent.')
    .setRequired(false);
  form.addTextItem().setTitle('Un ami t\'a parlé de la ligue ? Son nom')
    .setHelpText('10 $ de rabais pour toi et pour lui.').setRequired(false);
  form.addCheckboxItem().setTitle('Comment as-tu connu la ligue ?')
    .setChoiceValues(['Instagram', 'TikTok', 'Un ami', 'Mon école ou un prof', 'Affiche', 'Un parent', 'Mosquée ou centre communautaire', 'Site Gravity Basketball'])
    .showOtherOption(true)
    .setRequired(true);

  // ---------- 3. Le parent ----------
  form.addPageBreakItem().setTitle('3. Parent ou tuteur')
    .setHelpText('Le joueur est mineur : un parent ou tuteur doit remplir cette section.');
  form.addTextItem().setTitle('Nom du parent ou tuteur').setRequired(true);
  form.addTextItem().setTitle('Téléphone du parent').setValidation(telephone).setRequired(true);
  form.addTextItem().setTitle('Courriel du parent').setValidation(courriel).setRequired(true);
  form.addTextItem().setTitle('Contact d\'urgence (nom et téléphone)')
    .setHelpText('Une autre personne que le parent ci-dessus, si possible.').setRequired(true);
  form.addParagraphTextItem().setTitle('Allergies, condition médicale ou blessure à connaître')
    .setHelpText('Écris « Aucune » s\'il n\'y en a pas.').setRequired(true);

  // ---------- 4. Paiement ----------
  form.addPageBreakItem().setTitle('4. Paiement');
  form.addMultipleChoiceItem().setTitle('Tarif')
    .setChoiceValues([
      'Lève-tôt : 214 $ (jusqu\'au 6 décembre)',
      'Régulier : 268 $ (à partir du 7 décembre)',
      'Équipe complète de 4 : 792 $ (payé par le capitaine)',
      'Je suis dans une équipe : mon capitaine paie pour l\'équipe'
    ])
    .setRequired(true);
  form.addMultipleChoiceItem().setTitle('Mode de paiement')
    .setChoiceValues(['Virement Interac (mqtad9@hotmail.com)', 'Carte de crédit (lien Zeffy envoyé par courriel)'])
    .setRequired(true);
  form.addSectionHeaderItem().setTitle('Besoin d\'aide financière ?')
    .setHelpText('Écris-nous en privé au 438-341-2051 : on trouve une solution, personne n\'est laissé de côté.');

  // ---------- 5. Autorisations ----------
  form.addPageBreakItem().setTitle('5. Autorisations');
  form.addCheckboxItem().setTitle('Autorisation de participation')
    .setChoiceValues(['Je suis le parent ou tuteur du joueur. J\'autorise sa participation à la Ligue 3x3 du dimanche et je comprends que le basketball comporte des risques de blessure.'])
    .setRequired(true);
  form.addMultipleChoiceItem().setTitle('Photos et vidéos')
    .setHelpText('Chaque semaine, on publie les plus beaux jeux (Top 5) et le classement.')
    .setChoiceValues([
      'Oui, j\'autorise Gravity Basketball à publier des photos et vidéos de mon enfant (Instagram, Facebook, site web)',
      'Non, je ne veux pas que mon enfant apparaisse dans les publications'
    ])
    .setRequired(true);
  form.addCheckboxItem().setTitle('Esprit sportif')
    .setChoiceValues(['Le joueur s\'engage à respecter les arbitres, les adversaires, ses coéquipiers et le gymnase.'])
    .setRequired(true);

  // ---------- Feuille de réponses ----------
  var sheet = SpreadsheetApp.create('Réponses · Inscription Ligue 3x3 du dimanche (hiver 2027)');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, sheet.getId());

  Logger.log('Lien à partager (parents et joueurs) : ' + form.getPublishedUrl());
  Logger.log('Lien pour modifier le formulaire : ' + form.getEditUrl());
  Logger.log('Feuille des réponses : ' + sheet.getUrl());
}
